import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import { ROIParams } from '../types';

export const exportToExcel = async (params: ROIParams, advancedResults: any, t: any) => {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'ROI Calculator';
  workbook.lastModifiedBy = 'ROI Calculator';
  workbook.created = new Date();
  workbook.modified = new Date();

  // Helper to style headers
  const styleHeader = (row: ExcelJS.Row) => {
    row.eachCell((cell) => {
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF4B5563' } // zinc-600
      };
      cell.border = {
        top: { style: 'thin' },
        left: { style: 'thin' },
        bottom: { style: 'thin' },
        right: { style: 'thin' }
      };
      cell.alignment = { vertical: 'middle', horizontal: 'center' };
    });
  };

  const styleDataRow = (row: ExcelJS.Row) => {
    row.eachCell((cell) => {
      cell.border = {
        top: { style: 'thin' },
        left: { style: 'thin' },
        bottom: { style: 'thin' },
        right: { style: 'thin' }
      };
    });
  };

  // --- TAB 1: Overview ---
  const wsOverview = workbook.addWorksheet('Overview', { views: [{ state: 'frozen', ySplit: 1 }] });
  wsOverview.columns = [
    { header: 'Category', key: 'category', width: 25 },
    { header: 'Property', key: 'property', width: 30 },
    { header: 'Current State', key: 'current', width: 25 },
    { header: 'Proposed State', key: 'proposed', width: 25 }
  ];
  styleHeader(wsOverview.getRow(1));

  const overviewData = [
    { category: 'General Info', property: 'Shoe Model', current: params.shoeModel, proposed: params.shoeModel },
    { category: 'General Info', property: 'Date', current: params.date, proposed: params.date },
    { category: 'General Info', property: 'Equipment Name', current: params.equipmentName, proposed: params.equipmentName },
    { category: 'General Info', property: 'Machine Type', current: params.machineType, proposed: params.machineType },
    { category: 'General Info', property: 'Brand', current: params.brand, proposed: params.brand },
    { category: 'General Info', property: 'Scope of Work', current: params.scopeOfWork, proposed: params.scopeOfWork },
    { category: 'General Info', property: 'Machine Quantity', current: params.machineQuantity, proposed: params.machineQuantity },
    { category: 'Technical Specs', property: 'Power Supply (V)', current: params.currentPowerSupplyV, proposed: params.proposedPowerSupplyV },
    { category: 'Technical Specs', property: 'Power Consumption (kW)', current: params.currentPowerConsumptionKW, proposed: params.proposedPowerConsumptionKW },
    { category: 'Technical Specs', property: 'Speed (s/prs)', current: params.currentSpeedSPrs, proposed: params.proposedSpeedSPrs },
    { category: 'Technical Specs', property: 'Unit Price (USD)', current: params.currentUnitPrice, proposed: params.proposedUnitPrice },
    { category: 'Technical Specs', property: 'Maintenance Cost/Yr (USD)', current: params.currentMaintenanceCostPerYear, proposed: params.proposedMaintenanceCostPerYear },
    { category: 'Technical Specs', property: 'Consumables Cost/Yr (USD)', current: params.currentConsumablesCostPerYear, proposed: params.proposedConsumablesCostPerYear },
    { category: 'Technical Specs', property: 'Depreciation (Years)', current: params.currentDepreciationYears, proposed: params.proposedDepreciationYears },
  ];

  overviewData.forEach(data => {
    const row = wsOverview.addRow(data);
    styleDataRow(row);
  });

  // Format currency columns in Overview
  wsOverview.getColumn('current').eachCell((cell, rowNumber) => {
    if (rowNumber > 1 && typeof cell.value === 'number' && overviewData[rowNumber - 2].property.includes('USD')) {
      cell.numFmt = '"$"#,##0.00';
    }
  });
  wsOverview.getColumn('proposed').eachCell((cell, rowNumber) => {
    if (rowNumber > 1 && typeof cell.value === 'number' && overviewData[rowNumber - 2].property.includes('USD')) {
      cell.numFmt = '"$"#,##0.00';
    }
  });

  // --- TAB 2: Calculations ---
  const wsCalc = workbook.addWorksheet('Calculations', { views: [{ state: 'frozen', ySplit: 1 }] });
  wsCalc.columns = [
    { header: 'Category', key: 'category', width: 25 },
    { header: 'Metric', key: 'metric', width: 30 },
    { header: 'Current State', key: 'current', width: 20 },
    { header: 'Proposed State', key: 'proposed', width: 20 }
  ];
  styleHeader(wsCalc.getRow(1));

  const calcData = [
    { category: 'IE Data', metric: 'Cycle Time (CT) s', current: params.currentCT, proposed: params.proposedCT },
    { category: 'IE Data', metric: 'Pieces Per Hour (PPH)', current: params.currentPPH, proposed: params.proposedPPH },
    { category: 'IE Data', metric: 'Manpower Demand (prs)', current: params.currentManpower, proposed: params.proposedManpower },
    { category: 'Quality Data', metric: 'RFT %', current: params.currentRFT, proposed: params.proposedRFT },
    { category: 'Quality Data', metric: 'Total Defect Rate %', current: params.currentDefectRate, proposed: params.proposedDefectRate },
    { category: 'Operations', metric: 'Working Hours / Day', current: params.workingHoursPerDay, proposed: params.workingHoursPerDay },
    { category: 'Operations', metric: 'Local Labor Cost (USD/mo)', current: params.localLaborCost, proposed: params.localLaborCost },
  ];

  calcData.forEach(data => {
    const row = wsCalc.addRow(data);
    styleDataRow(row);
  });

  wsCalc.addRow([]); // empty row

  // Material Costs Current
  const matCurrentHeader = wsCalc.addRow(['Material Cost Breakdown - Current State']);
  matCurrentHeader.font = { bold: true };
  const matHeaders = ['Type', 'Description', 'Supplier', 'UOM', 'Usage', 'Loss %', 'FOB ($)', 'Cost/Pr ($)'];
  const matHeaderRow1 = wsCalc.addRow(matHeaders);
  styleHeader(matHeaderRow1);

  let currentMatStartRow = wsCalc.rowCount + 1;
  (params.currentMaterials || []).forEach(m => {
    const row = wsCalc.addRow([m.type, m.description, m.supplier, m.uom, m.usage, m.loss, m.fob]);
    // Formula for Cost/Pr: Usage * FOB * (1 + Loss/100)
    // Columns: Usage=E, Loss=F, FOB=G
    row.getCell(8).value = { formula: `E${row.number}*G${row.number}*(1+F${row.number}/100)`, date1904: false };
    row.getCell(8).numFmt = '"$"#,##0.0000';
    row.getCell(7).numFmt = '"$"#,##0.0000';
    styleDataRow(row);
  });
  let currentMatEndRow = wsCalc.rowCount;
  const currentTotalRow = wsCalc.addRow(['', '', '', '', '', '', 'Total Cost/Pair', { formula: `SUM(H${currentMatStartRow}:H${currentMatEndRow})`, date1904: false }]);
  currentTotalRow.getCell(8).numFmt = '"$"#,##0.0000';
  currentTotalRow.font = { bold: true };

  wsCalc.addRow([]); // empty row

  // Material Costs Proposed
  const matProposedHeader = wsCalc.addRow(['Material Cost Breakdown - Proposed State']);
  matProposedHeader.font = { bold: true };
  const matHeaderRow2 = wsCalc.addRow(matHeaders);
  styleHeader(matHeaderRow2);

  let proposedMatStartRow = wsCalc.rowCount + 1;
  (params.proposedMaterials || []).forEach(m => {
    const row = wsCalc.addRow([m.type, m.description, m.supplier, m.uom, m.usage, m.loss, m.fob]);
    row.getCell(8).value = { formula: `E${row.number}*G${row.number}*(1+F${row.number}/100)`, date1904: false };
    row.getCell(8).numFmt = '"$"#,##0.0000';
    row.getCell(7).numFmt = '"$"#,##0.0000';
    styleDataRow(row);
  });
  let proposedMatEndRow = wsCalc.rowCount;
  const proposedTotalRow = wsCalc.addRow(['', '', '', '', '', '', 'Total Cost/Pair', { formula: `SUM(H${proposedMatStartRow}:H${proposedMatEndRow})`, date1904: false }]);
  proposedTotalRow.getCell(8).numFmt = '"$"#,##0.0000';
  proposedTotalRow.font = { bold: true };


  // --- TAB 3: Financials ---
  const wsFin = workbook.addWorksheet('Financials', { views: [{ state: 'frozen', ySplit: 1 }] });
  wsFin.columns = [
    { header: 'Metric', key: 'metric', width: 35 },
    { header: 'Current State', key: 'current', width: 20 },
    { header: 'Proposed State', key: 'proposed', width: 20 },
    { header: 'Difference', key: 'diff', width: 20 }
  ];
  styleHeader(wsFin.getRow(1));

  // We will output static values for inputs, and formulas for calculated fields where possible.
  // To keep it simple and robust, we'll write the values from advancedResults but also allow some formulas.
  
  const finData = [
    { metric: 'Annual Labor Cost', current: advancedResults?.manual.annualLaborCost, proposed: advancedResults?.machine.annualLaborCost },
    { metric: 'Annual Maintenance', current: params.currentMaintenanceCostPerYear, proposed: params.proposedMaintenanceCostPerYear },
    { metric: 'Annual Consumables', current: params.currentConsumablesCostPerYear, proposed: params.proposedConsumablesCostPerYear },
    { metric: 'Annual Depreciation', current: params.currentUnitPrice / (params.currentDepreciationYears || 1), proposed: params.proposedUnitPrice / (params.proposedDepreciationYears || 1) },
    { metric: 'Material Cost per Pair', current: advancedResults?.manual.materialCostPerPair, proposed: advancedResults?.machine.materialCostPerPair },
    { metric: 'Operating Cost per Pair', current: advancedResults?.manual.operatingCostPerPair, proposed: advancedResults?.machine.operatingCostPerPair },
    { metric: 'Total Annual Cost', current: advancedResults?.manual.totalAnnualCost, proposed: advancedResults?.machine.totalAnnualCost },
    { metric: 'Cost per Pair (FOB)', current: advancedResults?.manual.costPerPair, proposed: advancedResults?.machine.costPerPair },
  ];

  finData.forEach((data, index) => {
    const row = wsFin.addRow([data.metric, data.current, data.proposed]);
    // Difference formula: Current - Proposed
    row.getCell(4).value = { formula: `B${row.number}-C${row.number}`, date1904: false };
    
    // Format as currency
    row.getCell(2).numFmt = '"$"#,##0.00';
    row.getCell(3).numFmt = '"$"#,##0.00';
    row.getCell(4).numFmt = '"$"#,##0.00';
    styleDataRow(row);
  });

  // Add ROI Summary
  wsFin.addRow([]);
  const roiHeader = wsFin.addRow(['ROI Summary']);
  roiHeader.font = { bold: true };
  
  const totalInvestmentRow = wsFin.addRow(['Total Investment', params.proposedUnitPrice * params.machineQuantity]);
  totalInvestmentRow.getCell(2).numFmt = '"$"#,##0.00';
  
  const totalSavingsRow = wsFin.addRow(['Total Annual Savings', advancedResults?.savings.totalAnnualSaving]);
  totalSavingsRow.getCell(2).numFmt = '"$"#,##0.00';
  
  const roiMonthsRow = wsFin.addRow(['ROI (Months)', { formula: `(B${totalInvestmentRow.number}/B${totalSavingsRow.number})*12`, date1904: false }]);
  roiMonthsRow.getCell(2).numFmt = '0.00';

  // Generate and save file
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  saveAs(blob, `CAPEX_Proposal_${params.shoeModel}_${params.date}.xlsx`);
};
