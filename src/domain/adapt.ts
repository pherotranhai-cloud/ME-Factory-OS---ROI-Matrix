import { ROIParams, MaterialItem } from '../types';
import { resolveAssumptions, bomCostPerPair } from '../utils/roi-calculations';
import { ProjectInput, SideInput, MachineSpec } from './model';

/**
 * Bridge from the stored `ROIParams` shape to the new domain model.
 *
 * **Imported projects will produce different numbers, and that is the point.**
 *
 * The old engine costed each side at *its own* capacity and then compared the
 * results — a proposal producing three times the volume was measured against a
 * baseline producing one third of it. Spreading each side's fixed costs over a
 * different denominator is what let a real project read a 4.1-month payback when
 * the honest figure was 15.8. The new engine costs both sides at the same
 * volume, so those two behaviours cannot both be preserved.
 *
 * What this adapter therefore guarantees is **input fidelity, not output
 * equality**: every stored value maps across unchanged, and the settings the old
 * model implied are carried over rather than silently upgraded —
 *
 *  - labour on the `headcount` basis, because that is what the old engine did;
 *  - `fullCost`, because the old engine charged depreciation into operating cost;
 *  - a fixed fleet at `machineQuantity` on both sides, because the old model had
 *    no way to size them independently;
 *  - line efficiency 1 and no downtime allowance, because neither field existed.
 *
 * Validation then surfaces what those settings cost: an imported project
 * typically raises FLEET_UNDERSIZED (the sides could never make the same
 * volume), EFFICIENCY_NAMEPLATE and DOWNTIME_ZERO. Acting on them is the user's
 * decision. `newProjectDefaults()` is what a fresh project starts from, and it
 * uses the better settings from the outset.
 */

const num = (v: unknown): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

/** Cycle time from pairs-per-hour, which is how the old form captured speed. */
const cycleFromPPH = (pph: number, fallbackCT: number): number => {
  const p = num(pph);
  if (p > 0) return 3600 / p;
  // Some older projects recorded cycle time but left PPH blank.
  return num(fallbackCT);
};

const machineFrom = (
  side: 'current' | 'proposed',
  p: ROIParams,
): MachineSpec => {
  const pph = side === 'current' ? p.currentPPH : p.proposedPPH;
  const ct = side === 'current' ? p.currentCT : p.proposedCT;
  const cycle = cycleFromPPH(pph, ct);

  return {
    id: side,
    name: side === 'current' ? 'Current equipment' : (p.equipmentName || 'Proposed equipment'),
    machineCycleSec: cycle,
    // The old model had a single cycle time, so labour and machine time are
    // necessarily equal on import. Splitting them is a data-entry decision.
    labourCycleSec: cycle,
    unitPrice: num(side === 'current' ? p.currentUnitPrice : p.proposedUnitPrice),
    consumablesPerYear: num(side === 'current' ? p.currentConsumablesCostPerYear : p.proposedConsumablesCostPerYear),
    maintenancePerYear: num(side === 'current' ? p.currentMaintenanceCostPerYear : p.proposedMaintenanceCostPerYear),
    powerKW: num(side === 'current' ? p.currentPowerConsumptionKW : p.proposedPowerConsumptionKW),
    depreciationYears: num(side === 'current' ? p.currentDepreciationYears : p.proposedDepreciationYears),
    downtimeLossPerYear: 0,
    operatorsPerUnit: num(side === 'current' ? p.currentManpower : p.proposedManpower),
  };
};

/**
 * The old material table is a BOM priced per pair, so it maps to a consumption
 * of "1 pair's worth" at the BOM price. That keeps the money identical while
 * fitting the consumption x price shape the new model uses.
 */
const materialFrom = (materials: MaterialItem[] | undefined) => ({
  consumptionPerPair: 1,
  pricePerUnit: bomCostPerPair(materials),
  unit: 'BOM',
  basis: `${(materials ?? []).length} material line(s) from the stored bill of materials`,
});

