import {
  ROIParams,
  ROIResults,
  ScenarioResults,
  SavingsComponent,
  Payback,
  MaterialItem,
  SideSchedule,
  DEFAULT_ASSUMPTIONS,
} from '../types';

/** Coerce anything the form or a stored report may hand us into a usable number. */
const num = (v: unknown): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

/** Division that yields 0 rather than Infinity/NaN when the denominator is unusable. */
const safeDiv = (a: number, b: number): number =>
  b !== 0 && Number.isFinite(b) && Number.isFinite(a) ? a / b : 0;

/** Percentages arrive from free-text inputs; keep them inside [0, 100]. */
const clampPct = (pct: unknown): number => Math.min(Math.max(num(pct), 0), 100);

/**
 * Assumptions that used to be hardcoded inside this file (P1-06). Reports saved
 * before they existed on ROIParams deserialize without them, so fall back to the
 * documented defaults rather than producing NaN.
 */
export const resolveAssumptions = (p: Partial<ROIParams>) => {
  const daysPerYear = p.daysPerYear != null ? num(p.daysPerYear) : DEFAULT_ASSUMPTIONS.daysPerYear;
  const powerRateUSD = p.powerRateUSD != null ? num(p.powerRateUSD) : DEFAULT_ASSUMPTIONS.powerRateUSD;
  const legacyHoursPerDay = num(p.workingHoursPerDay);

  /**
   * A side's schedule comes from `shifts x hours/shift` when supplied, because
   * that is how the factory states it and it stays auditable. Reports saved
   * before those fields existed fall back to the shared `workingHoursPerDay`,
   * treated as a single shift, so their numbers do not move.
   */
  const schedule = (shifts?: number, hoursPerShift?: number): SideSchedule => {
    const hasPerSide = shifts != null && hoursPerShift != null;
    const shiftsPerDay = hasPerSide ? num(shifts) : 1;
    const perShift = hasPerSide ? num(hoursPerShift) : legacyHoursPerDay;
    const hoursPerDay = shiftsPerDay * perShift;
    return {
      shiftsPerDay,
      hoursPerShift: perShift,
      hoursPerDay,
      hoursPerYear: hoursPerDay * daysPerYear,
      fromLegacy: !hasPerSide,
    };
  };

  const current = schedule(p.currentShiftsPerDay, p.currentHoursPerShift);
  const proposed = schedule(p.proposedShiftsPerDay, p.proposedHoursPerShift);

  return {
    daysPerYear,
    powerRateUSD,
    current,
    proposed,
    // Deprecated mirrors, kept so existing consumers keep compiling.
    workingHoursPerDay: current.hoursPerDay,
    hoursPerYear: current.hoursPerYear,
  };
};

/** BOM cost for one pair PRODUCED (before scrap), summed over the material table. */
export const bomCostPerPair = (materials: MaterialItem[] | undefined): number =>
  (materials || []).reduce(
    (sum, m) => sum + num(m.usage) * num(m.fob) * (1 + num(m.loss) / 100),
    0,
  );

/** Inputs for one side of the comparison, already normalised. */
interface ScenarioInputs {
  pph: number;
  manpower: number;
  defectRate: number;
  powerKW: number;
  unitPrice: number;
  maintenancePerYear: number;
  consumablesPerYear: number;
  depreciationYears: number;
  materials: MaterialItem[] | undefined;
}

/**
 * Cost model for one scenario.
 *
 * Every term scales by `quantity`, on both the numerator and the denominator of
 * cost-per-pair. That is what makes cost-per-pair invariant to machine quantity —
 * the property the previous implementation violated (P1-01), where capacity was
 * driven by `currentManpower` while labour was driven by `machineQuantity`.
 */
const computeScenario = (
  s: ScenarioInputs,
  quantity: number,
  laborCostPerMonth: number,
  hoursPerYear: number,
  powerRateUSD: number,
): ScenarioResults => {
  const yieldRate = 1 - clampPct(s.defectRate) / 100;

  const annualCapacity = s.pph * quantity * hoursPerYear;
  const actualGoodCapacity = annualCapacity * yieldRate;

  const annualLaborCost = s.manpower * quantity * laborCostPerMonth * 12;
  const annualEnergyCost = s.powerKW * quantity * hoursPerYear * powerRateUSD;
  const annualMaintenance = s.maintenancePerYear * quantity;
  const annualConsumables = s.consumablesPerYear * quantity;
  const annualDepreciation = safeDiv(s.unitPrice * quantity, s.depreciationYears);

  // Material is consumed on every pair PRODUCED, so annual material follows gross
  // capacity. Per GOOD pair it is grossed up by the yield — i.e. divided by
  // (1 - defect), not multiplied by (1 + defect) as before (P1-05).
  const perPairBOM = bomCostPerPair(s.materials);
  const annualMaterialCost = annualCapacity * perPairBOM;

  const totalOperatingCost =
    annualLaborCost + annualEnergyCost + annualMaintenance + annualConsumables + annualDepreciation;
  const totalAnnualCost = totalOperatingCost + annualMaterialCost;

  const operatingCostPerPair = safeDiv(totalOperatingCost, actualGoodCapacity);
  const materialCostPerPair = safeDiv(annualMaterialCost, actualGoodCapacity);

  return {
    annualCapacity,
    actualGoodCapacity,
    manpowerDemand: s.manpower * quantity,
    annualLaborCost,
    annualMaterialCost,
    annualEnergyCost,
    annualMaintenance,
    annualConsumables,
    annualDepreciation,
    totalOperatingCost,
    totalAnnualCost,
    operatingCostPerPair,
    materialCostPerPair,
    costPerPair: operatingCostPerPair + materialCostPerPair,
  };
};

