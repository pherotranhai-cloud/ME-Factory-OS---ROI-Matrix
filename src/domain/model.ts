/**
 * The ROI domain model.
 *
 * Rebuilt to express what a real IE investment case requires and the previous
 * flat `ROIParams` could not:
 *
 *  - fleet sizes derived per side from takt time against demand, not a single
 *    shared machine count;
 *  - labour content per pair held separately from machine occupancy per pair,
 *    so parallel work (nesting, QC, de-nesting) is charged to labour without
 *    inflating machine throughput;
 *  - available time reduced by line efficiency and unplanned downtime;
 *  - labour costed either from cycle time or from headcount, explicitly chosen;
 *  - capital recovered either through payback OR through depreciation in
 *    operating cost, never both.
 *
 * Every derived figure is returned as a `Traced` value carrying the formula that
 * produced it, so a report can show its own arithmetic and the workbook can be
 * generated from the same source as the screen.
 */

/** A number together with the arithmetic that produced it. */
export interface Traced {
  value: number;
  /** Human-readable derivation, e.g. "132.667 s/pair x 3,403,580 prs / 3600 x $1.4423/hr". */
  formula: string;
  /** Unit for display, e.g. "USD/yr", "pairs/yr", "s/pair". */
  unit: string;
}

export const traced = (value: number, formula: string, unit: string): Traced => ({
  value: Number.isFinite(value) ? value : 0,
  formula,
  unit,
});

/* ------------------------------------------------------------------ *
 * Inputs
 * ------------------------------------------------------------------ */

/** Equipment characteristics, per unit. */
export interface MachineSpec {
  id: string;
  name: string;
  /**
   * Seconds of MACHINE occupancy per pair. Drives throughput and therefore how
   * many units are required.
   */
  machineCycleSec: number;
  /**
   * Seconds of OPERATOR content per pair. May exceed `machineCycleSec` when
   * work runs alongside the machine — an automatic cutter occupying 37 s/pair
   * can still carry 116 s/pair of nesting, QC and de-nesting labour.
   */
  labourCycleSec: number;
  unitPrice: number;
  consumablesPerYear: number;
  maintenancePerYear: number;
  powerKW: number;
  /** Only consulted when costBasis is 'fullCost'. */
  depreciationYears: number;
  /** Idle-labour cost from unplanned downtime, per year, for the whole side. */
  downtimeLossPerYear: number;
  /** Operators per unit. Only consulted when labourBasis is 'headcount'. */
  operatorsPerUnit?: number;
}

/** Consumption-based material model: quantity per pair at a unit price. */
export interface MaterialSpec {
  /** e.g. 1.17453 */
  consumptionPerPair: number;
  /** e.g. 1.90 */
  pricePerUnit: number;
  /** e.g. "FT²" */
  unit: string;
  /** Optional provenance, e.g. "Grade IV 85, 14.0 FT² skin / 11.9196 pairs". */
  basis?: string;
}

export interface Shift {
  shiftsPerDay: number;
  hoursPerShift: number;
}

/** How many units of the machine this side runs. */
export type FleetPolicy =
  /** Size the fleet from takt time against demand. */
  | { mode: 'derived' }
  /** Use exactly this many units regardless of demand. */
  | { mode: 'fixed'; units: number };

export interface SideInput {
  /** e.g. "Baseline — YG-501 clicker press". */
  label: string;
  machine: MachineSpec;
  shift: Shift;
  fleet: FleetPolicy;
  material: MaterialSpec;
}

export interface CalendarInput {
  daysPerYear: number;
  /** Performance x quality, 0–1. */
  lineEfficiency: number;
  /** Unplanned downtime allowance, 0–1. Available time is reduced by (1 - this). */
  downtimeAllowance: number;
}

export interface LabourInput {
  /** Fully-loaded wage per operator per month. */
  monthlyWage: number;
  /** Paid hours per operator per month — turns the wage into an hourly rate. */
  paidHoursPerMonth: number;
  /**
   * 'cycleTime' charges labour content per pair against demand, which is how an
   * IE model states it. 'headcount' charges operators x units x wage, which is
   * how a staffing plan states it. They answer different questions; mixing them
   * up understated labour by 27x on a real project.
   */
  basis: 'cycleTime' | 'headcount';
  /**
   * Share of the theoretical labour saving actually banked as headcount, 0–1.
   * Operators rarely come out in fractions.
   */
  conversionFactor: number;
}

export type CostBasis =
  /** Depreciation excluded from OpEx; payback = ΔCapEx / ΔOpEx. */
  | 'cash'
  /** Depreciation charged into OpEx; payback on net investment. */
  | 'fullCost';

export interface ProjectInput {
  projectName: string;
  article: string;
  date: string;
  /** Annual pairs the proposal must serve. Drives fleet sizing and the savings basis. */
  demandPairsPerYear: number;
  calendar: CalendarInput;
  labour: LabourInput;
  costBasis: CostBasis;
  /** Evaluation horizon in years, for horizon ROI and net benefit. */
  horizonYears: number;
  energyTariffUSDPerKWh: number;
  baseline: SideInput;
  proposed: SideInput;
}

/* ------------------------------------------------------------------ *
 * Results
 * ------------------------------------------------------------------ */

export interface SideSchedule {
  shiftsPerDay: number;
  hoursPerShift: number;
  hoursPerDay: number;
  /** Raw seconds before efficiency. */
  grossSecondsPerYear: Traced;
  /** After line efficiency and downtime allowance. */
  availableSecondsPerYear: Traced;
}

export interface SideFleet {
  /** Pairs one unit can deliver per year. */
  outputPerUnit: Traced;
  /** Units required (derived) or configured (fixed). */
  units: Traced;
  /** Whole-side annual capacity. */
  capacity: Traced;
  /** Fraction of capacity consumed by demand, 0–1. */
  utilisation: Traced;
}

export type CostKey =
  | 'labour'
  | 'material'
  | 'consumables'
  | 'maintenance'
  | 'energy'
  | 'downtime'
  | 'depreciation';

export interface CostLine {
  key: CostKey;
  label: string;
  annual: Traced;
  perPair: Traced;
}

export interface SideResult {
  label: string;
  schedule: SideSchedule;
  fleet: SideFleet;
  lines: CostLine[];
  totalAnnual: Traced;
  costPerPair: Traced;
  capex: Traced;
  /** Operator headcount implied by this side, for the manning discussion. */
  operators: Traced;
}

export interface SavingLine {
  key: CostKey;
  label: string;
  baselineAnnual: number;
  proposedAnnual: number;
  /** baseline - proposed. Positive = saving. */
  annualDelta: number;
  perPairDelta: number;
  /** Share of the total saving, 0–1. */
  share: number;
}

export type Payback =
  | { kind: 'months'; months: number }
  | { kind: 'immediate' }
  | { kind: 'none'; annualLoss: number };

export interface ProjectResult {
  input: ProjectInput;
  baseline: SideResult;
  proposed: SideResult;

  savings: {
    lines: SavingLine[];
    /** Sum of the line deltas. */
    totalAnnual: Traced;
    perPair: Traced;
    /** Labour delta before the conversion factor, for transparency. */
    labourTheoretical: number;
    labourRealised: number;
  };

  investment: {
    baselineCapex: Traced;
    proposedCapex: Traced;
    /** proposed - baseline. */
    incremental: Traced;
    basis: CostBasis;
  };

  payback: Payback;
  /** Flattened for storage. `null` when there is no payback. */
  paybackMonths: number | null;
  horizonROI: Traced;
  horizonNetBenefit: Traced;

  /** Annual good pairs the comparison is measured against. */
  basisOutput: Traced;
}
