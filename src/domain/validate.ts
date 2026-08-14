import { ProjectInput, ProjectResult, SideInput } from './model';
import { calculateProject } from './engine';

/**
 * Input validation.
 *
 * Each rule exists because the corresponding mistake actually reached a
 * published report. The most expensive of them — line-level manning entered
 * against machine-level throughput — overstated a labour saving by 27x and
 * turned a 15.8-month payback into 4.1 months. None of it was caught by types,
 * because every value involved was a perfectly valid number.
 *
 * `error` blocks the figures from being presented as reliable.
 * `warning` lets them through but must be shown alongside them.
 */

export type Severity = 'error' | 'warning';

export interface Issue {
  code: string;
  severity: Severity;
  /** Where the user should look, e.g. "proposed.machine.labourCycleSec". */
  field: string;
  message: string;
  /** What to do about it. */
  remedy: string;
}

const err = (code: string, field: string, message: string, remedy: string): Issue => ({
  code, severity: 'error', field, message, remedy,
});
const warn = (code: string, field: string, message: string, remedy: string): Issue => ({
  code, severity: 'warning', field, message, remedy,
});

const fmt = (n: number, d = 2) =>
  n.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });

const SIDES: Array<['baseline' | 'proposed', string]> = [
  ['baseline', 'Baseline'],
  ['proposed', 'Proposed'],
];

/**
 * Manning consistency.
 *
 * On the headcount basis the two ways of describing labour must agree. Operators
 * per unit implies a labour content per pair:
 *
 *   impliedSec = operatorsPerUnit x operatorHoursPerYear x 3600 / outputPerUnit
 *
 * If that is far from the stated `labourCycleSec`, one of the two numbers is on
 * the wrong scope — typically a whole-line figure entered per machine.
 */
const checkManning = (
  input: ProjectInput,
  result: ProjectResult,
  side: 'baseline' | 'proposed',
  label: string,
): Issue[] => {
  if (input.labour.basis !== 'headcount') return [];

  const cfg: SideInput = input[side];
  const perUnit = Number(cfg.machine.operatorsPerUnit) || 0;
  const outputPerUnit = result[side].fleet.outputPerUnit.value;
  const operatorHoursPerYear = (Number(input.labour.paidHoursPerMonth) || 0) * 12;
  const stated = Number(cfg.machine.labourCycleSec) || 0;

  if (perUnit <= 0) {
    return [err(
      'MANNING_MISSING',
      `${side}.machine.operatorsPerUnit`,
      `${label}: labour is set to the headcount basis but no operators per unit are recorded.`,
      'Enter operators per unit, or switch the labour basis to cycle time.',
    )];
  }
  if (outputPerUnit <= 0 || operatorHoursPerYear <= 0 || stated <= 0) return [];

  const impliedSec = (perUnit * operatorHoursPerYear * 3600) / outputPerUnit;
  const ratio = impliedSec / stated;

  if (ratio > 1.5 || ratio < 1 / 1.5) {
    return [warn(
      'MANNING_SCOPE_MISMATCH',
      `${side}.machine.operatorsPerUnit`,
      `${label}: ${fmt(perUnit)} operators per unit implies ${fmt(impliedSec, 1)} s/pair of labour, but the recorded labour cycle time is ${fmt(stated, 1)} s/pair — a factor of ${fmt(ratio, 1)}x.`,
      'Check whether the manning figure describes one machine or a whole line. A line-level figure entered per machine is the most common cause and overstates the labour saving.',
    )];
  }
  return [];
};

