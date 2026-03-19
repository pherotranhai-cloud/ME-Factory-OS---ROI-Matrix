import React, { useState } from 'react';
import { Upload, X, Sparkles, Plus, Trash2 } from 'lucide-react';
import { motion } from 'framer-motion';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { ROIParams, MaterialItem } from '../../types';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const InputField = ({ label, value, onChange, type = "number", suffix, className = "" }: any) => (
  <div className={cn("mb-4", className)}>
    <label className="factory-label text-[10px]">{label}</label>
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

const ImageUpload = ({ images, setImages, t }: { images: string[], setImages: (imgs: string[]) => void, t: any }) => {
  const [uploading, setUploading] = useState(false);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploading(true);
    const cloudName = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME || 'djgai7h3b';
    const uploadPreset = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET || 'ml_default';

    try {
      const uploadPromises = Array.from(files).map(async (file: File) => {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('upload_preset', uploadPreset);

        const response = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
          method: 'POST',
          body: formData
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error?.message || 'Upload failed');
        }
        const data = await response.json();
        return data.secure_url;
      });

      const urls = await Promise.all(uploadPromises);
      setImages([...images, ...urls].slice(0, 3));
    } catch (err: any) {
      console.error("Cloudinary Upload Error:", err);
      alert('Upload failed: ' + err.message);
    } finally {
      setUploading(false);
    }
  };

  const removeImage = (index: number) => {
    setImages(images.filter((_, i) => i !== index));
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
        {images.length < 3 && (
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
    setMaterials([...materials, { id: Math.random().toString(), type: '', description: '', supplier: '', uom: '', usage: 0, loss: 0, fob: 0 }]);
  };

  const updateRow = (id: string, field: keyof MaterialItem, value: any) => {
    setMaterials(materials.map(m => m.id === id ? { ...m, [field]: value } : m));
  };

  const removeRow = (id: string) => {
    setMaterials(materials.filter(m => m.id !== id));
  };

  const totalCost = materials.reduce((sum, m) => sum + (m.usage * m.fob * (1 + m.loss / 100)), 0);

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
              <th className="p-2 font-medium">{t.type || 'Type'}</th>
              <th className="p-2 font-medium">{t.description || 'Description'}</th>
              <th className="p-2 font-medium">{t.supplier || 'Supplier'}</th>
              <th className="p-2 font-medium">{t.uom || 'UOM'}</th>
              <th className="p-2 font-medium">{t.usage || 'Usage'}</th>
              <th className="p-2 font-medium">{t.loss || 'Loss %'}</th>
              <th className="p-2 font-medium">{t.fob || 'FOB ($)'}</th>
              <th className="p-2 font-medium text-right">{t.costPerPr || 'Cost/Pr'}</th>
              <th className="p-2"></th>
            </tr>
          </thead>
          <tbody>
            {materials.map(m => {
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
  initialData?: any;
  advancedResults?: any;
  onAnalyze?: () => void;
}

export const ROICalculatorForm: React.FC<ROICalculatorFormProps> = ({ t, params, setParams, uploadedImages, setUploadedImages, initialData, advancedResults, onAnalyze }) => {
  const [roiStep, setRoiStep] = useState(1);

  React.useEffect(() => {
    if (initialData) {
      const formData = typeof initialData.form_data === 'string' ? JSON.parse(initialData.form_data) : initialData.form_data;
      if (formData) {
        setParams(formData);
      }
      setUploadedImages(typeof initialData.image_url === 'string' ? JSON.parse(initialData.image_url || '[]') : (initialData.image_url || []));
    }
  }, [initialData, setParams, setUploadedImages]);

  return (
    <div className="space-y-6">
      <div className="flex gap-2 mb-4">
        {[1, 2, 3, 4].map((s) => (
          <button
            key={s}
            onClick={() => setRoiStep(s)}
            className={cn(
              "flex-1 py-2 text-[10px] font-bold uppercase tracking-widest border transition-all",
              roiStep === s ? "bg-emerald-600 border-emerald-500 text-white" : "bg-zinc-900/50 border-zinc-800 text-zinc-500 hover:border-zinc-700"
            )}
          >
            {t.step} {s}
          </button>
        ))}
      </div>

      <div className="factory-card min-h-[500px]">
        {roiStep === 1 && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
            <h2 className="text-xs font-bold uppercase tracking-widest text-emerald-500 mb-6">{t.generalInfo}</h2>
            <InputField label={t.shoeModel} type="text" value={params.shoeModel} onChange={(v: any) => setParams({...params, shoeModel: v})} />
            <InputField label={t.date} type="date" value={params.date} onChange={(v: any) => setParams({...params, date: v})} />
            <InputField label={t.equipment} type="text" value={params.equipmentName} onChange={(v: any) => setParams({...params, equipmentName: v})} />
            <InputField label={t.machineType} type="text" value={params.machineType} onChange={(v: any) => setParams({...params, machineType: v})} />
            <InputField label={t.brand} type="text" value={params.brand} onChange={(v: any) => setParams({...params, brand: v})} />
            <InputField label={t.scopeOfWork} type="text" value={params.scopeOfWork} onChange={(v: any) => setParams({...params, scopeOfWork: v})} />
            <InputField label={t.machineQuantity} type="number" value={params.machineQuantity} onChange={(v: any) => setParams({...params, machineQuantity: v})} />
          </motion.div>
        )}

        {roiStep === 2 && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
            <h2 className="text-xs font-bold uppercase tracking-widest text-blue-500 mb-6">{t.techSpecs}</h2>
            
            <div className="grid grid-cols-2 gap-6">
              {/* Current State Column */}
              <div className="space-y-4 p-4 bg-zinc-900/30 border border-zinc-800 rounded">
                <h3 className="text-[10px] font-bold uppercase tracking-widest text-zinc-400 border-b border-zinc-800 pb-2 mb-4">{t.manual}</h3>
                <InputField label={t.powerSupply} type="text" value={params.currentPowerSupplyV} onChange={(v: any) => setParams({...params, currentPowerSupplyV: v})} suffix="V" />
                <InputField label={t.powerConsumption} value={params.currentPowerConsumptionKW} onChange={(v: any) => setParams({...params, currentPowerConsumptionKW: v})} suffix="kW" />
                <InputField label={t.speed} value={params.currentSpeedSPrs} onChange={(v: any) => setParams({...params, currentSpeedSPrs: v})} suffix="s/prs" />
                <InputField label={t.unitPrice} value={params.currentUnitPrice} onChange={(v: any) => setParams({...params, currentUnitPrice: v})} suffix="USD" />
                <InputField label={t.maintenanceCost} value={params.currentMaintenanceCostPerYear} onChange={(v: any) => setParams({...params, currentMaintenanceCostPerYear: v})} suffix="USD/Yr" />
                <InputField label={t.consumablesCost} value={params.currentConsumablesCostPerYear} onChange={(v: any) => setParams({...params, currentConsumablesCostPerYear: v})} suffix="USD/Yr" />
                <InputField label={t.depreciation} value={params.currentDepreciationYears} onChange={(v: any) => setParams({...params, currentDepreciationYears: v})} suffix="Years" />
              </div>

              {/* Proposed State Column */}
              <div className="space-y-4 p-4 bg-emerald-950/10 border border-emerald-900/30 rounded">
                <h3 className="text-[10px] font-bold uppercase tracking-widest text-emerald-500 border-b border-emerald-900/50 pb-2 mb-4">{t.machine}</h3>
                <InputField label={t.powerSupply} type="text" value={params.proposedPowerSupplyV} onChange={(v: any) => setParams({...params, proposedPowerSupplyV: v})} suffix="V" />
                <InputField label={t.powerConsumption} value={params.proposedPowerConsumptionKW} onChange={(v: any) => setParams({...params, proposedPowerConsumptionKW: v})} suffix="kW" />
                <InputField label={t.speed} value={params.proposedSpeedSPrs} onChange={(v: any) => setParams({...params, proposedSpeedSPrs: v})} suffix="s/prs" />
                <InputField label={t.unitPrice} value={params.proposedUnitPrice} onChange={(v: any) => setParams({...params, proposedUnitPrice: v})} suffix="USD" />
                <InputField label={t.maintenanceCost} value={params.proposedMaintenanceCostPerYear} onChange={(v: any) => setParams({...params, proposedMaintenanceCostPerYear: v})} suffix="USD/Yr" />
                <InputField label={t.consumablesCost} value={params.proposedConsumablesCostPerYear} onChange={(v: any) => setParams({...params, proposedConsumablesCostPerYear: v})} suffix="USD/Yr" />
                <InputField label={t.depreciation} value={params.proposedDepreciationYears} onChange={(v: any) => setParams({...params, proposedDepreciationYears: v})} suffix="Years" />
              </div>
            </div>

            <div className="pt-4 border-t border-zinc-800">
              <ImageUpload images={uploadedImages} setImages={setUploadedImages} t={t} />
            </div>
          </motion.div>
        )}

        {roiStep === 3 && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-8">
            <h2 className="text-xs font-bold uppercase tracking-widest text-amber-500 mb-6">{t.prodData}</h2>
            
            {/* IE & Quality Data Matrix */}
            <div className="grid grid-cols-2 gap-6">
              <div className="space-y-6 p-4 bg-zinc-900/30 border border-zinc-800 rounded">
                <h3 className="text-[10px] font-bold uppercase tracking-widest text-zinc-400 border-b border-zinc-800 pb-2">{t.manual}</h3>
                <div className="space-y-4">
                  <h4 className="text-[10px] font-bold text-zinc-500">{t.ieData || 'IE Data'}</h4>
                  <InputField label={t.cycleTime || 'Cycle Time (CT)'} value={params.currentCT} onChange={(v: any) => setParams({...params, currentCT: v, currentPPH: v > 0 ? Number((3600 / v).toFixed(2)) : 0})} suffix="s" />
                  <InputField label={t.piecesPerHour || 'Pieces Per Hour (PPH)'} value={params.currentPPH} onChange={(v: any) => setParams({...params, currentPPH: v})} suffix="prs/hr" />
                  <InputField label={t.manpowerDemand} value={params.currentManpower} onChange={(v: any) => setParams({...params, currentManpower: v})} suffix="prs" />
                </div>
                <div className="space-y-4 pt-4 border-t border-zinc-800/50">
                  <h4 className="text-[10px] font-bold text-zinc-500">{t.qualityData || 'Quality Data'}</h4>
                  <InputField label={t.rft || 'RFT %'} value={params.currentRFT} onChange={(v: any) => setParams({...params, currentRFT: v})} suffix="%" />
                  <InputField label={t.totalDefectRate || 'Total Defect Rate'} value={params.currentDefectRate} onChange={(v: any) => setParams({...params, currentDefectRate: v})} suffix="%" />
                </div>
              </div>

              <div className="space-y-6 p-4 bg-emerald-950/10 border border-emerald-900/30 rounded">
                <h3 className="text-[10px] font-bold uppercase tracking-widest text-emerald-500 border-b border-emerald-900/50 pb-2">{t.machine}</h3>
                <div className="space-y-4">
                  <h4 className="text-[10px] font-bold text-emerald-600/70">{t.ieData || 'IE Data'}</h4>
                  <InputField label={t.cycleTime || 'Cycle Time (CT)'} value={params.proposedCT} onChange={(v: any) => setParams({...params, proposedCT: v, proposedPPH: v > 0 ? Number((3600 / v).toFixed(2)) : 0})} suffix="s" />
                  <InputField label={t.piecesPerHour || 'Pieces Per Hour (PPH)'} value={params.proposedPPH} onChange={(v: any) => setParams({...params, proposedPPH: v})} suffix="prs/hr" />
                  <InputField label={t.manpowerDemand} value={params.proposedManpower} onChange={(v: any) => setParams({...params, proposedManpower: v})} suffix="prs" />
                </div>
                <div className="space-y-4 pt-4 border-t border-emerald-900/30">
                  <h4 className="text-[10px] font-bold text-emerald-600/70">{t.qualityData || 'Quality Data'}</h4>
                  <InputField label={t.rft || 'RFT %'} value={params.proposedRFT} onChange={(v: any) => setParams({...params, proposedRFT: v})} suffix="%" />
                  <InputField label={t.totalDefectRate || 'Total Defect Rate'} value={params.proposedDefectRate} onChange={(v: any) => setParams({...params, proposedDefectRate: v})} suffix="%" />
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
                <InputField label={t.workingHoursPerDay || 'Working Hours / Day'} value={params.workingHoursPerDay} onChange={(v: any) => setParams({...params, workingHoursPerDay: v})} suffix="hrs" />
                <InputField label={t.localLaborCost || 'Local Labor Cost'} value={params.localLaborCost} onChange={(v: any) => setParams({...params, localLaborCost: v})} suffix="USD/mo" />
              </div>
            </div>
          </motion.div>
        )}

        {roiStep === 4 && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-8">
            <h2 className="text-xs font-bold uppercase tracking-widest text-rose-500 mb-6">{t.financialMetrics || 'Financial Metrics'}</h2>
            
            <div className="grid grid-cols-2 gap-6">
              <div className="space-y-4 p-4 bg-zinc-900/30 border border-zinc-800 rounded">
                <h3 className="text-[10px] font-bold uppercase tracking-widest text-zinc-400 border-b border-zinc-800 pb-2">{t.manual}</h3>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm"><span className="text-zinc-500">{t.annualLaborCost}</span><span className="font-mono">${advancedResults?.manual.annualLaborCost?.toLocaleString(undefined, {maximumFractionDigits: 2}) || 0}</span></div>
                  <div className="flex justify-between text-sm"><span className="text-zinc-500">{t.annualMaintenance}</span><span className="font-mono">${params.currentMaintenanceCostPerYear?.toLocaleString() || 0}</span></div>
                  <div className="flex justify-between text-sm"><span className="text-zinc-500">{t.annualConsumables}</span><span className="font-mono">${params.currentConsumablesCostPerYear?.toLocaleString() || 0}</span></div>
                  <div className="flex justify-between text-sm"><span className="text-zinc-500">{t.annualDepreciation}</span><span className="font-mono">${(params.currentUnitPrice / (params.currentDepreciationYears || 1))?.toLocaleString(undefined, {maximumFractionDigits: 2}) || 0}</span></div>
                  <div className="flex justify-between text-sm"><span className="text-zinc-500">{t.materialCostPerPair}</span><span className="font-mono">${advancedResults?.manual.materialCostPerPair?.toFixed(4) || 0}</span></div>
                  <div className="flex justify-between text-sm"><span className="text-zinc-500">{t.operatingCostPerPair}</span><span className="font-mono">${advancedResults?.manual.operatingCostPerPair?.toFixed(4) || 0}</span></div>
                  <div className="flex justify-between text-sm font-bold pt-2 border-t border-zinc-800"><span className="text-zinc-300">{t.totalAnnualCost}</span><span className="font-mono text-rose-400">${advancedResults?.manual.totalAnnualCost?.toLocaleString(undefined, {maximumFractionDigits: 2}) || 0}</span></div>
                  <div className="flex justify-between text-sm font-bold"><span className="text-zinc-300">{t.costPerPair} (FOB)</span><span className="font-mono text-emerald-400">${advancedResults?.manual.costPerPair?.toFixed(4) || 0}</span></div>
                </div>
              </div>

              <div className="space-y-4 p-4 bg-emerald-950/10 border border-emerald-900/30 rounded">
                <h3 className="text-[10px] font-bold uppercase tracking-widest text-emerald-500 border-b border-emerald-900/50 pb-2">{t.machine}</h3>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm"><span className="text-zinc-500">{t.annualLaborCost}</span><span className="font-mono">${advancedResults?.machine.annualLaborCost?.toLocaleString(undefined, {maximumFractionDigits: 2}) || 0}</span></div>
                  <div className="flex justify-between text-sm"><span className="text-zinc-500">{t.annualMaintenance}</span><span className="font-mono">${params.proposedMaintenanceCostPerYear?.toLocaleString() || 0}</span></div>
                  <div className="flex justify-between text-sm"><span className="text-zinc-500">{t.annualConsumables}</span><span className="font-mono">${params.proposedConsumablesCostPerYear?.toLocaleString() || 0}</span></div>
                  <div className="flex justify-between text-sm"><span className="text-zinc-500">{t.annualDepreciation}</span><span className="font-mono">${(params.proposedUnitPrice / (params.proposedDepreciationYears || 1))?.toLocaleString(undefined, {maximumFractionDigits: 2}) || 0}</span></div>
                  <div className="flex justify-between text-sm"><span className="text-zinc-500">{t.materialCostPerPair}</span><span className="font-mono">${advancedResults?.machine.materialCostPerPair?.toFixed(4) || 0}</span></div>
                  <div className="flex justify-between text-sm"><span className="text-zinc-500">{t.operatingCostPerPair}</span><span className="font-mono">${advancedResults?.machine.operatingCostPerPair?.toFixed(4) || 0}</span></div>
                  <div className="flex justify-between text-sm font-bold pt-2 border-t border-emerald-900/30"><span className="text-zinc-300">{t.totalAnnualCost}</span><span className="font-mono text-rose-400">${advancedResults?.machine.totalAnnualCost?.toLocaleString(undefined, {maximumFractionDigits: 2}) || 0}</span></div>
                  <div className="flex justify-between text-sm font-bold"><span className="text-zinc-300">{t.costPerPair} (FOB)</span><span className="font-mono text-emerald-400">${advancedResults?.machine.costPerPair?.toFixed(4) || 0}</span></div>
                </div>
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
            className="factory-btn bg-emerald-600 text-white border-emerald-500 disabled:opacity-30"
          >
            {t.next}
          </button>
        </div>
      </div>
    </div>
  );
};
