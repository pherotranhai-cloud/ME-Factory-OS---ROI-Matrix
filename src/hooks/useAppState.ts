import { useState, useEffect } from 'react';
import { ROIParams, ROIResults, Language } from '../types';
import { calculateAdvancedROI } from '../utils/roi-calculations';
export { calculateAdvancedROI };

export const INITIAL_PARAMS: ROIParams = {
  shoeModel: '',
  date: new Date().toISOString().split('T')[0],
  equipmentName: '',
  machineType: '',
  brand: '',
  scopeOfWork: '',
  machineQuantity: 1,
  
  currentPowerSupplyV: '380',
  proposedPowerSupplyV: '380',
  currentPowerConsumptionKW: 0,
  proposedPowerConsumptionKW: 0,
  currentSpeedSPrs: 0,
  proposedSpeedSPrs: 0,
  currentUnitPrice: 0,
  proposedUnitPrice: 0,
  currentMaintenanceCostPerYear: 0,
  proposedMaintenanceCostPerYear: 0,
  currentConsumablesCostPerYear: 0,
  proposedConsumablesCostPerYear: 0,
  currentDepreciationYears: 5,
  proposedDepreciationYears: 5,
  
  currentCT: 0,
  proposedCT: 0,
  currentPPH: 0,
  proposedPPH: 0,
  currentManpower: 0,
  proposedManpower: 0,
  
  currentRFT: 100,
  proposedRFT: 100,
  currentDefectRate: 0,
  proposedDefectRate: 0,
  
  currentMaterials: [],
  proposedMaterials: [],
  
  workingHoursPerDay: 8,
  localLaborCost: 0,
};

export const useAppState = () => {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [lang, setLang] = useState<Language>('EN');
  const [projectName, setProjectName] = useState('New Project ROI');
  const [params, setParams] = useState<ROIParams>(INITIAL_PARAMS);
  const [uploadedImages, setUploadedImages] = useState<string[]>([]);
  const [editingReportId, setEditingReportId] = useState<number | null>(null);
  const [currentStatus, setCurrentStatus] = useState<string>('Draft');
  
  const [advancedResults, setAdvancedResults] = useState<ROIResults | null>(null);
  const [aiEvaluation, setAiEvaluation] = useState<any>(null);
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  useEffect(() => {
    setAdvancedResults(calculateAdvancedROI(params));
  }, [params]);

  const resetForm = () => {
    setProjectName('New Project ROI');
    setParams(INITIAL_PARAMS);
    setAiEvaluation(null);
    setUploadedImages([]);
    setEditingReportId(null);
    setCurrentStatus('Draft');
  };

  const triggerRefresh = () => setRefreshTrigger(prev => prev + 1);

  return {
    activeTab, setActiveTab,
    lang, setLang,
    projectName, setProjectName,
    params, setParams,
    uploadedImages, setUploadedImages,
    editingReportId, setEditingReportId,
    currentStatus, setCurrentStatus,
    advancedResults, setAdvancedResults,
    aiEvaluation, setAiEvaluation,
    isEvaluating, setIsEvaluating,
    isSaving, setIsSaving,
    resetForm,
    refreshTrigger, triggerRefresh
  };
};
