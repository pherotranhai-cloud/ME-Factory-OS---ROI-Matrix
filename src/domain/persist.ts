import { CostKey, ProjectInput, ProjectResult } from './model';
import { calculateProject } from './engine';
import { fromLegacyParams, isLegacyShaped, newProjectDefaults } from './adapt';
import { ROIParams } from '../types';

/**
 * Storage for the rebuilt analysis path.
 *
 * The `roi_reports` table already carries a `form_data` jsonb column holding the
 * old `ROIParams`. Rather than migrate the table — which would touch the owner's
 * data for no analytical gain — a new project is stored in the same column and
 * the two shapes are told apart on the way out. `_schema` makes that explicit
 * instead of leaving it to a property-presence guess, but the guess is kept as a
 * fallback so a project written before this marker existed still loads.
 *
 * The summary columns the dashboard reads (`annual_savings`, `roi_months`, and
 * the rest) are derived from an engine run at save time. They are a projection
 * of the stored input, never an alternative source of truth: `loadProject`
 * ignores them entirely and recomputes. If a stored summary ever disagrees with
 * a fresh calculation, the calculation is right.
 */

export const PROJECT_SCHEMA = 'roi-matrix/project@1' as const;

export interface StoredProject extends ProjectInput {
  _schema: typeof PROJECT_SCHEMA;
}

type StoredShape = Partial<StoredProject> & Partial<ROIParams>;

export const isProjectShaped = (raw: unknown): boolean => {
  if (raw == null || typeof raw !== 'object') return false;
  const o = raw as StoredShape;
  if (o._schema === PROJECT_SCHEMA) return true;
  // Written before the marker: the new shape is the one carrying both sides.
  return 'baseline' in o && 'proposed' in o && 'demandPairsPerYear' in o;
};

/** The payload for `form_data`. */
export const toStored = (input: ProjectInput): StoredProject => ({
  ...input,
  _schema: PROJECT_SCHEMA,
});

/**
 * Read a stored `form_data` back as a project, whichever shape it holds.
 *
 * A legacy row is adapted rather than rejected, so every stored report opens in
 * the new workspace. It will restate — see `fromLegacyParams` for why that is
 * intended — and `wasImported` lets the UI say so instead of presenting the new
 * figures as though they were the ones that were approved.
 */
export const loadProject = (
  raw: unknown,
): { input: ProjectInput; wasImported: boolean } => {
  if (isProjectShaped(raw)) {
    const { _schema: _ignored, ...input } = raw as StoredProject;
    return { input: input as ProjectInput, wasImported: false };
  }
  if (raw && typeof raw === 'object' && isLegacyShaped(raw as Partial<ROIParams>)) {
    return { input: fromLegacyParams(raw as ROIParams), wasImported: true };
  }
  // Neither shape — an empty or corrupt row. A blank project beats a crash.
  return { input: newProjectDefaults(), wasImported: false };
};

/**
 * The flat columns the dashboard and history list read, derived from the same
 * engine run that produced the on-screen report.
 */
export interface ProjectSummary {
  machine_name: string;
  shoe_model: string;
  investment_cost: number;
  annual_savings: number;
  annual_output: number;
  labor_saving_cost: number;
  energy_saving_cost: number;
  other_savings: number;
  fob_impact: number;
  roi_months: number | null;
  roi_percentage: number;
  form_data: StoredProject;
}

// Keyed rather than matched on label: labels are display text and change.
const lineSaving = (result: ProjectResult, key: CostKey): number =>
  result.savings.lines.find((l) => l.key === key)?.annualDelta ?? 0;

export const summarise = (input: ProjectInput, result?: ProjectResult): ProjectSummary => {
  const r = result ?? calculateProject(input);
  const investment = r.investment.incremental.value;
  const annual = r.savings.totalAnnual.value;
  const labour = lineSaving(r, 'labour');
  const energy = lineSaving(r, 'energy');

  return {
    machine_name: input.proposed.machine.name || input.projectName || 'Untitled project',
    shoe_model: input.article,
    investment_cost: investment,
    annual_savings: annual,
    annual_output: r.basisOutput.value,
    labor_saving_cost: labour,
    energy_saving_cost: energy,
    // Everything that is neither labour nor energy: material, consumables,
    // maintenance, downtime and depreciation when the basis includes it.
    other_savings: annual - labour - energy,
    // Cost per pair taken out of the product, which is what FOB impact means
    // here. Positive is a reduction.
    fob_impact: r.savings.perPair.value,
    roi_months: r.paybackMonths,
    // Against the capital actually at risk. Zero rather than a non-finite value
    // when nothing is being spent, so the column stays numeric.
    roi_percentage: investment > 0 ? (annual / investment) * 100 : 0,
    form_data: toStored(input),
  };
};
