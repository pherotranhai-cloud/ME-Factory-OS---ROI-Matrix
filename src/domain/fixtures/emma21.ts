import { type ProjectInput, type SideInput } from '../model';

/**
 * The EMMA 21 leather-cutting case, transcribed from the IE financial model
 * `finacial_report_2026-07-30` (article SAMBA OG MULE W, LC5440/LC5441).
 *
 * This is the reference the engine is held to. Every constant below is sourced
 * from that workbook's own assumption register, cited inline. It is the
 * IE-verified worked example the project previously lacked — treat it as a
 * specification, not a sample: if the engine stops reproducing it, the engine is
 * wrong until proven otherwise.
 *
 * Source tabs: `Assumptions` (register), `Calc.Capacity`, `Calc.OpEx`,
 * `Usage.summary`, `IE data` (time study 29.07.2026), `OEE Emma 21`.
 */

/** Assumptions §1 — 26 days/month, consistent with 208 paid hours. */
const DAYS_PER_YEAR = 312;

/**
 * Assumptions §1 — line efficiency 0.9876 (performance x quality) and a 0.0224
 * unplanned-downtime allowance, per the OEE report. Their product is the
 * 0.9655204136051123 the workbook uses to derive 24,400,631.8926 available
 * seconds per machine-year. The factors are stored separately so a reviewer can
 * see which one moved.
 */
const LINE_EFFICIENCY = 0.9876;
const DOWNTIME_ALLOWANCE = 1 - 0.9655204136051123 / 0.9876;

/** Assumptions §7 — 1,701,790 applicable pairs over 6 months, annualised x2. */
const DEMAND = 3_403_580;

/** Assumptions §3 — Pegasus leather at $1.90/FT². */
const LEATHER_PRICE = 1.9;

/** Baseline: YG-501 travel-head clicker press. */
const clickerPress: SideInput['machine'] = {
  id: 'yg-501',
  name: 'YG-501 travel-head clicker press',
  // IE data — the press is manual, so machine occupancy and labour content are
  // the same 132.667 s/pair.
  machineCycleSec: 132.66718562874252,
  labourCycleSec: 132.66718562874252,
  // Assumptions §4 — most recent purchase 13/12.
  unitPrice: 4579,
  // Assumptions §8 — cutting-board scrap pool spread across 259 plant presses.
  consumablesPerYear: 329.1660613517756,
  // Assumptions §8 — parts log across 10 distinct assets.
  maintenancePerYear: 72.33461538461539,
  powerKW: 0,
  depreciationYears: 1,
  // No baseline downtime record exists; the workbook enters zero and flags it.
  downtimeLossPerYear: 0,
  // Assumptions §6 — concurrent positions on a 210 pairs/hr line.
  operatorsPerUnit: 7.738919161676646,
};

/** Proposed: EMMA 21 automatic cutter. */
const emma21: SideInput['machine'] = {
  id: 'emma-21',
  name: 'EMMA 21 automatic cutter',
  // Assumptions §6 — stations 3-9 only; excludes QC, nesting and de-nesting.
  machineCycleSec: 37.002071428571426,
  // Assumptions §6 — total cycle time per pair, including the work that runs
  // alongside the machine. This is the figure that carries labour.
  labourCycleSec: 115.99327142857142,
  unitPrice: 57750,
  // Assumptions §9 — blades, conveyor belt and the rest of the EMMA pool.
  consumablesPerYear: 1361.4615384615386,
  maintenancePerYear: 63.26923076923077,
  powerKW: 0,
  depreciationYears: 5,
  // Calc.OpEx row 16 — idle labour from the (implausibly short) downtime log.
  downtimeLossPerYear: 198.20358000634343,
  operatorsPerUnit: 6.766274166666666,
};

/**
 * The model's headline framing: both sides on three shifts, which isolates the
 * machine difference from any shift-pattern difference.
 */
