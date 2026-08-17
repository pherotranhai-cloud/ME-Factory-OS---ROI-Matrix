import OpenAI from 'openai';
import { z } from 'zod';
// Explicit extensions: production runs `ts-node server.ts` directly, where an
// extensionless relative import fails to resolve at runtime.
import { type ProjectInput, type SideInput, type SideResult } from '../domain/model.ts';
import { calculateProject } from '../domain/engine.ts';
import { validateProject } from '../domain/validate.ts';

/**
 * Shared plumbing for every AI route: bounded calls, schema-validated output,
 * and a single repair attempt before giving up.
 *
 * Previously each route parsed `JSON.parse(response)` and handed the result
 * straight to the UI, so a missing key crashed the infographic on
 * `data.keyStats.map` (P2-05), and no call had a timeout, retry or token cap
 * (P2-09) — a stalled upstream held a serverless invocation to the platform
 * limit.
 */

export const MODEL = 'gpt-5.4-mini-2026-03-17';

/** Upper bound per call. Generous for these payloads, but finite. */
const MAX_TOKENS = 1_500;
const TIMEOUT_MS = 30_000;

export const EvaluationSchema = z.object({
  summary: z.string().min(1),
  verdict: z.string().min(1),
  pros: z.array(z.string()).default([]),
  cons: z.array(z.string()).default([]),
  risks: z.array(z.string()).default([]),
});

export const InfographicSchema = z.object({
  title: z.string().min(1),
  keyStats: z.array(z.string()).default([]),
  highlights: z.array(z.string()).default([]),
});

export const ChatSchema = z.object({
  text: z.string().min(1),
});

export type Evaluation = z.infer<typeof EvaluationSchema>;
export type InfographicCopy = z.infer<typeof InfographicSchema>;

export class AIError extends Error {
  // Declared and assigned explicitly rather than as constructor parameter
  // properties: production runs `ts-node server.ts` on Node 24, which strips
  // types rather than compiling them, and parameter properties emit code.
  readonly status: number;
  readonly detail?: string;

  constructor(message: string, status = 502, detail?: string) {
    super(message);
    this.name = 'AIError';
    this.status = status;
    this.detail = detail;
  }
}

let client: OpenAI | null = null;
const getClient = (): OpenAI => {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new AIError('AI is not configured on this server.', 503);
  if (!client) client = new OpenAI({ apiKey, timeout: TIMEOUT_MS, maxRetries: 0 });
  return client;
};

interface CallOptions<T> {
  system: string;
  user: string;
  schema: z.ZodType<T>;
  /** JSON mode off for free-text chat. */
  json?: boolean;
}

const completion = async (
  system: string,
  user: string,
  json: boolean,
  extra?: string,
): Promise<string> => {
  const messages: Array<{ role: 'system' | 'user'; content: string }> = [
    { role: 'system', content: extra ? `${system}\n\n${extra}` : system },
    { role: 'user', content: user },
  ];

  const res = await getClient().chat.completions.create(
    {
      model: MODEL,
      messages,
      max_completion_tokens: MAX_TOKENS,
      ...(json ? { response_format: { type: 'json_object' as const } } : {}),
    },
    { signal: AbortSignal.timeout(TIMEOUT_MS) },
  );

  return res.choices[0]?.message?.content ?? '';
};

/**
 * Call the model and validate the result. On a schema failure, retry ONCE with
 * the validation errors echoed back, then fail with a typed error the route can
 * turn into a readable message rather than a crash.
 */
export const callStructured = async <T>({ system, user, schema, json = true }: CallOptions<T>): Promise<T> => {
  let raw = '';
  let lastIssue = '';

  for (let attempt = 0; attempt < 2; attempt += 1) {
    const repair =
      attempt === 0
        ? undefined
        : `Your previous reply did not satisfy the required schema: ${lastIssue}\nReturn corrected JSON only.`;

    try {
      raw = await completion(system, user, json, repair);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (err instanceof AIError) throw err;
      throw new AIError('The AI service did not respond in time.', 504, message);
    }

    let parsed: unknown;
    if (json) {
      try {
        parsed = JSON.parse(raw || '{}');
      } catch {
        lastIssue = 'response was not valid JSON';
        continue;
      }
    } else {
      parsed = { text: raw };
    }

    const result = schema.safeParse(parsed);
    if (result.success) return result.data;
    lastIssue = result.error.issues.map((i) => `${i.path.join('.') || 'root'}: ${i.message}`).join('; ');
  }

  throw new AIError('The AI returned a response we could not read. Please try again.', 502, lastIssue);
};

/* ------------------------------------------------------------------ *
 * Context projection (P2-06)
 * ------------------------------------------------------------------ */

/** Fields the model is allowed to see from a stored report. */
const HISTORY_FIELDS = [
  'project_id',
  'machine_name',
  'vendor',
  'shoe_model',
  'investment_cost',
  'annual_savings',
  'roi_months',
  'fob_impact',
  'ai_verdict',
  'status',
] as const;

const MAX_HISTORY_ROWS = 8;
const MAX_CONTEXT_CHARS = 6_000;

const truncate = (s: string, max: number) => (s.length > max ? `${s.slice(0, max)}\n…(truncated)` : s);

const round = (n: number, d = 2): number =>
  Number.isFinite(n) ? Number(n.toFixed(d)) : 0;

/**
 * Structural check, not a schema parse. The payload arrives from our own client,
 * and `calculateProject` already coerces every non-finite value — so the only
 * question worth asking is which of the two shapes this is.
 */
