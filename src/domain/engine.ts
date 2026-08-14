import {
  ProjectInput,
  ProjectResult,
  SideInput,
  SideResult,
  SideSchedule,
  SideFleet,
  CostLine,
  CostKey,
  SavingLine,
  Payback,
  Traced,
  traced,
} from './model';

/* ------------------------------------------------------------------ *
 * Numeric helpers
 * ------------------------------------------------------------------ */

const num = (v: unknown): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

/** Division that yields 0 rather than Infinity/NaN. */
const div = (a: number, b: number): number =>
  b !== 0 && Number.isFinite(a) && Number.isFinite(b) ? a / b : 0;

const fmt = (n: number, d = 2): string =>
  Number.isFinite(n) ? n.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d }) : '0';

const money = (n: number, d = 2): string => `$${fmt(n, d)}`;

/* ------------------------------------------------------------------ *
 * Schedule — available machine time
 * ------------------------------------------------------------------ */

export const computeSchedule = (side: SideInput, calendar: ProjectInput['calendar']): SideSchedule => {
  const shiftsPerDay = num(side.shift.shiftsPerDay);
  const hoursPerShift = num(side.shift.hoursPerShift);
  const hoursPerDay = shiftsPerDay * hoursPerShift;
  const days = num(calendar.daysPerYear);

  const gross = hoursPerDay * days * 3600;
  // Efficiency and the downtime allowance both erode saleable machine time.
  // Applying them here keeps every downstream figure on realistic capacity
  // rather than nameplate.
  const factor = num(calendar.lineEfficiency) * (1 - num(calendar.downtimeAllowance));
  const available = gross * factor;

  return {
    shiftsPerDay,
    hoursPerShift,
    hoursPerDay,
    grossSecondsPerYear: traced(
      gross,
      `${fmt(shiftsPerDay, 0)} shifts x ${fmt(hoursPerShift, 1)} h x ${fmt(days, 0)} days x 3600`,
      'sec/yr',
    ),
    availableSecondsPerYear: traced(
      available,
      `${fmt(gross, 0)} sec x ${fmt(num(calendar.lineEfficiency), 4)} efficiency x (1 - ${fmt(num(calendar.downtimeAllowance), 4)} downtime)`,
      'sec/yr',
    ),
  };
};

/* ------------------------------------------------------------------ *
 * Fleet — how many units this side needs
 * ------------------------------------------------------------------ */

/** Saleable share of produced pairs, clamped to a usable range. */
export const yieldOf = (side: SideInput): number => {
  const y = side.yieldRate == null ? 1 : num(side.yieldRate);
  return Math.min(Math.max(y, 0), 1);
};

export const computeFleet = (
  side: SideInput,
  schedule: SideSchedule,
  demand: number,
): SideFleet => {
  const machineCT = num(side.machine.machineCycleSec);
  const perUnit = div(schedule.availableSecondsPerYear.value, machineCT);

  // The line has to make the scrap too, so it is sized against gross pairs.
  const yieldRate = yieldOf(side);
  const gross = yieldRate > 0 ? div(demand, yieldRate) : 0;

  // Machines are bought whole. Deriving from takt and rounding up is what makes
  // 19 clicker presses and 6 automatic cutters fall out of the same demand.
  const units =
    side.fleet.mode === 'fixed'
      ? Math.max(0, num(side.fleet.units))
      : perUnit > 0
        ? Math.ceil(div(gross, perUnit))
        : 0;

  const capacity = perUnit * units;

  return {
    outputPerUnit: traced(
      perUnit,
      `${fmt(schedule.availableSecondsPerYear.value, 0)} sec/yr / ${fmt(machineCT, 4)} s/pair`,
      'pairs/yr/unit',
    ),
    units: traced(
      units,
      side.fleet.mode === 'fixed'
        ? `configured at ${fmt(units, 0)} units`
        : `ceil(${fmt(gross, 0)} pairs / ${fmt(perUnit, 0)} pairs per unit)`,
      'units',
    ),
    capacity: traced(capacity, `${fmt(perUnit, 0)} pairs/unit x ${fmt(units, 0)} units`, 'pairs/yr'),
    utilisation: traced(div(gross, capacity), `${fmt(gross, 0)} gross pairs / ${fmt(capacity, 0)} capacity`, 'ratio'),
    grossPairsRequired: traced(
      gross,
      yieldRate === 1
        ? `${fmt(demand, 0)} pairs (no scrap allowance)`
        : `${fmt(demand, 0)} good pairs / ${fmt(yieldRate, 4)} yield`,
      'pairs/yr',
    ),
  };
};

/* ------------------------------------------------------------------ *
 * Cost lines for one side
 * ------------------------------------------------------------------ */

const LABELS: Record<CostKey, string> = {
  labour: 'Direct labour',
  material: 'Material',
  consumables: 'Machine consumables',
  maintenance: 'Maintenance parts',
  energy: 'Energy',
  downtime: 'Downtime loss (idle labour)',
  depreciation: 'Depreciation',
};