export const emma21Project: ProjectInput = {
  projectName: 'Leather cutting automation',
  article: 'SAMBA OG MULE W (LC5440/LC5441)',
  date: '2026-07-30',
  demandPairsPerYear: DEMAND,
  calendar: {
    daysPerYear: DAYS_PER_YEAR,
    lineEfficiency: LINE_EFFICIENCY,
    downtimeAllowance: DOWNTIME_ALLOWANCE,
  },
  labour: {
    // Assumptions §2 — user-supplied wage over 208 paid hours = $1.4423/hr.
    monthlyWage: 300,
    paidHoursPerMonth: 208,
    basis: 'cycleTime',
    conversionFactor: 1,
  },
  // The workbook pays back ΔCapEx out of ΔOpEx and carries no depreciation line.
  costBasis: 'cash',
  horizonYears: 3,
  energyTariffUSDPerKWh: 0.075,
  baseline: {
    label: 'Baseline — manual clicker press',
    machine: clickerPress,
    shift: { shiftsPerDay: 3, hoursPerShift: 7.5 },
    fleet: { mode: 'derived' },
    material: {
      // Usage.summary — Grade IV 85, 14.0 FT² skin over 11.9196 pairs.
      consumptionPerPair: 1.1745336719502582,
      pricePerUnit: LEATHER_PRICE,
      unit: 'FT²',
      basis: 'Grade IV (85), 14.0 FT² skin / 11.9196 pairs',
    },
  },
  proposed: {
    label: 'Proposed — EMMA 21',
    machine: emma21,
    shift: { shiftsPerDay: 3, hoursPerShift: 7.5 },
    fleet: { mode: 'derived' },
    material: {
      // Usage.summary — Grade IV 85, 15.3 FT² skin over 13.3353 pairs.
      consumptionPerPair: 1.1473315829813564,
      pricePerUnit: LEATHER_PRICE,
      unit: 'FT²',
      basis: 'Grade IV (85), 15.3 FT² skin / 13.3353 pairs',
    },
  },
};

/**
 * The same project with the baseline on its real two-shift pattern. More presses
 * are needed to hold the same demand, so more capital is displaced.
 */
export const emma21ActualShifts: ProjectInput = {
  ...emma21Project,
  baseline: { ...emma21Project.baseline, shift: { shiftsPerDay: 2, hoursPerShift: 7.5 } },
};

/** Figures the IE workbook publishes, for the engine to be measured against. */
export const emma21Expected = {
  availableSecondsPerMachineYear: 24_400_631.8926,
  fleet: { presses: 19, emma: 6 },
  labour: { baseline: 180_906.8027, proposed: 158_170.0235 },
  material: { baseline: 7_595_476.6988, proposed: 7_419_566.1755 },
  consumables: { baseline: 6_254.1552, proposed: 8_168.7692 },
  maintenance: { baseline: 1_374.3577, proposed: 379.6154 },
  downtime: { baseline: 0, proposed: 198.2036 },
  totalAnnual: { baseline: 7_784_012.0144, proposed: 7_586_482.7872 },
  costPerPair: { baseline: 2.2870072142986424, proposed: 2.22897149096763 },
  capex: { baseline: 87_001, proposed: 346_500, incremental: 259_499 },
  netAnnualSaving: 197_529.2272149669,
  savingPerPair: 0.05803572333101226,
  paybackMonths: 15.764694895561519,
  threeYearROI: 1.283583681034997,
  threeYearNetBenefit: 333_088.6816449007,
  /** Calc.OpEx §D — conversion factor to payback months. */
  labourConversion: [
    { factor: 1, netSaving: 197_529.2272149669, months: 15.764694895561519 },
    { factor: 0.5, netSaving: 186_160.83761291995, months: 16.727406472433508 },
    { factor: 0.25, netSaving: 180_476.64281189645, months: 17.254243826142005 },
    { factor: 0.1, netSaving: 177_066.12593128238, months: 17.586582321276445 },
    { factor: 0, netSaving: 174_792.448010873, months: 17.81534634612071 },
  ],
  /** Calc.Capacity §B — fleet re-sized as demand grows. */
  growth: [
    { growth: 0, demand: 3_403_580, presses: 19, emma: 6 },
    { growth: 0.1, demand: 3_743_938, presses: 21, emma: 6 },
    { growth: 0.25, demand: 4_254_475, presses: 24, emma: 7 },
    { growth: 0.5, demand: 5_105_370, presses: 28, emma: 8 },
  ],
} as const;
