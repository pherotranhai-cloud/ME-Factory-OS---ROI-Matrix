import ExcelJS from 'exceljs';
import { buildWorkbook } from './src/utils/excelExport';
import { calculateAdvancedROI } from './src/utils/roi-calculations';
import * as fs from 'fs';
const p: any = { shoeModel:'T', date:'2026-01-01', equipmentName:'E', machineType:'M', brand:'B', scopeOfWork:'S',
  machineQuantity:2, currentPowerSupplyV:'380', proposedPowerSupplyV:'380', currentPowerConsumptionKW:2,
  proposedPowerConsumptionKW:3, currentSpeedSPrs:0, proposedSpeedSPrs:0, currentUnitPrice:10000, proposedUnitPrice:60000,
  currentMaintenanceCostPerYear:500, proposedMaintenanceCostPerYear:1000, currentConsumablesCostPerYear:200,
  proposedConsumablesCostPerYear:300, currentDepreciationYears:5, proposedDepreciationYears:5, currentCT:60, proposedCT:30,
  currentPPH:60, proposedPPH:120, currentManpower:2, proposedManpower:1, currentRFT:95, proposedRFT:98,
  currentDefectRate:5, proposedDefectRate:2,
  currentMaterials:[{id:'1',type:'U',description:'M',supplier:'S',uom:'pr',usage:1,loss:0,fob:2}],
  proposedMaterials:[{id:'1',type:'U',description:'M',supplier:'S',uom:'pr',usage:1,loss:0,fob:1.8}],
  workingHoursPerDay:8, localLaborCost:300 };
const wb = await buildWorkbook(p, calculateAdvancedROI(p));
const buf = await wb.xlsx.writeBuffer();
fs.writeFileSync('/tmp/probe.xlsx', Buffer.from(buf as ArrayBuffer));
