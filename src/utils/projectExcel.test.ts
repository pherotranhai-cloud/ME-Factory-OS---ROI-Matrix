import { describe, it, expect } from 'vitest';
import ExcelJS from 'exceljs';
import JSZip from 'jszip';
import { buildProjectWorkbook } from './projectExcel';
import { calculateProject } from '../domain/engine';
import { emma21Project, emma21Expected as X } from '../domain/fixtures/emma21';
import { newProjectDefaults } from '../domain/adapt';
import { type ProjectInput } from '../domain/model';

const roundTrip = async (input: ProjectInput, options = {}) => {
  const wb = await buildProjectWorkbook(input, options);
  const buffer = await wb.xlsx.writeBuffer();
  const reloaded = new ExcelJS.Workbook();
  await reloaded.xlsx.load(buffer as ArrayBuffer);
  return { workbook: reloaded, result: calculateProject(input) };
};

const zipOf = async (input: ProjectInput) => {
  const wb = await buildProjectWorkbook(input);
  return JSZip.loadAsync((await wb.xlsx.writeBuffer()) as ArrayBuffer);
};

const rowByLabel = (sheet: ExcelJS.Worksheet, label: string): ExcelJS.Row | undefined => {
  let found: ExcelJS.Row | undefined;
  sheet.eachRow((row) => {
    if (String(row.getCell(1).value ?? '').trim() === label) found = row;
  });
  return found;
};

const cached = (sheet: ExcelJS.Worksheet, label: string, col: number): number | string | undefined => {
  const row = rowByLabel(sheet, label);
  if (!row) return undefined;
  const v = row.getCell(col).value as { result?: number | string } | number | string | null;
  if (v && typeof v === 'object' && 'result' in v) return v.result;
  return v as number | string;
};

describe('workbook structure', () => {
  it('carries every sheet the analysis needs', async () => {
    const { workbook } = await roundTrip(emma21Project);
    expect(workbook.worksheets.map((w) => w.name)).toEqual(
      expect.arrayContaining(['Inputs', 'Report', 'Derivation', 'Scenarios', 'Validation', 'Assumptions']),
    );
  });

  it('omits the Photos sheet when there are no images', async () => {
    const { workbook } = await roundTrip(emma21Project);
    expect(workbook.getWorksheet('Photos')).toBeUndefined();
  });

  it('embeds supplied images', async () => {
    const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';
    const { workbook } = await roundTrip(emma21Project, { images: [PNG] });
    expect(workbook.getWorksheet('Photos')).toBeDefined();
    expect(workbook.model.media.length).toBeGreaterThan(0);
  });
});

/**
 * The report and the workbook must be two renderings of one calculation. These
 * assert the cached values against the engine directly.
 */
describe('the workbook agrees with the engine', () => {
  it('reproduces the IE headline figures', async () => {
    const { workbook } = await roundTrip(emma21Project);
    const r = workbook.getWorksheet('Report')!;

    expect(cached(r, 'Direct labour', 2)).toBeCloseTo(X.labour.baseline, 2);
    expect(cached(r, 'Direct labour', 3)).toBeCloseTo(X.labour.proposed, 2);
    expect(cached(r, 'Material', 2)).toBeCloseTo(X.material.baseline, 2);
    expect(cached(r, 'Total annual operating cost', 2)).toBeCloseTo(X.totalAnnual.baseline, 2);
    expect(cached(r, 'Total annual operating cost', 3)).toBeCloseTo(X.totalAnnual.proposed, 2);
    expect(cached(r, 'Cost per good pair', 2)).toBeCloseTo(X.costPerPair.baseline, 6);
    expect(cached(r, 'Net annual saving', 2)).toBeCloseTo(X.netAnnualSaving, 2);
    expect(cached(r, 'Incremental capital', 2)).toBeCloseTo(X.capex.incremental, 2);
    expect(cached(r, 'Payback (months)', 2)).toBeCloseTo(X.paybackMonths, 4);
    expect(cached(r, '3-year net benefit', 2)).toBeCloseTo(X.threeYearNetBenefit, 2);
  });

  it('reproduces the derived fleet counts', async () => {
    const { workbook } = await roundTrip(emma21Project);
    const r = workbook.getWorksheet('Report')!;
    expect(cached(r, 'Units required', 2)).toBe(X.fleet.presses);
    expect(cached(r, 'Units required', 3)).toBe(X.fleet.emma);
  });
});

/**
 * P3-02 in the new exporter: a formula with no cached value reads as blank in
 * Google Sheets, LibreOffice, Numbers and openpyxl, however correct it looks in
 * desktop Excel.
 */
describe('formula durability', () => {
  /**
   * Asserted against the emitted XML, not a reloaded workbook. ExcelJS's reader
   * drops a cached result of exactly 0, so a round-trip check reports false
   * failures on any zero-valued line — energy here, and downtime on a side with
   * no record. What matters is what a spreadsheet application actually receives.
   */
  it('emits no bare formula in the XML and requests a full recalculation', async () => {
    const zip = await zipOf(emma21Project);
    const wbXml = await zip.file('xl/workbook.xml')!.async('string');
    expect(wbXml).toMatch(/<calcPr[^>]*fullCalcOnLoad="1"/);

    for (const name of Object.keys(zip.files).filter((n) => /^xl\/worksheets\/sheet\d+\.xml$/.test(n))) {
      const xml = await zip.file(name)!.async('string');
      expect(xml.match(/<\/f>(?!<v>)/g) ?? [], `${name}`).toEqual([]);
    }
  });

  it('never caches a non-finite number', async () => {
    const { workbook } = await roundTrip(newProjectDefaults());
    workbook.eachSheet((sheet) => {
      sheet.eachRow((row) => {
        row.eachCell((cell) => {
          const v = cell.value as { result?: unknown } | null;
          if (v && typeof v === 'object' && typeof v.result === 'number') {
            expect(Number.isFinite(v.result), `${sheet.name}!${cell.address}`).toBe(true);
          }
        });
      });
    });
  });
});

