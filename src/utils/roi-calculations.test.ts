import { describe, it, expect } from 'vitest';
import { calculateAdvancedROI, resolveAssumptions, bomCostPerPair } from './roi-calculations';
import { type ROIParams, type MaterialItem } from '../types';

const material = (over: Partial<MaterialItem> = {}): MaterialItem => ({
  id: 'm1',
  type: 'Upper',
  description: 'Mesh',
  supplier: 'S',
  uom: 'pr',
  usage: 1,
  loss: 0,
  fob: 1,
  ...over,
});

/**
 * Reference project. Deliberately asymmetric (proposed is faster, needs fewer
 * operators, draws more power and costs more to maintain) so that a sign error in
 * any single term shows up.
 */
const baseParams = (over: Partial<ROIParams> = {}): ROIParams => ({
  shoeModel: 'REF-1',
  date: '2026-01-01',
  equipmentName: 'Reference Cell',
  machineType: 'Automation',
  brand: 'ACME',
  scopeOfWork: 'Replace manual station',
  machineQuantity: 1,

  currentPowerSupplyV: '380',
  proposedPowerSupplyV: '380',
  currentPowerConsumptionKW: 2,
  proposedPowerConsumptionKW: 3,
  currentSpeedSPrs: 0,
  proposedSpeedSPrs: 0,
  currentUnitPrice: 10_000,
  proposedUnitPrice: 60_000,
  currentMaintenanceCostPerYear: 500,
  proposedMaintenanceCostPerYear: 1_000,
  currentConsumablesCostPerYear: 200,
  proposedConsumablesCostPerYear: 300,
  currentDepreciationYears: 5,
  proposedDepreciationYears: 5,

  currentCT: 60,
  proposedCT: 30,
  currentPPH: 60,
  proposedPPH: 120,
  currentManpower: 2,
  proposedManpower: 1,

  currentRFT: 95,
  proposedRFT: 98,
  currentDefectRate: 5,
  proposedDefectRate: 2,

  currentMaterials: [material({ fob: 2 })],
  proposedMaterials: [material({ fob: 1.8 })],

  workingHoursPerDay: 8,
  localLaborCost: 300,
  ...over,
});

describe('assumptions (P1-06)', () => {
  it('falls back to documented defaults for reports saved before they existed', () => {
    const a = resolveAssumptions({ workingHoursPerDay: 8 });
    expect(a.daysPerYear).toBe(312);
    expect(a.powerRateUSD).toBe(0.075);
    expect(a.hoursPerYear).toBe(8 * 312);
  });

  it('honours per-project overrides', () => {
    const a = resolveAssumptions({ workingHoursPerDay: 10, daysPerYear: 250, powerRateUSD: 0.12 });
    expect(a.hoursPerYear).toBe(2_500);
    expect(a.powerRateUSD).toBe(0.12);
  });

  it('echoes the assumptions actually used back on the result', () => {
    const r = calculateAdvancedROI(baseParams({ daysPerYear: 300, powerRateUSD: 0.1 }));
    expect(r.assumptions).toMatchObject({ daysPerYear: 300, powerRateUSD: 0.1, hoursPerYear: 2_400 });
  });
});

/**
 * P1-01 — the headline defect. Before the fix, manual capacity was driven by
 * `currentManpower` while manual labour was driven by `machineQuantity`, so cost
 * per pair scaled linearly with quantity and the same project flipped from a
 * $6,926/yr loss at qty 1 to a $74,725/yr saving at qty 4.
 */
