import { describe, it, expect } from 'vitest';
import { toStored, loadProject, summarise, isProjectShaped, PROJECT_SCHEMA } from './persist';
import { calculateProject } from './engine';
import { emma21Project, emma21Expected as X } from './fixtures/emma21';
import { newProjectDefaults } from './adapt';
import { ProjectInput } from './model';
import { ROIParams } from '../types';
import { INITIAL_PARAMS } from '../hooks/useAppState';

/** A stored row in the old shape, as `form_data` actually holds it. */
const legacyRow = (): ROIParams => ({
  ...INITIAL_PARAMS,
  equipmentName: 'EMMA 21',
  shoeModel: 'SAMBA OG MULE W',
  brand: 'Adidas',
  machineType: 'Cutting',
  date: '2026-07-30',
  machineQuantity: 5,
  currentPPH: 27.13,
  proposedPPH: 97.29,
  currentManpower: 7.74,
  proposedManpower: 6.77,
  currentUnitPrice: 4579,
  proposedUnitPrice: 57750,
  localLaborCost: 300,
  daysPerYear: 309,
  workingHoursPerDay: 8,
});

describe('shape discrimination', () => {
  it('recognises a project written by the new workspace', () => {
    expect(isProjectShaped(toStored(emma21Project))).toBe(true);
  });

  it('recognises a new-shape project written before the schema marker existed', () => {
    const { _schema: _drop, ...unmarked } = toStored(emma21Project);
    expect(isProjectShaped(unmarked)).toBe(true);
  });

  it('does not mistake a legacy row for one', () => {
    expect(isProjectShaped(legacyRow())).toBe(false);
  });

  it.each([[null], [undefined], [{}], ['not an object'], [42]])(
    'treats %s as neither shape',
    (raw) => expect(isProjectShaped(raw)).toBe(false),
  );
});

describe('round trip', () => {
  /**
   * The point of storing the input rather than the outputs: what reopens is what
   * was entered, so the report is recomputed and cannot drift from the figures
   * that were saved beside it.
   */
  it('returns the project unchanged, marker stripped', () => {
    const { input, wasImported } = loadProject(toStored(emma21Project));
    expect(wasImported).toBe(false);
    expect(input).toEqual(emma21Project);
    expect(input).not.toHaveProperty('_schema');
  });

  it('survives the JSON encoding the column actually applies', () => {
    const raw = JSON.parse(JSON.stringify(toStored(emma21Project)));
    const { input } = loadProject(raw);
    expect(calculateProject(input).paybackMonths).toBeCloseTo(X.paybackMonths, 4);
  });

  it('adapts a legacy row and says that it did', () => {
    const { input, wasImported } = loadProject(legacyRow());
    expect(wasImported).toBe(true);
    // Input fidelity, not output equality — the settings the old model implied.
    expect(input.costBasis).toBe('fullCost');
    expect(input.labour.basis).toBe('headcount');
    expect(input.baseline.fleet).toEqual({ mode: 'fixed', units: 5 });
  });

  it('falls back to a blank project rather than throwing on a corrupt row', () => {
    for (const raw of [null, undefined, {}, 'garbage']) {
      const { input, wasImported } = loadProject(raw);
      expect(wasImported).toBe(false);
      expect(input).toEqual(expect.objectContaining({ demandPairsPerYear: 0 }));
    }
  });
});

describe('the summary columns', () => {
  it('agree with the engine on the reference project', () => {
    const s = summarise(emma21Project);
    const r = calculateProject(emma21Project);

    expect(s.annual_savings).toBeCloseTo(X.netAnnualSaving, 2);
    expect(s.investment_cost).toBeCloseTo(X.capex.incremental, 2);
    expect(s.roi_months).toBeCloseTo(X.paybackMonths, 4);
    expect(s.annual_output).toBeCloseTo(r.basisOutput.value, 6);
    expect(s.fob_impact).toBeCloseTo(X.costPerPair.baseline - X.costPerPair.proposed, 6);
  });

  it('splits the saving into parts that add back up to the total', () => {
    const s = summarise(emma21Project);
    expect(s.labor_saving_cost + s.energy_saving_cost + s.other_savings)
      .toBeCloseTo(s.annual_savings, 6);
  });

  it('carries the input, so the row can be reopened', () => {
    const s = summarise(emma21Project);
    expect(s.form_data._schema).toBe(PROJECT_SCHEMA);
    expect(loadProject(s.form_data).input).toEqual(emma21Project);
  });

  it('stores null rather than a sentinel when the project never pays back', () => {
    const loss: ProjectInput = {
      ...emma21Project,
      // Make the proposal strictly worse: same machine, ten times the price.
      proposed: {
        ...emma21Project.proposed,
        machine: { ...emma21Project.baseline.machine, id: 'proposed', unitPrice: 500_000 },
        material: emma21Project.baseline.material,
      },
    };
    expect(summarise(loss).roi_months).toBeNull();
  });

  it('keeps every column numeric on an empty project', () => {
    const s = summarise(newProjectDefaults());
    for (const [key, v] of Object.entries(s)) {
      if (key === 'form_data' || typeof v === 'string' || v === null) continue;
      expect(Number.isFinite(v), key).toBe(true);
    }
    // No capital at risk is 0%, not a division by zero.
    expect(s.roi_percentage).toBe(0);
  });
});
