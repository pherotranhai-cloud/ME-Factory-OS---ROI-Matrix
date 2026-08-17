import { describe, it, expect } from 'vitest';
import { fromLegacyParams, newProjectDefaults, isLegacyShaped } from './adapt';
import { calculateProject } from './engine';
import { validateProject } from './validate';
import { calculateAdvancedROI } from '../utils/roi-calculations';
import { type ROIParams, type MaterialItem } from '../types';

const material = (over: Partial<MaterialItem> = {}): MaterialItem => ({
  id: 'm1', type: 'Upper', description: 'Mesh', supplier: 'S', uom: 'pr',
  usage: 1, loss: 0, fob: 1, ...over,
});

const legacy = (over: Partial<ROIParams> = {}): ROIParams => ({
  shoeModel: 'LEG-1', date: '2026-01-01', equipmentName: 'Legacy Cell',
  machineType: 'Automation', brand: 'ACME', scopeOfWork: 'Replace station',
  machineQuantity: 5,
  currentPowerSupplyV: '380', proposedPowerSupplyV: '380',
  currentPowerConsumptionKW: 0, proposedPowerConsumptionKW: 0,
  currentSpeedSPrs: 0, proposedSpeedSPrs: 0,
  currentUnitPrice: 4579, proposedUnitPrice: 57_750,
  currentMaintenanceCostPerYear: 72.33, proposedMaintenanceCostPerYear: 63,
  currentConsumablesCostPerYear: 329.17, proposedConsumablesCostPerYear: 1361,
  currentDepreciationYears: 5, proposedDepreciationYears: 5,
  currentCT: 132.67, proposedCT: 37,
  currentPPH: 27.13, proposedPPH: 97.3,
  currentManpower: 7.74, proposedManpower: 6.77,
  currentRFT: 100, proposedRFT: 100,
  currentDefectRate: 0, proposedDefectRate: 0,
  currentMaterials: [material({ fob: 2.231558 })],
  proposedMaterials: [material({ fob: 2.1799 })],
  workingHoursPerDay: 8, localLaborCost: 300,
  daysPerYear: 309, powerRateUSD: 0.075,
  currentShiftsPerDay: 2, currentHoursPerShift: 7.5,
  proposedShiftsPerDay: 3, proposedHoursPerShift: 7.5,
  ...over,
});

/**
 * The adapter guarantees INPUT fidelity, not output equality.
 *
 * The old engine costed each side at its own capacity and compared the results,
 * spreading each side's fixed costs over a different denominator. The new engine
 * costs both sides at the same volume. Those cannot both hold, so imported
 * projects legitimately produce different figures — reproducing the old ones
 * would mean preserving the defect that made a real project read 4.1 months
 * instead of 15.8.
 */
describe('stored inputs map across unchanged', () => {
  const p = legacy();
  const input = fromLegacyParams(p);

  it('carries prices, running costs and depreciation verbatim', () => {
    expect(input.baseline.machine.unitPrice).toBe(4579);
    expect(input.proposed.machine.unitPrice).toBe(57_750);
    expect(input.baseline.machine.consumablesPerYear).toBe(329.17);
    expect(input.proposed.machine.maintenancePerYear).toBe(63);
    expect(input.proposed.machine.depreciationYears).toBe(5);
  });

  it('carries the BOM through at the same cost per pair', () => {
    expect(input.baseline.material.consumptionPerPair * input.baseline.material.pricePerUnit)
      .toBeCloseTo(2.231558, 8);
    expect(input.proposed.material.consumptionPerPair * input.proposed.material.pricePerUnit)
      .toBeCloseTo(2.1799, 8);
  });

  it('carries the calendar, wage and tariff', () => {
    expect(input.calendar.daysPerYear).toBe(309);
    expect(input.labour.monthlyWage).toBe(300);
    expect(input.energyTariffUSDPerKWh).toBe(0.075);
  });

  it('keeps the per-side shift patterns', () => {
    expect(input.baseline.shift).toEqual({ shiftsPerDay: 2, hoursPerShift: 7.5 });
    expect(input.proposed.shift).toEqual({ shiftsPerDay: 3, hoursPerShift: 7.5 });
  });

  it('keeps the shared machine count on both sides', () => {
    expect(input.baseline.fleet).toEqual({ mode: 'fixed', units: 5 });
    expect(input.proposed.fleet).toEqual({ mode: 'fixed', units: 5 });
  });

  it('reproduces the old savings basis as the demand volume', () => {
    const old = calculateAdvancedROI(p);
    expect(input.demandPairsPerYear).toBeCloseTo(old.proposed.actualGoodCapacity, 2);
  });

  it('produces a usable result rather than throwing', () => {
    const r = calculateProject(input);
    expect(Number.isFinite(r.savings.totalAnnual.value)).toBe(true);
    expect(r.baseline.lines.some((l) => l.key === 'depreciation')).toBe(true);
  });
});