export const calculateAdvancedROI = (p: ROIParams): ROIResults => {
  const assumptions = resolveAssumptions(p);
  const { powerRateUSD } = assumptions;

  const quantity = num(p.machineQuantity);
  const laborCostPerMonth = num(p.localLaborCost);

  const current = computeScenario(
    {
      pph: num(p.currentPPH),
      manpower: num(p.currentManpower),
      defectRate: clampPct(p.currentDefectRate),
      powerKW: num(p.currentPowerConsumptionKW),
      unitPrice: num(p.currentUnitPrice),
      maintenancePerYear: num(p.currentMaintenanceCostPerYear),
      consumablesPerYear: num(p.currentConsumablesCostPerYear),
      depreciationYears: num(p.currentDepreciationYears),
      materials: p.currentMaterials,
    },
    quantity,
    laborCostPerMonth,
    assumptions.current.hoursPerYear,
    powerRateUSD,
  );

  const proposed = computeScenario(
    {
      pph: num(p.proposedPPH),
      manpower: num(p.proposedManpower),
      defectRate: clampPct(p.proposedDefectRate),
      powerKW: num(p.proposedPowerConsumptionKW),
      unitPrice: num(p.proposedUnitPrice),
      maintenancePerYear: num(p.proposedMaintenanceCostPerYear),
      consumablesPerYear: num(p.proposedConsumablesCostPerYear),
      depreciationYears: num(p.proposedDepreciationYears),
      materials: p.proposedMaterials,
    },
    quantity,
    laborCostPerMonth,
    assumptions.proposed.hoursPerYear,
    powerRateUSD,
  );

  // Savings are measured at EQUAL OUTPUT: the good pairs the proposed line delivers.
  // Comparing each side's own natural capacity would reward simply running more hours.
  const basisOutput = proposed.actualGoodCapacity;

  const componentSpec: Array<{
    key: SavingsComponent['key'];
    currentAnnual: number;
    proposedAnnual: number;
  }> = [
    { key: 'labor', currentAnnual: current.annualLaborCost, proposedAnnual: proposed.annualLaborCost },
    { key: 'material', currentAnnual: current.annualMaterialCost, proposedAnnual: proposed.annualMaterialCost },
    { key: 'energy', currentAnnual: current.annualEnergyCost, proposedAnnual: proposed.annualEnergyCost },
    { key: 'maintenance', currentAnnual: current.annualMaintenance, proposedAnnual: proposed.annualMaintenance },
    { key: 'consumables', currentAnnual: current.annualConsumables, proposedAnnual: proposed.annualConsumables },
    { key: 'depreciation', currentAnnual: current.annualDepreciation, proposedAnnual: proposed.annualDepreciation },
  ];

  const bridge: SavingsComponent[] = componentSpec.map(({ key, currentAnnual, proposedAnnual }) => {
    const currentPerPair = safeDiv(currentAnnual, current.actualGoodCapacity);
    const proposedPerPair = safeDiv(proposedAnnual, proposed.actualGoodCapacity);
    const perPairDelta = currentPerPair - proposedPerPair;
    return {
      key,
      currentPerPair,
      proposedPerPair,
      perPairDelta,
      annualDelta: perPairDelta * basisOutput,
    };
  });

  const byKey = (key: SavingsComponent['key']) =>
    bridge.find((c) => c.key === key)?.annualDelta ?? 0;

  // Summing the components (rather than recomputing from totals) guarantees the
  // bridge reconciles exactly to the headline number.
  const totalAnnualSaving = bridge.reduce((sum, c) => sum + c.annualDelta, 0);
  const fobImpact = bridge.reduce((sum, c) => sum + c.perPairDelta, 0);

  // Operators required to deliver basisOutput at the CURRENT line's productivity.
  const currentYield = 1 - clampPct(p.currentDefectRate) / 100;
  const currentGrossForBasis = safeDiv(basisOutput, currentYield);
  const currentStationsForBasis = safeDiv(
    currentGrossForBasis,
    num(p.currentPPH) * assumptions.current.hoursPerYear,
  );
  const manpowerSaving = currentStationsForBasis * num(p.currentManpower) - proposed.manpowerDemand;

  const grossInvestment = num(p.proposedUnitPrice) * quantity;
  const netInvestment = (num(p.proposedUnitPrice) - num(p.currentUnitPrice)) * quantity;
  // Both are reported; payback runs on net, since the current equipment is being
  // displaced and only the incremental spend is new money.
  const appliedInvestment = netInvestment;

  let payback: Payback;
  if (totalAnnualSaving <= 0) {
    payback = { kind: 'none', annualLoss: -totalAnnualSaving };
  } else if (appliedInvestment <= 0) {
    payback = { kind: 'immediate' };
  } else {
    payback = { kind: 'months', months: appliedInvestment / (totalAnnualSaving / 12) };
  }

  const roiMonths =
    payback.kind === 'months' ? payback.months : payback.kind === 'immediate' ? 0 : null;

  return {
    current,
    proposed,
    savings: {
      manpowerSaving,
      laborSaving: byKey('labor'),
      materialSaving: byKey('material'),
      energySaving: byKey('energy'),
      maintenanceSaving: byKey('maintenance'),
      consumablesSaving: byKey('consumables'),
      depreciationSaving: byKey('depreciation'),
      totalAnnualSaving,
      fobImpact,
      bridge,
    },
    investment: {
      gross: grossInvestment,
      net: netInvestment,
      basis: 'net',
      applied: appliedInvestment,
    },
    payback,
    roiMonths,
    basisOutput,
    assumptions,
  };
};
