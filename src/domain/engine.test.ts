import { describe, it, expect } from 'vitest';
import { calculateProject, computeSchedule, computeFleet } from './engine';
import { emma21Project, emma21ActualShifts, emma21Expected as X } from './fixtures/emma21';
import { ProjectInput } from './model';

const lineOf = (r: ReturnType<typeof calculateProject>, side: 'baseline' | 'proposed', key: string) =>
  r[side].lines.find((l) => l.key === key)!.annual.value;

const withDemand = (p: ProjectInput, demand: number): ProjectInput => ({ ...p, demandPairsPerYear: demand });

/**
 * The IE model as an executable specification.
 *
 * These are not sample numbers. They are the figures the factory's own
 * financial model publishes for a real CAPEX decision. A failure here means the
 * engine has diverged from the reference and its output should not be trusted.
 */
describe('EMMA 21 — reproduces the IE financial model', () => {
  const r = calculateProject(emma21Project);

  it('derives the published available machine-seconds per year', () => {
    expect(r.baseline.schedule.availableSecondsPerYear.value)
      .toBeCloseTo(X.availableSecondsPerMachineYear, 3);
    expect(r.proposed.schedule.availableSecondsPerYear.value)
      .toBeCloseTo(X.availableSecondsPerMachineYear, 3);
  });

  it('sizes both fleets from takt time against demand', () => {
    expect(r.baseline.fleet.units.value).toBe(X.fleet.presses);
    expect(r.proposed.fleet.units.value).toBe(X.fleet.emma);
  });

  it('charges labour from labour cycle time, not machine cycle time', () => {
    expect(lineOf(r, 'baseline', 'labour')).toBeCloseTo(X.labour.baseline, 2);
    expect(lineOf(r, 'proposed', 'labour')).toBeCloseTo(X.labour.proposed, 2);
  });

  it('matches the published material cost', () => {
    expect(lineOf(r, 'baseline', 'material')).toBeCloseTo(X.material.baseline, 2);
    expect(lineOf(r, 'proposed', 'material')).toBeCloseTo(X.material.proposed, 2);
  });

  it('scales consumables and maintenance by each side own fleet', () => {
    expect(lineOf(r, 'baseline', 'consumables')).toBeCloseTo(X.consumables.baseline, 2);
    expect(lineOf(r, 'proposed', 'consumables')).toBeCloseTo(X.consumables.proposed, 2);
    expect(lineOf(r, 'baseline', 'maintenance')).toBeCloseTo(X.maintenance.baseline, 2);
    expect(lineOf(r, 'proposed', 'maintenance')).toBeCloseTo(X.maintenance.proposed, 2);
  });

  it('carries the downtime loss', () => {
    expect(lineOf(r, 'baseline', 'downtime')).toBeCloseTo(X.downtime.baseline, 4);
    expect(lineOf(r, 'proposed', 'downtime')).toBeCloseTo(X.downtime.proposed, 4);
  });

  it('reproduces total annual operating cost and cost per pair', () => {
    expect(r.baseline.totalAnnual.value).toBeCloseTo(X.totalAnnual.baseline, 2);
    expect(r.proposed.totalAnnual.value).toBeCloseTo(X.totalAnnual.proposed, 2);
    expect(r.baseline.costPerPair.value).toBeCloseTo(X.costPerPair.baseline, 6);
    expect(r.proposed.costPerPair.value).toBeCloseTo(X.costPerPair.proposed, 6);
  });

  it('reproduces the capital positions', () => {
    expect(r.investment.baselineCapex.value).toBeCloseTo(X.capex.baseline, 2);
    expect(r.investment.proposedCapex.value).toBeCloseTo(X.capex.proposed, 2);
    expect(r.investment.incremental.value).toBeCloseTo(X.capex.incremental, 2);
  });

  it('reproduces the headline saving, payback and horizon returns', () => {
    expect(r.savings.totalAnnual.value).toBeCloseTo(X.netAnnualSaving, 2);
    expect(r.savings.perPair.value).toBeCloseTo(X.savingPerPair, 6);
    expect(r.payback.kind).toBe('months');
    if (r.payback.kind === 'months') expect(r.payback.months).toBeCloseTo(X.paybackMonths, 6);
    expect(r.horizonROI.value).toBeCloseTo(X.threeYearROI, 6);
    expect(r.horizonNetBenefit.value).toBeCloseTo(X.threeYearNetBenefit, 2);
  });

  it('excludes depreciation on the cash basis — capital is recovered once', () => {
    expect(r.baseline.lines.some((l) => l.key === 'depreciation')).toBe(false);
    expect(r.proposed.lines.some((l) => l.key === 'depreciation')).toBe(false);
  });

  it('identifies material as the dominant driver', () => {
    const material = r.savings.lines.find((l) => l.key === 'material')!;
    expect(material.share).toBeGreaterThan(0.88);
    expect(material.share).toBeLessThan(0.90);
  });

  it('reconciles the saving lines to the headline exactly', () => {
    const summed = r.savings.lines.reduce((s, l) => s + l.annualDelta, 0);
    expect(summed).toBeCloseTo(r.savings.totalAnnual.value, 6);
  });
});

