import { describe, it, expect } from 'vitest';
import { projectHistory, projectContext, EvaluationSchema, InfographicSchema } from './ai';
import {
  evaluationSystemPrompt,
  chatSystemPrompt,
  infographicSystemPrompt,
  resolveLanguage,
  VERDICTS,
} from './prompts';

/**
 * P2-06 — the chat route used to run `SELECT *` and stringify whole rows into
 * the system prompt: unbounded tokens, and every column disclosed including any
 * added to the table later.
 */
describe('history projection (P2-06)', () => {
  const row = (over: Record<string, unknown> = {}) => ({
    id: 42,
    project_id: 'CAPEX-2026-001',
    machine_name: 'Auto Stitcher',
    vendor: 'ACME',
    annual_savings: 1234,
    roi_months: 18,
    user_id: 'secret-user-uuid',
    internal_notes: 'do not disclose',
    form_data: { localLaborCost: 300 },
    ...over,
  });

  it('drops fields that are not on the whitelist', () => {
    const out = projectHistory([row()]);
    expect(out).toContain('CAPEX-2026-001');
    expect(out).toContain('Auto Stitcher');
    expect(out).not.toContain('secret-user-uuid');
    expect(out).not.toContain('do not disclose');
    expect(out).not.toContain('localLaborCost');
  });

  it('caps the number of rows', () => {
    const out = projectHistory(Array.from({ length: 50 }, (_, i) => row({ project_id: `P-${i}` })));
    expect(out).toContain('P-0');
    expect(out).not.toContain('P-20');
  });

  it('caps total length', () => {
    const huge = Array.from({ length: 50 }, (_, i) => row({ machine_name: 'X'.repeat(2_000), project_id: `P-${i}` }));
    expect(projectHistory(huge).length).toBeLessThanOrEqual(6_100);
  });

  it('handles an empty or non-array history', () => {
    expect(projectHistory([])).toBe('No comparable projects on record.');
    expect(projectHistory(undefined as unknown as unknown[])).toBe('No comparable projects on record.');
  });
});

describe('context projection', () => {
  it('summarises the live project without dumping the whole payload', () => {
    const out = projectContext({
      params: { equipmentName: 'Cell A', shoeModel: 'M1', currentPPH: 60, scopeOfWork: 'x'.repeat(5_000) },
      advancedResults: {
        savings: { totalAnnualSaving: 1000, manpowerSaving: 1.5 },
        payback: { kind: 'months', months: 24 },
        investment: { gross: 100, net: 50 },
        current: { costPerPair: 0.1 },
        proposed: { costPerPair: 0.08 },
      },
    });
    expect(out).toContain('Cell A');
    expect(out).toContain('"months": 24');
    // scopeOfWork is not part of the projection.
    expect(out).not.toContain('xxxxx');
  });

  it('handles a missing project', () => {
    expect(projectContext(null)).toBe('No project loaded.');
    expect(projectContext(undefined)).toBe('No project loaded.');
  });
});

/**
 * P2-02 — the rubric previously existed in only one of two deployments, so the
 * other returned verdicts that did not match what the UI styles against.
 */
describe('prompts carry the audit rubric (P2-02)', () => {
  it('includes the rubric and the exact verdict enum for every language', () => {
    for (const lang of Object.keys(VERDICTS) as Array<keyof typeof VERDICTS>) {
      const prompt = evaluationSystemPrompt(lang);
      expect(prompt).toContain('Senior Factory Operations');
      expect(prompt).toContain('Data Sanity & Critical Audit');
      for (const verdict of VERDICTS[lang]) expect(prompt).toContain(verdict);
    }
  });

  it('requires the model to cite figures', () => {
    expect(evaluationSystemPrompt('EN')).toMatch(/reference a specific figure/i);
  });

  it('states the payback basis so the model does not re-derive it', () => {
    expect(evaluationSystemPrompt('EN')).toMatch(/NET incremental investment/);
  });

  it('enforces language on the chat route too (P2-08)', () => {
    const vi = chatSystemPrompt('VI', '{}', '[]');
    expect(vi).toContain('Vietnamese');
    const en = chatSystemPrompt('EN', '{}', '[]');
    expect(en).toContain('English');
  });

  it('embeds the supplied context and history into the chat prompt', () => {
    const prompt = chatSystemPrompt('EN', 'CONTEXT_MARKER', 'HISTORY_MARKER');
    expect(prompt).toContain('CONTEXT_MARKER');
    expect(prompt).toContain('HISTORY_MARKER');
  });

  it('constrains the infographic output shape', () => {
    const prompt = infographicSystemPrompt('EN');
    expect(prompt).toContain('keyStats');
    expect(prompt).toContain('highlights');
  });

  it('falls back to English for an unknown language', () => {
    expect(resolveLanguage('KL')).toBe('EN');
    expect(resolveLanguage(undefined)).toBe('EN');
    expect(resolveLanguage('VI')).toBe('VI');
  });
});

/**
 * P2-05 — output was parsed and rendered unvalidated, so a missing key crashed
 * the infographic on `data.keyStats.map`.
 */
describe('response schemas (P2-05)', () => {
  it('defaults missing arrays rather than yielding undefined', () => {
    const parsed = InfographicSchema.parse({ title: 'T' });
    expect(parsed.keyStats).toEqual([]);
    expect(parsed.highlights).toEqual([]);
  });

  it('rejects an evaluation with no summary', () => {
    expect(EvaluationSchema.safeParse({ verdict: 'Reject / Drop' }).success).toBe(false);
  });

  it('accepts a well-formed evaluation', () => {
    const result = EvaluationSchema.safeParse({
      summary: 'Payback is 24 months on $50k net.',
      verdict: 'Proceed with Caution',
      pros: ['Frees 1.5 operators'],
      cons: ['Maintenance unproven'],
      risks: ['OEE may drop'],
    });
    expect(result.success).toBe(true);
  });

  it('rejects a non-object response', () => {
    expect(InfographicSchema.safeParse('not json').success).toBe(false);
  });
});
