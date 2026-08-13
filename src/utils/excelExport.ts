import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import { ROIParams, ROIResults, MaterialItem } from '../types';

/* ------------------------------------------------------------------ *
 * Styling helpers
 * ------------------------------------------------------------------ */

const HEADER_FILL = 'FF004E57';
const SUBHEAD_FILL = 'FFE2EFF0';
const THIN: Partial<ExcelJS.Borders> = {
  top: { style: 'thin' },
  left: { style: 'thin' },
  bottom: { style: 'thin' },
  right: { style: 'thin' },
};

export const FMT = {
  usd2: '"$"#,##0.00',
  usd4: '"$"#,##0.0000',
  int: '#,##0',
  num2: '#,##0.00',
  pct: '0.0"%"',
} as const;

const styleHeader = (row: ExcelJS.Row) => {
  row.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: HEADER_FILL } };
    cell.border = THIN;
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
  });
  row.height = 22;
};

const styleSectionTitle = (row: ExcelJS.Row) => {
  row.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: 'FF002D32' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: SUBHEAD_FILL } };
  });
};

const styleDataRow = (row: ExcelJS.Row) => {
  row.eachCell((cell) => {
    cell.border = THIN;
  });
};

/* ------------------------------------------------------------------ *
 * Formula durability (P3-02)
 * ------------------------------------------------------------------ */

/**
 * Write a formula together with its already-computed value.
 *
 * ExcelJS will happily emit `<f>` with no `<v>`. Desktop Excel recalculates on
 * open and hides the problem, but Google Sheets, LibreOffice, Numbers, Excel
 * mobile and openpyxl/pandas all read the cached value and show blank or zero.
 * Every formula in this workbook therefore carries `result`, and the workbook
 * additionally asks for a full recalc on load.
 */
const setFormula = (
  cell: ExcelJS.Cell,
  formula: string,
  result: number,
  numFmt?: string,
): ExcelJS.Cell => {
  const safe = Number.isFinite(result) ? result : 0;
  cell.value = { formula, result: safe } as ExcelJS.CellFormulaValue;
  if (numFmt) cell.numFmt = numFmt;
  return cell;
};

/* ------------------------------------------------------------------ *
 * Images (P3-01)
 * ------------------------------------------------------------------ */

type ImageExt = 'png' | 'jpeg' | 'gif';

const extFromMime = (mime: string): ImageExt => {
  if (mime.includes('png')) return 'png';
  if (mime.includes('gif')) return 'gif';
  return 'jpeg';
};

/**
 * Resolve an image reference into something ExcelJS can embed.
 * Handles both the `data:` URIs the infographic download produces and the
 * remote Supabase/Cloudinary URLs the upload flow stores.
 */
const loadImage = async (
  src: string,
): Promise<{ base64: string; extension: ImageExt } | null> => {
  try {
    if (src.startsWith('data:')) {
      const [meta, payload] = src.split(',');
      if (!payload) return null;
      return { base64: payload, extension: extFromMime(meta) };
    }

    const res = await fetch(src);
    if (!res.ok) return null;
    const blob = await res.blob();
    const buffer = await blob.arrayBuffer();

    let binary = '';
    const bytes = new Uint8Array(buffer);
    for (let i = 0; i < bytes.byteLength; i += 1) binary += String.fromCharCode(bytes[i]);

    return { base64: btoa(binary), extension: extFromMime(blob.type || 'image/jpeg') };
  } catch {
    // A missing photo must never take the whole export down.
    return null;
  }
};

/* ------------------------------------------------------------------ *
 * Workbook
 * ------------------------------------------------------------------ */

const BRIDGE_LABELS: Record<string, string> = {
  labor: 'Labour',
  material: 'Material',
  energy: 'Energy',
  maintenance: 'Maintenance',
  consumables: 'Consumables',
  depreciation: 'Depreciation',
};

export interface ExcelExportOptions {
  /** Machine photos and/or generated infographic, as URLs or data: URIs. */
  images?: string[];
  /** AI evaluation, rendered onto its own sheet when present. */
  aiEvaluation?: {
    verdict?: string;
    summary?: string;
    pros?: string[];
    cons?: string[];
    risks?: string[];
  } | null;
}