describe('labour conversion sensitivity matches Calc.OpEx §D', () => {
  it.each(X.labourConversion)(
    'conversion $factor gives $months months',
    ({ factor, netSaving, months }) => {
      const r = calculateProject({
        ...emma21Project,
        labour: { ...emma21Project.labour, conversionFactor: factor },
      });
      expect(r.savings.totalAnnual.value).toBeCloseTo(netSaving, 2);
      expect(r.paybackMonths!).toBeCloseTo(months, 5);
    },
  );
});

describe('fleet re-sizes with demand, matching Calc.Capacity §B', () => {
  it.each(X.growth)('demand $demand needs $presses presses and $emma EMMA', ({ demand, presses, emma }) => {
    const r = calculateProject(withDemand(emma21Project, demand));
    expect(r.baseline.fleet.units.value).toBe(presses);
    expect(r.proposed.fleet.units.value).toBe(emma);
  });
});

/**
 * The distinction that caused a 27x labour error in the previous engine: an
 * automatic cutter occupies the machine for 37 s/pair but still carries
 * 116 s/pair of operator work beside it.
 */
describe('labour and machine cycle time are independent', () => {
  it('sizes the fleet on machine time and charges labour on labour time', () => {
    const r = calculateProject(emma21Project);
    // 6 units follows from 37.0 s/pair, not 116.0.
    expect(r.proposed.fleet.units.value).toBe(6);
    // Labour follows 116.0 s/pair, not 37.0.
    const onMachineTime = (37.002071428571426 * 3_403_580) / 3600 * (300 / 208);
    expect(lineOf(r, 'proposed', 'labour')).not.toBeCloseTo(onMachineTime, 0);
    expect(lineOf(r, 'proposed', 'labour')).toBeCloseTo(X.labour.proposed, 2);
  });

  it('leaves labour unchanged when only machine cycle time improves', () => {
    const faster = {
      ...emma21Project,
      proposed: {
        ...emma21Project.proposed,
        machine: { ...emma21Project.proposed.machine, machineCycleSec: 18.5 },
      },
    };
    const r = calculateProject(faster);
    expect(lineOf(r, 'proposed', 'labour')).toBeCloseTo(X.labour.proposed, 2);
    // Twice the throughput per unit, so half the fleet.
    expect(r.proposed.fleet.units.value).toBe(3);
  });
});

describe('the two shift framings', () => {
  it('needs more presses when the baseline runs two shifts', () => {
    const r = calculateProject(emma21ActualShifts);
    expect(r.baseline.fleet.units.value).toBe(28);
    expect(r.proposed.fleet.units.value).toBe(6);
  });

  it('displaces more capital and pays back sooner', () => {
    const r = calculateProject(emma21ActualShifts);
    expect(r.investment.incremental.value).toBeCloseTo(346_500 - 28 * 4579, 2);
    expect(r.paybackMonths!).toBeLessThan(X.paybackMonths);
    expect(r.paybackMonths!).toBeCloseTo(13.02, 1);
  });

  it('leaves volume-driven lines identical across framings', () => {
    const a = calculateProject(emma21ActualShifts);
    const b = calculateProject(emma21Project);
    expect(lineOf(a, 'baseline', 'labour')).toBeCloseTo(lineOf(b, 'baseline', 'labour'), 6);
    expect(lineOf(a, 'baseline', 'material')).toBeCloseTo(lineOf(b, 'baseline', 'material'), 6);
  });
});

