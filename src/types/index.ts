export type Language = 'VI' | 'EN' | 'ZH-CN' | 'ZH-TW' | 'ID' | 'MY';

export interface MaterialItem {
  id: string;
  type: string;
  description: string;
  supplier: string;
  uom: string;
  usage: number;
  loss: number;
  fob: number;
}

export interface ROIParams {
  // General Info
  shoeModel: string;
  date: string;
  equipmentName: string;
  machineType: string;
  brand: string;
  scopeOfWork: string;
  /**
   * Number of stations in scope. Applies to BOTH sides of the comparison: we are
   * replacing `machineQuantity` current stations with `machineQuantity` proposed
   * ones. Capacity, labour, energy, maintenance, consumables and depreciation all
   * scale by this on both sides, which is what keeps cost-per-pair invariant to it.
   */
  machineQuantity: number;

  // Technical Specs (Current vs Proposed)
  currentPowerSupplyV: string;
  proposedPowerSupplyV: string;
  currentPowerConsumptionKW: number;
  proposedPowerConsumptionKW: number;
  currentSpeedSPrs: number;
  proposedSpeedSPrs: number;
  currentUnitPrice: number;
  proposedUnitPrice: number;
  currentMaintenanceCostPerYear: number;
  proposedMaintenanceCostPerYear: number;
  currentConsumablesCostPerYear: number;
  proposedConsumablesCostPerYear: number;
  currentDepreciationYears: number;
  proposedDepreciationYears: number;

  // Production Data - IE Data
  currentCT: number;
  proposedCT: number;
  /** Pairs per hour, PER STATION. Same basis on both sides. */
  currentPPH: number;
  proposedPPH: number;
  /** Operators required, PER STATION. Same basis on both sides. */
  currentManpower: number;
  proposedManpower: number;

  // Production Data - Quality Data
  currentRFT: number;
  proposedRFT: number;
  currentDefectRate: number;
  proposedDefectRate: number;

  // Production Data - Material Cost Tables
  currentMaterials: MaterialItem[];
  proposedMaterials: MaterialItem[];

  // Shared operating assumptions
  /**
   * Legacy shared operating hours. Retained so reports saved before per-side
   * shift patterns existed still load; used as the fallback for BOTH sides when
   * the per-side fields below are absent. Prefer the per-side fields.
   */
  workingHoursPerDay: number;
  localLaborCost: number; // Salary, USD per operator per month

  /**
   * Shift pattern, PER SIDE.
   *
   * The two sides genuinely run different patterns — e.g. a traditional cutting
   * line on 2 shifts of 7.5 h against an automatic cutter on 3 shifts of 7.5 h.
   * A single shared figure cannot express that, and getting it wrong distorts
   * the ratio between the sides rather than scaling both equally, which is
   * exactly what cost-per-pair and the savings bridge measure.
   *
   * Optional so stored reports deserialize; read them through
   * `resolveAssumptions()`, which applies the legacy fallback.
   */
  currentShiftsPerDay?: number;
  currentHoursPerShift?: number;
  proposedShiftsPerDay?: number;
  proposedHoursPerShift?: number;

  /**
   * Assumptions promoted out of hardcoded constants (P1-06). Optional on the
   * interface so that reports saved before this change still deserialize; use
   * `resolveAssumptions()` to read them with defaults applied.
   */
  daysPerYear?: number;
  powerRateUSD?: number;
}

/** Defaults for assumptions that used to be hardcoded inside the engine. */
export const DEFAULT_ASSUMPTIONS = {
  /** 6-day week, ~52 weeks. */
  daysPerYear: 312,
  /** USD per kWh. Varies materially by site (VN / ID / MY) — override per project. */
  powerRateUSD: 0.075,
} as const;

/** Per-scenario cost lines. All figures are annual and for the whole scope
 *  (i.e. already multiplied by `machineQuantity`) unless the name says per-pair. */
