import React, { useState } from 'react';
import { Upload, X, Sparkles, Plus, Trash2, Download, FileSpreadsheet, Image as ImageIcon, Check, ArrowDown, ArrowUp, Info } from 'lucide-react';
import { motion } from 'framer-motion';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { ROIParams, MaterialItem, DEFAULT_ASSUMPTIONS } from '../../types';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const InputField = ({ label, value, onChange, type = "number", suffix, className = "", tooltip }: any) => (
  <div className={cn("mb-4", className)}>
    <div className="flex items-center gap-1.5 mb-1.5">
      <label className="factory-label !mb-0">{label}</label>
      {tooltip && (
        <div className="group relative">
          <Info size={12} className="text-zinc-600 cursor-help hover:text-emerald-500 transition-colors" />
          <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 p-2 bg-zinc-900 border border-zinc-800 rounded-lg shadow-2xl text-[10px] text-zinc-400 opacity-0 group-hover:opacity-100 pointer-events-none transition-all duration-200 z-50 leading-relaxed translate-y-1 group-hover:translate-y-0 backdrop-blur-md">
            <div className="font-bold text-emerald-500 mb-1 uppercase tracking-tighter">Field Info</div>
            {tooltip}
          </div>
        </div>
      )}
    </div>
    <div className="relative">
      <input
        type={type}
        value={value ?? ''}
        onChange={(e) => onChange(type === "number" ? parseFloat(e.target.value) || 0 : e.target.value)}
        className="factory-input w-full text-sm py-1.5"
      />
      {suffix && (
        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-zinc-600 font-mono">
          {suffix}
        </span>
      )}
    </div>
  </div>
);

import { supabase } from '../../lib/supabase';