export const buildWorkbook = async (
  params: ROIParams,
  results: ROIResults,
  options: ExcelExportOptions = {},
): Promise<ExcelJS.Workbook> => {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'LY ROI Matrix';
  workbook.lastModifiedBy = 'LY ROI Matrix';
  workbook.created = new Date();
  workbook.modified = new Date();
  // Belt and braces alongside the cached results above.
  workbook.calcProperties.fullCalcOnLoad = true;

  const qty = Number(params.machineQuantity) || 0;
  const { assumptions, current, proposed, savings, investment } = results;

  /* ---------------- Sheet 1: Inputs (the live model, P3-06) --------------- */

  const wsIn = workbook.addWorksheet('Inputs', { views: [{ state: 'frozen', ySplit: 1 }] });
  wsIn.columns = [
    { header: 'Input', key: 'label', width: 34 },
    { header: 'Current', key: 'current', width: 16 },
    { header: 'Proposed', key: 'proposed', width: 16 },
    { header: 'Unit', key: 'unit', width: 16 },
  ];
  styleHeader(wsIn.getRow(1));

  // Row numbers are captured as we go so downstream sheets can reference them
  // by name rather than by hardcoded address.
  const ref: Record<string, string> = {};
  const addInput = (
    name: string,
    label: string,
    currentValue: number,
    proposedValue: number,
    unit: string,
    numFmt: string = FMT.num2,
  ) => {
    const row = wsIn.addRow({ label, current: currentValue, proposed: proposedValue, unit });
    row.getCell('current').numFmt = numFmt;
    row.getCell('proposed').numFmt = numFmt;
    styleDataRow(row);
    ref[`${name}_cur`] = `Inputs!$B$${row.number}`;
    ref[`${name}_pro`] = `Inputs!$C$${row.number}`;
    return row;
  };

  const addShared = (name: string, label: string, value: number, unit: string, numFmt: string = FMT.num2) => {
    const row = wsIn.addRow({ label, current: value, proposed: null, unit });
    row.getCell('current').numFmt = numFmt;
    wsIn.mergeCells(`B${row.number}:C${row.number}`);
    styleDataRow(row);
    ref[name] = `Inputs!$B$${row.number}`;
    return row;
  };

  addShared('qty', 'Machine Quantity (stations in scope)', qty, 'stations', FMT.int);
  addShared('hours', 'Working Hours / Day', assumptions.workingHoursPerDay, 'h/day', FMT.num2);
  addShared('days', 'Working Days / Year', assumptions.daysPerYear, 'days/yr', FMT.int);
  addShared('rate', 'Energy Tariff', assumptions.powerRateUSD, 'USD/kWh', FMT.usd4);
  addShared('labor', 'Local Labour Cost', Number(params.localLaborCost) || 0, 'USD/op/month', FMT.usd2);

  const hoursRow = wsIn.addRow({ label: 'Operating Hours / Year', unit: 'h/yr' });
  setFormula(
    hoursRow.getCell('current'),
    `${ref.hours}*${ref.days}`,
    assumptions.hoursPerYear,
    FMT.int,
  );
  wsIn.mergeCells(`B${hoursRow.number}:C${hoursRow.number}`);
  styleDataRow(hoursRow);
  ref.hoursPerYear = `Inputs!$B$${hoursRow.number}`;

  const spacer = wsIn.addRow({ label: 'Per-station parameters' });
  styleSectionTitle(spacer);

  addInput('pph', 'Pairs per Hour (per station)', Number(params.currentPPH) || 0, Number(params.proposedPPH) || 0, 'pairs/h', FMT.num2);
  addInput('manpower', 'Operators (per station)', Number(params.currentManpower) || 0, Number(params.proposedManpower) || 0, 'operators', FMT.num2);
  addInput('defect', 'Defect Rate', Number(params.currentDefectRate) || 0, Number(params.proposedDefectRate) || 0, '%', FMT.num2);
  addInput('kw', 'Power Consumption', Number(params.currentPowerConsumptionKW) || 0, Number(params.proposedPowerConsumptionKW) || 0, 'kW', FMT.num2);
  addInput('price', 'Unit Price', Number(params.currentUnitPrice) || 0, Number(params.proposedUnitPrice) || 0, 'USD', FMT.usd2);
  addInput('maint', 'Maintenance / Year', Number(params.currentMaintenanceCostPerYear) || 0, Number(params.proposedMaintenanceCostPerYear) || 0, 'USD/yr', FMT.usd2);
  addInput('consum', 'Consumables / Year', Number(params.currentConsumablesCostPerYear) || 0, Number(params.proposedConsumablesCostPerYear) || 0, 'USD/yr', FMT.usd2);
  addInput('deprec', 'Depreciation Period', Number(params.currentDepreciationYears) || 0, Number(params.proposedDepreciationYears) || 0, 'years', FMT.num2);

  /* ---------------- Sheet 2: Overview ---------------- */

  const wsOv = workbook.addWorksheet('Overview', { views: [{ state: 'frozen', ySplit: 1 }] });
  wsOv.columns = [
    { header: 'Category', key: 'category', width: 20 },
    { header: 'Property', key: 'property', width: 30 },
    { header: 'Current State', key: 'current', width: 24 },
    { header: 'Proposed State', key: 'proposed', width: 24 },
  ];
  styleHeader(wsOv.getRow(1));

  // Per-row formats declared with the data, replacing the old index arithmetic
  // and `.includes('USD')` string sniffing (P3-07).
  const overviewRows: Array<{
    category: string; property: string;
    current: string | number; proposed: string | number;
    numFmt?: string;
  }> = [
    { category: 'General', property: 'Shoe Model', current: params.shoeModel, proposed: params.shoeModel },
    { category: 'General', property: 'Date', current: params.date, proposed: params.date },
    { category: 'General', property: 'Equipment Name', current: params.equipmentName, proposed: params.equipmentName },
    { category: 'General', property: 'Machine Type', current: params.machineType, proposed: params.machineType },
    { category: 'General', property: 'Brand / Vendor', current: params.brand, proposed: params.brand },
    { category: 'General', property: 'Scope of Work', current: params.scopeOfWork, proposed: params.scopeOfWork },
    { category: 'General', property: 'Machine Quantity', current: qty, proposed: qty, numFmt: FMT.int },
    { category: 'Technical', property: 'Power Supply (V)', current: params.currentPowerSupplyV, proposed: params.proposedPowerSupplyV },
    { category: 'Technical', property: 'Power Consumption (kW)', current: Number(params.currentPowerConsumptionKW) || 0, proposed: Number(params.proposedPowerConsumptionKW) || 0, numFmt: FMT.num2 },
    { category: 'Technical', property: 'Speed (s/prs)', current: Number(params.currentSpeedSPrs) || 0, proposed: Number(params.proposedSpeedSPrs) || 0, numFmt: FMT.num2 },
    { category: 'Technical', property: 'Cycle Time (s)', current: Number(params.currentCT) || 0, proposed: Number(params.proposedCT) || 0, numFmt: FMT.num2 },
    { category: 'Technical', property: 'Unit Price (USD)', current: Number(params.currentUnitPrice) || 0, proposed: Number(params.proposedUnitPrice) || 0, numFmt: FMT.usd2 },
    { category: 'Technical', property: 'Maintenance / Yr (USD)', current: Number(params.currentMaintenanceCostPerYear) || 0, proposed: Number(params.proposedMaintenanceCostPerYear) || 0, numFmt: FMT.usd2 },
    { category: 'Technical', property: 'Consumables / Yr (USD)', current: Number(params.currentConsumablesCostPerYear) || 0, proposed: Number(params.proposedConsumablesCostPerYear) || 0, numFmt: FMT.usd2 },
    { category: 'Technical', property: 'Depreciation (Years)', current: Number(params.currentDepreciationYears) || 0, proposed: Number(params.proposedDepreciationYears) || 0, numFmt: FMT.num2 },
    { category: 'Quality', property: 'RFT %', current: Number(params.currentRFT) || 0, proposed: Number(params.proposedRFT) || 0, numFmt: FMT.num2 },
    { category: 'Quality', property: 'Defect Rate %', current: Number(params.currentDefectRate) || 0, proposed: Number(params.proposedDefectRate) || 0, numFmt: FMT.num2 },
  ];

  overviewRows.forEach((r) => {
    const row = wsOv.addRow({ category: r.category, property: r.property, current: r.current, proposed: r.proposed });
    if (r.numFmt) {
      row.getCell('current').numFmt = r.numFmt;
      row.getCell('proposed').numFmt = r.numFmt;
    }
    styleDataRow(row);
  });

  /* ---------------- Sheet 3: Calculations (materials) ---------------- */

  const wsCalc = workbook.addWorksheet('Calculations', { views: [{ state: 'frozen', ySplit: 1 }] });
  wsCalc.columns = [
    { header: 'Type', key: 'type', width: 18 },
    { header: 'Description', key: 'description', width: 30 },
    { header: 'Supplier', key: 'supplier', width: 20 },
    { header: 'UOM', key: 'uom', width: 10 },
    { header: 'Usage', key: 'usage', width: 12 },
    { header: 'Loss %', key: 'loss', width: 10 },
    { header: 'FOB ($)', key: 'fob', width: 14 },
    { header: 'Cost / Pair ($)', key: 'cost', width: 16 },
  ];
  styleHeader(wsCalc.getRow(1));

  /**
   * Writes one material table and its total.
   *
   * The old implementation captured the start row *before* adding any rows, so an
   * empty list produced `SUM(H13:H12)` — a reversed range that makes Excel show a
   * file-repair prompt (P3-03). Here the range is derived from the rows actually
   * written, and the total is skipped entirely when there are none.
   */
  const addMaterialTable = (title: string, materials: MaterialItem[] | undefined, expectedTotal: number) => {
    const titleRow = wsCalc.addRow([title]);
    titleRow.font = { bold: true, size: 12 };
    styleSectionTitle(titleRow);

    const list = materials ?? [];
    const dataRows: number[] = [];

    list.forEach((m) => {
      const usage = Number(m.usage) || 0;
      const loss = Number(m.loss) || 0;
      const fob = Number(m.fob) || 0;
      const row = wsCalc.addRow({
        type: m.type, description: m.description, supplier: m.supplier, uom: m.uom,
        usage, loss, fob,
      });
      row.getCell('usage').numFmt = FMT.num2;
      row.getCell('loss').numFmt = FMT.num2;
      row.getCell('fob').numFmt = FMT.usd4;
      setFormula(
        row.getCell('cost'),
        `E${row.number}*G${row.number}*(1+F${row.number}/100)`,
        usage * fob * (1 + loss / 100),
        FMT.usd4,
      );
      styleDataRow(row);
      dataRows.push(row.number);
    });

    if (dataRows.length === 0) {
      const empty = wsCalc.addRow({ type: '—', description: 'No materials recorded' });
      empty.font = { italic: true, color: { argb: 'FF888888' } };
      styleDataRow(empty);
      const totalRow = wsCalc.addRow({ fob: 'Total Cost / Pair', cost: 0 });
      totalRow.getCell('cost').numFmt = FMT.usd4;
      totalRow.font = { bold: true };
      styleDataRow(totalRow);
      return totalRow.number;
    }

    const first = dataRows[0];
    const last = dataRows[dataRows.length - 1];
    const totalRow = wsCalc.addRow({ fob: 'Total Cost / Pair' });
    setFormula(totalRow.getCell('cost'), `SUM(H${first}:H${last})`, expectedTotal, FMT.usd4);
    totalRow.font = { bold: true };
    styleDataRow(totalRow);
    return totalRow.number;
  };

  // BOM cost per pair PRODUCED. The per-good-pair figure (grossed up by yield)
  // lives on the Financials sheet.
  const currentBOM = (params.currentMaterials ?? []).reduce(
    (s, m) => s + (Number(m.usage) || 0) * (Number(m.fob) || 0) * (1 + (Number(m.loss) || 0) / 100), 0);
  const proposedBOM = (params.proposedMaterials ?? []).reduce(
    (s, m) => s + (Number(m.usage) || 0) * (Number(m.fob) || 0) * (1 + (Number(m.loss) || 0) / 100), 0);

  const curTotalRow = addMaterialTable('Material Cost Breakdown — Current State', params.currentMaterials, currentBOM);
  wsCalc.addRow([]);
  const proTotalRow = addMaterialTable('Material Cost Breakdown — Proposed State', params.proposedMaterials, proposedBOM);

  ref.bom_cur = `Calculations!$H$${curTotalRow}`;
  ref.bom_pro = `Calculations!$H$${proTotalRow}`;

  /* ---------------- Sheet 4: Financials (driven off Inputs) ---------------- */

  const wsFin = workbook.addWorksheet('Financials', { views: [{ state: 'frozen', ySplit: 1 }] });
  wsFin.columns = [
    { header: 'Metric', key: 'metric', width: 36 },
    { header: 'Current State', key: 'current', width: 20 },
    { header: 'Proposed State', key: 'proposed', width: 20 },
    { header: 'Difference', key: 'diff', width: 20 },
  ];
  styleHeader(wsFin.getRow(1));

  const fin: Record<string, number> = {};
  const addFinRow = (
    metric: string,
    curFormula: string, curValue: number,
    proFormula: string, proValue: number,
    numFmt: string,
    key?: string,
  ) => {
    const row = wsFin.addRow({ metric });
    setFormula(row.getCell('current'), curFormula, curValue, numFmt);
    setFormula(row.getCell('proposed'), proFormula, proValue, numFmt);
    setFormula(row.getCell('diff'), `B${row.number}-C${row.number}`, curValue - proValue, numFmt);
    styleDataRow(row);
    if (key) {
      fin[`${key}_cur`] = row.number;
      fin[`${key}_pro`] = row.number;
    }
    return row.number;
  };

  const capRow = addFinRow('Annual Capacity (gross pairs)',
    `${ref.pph_cur}*${ref.qty}*${ref.hoursPerYear}`, current.annualCapacity,
    `${ref.pph_pro}*${ref.qty}*${ref.hoursPerYear}`, proposed.annualCapacity,
    FMT.int, 'cap');

  const goodRow = addFinRow('Annual Good Output (pairs)',
    `B${capRow}*(1-${ref.defect_cur}/100)`, current.actualGoodCapacity,
    `C${capRow}*(1-${ref.defect_pro}/100)`, proposed.actualGoodCapacity,
    FMT.int, 'good');

  const laborRow = addFinRow('Annual Labour Cost',
    `${ref.manpower_cur}*${ref.qty}*${ref.labor}*12`, current.annualLaborCost,
    `${ref.manpower_pro}*${ref.qty}*${ref.labor}*12`, proposed.annualLaborCost,
    FMT.usd2, 'labor');

  const energyRow = addFinRow('Annual Energy Cost',
    `${ref.kw_cur}*${ref.qty}*${ref.hoursPerYear}*${ref.rate}`, current.annualEnergyCost,
    `${ref.kw_pro}*${ref.qty}*${ref.hoursPerYear}*${ref.rate}`, proposed.annualEnergyCost,
    FMT.usd2, 'energy');

  // Scaled by quantity, matching the engine. The old export wrote the raw
  // per-machine parameters here and silently disagreed with the app (P3-04).
  const maintRow = addFinRow('Annual Maintenance',
    `${ref.maint_cur}*${ref.qty}`, current.annualMaintenance,
    `${ref.maint_pro}*${ref.qty}`, proposed.annualMaintenance,
    FMT.usd2, 'maint');

  const consumRow = addFinRow('Annual Consumables',
    `${ref.consum_cur}*${ref.qty}`, current.annualConsumables,
    `${ref.consum_pro}*${ref.qty}`, proposed.annualConsumables,
    FMT.usd2, 'consum');

  const deprecRow = addFinRow('Annual Depreciation',
    `IFERROR(${ref.price_cur}*${ref.qty}/${ref.deprec_cur},0)`, current.annualDepreciation,
    `IFERROR(${ref.price_pro}*${ref.qty}/${ref.deprec_pro},0)`, proposed.annualDepreciation,
    FMT.usd2, 'deprec');

  const materialRow = addFinRow('Annual Material Cost',
    `B${capRow}*${ref.bom_cur}`, current.annualMaterialCost,
    `C${capRow}*${ref.bom_pro}`, proposed.annualMaterialCost,
    FMT.usd2, 'material');

  const opRow = addFinRow('Total Operating Cost (excl. material)',
    `B${laborRow}+B${energyRow}+B${maintRow}+B${consumRow}+B${deprecRow}`, current.totalOperatingCost,
    `C${laborRow}+C${energyRow}+C${maintRow}+C${consumRow}+C${deprecRow}`, proposed.totalOperatingCost,
    FMT.usd2, 'op');

  const totalRow = addFinRow('Total Annual Cost',
    `B${opRow}+B${materialRow}`, current.totalAnnualCost,
    `C${opRow}+C${materialRow}`, proposed.totalAnnualCost,
    FMT.usd2, 'total');

  wsFin.addRow([]);
  const perPairHeader = wsFin.addRow({ metric: 'Per Good Pair' });
  styleSectionTitle(perPairHeader);

  const opPerPairRow = addFinRow('Operating Cost / Pair',
    `IFERROR(B${opRow}/B${goodRow},0)`, current.operatingCostPerPair,
    `IFERROR(C${opRow}/C${goodRow},0)`, proposed.operatingCostPerPair,
    FMT.usd4, 'opPer');

  const matPerPairRow = addFinRow('Material Cost / Pair',
    `IFERROR(B${materialRow}/B${goodRow},0)`, current.materialCostPerPair,
    `IFERROR(C${materialRow}/C${goodRow},0)`, proposed.materialCostPerPair,
    FMT.usd4, 'matPer');

  const cppRow = addFinRow('Total Cost / Pair (FOB)',
    `B${opPerPairRow}+B${matPerPairRow}`, current.costPerPair,
    `C${opPerPairRow}+C${matPerPairRow}`, proposed.costPerPair,
    FMT.usd4, 'cpp');
  wsFin.getRow(cppRow).font = { bold: true };

  /* ---------------- ROI summary ---------------- */

  wsFin.addRow([]);
  const roiHeader = wsFin.addRow({ metric: 'ROI Summary' });
  roiHeader.font = { bold: true, size: 12 };
  styleSectionTitle(roiHeader);

  const grossRow = wsFin.addRow({ metric: 'Gross Investment' });
  setFormula(grossRow.getCell('current'), `${ref.price_pro}*${ref.qty}`, investment.gross, FMT.usd2);
  styleDataRow(grossRow);

  const netRow = wsFin.addRow({ metric: 'Net Investment (proposed - current)' });
  setFormula(netRow.getCell('current'), `(${ref.price_pro}-${ref.price_cur})*${ref.qty}`, investment.net, FMT.usd2);
  styleDataRow(netRow);

  const basisRow = wsFin.addRow({ metric: 'Payback Basis', current: investment.basis === 'net' ? 'Net Investment' : 'Gross Investment' });
  styleDataRow(basisRow);

  const basisOutRow = wsFin.addRow({ metric: 'Savings Basis (annual good pairs)' });
  setFormula(basisOutRow.getCell('current'), `C${goodRow}`, results.basisOutput, FMT.int);
  styleDataRow(basisOutRow);

  const fobRow = wsFin.addRow({ metric: 'Cost / Pair Improvement' });
  setFormula(fobRow.getCell('current'), `B${cppRow}-C${cppRow}`, savings.fobImpact, FMT.usd4);
  styleDataRow(fobRow);

  const savingRow = wsFin.addRow({ metric: 'Total Annual Saving' });
  setFormula(savingRow.getCell('current'), `B${fobRow.number}*B${basisOutRow.number}`, savings.totalAnnualSaving, FMT.usd2);
  savingRow.font = { bold: true };
  styleDataRow(savingRow);

  // Guarded so a zero or negative saving reads as words rather than #DIV/0! (P3-05).
  const paybackRow = wsFin.addRow({ metric: 'Payback (Months)' });
  const paybackCell = paybackRow.getCell('current');
  const paybackFormula =
    `IF(B${savingRow.number}<=0,"No payback",IF(B${netRow.number}<=0,"Immediate",` +
    `IFERROR(B${netRow.number}/(B${savingRow.number}/12),"No payback")))`;
  paybackCell.value = {
    formula: paybackFormula,
    result:
      results.payback.kind === 'months'
        ? Number(results.payback.months.toFixed(6))
        : results.payback.kind === 'immediate'
          ? 'Immediate'
          : 'No payback',
  } as ExcelJS.CellFormulaValue;
  paybackCell.numFmt = FMT.num2;
  paybackRow.font = { bold: true };
  styleDataRow(paybackRow);

  if (results.payback.kind === 'none') {
    const lossRow = wsFin.addRow({ metric: 'Annual Loss vs Current', current: results.payback.annualLoss });
    lossRow.getCell('current').numFmt = FMT.usd2;
    lossRow.font = { bold: true, color: { argb: 'FFB3261E' } };
    styleDataRow(lossRow);
  }

  /* ---------------- Sheet 5: Savings Breakdown (P3-08) ---------------- */

  const wsSav = workbook.addWorksheet('Savings Breakdown', { views: [{ state: 'frozen', ySplit: 1 }] });
  wsSav.columns = [
    { header: 'Cost Line', key: 'line', width: 24 },
    { header: 'Current $/Pair', key: 'cur', width: 18 },
    { header: 'Proposed $/Pair', key: 'pro', width: 18 },
    { header: 'Delta $/Pair', key: 'delta', width: 18 },
    { header: 'Annual Impact', key: 'annual', width: 20 },
  ];
  styleHeader(wsSav.getRow(1));

  const bridgeRows: number[] = [];
  savings.bridge.forEach((c) => {
    const row = wsSav.addRow({
      line: BRIDGE_LABELS[c.key] ?? c.key,
      cur: c.currentPerPair,
      pro: c.proposedPerPair,
    });
    row.getCell('cur').numFmt = FMT.usd4;
    row.getCell('pro').numFmt = FMT.usd4;
    setFormula(row.getCell('delta'), `B${row.number}-C${row.number}`, c.perPairDelta, FMT.usd4);
    setFormula(row.getCell('annual'), `D${row.number}*Financials!$B$${basisOutRow.number}`, c.annualDelta, FMT.usd2);
    styleDataRow(row);
    bridgeRows.push(row.number);
  });

  if (bridgeRows.length > 0) {
    const first = bridgeRows[0];
    const last = bridgeRows[bridgeRows.length - 1];
    const sumRow = wsSav.addRow({ line: 'Total' });
    setFormula(sumRow.getCell('delta'), `SUM(D${first}:D${last})`, savings.fobImpact, FMT.usd4);
    setFormula(sumRow.getCell('annual'), `SUM(E${first}:E${last})`, savings.totalAnnualSaving, FMT.usd2);
    sumRow.font = { bold: true };
    styleDataRow(sumRow);
  }

  wsSav.addRow([]);
  const mpRow = wsSav.addRow({ line: 'Operators freed (equal output)', delta: savings.manpowerSaving });
  mpRow.getCell('delta').numFmt = FMT.num2;
  styleDataRow(mpRow);

  /* ---------------- Sheet 6: Assumptions (P3-08) ---------------- */

  const wsAss = workbook.addWorksheet('Assumptions');
  wsAss.columns = [
    { header: 'Assumption', key: 'name', width: 34 },
    { header: 'Value', key: 'value', width: 18 },
    { header: 'Unit', key: 'unit', width: 16 },
    { header: 'Note', key: 'note', width: 60 },
  ];
  styleHeader(wsAss.getRow(1));

  ([
    ['Working Hours / Day', assumptions.workingHoursPerDay, 'h/day', 'Shift length used for annual capacity.', FMT.num2],
    ['Working Days / Year', assumptions.daysPerYear, 'days/yr', 'Was hardcoded at 312 before this release.', FMT.int],
    ['Operating Hours / Year', assumptions.hoursPerYear, 'h/yr', 'Hours per day x days per year.', FMT.int],
    ['Energy Tariff', assumptions.powerRateUSD, 'USD/kWh', 'Was hardcoded at $0.075. Varies materially by site (VN / ID / MY).', FMT.usd4],
    ['Local Labour Cost', Number(params.localLaborCost) || 0, 'USD/op/month', 'Fully loaded monthly cost per operator.', FMT.usd2],
    ['Machine Quantity', qty, 'stations', 'Applies to BOTH sides: N current stations replaced by N proposed.', FMT.int],
    ['Payback Basis', investment.basis === 'net' ? 'Net' : 'Gross', '', 'Payback runs on net incremental investment; gross is shown alongside.', undefined],
    ['Scrap Convention', 'Divide by yield', '', 'Cost per GOOD pair = cost per produced pair / (1 - defect rate).', undefined],
  ] as Array<[string, string | number, string, string, string | undefined]>).forEach(([name, value, unit, note, numFmt]) => {
    const row = wsAss.addRow({ name, value, unit, note });
    if (numFmt) row.getCell('value').numFmt = numFmt;
    row.getCell('note').alignment = { wrapText: true, vertical: 'top' };
    styleDataRow(row);
  });

  /* ---------------- Sheet 7: AI Evaluation (P3-08) ---------------- */

  const ai = options.aiEvaluation;
  if (ai && (ai.verdict || ai.summary || ai.pros?.length || ai.cons?.length || ai.risks?.length)) {
    const wsAI = workbook.addWorksheet('AI Evaluation');
    wsAI.columns = [
      { header: 'Section', key: 'section', width: 22 },
      { header: 'Detail', key: 'detail', width: 100 },
    ];
    styleHeader(wsAI.getRow(1));

    const addAI = (section: string, detail: string) => {
      const row = wsAI.addRow({ section, detail });
      row.getCell('detail').alignment = { wrapText: true, vertical: 'top' };
      styleDataRow(row);
    };

    if (ai.verdict) addAI('Verdict', ai.verdict);
    if (ai.summary) addAI('Summary', ai.summary);
    (ai.pros ?? []).forEach((v, i) => addAI(i === 0 ? 'Advantages' : '', v));
    (ai.cons ?? []).forEach((v, i) => addAI(i === 0 ? 'Drawbacks' : '', v));
    (ai.risks ?? []).forEach((v, i) => addAI(i === 0 ? 'Risks' : '', v));
  }

  /* ---------------- Images (P3-01) ---------------- */

  const sources = (options.images ?? []).filter(Boolean).slice(0, 3);
  if (sources.length > 0) {
    const wsImg = workbook.addWorksheet('Photos');
    wsImg.getColumn(1).width = 4;
    const title = wsImg.addRow(['Machine Photos & Generated Infographic']);
    title.font = { bold: true, size: 12 };

    const loaded = await Promise.all(sources.map(loadImage));
    let anchorRow = 2;
    loaded.forEach((img) => {
      if (!img) return;
      const id = workbook.addImage({ base64: img.base64, extension: img.extension });
      // Anchored to an explicit box so images never float across the data sheets.
      wsImg.addImage(id, {
        tl: { col: 1, row: anchorRow },
        ext: { width: 640, height: 360 },
      });
      anchorRow += 20;
    });
  }

  return workbook;
};

export const exportToExcel = async (
  params: ROIParams,
  results: ROIResults,
  _t?: unknown,
  options: ExcelExportOptions = {},
): Promise<void> => {
  const workbook = await buildWorkbook(params, results, options);
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const safeModel = (params.shoeModel || 'Project').replace(/[^\w.-]+/g, '_');
  saveAs(blob, `CAPEX_Proposal_${safeModel}_${params.date}.xlsx`);
};