export const fromLegacyParams = (p: ROIParams): ProjectInput => {
  const a = resolveAssumptions(p);
  const quantity = Math.max(0, num(p.machineQuantity));

  const side = (which: 'current' | 'proposed'): SideInput => {
    const schedule = which === 'current' ? a.current : a.proposed;
    return {
      label: which === 'current' ? 'Current state' : 'Proposed state',
      machine: machineFrom(which, p),
      shift: {
        shiftsPerDay: schedule.shiftsPerDay,
        hoursPerShift: schedule.hoursPerShift,
      },
      // The old model had one shared quantity and no demand to size against.
      fleet: { mode: 'fixed', units: quantity },
      material: materialFrom(which === 'current' ? p.currentMaterials : p.proposedMaterials),
      yieldRate: 1 - Math.min(Math.max(num(which === 'current' ? p.currentDefectRate : p.proposedDefectRate), 0), 100) / 100,
    };
  };

  const proposed = side('proposed');

  // The old engine measured savings against the proposed line's good output.
  // With no demand recorded, that capacity is the only defensible volume.
  const proposedHoursPerYear = a.proposed.hoursPerYear;
  const proposedPPH = num(p.proposedPPH);
  const proposedGoodCapacity =
    proposedPPH * quantity * proposedHoursPerYear * (proposed.yieldRate ?? 1);

  return {
    projectName: p.equipmentName || 'Imported project',
    article: p.shoeModel || '',
    date: p.date || new Date().toISOString().slice(0, 10),
    demandPairsPerYear: proposedGoodCapacity,
    calendar: {
      daysPerYear: a.daysPerYear,
      // Neither field existed on the old model; 1 and 0 reproduce its arithmetic.
      lineEfficiency: 1,
      downtimeAllowance: 0,
    },
    labour: {
      monthlyWage: num(p.localLaborCost),
      // Not recorded before. 208 is the conventional 26-day month at 8 hours and
      // only affects the derived operator count on this basis, not the cost.
      paidHoursPerMonth: 208,
      basis: 'headcount',
      conversionFactor: 1,
    },
    costBasis: 'fullCost',
    horizonYears: 3,
    energyTariffUSDPerKWh: a.powerRateUSD,
    baseline: side('current'),
    proposed,
  };
};

/** Marks a project as imported from the old shape, for the UI to flag. */
export const isLegacyShaped = (p: Partial<ROIParams>): boolean =>
  p != null && typeof p === 'object' && 'machineQuantity' in p && !('demandPairsPerYear' in p);

/**
 * What a NEW project starts from: the settings that reproduce an IE-grade
 * analysis rather than the old model's compromises.
 */
export const newProjectDefaults = (): ProjectInput => ({
  projectName: '',
  article: '',
  date: new Date().toISOString().slice(0, 10),
  demandPairsPerYear: 0,
  calendar: {
    daysPerYear: 312,
    lineEfficiency: 0.9876,
    downtimeAllowance: 0.0224,
  },
  labour: {
    monthlyWage: 300,
    paidHoursPerMonth: 208,
    basis: 'cycleTime',
    conversionFactor: 1,
  },
  costBasis: 'cash',
  horizonYears: 3,
  energyTariffUSDPerKWh: 0.075,
  baseline: {
    label: 'Baseline',
    machine: {
      id: 'baseline', name: '', machineCycleSec: 0, labourCycleSec: 0, unitPrice: 0,
      consumablesPerYear: 0, maintenancePerYear: 0, powerKW: 0, depreciationYears: 5,
      downtimeLossPerYear: 0, operatorsPerUnit: 0,
    },
    shift: { shiftsPerDay: 2, hoursPerShift: 7.5 },
    fleet: { mode: 'derived' },
    material: { consumptionPerPair: 0, pricePerUnit: 0, unit: 'FT²' },
    yieldRate: 1,
  },
  proposed: {
    label: 'Proposed',
    machine: {
      id: 'proposed', name: '', machineCycleSec: 0, labourCycleSec: 0, unitPrice: 0,
      consumablesPerYear: 0, maintenancePerYear: 0, powerKW: 0, depreciationYears: 5,
      downtimeLossPerYear: 0, operatorsPerUnit: 0,
    },
    shift: { shiftsPerDay: 3, hoursPerShift: 7.5 },
    fleet: { mode: 'derived' },
    material: { consumptionPerPair: 0, pricePerUnit: 0, unit: 'FT²' },
    yieldRate: 1,
  },
});
