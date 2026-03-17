import { useState, useEffect } from 'react';
import { ROIParams, ROIResults, Language } from '../types';
import { calculateAdvancedROI } from '../utils/roi-calculations';

export const INITIAL_PARAMS: ROIParams = {
  shoeModel: '',
  date: new Date().toISOString().split('T')[0],
  equipmentName: '',
  machineType: '',
  brand: '',
  scopeOfWork: '',
  machineQuantity: 1,
  powerSupplyV: '380',
  powerConsumptionKW: 0,
  speedSPrs: 0,
  unitPrice: 0,
  maintenanceCostPerYear: 0,
  consumablesCostPerYear: 0,
  depreciationYears: 5,
  manualCapacityPerHour: 0,
  manualDefectiveRate: 0,
  manualManpower: 0,
  machineCapacityPerHour: 0,
  machineDefectiveRate: 0,
  machineManpower: 0,
  currentMaterialCost: 0,
  proposedMaterialCost: 0,
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
    resetForm
  };
};