describe('quantity invariance (P1-01)', () => {
  it('holds cost per pair constant across machine quantity', () => {
    const at = (machineQuantity: number) => calculateAdvancedROI(baseParams({ machineQuantity }));
    const [q1, q2, q4] = [at(1), at(2), at(4)];

    for (const r of [q2, q4]) {
      expect(r.current.costPerPair).toBeCloseTo(q1.current.costPerPair, 10);
      expect(r.proposed.costPerPair).toBeCloseTo(q1.proposed.costPerPair, 10);
      expect(r.savings.fobImpact).toBeCloseTo(q1.savings.fobImpact, 10);
    }
  });

  it('keeps the payback verdict stable across machine quantity', () => {
    const kinds = [1, 2, 4, 10].map((q) => calculateAdvancedROI(baseParams({ machineQuantity: q })).payback.kind);
    expect(new Set(kinds).size).toBe(1);
  });

  it('scales capacity and total cost linearly with quantity', () => {
    const q1 = calculateAdvancedROI(baseParams({ machineQuantity: 1 }));
    const q3 = calculateAdvancedROI(baseParams({ machineQuantity: 3 }));
    expect(q3.current.annualCapacity).toBeCloseTo(q1.current.annualCapacity * 3, 6);
    expect(q3.current.totalAnnualCost).toBeCloseTo(q1.current.totalAnnualCost * 3, 6);
    expect(q3.savings.totalAnnualSaving).toBeCloseTo(q1.savings.totalAnnualSaving * 3, 6);
  });

  it('scales both sides of the baseline, not just the proposed one', () => {
    const q1 = calculateAdvancedROI(baseParams({ machineQuantity: 1 }));
    const q2 = calculateAdvancedROI(baseParams({ machineQuantity: 2 }));
    // The original bug left this ratio at 1 while the proposed side doubled.
    expect(q2.current.annualCapacity / q1.current.annualCapacity).toBeCloseTo(2, 10);
  });
});

describe('cost bridge reconciles (P1-10 support)', () => {
  it('sums component annual deltas exactly to the headline saving', () => {
    const r = calculateAdvancedROI(baseParams());
    const summed = r.savings.bridge.reduce((s, c) => s + c.annualDelta, 0);
    expect(summed).toBeCloseTo(r.savings.totalAnnualSaving, 6);
  });

  it('sums component per-pair deltas exactly to the FOB impact', () => {
    const r = calculateAdvancedROI(baseParams());
    const summed = r.savings.bridge.reduce((s, c) => s + c.perPairDelta, 0);
    expect(summed).toBeCloseTo(r.savings.fobImpact, 10);
    expect(r.savings.fobImpact).toBeCloseTo(r.current.costPerPair - r.proposed.costPerPair, 10);
  });

  it('exposes one component per cost line', () => {
    const r = calculateAdvancedROI(baseParams());
    expect(r.savings.bridge.map((c) => c.key)).toEqual([
      'labor', 'material', 'energy', 'maintenance', 'consumables', 'depreciation',
    ]);
  });

  it('keeps named savings aligned with the bridge', () => {
    const r = calculateAdvancedROI(baseParams());
    const find = (k: string) => r.savings.bridge.find((c) => c.key === k)!.annualDelta;
    expect(r.savings.laborSaving).toBeCloseTo(find('labor'), 10);
    expect(r.savings.energySaving).toBeCloseTo(find('energy'), 10);
    expect(r.savings.depreciationSaving).toBeCloseTo(find('depreciation'), 10);
  });
});

describe('scrap handling (P1-05)', () => {
  it('grosses material up by dividing by yield, not multiplying by defect rate', () => {
    const r = calculateAdvancedROI(
      baseParams({
        currentDefectRate: 10,
        currentMaterials: [material({ fob: 1, usage: 1, loss: 0 })],
      }),
    );
    // BOM is $1.00/pair produced; at 10% scrap each GOOD pair costs 1 / 0.9.
    expect(r.current.materialCostPerPair).toBeCloseTo(1 / 0.9, 10);
    // The old convention gave 1 * 1.10 — assert we are not back on it.
    expect(r.current.materialCostPerPair).not.toBeCloseTo(1.1, 4);
  });

  it('computes BOM cost per pair including loss allowance', () => {
    expect(bomCostPerPair([material({ usage: 2, fob: 3, loss: 10 })])).toBeCloseTo(2 * 3 * 1.1, 10);
    expect(bomCostPerPair([])).toBe(0);
    expect(bomCostPerPair(undefined)).toBe(0);
  });
});

