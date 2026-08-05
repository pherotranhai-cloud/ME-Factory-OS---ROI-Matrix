import { ROIParams, ROIResults } from '../types';

export const calculateAdvancedROI = (p: ROIParams): ROIResults => {
  const DAYS_PER_YEAR = 312;
  const HOURS_PER_YEAR = p.workingHoursPerDay * DAYS_PER_YEAR;
  const POWER_RATE_USD = 0.075; // Approx $0.075 per kWh

  // Calculate Material Costs
  const currentMaterialCost = p.currentMaterials?.reduce((sum, m) => sum + (m.usage * m.fob * (1 + m.loss / 100)), 0) || 0;
  const proposedMaterialCost = p.proposedMaterials?.reduce((sum, m) => sum + (m.usage * m.fob * (1 + m.loss / 100)), 0) || 0;

  // Manual Calculations (Current)
  const manualAnnualCapacity = p.currentPPH * p.currentManpower * HOURS_PER_YEAR;
  const manualActualGood = manualAnnualCapacity * (1 - p.currentDefectRate / 100);
  const manualAnnualLabor = p.currentManpower * p.machineQuantity * p.localLaborCost * 12;
  const manualAnnualEnergy = p.currentPowerConsumptionKW * p.machineQuantity * HOURS_PER_YEAR * POWER_RATE_USD; 
  const manualAnnualMaintenance = p.currentMaintenanceCostPerYear * p.machineQuantity;
  const manualAnnualConsumables = p.currentConsumablesCostPerYear * p.machineQuantity;
  const manualAnnualDepreciation = p.currentDepreciationYears > 0 ? (p.currentUnitPrice * p.machineQuantity) / p.currentDepreciationYears : 0;

  // Total Annual Cost = Labor + Maintenance + Consumables + Energy + Depreciation
  const manualTotalAnnualCost = manualAnnualLabor + manualAnnualEnergy + manualAnnualMaintenance + manualAnnualConsumables + manualAnnualDepreciation;
  // Cost per Pair = Total Annual Cost / Total Annual Output
  const manualOperatingCostPerPair = manualActualGood > 0 ? manualTotalAnnualCost / manualActualGood : 0;
  const manualMaterialCostPerPair = currentMaterialCost;
  const manualCostPerPair = manualOperatingCostPerPair + manualMaterialCostPerPair;
  const manualAnnualMaterial = manualActualGood * currentMaterialCost;

  // Machine Calculations (Proposed)
  const machineAnnualCapacity = p.proposedPPH * p.machineQuantity * HOURS_PER_YEAR;
  const machineActualGood = machineAnnualCapacity * (1 - p.proposedDefectRate / 100);
  const machineAnnualLabor = p.proposedManpower * p.machineQuantity * p.localLaborCost * 12;
  const machineAnnualEnergy = p.proposedPowerConsumptionKW * p.machineQuantity * HOURS_PER_YEAR * POWER_RATE_USD;
  const machineAnnualMaintenance = p.proposedMaintenanceCostPerYear * p.machineQuantity;
  const machineAnnualConsumables = p.proposedConsumablesCostPerYear * p.machineQuantity;
  const machineAnnualDepreciation = p.proposedDepreciationYears > 0 ? (p.proposedUnitPrice * p.machineQuantity) / p.proposedDepreciationYears : 0;
  
  // Total Annual Cost = Labor + Maintenance + Consumables + Energy + Depreciation
  const machineTotalAnnualCost = machineAnnualLabor + machineAnnualEnergy + machineAnnualMaintenance + machineAnnualConsumables + machineAnnualDepreciation;
  // Cost per Pair = Total Annual Cost / Total Annual Output
  const machineOperatingCostPerPair = machineActualGood > 0 ? machineTotalAnnualCost / machineActualGood : 0;
  const machineMaterialCostPerPair = proposedMaterialCost;
  const machineCostPerPair = machineOperatingCostPerPair + machineMaterialCostPerPair;
  const machineAnnualMaterial = machineActualGood * proposedMaterialCost;

  // Savings for SAME OUTPUT (Target = Machine Capacity)
  const manualWorkersNeededForMachineOutput = p.currentPPH > 0 ? (p.proposedPPH / p.currentPPH) * p.currentManpower * p.machineQuantity : 0;
  const manpowerSaving = manualWorkersNeededForMachineOutput - (p.proposedManpower * p.machineQuantity);
  const laborSaving = manpowerSaving * p.localLaborCost * 12;

  // Material Saving (due to lower defective rate and material cost)
  const manualMaterialForSameOutput = machineAnnualCapacity * currentMaterialCost * (1 + p.currentDefectRate / 100);
  const machineMaterialForSameOutput = machineAnnualCapacity * proposedMaterialCost * (1 + p.proposedDefectRate / 100);
  const materialSaving = manualMaterialForSameOutput - machineMaterialForSameOutput;

  const energySaving = manualAnnualEnergy - machineAnnualEnergy;
  const maintenanceSaving = manualAnnualMaintenance - machineAnnualMaintenance;
  const consumablesSaving = manualAnnualConsumables - machineAnnualConsumables;
  
  // FOB Impact is the improvement in operating cost per pair
  const fobImpact = manualCostPerPair - machineCostPerPair;
  const totalAnnualSaving = fobImpact * machineActualGood;
  const netInvestment = (p.proposedUnitPrice - p.currentUnitPrice) * p.machineQuantity;
  const roiMonths = totalAnnualSaving > 0 ? (netInvestment / (totalAnnualSaving / 12)) : Infinity;

  return {
    manual: {
      annualCapacity: manualAnnualCapacity,
      actualGoodCapacity: manualActualGood,
      manpowerDemand: p.currentManpower * p.machineQuantity,
      annualLaborCost: manualAnnualLabor,
      annualMaterialCost: manualAnnualMaterial,
      annualEnergyCost: manualAnnualEnergy,
      annualMaintenance: manualAnnualMaintenance,
      annualConsumables: manualAnnualConsumables,
      annualDepreciation: manualAnnualDepreciation,
      totalAnnualCost: manualTotalAnnualCost,
      costPerPair: manualCostPerPair,
      materialCostPerPair: manualMaterialCostPerPair,
      operatingCostPerPair: manualOperatingCostPerPair
    },
    machine: {
      annualCapacity: machineAnnualCapacity,
      actualGoodCapacity: machineActualGood,
      manpowerDemand: p.proposedManpower * p.machineQuantity,
      annualLaborCost: machineAnnualLabor,
      annualMaterialCost: machineAnnualMaterial,
      annualEnergyCost: machineAnnualEnergy,
      annualMaintenance: machineAnnualMaintenance,
      annualConsumables: machineAnnualConsumables,
      annualDepreciation: machineAnnualDepreciation,
      totalAnnualCost: machineTotalAnnualCost,
      costPerPair: machineCostPerPair,
      materialCostPerPair: machineMaterialCostPerPair,
      operatingCostPerPair: machineOperatingCostPerPair
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