/**
 * The workbook is meant to be a live model, not a snapshot: the figures must be
 * formulas referencing the Inputs sheet, so flexing an assumption recalculates.
 */
describe('the workbook is a live model', () => {
  it('drives cost lines off the Inputs sheet rather than pasting numbers', async () => {
    const { workbook } = await roundTrip(emma21Project);
    const r = workbook.getWorksheet('Report')!;
    for (const label of ['Direct labour', 'Material', 'Machine consumables', 'Maintenance parts']) {
      const cell = rowByLabel(r, label)!.getCell(2).value as { formula?: string };
      expect(typeof cell.formula, label).toBe('string');
      expect(cell.formula, label).toContain('Inputs!');
    }
  });

  it('derives capacity from the shift pattern and efficiency', async () => {
    const { workbook } = await roundTrip(emma21Project);
    const f = (rowByLabel(workbook.getWorksheet('Report')!, 'Available seconds / unit / yr')!
      .getCell(2).value as { formula: string }).formula;
    expect(f).toContain('3600');
    expect(f).toMatch(/\(1-Inputs!/); // downtime allowance
  });

  it('discounts only labour by the conversion factor', async () => {
    const { workbook } = await roundTrip(emma21Project);
    const s = workbook.getWorksheet('Report')!;
    let labourSaving: string | undefined;
    let materialSaving: string | undefined;
    let seenHeader = false;
    s.eachRow((row) => {
      const label = String(row.getCell(1).value ?? '');
      if (label === 'Saving by line') seenHeader = true;
      if (!seenHeader) return;
      const v = row.getCell(2).value as { formula?: string };
      if (label === 'Direct labour — saving' && v?.formula) labourSaving = v.formula;
      if (label === 'Material — saving' && v?.formula) materialSaving = v.formula;
    });
    expect(labourSaving).toContain('Inputs!'); // multiplied by the conversion cell
    expect(materialSaving).not.toMatch(/\)\*Inputs!\$B\$\d+$/);
  });

  it('guards payback against a zero saving', async () => {
    const { workbook } = await roundTrip(emma21Project);
    const f = (rowByLabel(workbook.getWorksheet('Report')!, 'Payback (months)')!
      .getCell(2).value as { formula: string }).formula;
    expect(f).toContain('No payback');
    expect(f).toContain('IFERROR');
  });
});

describe('the workbook explains itself', () => {
  it('carries the derivation of every figure', async () => {
    const { workbook, result } = await roundTrip(emma21Project);
    const d = workbook.getWorksheet('Derivation')!;
    expect(d.rowCount).toBeGreaterThan(result.baseline.lines.length * 2);

    let withFormulaText = 0;
    d.eachRow((row, n) => {
      if (n === 1) return;
      if (String(row.getCell(5).value ?? '').length > 5) withFormulaText += 1;
    });
    expect(withFormulaText).toBeGreaterThan(10);
  });

  it('records the validation findings', async () => {
    const { workbook } = await roundTrip(emma21Project);
    const v = workbook.getWorksheet('Validation')!;
    // The reference project banks 100% of the theoretical labour saving.
    let found = false;
    v.eachRow((row) => {
      if (String(row.getCell(3).value ?? '').includes('100% of the theoretical labour saving')) found = true;
    });
    expect(found).toBe(true);
  });

  it('states which basis produced the figures', async () => {
    const { workbook } = await roundTrip(emma21Project);
    const a = workbook.getWorksheet('Assumptions')!;
    const text: string[] = [];
    a.eachRow((row) => text.push(`${row.getCell(1).value} ${row.getCell(2).value}`));
    expect(text.join(' ')).toContain('Cash');
    expect(text.join(' ')).toContain('Cycle time');
  });

  it('reproduces the scenario tables', async () => {
    const { workbook } = await roundTrip(emma21Project);
    const s = workbook.getWorksheet('Scenarios')!;
    const savings: number[] = [];
    s.eachRow((row) => {
      const v = row.getCell(4).value;
      if (typeof v === 'number') savings.push(v);
    });
    // The headline appears once per table as the base case.
    expect(savings.filter((v) => Math.abs(v - X.netAnnualSaving) < 1).length).toBeGreaterThanOrEqual(3);
  });
});

describe('degenerate projects still export', () => {
  it.each([
    ['empty defaults', newProjectDefaults()],
    ['zero demand', { ...emma21Project, demandPairsPerYear: 0 }],
    ['full-cost basis', { ...emma21Project, costBasis: 'fullCost' as const }],
    ['headcount labour', { ...emma21Project, labour: { ...emma21Project.labour, basis: 'headcount' as const } }],
  ] as Array<[string, ProjectInput]>)('%s', async (_name, input) => {
    const { workbook } = await roundTrip(input);
    expect(workbook.getWorksheet('Report')).toBeDefined();
    const zip = await zipOf(input);
    for (const name of Object.keys(zip.files).filter((n) => /^xl\/worksheets\/sheet\d+\.xml$/.test(n))) {
      const xml = await zip.file(name)!.async('string');
      expect(xml.match(/<\/f>(?!<v>)/g) ?? []).toEqual([]);
    }
  });
});