export interface ScenarioResults {
  /** Gross pairs produced per year, before scrap. */
  annualCapacity: number;
  /** Sellable pairs per year, after scrap. */
  actualGoodCapacity: number;
  /** Total operators across the whole scope. */
  manpowerDemand: number;

  annualLaborCost: number;
  annualMaterialCost: number;
  annualEnergyCost: number;
  annualMaintenance: number;
  annualConsumables: number;
  annualDepreciation: number;

  /** Labour + energy + maintenance + consumables + depreciation. Excludes material. */
  totalOperatingCost: number;
  /** Operating + material. */
  totalAnnualCost: number;

  /** Per GOOD pair — scrap already grossed up. */
  operatingCostPerPair: number;
  materialCostPerPair: number;
  costPerPair: number;
}

/** One row of the cost-per-pair bridge. Components sum exactly to the total. */
export interface SavingsComponent {
  key: 'labor' | 'material' | 'energy' | 'maintenance' | 'consumables' | 'depreciation';
  /** Current cost per good pair for this line. */
  currentPerPair: number;
  /** Proposed cost per good pair for this line. */
  proposedPerPair: number;
  /** currentPerPair - proposedPerPair. Positive = saving. */
  perPairDelta: number;
  /** perPairDelta x basisOutput. Positive = saving. */
  annualDelta: number;
}

/**
 * Payback, stated explicitly rather than as `Infinity` (P1-04).
 * `Infinity` does not survive JSON.stringify — it becomes `null` — which
 * silently turned loss-making proposals into "no data".
 */
export type Payback =
  | { kind: 'months'; months: number }
  /** Proposal saves money AND costs no more than the current state. */
  | { kind: 'immediate' }
  /** Proposal does not save money. `annualLoss` is a positive number. */
  | { kind: 'none'; annualLoss: number };

export interface ROIResults {
  current: ScenarioResults;
  proposed: ScenarioResults;

  savings: {
    /** Operators freed, at equal output. */
    manpowerSaving: number;
    laborSaving: number;
    materialSaving: number;
    energySaving: number;
    maintenanceSaving: number;
    consumablesSaving: number;
    depreciationSaving: number;
    /** Sum of the component deltas. Positive = saving. */
    totalAnnualSaving: number;
    /** Cost-per-good-pair improvement. Positive = cheaper. */
    fobImpact: number;
    /** Ordered bridge from current cost/pair to proposed cost/pair. */
    bridge: SavingsComponent[];
  };

  investment: {
    /** proposedUnitPrice x qty. */
    gross: number;
    /** (proposedUnitPrice - currentUnitPrice) x qty. */
    net: number;
    /** Which one `payback` and `roiMonths` are based on (P1-03). */
    basis: 'net' | 'gross';
    /** The amount actually used, per `basis`. */
    applied: number;
  };

  payback: Payback;
  /**
   * Flattened payback for storage and for the dashboard's `roi_months` column.
   * `null` when there is no payback — distinguish via `payback.kind`.
   */
  roiMonths: number | null;

  /** Annual good pairs the savings are measured against. */
  basisOutput: number;

  /** The assumptions actually used, echoed for display and export (P1-06). */
  assumptions: {
    daysPerYear: number;
    powerRateUSD: number;
    /** Per-side shift pattern and the hours it works out to. */
    current: SideSchedule;
    proposed: SideSchedule;
    /**
     * Legacy shared figure, kept only so older reports and any consumer that has
     * not moved to the per-side fields still render. Equals `current.hoursPerDay`.
     * @deprecated read `assumptions.current` / `assumptions.proposed` instead.
     */
    workingHoursPerDay: number;
    /** @deprecated equals `current.hoursPerYear`. */
    hoursPerYear: number;
  };
}

/** Operating schedule for one side of the comparison. */
export interface SideSchedule {
  shiftsPerDay: number;
  hoursPerShift: number;
  hoursPerDay: number;
  hoursPerYear: number;
  /** True when this side fell back to the legacy shared `workingHoursPerDay`. */
  fromLegacy: boolean;
}
