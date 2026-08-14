import { ProjectInput, ProjectResult } from './model';
import { calculateProject } from './engine';

/**
 * Scenario analysis.
 *
 * Every row re-runs the same engine with one input moved, so a sensitivity can
 * never drift from the headline it is supposed to test. The three axes are the
 * ones an investment committee actually asks about: what if the headcount never
 * comes out, what if the measured material gain does not hold, and what if
 * demand moves.
 */

export interface ScenarioRow {
  label: string;
  /** What was changed, for the report to show. */
  detail: string;
  annualSaving: number;
  paybackMonths: number | null;
  horizonROI: number;
  /** Present where the scenario re-sizes equipment. */
  fleet?: { baseline: number; proposed: number };
  /** True for the row matching the project as entered. */
  isBase?: boolean;
}

export interface ScenarioTable {
  key: 'labourConversion' | 'materialYield' | 'demandGrowth';
  title: string;
  /** What the reader should take from it. */
  question: string;
  rows: ScenarioRow[];
}

const rowFrom = (
  label: string,
  detail: string,
  result: ProjectResult,
  opts: { isBase?: boolean; withFleet?: boolean } = {},
): ScenarioRow => ({
  label,
  detail,
  annualSaving: result.savings.totalAnnual.value,
  paybackMonths: result.paybackMonths,
  horizonROI: result.horizonROI.value,
  ...(opts.withFleet
    ? { fleet: { baseline: result.baseline.fleet.units.value, proposed: result.proposed.fleet.units.value } }
    : {}),
  ...(opts.isBase ? { isBase: true } : {}),
});

/** How much of the theoretical labour saving is actually banked as headcount. */
export const labourConversionTable = (input: ProjectInput): ScenarioTable => ({
  key: 'labourConversion',
  title: 'If the labour saving never materialises',
  question: 'Headcount rarely falls in fractions. Does the case still hold if none of it comes out?',
  rows: [1, 0.5, 0.25, 0.1, 0].map((factor) =>
    rowFrom(
      `${Math.round(factor * 100)}%`,
      factor === 0 ? 'no headcount released' : `${Math.round(factor * 100)}% of the theoretical saving banked`,
      calculateProject({ ...input, labour: { ...input.labour, conversionFactor: factor } }),
      { isBase: factor === input.labour.conversionFactor },
    ),
  ),
});

/**
 * Material is usually the dominant line, so the yield assumption carries the
 * case. Scenarios move the PROPOSED side's consumption toward or past the
 * baseline, holding everything else.
 */
export const materialYieldTable = (input: ProjectInput): ScenarioTable => {
  const baseConsumption = input.baseline.material.consumptionPerPair;
  const proposedConsumption = input.proposed.material.consumptionPerPair;
  const measuredGain = baseConsumption - proposedConsumption;

  const at = (gain: number) =>
    calculateProject({
      ...input,
      proposed: {
        ...input.proposed,
        material: { ...input.proposed.material, consumptionPerPair: baseConsumption - gain },
      },
    });

  const unit = input.proposed.material.unit;
  const fmtGain = (g: number) => `${g.toFixed(4)} ${unit}/pair saved`;

  return {
    key: 'materialYield',
    title: 'If the material gain does not hold',
    question: 'Material is usually the largest line. What happens if the measured yield improvement is optimistic?',
    rows: [
      rowFrom('No gain', `${fmtGain(0)} — proposed consumes the same as baseline`, at(0)),
      rowFrom('Half', fmtGain(measuredGain * 0.5), at(measuredGain * 0.5)),
      rowFrom('As measured', fmtGain(measuredGain), at(measuredGain), { isBase: true }),
      rowFrom('+50%', fmtGain(measuredGain * 1.5), at(measuredGain * 1.5)),
    ],
  };
};

/** Fleets are re-derived at each volume, so growth can change the machine count. */
export const demandGrowthTable = (input: ProjectInput): ScenarioTable => ({
  key: 'demandGrowth',
  title: 'If demand moves',
  question: 'Equipment is re-sized at each volume, so the fleet and the payback both move.',
  rows: [0, 0.1, 0.25, 0.5].map((growth) => {
    const demand = Math.round(input.demandPairsPerYear * (1 + growth));
    return rowFrom(
      growth === 0 ? 'Current' : `+${Math.round(growth * 100)}%`,
      `${demand.toLocaleString('en-US')} pairs/yr`,
      calculateProject({ ...input, demandPairsPerYear: demand }),
      { isBase: growth === 0, withFleet: true },
    );
  }),
});

export const allScenarios = (input: ProjectInput): ScenarioTable[] => [
  labourConversionTable(input),
  materialYieldTable(input),
  demandGrowthTable(input),
];

/**
 * The driver the result is most sensitive to, by the spread its scenarios
 * produce. This is the "what is carrying this case" answer.
 */
export const dominantScenario = (tables: ScenarioTable[]): ScenarioTable | null => {
  let best: ScenarioTable | null = null;
  let bestSpread = -1;
  for (const t of tables) {
    const savings = t.rows.map((r) => r.annualSaving);
    const spread = Math.max(...savings) - Math.min(...savings);
    if (spread > bestSpread) {
      bestSpread = spread;
      best = t;
    }
  }
  return bestSpread > 0 ? best : null;
};

/**
 * The material gain at which payback reaches a hurdle, found by bisection.
 * Answers "how much of the measured improvement do we actually need?".
 */
export const materialBreakEven = (
  input: ProjectInput,
  hurdleMonths: number,
): { gain: number; share: number } | null => {
  const baseConsumption = input.baseline.material.consumptionPerPair;
  const measuredGain = baseConsumption - input.proposed.material.consumptionPerPair;
  if (!(measuredGain > 0) || !(hurdleMonths > 0)) return null;

  const paybackAt = (gain: number): number | null =>
    calculateProject({
      ...input,
      proposed: {
        ...input.proposed,
        material: { ...input.proposed.material, consumptionPerPair: baseConsumption - gain },
      },
    }).paybackMonths;

  // Search between no gain and three times the measured one.
  let lo = 0;
  let hi = measuredGain * 3;
  const atHi = paybackAt(hi);
  if (atHi === null || atHi > hurdleMonths) return null;

  for (let i = 0; i < 60; i += 1) {
    const mid = (lo + hi) / 2;
    const months = paybackAt(mid);
    if (months === null || months > hurdleMonths) lo = mid;
    else hi = mid;
  }
  return { gain: hi, share: hi / measuredGain };
};
