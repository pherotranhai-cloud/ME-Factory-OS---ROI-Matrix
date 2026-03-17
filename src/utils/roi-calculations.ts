import { ROIParams, ROIResults } from '../types';

export const calculateAdvancedROI = (p: ROIParams): ROIResults => {
  const DAYS_PER_YEAR = 312;
  const HOURS_PER_YEAR = p.workingHoursPerDay * DAYS_PER_YEAR;
  const POWER_RATE_USD = 0.075; // Approx $0.075 per kWh

  // Manual Calculations
  const manualAnnualCapacity = p.manualCapacityPerHour * p.machineQuantity * HOURS_PER_YEAR;
  const manualActualGood = manualAnnualCapacity * (1 - p.manualDefectiveRate / 100);
  const manualAnnualLabor = p.manualManpower * p.machineQuantity * p.localLaborCost * 12;
  const manualAnnualEnergy = 0; 
  const manualAnnualMaintenance = 0;
  const manualAnnualConsumables = 0;
  const manualAnnualDepreciation = 0;

  // Total Annual Cost = Labor + Maintenance + Consumables + Energy + Depreciation
  const manualTotalAnnualCost = manualAnnualLabor + manualAnnualEnergy + manualAnnualMaintenance + manualAnnualConsumables + manualAnnualDepreciation;
  // Cost per Pair = Total Annual Cost / Total Annual Output
  const manualCostPerPair = manualActualGood > 0 ? manualTotalAnnualCost / manualActualGood : 0;
  const manualAnnualMaterial = manualActualGood * p.currentMaterialCost;

  // Machine Calculations
  const machineAnnualCapacity = p.machineCapacityPerHour * p.machineQuantity * HOURS_PER_YEAR;
  const machineActualGood = machineAnnualCapacity * (1 - p.machineDefectiveRate / 100);
  const machineAnnualLabor = p.machineManpower * p.machineQuantity * p.localLaborCost * 12;
  const machineAnnualEnergy = p.powerConsumptionKW * p.machineQuantity * HOURS_PER_YEAR * POWER_RATE_USD;
  const machineAnnualMaintenance = p.maintenanceCostPerYear * p.machineQuantity;
  const machineAnnualConsumables = p.consumablesCostPerYear * p.machineQuantity;
  const machineAnnualDepreciation = p.depreciationYears > 0 ? (p.unitPrice * p.machineQuantity) / p.depreciationYears : 0;
  
  // Total Annual Cost = Labor + Maintenance + Consumables + Energy + Depreciation
  const machineTotalAnnualCost = machineAnnualLabor + machineAnnualEnergy + machineAnnualMaintenance + machineAnnualConsumables + machineAnnualDepreciation;
  // Cost per Pair = Total Annual Cost / Total Annual Output
  const machineCostPerPair = machineActualGood > 0 ? machineTotalAnnualCost / machineActualGood : 0;
  const machineAnnualMaterial = machineActualGood * p.proposedMaterialCost;

  // Savings for SAME OUTPUT (Target = Machine Capacity)
  const manualWorkersNeededForMachineOutput = (p.machineCapacityPerHour / p.manualCapacityPerHour) * p.manualManpower * p.machineQuantity;
  const manpowerSaving = manualWorkersNeededForMachineOutput - (p.machineManpower * p.machineQuantity);
  const laborSaving = manpowerSaving * p.localLaborCost * 12;

  // Material Saving (due to lower defective rate)
  const manualMaterialForSameOutput = machineAnnualCapacity * p.currentMaterialCost * (1 + p.manualDefectiveRate / 100);
  const machineMaterialForSameOutput = machineAnnualCapacity * p.proposedMaterialCost * (1 + p.machineDefectiveRate / 100);
  const materialSaving = manualMaterialForSameOutput - machineMaterialForSameOutput;

  const energySaving = 0 - machineAnnualEnergy;
  const maintenanceSaving = manualAnnualMaintenance - machineAnnualMaintenance;
  const consumablesSaving = manualAnnualConsumables - machineAnnualConsumables;
  
  // FOB Impact is the improvement in operating cost per pair
  const fobImpact = manualCostPerPair - machineCostPerPair;
  const totalAnnualSaving = fobImpact * machineActualGood;
  const roiMonths = totalAnnualSaving > 0 ? ((p.unitPrice * p.machineQuantity) / (totalAnnualSaving / 12)) : Infinity;

  return {
    manual: {
      annualCapacity: manualAnnualCapacity,
      actualGoodCapacity: manualActualGood,
      manpowerDemand: p.manualManpower * p.machineQuantity,
      annualLaborCost: manualAnnualLabor,
      annualMaterialCost: manualAnnualMaterial,
      annualEnergyCost: manualAnnualEnergy,
      annualMaintenance: manualAnnualMaintenance,
      annualConsumables: manualAnnualConsumables,
      annualDepreciation: manualAnnualDepreciation,
      totalAnnualCost: manualTotalAnnualCost,
      costPerPair: manualCostPerPair
    },
    machine: {
      annualCapacity: machineAnnualCapacity,
      actualGoodCapacity: machineActualGood,
      manpowerDemand: p.machineManpower * p.machineQuantity,
      annualLaborCost: machineAnnualLabor,
      annualMaterialCost: machineAnnualMaterial,
      annualEnergyCost: machineAnnualEnergy,
      annualMaintenance: machineAnnualMaintenance,
      annualConsumables: machineAnnualConsumables,
      annualDepreciation: machineAnnualDepreciation,
      totalAnnualCost: machineTotalAnnualCost,
      costPerPair: machineCostPerPair
    },
    savings: {
      manpowerSaving,
      laborSaving,
      materialSaving,
      energySaving,
      maintenanceSaving,
      consumablesSaving,
      totalAnnualSaving,
      fobImpact
    },
    roiMonths
  };
};