/**
 * P1-04 — `Infinity` does not survive JSON.stringify; it becomes `null`, which
 * silently recorded loss-making proposals as "no data" rather than "negative".
 */
describe('payback is explicit, never Infinity (P1-04)', () => {
  const lossMaking = baseParams({
    proposedPPH: 60,
    proposedManpower: 2,
    proposedMaintenanceCostPerYear: 99_999,
  });

  it('reports a loss as a loss rather than as no payback', () => {
    const r = calculateAdvancedROI(lossMaking);
    expect(r.payback.kind).toBe('none');
    if (r.payback.kind === 'none') expect(r.payback.annualLoss).toBeGreaterThan(0);
    expect(r.roiMonths).toBeNull();
  });

  it('never emits a non-finite number anywhere in the result', () => {
    for (const p of [lossMaking, baseParams(), baseParams({ currentPPH: 0, proposedPPH: 0 })]) {
      const walk = (v: unknown, path: string): void => {
        if (typeof v === 'number') {
          expect(Number.isFinite(v), `${path} = ${v}`).toBe(true);
        } else if (v && typeof v === 'object') {
          for (const [k, child] of Object.entries(v)) walk(child, `${path}.${k}`);
        }
      };
      walk(calculateAdvancedROI(p), 'result');
    }
  });

  it('survives a JSON round trip without losing the verdict', () => {
    const r = calculateAdvancedROI(lossMaking);
    const round = JSON.parse(JSON.stringify(r));
    expect(round.payback.kind).toBe('none');
    expect(round.roiMonths).toBeNull();
    expect(round.savings.totalAnnualSaving).toBeCloseTo(r.savings.totalAnnualSaving, 6);
  });

  it('reports immediate payback when the proposal saves money and costs no more', () => {
    const r = calculateAdvancedROI(baseParams({ currentUnitPrice: 60_000, proposedUnitPrice: 60_000 }));
    expect(r.savings.totalAnnualSaving).toBeGreaterThan(0);
    expect(r.payback.kind).toBe('immediate');
    expect(r.roiMonths).toBe(0);
  });

  it('computes months from net investment and annual saving', () => {
    const r = calculateAdvancedROI(baseParams());
    expect(r.payback.kind).toBe('months');
    if (r.payback.kind === 'months') {
      expect(r.payback.months).toBeCloseTo(r.investment.net / (r.savings.totalAnnualSaving / 12), 6);
      expect(r.roiMonths).toBeCloseTo(r.payback.months, 10);
    }
  });
});

describe('investment basis (P1-03)', () => {
  it('reports gross and net, and pays back on net', () => {
    const r = calculateAdvancedROI(baseParams({ machineQuantity: 2 }));
    expect(r.investment.gross).toBe(60_000 * 2);
    expect(r.investment.net).toBe((60_000 - 10_000) * 2);
    expect(r.investment.basis).toBe('net');
    expect(r.investment.applied).toBe(r.investment.net);
  });
});

