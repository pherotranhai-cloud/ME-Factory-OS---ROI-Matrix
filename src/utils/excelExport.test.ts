import { describe, it, expect } from 'vitest';
import ExcelJS from 'exceljs';
import JSZip from 'jszip';
import { buildWorkbook } from './excelExport';
import { calculateAdvancedROI } from './roi-calculations';
import { ROIParams, MaterialItem } from '../types';

const material = (over: Partial<MaterialItem> = {}): MaterialItem => ({
  id: 'm1', type: 'Upper', description: 'Mesh', supplier: 'S', uom: 'pr',
  usage: 1, loss: 0, fob: 1, ...over,
});

const baseParams = (over: Partial<ROIParams> = {}): ROIParams => ({
  shoeModel: 'REF-1', date: '2026-01-01', equipmentName: 'Reference Cell',
  machineType: 'Automation', brand: 'ACME', scopeOfWork: 'Replace manual station',
  machineQuantity: 2,
  currentPowerSupplyV: '380', proposedPowerSupplyV: '380',
  currentPowerConsumptionKW: 2, proposedPowerConsumptionKW: 3,
  currentSpeedSPrs: 0, proposedSpeedSPrs: 0,
  currentUnitPrice: 10_000, proposedUnitPrice: 60_000,
  currentMaintenanceCostPerYear: 500, proposedMaintenanceCostPerYear: 1_000,
  currentConsumablesCostPerYear: 200, proposedConsumablesCostPerYear: 300,
  currentDepreciationYears: 5, proposedDepreciationYears: 5,
  currentCT: 60, proposedCT: 30, currentPPH: 60, proposedPPH: 120,
  currentManpower: 2, proposedManpower: 1,
  currentRFT: 95, proposedRFT: 98, currentDefectRate: 5, proposedDefectRate: 2,
  currentMaterials: [material({ fob: 2 })],
  proposedMaterials: [material({ fob: 1.8 })],
  workingHoursPerDay: 8, localLaborCost: 300,
  ...over,
});

/** Round-trip through a real .xlsx buffer, exactly as a reader would see it. */
const roundTrip = async (params: ROIParams, options = {}) => {
  const results = calculateAdvancedROI(params);
  const wb = await buildWorkbook(params, results, options);
  const buffer = await wb.xlsx.writeBuffer();
  const reloaded = new ExcelJS.Workbook();
  await reloaded.xlsx.load(buffer as ArrayBuffer);
  return { results, workbook: reloaded };
};

/** The .xlsx as a zip, so tests can inspect what a reader actually receives. */
const zipOf = async (params: ROIParams, options = {}) => {
  const results = calculateAdvancedROI(params);
  const wb = await buildWorkbook(params, results, options);
  const buffer = await wb.xlsx.writeBuffer();
  return JSZip.loadAsync(buffer as ArrayBuffer);
};

const sheetXml = async (params: ROIParams, path: string): Promise<string> => {
  const zip = await zipOf(params);
  const file = zip.file(path);
  expect(file, `${path} exists in the workbook`).not.toBeNull();
  return file!.async('string');
};

type FormulaCell = { address: string; sheet: string; formula: string; result: unknown };

const collectFormulas = (wb: ExcelJS.Workbook): FormulaCell[] => {
  const out: FormulaCell[] = [];
  wb.eachSheet((sheet) => {
    sheet.eachRow((row) => {
      row.eachCell((cell) => {
        const v = cell.value as { formula?: string; result?: unknown } | null;
        if (v && typeof v === 'object' && typeof v.formula === 'string') {
          out.push({ address: cell.address, sheet: sheet.name, formula: v.formula, result: v.result });
        }
      });
    });
  });
  return out;
};

describe('workbook structure', () => {
  it('contains every expected sheet', async () => {
    const { workbook } = await roundTrip(baseParams());
    const names = workbook.worksheets.map((w) => w.name);
    expect(names).toEqual(
      expect.arrayContaining(['Inputs', 'Overview', 'Calculations', 'Financials', 'Savings Breakdown', 'Assumptions']),
    );
  });

  it('adds an AI Evaluation sheet only when an evaluation is supplied', async () => {
    const without = await roundTrip(baseParams());
    expect(without.workbook.getWorksheet('AI Evaluation')).toBeUndefined();

    const withAI = await roundTrip(baseParams(), {
      aiEvaluation: { verdict: 'Proceed with Caution', summary: 'Tight payback.', pros: ['Fewer operators'], cons: ['High maintenance'], risks: ['OEE unproven'] },
    });
    const sheet = withAI.workbook.getWorksheet('AI Evaluation');
    expect(sheet).toBeDefined();
    expect(sheet!.rowCount).toBeGreaterThan(3);
  });
});

