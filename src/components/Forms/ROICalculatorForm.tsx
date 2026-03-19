import React, { useState } from 'react';
import { Upload, X, Sparkles } from 'lucide-react';
import { motion } from 'framer-motion';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { ROIParams } from '../../types';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const InputField = ({ label, value, onChange, type = "number", suffix }: any) => (
  <div className="mb-4">
    <label className="factory-label">{label}</label>
    <div className="relative">
      <input
        type={type}
        value={value ?? ''}
        onChange={(e) => onChange(type === "number" ? parseFloat(e.target.value) || 0 : e.target.value)}
        className="factory-input w-full"
      />
      {suffix && (
        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-zinc-600 font-mono">
          {suffix}
        </span>
      )}
    </div>
  </div>
);

const ImageUpload = ({ images, setImages }: { images: string[], setImages: (imgs: string[]) => void }) => {
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
      <label className="factory-label">Machine Photos (Max 3)</label>
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
            <span className="text-[8px] font-bold uppercase mt-2 text-zinc-600">{uploading ? 'Uploading...' : 'Add Photo'}</span>
          </label>
        )}
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
  onAnalyze?: () => void;
}

export const ROICalculatorForm: React.FC<ROICalculatorFormProps> = ({ t, params, setParams, uploadedImages, setUploadedImages, initialData, onAnalyze }) => {
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
        {[1, 2, 3].map((s) => (
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
            <InputField label="Shoe Model" type="text" value={params.shoeModel} onChange={(v: any) => setParams({...params, shoeModel: v})} />
            <InputField label="Date" type="date" value={params.date} onChange={(v: any) => setParams({...params, date: v})} />
            <InputField label="Equipment Name" type="text" value={params.equipmentName} onChange={(v: any) => setParams({...params, equipmentName: v})} />
            <InputField label="Machine Type" type="text" value={params.machineType} onChange={(v: any) => setParams({...params, machineType: v})} />
            <InputField label="Brand" type="text" value={params.brand} onChange={(v: any) => setParams({...params, brand: v})} />
            <InputField label="Scope of Work" type="text" value={params.scopeOfWork} onChange={(v: any) => setParams({...params, scopeOfWork: v})} />
            <InputField label="Machine Quantity" type="number" value={params.machineQuantity} onChange={(v: any) => setParams({...params, machineQuantity: v})} />
          </motion.div>
        )}

        {roiStep === 2 && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
            <h2 className="text-xs font-bold uppercase tracking-widest text-blue-500 mb-6">{t.techSpecs}</h2>
            <InputField label="Power Supply" type="text" value={params.powerSupplyV} onChange={(v: any) => setParams({...params, powerSupplyV: v})} suffix="V" />
            <InputField label="Power Consumption" value={params.powerConsumptionKW} onChange={(v: any) => setParams({...params, powerConsumptionKW: v})} suffix="kW" />
            <InputField label="Speed" value={params.speedSPrs} onChange={(v: any) => setParams({...params, speedSPrs: v})} suffix="s/prs" />
            <InputField label="Unit Price (Total Cost)" value={params.unitPrice} onChange={(v: any) => setParams({...params, unitPrice: v})} suffix="USD" />
            
            <div className="grid grid-cols-2 gap-4">
              <InputField label={t.maintenanceCost} value={params.maintenanceCostPerYear} onChange={(v: any) => setParams({...params, maintenanceCostPerYear: v})} suffix="USD/Yr" />
              <InputField label={t.consumablesCost} value={params.consumablesCostPerYear} onChange={(v: any) => setParams({...params, consumablesCostPerYear: v})} suffix="USD/Yr" />
            </div>
            <InputField label={t.depreciation} value={params.depreciationYears} onChange={(v: any) => setParams({...params, depreciationYears: v})} suffix="Years" />

            <div className="pt-4 border-t border-zinc-800">
              <ImageUpload images={uploadedImages} setImages={setUploadedImages} />
            </div>
          </motion.div>
        )}

        {roiStep === 3 && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
            <h2 className="text-xs font-bold uppercase tracking-widest text-amber-500 mb-6">{t.prodData}</h2>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-4 p-4 bg-zinc-900/30 border border-zinc-800 rounded">
                <span className="text-[10px] font-bold uppercase text-zinc-500">{t.manual}</span>
                <InputField label="Capacity / Hr" value={params.manualCapacityPerHour} onChange={(v: any) => setParams({...params, manualCapacityPerHour: v})} suffix="prs" />
                <InputField label="Defective Rate" value={params.manualDefectiveRate} onChange={(v: any) => setParams({...params, manualDefectiveRate: v})} suffix="%" />
                <InputField label="Manpower" value={params.manualManpower} onChange={(v: any) => setParams({...params, manualManpower: v})} suffix="prs" />
              </div>
              <div className="space-y-4 p-4 bg-emerald-950/10 border border-emerald-900/30 rounded">
                <span className="text-[10px] font-bold uppercase text-emerald-500">{t.machine}</span>
                <InputField label="Capacity / Hr" value={params.machineCapacityPerHour} onChange={(v: any) => setParams({...params, machineCapacityPerHour: v})} suffix="prs" />
                <InputField label="Defective Rate" value={params.machineDefectiveRate} onChange={(v: any) => setParams({...params, machineDefectiveRate: v})} suffix="%" />
                <InputField label="Manpower" value={params.machineManpower} onChange={(v: any) => setParams({...params, machineManpower: v})} suffix="prs" />
              </div>
            </div>

            <div className="pt-4 border-t border-zinc-800 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <InputField label={`${t.materialCostPerPair} (${t.manual})`} value={params.currentMaterialCost} onChange={(v: any) => setParams({...params, currentMaterialCost: v})} suffix="USD/prs" />
                <InputField label={`${t.materialCostPerPair} (${t.machine})`} value={params.proposedMaterialCost} onChange={(v: any) => setParams({...params, proposedMaterialCost: v})} suffix="USD/prs" />
              </div>
              <InputField label="Working Hours / Day" value={params.workingHoursPerDay} onChange={(v: any) => setParams({...params, workingHoursPerDay: v})} suffix="hrs" />
              <InputField label="Local Labor Cost" value={params.localLaborCost} onChange={(v: any) => setParams({...params, localLaborCost: v})} suffix="USD/mo" />
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

          {roiStep === 3 && onAnalyze && (
            <button 
              onClick={onAnalyze}
              className="factory-btn bg-blue-600 text-white border-blue-500 hover:bg-blue-500 flex items-center gap-2"
            >
              <Sparkles size={16} />
              AI Analyze
            </button>
          )}

          <button 
            onClick={() => setRoiStep(Math.min(3, roiStep + 1))}
            disabled={roiStep === 3}
            className="factory-btn bg-emerald-600 text-white border-emerald-500 disabled:opacity-30"
          >
            {t.next}
          </button>
        </div>
      </div>
    </div>
  );
};
