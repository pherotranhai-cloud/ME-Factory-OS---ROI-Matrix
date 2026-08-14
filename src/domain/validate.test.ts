import { describe, it, expect } from 'vitest';
import { validateProject, hasBlockingErrors } from './validate';
import { emma21Project, emma21ActualShifts } from './fixtures/emma21';
import { ProjectInput } from './model';

const codes = (input: ProjectInput) => validateProject(input).map((i) => i.code);
const find = (input: ProjectInput, code: string) => validateProject(input).find((i) => i.code === code);

describe('the reference project validates cleanly', () => {
  it('raises no blocking errors', () => {
    const issues = validateProject(emma21Project);
    expect(issues.filter((i) => i.severity === 'error')).toEqual([]);
    expect(hasBlockingErrors(issues)).toBe(false);
  });

  it('still warns that it banks the full labour saving', () => {
    expect(codes(emma21Project)).toContain('LABOUR_CONVERSION_FULL');
  });

  it('flags the asymmetric shift framing rather than silently allowing it', () => {
    expect(codes(emma21ActualShifts)).toContain('SHIFTS_DIFFER');
    expect(codes(emma21Project)).not.toContain('SHIFTS_DIFFER');
  });
});

/**
 * The rule that matters most: line-level manning entered against machine-level
 * throughput. This is what overstated a labour saving by 27x.
 */
describe('manning scope mismatch (the 27x trap)', () => {
  const headcount = (operatorsPerUnit: number): ProjectInput => ({
    ...emma21Project,
    labour: { ...emma21Project.labour, basis: 'headcount' },
    baseline: {
      ...emma21Project.baseline,
      machine: { ...emma21Project.baseline.machine, operatorsPerUnit },
    },
  });

  it('catches a whole-line figure entered per machine', () => {
    // 7.74 operators describes a 210 pairs/hr line, not one 27 pairs/hr press.
    const issue = find(headcount(7.738919161676646), 'MANNING_SCOPE_MISMATCH');
    expect(issue).toBeDefined();
    expect(issue!.message).toMatch(/implies .* s\/pair of labour/);
    expect(issue!.remedy).toMatch(/one machine or a whole line/);
  });

  it('accepts manning that agrees with the recorded cycle time', () => {
    // One operator per press, grossed up for shift coverage.
    const consistent = (132.66718562874252 * 183_924.6) / (208 * 12 * 3600);
    expect(find(headcount(consistent), 'MANNING_SCOPE_MISMATCH')).toBeUndefined();
  });

  it('errors when the headcount basis has no manning at all', () => {
    expect(codes(headcount(0))).toContain('MANNING_MISSING');
  });

  it('does not apply on the cycle-time basis', () => {
    expect(codes(emma21Project)).not.toContain('MANNING_SCOPE_MISMATCH');
  });
});

describe('cycle time rules', () => {
  it('warns when labour time is below machine time', () => {
    const issue = find({
      ...emma21Project,
      proposed: {
        ...emma21Project.proposed,
        machine: { ...emma21Project.proposed.machine, labourCycleSec: 10 },
      },
    }, 'CYCLE_LABOUR_BELOW_MACHINE_PROPOSED');
    expect(issue).toBeDefined();
    expect(issue!.remedy).toMatch(/nesting and QC/);
  });

  it('errors on a zero machine cycle time', () => {
    expect(codes({
      ...emma21Project,
      proposed: {
        ...emma21Project.proposed,
        machine: { ...emma21Project.proposed.machine, machineCycleSec: 0 },
      },
    })).toContain('CYCLE_MACHINE_MISSING_PROPOSED');
  });

  it('errors on a zero labour cycle time', () => {
    expect(codes({
      ...emma21Project,
      baseline: {
        ...emma21Project.baseline,
        machine: { ...emma21Project.baseline.machine, labourCycleSec: 0 },
      },
    })).toContain('CYCLE_LABOUR_MISSING_BASELINE');
  });
});