/**
 * P3-02 — the core export defect. ExcelJS emits `<f>` with no `<v>` unless a
 * result is supplied. Desktop Excel recalculates and hides it; Sheets,
 * LibreOffice, Numbers and openpyxl show blank or zero.
 */
describe('formula durability (P3-02)', () => {
  it('caches a result on every single formula cell', async () => {
    const { workbook } = await roundTrip(baseParams());
    const formulas = collectFormulas(workbook);
    expect(formulas.length).toBeGreaterThan(20);

    const missing = formulas.filter((f) => f.result === undefined || f.result === null);
    expect(missing.map((m) => `${m.sheet}!${m.address} = ${m.formula}`)).toEqual([]);
  });

  /**
   * Asserted against the emitted XML rather than a reloaded workbook: ExcelJS's
   * reader does not parse `calcPr` back onto `calcProperties`, so a round-trip
   * check would fail even though the file is correct. What matters is what a
   * spreadsheet application actually reads.
   */
  it('writes fullCalcOnLoad into the workbook XML', async () => {
    const xml = await sheetXml(baseParams(), 'xl/workbook.xml');
    expect(xml).toMatch(/<calcPr[^>]*fullCalcOnLoad="1"/);
  });

  it('emits no bare <f> without a cached <v> anywhere in the workbook', async () => {
    const zip = await zipOf(baseParams());
    const sheets = Object.keys(zip.files).filter((n) => /^xl\/worksheets\/sheet\d+\.xml$/.test(n));
    expect(sheets.length).toBeGreaterThan(0);

    for (const name of sheets) {
      const xml = await zip.file(name)!.async('string');
      // Every </f> must be immediately followed by <v>. This is the exact defect
      // that made formulas read as blank in Sheets/LibreOffice/openpyxl.
      const bare = xml.match(/<\/f>(?!<v>)/g) ?? [];
      expect(bare, `${name} has ${bare.length} formula(s) with no cached value`).toEqual([]);
    }
  });

  it('caches values that agree with the engine', async () => {
    const { workbook, results } = await roundTrip(baseParams());
    const fin = workbook.getWorksheet('Financials')!;

    const rowFor = (label: string) => {
      let found: ExcelJS.Row | undefined;
      fin.eachRow((row) => {
        if (String(row.getCell(1).value ?? '').trim() === label) found = row;
      });
      return found;
    };

    const cached = (label: string, col: number) => {
      const row = rowFor(label);
      expect(row, `row "${label}" exists`).toBeDefined();
      const v = row!.getCell(col).value as { result?: number };
      return typeof v === 'object' && v ? v.result : (v as unknown as number);
    };

    expect(cached('Annual Labour Cost', 2)).toBeCloseTo(results.current.annualLaborCost, 6);
    expect(cached('Annual Labour Cost', 3)).toBeCloseTo(results.proposed.annualLaborCost, 6);
    expect(cached('Annual Maintenance', 2)).toBeCloseTo(results.current.annualMaintenance, 6);
    expect(cached('Total Cost / Pair (FOB)', 2)).toBeCloseTo(results.current.costPerPair, 8);
    expect(cached('Total Cost / Pair (FOB)', 3)).toBeCloseTo(results.proposed.costPerPair, 8);
    expect(cached('Total Annual Saving', 2)).toBeCloseTo(results.savings.totalAnnualSaving, 6);
  });

  it('scales maintenance and consumables by quantity, matching the app (P3-04)', async () => {
    const params = baseParams({ machineQuantity: 3 });
    const { workbook, results } = await roundTrip(params);
    const fin = workbook.getWorksheet('Financials')!;

    let maintRow: ExcelJS.Row | undefined;
    fin.eachRow((row) => {
      if (String(row.getCell(1).value ?? '') === 'Annual Maintenance') maintRow = row;
    });

    const cached = (maintRow!.getCell(2).value as { result: number }).result;
    // 500/machine x 3 machines. The old export wrote the bare 500.
    expect(cached).toBeCloseTo(1_500, 6);
    expect(cached).toBeCloseTo(results.current.annualMaintenance, 6);
  });
});

/**
 * P3-03 — capturing the start row before writing any rows produced
 * `SUM(H13:H12)`, which makes Excel raise a file-repair prompt on open.
 */