describe('the divergence from the old figures is explained, not hidden', () => {
  const p = legacy();
  const input = fromLegacyParams(p);
  const old = calculateAdvancedROI(p);
  const now = calculateProject(input);

  it('costs both sides at one volume, unlike the old engine', () => {
    // The old baseline was costed over its own 628,738 pairs; the proposed side
    // over 3,382,391. The new engine uses the same volume for both.
    expect(old.current.actualGoodCapacity).not.toBeCloseTo(old.proposed.actualGoodCapacity, 0);
    expect(now.basisOutput.value).toBeCloseTo(old.proposed.actualGoodCapacity, 2);
    expect(now.baseline.fleet.grossPairsRequired.value)
      .toBeCloseTo(now.proposed.fleet.grossPairsRequired.value, 2);
  });

  it('flags that the baseline could never have made that volume', () => {
    const issue = validateProject(input).find((i) => i.code === 'FLEET_UNDERSIZED_BASELINE');
    expect(issue).toBeDefined();
    expect(issue!.message).toMatch(/% of capacity/);
    expect(issue!.remedy).toMatch(/flatters it/);
  });

  it('warns rather than blocks, so the project still opens', () => {
    expect(validateProject(input).filter((i) => i.severity === 'error')).toEqual([]);
  });
});

describe('scrap survives the import', () => {
  it('carries defect rates across as a yield', () => {
    const input = fromLegacyParams(legacy({ currentDefectRate: 5, proposedDefectRate: 2 }));
    expect(input.baseline.yieldRate).toBeCloseTo(0.95, 10);
    expect(input.proposed.yieldRate).toBeCloseTo(0.98, 10);
  });

  it('raises cost per good pair when scrap is present', () => {
    const clean = calculateProject(fromLegacyParams(legacy()));
    const scrappy = calculateProject(fromLegacyParams(legacy({ currentDefectRate: 5 })));
    expect(scrappy.baseline.costPerPair.value).toBeGreaterThan(clean.baseline.costPerPair.value);
  });
});

describe('the import is faithful, not improved', () => {
  const input = fromLegacyParams(legacy());

  it('uses the old model semantics rather than the better defaults', () => {
    expect(input.labour.basis).toBe('headcount');
    expect(input.costBasis).toBe('fullCost');
    expect(input.calendar.lineEfficiency).toBe(1);
    expect(input.calendar.downtimeAllowance).toBe(0);
    expect(input.baseline.fleet).toEqual({ mode: 'fixed', units: 5 });
    expect(input.proposed.fleet).toEqual({ mode: 'fixed', units: 5 });
  });

  it('cannot split labour from machine time, so imports them equal', () => {
    expect(input.baseline.machine.labourCycleSec).toBe(input.baseline.machine.machineCycleSec);
    expect(input.proposed.machine.labourCycleSec).toBe(input.proposed.machine.machineCycleSec);
  });

  it('derives cycle time from pairs per hour', () => {
    expect(input.baseline.machine.machineCycleSec).toBeCloseTo(3600 / 27.13, 8);
    expect(input.proposed.machine.machineCycleSec).toBeCloseTo(3600 / 97.3, 8);
  });

  it('falls back to the recorded cycle time when speed is blank', () => {
    const input2 = fromLegacyParams(legacy({ currentPPH: 0, currentCT: 120 }));
    expect(input2.baseline.machine.machineCycleSec).toBe(120);
  });
});

/**
 * The import is faithful, which means it inherits the old model's weaknesses.
 * Validation should say so rather than let them pass unnoticed.
 */
describe('imported projects surface what the old model could not express', () => {
  const issues = validateProject(fromLegacyParams(legacy()));
  const codes = issues.map((i) => i.code);

  it('warns that capacity is nameplate', () => {
    expect(codes).toContain('EFFICIENCY_NAMEPLATE');
  });

  it('warns that no downtime is allowed for', () => {
    expect(codes).toContain('DOWNTIME_ZERO');
  });

  it('flags the manning scope mismatch that the old model hid', () => {
    // 7.74 operators describes a whole line, not one 27 pairs/hr press.
    expect(codes).toContain('MANNING_SCOPE_MISMATCH');
  });

});

describe('new projects start from the better settings', () => {
  const d = newProjectDefaults();

  it('defaults to cycle-time labour and the cash basis', () => {
    expect(d.labour.basis).toBe('cycleTime');
    expect(d.costBasis).toBe('cash');
  });

  it('defaults to a realistic calendar and efficiency', () => {
    expect(d.calendar.daysPerYear).toBe(312);
    expect(d.calendar.lineEfficiency).toBeLessThan(1);
    expect(d.calendar.downtimeAllowance).toBeGreaterThan(0);
  });

  it('derives fleets from demand rather than fixing them', () => {
    expect(d.baseline.fleet.mode).toBe('derived');
    expect(d.proposed.fleet.mode).toBe('derived');
  });

  it('blocks until the essentials are entered', () => {
    const issues = validateProject(d);
    expect(issues.some((i) => i.severity === 'error')).toBe(true);
    expect(issues.map((i) => i.code)).toContain('DEMAND_MISSING');
  });
});

describe('legacy detection', () => {
  it('recognises the old shape', () => {
    expect(isLegacyShaped(legacy())).toBe(true);
    expect(isLegacyShaped({ demandPairsPerYear: 1 } as never)).toBe(false);
  });
});