export const validateProject = (input: ProjectInput): Issue[] => {
  const issues: Issue[] = [];
  const result = calculateProject(input);

  /* ---- demand and calendar ---- */

  if (!(Number(input.demandPairsPerYear) > 0)) {
    issues.push(err(
      'DEMAND_MISSING',
      'demandPairsPerYear',
      'Annual demand is zero, so there is no volume to spread costs over.',
      'Enter the annual applicable demand this proposal must serve.',
    ));
  }

  if (!(Number(input.calendar.daysPerYear) > 0)) {
    issues.push(err('CALENDAR_DAYS', 'calendar.daysPerYear', 'Working days per year is zero.', 'Enter the operating calendar, e.g. 312 for a 6-day week.'));
  }

  const eff = Number(input.calendar.lineEfficiency);
  if (!(eff > 0) || eff > 1) {
    issues.push(err('EFFICIENCY_RANGE', 'calendar.lineEfficiency', `Line efficiency of ${fmt(eff, 4)} is outside 0–1.`, 'Enter performance x quality as a fraction, e.g. 0.9876.'));
  } else if (eff === 1) {
    issues.push(warn(
      'EFFICIENCY_NAMEPLATE',
      'calendar.lineEfficiency',
      'Line efficiency is 100%, so capacity is nameplate rather than realistic.',
      'Take performance x quality from the OEE report. Nameplate capacity understates the fleet needed.',
    ));
  }

  const downtime = Number(input.calendar.downtimeAllowance);
  if (downtime < 0 || downtime >= 1) {
    issues.push(err('DOWNTIME_RANGE', 'calendar.downtimeAllowance', `Downtime allowance of ${fmt(downtime, 4)} is outside 0–1.`, 'Enter unplanned downtime as a fraction of available time.'));
  } else if (downtime === 0) {
    issues.push(warn(
      'DOWNTIME_ZERO',
      'calendar.downtimeAllowance',
      'No unplanned downtime is allowed for, which treats the equipment as never stopping.',
      'Take the allowance from the OEE record. Zero downtime flatters whichever side has no failure history.',
    ));
  }

  /* ---- labour ---- */

  const paidHours = Number(input.labour.paidHoursPerMonth);
  if (!(paidHours > 0)) {
    issues.push(err(
      'LABOUR_HOURS_MISSING',
      'labour.paidHoursPerMonth',
      'Paid hours per operator per month is zero, so no hourly rate can be derived.',
      'Enter paid hours per month, e.g. 208 for a 26-day month at 8 hours.',
    ));
  }
  if (!(Number(input.labour.monthlyWage) > 0)) {
    issues.push(err('LABOUR_WAGE_MISSING', 'labour.monthlyWage', 'Fully-loaded monthly wage is zero.', 'Enter the loaded wage per operator per month.'));
  }
  const conv = Number(input.labour.conversionFactor);
  if (conv < 0 || conv > 1) {
    issues.push(err('LABOUR_CONVERSION_RANGE', 'labour.conversionFactor', `Labour conversion of ${fmt(conv)} is outside 0–1.`, 'Enter the share of the theoretical labour saving actually banked as headcount.'));
  } else if (conv === 1) {
    issues.push(warn(
      'LABOUR_CONVERSION_FULL',
      'labour.conversionFactor',
      'The case banks 100% of the theoretical labour saving.',
      'Headcount rarely falls in fractions. Check the payback still holds at a lower conversion before relying on it.',
    ));
  }

  /* ---- per side ---- */

  for (const [side, label] of SIDES) {
    const cfg = input[side];
    const m = cfg.machine;

    if (!(Number(m.machineCycleSec) > 0)) {
      issues.push(err(`CYCLE_MACHINE_MISSING_${side.toUpperCase()}`, `${side}.machine.machineCycleSec`, `${label}: machine cycle time is zero, so throughput cannot be derived.`, 'Enter seconds of machine occupancy per pair from the time study.'));
    }
    if (!(Number(m.labourCycleSec) > 0)) {
      issues.push(err(`CYCLE_LABOUR_MISSING_${side.toUpperCase()}`, `${side}.machine.labourCycleSec`, `${label}: labour cycle time is zero, so no labour will be charged.`, 'Enter total operator seconds per pair, including work running alongside the machine.'));
    }

    // Labour below machine time means operators finish before the machine does,
    // which is possible but unusual — and is exactly what a copied-across cycle
    // time looks like when only the machine figure was updated.
    if (Number(m.labourCycleSec) > 0 && Number(m.labourCycleSec) < Number(m.machineCycleSec)) {
      issues.push(warn(
        `CYCLE_LABOUR_BELOW_MACHINE_${side.toUpperCase()}`,
        `${side}.machine.labourCycleSec`,
        `${label}: labour cycle time (${fmt(Number(m.labourCycleSec), 1)} s/pair) is below machine cycle time (${fmt(Number(m.machineCycleSec), 1)} s/pair).`,
        'Confirm the operator genuinely leaves the machine unattended. Automatic equipment usually carries more labour than machine time, not less, once nesting and QC are counted.',
      ));
    }

    if (!(Number(cfg.material.consumptionPerPair) > 0)) {
      issues.push(warn(`MATERIAL_CONSUMPTION_${side.toUpperCase()}`, `${side}.material.consumptionPerPair`, `${label}: material consumption per pair is zero.`, 'Enter consumption per pair. Material is usually the largest cost line, so a zero here can hide the whole case.'));
    }
    if (!(Number(cfg.material.pricePerUnit) > 0)) {
      issues.push(warn(`MATERIAL_PRICE_${side.toUpperCase()}`, `${side}.material.pricePerUnit`, `${label}: material price is zero.`, 'Enter the unit price for the material.'));
    }

    if (input.costBasis === 'fullCost' && !(Number(m.depreciationYears) > 0)) {
      issues.push(err(
        `DEPRECIATION_MISSING_${side.toUpperCase()}`,
        `${side}.machine.depreciationYears`,
        `${label}: the full-cost basis charges depreciation, but no depreciation period is set.`,
        'Enter a useful life in years, or switch to the cash basis where capital is recovered through payback instead.',
      ));
    }

    const fleet = result[side].fleet;
    if (cfg.fleet.mode === 'fixed' && fleet.utilisation.value > 1.0001) {
      // A warning rather than an error: the unit costs are still meaningful, and
      // this is the normal state of a project imported from the old model, which
      // had one shared machine count and compared each side at its own capacity.
      // What is compromised is the comparison, so it must be visible — not the
      // arithmetic, so it need not block.
      issues.push(warn(
        `FLEET_UNDERSIZED_${side.toUpperCase()}`,
        `${side}.fleet.units`,
        `${label}: ${fmt(fleet.units.value, 0)} units produce ${fmt(fleet.capacity.value, 0)} pairs against the ${fmt(fleet.grossPairsRequired.value, 0)} required — ${fmt(fleet.utilisation.value * 100, 0)}% of capacity.`,
        'This side cannot actually make the volume it is being costed against, so its fixed costs are spread too thinly and the comparison flatters it. Size the fleet from demand, or reduce demand to what this side can deliver.',
      ));
    }
    if (cfg.fleet.mode === 'fixed' && fleet.utilisation.value > 0 && fleet.utilisation.value < 0.5) {
      issues.push(warn(
        `FLEET_OVERSIZED_${side.toUpperCase()}`,
        `${side}.fleet.units`,
        `${label}: the fleet runs at ${fmt(fleet.utilisation.value * 100, 0)}% utilisation.`,
        'Fixed capital is being spread over less volume than the equipment can carry, which inflates cost per pair. Consider deriving the fleet from demand.',
      ));
    }

    issues.push(...checkManning(input, result, side, label));
  }

  /* ---- comparability ---- */

  const b = input.baseline;
  const p = input.proposed;
  if (
    b.machine.machineCycleSec === p.machine.machineCycleSec &&
    b.machine.labourCycleSec === p.machine.labourCycleSec &&
    b.material.consumptionPerPair === p.material.consumptionPerPair &&
    b.machine.unitPrice === p.machine.unitPrice
  ) {
    issues.push(warn('SIDES_IDENTICAL', 'proposed', 'The two sides are identical, so there is nothing to compare.', 'Enter the proposed equipment’s own cycle times, material consumption and price.'));
  }

  if (b.shift.shiftsPerDay !== p.shift.shiftsPerDay) {
    issues.push(warn(
      'SHIFTS_DIFFER',
      'proposed.shift.shiftsPerDay',
      `The sides run different shift patterns (${b.shift.shiftsPerDay} vs ${p.shift.shiftsPerDay} shifts/day), so this is not a like-for-like machine comparison.`,
      'This is legitimate when it reflects how the lines actually run — it changes how much capital is displaced. State it on the report so a reviewer is not comparing machines alone.',
    ));
  }

  return issues;
};

export const hasBlockingErrors = (issues: Issue[]): boolean =>
  issues.some((i) => i.severity === 'error');