describe('capacity rules', () => {
  it('errors when a fixed fleet cannot meet demand', () => {
    const issue = find({
      ...emma21Project,
      proposed: { ...emma21Project.proposed, fleet: { mode: 'fixed', units: 2 } },
    }, 'FLEET_UNDERSIZED_PROPOSED');
    expect(issue).toBeDefined();
    expect(issue!.severity).toBe('error');
    expect(issue!.message).toMatch(/% of capacity/);
  });

  it('warns when a fixed fleet is heavily under-used', () => {
    expect(codes({
      ...emma21Project,
      proposed: { ...emma21Project.proposed, fleet: { mode: 'fixed', units: 40 } },
    })).toContain('FLEET_OVERSIZED_PROPOSED');
  });

  it('says nothing about fleet size when it is derived from demand', () => {
    const c = codes(emma21Project);
    expect(c).not.toContain('FLEET_UNDERSIZED_PROPOSED');
    expect(c).not.toContain('FLEET_OVERSIZED_PROPOSED');
  });
});

describe('calendar and efficiency rules', () => {
  it('warns when efficiency is nameplate', () => {
    expect(codes({
      ...emma21Project,
      calendar: { ...emma21Project.calendar, lineEfficiency: 1 },
    })).toContain('EFFICIENCY_NAMEPLATE');
  });

  it('errors when efficiency is out of range', () => {
    expect(codes({
      ...emma21Project,
      calendar: { ...emma21Project.calendar, lineEfficiency: 1.4 },
    })).toContain('EFFICIENCY_RANGE');
  });

  it('warns when no downtime is allowed for', () => {
    expect(codes({
      ...emma21Project,
      calendar: { ...emma21Project.calendar, downtimeAllowance: 0 },
    })).toContain('DOWNTIME_ZERO');
  });

  it('errors on zero demand and zero working days', () => {
    expect(codes({ ...emma21Project, demandPairsPerYear: 0 })).toContain('DEMAND_MISSING');
    expect(codes({
      ...emma21Project,
      calendar: { ...emma21Project.calendar, daysPerYear: 0 },
    })).toContain('CALENDAR_DAYS');
  });
});

describe('labour and basis rules', () => {
  it('errors without paid hours, since no hourly rate can be derived', () => {
    expect(codes({
      ...emma21Project,
      labour: { ...emma21Project.labour, paidHoursPerMonth: 0 },
    })).toContain('LABOUR_HOURS_MISSING');
  });

  it('errors on a depreciation period of zero under the full-cost basis', () => {
    const c = codes({
      ...emma21Project,
      costBasis: 'fullCost',
      proposed: {
        ...emma21Project.proposed,
        machine: { ...emma21Project.proposed.machine, depreciationYears: 0 },
      },
    });
    expect(c).toContain('DEPRECIATION_MISSING_PROPOSED');
  });

  it('says nothing about depreciation on the cash basis', () => {
    expect(codes(emma21Project)).not.toContain('DEPRECIATION_MISSING_PROPOSED');
  });

  it('errors on an out-of-range conversion factor', () => {
    expect(codes({
      ...emma21Project,
      labour: { ...emma21Project.labour, conversionFactor: 1.5 },
    })).toContain('LABOUR_CONVERSION_RANGE');
  });
});

describe('comparability', () => {
  it('warns when both sides are the same equipment', () => {
    expect(codes({ ...emma21Project, proposed: { ...emma21Project.baseline, label: 'Proposed' } }))
      .toContain('SIDES_IDENTICAL');
  });
});

describe('issues are actionable', () => {
  it('every issue names a field, a cause and a remedy', () => {
    const inputs: ProjectInput[] = [
      emma21Project,
      { ...emma21Project, demandPairsPerYear: 0 },
      { ...emma21Project, labour: { ...emma21Project.labour, basis: 'headcount' } },
      { ...emma21Project, costBasis: 'fullCost' },
      { ...emma21Project, proposed: { ...emma21Project.proposed, fleet: { mode: 'fixed', units: 1 } } },
    ];
    for (const input of inputs) {
      for (const issue of validateProject(input)) {
        expect(issue.field.length, issue.code).toBeGreaterThan(0);
        expect(issue.message.length, issue.code).toBeGreaterThan(20);
        expect(issue.remedy.length, issue.code).toBeGreaterThan(20);
        expect(['error', 'warning']).toContain(issue.severity);
      }
    }
  });
});