export const computeSide = (
  side: SideInput,
  input: ProjectInput,
  /** Good pairs delivered. Cost per pair is stated against this. */
  goodVolume: number,
): SideResult => {
  const schedule = computeSchedule(side, input.calendar);
  const fleet = computeFleet(side, schedule, goodVolume);
  const units = fleet.units.value;

  // Work is performed on every pair produced, including those later scrapped.
  const volume = fleet.grossPairsRequired.value;

  const hourlyRate = div(num(input.labour.monthlyWage), num(input.labour.paidHoursPerMonth));
  const operatorHoursPerYear = num(input.labour.paidHoursPerMonth) * 12;

  /* ---- labour ---- */
  let labourAnnual: Traced;
  let operators: Traced;

  if (input.labour.basis === 'cycleTime') {
    // Labour follows the work actually performed on each pair, so it scales with
    // volume rather than with how many machines happen to be installed.
    const ct = num(side.machine.labourCycleSec);
    const hours = div(ct * volume, 3600);
    labourAnnual = traced(
      hours * hourlyRate,
      `${fmt(ct, 4)} s/pair x ${fmt(volume, 0)} pairs / 3600 x ${money(hourlyRate, 4)}/hr`,
      'USD/yr',
    );
    operators = traced(
      div(hours, operatorHoursPerYear),
      `${fmt(hours, 0)} labour hours / ${fmt(operatorHoursPerYear, 0)} paid hours per operator`,
      'operators',
    );
  } else {
    const perUnit = num(side.machine.operatorsPerUnit);
    const headcount = perUnit * units;
    labourAnnual = traced(
      headcount * num(input.labour.monthlyWage) * 12,
      `${fmt(perUnit, 2)} operators/unit x ${fmt(units, 0)} units x ${money(num(input.labour.monthlyWage), 0)}/month x 12`,
      'USD/yr',
    );
    operators = traced(headcount, `${fmt(perUnit, 2)} x ${fmt(units, 0)} units`, 'operators');
  }

  /* ---- material ---- */
  const perPairMaterial = num(side.material.consumptionPerPair) * num(side.material.pricePerUnit);
  const materialAnnual = traced(
    perPairMaterial * volume,
    `${fmt(num(side.material.consumptionPerPair), 5)} ${side.material.unit}/pair x ${money(num(side.material.pricePerUnit), 2)}/${side.material.unit} x ${fmt(volume, 0)} pairs`,
    'USD/yr',
  );

  /* ---- fleet-scaled running costs ---- */
  const consumables = traced(
    num(side.machine.consumablesPerYear) * units,
    `${money(num(side.machine.consumablesPerYear), 2)}/unit/yr x ${fmt(units, 0)} units`,
    'USD/yr',
  );
  const maintenance = traced(
    num(side.machine.maintenancePerYear) * units,
    `${money(num(side.machine.maintenancePerYear), 2)}/unit/yr x ${fmt(units, 0)} units`,
    'USD/yr',
  );
  const energy = traced(
    num(side.machine.powerKW) *
      units *
      div(schedule.availableSecondsPerYear.value, 3600) *
      num(input.energyTariffUSDPerKWh) *
      fleet.utilisation.value,
    `${fmt(num(side.machine.powerKW), 2)} kW x ${fmt(units, 0)} units x ${fmt(div(schedule.availableSecondsPerYear.value, 3600), 0)} h x ${money(num(input.energyTariffUSDPerKWh), 4)}/kWh x ${fmt(fleet.utilisation.value, 3)} utilisation`,
    'USD/yr',
  );
  const downtime = traced(
    num(side.machine.downtimeLossPerYear),
    'recorded downtime loss',
    'USD/yr',
  );

  const capexValue = num(side.machine.unitPrice) * units;
  const capex = traced(
    capexValue,
    `${money(num(side.machine.unitPrice), 0)}/unit x ${fmt(units, 0)} units`,
    'USD',
  );

  const lines: CostLine[] = [
    { key: 'labour', label: LABELS.labour, annual: labourAnnual, perPair: traced(0, '', 'USD/pair') },
    { key: 'material', label: LABELS.material, annual: materialAnnual, perPair: traced(0, '', 'USD/pair') },
    { key: 'consumables', label: LABELS.consumables, annual: consumables, perPair: traced(0, '', 'USD/pair') },
    { key: 'maintenance', label: LABELS.maintenance, annual: maintenance, perPair: traced(0, '', 'USD/pair') },
    { key: 'energy', label: LABELS.energy, annual: energy, perPair: traced(0, '', 'USD/pair') },
    { key: 'downtime', label: LABELS.downtime, annual: downtime, perPair: traced(0, '', 'USD/pair') },
  ];

  // Capital appears in operating cost only on the full-cost basis. On the cash
  // basis it is recovered through payback instead — charging both double-counts
  // the same money.
  if (input.costBasis === 'fullCost') {
    lines.push({
      key: 'depreciation',
      label: LABELS.depreciation,
      annual: traced(
        div(capexValue, num(side.machine.depreciationYears)),
        `${money(capexValue, 0)} / ${fmt(num(side.machine.depreciationYears), 0)} years`,
        'USD/yr',
      ),
      perPair: traced(0, '', 'USD/pair'),
    });
  }

  // Costs are incurred on gross pairs but stated per GOOD pair, so scrap shows
  // up as a higher unit cost rather than disappearing.
  for (const line of lines) {
    line.perPair = traced(
      div(line.annual.value, goodVolume),
      `${money(line.annual.value, 2)} / ${fmt(goodVolume, 0)} good pairs`,
      'USD/pair',
    );
  }

  const total = lines.reduce((s, l) => s + l.annual.value, 0);

  return {
    label: side.label,
    schedule,
    fleet,
    lines,
    totalAnnual: traced(total, lines.map((l) => l.label).join(' + '), 'USD/yr'),
    costPerPair: traced(div(total, goodVolume), `${money(total, 2)} / ${fmt(goodVolume, 0)} good pairs`, 'USD/pair'),
    capex,
    operators,
  };
};