describe('degenerate inputs are survivable', () => {
  it('handles a zero-throughput current line', () => {
    const r = calculateAdvancedROI(baseParams({ currentPPH: 0 }));
    expect(r.current.annualCapacity).toBe(0);
    expect(r.current.costPerPair).toBe(0);
    expect(Number.isFinite(r.savings.totalAnnualSaving)).toBe(true);
  });

  it('handles zero depreciation years without dividing by zero', () => {
    const r = calculateAdvancedROI(baseParams({ currentDepreciationYears: 0, proposedDepreciationYears: 0 }));
    expect(r.current.annualDepreciation).toBe(0);
    expect(r.proposed.annualDepreciation).toBe(0);
  });

  it('handles a 100% defect rate without producing Infinity', () => {
    const r = calculateAdvancedROI(baseParams({ proposedDefectRate: 100 }));
    expect(r.proposed.actualGoodCapacity).toBe(0);
    expect(r.proposed.costPerPair).toBe(0);
    expect(r.basisOutput).toBe(0);
  });

  it('handles empty material tables', () => {
    const r = calculateAdvancedROI(baseParams({ currentMaterials: [], proposedMaterials: [] }));
    expect(r.current.materialCostPerPair).toBe(0);
    expect(r.savings.materialSaving).toBe(0);
  });

  it('clamps out-of-range defect rates rather than inverting the yield', () => {
    const r = calculateAdvancedROI(baseParams({ currentDefectRate: 150 }));
    expect(r.current.actualGoodCapacity).toBe(0);
    expect(Number.isFinite(r.current.costPerPair)).toBe(true);
  });

  it('tolerates a missing machine quantity', () => {
    const r = calculateAdvancedROI(baseParams({ machineQuantity: 0 }));
    expect(r.investment.gross).toBe(0);
    expect(Number.isFinite(r.savings.totalAnnualSaving)).toBe(true);
  });
});

/**
 * Worked example, derived by hand from the reference project above.
 *
 * NEEDS IE SIGN-OFF. These expected values are derived from the model documented
 * in docs/UPGRADE_ACTION_PLAN.md, not from a manually verified factory
 * spreadsheet. Replace with a real signed-off project when one is supplied; the
 * point of this test is to make any future change to the model deliberate and
 * visible in the diff.
 */
describe('worked example (pending IE sign-off)', () => {
  const HOURS = 8 * 312; // 2,496

  it('matches hand-derived figures for the current line', () => {
    const r = calculateAdvancedROI(baseParams());

    expect(r.current.annualCapacity).toBeCloseTo(60 * 1 * HOURS, 6);          // 149,760
    expect(r.current.actualGoodCapacity).toBeCloseTo(60 * HOURS * 0.95, 6);   // 142,272
    expect(r.current.annualLaborCost).toBeCloseTo(2 * 1 * 300 * 12, 6);       // 7,200
    expect(r.current.annualEnergyCost).toBeCloseTo(2 * 1 * HOURS * 0.075, 6); // 374.40
    expect(r.current.annualDepreciation).toBeCloseTo(10_000 / 5, 6);          // 2,000
    expect(r.current.annualMaterialCost).toBeCloseTo(60 * HOURS * 2, 6);      // 299,520
  });

  it('matches hand-derived figures for the proposed line', () => {
    const r = calculateAdvancedROI(baseParams());

    expect(r.proposed.annualCapacity).toBeCloseTo(120 * HOURS, 6);            // 299,520
    expect(r.proposed.actualGoodCapacity).toBeCloseTo(120 * HOURS * 0.98, 6); // 293,529.6
    expect(r.proposed.annualLaborCost).toBeCloseTo(1 * 300 * 12, 6);          // 3,600
    expect(r.proposed.annualDepreciation).toBeCloseTo(60_000 / 5, 6);         // 12,000
  });

  it('matches the hand-derived material cost per good pair', () => {
    const r = calculateAdvancedROI(baseParams());
    expect(r.current.materialCostPerPair).toBeCloseTo(2 / 0.95, 10);
    expect(r.proposed.materialCostPerPair).toBeCloseTo(1.8 / 0.98, 10);
  });

  it('frees operators against the equal-output basis', () => {
    const r = calculateAdvancedROI(baseParams());
    // basisOutput good pairs at 60 pph and 95% yield needs this many stations,
    // each staffed by 2 operators; the proposed line staffs 1.
    const stations = r.basisOutput / 0.95 / (60 * HOURS);
    expect(r.savings.manpowerSaving).toBeCloseTo(stations * 2 - 1, 10);
    expect(r.savings.manpowerSaving).toBeGreaterThan(0);
  });
});

