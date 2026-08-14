import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import { ProjectInput, ProjectResult } from '../domain/model';
import { calculateProject } from '../domain/engine';
import { validateProject, Issue } from '../domain/validate';
import { allScenarios } from '../domain/scenarios';

/**
 * Workbook export for the rebuilt analysis.
 *
 * Two properties matter here, and they are the reason this is not just a dump of
 * the result object:
 *
 *  1. **It is a live model.** Every input lands on one sheet and every figure
 *     downstream is an Excel formula referencing those cells, so an IE can flex
 *     an assumption in the workbook and watch the payback move. The formulas
 *     mirror the engine's own arithmetic — they are the same expressions the
 *     report shows when you expand a figure.
 *
 *  2. **Every formula carries its computed value.** ExcelJS will happily emit
 *     `<f>` with no `<v>`; desktop Excel recalculates and hides it, while Google
 *     Sheets, LibreOffice, Numbers and openpyxl read blank or zero. Each cell is
 *     therefore written with the engine's value cached alongside the formula,
 *     and the workbook additionally requests a full recalculation on load.
 */

const HEADER_FILL = 'FF004E57';
const SUBHEAD_FILL = 'FFE2EFF0';
const THIN: Partial<ExcelJS.Borders> = {
  top: { style: 'thin' }, left: { style: 'thin' },
  bottom: { style: 'thin' }, right: { style: 'thin' },
};

const FMT = {
  usd0: '"$"#,##0',
  usd2: '"$"#,##0.00',
  usd4: '"$"#,##0.0000',
  int: '#,##0',
  num2: '#,##0.00',
  num4: '#,##0.0000',
  pct: '0.0%',
} as const;

const styleHeader = (row: ExcelJS.Row) => {
  row.eachCell((c) => {
    c.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: HEADER_FILL } };
    c.border = THIN;
    c.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
  });
  row.height = 22;
};

const styleSection = (row: ExcelJS.Row) => {
  row.eachCell((c) => {
    c.font = { bold: true, color: { argb: 'FF002D32' } };
    c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: SUBHEAD_FILL } };
  });
};

const styleRow = (row: ExcelJS.Row) => row.eachCell((c) => { c.border = THIN; });

/** Write a formula together with the value the engine computed for it. */
const setFormula = (cell: ExcelJS.Cell, formula: string, result: number | string, numFmt?: string) => {
  const safe = typeof result === 'number' && !Number.isFinite(result) ? 0 : result;
  cell.value = { formula, result: safe } as ExcelJS.CellFormulaValue;
  if (numFmt) cell.numFmt = numFmt;
  return cell;
};

export interface ProjectExportOptions {
  images?: string[];
  fileName?: string;
}

type ImageExt = 'png' | 'jpeg' | 'gif';
const extFromMime = (m: string): ImageExt =>
  m.includes('png') ? 'png' : m.includes('gif') ? 'gif' : 'jpeg';

const loadImage = async (src: string): Promise<{ base64: string; extension: ImageExt } | null> => {
  try {
    if (src.startsWith('data:')) {
      const [meta, payload] = src.split(',');
      return payload ? { base64: payload, extension: extFromMime(meta) } : null;
    }
    const res = await fetch(src);
    if (!res.ok) return null;
    const buf = new Uint8Array(await (await res.blob()).arrayBuffer());
    let binary = '';
    for (let i = 0; i < buf.byteLength; i += 1) binary += String.fromCharCode(buf[i]);
    return { base64: btoa(binary), extension: 'jpeg' };
  } catch {
    return null;
  }
};