const ImageUpload = ({ images, setImages, t }: { images: string[], setImages: (imgs: string[]) => void, t: any }) => {
  const [uploading, setUploading] = useState(false);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    setUploading(true);

    try {
      const uploadPromises = files.map(async (file: File) => {
        const fileExt = file.name.split('.').pop();
        const fileName = `${Math.random().toString(36).substring(2, 15)}_${Date.now()}.${fileExt}`;
        const filePath = `public/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from('report-images')
          .upload(filePath, file);

        if (uploadError) {
          throw uploadError;
        }

        const { data: { publicUrl } } = supabase.storage
          .from('report-images')
          .getPublicUrl(filePath);

        return publicUrl;
      });

      const urls = await Promise.all(uploadPromises);
      setImages([...(images || []), ...urls].slice(0, 3));
    } catch (err: any) {
      console.error("Supabase Upload Error:", err);
      alert('Upload failed: ' + err.message);
    } finally {
      setUploading(false);
    }
  };

  const removeImage = (index: number) => {
    setImages((images || []).filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-4">
      <label className="factory-label">{t.machinePhotos || 'Machine Photos (Max 3)'}</label>
      <div className="grid grid-cols-3 gap-2">
        {images?.map((url, i) => (
          <div key={i} className="relative aspect-square factory-border overflow-hidden group">
            <img src={url} alt="Upload" className="w-full h-full object-cover" />
            <button 
              onClick={() => removeImage(i)}
              className="absolute top-1 right-1 p-1 bg-red-600 text-white rounded opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <X size={10} />
            </button>
          </div>
        ))}
        {(images?.length || 0) < 3 && (
          <label className="aspect-square factory-border flex flex-col items-center justify-center cursor-pointer hover:bg-zinc-900 transition-colors border-dashed">
            <input type="file" multiple accept="image/*" className="hidden" onChange={handleFileChange} disabled={uploading} />
            <Upload size={16} className={uploading ? "animate-bounce text-emerald-500" : "text-zinc-500"} />
            <span className="text-[8px] font-bold uppercase mt-2 text-zinc-600">{uploading ? (t.uploading || 'Uploading...') : (t.addPhoto || 'Add Photo')}</span>
          </label>
        )}
      </div>
    </div>
  );
};

const MaterialTable = ({ materials, setMaterials, title, t }: { materials: MaterialItem[], setMaterials: (m: MaterialItem[]) => void, title: string, t: any }) => {
  const addRow = () => {
    setMaterials([...(materials || []), { id: Math.random().toString(), type: '', description: '', supplier: '', uom: '', usage: 0, loss: 0, fob: 0 }]);
  };

  const updateRow = (id: string, field: keyof MaterialItem, value: any) => {
    setMaterials((materials || []).map(m => m.id === id ? { ...m, [field]: value } : m));
  };

  const removeRow = (id: string) => {
    setMaterials((materials || []).filter(m => m.id !== id));
  };

  const totalCost = (materials || []).reduce((sum, m) => sum + (m.usage * m.fob * (1 + m.loss / 100)), 0);

  return (
    <div className="space-y-4 bg-zinc-900/30 p-4 rounded border border-zinc-800">
      <div className="flex justify-between items-center">
        <h3 className="text-[10px] font-bold uppercase text-zinc-400 tracking-widest">{title}</h3>
        <button onClick={addRow} className="flex items-center gap-1 text-[10px] bg-zinc-800 hover:bg-zinc-700 px-2 py-1 rounded text-zinc-300 transition-colors">
          <Plus size={12} /> {t.addMaterial || 'Add Material'}
        </button>
      </div>
      
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-zinc-800 text-[10px] text-zinc-500 uppercase tracking-wider">
              <th className="p-2 font-medium">
                <div className="flex items-center gap-1">
                  {t.type || 'Type'}
                  <div className="group relative">
                    <Info size={10} className="text-zinc-600 cursor-help" />
                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-32 p-2 bg-zinc-900 border border-zinc-800 rounded shadow-xl text-[9px] text-zinc-400 opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-50 normal-case font-normal">
                      Category of material (e.g., Fabric, Foam).
                    </div>
                  </div>
                </div>
              </th>
              <th className="p-2 font-medium">
                <div className="flex items-center gap-1">
                  {t.description || 'Description'}
                  <div className="group relative">
                    <Info size={10} className="text-zinc-600 cursor-help" />
                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-32 p-2 bg-zinc-900 border border-zinc-800 rounded shadow-xl text-[9px] text-zinc-400 opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-50 normal-case font-normal">
                      Detailed name or specification.
                    </div>
                  </div>
                </div>
              </th>
              <th className="p-2 font-medium">
                <div className="flex items-center gap-1">
                  {t.supplier || 'Supplier'}
                  <div className="group relative">
                    <Info size={10} className="text-zinc-600 cursor-help" />
                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-32 p-2 bg-zinc-900 border border-zinc-800 rounded shadow-xl text-[9px] text-zinc-400 opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-50 normal-case font-normal">
                      The company providing the material.
                    </div>
                  </div>
                </div>
              </th>
              <th className="p-2 font-medium">
                <div className="flex items-center gap-1">
                  {t.uom || 'UOM'}
                  <div className="group relative">
                    <Info size={10} className="text-zinc-600 cursor-help" />
                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-32 p-2 bg-zinc-900 border border-zinc-800 rounded shadow-xl text-[9px] text-zinc-400 opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-50 normal-case font-normal">
                      Unit of Measure (e.g., m, kg, prs).
                    </div>
                  </div>
                </div>
              </th>
              <th className="p-2 font-medium">
                <div className="flex items-center gap-1">
                  {t.usage || 'Usage'}
                  <div className="group relative">
                    <Info size={10} className="text-zinc-600 cursor-help" />
                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-32 p-2 bg-zinc-900 border border-zinc-800 rounded shadow-xl text-[9px] text-zinc-400 opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-50 normal-case font-normal">
                      Amount of material used per pair.
                    </div>
                  </div>
                </div>
              </th>
              <th className="p-2 font-medium">
                <div className="flex items-center gap-1">
                  {t.loss || 'Loss %'}
                  <div className="group relative">
                    <Info size={10} className="text-zinc-600 cursor-help" />
                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-32 p-2 bg-zinc-900 border border-zinc-800 rounded shadow-xl text-[9px] text-zinc-400 opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-50 normal-case font-normal">
                      Percentage of material wasted.
                    </div>
                  </div>
                </div>
              </th>
              <th className="p-2 font-medium">
                <div className="flex items-center gap-1">
                  {t.fob || 'FOB ($)'}
                  <div className="group relative">
                    <Info size={10} className="text-zinc-600 cursor-help" />
                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-32 p-2 bg-zinc-900 border border-zinc-800 rounded shadow-xl text-[9px] text-zinc-400 opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-50 normal-case font-normal">
                      Free On Board price per unit.
                    </div>
                  </div>
                </div>
              </th>
              <th className="p-2 font-medium text-right">{t.costPerPr || 'Cost/Pr'}</th>
              <th className="p-2"></th>
            </tr>
          </thead>
          <tbody>
            {(materials || []).map(m => {
              const cost = m.usage * m.fob * (1 + m.loss / 100);
              return (
                <tr key={m.id} className="border-b border-zinc-800/50">
                  <td className="p-1"><input type="text" value={m.type} onChange={e => updateRow(m.id, 'type', e.target.value)} className="w-full bg-transparent border border-zinc-800 rounded px-2 py-1 text-xs text-zinc-300 focus:border-emerald-500 outline-none" /></td>
                  <td className="p-1"><input type="text" value={m.description} onChange={e => updateRow(m.id, 'description', e.target.value)} className="w-full bg-transparent border border-zinc-800 rounded px-2 py-1 text-xs text-zinc-300 focus:border-emerald-500 outline-none" /></td>
                  <td className="p-1"><input type="text" value={m.supplier} onChange={e => updateRow(m.id, 'supplier', e.target.value)} className="w-full bg-transparent border border-zinc-800 rounded px-2 py-1 text-xs text-zinc-300 focus:border-emerald-500 outline-none" /></td>
                  <td className="p-1"><input type="text" value={m.uom} onChange={e => updateRow(m.id, 'uom', e.target.value)} className="w-20 bg-transparent border border-zinc-800 rounded px-2 py-1 text-xs text-zinc-300 focus:border-emerald-500 outline-none" /></td>
                  <td className="p-1"><input type="number" value={m.usage} onChange={e => updateRow(m.id, 'usage', parseFloat(e.target.value) || 0)} className="w-20 bg-transparent border border-zinc-800 rounded px-2 py-1 text-xs text-zinc-300 focus:border-emerald-500 outline-none" /></td>
                  <td className="p-1"><input type="number" value={m.loss} onChange={e => updateRow(m.id, 'loss', parseFloat(e.target.value) || 0)} className="w-20 bg-transparent border border-zinc-800 rounded px-2 py-1 text-xs text-zinc-300 focus:border-emerald-500 outline-none" /></td>
                  <td className="p-1"><input type="number" value={m.fob} onChange={e => updateRow(m.id, 'fob', parseFloat(e.target.value) || 0)} className="w-20 bg-transparent border border-zinc-800 rounded px-2 py-1 text-xs text-zinc-300 focus:border-emerald-500 outline-none" /></td>
                  <td className="p-2 text-right text-xs font-mono text-emerald-400">${cost.toFixed(4)}</td>
                  <td className="p-1 text-right">
                    <button onClick={() => removeRow(m.id)} className="text-zinc-600 hover:text-red-500 p-1"><Trash2 size={14} /></button>
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={7} className="p-2 text-right text-[10px] font-bold uppercase text-zinc-500">{t.totalCostPair || 'Total Cost/Pair'}</td>
              <td className="p-2 text-right text-sm font-bold font-mono text-emerald-400">${totalCost.toFixed(4)}</td>
              <td></td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
};

interface ROICalculatorFormProps {
  t: any;
  params: ROIParams;
  setParams: (params: ROIParams) => void;
  uploadedImages: string[];
  setUploadedImages: (images: string[]) => void;
  advancedResults?: any;
  onAnalyze?: () => void;
}

export const ROICalculatorForm: React.FC<ROICalculatorFormProps> = ({ t, params, setParams, uploadedImages, setUploadedImages, advancedResults, onAnalyze }) => {
  const [roiStep, setRoiStep] = useState(1);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between mb-12 relative px-4">
        <div className="absolute top-1/2 left-0 w-full h-0.5 bg-zinc-800 -translate-y-1/2 z-0" />
        {[1, 2, 3, 4].map((s, idx) => {
          const isActive = roiStep === s;
          const isCompleted = roiStep > s;
          
          return (
            <React.Fragment key={s}>
              <div className="relative z-0 flex flex-col items-center">
                <button
                  onClick={() => setRoiStep(s)}
                  className={cn(
                    "w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold transition-all border-2",
                    isActive ? "bg-[#006D77] border-transparent text-white shadow-lg scale-110" :
                    isCompleted ? "bg-[#83C5BE]/30 border-[#006D77] text-[#006D77]" :
                    "bg-white/60 border-white/60 text-[#4A6B6F] hover:border-[#006D77]/50"
                  )}
                >
                  {isCompleted ? <Check size={18} /> : s}
                </button>
                <span className={cn(
                  "text-[9px] font-black uppercase tracking-widest mt-3",
                  isActive ? "text-[#002D32]" : isCompleted ? "text-[#006D77]/70" : "text-[#4A6B6F]"
                )}>
                  {s === 1 ? t.generalInfo : s === 2 ? t.techSpecs : s === 3 ? t.prodData : t.financialMetrics}
                </span>
              </div>
            </React.Fragment>
          );
        })}
      </div>

      <div className="glass-card p-8 rounded-[24px] shadow-xl min-h-[500px]">
        {roiStep === 1 && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
            <h2 className="text-xs font-bold uppercase tracking-widest text-ims-primary mb-6">{t.generalInfo}</h2>
            <InputField label={t.shoeModel} type="text" value={params.shoeModel} onChange={(v: any) => setParams({...params, shoeModel: v})} tooltip="The specific model of the shoe being produced (e.g., Ultraboost 2024)." />
            <InputField label={t.date} type="date" value={params.date} onChange={(v: any) => setParams({...params, date: v})} tooltip="The date of the ROI evaluation." />
            <InputField label={t.equipment} type="text" value={params.equipmentName} onChange={(v: any) => setParams({...params, equipmentName: v})} tooltip="The name of the machine or equipment being evaluated." />
            <InputField label={t.machineType} type="text" value={params.machineType} onChange={(v: any) => setParams({...params, machineType: v})} tooltip="The category of the machine (e.g., Stitching, Cutting, Assembly)." />
            <InputField label={t.brand} type="text" value={params.brand} onChange={(v: any) => setParams({...params, brand: v})} tooltip="The manufacturer or brand of the equipment." />
            <InputField label={t.scopeOfWork} type="text" value={params.scopeOfWork} onChange={(v: any) => setParams({...params, scopeOfWork: v})} tooltip="Brief description of the process this machine handles." />
            <InputField label={t.machineQuantity} type="number" value={params.machineQuantity} onChange={(v: any) => setParams({...params, machineQuantity: v})} tooltip="Number of units being considered for purchase or replacement." />
          </motion.div>
        )}

        {roiStep === 2 && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
            <h2 className="text-xs font-bold uppercase tracking-widest text-ims-secondary mb-6">{t.techSpecs}</h2>
            
            <div className="grid grid-cols-2 gap-6">
              {/* Current State Column */}
              <div className="space-y-4 p-6 bg-white/60 border border-white/60 rounded-2xl">
                <h3 className="text-[10px] font-bold uppercase tracking-widest text-[#4A6B6F] border-b border-[#006D77]/10 pb-2 mb-4">{t.manual}</h3>
                <InputField label={t.powerSupply} type="text" value={params.currentPowerSupplyV} onChange={(v: any) => setParams({...params, currentPowerSupplyV: v})} suffix="V" tooltip="Required voltage for the manual process equipment." />
                <InputField label={t.powerConsumption} value={params.currentPowerConsumptionKW} onChange={(v: any) => setParams({...params, currentPowerConsumptionKW: v})} suffix="kW" tooltip="Energy usage in kilowatts per hour for the manual process." />
                <InputField label={t.speed} value={params.currentSpeedSPrs} onChange={(v: any) => setParams({...params, currentSpeedSPrs: v})} suffix="s/prs" tooltip="Current production speed measured in seconds per pair." />
                <InputField label={t.unitPrice} value={params.currentUnitPrice} onChange={(v: any) => setParams({...params, currentUnitPrice: v})} suffix="USD" tooltip="The estimated value or cost of current manual setup." />
                <InputField label={t.maintenanceCost} value={params.currentMaintenanceCostPerYear} onChange={(v: any) => setParams({...params, currentMaintenanceCostPerYear: v})} suffix="USD/Yr" tooltip="Estimated annual cost for repairs and maintenance of current setup." />
                <InputField label={t.consumablesCost} value={params.currentConsumablesCostPerYear} onChange={(v: any) => setParams({...params, currentConsumablesCostPerYear: v})} suffix="USD/Yr" tooltip="Estimated annual cost for parts that need regular replacement." />
                <InputField label={t.depreciation} value={params.currentDepreciationYears} onChange={(v: any) => setParams({...params, currentDepreciationYears: v})} suffix="Years" tooltip="Number of years over which the current equipment value is written off." />
              </div>

              {/* Proposed State Column */}
              <div className="space-y-4 p-6 bg-ims-primary/5 border border-ims-primary/20 rounded-2xl">
                <h3 className="text-[10px] font-bold uppercase tracking-widest text-ims-primary border-b border-ims-primary/10 pb-2 mb-4">{t.machine}</h3>
                <InputField label={t.powerSupply} type="text" value={params.proposedPowerSupplyV} onChange={(v: any) => setParams({...params, proposedPowerSupplyV: v})} suffix="V" tooltip="Required voltage for the new machine." />
                <InputField label={t.powerConsumption} value={params.proposedPowerConsumptionKW} onChange={(v: any) => setParams({...params, proposedPowerConsumptionKW: v})} suffix="kW" tooltip="Energy usage in kilowatts per hour for the new machine." />
                <InputField label={t.speed} value={params.proposedSpeedSPrs} onChange={(v: any) => setParams({...params, proposedSpeedSPrs: v})} suffix="s/prs" tooltip="Target production speed measured in seconds per pair." />
                <InputField label={t.unitPrice} value={params.proposedUnitPrice} onChange={(v: any) => setParams({...params, proposedUnitPrice: v})} suffix="USD" tooltip="The purchase price of one new unit in USD." />
                <InputField label={t.maintenanceCost} value={params.proposedMaintenanceCostPerYear} onChange={(v: any) => setParams({...params, proposedMaintenanceCostPerYear: v})} suffix="USD/Yr" tooltip="Estimated annual cost for repairs and maintenance of the new machine." />
                <InputField label={t.consumablesCost} value={params.proposedConsumablesCostPerYear} onChange={(v: any) => setParams({...params, proposedConsumablesCostPerYear: v})} suffix="USD/Yr" tooltip="Estimated annual cost for parts that need regular replacement." />
                <InputField label={t.depreciation} value={params.proposedDepreciationYears} onChange={(v: any) => setParams({...params, proposedDepreciationYears: v})} suffix="Years" tooltip="Number of years over which the new machine value is written off." />
              </div>
            </div>

            <div className="pt-4 border-t border-zinc-800">
              <ImageUpload images={uploadedImages} setImages={setUploadedImages} t={t} />
            </div>
          </motion.div>
        )}

        {roiStep === 3 && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-8">
            <h2 className="text-xs font-bold uppercase tracking-widest text-orange-500 mb-6">{t.prodData}</h2>
            
            {/* IE & Quality Data Matrix */}
            <div className="grid grid-cols-2 gap-6">
              <div className="space-y-6 p-6 bg-white/60 border border-white/60 rounded-2xl">
                <h3 className="text-[10px] font-bold uppercase tracking-widest text-[#4A6B6F] border-b border-[#006D77]/10 pb-2">{t.manual}</h3>
                <div className="space-y-4">
                  <h4 className="text-[10px] font-bold text-[#4A6B6F]/80">{t.ieData || 'IE Data'}</h4>
                  <InputField label={t.cycleTime || 'Cycle Time (CT)'} value={params.currentCT} onChange={(v: any) => setParams({...params, currentCT: v, currentPPH: v > 0 ? Number((3600 / v).toFixed(2)) : 0})} suffix="s" tooltip="Time taken to complete one unit of work in the current manual process." />
                  <InputField label={t.piecesPerHour || 'Pieces Per Hour (PPH)'} value={params.currentPPH} onChange={(v: any) => setParams({...params, currentPPH: v})} suffix="prs/hr" tooltip="Calculated output based on current cycle time." />
                  <InputField label={t.manpowerDemand} value={params.currentManpower} onChange={(v: any) => setParams({...params, currentManpower: v})} suffix="prs" tooltip="Number of operators required for the current manual process." />
                </div>
                <div className="space-y-4 pt-4 border-t border-[#006D77]/10">
                  <h4 className="text-[10px] font-bold text-[#4A6B6F]/80">{t.qualityData || 'Quality Data'}</h4>
                  <InputField label={t.rft || 'RFT %'} value={params.currentRFT} onChange={(v: any) => setParams({...params, currentRFT: v})} suffix="%" tooltip="Right First Time percentage - measure of current quality accuracy." />
                  <InputField label={t.totalDefectRate || 'Total Defect Rate'} value={params.currentDefectRate} onChange={(v: any) => setParams({...params, currentDefectRate: v})} suffix="%" tooltip="Current percentage of units that require rework or are scrapped." />
                </div>
              </div>

              <div className="space-y-6 p-6 bg-ims-primary/5 border border-ims-primary/20 rounded-2xl">
                <h3 className="text-[10px] font-bold uppercase tracking-widest text-ims-primary border-b border-ims-primary/10 pb-2">{t.machine}</h3>
                <div className="space-y-4">
                  <h4 className="text-[10px] font-bold text-ims-primary/70">{t.ieData || 'IE Data'}</h4>
                  <InputField label={t.cycleTime || 'Cycle Time (CT)'} value={params.proposedCT} onChange={(v: any) => setParams({...params, proposedCT: v, proposedPPH: v > 0 ? Number((3600 / v).toFixed(2)) : 0})} suffix="s" tooltip="Target time to complete one unit of work with the new machine." />
                  <InputField label={t.piecesPerHour || 'Pieces Per Hour (PPH)'} value={params.proposedPPH} onChange={(v: any) => setParams({...params, proposedPPH: v})} suffix="prs/hr" tooltip="Target output based on proposed cycle time." />
                  <InputField label={t.manpowerDemand} value={params.proposedManpower} onChange={(v: any) => setParams({...params, proposedManpower: v})} suffix="prs" tooltip="Number of operators required to run the new machine." />
                </div>
                <div className="space-y-4 pt-4 border-t border-emerald-900/30">
                  <h4 className="text-[10px] font-bold text-emerald-600/70">{t.qualityData || 'Quality Data'}</h4>
                  <InputField label={t.rft || 'RFT %'} value={params.proposedRFT} onChange={(v: any) => setParams({...params, proposedRFT: v})} suffix="%" tooltip="Target Right First Time percentage with the new machine." />
                  <InputField label={t.totalDefectRate || 'Total Defect Rate'} value={params.proposedDefectRate} onChange={(v: any) => setParams({...params, proposedDefectRate: v})} suffix="%" tooltip="Target percentage of units requiring rework with the new machine." />
                </div>
              </div>
            </div>

            {/* Dynamic Material Cost Tables */}
            <div className="space-y-6 pt-4 border-t border-zinc-800">
              <h3 className="text-xs font-bold uppercase tracking-widest text-purple-500">{t.materialCostBreakdown || 'Material Cost Breakdown'}</h3>
              <MaterialTable 
                title={t.manual} 
                materials={params.currentMaterials || []} 
                setMaterials={(m) => setParams({...params, currentMaterials: m})} 
                t={t}
              />
              <MaterialTable 
                title={t.machine} 
                materials={params.proposedMaterials || []} 
                setMaterials={(m) => setParams({...params, proposedMaterials: m})} 
                t={t}
              />
            </div>

            <div className="pt-4 border-t border-zinc-800 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <InputField label={t.workingHoursPerDay || 'Working Hours / Day'} value={params.workingHoursPerDay} onChange={(v: any) => setParams({...params, workingHoursPerDay: v})} suffix="hrs" tooltip="Total operational hours per shift/day." />
                <InputField label={t.localLaborCost || 'Local Labor Cost'} value={params.localLaborCost} onChange={(v: any) => setParams({...params, localLaborCost: v})} suffix="USD/mo" tooltip="Average monthly salary including benefits for one operator (USD)." />
              </div>

              {/* Promoted out of hardcoded engine constants so a reviewer can see
                  and change them. Tariffs differ materially across VN/ID/MY. */}
              <div className="grid grid-cols-2 gap-4">
                <InputField
                  label={t.workingDaysPerYear || 'Working Days / Year'}
                  value={params.daysPerYear ?? DEFAULT_ASSUMPTIONS.daysPerYear}
                  onChange={(v: any) => setParams({ ...params, daysPerYear: v })}
                  suffix="days"
                  tooltip="Operating days per year. Default 312 assumes a 6-day week."
                />
                <InputField
                  label={t.energyTariff || 'Energy Tariff'}
                  value={params.powerRateUSD ?? DEFAULT_ASSUMPTIONS.powerRateUSD}
                  onChange={(v: any) => setParams({ ...params, powerRateUSD: v })}
                  suffix="USD/kWh"
                  tooltip="Electricity cost per kWh at this site. Default $0.075 — confirm before comparing projects across countries."
                />
              </div>

              {/* The two sides often run different shift patterns — a manual line on
                  2 shifts against an automatic cell on 3. One shared figure cannot
                  express that, and it distorts the ratio the whole report rests on. */}
              <div className="pt-4 border-t border-zinc-800">
                <div className="flex items-baseline justify-between mb-3">
                  <label className="factory-label !mb-0">{t.shiftPattern || 'Shift Pattern'}</label>
                  <span className="text-[9px] text-zinc-500 font-mono">
                    {t.currentVsProposed || 'Current vs Proposed'}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-x-4 gap-y-0">
                  <InputField
                    label={`${t.current || 'Current'} — ${t.shiftsPerDay || 'Shifts / Day'}`}
                    value={params.currentShiftsPerDay ?? 1}
                    onChange={(v: any) => setParams({ ...params, currentShiftsPerDay: v })}
                    suffix="shifts"
                    tooltip="Number of shifts the CURRENT line runs per day."
                  />
                  <InputField
                    label={`${t.proposed || 'Proposed'} — ${t.shiftsPerDay || 'Shifts / Day'}`}
                    value={params.proposedShiftsPerDay ?? 1}
                    onChange={(v: any) => setParams({ ...params, proposedShiftsPerDay: v })}
                    suffix="shifts"
                    tooltip="Number of shifts the PROPOSED line runs per day. An automatic cell often runs more shifts than the line it replaces."
                  />
                  <InputField
                    label={`${t.current || 'Current'} — ${t.hoursPerShift || 'Hours / Shift'}`}
                    value={params.currentHoursPerShift ?? params.workingHoursPerDay}
                    onChange={(v: any) => setParams({ ...params, currentHoursPerShift: v })}
                    suffix="hrs"
                    tooltip="Productive hours in one shift on the CURRENT line."
                  />
                  <InputField
                    label={`${t.proposed || 'Proposed'} — ${t.hoursPerShift || 'Hours / Shift'}`}
                    value={params.proposedHoursPerShift ?? params.workingHoursPerDay}
                    onChange={(v: any) => setParams({ ...params, proposedHoursPerShift: v })}
                    suffix="hrs"
                    tooltip="Productive hours in one shift on the PROPOSED line."
                  />
                </div>
                {advancedResults && (
                  <div className="grid grid-cols-2 gap-4 text-[10px] font-mono text-zinc-500 -mt-1">
                    <div>
                      = {advancedResults.assumptions.current.hoursPerDay} h/day ·{' '}
                      {advancedResults.assumptions.current.hoursPerYear.toLocaleString()} h/yr
                    </div>
                    <div>
                      = {advancedResults.assumptions.proposed.hoursPerDay} h/day ·{' '}
                      {advancedResults.assumptions.proposed.hoursPerYear.toLocaleString()} h/yr
                    </div>
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        )}

        {roiStep === 4 && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-8">
            <h2 className="text-xs font-bold uppercase tracking-widest text-red-500 mb-6">{t.financialMetrics || 'Financial Metrics'}</h2>
            
            <div className="grid grid-cols-1 lg:grid-cols-11 gap-4 items-start">
              <div className="lg:col-span-5 space-y-4 p-6 bg-white/60 border border-white/60 rounded-2xl">
                <h3 className="text-[10px] font-bold uppercase tracking-widest text-[#4A6B6F] border-b border-[#006D77]/10 pb-2">{t.manual}</h3>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm"><span className="text-[#4A6B6F]">{t.annualLaborCost}</span><span className="font-mono text-[#002D32]">${advancedResults?.manual?.annualLaborCost?.toLocaleString(undefined, {maximumFractionDigits: 2}) || 0}</span></div>
                  <div className="flex justify-between text-sm"><span className="text-[#4A6B6F]">{t.annualMaintenance}</span><span className="font-mono text-[#002D32]">${params.currentMaintenanceCostPerYear?.toLocaleString() || 0}</span></div>
                  <div className="flex justify-between text-sm"><span className="text-[#4A6B6F]">{t.annualConsumables}</span><span className="font-mono text-[#002D32]">${params.currentConsumablesCostPerYear?.toLocaleString() || 0}</span></div>
                  <div className="flex justify-between text-sm"><span className="text-[#4A6B6F]">{t.annualDepreciation}</span><span className="font-mono text-[#002D32]">${(params.currentUnitPrice / (params.currentDepreciationYears || 1))?.toLocaleString(undefined, {maximumFractionDigits: 2}) || 0}</span></div>
                  <div className="flex justify-between text-sm"><span className="text-[#4A6B6F]">{t.materialCostPerPair}</span><span className="font-mono text-[#002D32]">${advancedResults?.manual?.materialCostPerPair?.toFixed(4) || 0}</span></div>
                  <div className="flex justify-between text-sm"><span className="text-[#4A6B6F]">{t.operatingCostPerPair}</span><span className="font-mono text-[#002D32]">${advancedResults?.manual?.operatingCostPerPair?.toFixed(4) || 0}</span></div>
                  <div className="flex justify-between text-sm font-bold pt-2 border-t border-[#006D77]/10"><span className="text-[#002D32]">{t.totalAnnualCost}</span><span className="font-mono text-rose-500">${advancedResults?.manual?.totalAnnualCost?.toLocaleString(undefined, {maximumFractionDigits: 2}) || 0}</span></div>
                  <div className="flex justify-between text-sm font-bold"><span className="text-[#002D32]">{t.costPerPair} (FOB)</span><span className="font-mono text-[#006D77]">${advancedResults?.manual?.costPerPair?.toFixed(4) || 0}</span></div>
                </div>
              </div>

              <div className="lg:col-span-1 flex flex-col items-center justify-center h-full py-8 gap-12">
                <div className="flex flex-col items-center gap-1">
                  <div className={cn(
                    "p-2 rounded-full shadow-sm",
                    (advancedResults?.savings?.laborSaving || 0) > 0 ? "bg-ims-secondary/20 text-ims-primary" : "bg-red-500/20 text-red-600"
                  )}>
                    {(advancedResults?.savings?.laborSaving || 0) > 0 ? <ArrowDown size={14} /> : <ArrowUp size={14} />}
                  </div>
                  <span className={cn("text-[10px] font-bold", (advancedResults?.savings?.laborSaving || 0) > 0 ? "text-ims-primary" : "text-red-500")}>
                    {Math.abs(((advancedResults?.machine?.annualLaborCost / advancedResults?.manual?.annualLaborCost) - 1) * 100).toFixed(0)}%
                  </span>
                </div>

                <div className="flex flex-col items-center gap-1">
                  <div className={cn(
                    "p-2 rounded-full shadow-sm",
                    (advancedResults?.savings?.totalAnnualSaving || 0) > 0 ? "bg-ims-secondary/20 text-ims-primary" : "bg-red-500/20 text-red-600"
                  )}>
                    {(advancedResults?.savings?.totalAnnualSaving || 0) > 0 ? <ArrowDown size={14} /> : <ArrowUp size={14} />}
                  </div>
                  <span className={cn("text-[10px] font-bold", (advancedResults?.savings?.totalAnnualSaving || 0) > 0 ? "text-ims-primary" : "text-red-500")}>
                    ${Math.abs(advancedResults?.savings?.totalAnnualSaving || 0).toLocaleString(undefined, {maximumFractionDigits: 0})}
                  </span>
                </div>

                <div className="flex flex-col items-center gap-1">
                  <div className={cn(
                    "p-2 rounded-full shadow-sm",
                    (advancedResults?.savings?.fobImpact || 0) > 0 ? "bg-ims-secondary/20 text-ims-primary" : "bg-red-500/20 text-red-600"
                  )}>
                    {(advancedResults?.savings?.fobImpact || 0) > 0 ? <ArrowDown size={14} /> : <ArrowUp size={14} />}
                  </div>
                  <span className={cn("text-[10px] font-bold", (advancedResults?.savings?.fobImpact || 0) > 0 ? "text-ims-primary" : "text-red-500")}>
                    ${Math.abs(advancedResults?.savings?.fobImpact || 0).toFixed(3)}
                  </span>
                </div>
              </div>

              <div className="lg:col-span-5 space-y-4 p-6 bg-[#006D77]/5 border border-[#006D77]/20 rounded-2xl">
                <h3 className="text-[10px] font-bold uppercase tracking-widest text-[#006D77] border-b border-[#006D77]/10 pb-2">{t.machine}</h3>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm"><span className="text-[#4A6B6F]">{t.annualLaborCost}</span><span className="font-mono text-[#002D32]">${advancedResults?.machine?.annualLaborCost?.toLocaleString(undefined, {maximumFractionDigits: 2}) || 0}</span></div>
                  <div className="flex justify-between text-sm"><span className="text-[#4A6B6F]">{t.annualMaintenance}</span><span className="font-mono text-[#002D32]">${params.proposedMaintenanceCostPerYear?.toLocaleString() || 0}</span></div>
                  <div className="flex justify-between text-sm"><span className="text-[#4A6B6F]">{t.annualConsumables}</span><span className="font-mono text-[#002D32]">${params.proposedConsumablesCostPerYear?.toLocaleString() || 0}</span></div>
                  <div className="flex justify-between text-sm"><span className="text-[#4A6B6F]">{t.annualDepreciation}</span><span className="font-mono text-[#002D32]">${(params.proposedUnitPrice / (params.proposedDepreciationYears || 1))?.toLocaleString(undefined, {maximumFractionDigits: 2}) || 0}</span></div>
                  <div className="flex justify-between text-sm"><span className="text-[#4A6B6F]">{t.materialCostPerPair}</span><span className="font-mono text-[#002D32]">${advancedResults?.machine?.materialCostPerPair?.toFixed(4) || 0}</span></div>
                  <div className="flex justify-between text-sm"><span className="text-[#4A6B6F]">{t.operatingCostPerPair}</span><span className="font-mono text-[#002D32]">${advancedResults?.machine?.operatingCostPerPair?.toFixed(4) || 0}</span></div>
                  <div className="flex justify-between text-sm font-bold pt-2 border-t border-[#006D77]/20"><span className="text-[#002D32]">{t.totalAnnualCost}</span><span className="font-mono text-rose-500">${advancedResults?.machine?.totalAnnualCost?.toLocaleString(undefined, {maximumFractionDigits: 2}) || 0}</span></div>
                  <div className="flex justify-between text-sm font-bold"><span className="text-[#002D32]">{t.costPerPair} (FOB)</span><span className="font-mono text-[#006D77]">${advancedResults?.machine?.costPerPair?.toFixed(4) || 0}</span></div>
                </div>
              </div>
            </div>

            <div className="flex justify-center pt-6 mt-6 border-t border-[#006D77]/10">
              <div className="text-[10px] font-bold uppercase tracking-widest text-[#4A6B6F] italic">
                {t.useHeaderActions || 'Use Header Actions for Export & AI Analysis'}
              </div>
            </div>
          </motion.div>
        )}

        <div className="mt-8 flex justify-between items-center">
          <button 
            onClick={() => setRoiStep(Math.max(1, roiStep - 1))}
            disabled={roiStep === 1}
            className="factory-btn disabled:opacity-30"
          >
            {t.prev}
          </button>

          <button 
            onClick={() => setRoiStep(Math.min(4, roiStep + 1))}
            disabled={roiStep === 4}
            className="factory-btn disabled:opacity-30"
          >
            {t.next}
          </button>
        </div>
      </div>
    </div>
  );
};
