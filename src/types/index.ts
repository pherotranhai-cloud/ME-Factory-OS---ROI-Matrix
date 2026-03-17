export type Language = 'VI' | 'EN' | 'ZH-CN' | 'ZH-TW' | 'ID' | 'MY';

export interface ROIParams {
  // General Info
  shoeModel: string;
  date: string;
  equipmentName: string;
  machineType: string;
  brand: string;
  scopeOfWork: string;
  machineQuantity: number;
  
  // Technical Specs
  powerSupplyV: string;
  powerConsumptionKW: number;
  speedSPrs: number;
  unitPrice: number;
  
  // Production Data - Manual
  manualCapacityPerHour: number;
  manualDefectiveRate: number;
  manualManpower: number;
  
  // Production Data - Machine
  machineCapacityPerHour: number;
  machineDefectiveRate: number;
  machineManpower: number;
  
  // Shared
  currentMaterialCost: number;
  proposedMaterialCost: number;
  workingHoursPerDay: number;
  localLaborCost: number; // Salary
  
  // New Fields
  maintenanceCostPerYear: number;
  consumablesCostPerYear: number;
  depreciationYears: number;
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