/* ------------------------------------------------------------------ *
 * Whole project
 * ------------------------------------------------------------------ */

export const calculateProject = (input: ProjectInput): ProjectResult => {
  const demand = num(input.demandPairsPerYear);

  // Both sides are costed at the same volume. Comparing each side at its own
  // capacity would reward whichever machine happens to be larger.
  const volume = demand;

  const baseline = computeSide(input.baseline, input, volume);
  const proposed = computeSide(input.proposed, input, volume);

  const keys = baseline.lines.map((l) => l.key);
  const conversion = Math.min(Math.max(num(input.labour.conversionFactor), 0), 1);

  const rawLines = keys.map((key) => {
    const b = baseline.lines.find((l) => l.key === key)!;
    const p = proposed.lines.find((l) => l.key === key)!;
    const raw = b.annual.value - p.annual.value;
    // Only labour is discounted by the conversion factor: material, parts and
    // energy fall out whether or not anyone is redeployed.
    const delta = key === 'labour' ? raw * conversion : raw;
    return { key, label: b.label, baselineAnnual: b.annual.value, proposedAnnual: p.annual.value, raw, delta };
  });

  const totalAnnual = rawLines.reduce((s, l) => s + l.delta, 0);

  const lines: SavingLine[] = rawLines.map((l) => ({
    key: l.key,
    label: l.label,
    baselineAnnual: l.baselineAnnual,
    proposedAnnual: l.proposedAnnual,
    annualDelta: l.delta,
    perPairDelta: div(l.delta, volume),
    share: div(l.delta, totalAnnual),
  }));

  const labourLine = rawLines.find((l) => l.key === 'labour');

  const baselineCapex = baseline.capex.value;
  const proposedCapex = proposed.capex.value;
  const incremental = proposedCapex - baselineCapex;

  let payback: Payback;
  if (totalAnnual <= 0) {
    payback = { kind: 'none', annualLoss: -totalAnnual };
  } else if (incremental <= 0) {
    payback = { kind: 'immediate' };
  } else {
    payback = { kind: 'months', months: incremental / (totalAnnual / 12) };
  }

  const paybackMonths =
    payback.kind === 'months' ? payback.months : payback.kind === 'immediate' ? 0 : null;

  const horizon = Math.max(0, num(input.horizonYears));
  const netBenefit = totalAnnual * horizon - incremental;

  return {
    input,
    baseline,
    proposed,
    savings: {
      lines,
      totalAnnual: traced(totalAnnual, 'sum of cost line variances', 'USD/yr'),
      perPair: traced(div(totalAnnual, volume), `${money(totalAnnual, 2)} / ${fmt(volume, 0)} pairs`, 'USD/pair'),
      labourTheoretical: labourLine ? labourLine.raw : 0,
      labourRealised: labourLine ? labourLine.delta : 0,
    },
    investment: {
      baselineCapex: baseline.capex,
      proposedCapex: proposed.capex,
      incremental: traced(
        incremental,
        `${money(proposedCapex, 0)} proposed - ${money(baselineCapex, 0)} displaced`,
        'USD',
      ),
      basis: input.costBasis,
    },
    payback,
    paybackMonths,
    horizonROI: traced(
      div(totalAnnual * horizon - incremental, incremental),
      `(${money(totalAnnual, 0)} x ${fmt(horizon, 0)} yrs - ${money(incremental, 0)}) / ${money(incremental, 0)}`,
      'ratio',
    ),
    horizonNetBenefit: traced(
      netBenefit,
      `${money(totalAnnual, 0)} x ${fmt(horizon, 0)} yrs - ${money(incremental, 0)}`,
      'USD',
    ),
    basisOutput: traced(volume, 'annual applicable demand', 'pairs/yr'),
  };
};