/**
 * Per-side shift patterns.
 *
 * A single shared `workingHoursPerDay` cannot express two sides running
 * different shift counts. Getting it wrong does not scale both sides equally —
 * it distorts the RATIO between them, which is what cost/pair and the savings
 * bridge measure.
 *
 * Reference case: the EMMA automatic cutter project exported on 2026-08-14.
 * 5 stations, 309 days/yr, $300/op/month. Traditional cutting runs 2 shifts of
 * 7.5 h with 7.74 operators at CT 132.67 s (27.13 pph); EMMA runs 3 shifts of
 * 7.5 h with 6.77 operators at CT 37 s (97.3 pph). The workbook used 8 h/day for
 * both, overstating labour per pair by 15/8 and 22.5/8 respectively.
 */
describe('per-side shift patterns', () => {
  const emma = (over: Partial<ROIParams> = {}): ROIParams => baseParams({
    machineQuantity: 5,
    daysPerYear: 309,
    localLaborCost: 300,
    currentPPH: 27.13,
    proposedPPH: 97.3,
    currentManpower: 7.74,
    proposedManpower: 6.77,
    currentDefectRate: 2,
    proposedDefectRate: 0,
    currentUnitPrice: 4_579,
    proposedUnitPrice: 57_750,
    currentMaintenanceCostPerYear: 72.33,
    proposedMaintenanceCostPerYear: 63,
    currentConsumablesCostPerYear: 329.17,
    proposedConsumablesCostPerYear: 1_361,
    currentDepreciationYears: 1,
    proposedDepreciationYears: 5,
    currentPowerConsumptionKW: 0,
    proposedPowerConsumptionKW: 0,
    currentMaterials: [],
    proposedMaterials: [],
    currentShiftsPerDay: 2,
    currentHoursPerShift: 7.5,
    proposedShiftsPerDay: 3,
    proposedHoursPerShift: 7.5,
    ...over,
  });

  it('derives a different operating year for each side', () => {
    const a = calculateAdvancedROI(emma()).assumptions;
    expect(a.current.hoursPerDay).toBe(15);
    expect(a.proposed.hoursPerDay).toBe(22.5);
    expect(a.current.hoursPerYear).toBeCloseTo(4_635, 6);
    expect(a.proposed.hoursPerYear).toBeCloseTo(6_952.5, 6);
    expect(a.current.fromLegacy).toBe(false);
  });

  it('scales each side capacity by its own schedule', () => {
    const r = calculateAdvancedROI(emma());
    expect(r.current.annualCapacity).toBeCloseTo(27.13 * 5 * 4_635, 4);   // 628,737.75
    expect(r.current.actualGoodCapacity).toBeCloseTo(628_737.75 * 0.98, 4); // 616,163.0
    expect(r.proposed.annualCapacity).toBeCloseTo(97.3 * 5 * 6_952.5, 4);  // 3,382,391.25
    expect(r.proposed.actualGoodCapacity).toBeCloseTo(3_382_391.25, 4);
  });

  it('leaves annual labour cost untouched — it is headcount, not hours', () => {
    const r = calculateAdvancedROI(emma());
    expect(r.current.annualLaborCost).toBeCloseTo(139_320, 6);
    expect(r.proposed.annualLaborCost).toBeCloseTo(121_860, 6);
  });

  it('corrects labour per pair to the hand-checked figures', () => {
    const r = calculateAdvancedROI(emma());
    const labour = r.savings.bridge.find((c) => c.key === 'labor')!;

    // Stated as the derivation rather than a rounded constant, so the test
    // documents where the number comes from and cannot drift on rounding.
    const currentGood = 27.13 * 5 * 4_635 * 0.98; // 616,162.995
    const proposedGood = 97.3 * 5 * 6_952.5;      // 3,382,391.25

    expect(labour.currentPerPair).toBeCloseTo(139_320 / currentGood, 9);
    expect(labour.proposedPerPair).toBeCloseTo(121_860 / proposedGood, 9);
    expect(labour.perPairDelta).toBeCloseTo(139_320 / currentGood - 121_860 / proposedGood, 9);

    // Sanity-check the magnitudes a reader would recognise from the report.
    expect(labour.currentPerPair).toBeCloseTo(0.2261, 4);
    expect(labour.proposedPerPair).toBeCloseTo(0.0360, 4);
    expect(labour.perPairDelta).toBeCloseTo(0.1901, 4);
  });

  it('reproduces the shared-hours error exactly as a ratio of the schedules', () => {
    const perSide = calculateAdvancedROI(emma());
    // What the 2026-08-14 workbook did: one shared 8 h/day for both sides.
    const shared = calculateAdvancedROI(
      emma({
        currentShiftsPerDay: undefined,
        currentHoursPerShift: undefined,
        proposedShiftsPerDay: undefined,
        proposedHoursPerShift: undefined,
        workingHoursPerDay: 8,
      }),
    );

    const lab = (r: typeof perSide) => r.savings.bridge.find((c) => c.key === 'labor')!;
    expect(lab(shared).currentPerPair).toBeCloseTo(0.42395, 5);
    expect(lab(shared).proposedPerPair).toBeCloseTo(0.10133, 5);

    // The overstatement is precisely the hours ratio on each side.
    expect(lab(shared).currentPerPair / lab(perSide).currentPerPair).toBeCloseTo(15 / 8, 6);
    expect(lab(shared).proposedPerPair / lab(perSide).proposedPerPair).toBeCloseTo(22.5 / 8, 6);
  });

  it('still reconciles the bridge with asymmetric schedules', () => {
    const r = calculateAdvancedROI(emma());
    const summed = r.savings.bridge.reduce((s, c) => s + c.annualDelta, 0);
    expect(summed).toBeCloseTo(r.savings.totalAnnualSaving, 6);
    expect(r.savings.fobImpact).toBeCloseTo(r.current.costPerPair - r.proposed.costPerPair, 10);
  });

  it('keeps cost per pair invariant to quantity on asymmetric schedules', () => {
    const q1 = calculateAdvancedROI(emma({ machineQuantity: 1 }));
    const q5 = calculateAdvancedROI(emma({ machineQuantity: 5 }));
    expect(q5.current.costPerPair).toBeCloseTo(q1.current.costPerPair, 10);
    expect(q5.proposed.costPerPair).toBeCloseTo(q1.proposed.costPerPair, 10);
  });

  it('counts operators freed against the current side own schedule', () => {
    const r = calculateAdvancedROI(emma());
    const stations = r.basisOutput / 0.98 / (27.13 * 4_635);
    expect(r.savings.manpowerSaving).toBeCloseTo(stations * 7.74 - 6.77 * 5, 6);
  });
});