describe('cost basis toggle', () => {
  it('adds depreciation and changes the answer on the full-cost basis', () => {
    const r = calculateProject({ ...emma21Project, costBasis: 'fullCost' });
    expect(r.proposed.lines.some((l) => l.key === 'depreciation')).toBe(true);
    // 6 EMMA over 5 years against 19 presses over 1 year.
    expect(lineOf(r, 'proposed', 'depreciation')).toBeCloseTo((6 * 57_750) / 5, 2);
    expect(lineOf(r, 'baseline', 'depreciation')).toBeCloseTo((19 * 4579) / 1, 2);
    expect(r.savings.totalAnnual.value).not.toBeCloseTo(X.netAnnualSaving, 0);
  });
});

describe('labour basis toggle', () => {
  it('produces a different, headcount-shaped answer', () => {
    const r = calculateProject({
      ...emma21Project,
      labour: { ...emma21Project.labour, basis: 'headcount' },
    });
    // 7.7389 operators/unit x 19 units x $3,600.
    expect(lineOf(r, 'baseline', 'labour')).toBeCloseTo(7.738919161676646 * 19 * 3600, 2);
    expect(lineOf(r, 'baseline', 'labour')).not.toBeCloseTo(X.labour.baseline, 0);
  });
});

describe('degenerate inputs stay finite', () => {
  const walk = (v: unknown, path: string): void => {
    if (typeof v === 'number') expect(Number.isFinite(v), `${path} = ${v}`).toBe(true);
    else if (v && typeof v === 'object') for (const [k, c] of Object.entries(v)) walk(c, `${path}.${k}`);
  };

  it.each([
    ['zero demand', withDemand(emma21Project, 0)],
    ['zero cycle time', {
      ...emma21Project,
      proposed: { ...emma21Project.proposed, machine: { ...emma21Project.proposed.machine, machineCycleSec: 0 } },
    }],
    ['zero paid hours', { ...emma21Project, labour: { ...emma21Project.labour, paidHoursPerMonth: 0 } }],
    ['zero efficiency', { ...emma21Project, calendar: { ...emma21Project.calendar, lineEfficiency: 0 } }],
  ] as Array<[string, ProjectInput]>)('%s', (_name, input) => {
    const r = calculateProject(input);
    walk(r.savings, 'savings');
    walk(r.investment, 'investment');
    expect(r.paybackMonths === null || Number.isFinite(r.paybackMonths)).toBe(true);
  });
});

describe('every figure carries its derivation', () => {
  it('labels formula and unit on each cost line', () => {
    const r = calculateProject(emma21Project);
    for (const side of [r.baseline, r.proposed]) {
      for (const line of side.lines) {
        expect(line.annual.formula.length).toBeGreaterThan(0);
        expect(line.annual.unit).toBe('USD/yr');
        expect(line.perPair.unit).toBe('USD/pair');
      }
      expect(side.schedule.availableSecondsPerYear.formula).toContain('efficiency');
      expect(side.fleet.units.formula.length).toBeGreaterThan(0);
    }
  });

  it('shows how the fleet count was reached', () => {
    const r = calculateProject(emma21Project);
    expect(r.baseline.fleet.units.formula).toContain('ceil');
    expect(r.proposed.fleet.outputPerUnit.formula).toContain('/');
  });
});

describe('schedule and fleet helpers are usable on their own', () => {
  it('computes available seconds independently', () => {
    const s = computeSchedule(emma21Project.baseline, emma21Project.calendar);
    expect(s.hoursPerDay).toBe(22.5);
    expect(s.availableSecondsPerYear.value).toBeCloseTo(X.availableSecondsPerMachineYear, 3);
  });

  it('honours a fixed fleet instead of deriving one', () => {
    const s = computeSchedule(emma21Project.proposed, emma21Project.calendar);
    const f = computeFleet(
      { ...emma21Project.proposed, fleet: { mode: 'fixed', units: 4 } },
      s,
      emma21Project.demandPairsPerYear,
    );
    expect(f.units.value).toBe(4);
    expect(f.utilisation.value).toBeGreaterThan(1); // knowingly under-sized
  });
});
