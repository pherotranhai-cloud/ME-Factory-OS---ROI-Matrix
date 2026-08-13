import { describe, it, expect } from 'vitest';
import { buildSensitivity, dominantDriver } from './sensitivity';
import { calculateAdvancedROI } from './roi-calculations';
import { ROIParams } from '../types';

const params = (over: Partial<ROIParams> = {}): ROIParams => ({
  shoeModel: 'S', date: '2026-01-01', equipmentName: 'E', machineType: 'M', brand: 'B', scopeOfWork: 'W',
  machineQuantity: 2,
  currentPowerSupplyV: '380', proposedPowerSupplyV: '380',
  currentPowerConsumptionKW: 2, proposedPowerConsumptionKW: 3,
  currentSpeedSPrs: 0, proposedSpeedSPrs: 0,
  currentUnitPrice: 10_000, proposedUnitPrice: 60_000,
  currentMaintenanceCostPerYear: 500, proposedMaintenanceCostPerYear: 1_000,
  currentConsumablesCostPerYear: 200, proposedConsumablesCostPerYear: 300,
  currentDepreciationYears: 5, proposedDepreciationYears: 5,
  currentCT: 60, proposedCT: 30, currentPPH: 60, proposedPPH: 120,
  currentManpower: 2, proposedManpower: 1,
  currentRFT: 95, proposedRFT: 98, currentDefectRate: 5, proposedDefectRate: 2,
  currentMaterials: [], proposedMaterials: [],
  workingHoursPerDay: 8, localLaborCost: 300,
  ...over,
});

describe('sensitivity (P1-10)', () => {
  it('covers all four drivers at three points each', () => {
    const p = params();
    const rows = buildSensitivity(p, calculateAdvancedROI(p));
    expect(rows.map((r) => r.key)).toEqual(['labor', 'energy', 'defect', 'utilisation']);
    for (const row of rows) {
      expect(row.points.map((pt) => pt.delta)).toEqual([-0.2, 0, 0.2]);
    }
  });

  it('reuses the base case unchanged at delta 0', () => {
    const p = params();
    const base = calculateAdvancedROI(p);
    const rows = buildSensitivity(p, base);
    for (const row of rows) {
      const at0 = row.points.find((pt) => pt.delta === 0)!;
      expect(at0.totalAnnualSaving).toBeCloseTo(base.savings.totalAnnualSaving, 10);
      expect(at0.roiMonths).toEqual(base.roiMonths);
    }
  });

  it('flexes one driver at a time', () => {
    const p = params();
    const rows = buildSensitivity(p, calculateAdvancedROI(p));
    const labour = rows.find((r) => r.key === 'labor')!;
    const savings = labour.points.map((pt) => pt.totalAnnualSaving);
    // A higher labour rate makes an automation project save MORE.
    expect(savings[2]).toBeGreaterThan(savings[0]);
  });

  it('reports the base value actually in use for each driver', () => {
    const p = params({ localLaborCost: 450, powerRateUSD: 0.11, workingHoursPerDay: 10 });
    const rows = buildSensitivity(p, calculateAdvancedROI(p));
    expect(rows.find((r) => r.key === 'labor')!.baseValue).toBe(450);
    expect(rows.find((r) => r.key === 'energy')!.baseValue).toBe(0.11);
    expect(rows.find((r) => r.key === 'utilisation')!.baseValue).toBe(10);
  });

  it('defaults the energy base value when the project predates the field', () => {
    const p = params();
    delete (p as Partial<ROIParams>).powerRateUSD;
    const rows = buildSensitivity(p, calculateAdvancedROI(p));
    expect(rows.find((r) => r.key === 'energy')!.baseValue).toBe(0.075);
  });

  it('identifies labour as dominant for a headcount-reduction project', () => {
    const p = params();
    const dominant = dominantDriver(buildSensitivity(p, calculateAdvancedROI(p)));
    expect(dominant?.key).toBe('labor');
  });

  it('returns null when no driver moves the result', () => {
    // Identical sides: nothing to be sensitive to.
    const p = params({
      proposedPPH: 60, proposedManpower: 2, proposedPowerConsumptionKW: 2,
      proposedMaintenanceCostPerYear: 500, proposedConsumablesCostPerYear: 200,
      proposedDefectRate: 5, proposedUnitPrice: 10_000,
    });
    expect(dominantDriver(buildSensitivity(p, calculateAdvancedROI(p)))).toBeNull();
  });

  it('never yields a non-finite payback', () => {
    const p = params();
    for (const row of buildSensitivity(p, calculateAdvancedROI(p))) {
      for (const pt of row.points) {
        expect(pt.roiMonths === null || Number.isFinite(pt.roiMonths)).toBe(true);
        expect(Number.isFinite(pt.totalAnnualSaving)).toBe(true);
      }
    }
  });
});