export const buildProjectWorkbook = async (
  input: ProjectInput,
  options: ProjectExportOptions = {},
): Promise<ExcelJS.Workbook> => {
  const result: ProjectResult = calculateProject(input);
  const issues: Issue[] = validateProject(input);
  const scenarios = allScenarios(input);

  const wb = new ExcelJS.Workbook();
  wb.creator = 'LY ROI Matrix';
  wb.created = new Date();
  wb.calcProperties.fullCalcOnLoad = true;

  /* ================= Inputs ================= */

  const wsIn = wb.addWorksheet('Inputs', { views: [{ state: 'frozen', ySplit: 1 }] });
  wsIn.columns = [
    { header: 'Input', key: 'label', width: 34 },
    { header: 'Baseline', key: 'b', width: 18 },
    { header: 'Proposed', key: 'p', width: 18 },
    { header: 'Unit', key: 'unit', width: 16 },
    { header: 'Note', key: 'note', width: 56 },
  ];
  styleHeader(wsIn.getRow(1));

  const ref: Record<string, string> = {};

  const section = (title: string) => styleSection(wsIn.addRow({ label: title }));

  const shared = (name: string, label: string, value: number | string, unit: string, note = '', numFmt?: string) => {
    const row = wsIn.addRow({ label, b: value, unit, note });
    if (numFmt) row.getCell('b').numFmt = numFmt;
    row.getCell('note').alignment = { wrapText: true, vertical: 'top' };
    styleRow(row);
    ref[name] = `Inputs!$B$${row.number}`;
    return row;
  };

  const pair = (name: string, label: string, b: number, p: number, unit: string, note = '', numFmt?: string) => {
    const row = wsIn.addRow({ label, b, p, unit, note });
    if (numFmt) { row.getCell('b').numFmt = numFmt; row.getCell('p').numFmt = numFmt; }
    row.getCell('note').alignment = { wrapText: true, vertical: 'top' };
    styleRow(row);
    ref[`${name}_b`] = `Inputs!$B$${row.number}`;
    ref[`${name}_p`] = `Inputs!$C$${row.number}`;
    return row;
  };

  section('Project');
  shared('demand', 'Annual demand', input.demandPairsPerYear, 'pairs/yr',
    'Both sides are costed at this volume and equipment is sized to deliver it.', FMT.int);

  section('Calendar & operating time');
  shared('days', 'Working days / year', input.calendar.daysPerYear, 'days/yr', '', FMT.int);
  shared('eff', 'Line efficiency', input.calendar.lineEfficiency, 'ratio',
    'Performance x quality, from the OEE report.', FMT.num4);
  shared('down', 'Downtime allowance', input.calendar.downtimeAllowance, 'ratio',
    'Unplanned downtime as a share of available time.', FMT.num4);
  shared('tariff', 'Energy tariff', input.energyTariffUSDPerKWh, 'USD/kWh', '', FMT.usd4);

  section('Labour');
  shared('wage', 'Monthly wage', input.labour.monthlyWage, 'USD/op/month', 'Fully loaded.', FMT.usd2);
  shared('paidHours', 'Paid hours / month', input.labour.paidHoursPerMonth, 'h/month',
    'Turns the monthly wage into an hourly rate.', FMT.num2);
  const rateRow = wsIn.addRow({ label: 'Hourly rate', unit: 'USD/hr' });
  setFormula(rateRow.getCell('b'), `IFERROR(${ref.wage}/${ref.paidHours},0)`,
    input.labour.paidHoursPerMonth > 0 ? input.labour.monthlyWage / input.labour.paidHoursPerMonth : 0, FMT.usd4);
  styleRow(rateRow);
  ref.rate = `Inputs!$B$${rateRow.number}`;
  shared('conv', 'Labour conversion', input.labour.conversionFactor, 'ratio',
    'Share of the theoretical labour saving banked as headcount.', FMT.num2);
  shared('horizon', 'Evaluation horizon', input.horizonYears, 'years', '', FMT.int);

  section('Equipment');
  pair('shifts', 'Shifts / day', input.baseline.shift.shiftsPerDay, input.proposed.shift.shiftsPerDay, 'shifts', '', FMT.num2);
  pair('hps', 'Hours / shift', input.baseline.shift.hoursPerShift, input.proposed.shift.hoursPerShift, 'h', '', FMT.num2);
  pair('mct', 'Machine cycle time', input.baseline.machine.machineCycleSec, input.proposed.machine.machineCycleSec, 's/pair',
    'Machine occupancy per pair. Decides throughput and therefore fleet size.', FMT.num4);
  pair('lct', 'Labour cycle time', input.baseline.machine.labourCycleSec, input.proposed.machine.labourCycleSec, 's/pair',
    'Total operator seconds per pair, including work alongside the machine.', FMT.num4);
  pair('ops', 'Operators / unit', input.baseline.machine.operatorsPerUnit ?? 0, input.proposed.machine.operatorsPerUnit ?? 0, 'ops',
    input.labour.basis === 'headcount' ? 'Used on the headcount basis. Must describe ONE unit.' : 'Not used on the cycle-time basis.', FMT.num2);
  pair('price', 'Unit price', input.baseline.machine.unitPrice, input.proposed.machine.unitPrice, 'USD', '', FMT.usd2);
  pair('consum', 'Consumables / unit / yr', input.baseline.machine.consumablesPerYear, input.proposed.machine.consumablesPerYear, 'USD/yr', '', FMT.usd2);
  pair('maint', 'Maintenance / unit / yr', input.baseline.machine.maintenancePerYear, input.proposed.machine.maintenancePerYear, 'USD/yr', '', FMT.usd2);
  pair('kw', 'Power', input.baseline.machine.powerKW, input.proposed.machine.powerKW, 'kW', '', FMT.num2);
  pair('dtl', 'Downtime loss / yr', input.baseline.machine.downtimeLossPerYear, input.proposed.machine.downtimeLossPerYear, 'USD/yr',
    'Idle labour from unplanned stoppages. Zero means no record exists.', FMT.usd2);
  pair('deprec', 'Depreciation period', input.baseline.machine.depreciationYears, input.proposed.machine.depreciationYears, 'years',
    input.costBasis === 'fullCost' ? 'Charged into operating cost on this basis.' : 'Not used on the cash basis.', FMT.num2);
  pair('mat', 'Material per pair', input.baseline.material.consumptionPerPair, input.proposed.material.consumptionPerPair,
    input.baseline.material.unit, 'Consumption per pair — usually the line that decides the case.', FMT.num4);
  pair('matPrice', 'Material price', input.baseline.material.pricePerUnit, input.proposed.material.pricePerUnit,
    `USD/${input.baseline.material.unit}`, '', FMT.usd4);
  pair('yield', 'Yield', input.baseline.yieldRate ?? 1, input.proposed.yieldRate ?? 1, 'ratio',
    'Saleable share of produced pairs. Leave at 1 when scrap is already in the material figure.', FMT.num4);
  pair('units', 'Units', result.baseline.fleet.units.value, result.proposed.fleet.units.value, 'units',
    input.baseline.fleet.mode === 'derived'
      ? 'Derived from takt time against demand. Overwrite to model a fixed fleet.'
      : 'Fixed by the project.', FMT.int);

  /* ================= Report ================= */

  const wsR = wb.addWorksheet('Report', { views: [{ state: 'frozen', ySplit: 1 }] });
  wsR.columns = [
    { header: 'Metric', key: 'metric', width: 36 },
    { header: 'Baseline', key: 'b', width: 20 },
    { header: 'Proposed', key: 'p', width: 20 },
    { header: 'Variance', key: 'v', width: 20 },
    { header: 'Share', key: 's', width: 12 },
  ];
  styleHeader(wsR.getRow(1));

  const R: Record<string, number> = {};
  const twoSided = (
    key: string, metric: string,
    fb: string, vb: number, fp: string, vp: number,
    numFmt: string, variance = true,
  ) => {
    const row = wsR.addRow({ metric });
    setFormula(row.getCell('b'), fb, vb, numFmt);
    setFormula(row.getCell('p'), fp, vp, numFmt);
    if (variance) setFormula(row.getCell('v'), `B${row.number}-C${row.number}`, vb - vp, numFmt);
    styleRow(row);
    R[key] = row.number;
    return row.number;
  };

  styleSection(wsR.addRow({ metric: 'Capacity' }));

  const availSec = twoSided('avail', 'Available seconds / unit / yr',
    `${ref.shifts_b}*${ref.hps_b}*${ref.days}*3600*${ref.eff}*(1-${ref.down})`,
    result.baseline.schedule.availableSecondsPerYear.value,
    `${ref.shifts_p}*${ref.hps_p}*${ref.days}*3600*${ref.eff}*(1-${ref.down})`,
    result.proposed.schedule.availableSecondsPerYear.value,
    FMT.int, false);

  const outPer = twoSided('outPer', 'Output / unit / yr',
    `IFERROR(B${availSec}/${ref.mct_b},0)`, result.baseline.fleet.outputPerUnit.value,
    `IFERROR(C${availSec}/${ref.mct_p},0)`, result.proposed.fleet.outputPerUnit.value,
    FMT.int, false);

  const gross = twoSided('gross', 'Pairs to produce (after scrap)',
    `IFERROR(${ref.demand}/${ref.yield_b},0)`, result.baseline.fleet.grossPairsRequired.value,
    `IFERROR(${ref.demand}/${ref.yield_p},0)`, result.proposed.fleet.grossPairsRequired.value,
    FMT.int, false);

  const unitsRow = twoSided('units', 'Units required',
    `${ref.units_b}`, result.baseline.fleet.units.value,
    `${ref.units_p}`, result.proposed.fleet.units.value,
    FMT.int, false);

  styleSection(wsR.addRow({ metric: 'Annual operating cost' }));

  const labourFormula = (side: 'b' | 'p') =>
    input.labour.basis === 'cycleTime'
      ? `${side === 'b' ? ref.lct_b : ref.lct_p}*${side === 'b' ? 'B' : 'C'}${gross}/3600*${ref.rate}`
      : `${side === 'b' ? ref.ops_b : ref.ops_p}*${side === 'b' ? 'B' : 'C'}${unitsRow}*${ref.wage}*12`;

  const lineRow: Record<string, number> = {};
  const bl = (key: string) => result.baseline.lines.find((l) => l.key === key)?.annual.value ?? 0;
  const pl = (key: string) => result.proposed.lines.find((l) => l.key === key)?.annual.value ?? 0;

  lineRow.labour = twoSided('labour', 'Direct labour',
    labourFormula('b'), bl('labour'), labourFormula('p'), pl('labour'), FMT.usd2);

  lineRow.material = twoSided('material', 'Material',
    `${ref.mat_b}*${ref.matPrice_b}*B${gross}`, bl('material'),
    `${ref.mat_p}*${ref.matPrice_p}*C${gross}`, pl('material'), FMT.usd2);

  lineRow.consumables = twoSided('consumables', 'Machine consumables',
    `${ref.consum_b}*B${unitsRow}`, bl('consumables'),
    `${ref.consum_p}*C${unitsRow}`, pl('consumables'), FMT.usd2);

  lineRow.maintenance = twoSided('maintenance', 'Maintenance parts',
    `${ref.maint_b}*B${unitsRow}`, bl('maintenance'),
    `${ref.maint_p}*C${unitsRow}`, pl('maintenance'), FMT.usd2);

  lineRow.energy = twoSided('energy', 'Energy',
    `${ref.kw_b}*B${unitsRow}*B${availSec}/3600*${ref.tariff}*IFERROR(B${gross}/(B${outPer}*B${unitsRow}),0)`, bl('energy'),
    `${ref.kw_p}*C${unitsRow}*C${availSec}/3600*${ref.tariff}*IFERROR(C${gross}/(C${outPer}*C${unitsRow}),0)`, pl('energy'),
    FMT.usd2);

  lineRow.downtime = twoSided('downtime', 'Downtime loss (idle labour)',
    `${ref.dtl_b}`, bl('downtime'), `${ref.dtl_p}`, pl('downtime'), FMT.usd2);

  if (input.costBasis === 'fullCost') {
    lineRow.depreciation = twoSided('depreciation', 'Depreciation',
      `IFERROR(${ref.price_b}*B${unitsRow}/${ref.deprec_b},0)`, bl('depreciation'),
      `IFERROR(${ref.price_p}*C${unitsRow}/${ref.deprec_p},0)`, pl('depreciation'), FMT.usd2);
  }

  const rows = Object.values(lineRow);
  const first = Math.min(...rows);
  const last = Math.max(...rows);

  const totalRow = wsR.addRow({ metric: 'Total annual operating cost' });
  setFormula(totalRow.getCell('b'), `SUM(B${first}:B${last})`, result.baseline.totalAnnual.value, FMT.usd2);
  setFormula(totalRow.getCell('p'), `SUM(C${first}:C${last})`, result.proposed.totalAnnual.value, FMT.usd2);
  setFormula(totalRow.getCell('v'), `B${totalRow.number}-C${totalRow.number}`,
    result.baseline.totalAnnual.value - result.proposed.totalAnnual.value, FMT.usd2);
  totalRow.font = { bold: true };
  styleRow(totalRow);

  const cppRow = wsR.addRow({ metric: 'Cost per good pair' });
  setFormula(cppRow.getCell('b'), `IFERROR(B${totalRow.number}/${ref.demand},0)`, result.baseline.costPerPair.value, FMT.usd4);
  setFormula(cppRow.getCell('p'), `IFERROR(C${totalRow.number}/${ref.demand},0)`, result.proposed.costPerPair.value, FMT.usd4);
  setFormula(cppRow.getCell('v'), `B${cppRow.number}-C${cppRow.number}`, result.savings.perPair.value, FMT.usd4);
  cppRow.font = { bold: true };
  styleRow(cppRow);

  /* ---- savings, with labour discounted by the conversion factor ---- */

  styleSection(wsR.addRow({ metric: 'Saving by line' }));
  const savingRows: number[] = [];
  for (const line of result.savings.lines) {
    const src = lineRow[line.key];
    if (src === undefined) continue;
    // Distinct from the cost row of the same name: in this section column B
    // holds a variance, not a cost, and identical labels made the two
    // indistinguishable to anything reading the sheet by label.
    const row = wsR.addRow({ metric: `${line.label} — saving` });
    // Only labour is discounted: material, parts and energy fall out whether or
    // not anyone is redeployed.
    const formula = line.key === 'labour'
      ? `(B${src}-C${src})*${ref.conv}`
      : `B${src}-C${src}`;
    setFormula(row.getCell('b'), formula, line.annualDelta, FMT.usd2);
    styleRow(row);
    savingRows.push(row.number);
  }

  const savingTotal = wsR.addRow({ metric: 'Net annual saving' });
  setFormula(savingTotal.getCell('b'),
    `SUM(B${Math.min(...savingRows)}:B${Math.max(...savingRows)})`,
    result.savings.totalAnnual.value, FMT.usd2);
  savingTotal.font = { bold: true };
  styleRow(savingTotal);

  for (const [i, rowNum] of savingRows.entries()) {
    const share = wsR.getRow(rowNum).getCell('s');
    setFormula(share, `IFERROR(B${rowNum}/$B$${savingTotal.number},0)`,
      result.savings.lines[i]?.share ?? 0, FMT.pct);
  }

  /* ---- investment and return ---- */

  styleSection(wsR.addRow({ metric: 'Investment & return' }));

  const capexRow = twoSided('capex', 'Capital',
    `${ref.price_b}*B${unitsRow}`, result.investment.baselineCapex.value,
    `${ref.price_p}*C${unitsRow}`, result.investment.proposedCapex.value,
    FMT.usd0, false);

  const incRow = wsR.addRow({ metric: 'Incremental capital' });
  setFormula(incRow.getCell('b'), `C${capexRow}-B${capexRow}`, result.investment.incremental.value, FMT.usd0);
  incRow.font = { bold: true };
  styleRow(incRow);

  // Guarded so a zero or negative saving reads as words rather than #DIV/0!.
  const payRow = wsR.addRow({ metric: 'Payback (months)' });
  const payFormula =
    `IF(B${savingTotal.number}<=0,"No payback",` +
    `IF(B${incRow.number}<=0,"Immediate",` +
    `IFERROR(B${incRow.number}/(B${savingTotal.number}/12),"No payback")))`;
  setFormula(payRow.getCell('b'), payFormula,
    result.payback.kind === 'months' ? Number(result.payback.months.toFixed(6))
      : result.payback.kind === 'immediate' ? 'Immediate' : 'No payback',
    FMT.num2);
  payRow.font = { bold: true };
  styleRow(payRow);

  const roiRow = wsR.addRow({ metric: `${input.horizonYears}-year ROI` });
  setFormula(roiRow.getCell('b'),
    `IFERROR((B${savingTotal.number}*${ref.horizon}-B${incRow.number})/B${incRow.number},0)`,
    result.horizonROI.value, FMT.num2);
  styleRow(roiRow);

  const nbRow = wsR.addRow({ metric: `${input.horizonYears}-year net benefit` });
  setFormula(nbRow.getCell('b'), `B${savingTotal.number}*${ref.horizon}-B${incRow.number}`,
    result.horizonNetBenefit.value, FMT.usd0);
  styleRow(nbRow);

  /* ================= Derivation ================= */

  const wsD = wb.addWorksheet('Derivation');
  wsD.columns = [
    { header: 'Side', key: 'side', width: 26 },
    { header: 'Figure', key: 'figure', width: 30 },
    { header: 'Value', key: 'value', width: 18 },
    { header: 'Unit', key: 'unit', width: 14 },
    { header: 'How it was derived', key: 'formula', width: 82 },
  ];
  styleHeader(wsD.getRow(1));

  // The same formula strings the report shows when a figure is expanded, so a
  // reader can audit the workbook without the application.
  for (const side of [result.baseline, result.proposed]) {
    const add = (figure: string, t: { value: number; formula: string; unit: string }) => {
      const row = wsD.addRow({ side: side.label, figure, value: t.value, unit: t.unit, formula: t.formula });
      row.getCell('value').numFmt = t.unit.includes('USD') ? FMT.usd2 : FMT.num2;
      row.getCell('formula').alignment = { wrapText: true, vertical: 'top' };
      styleRow(row);
    };
    add('Available time', side.schedule.availableSecondsPerYear);
    add('Output per unit', side.fleet.outputPerUnit);
    add('Units required', side.fleet.units);
    add('Pairs to produce', side.fleet.grossPairsRequired);
    add('Operators implied', side.operators);
    add('Capital', side.capex);
    for (const l of side.lines) add(l.label, l.annual);
    add('Cost per pair', side.costPerPair);
  }

  /* ================= Scenarios ================= */

  const wsS = wb.addWorksheet('Scenarios');
  wsS.columns = [
    { header: 'Analysis', key: 'analysis', width: 30 },
    { header: 'Case', key: 'case', width: 18 },
    { header: 'Detail', key: 'detail', width: 46 },
    { header: 'Annual saving', key: 'saving', width: 18 },
    { header: 'Payback (months)', key: 'payback', width: 18 },
    { header: 'Fleet', key: 'fleet', width: 14 },
  ];
  styleHeader(wsS.getRow(1));

  for (const table of scenarios) {
    styleSection(wsS.addRow({ analysis: table.title, detail: table.question }));
    for (const r of table.rows) {
      const row = wsS.addRow({
        analysis: r.isBase ? 'as entered' : '',
        case: r.label,
        detail: r.detail,
        saving: r.annualSaving,
        payback: r.paybackMonths === null ? 'No payback' : r.paybackMonths,
        fleet: r.fleet ? `${r.fleet.baseline} → ${r.fleet.proposed}` : '',
      });
      row.getCell('saving').numFmt = FMT.usd0;
      if (typeof r.paybackMonths === 'number') row.getCell('payback').numFmt = FMT.num2;
      if (r.isBase) row.font = { bold: true };
      styleRow(row);
    }
  }

  /* ================= Validation ================= */

  const wsV = wb.addWorksheet('Validation');
  wsV.columns = [
    { header: 'Severity', key: 'sev', width: 12 },
    { header: 'Field', key: 'field', width: 34 },
    { header: 'Finding', key: 'msg', width: 66 },
    { header: 'What to do', key: 'remedy', width: 66 },
  ];
  styleHeader(wsV.getRow(1));

  if (issues.length === 0) {
    styleRow(wsV.addRow({ sev: 'OK', msg: 'All validation checks pass.' }));
  } else {
    for (const i of issues) {
      const row = wsV.addRow({ sev: i.severity.toUpperCase(), field: i.field, msg: i.message, remedy: i.remedy });
      row.getCell('msg').alignment = { wrapText: true, vertical: 'top' };
      row.getCell('remedy').alignment = { wrapText: true, vertical: 'top' };
      row.getCell('sev').font = { bold: true, color: { argb: i.severity === 'error' ? 'FFB3261E' : 'FF8F4D00' } };
      styleRow(row);
    }
  }

  /* ================= Assumptions ================= */

  const wsA = wb.addWorksheet('Assumptions');
  wsA.columns = [
    { header: 'Assumption', key: 'name', width: 30 },
    { header: 'Value', key: 'value', width: 24 },
    { header: 'What it means', key: 'note', width: 84 },
  ];
  styleHeader(wsA.getRow(1));

  ([
    ['Project', input.projectName, input.article],
    ['Labour basis', input.labour.basis === 'cycleTime' ? 'Cycle time' : 'Headcount',
      input.labour.basis === 'cycleTime'
        ? 'Labour = labour seconds per pair x volume x hourly rate, so it scales with output.'
        : 'Labour = operators per unit x units x wage. Fixed once staffed. Manning must describe one unit, not a line.'],
    ['Cost basis', input.costBasis === 'cash' ? 'Cash' : 'Full cost',
      input.costBasis === 'cash'
        ? 'Depreciation excluded; capital recovered through the payback. Do not also depreciate.'
        : 'Depreciation charged into operating cost. Do not also read payback off the capital — that counts it twice.'],
    ['Savings basis', `${result.basisOutput.value.toLocaleString('en-US')} pairs/yr`,
      'Both sides are costed at this same volume. Comparing each side at its own capacity would reward whichever machine is larger.'],
    ['Labour conversion', `${(input.labour.conversionFactor * 100).toFixed(0)}%`,
      'Share of the theoretical labour saving assumed to be banked as headcount.'],
    ['Scrap', `${((input.baseline.yieldRate ?? 1) * 100).toFixed(1)}% / ${((input.proposed.yieldRate ?? 1) * 100).toFixed(1)}%`,
      'Yield per side. Costs are incurred on pairs produced and stated per good pair.'],
    ['Formula caching', 'Enabled',
      'Every formula carries its computed value, so Google Sheets, LibreOffice and openpyxl read the same figures as Excel.'],
  ] as Array<[string, string, string]>).forEach(([name, value, note]) => {
    const row = wsA.addRow({ name, value, note });
    row.getCell('note').alignment = { wrapText: true, vertical: 'top' };
    styleRow(row);
  });

  /* ================= Photos ================= */

  const sources = (options.images ?? []).filter(Boolean).slice(0, 3);
  if (sources.length > 0) {
    const wsP = wb.addWorksheet('Photos');
    wsP.getColumn(1).width = 4;
    const title = wsP.addRow(['Equipment photos']);
    title.font = { bold: true, size: 12 };
    const loaded = await Promise.all(sources.map(loadImage));
    let anchor = 2;
    for (const img of loaded) {
      if (!img) continue;
      const id = wb.addImage({ base64: img.base64, extension: img.extension });
      wsP.addImage(id, { tl: { col: 1, row: anchor }, ext: { width: 640, height: 360 } });
      anchor += 20;
    }
  }

  return wb;
};

export const exportProjectToExcel = async (
  input: ProjectInput,
  options: ProjectExportOptions = {},
): Promise<void> => {
  const wb = await buildProjectWorkbook(input, options);
  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const safe = (options.fileName || input.projectName || 'ROI_Analysis').replace(/[^\w.-]+/g, '_');
  saveAs(blob, `${safe}_${input.date}.xlsx`);
};
