export type Language = 'VI' | 'EN' | 'ZH-CN' | 'ZH-TW' | 'ID' | 'MY';

export interface MaterialItem {
  id: string;
  type: string;
  description: string;
  supplier: string;
  uom: string;
  usage: number;
  loss: number;
  fob: number;
}

export interface ROIParams {
  // General Info
  shoeModel: string;
  date: string;
  equipmentName: string;
  machineType: string;
  brand: string;
  scopeOfWork: string;
  machineQuantity: number;
  
  // Technical Specs (Current vs Proposed)
  currentPowerSupplyV: string;
  proposedPowerSupplyV: string;
  currentPowerConsumptionKW: number;
  proposedPowerConsumptionKW: number;
  currentSpeedSPrs: number;
  proposedSpeedSPrs: number;
  currentUnitPrice: number;
  proposedUnitPrice: number;
  currentMaintenanceCostPerYear: number;
  proposedMaintenanceCostPerYear: number;
  currentConsumablesCostPerYear: number;
  proposedConsumablesCostPerYear: number;
  currentDepreciationYears: number;
  proposedDepreciationYears: number;
  
  // Production Data - IE Data
  currentCT: number;
  proposedCT: number;
  currentPPH: number;
  proposedPPH: number;
  currentManpower: number;
  proposedManpower: number;
  
  // Production Data - Quality Data
  currentRFT: number;
  proposedRFT: number;
  currentDefectRate: number;
  proposedDefectRate: number;
  
  // Production Data - Material Cost Tables
  currentMaterials: MaterialItem[];
  proposedMaterials: MaterialItem[];
  
  // Shared
  workingHoursPerDay: number;
  localLaborCost: number; // Salary
}

export interface ROIResults {
  manual: {
    annualCapacity: number;
    actualGoodCapacity: number;
    manpowerDemand: number;
    annualLaborCost: number;
    annualMaterialCost: number;
    annualEnergyCost: number;
    annualMaintenance: number;
    annualConsumables: number;
    annualDepreciation: number;
    totalAnnualCost: number;
    costPerPair: number;
    materialCostPerPair: number;
    operatingCostPerPair: number;
  };
  machine: {
    annualCapacity: number;
    actualGoodCapacity: number;
    manpowerDemand: number;
    annualLaborCost: number;
    annualMaterialCost: number;
    annualEnergyCost: number;
    annualMaintenance: number;
    annualConsumables: number;
    annualDepreciation: number;
    totalAnnualCost: number;
    costPerPair: number;
    materialCostPerPair: number;
    operatingCostPerPair: number;
  };
  savings: {
    manpowerSaving: number;
    laborSaving: number;
    materialSaving: number;
    energySaving: number;
    maintenanceSaving: number;
    consumablesSaving: number;
    totalAnnualSaving: number;
    fobImpact: number;
  };
  roiMonths: number;
}