const isProjectInput = (v: unknown): v is ProjectInput => {
  if (!v || typeof v !== 'object') return false;
  const o = v as Partial<ProjectInput>;
  return (
    typeof o.demandPairsPerYear === 'number'
    && !!o.baseline && typeof o.baseline === 'object'
    && !!o.proposed && typeof o.proposed === 'object'
    && !!o.labour && typeof o.labour === 'object'
    && !!o.calendar && typeof o.calendar === 'object'
  );
};

/**
 * Project stored reports down to a whitelist before they reach a prompt.
 *
 * The previous implementation ran `SELECT *` and stringified whole rows into the
 * system instruction — unbounded token growth and broad over-disclosure of every
 * column, including anything later added to the table.
 */
export const projectHistory = (rows: unknown[]): string => {
  if (!Array.isArray(rows) || rows.length === 0) return 'No comparable projects on record.';

  const compact = rows.slice(0, MAX_HISTORY_ROWS).map((row) => {
    const r = row as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const f of HISTORY_FIELDS) {
      if (r[f] !== undefined && r[f] !== null) out[f] = r[f];
    }
    return out;
  });

  return truncate(JSON.stringify(compact, null, 1), MAX_CONTEXT_CHARS);
};

/**
 * Context for a project on the rebuilt engine.
 *
 * Recomputed here from the input rather than read off a client-supplied result:
 * the engine is pure, so the same input gives the same figures, and the model
 * can never be handed a result that disagrees with the inputs beside it.
 *
 * The validation findings travel with the numbers deliberately. A payback of
 * 15.8 months means something different when the case banks 100% of a
 * theoretical labour saving, and an assistant that reports the figure without
 * the caveat is worse than one that says nothing.
 */
const rebuiltContext = (input: ProjectInput): string => {
  const r = calculateProject(input);
  const issues = validateProject(input);

  const side = (s: SideResult, i: SideInput) => ({
    label: s.label,
    unitsRequired: s.fleet.units.value,
    // Kept distinct on purpose: conflating the two is what produced a 27x
    // labour overstatement in the model this engine replaced.
    machineCycleSec: i.machine.machineCycleSec,
    labourCycleSec: i.machine.labourCycleSec,
    shift: `${i.shift.shiftsPerDay} x ${i.shift.hoursPerShift}h`,
    operatorsImplied: round(s.operators.value, 1),
    annualCost: round(s.totalAnnual.value),
    costPerPair: round(s.costPerPair.value, 4),
    capital: round(s.capex.value),
  });

  const summary = {
    project: input.projectName,
    article: input.article,
    annualDemandPairs: input.demandPairsPerYear,
    // These decide what every figure below means, so they lead.
    basis: {
      cost: input.costBasis,
      labour: input.labour.basis,
      labourConversionFactor: input.labour.conversionFactor,
      horizonYears: input.horizonYears,
      lineEfficiency: input.calendar.lineEfficiency,
      downtimeAllowance: input.calendar.downtimeAllowance,
    },
    baseline: side(r.baseline, input.baseline),
    proposed: side(r.proposed, input.proposed),
    savingByLine: r.savings.lines.map((l) => ({
      line: l.label,
      annualDelta: round(l.annualDelta),
      shareOfTotal: round(l.share, 4),
    })),
    netAnnualSaving: round(r.savings.totalAnnual.value),
    savingPerPair: round(r.savings.perPair.value, 4),
    incrementalCapital: round(r.investment.incremental.value),
    paybackMonths: r.paybackMonths,
    horizonNetBenefit: round(r.horizonNetBenefit.value),
    horizonROI: round(r.horizonROI.value, 4),
    openFindings: issues.map((i) => ({ severity: i.severity, message: i.message })),
  };

  return truncate(JSON.stringify(summary, null, 1), MAX_CONTEXT_CHARS);
};

/** Project the live form/result payload down to what the model actually needs. */
export const projectContext = (contextData: unknown): string => {
  if (!contextData || typeof contextData !== 'object') return 'No project loaded.';
  const c = contextData as {
    project?: unknown;
    params?: Record<string, unknown>;
    advancedResults?: Record<string, unknown>;
  };

  // A project on the rebuilt engine takes precedence: it is the model the
  // reports are produced from, and the legacy payload beside it may be stale.
  if (isProjectInput(c.project)) return rebuiltContext(c.project);

  const p = c.params ?? {};
  const r = c.advancedResults as
    | { savings?: Record<string, number>; payback?: { kind?: string; months?: number; annualLoss?: number }; investment?: Record<string, number>; current?: Record<string, number>; proposed?: Record<string, number> }
    | undefined;

  const summary = {
    equipment: p.equipmentName,
    shoeModel: p.shoeModel,
    vendor: p.brand,
    machineQuantity: p.machineQuantity,
    operatorsPerStation: { current: p.currentManpower, proposed: p.proposedManpower },
    pairsPerHour: { current: p.currentPPH, proposed: p.proposedPPH },
    defectRate: { current: p.currentDefectRate, proposed: p.proposedDefectRate },
    investment: r?.investment,
    payback: r?.payback,
    annualSaving: r?.savings?.totalAnnualSaving,
    costPerPair: { current: r?.current?.costPerPair, proposed: r?.proposed?.costPerPair },
    operatorsFreed: r?.savings?.manpowerSaving,
  };

  return truncate(JSON.stringify(summary, null, 1), MAX_CONTEXT_CHARS);
};
