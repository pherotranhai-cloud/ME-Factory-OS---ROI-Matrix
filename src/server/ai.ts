import OpenAI from 'openai';
import { z } from 'zod';

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

/** Project the live form/result payload down to what the model actually needs. */
export const projectContext = (contextData: unknown): string => {
  if (!contextData || typeof contextData !== 'object') return 'No project loaded.';
  const c = contextData as { params?: Record<string, unknown>; advancedResults?: Record<string, unknown> };

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
