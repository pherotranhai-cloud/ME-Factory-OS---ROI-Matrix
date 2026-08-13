import { ROIParams, ROIResults } from '../types';
import { calculateAdvancedROI } from './roi-calculations';

/**
 * One-variable sensitivity.
 *
 * Every figure on the report is a single point estimate, so a reviewer cannot
 * see which input is carrying the result (P1-10). Each driver below is flexed
 * on its own, holding everything else fixed, and the payback is recomputed with
 * the same engine the report uses.
 */

export type DriverKey = 'labor' | 'energy' | 'defect' | 'utilisation';

export interface SensitivityPoint {
  /** -0.2, 0, +0.2 */
  delta: number;
  label: string;
  totalAnnualSaving: number;
  /** null when the flexed case never pays back. */
  roiMonths: number | null;
}

export interface SensitivityRow {
  key: DriverKey;
  label: string;
  /** What the base case actually uses, for display. */
  baseValue: number;
  unit: string;
  points: SensitivityPoint[];
}

const STEPS = [-0.2, 0, 0.2];

/** Apply a proportional change to a single driver. */
const flex = (params: ROIParams, key: DriverKey, factor: number): ROIParams => {
  switch (key) {
    case 'labor':
      return { ...params, localLaborCost: params.localLaborCost * factor };
    case 'energy':
      return { ...params, powerRateUSD: (params.powerRateUSD ?? 0.075) * factor };
    case 'defect':
      // Both sides move together: a quality assumption that is optimistic for
      // the new line is usually optimistic for the old one too.
      return {
        ...params,
        currentDefectRate: params.currentDefectRate * factor,
        proposedDefectRate: params.proposedDefectRate * factor,
      };
    case 'utilisation':
      return { ...params, workingHoursPerDay: params.workingHoursPerDay * factor };
  }
};

const DRIVERS: Array<{ key: DriverKey; label: string; unit: string; base: (p: ROIParams) => number }> = [
  { key: 'labor', label: 'Labour rate', unit: 'USD/op/mo', base: (p) => p.localLaborCost },
  { key: 'energy', label: 'Energy tariff', unit: 'USD/kWh', base: (p) => p.powerRateUSD ?? 0.075 },
  { key: 'defect', label: 'Defect rate', unit: '%', base: (p) => p.proposedDefectRate },
  { key: 'utilisation', label: 'Utilisation', unit: 'h/day', base: (p) => p.workingHoursPerDay },
];

export const buildSensitivity = (params: ROIParams, base: ROIResults): SensitivityRow[] =>
  DRIVERS.map(({ key, label, unit, base: baseOf }) => ({
    key,
    label,
    unit,
    baseValue: baseOf(params),
    points: STEPS.map((delta) => {
      // Reuse the already-computed base case rather than recomputing it.
      const result = delta === 0 ? base : calculateAdvancedROI(flex(params, key, 1 + delta));
      return {
        delta,
        label: delta === 0 ? 'Base' : `${delta > 0 ? '+' : ''}${Math.round(delta * 100)}%`,
        totalAnnualSaving: result.savings.totalAnnualSaving,
        roiMonths: result.roiMonths,
      };
    }),
  }));

/**
 * The driver whose ±20% swing moves the annual saving the most. This is the
 * "what is carrying this result" answer the report is missing.
 */
export const dominantDriver = (rows: SensitivityRow[]): SensitivityRow | null => {
  let best: SensitivityRow | null = null;
  let bestSpread = -1;

  for (const row of rows) {
    const savings = row.points.map((p) => p.totalAnnualSaving);
    const spread = Math.max(...savings) - Math.min(...savings);
    if (spread > bestSpread) {
      bestSpread = spread;
      best = row;
    }
  }

  return bestSpread > 0 ? best : null;
};