describe('legacy reports keep their existing numbers', () => {
  it('falls back to the shared working day when no shift pattern is stored', () => {
    const a = resolveAssumptions({ workingHoursPerDay: 8, daysPerYear: 309 });
    expect(a.current.hoursPerDay).toBe(8);
    expect(a.proposed.hoursPerDay).toBe(8);
    expect(a.current.hoursPerYear).toBe(2_472);
    expect(a.proposed.hoursPerYear).toBe(2_472);
    expect(a.current.fromLegacy).toBe(true);
    expect(a.proposed.fromLegacy).toBe(true);
  });

  it('produces identical results to the shared-hours model', () => {
    const legacy = baseParams({ workingHoursPerDay: 8 });
    const explicit = baseParams({
      workingHoursPerDay: 8,
      currentShiftsPerDay: 1,
      currentHoursPerShift: 8,
      proposedShiftsPerDay: 1,
      proposedHoursPerShift: 8,
    });
    const a = calculateAdvancedROI(legacy);
    const b = calculateAdvancedROI(explicit);
    expect(a.current.costPerPair).toBeCloseTo(b.current.costPerPair, 12);
    expect(a.savings.totalAnnualSaving).toBeCloseTo(b.savings.totalAnnualSaving, 8);
    expect(a.roiMonths).toBeCloseTo(b.roiMonths!, 8);
  });
});
