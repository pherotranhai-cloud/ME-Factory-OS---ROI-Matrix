import { describe, it, expect } from 'vitest';
import {
  labourConversionTable, materialYieldTable, demandGrowthTable,
  allScenarios, dominantScenario, materialBreakEven,
} from './scenarios';
import { emma21Project, emma21Expected as X } from './fixtures/emma21';

describe('labour conversion table matches the IE model', () => {
  const t = labourConversionTable(emma21Project);

  it('reproduces every published row', () => {
    for (const expected of X.labourConversion) {
      const row = t.rows.find((r) => r.label === `${Math.round(expected.factor * 100)}%`)!;
      expect(row.annualSaving).toBeCloseTo(expected.netSaving, 2);
      expect(row.paybackMonths!).toBeCloseTo(expected.months, 5);
    }
  });

  it('marks the row matching the project as entered', () => {
    expect(t.rows.filter((r) => r.isBase)).toHaveLength(1);
    expect(t.rows.find((r) => r.isBase)!.label).toBe('100%');
  });
});

describe('demand growth table matches the IE model', () => {
  const t = demandGrowthTable(emma21Project);

  it('re-sizes the fleet at each volume', () => {
    for (const expected of X.growth) {
      const label = expected.growth === 0 ? 'Current' : `+${Math.round(expected.growth * 100)}%`;
      const row = t.rows.find((r) => r.label === label)!;
      expect(row.fleet).toEqual({ baseline: expected.presses, proposed: expected.emma });
    }
  });
});

describe('material yield table', () => {
  const t = materialYieldTable(emma21Project);

  it('reproduces the headline at the measured gain', () => {
    const base = t.rows.find((r) => r.isBase)!;
    expect(base.annualSaving).toBeCloseTo(X.netAnnualSaving, 2);
    expect(base.paybackMonths!).toBeCloseTo(X.paybackMonths, 5);
  });

  it('removes most of the case when the gain disappears', () => {
    const none = t.rows.find((r) => r.label === 'No gain')!;
    // Material carries ~89% of the saving.
    expect(none.annualSaving).toBeLessThan(X.netAnnualSaving * 0.15);
    expect(none.paybackMonths!).toBeGreaterThan(X.paybackMonths * 5);
  });

  it('improves monotonically with the gain', () => {
    const savings = t.rows.map((r) => r.annualSaving);
    for (let i = 1; i < savings.length; i += 1) expect(savings[i]).toBeGreaterThan(savings[i - 1]);
  });
});

describe('dominant driver', () => {
  it('identifies material for this project', () => {
    expect(dominantScenario(allScenarios(emma21Project))!.key).toBe('materialYield');
  });
});

describe('material break-even', () => {
  it('finds the gain needed to hit a 24-month hurdle', () => {
    const be = materialBreakEven(emma21Project, 24)!;
    expect(be).not.toBeNull();
    // The IE model publishes 0.0167 FT2/pair against a measured 0.0272.
    expect(be.gain).toBeCloseTo(0.0167, 3);
    expect(be.share).toBeGreaterThan(0.55);
    expect(be.share).toBeLessThan(0.65);
  });

  it('returns null when even a large gain cannot reach the hurdle', () => {
    expect(materialBreakEven(emma21Project, 0.5)).toBeNull();
  });
});

describe('scenarios never emit non-finite figures', () => {
  it('holds across every table', () => {
    for (const t of allScenarios(emma21Project)) {
      for (const r of t.rows) {
        expect(Number.isFinite(r.annualSaving)).toBe(true);
        expect(r.paybackMonths === null || Number.isFinite(r.paybackMonths)).toBe(true);
        expect(Number.isFinite(r.horizonROI)).toBe(true);
      }
    }
  });
});