describe('no malformed ranges (P3-03)', () => {
  const isReversed = (formula: string): boolean => {
    const m = formula.match(/SUM\(([A-Z]+)(\d+):([A-Z]+)(\d+)\)/);
    return m ? Number(m[2]) > Number(m[4]) : false;
  };

  it('emits no reversed SUM ranges for a populated project', async () => {
    const { workbook } = await roundTrip(baseParams());
    const bad = collectFormulas(workbook).filter((f) => isReversed(f.formula));
    expect(bad).toEqual([]);
  });

  it('emits no reversed SUM ranges when both material tables are empty', async () => {
    const { workbook } = await roundTrip(baseParams({ currentMaterials: [], proposedMaterials: [] }));
    const bad = collectFormulas(workbook).filter((f) => isReversed(f.formula));
    expect(bad).toEqual([]);
  });

  it('still reports a zero material total when the table is empty', async () => {
    const { workbook } = await roundTrip(baseParams({ currentMaterials: [], proposedMaterials: [] }));
    const calc = workbook.getWorksheet('Calculations')!;
    let totals = 0;
    calc.eachRow((row) => {
      if (String(row.getCell(7).value ?? '') === 'Total Cost / Pair') totals += 1;
    });
    expect(totals).toBe(2);
  });
});

describe('payback is readable, never #DIV/0! (P3-05)', () => {
  it('guards the payback formula against a zero saving', async () => {
    const { workbook } = await roundTrip(baseParams());
    const formulas = collectFormulas(workbook);
    const payback = formulas.find((f) => f.formula.includes('No payback'));
    expect(payback).toBeDefined();
    expect(payback!.formula).toContain('IFERROR');
  });

  it('caches a words result for a loss-making project', async () => {
    const params = baseParams({ proposedPPH: 60, proposedManpower: 2, proposedMaintenanceCostPerYear: 99_999 });
    const { workbook, results } = await roundTrip(params);
    expect(results.payback.kind).toBe('none');

    const payback = collectFormulas(workbook).find((f) => f.formula.includes('No payback'));
    expect(payback!.result).toBe('No payback');
  });

  it('guards depreciation against a zero period', async () => {
    const { workbook } = await roundTrip(baseParams({ currentDepreciationYears: 0, proposedDepreciationYears: 0 }));
    const deprec = collectFormulas(workbook).filter((f) => f.formula.includes('IFERROR') && f.formula.includes('*'));
    expect(deprec.length).toBeGreaterThan(0);
    const bad = collectFormulas(workbook).filter((f) => typeof f.result === 'number' && !Number.isFinite(f.result));
    expect(bad).toEqual([]);
  });
});

describe('images are embedded (P3-01)', () => {
  // 1x1 transparent PNG.
  const PNG =
    'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';

  it('adds a Photos sheet and embeds the image when one is supplied', async () => {
    const { workbook } = await roundTrip(baseParams(), { images: [PNG] });
    expect(workbook.getWorksheet('Photos')).toBeDefined();
    expect(workbook.model.media.length).toBeGreaterThan(0);
  });

  it('embeds multiple images', async () => {
    const { workbook } = await roundTrip(baseParams(), { images: [PNG, PNG] });
    expect(workbook.model.media.length).toBe(2);
  });

  it('omits the Photos sheet when there are no images', async () => {
    const { workbook } = await roundTrip(baseParams());
    expect(workbook.getWorksheet('Photos')).toBeUndefined();
  });

  it('survives an unreachable image URL without failing the export', async () => {
    const { workbook } = await roundTrip(baseParams(), { images: ['https://example.invalid/missing.png'] });
    // Sheet is still created; the broken image is simply skipped.
    expect(workbook.getWorksheet('Photos')).toBeDefined();
  });
});

describe('project shapes', () => {
  const shapes: Array<[string, ROIParams]> = [
    ['fully populated', baseParams()],
    ['empty materials', baseParams({ currentMaterials: [], proposedMaterials: [] })],
    ['zero savings', baseParams({ proposedPPH: 60, proposedManpower: 2, proposedPowerConsumptionKW: 2, proposedMaintenanceCostPerYear: 500, proposedConsumablesCostPerYear: 200, proposedDefectRate: 5, proposedMaterials: [material({ fob: 2 })] })],
    ['zero throughput', baseParams({ currentPPH: 0, proposedPPH: 0 })],
  ];

  it.each(shapes)('builds a readable workbook for a %s project', async (_name, params) => {
    const { workbook } = await roundTrip(params);
    expect(workbook.worksheets.length).toBeGreaterThanOrEqual(6);

    const nonFinite = collectFormulas(workbook).filter(
      (f) => typeof f.result === 'number' && !Number.isFinite(f.result),
    );
    expect(nonFinite).toEqual([]);
  });
});
