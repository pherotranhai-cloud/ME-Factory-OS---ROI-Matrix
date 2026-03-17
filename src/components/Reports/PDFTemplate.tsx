import React from 'react';
import { Cpu, ImageIcon, CheckCircle2, AlertTriangle } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import html2pdf from 'html2pdf.js';
import { Language, ROIParams, ROIResults } from '../../types';
import { VERDICT_TRANSLATIONS } from '../../constants/translations';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const safeFixed = (num: any, digits: number = 2) => {
  if (num === null || num === undefined || isNaN(num)) return "0";
  if (num === Infinity) return "N/A";
  return Number(num).toFixed(digits);
};

export const generatePDF = async (elementId: string, filename: string) => {
  const element = document.getElementById(elementId);
  if (!element) return;
  
  const opt = {
    margin: 0,
    filename: filename,
    image: { type: 'jpeg' as const, quality: 0.98 },
    html2canvas: { scale: 2, useCORS: true },
    jsPDF: { unit: 'mm' as const, format: 'a4' as const, orientation: 'portrait' as const }
  };
  
  await html2pdf().set(opt).from(element).save();
};

interface PDFTemplateProps {
  params: ROIParams & { project_id?: string };
  results: ROIResults;
  aiEvaluation: any;
  t: any;
  uploadedImages: string[];
  lang: Language;
}

export const CAPEXReportTemplate: React.FC<PDFTemplateProps> = ({ params, results, aiEvaluation, t, uploadedImages, lang }) => {
  const fmt = (num: any) => (num ?? 0).toLocaleString(undefined, { maximumFractionDigits: 0 });
  const fmtCurrency = (num: any) => '$' + (num ?? 0).toLocaleString(undefined, { maximumFractionDigits: 0 });
  const sf = (num: any, d: number = 0) => safeFixed(num, d);

  const getTranslatedVerdict = (verdict: string) => {
    return VERDICT_TRANSLATIONS[lang]?.[verdict] || verdict;
  };

  return (
    <div id="capex-template" className="bg-white p-[40px] text-black overflow-hidden" style={{ width: '794px', minHeight: '1123px', display: 'flex', flexDirection: 'column', fontFamily: 'Arial, sans-serif' }}>
      {/* Header */}
      <div className="border-b-4 border-emerald-600 pb-6 mb-8 flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-black text-emerald-800 uppercase tracking-tight">{t.capexProposal}</h1>
          <p className="text-[10px] text-zinc-500 font-mono mt-2 tracking-widest">REF: {params.project_id || `${params.shoeModel.toUpperCase()}-${params.date.replace(/-/g, '')}`}</p>
        </div>
        <div className="text-right">
          <div className="flex items-center justify-end gap-2 text-emerald-600 mb-1">
            <Cpu size={20} />
            <span className="font-mono font-black text-xl tracking-tighter italic">FACTORY OS</span>
          </div>
          <p className="text-[10px] text-zinc-400 font-bold uppercase tracking-[0.2em]">Manufacturing Excellence</p>
        </div>
      </div>

      {/* Section 1: Machine Info & Photo - CSS Grid Fix */}
      <div className="grid grid-cols-2 gap-6 mb-10" style={{ pageBreakInside: 'avoid' }}>
        <div className="overflow-hidden">
          <h2 className="text-[11px] font-black uppercase text-white px-3 py-2 mb-4 tracking-widest" style={{ backgroundColor: '#1e293b', color: '#ffffff' }}>{t.generalInfo}</h2>
          <table className="w-full text-[11px] border-collapse">
            <tbody>
              <tr className="border-b border-zinc-200">
                <td className="py-3 font-bold text-zinc-500 w-1/3 uppercase tracking-tighter">{t.shoeModel}</td>
                <td className="py-3 font-medium">{params.shoeModel}</td>
              </tr>
              <tr className="border-b border-zinc-200">
                <td className="py-3 font-bold text-zinc-500 uppercase tracking-tighter">{t.date}</td>
                <td className="py-3 font-medium">{params.date}</td>
              </tr>
              <tr className="border-b border-zinc-200">
                <td className="py-3 font-bold text-zinc-500 uppercase tracking-tighter">{t.equipment}</td>
                <td className="py-3 font-medium">{params.equipmentName}</td>
              </tr>
              <tr className="border-b border-zinc-200">
                <td className="py-3 font-bold text-zinc-500 uppercase tracking-tighter">{t.brand}</td>
                <td className="py-3 font-medium">{params.brand}</td>
              </tr>
              <tr className="border-b border-zinc-200">
                <td className="py-3 font-bold text-zinc-500 uppercase tracking-tighter">{t.machineQuantity}</td>
                <td className="py-3 font-medium">{params.machineQuantity}</td>
              </tr>
              <tr className="border-b border-zinc-200">
                <td className="py-3 font-bold text-zinc-500 uppercase tracking-tighter">{t.unitPrice}</td>
                <td className="py-3 font-black text-emerald-700 text-base">{fmtCurrency(params.unitPrice * params.machineQuantity)}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <div className="flex flex-col items-center justify-center border-2 border-zinc-100 rounded-xl p-4 bg-zinc-50/50 shadow-inner overflow-hidden">
          {uploadedImages.length > 0 ? (
            <img 
              src={uploadedImages[0]} 
              alt="Machine" 
              className="max-w-full max-h-[60mm] object-contain mb-4 rounded shadow-md"
              referrerPolicy="no-referrer"
            />
          ) : (
            <div className="w-full h-[60mm] flex flex-col items-center justify-center text-zinc-300 italic text-[10px] gap-2">
              <ImageIcon size={32} className="opacity-20" />
              <span>No Image Provided</span>
            </div>
          )}
          <div className="w-full h-[1px] bg-zinc-200 mb-2" />
          <p className="text-[9px] font-black uppercase text-zinc-400 tracking-widest">{t.machinePhoto}</p>
        </div>
      </div>

      {/* Section 2: Logic & Data Table */}
      <div className="mb-10" style={{ pageBreakInside: 'avoid' }}>
        <h2 className="text-[11px] font-black uppercase text-white px-3 py-2 mb-4 tracking-widest" style={{ backgroundColor: '#1e293b', color: '#ffffff' }}>{t.prodData}</h2>
        <table className="w-full text-[11px] border-collapse border-2 border-zinc-800" style={{ tableLayout: 'fixed' }}>
          <thead>
            <tr className="bg-zinc-100">
              <th className="border border-zinc-300 p-3 text-left font-black uppercase tracking-tighter text-zinc-600" style={{ width: '40%', wordBreak: 'break-word', verticalAlign: 'middle' }}>{t.metricName}</th>
              <th className="border border-zinc-300 p-3 text-right font-black uppercase tracking-tighter text-zinc-600" style={{ width: '20%', wordBreak: 'break-word', verticalAlign: 'middle', paddingRight: '5px' }}>{t.manual}</th>
              <th className="border border-zinc-300 p-3 text-right font-black uppercase tracking-tighter text-zinc-600" style={{ width: '20%', wordBreak: 'break-word', verticalAlign: 'middle', paddingRight: '5px' }}>{t.machine}</th>
              <th className="border border-zinc-300 p-3 text-right font-black uppercase tracking-tighter text-zinc-600" style={{ width: '10%', wordBreak: 'break-word', verticalAlign: 'middle', paddingRight: '5px' }}>{t.diff}</th>
              <th className="border border-zinc-300 p-3 text-right font-black uppercase tracking-tighter text-zinc-600" style={{ width: '10%', wordBreak: 'break-word', verticalAlign: 'middle', paddingRight: '5px' }}>% Diff</th>
            </tr>
          </thead>
          <tbody>
            {/* Production */}
            <tr style={{ backgroundColor: '#1e293b', color: '#ffffff' }}>
              <td colSpan={5} className="border border-zinc-300 p-2 text-[10px] font-black uppercase tracking-widest">{t.production}</td>
            </tr>
            <tr>
              <td className="border border-zinc-300 p-3 font-medium pl-6" style={{ wordBreak: 'break-word', verticalAlign: 'middle' }}>{t.capacityHour}</td>
              <td className="border border-zinc-300 p-3 text-right font-mono" style={{ paddingRight: '5px', verticalAlign: 'middle' }}>{fmt(params.manualCapacityPerHour)}</td>
              <td className="border border-zinc-300 p-3 text-right font-mono" style={{ paddingRight: '5px', verticalAlign: 'middle' }}>{fmt(params.machineCapacityPerHour)}</td>
              <td className="border border-zinc-300 p-3 text-right font-mono font-bold text-emerald-600" style={{ paddingRight: '5px', verticalAlign: 'middle' }}>+{fmt(params.machineCapacityPerHour - params.manualCapacityPerHour)}</td>
              <td className="border border-zinc-300 p-3 text-right font-mono font-bold text-emerald-600" style={{ paddingRight: '5px', verticalAlign: 'middle' }}>+{sf(((params.machineCapacityPerHour / params.manualCapacityPerHour - 1) * 100), 1)}%</td>
            </tr>
            <tr>
              <td className="border border-zinc-300 p-3 font-medium pl-6" style={{ wordBreak: 'break-word', verticalAlign: 'middle' }}>{t.annualCapacity}</td>
              <td className="border border-zinc-300 p-3 text-right font-mono" style={{ paddingRight: '5px', verticalAlign: 'middle' }}>{fmt(results.manual.annualCapacity)}</td>
              <td className="border border-zinc-300 p-3 text-right font-mono" style={{ paddingRight: '5px', verticalAlign: 'middle' }}>{fmt(results.machine.annualCapacity)}</td>
              <td className="border border-zinc-300 p-3 text-right font-mono font-bold text-emerald-600" style={{ paddingRight: '5px', verticalAlign: 'middle' }}>+{fmt(results.machine.annualCapacity - results.manual.annualCapacity)}</td>
              <td className="border border-zinc-300 p-3 text-right font-mono font-bold text-emerald-600" style={{ paddingRight: '5px', verticalAlign: 'middle' }}>+{sf(((results.machine.annualCapacity / results.manual.annualCapacity - 1) * 100), 1)}%</td>
            </tr>
            <tr>
              <td className="border border-zinc-300 p-3 font-medium pl-6" style={{ wordBreak: 'break-word', verticalAlign: 'middle' }}>{t.defectiveRate}</td>
              <td className="border border-zinc-300 p-3 text-right font-mono" style={{ paddingRight: '5px', verticalAlign: 'middle' }}>{params.manualDefectiveRate}%</td>
              <td className="border border-zinc-300 p-3 text-right font-mono" style={{ paddingRight: '5px', verticalAlign: 'middle' }}>{params.machineDefectiveRate}%</td>
              <td className="border border-zinc-300 p-3 text-right font-mono font-bold text-emerald-600" style={{ paddingRight: '5px', verticalAlign: 'middle' }}>-{fmt(params.manualDefectiveRate - params.machineDefectiveRate)}%</td>
              <td className="border border-zinc-300 p-3 text-right font-mono font-bold text-emerald-600" style={{ paddingRight: '5px', verticalAlign: 'middle' }}>-{sf(((1 - params.machineDefectiveRate / params.manualDefectiveRate) * 100), 1)}%</td>
            </tr>
            <tr>
              <td className="border border-zinc-300 p-3 font-medium pl-6" style={{ wordBreak: 'break-word', verticalAlign: 'middle' }}>{t.actualGoodOutput}</td>
              <td className="border border-zinc-300 p-3 text-right font-mono" style={{ paddingRight: '5px', verticalAlign: 'middle' }}>{fmt(results.manual.actualGoodCapacity)}</td>
              <td className="border border-zinc-300 p-3 text-right font-mono" style={{ paddingRight: '5px', verticalAlign: 'middle' }}>{fmt(results.machine.actualGoodCapacity)}</td>
              <td className="border border-zinc-300 p-3 text-right font-mono font-bold text-emerald-600" style={{ paddingRight: '5px', verticalAlign: 'middle' }}>+{fmt(results.machine.actualGoodCapacity - results.manual.actualGoodCapacity)}</td>
              <td className="border border-zinc-300 p-3 text-right font-mono font-bold text-emerald-600" style={{ paddingRight: '5px', verticalAlign: 'middle' }}>+{sf(((results.machine.actualGoodCapacity / results.manual.actualGoodCapacity - 1) * 100), 1)}%</td>
            </tr>
            {/* Costs */}
            <tr style={{ backgroundColor: '#1e293b', color: '#ffffff' }}>
              <td colSpan={5} className="border border-zinc-300 p-2 text-[10px] font-black uppercase tracking-widest">{t.consumptionCost}</td>
            </tr>
            <tr>
              <td className="border border-zinc-300 p-3 font-medium pl-6" style={{ wordBreak: 'break-word', verticalAlign: 'middle' }}>{t.manpowerDemand}</td>
              <td className="border border-zinc-300 p-3 text-right font-mono" style={{ paddingRight: '5px', verticalAlign: 'middle' }}>{results.manual.manpowerDemand}</td>
              <td className="border border-zinc-300 p-3 text-right font-mono" style={{ paddingRight: '5px', verticalAlign: 'middle' }}>{results.machine.manpowerDemand}</td>
              <td className="border border-zinc-300 p-3 text-right font-mono font-bold text-emerald-600" style={{ paddingRight: '5px', verticalAlign: 'middle' }}>{results.machine.manpowerDemand - results.manual.manpowerDemand}</td>
              <td className="border border-zinc-300 p-3 text-right font-mono font-bold text-emerald-600" style={{ paddingRight: '5px', verticalAlign: 'middle' }}>{sf(((results.machine.manpowerDemand / results.manual.manpowerDemand - 1) * 100), 1)}%</td>
            </tr>
            <tr>
              <td className="border border-zinc-300 p-3 font-medium pl-6" style={{ wordBreak: 'break-word', verticalAlign: 'middle' }}>{t.annualLaborCost}</td>
              <td className="border border-zinc-300 p-3 text-right font-mono" style={{ paddingRight: '5px', verticalAlign: 'middle' }}>{fmtCurrency(results.manual.annualLaborCost)}</td>
              <td className="border border-zinc-300 p-3 text-right font-mono" style={{ paddingRight: '5px', verticalAlign: 'middle' }}>{fmtCurrency(results.machine.annualLaborCost)}</td>
              <td className="border border-zinc-300 p-3 text-right font-mono font-bold text-emerald-600" style={{ paddingRight: '5px', verticalAlign: 'middle' }}>{fmtCurrency(results.machine.annualLaborCost - results.manual.annualLaborCost)}</td>
              <td className="border border-zinc-300 p-3 text-right font-mono font-bold text-emerald-600" style={{ paddingRight: '5px', verticalAlign: 'middle' }}>{sf(((results.machine.annualLaborCost / results.manual.annualLaborCost - 1) * 100), 1)}%</td>
            </tr>
            <tr>
              <td className="border border-zinc-300 p-3 font-medium pl-6" style={{ wordBreak: 'break-word', verticalAlign: 'middle' }}>{t.annualMaintenance}</td>
              <td className="border border-zinc-300 p-3 text-right font-mono" style={{ paddingRight: '5px', verticalAlign: 'middle' }}>{fmtCurrency(results.manual.annualMaintenance)}</td>
              <td className="border border-zinc-300 p-3 text-right font-mono" style={{ paddingRight: '5px', verticalAlign: 'middle' }}>{fmtCurrency(results.machine.annualMaintenance)}</td>
              <td className="border border-zinc-300 p-3 text-right font-mono font-bold text-red-600" style={{ paddingRight: '5px', verticalAlign: 'middle' }}>+{fmtCurrency(results.machine.annualMaintenance)}</td>
              <td className="border border-zinc-300 p-3 text-right font-mono font-bold text-red-600" style={{ paddingRight: '5px', verticalAlign: 'middle' }}>N/A</td>
            </tr>
            <tr>
              <td className="border border-zinc-300 p-3 font-medium pl-6" style={{ wordBreak: 'break-word', verticalAlign: 'middle' }}>{t.annualConsumables}</td>
              <td className="border border-zinc-300 p-3 text-right font-mono" style={{ paddingRight: '5px', verticalAlign: 'middle' }}>{fmtCurrency(results.manual.annualConsumables)}</td>
              <td className="border border-zinc-300 p-3 text-right font-mono" style={{ paddingRight: '5px', verticalAlign: 'middle' }}>{fmtCurrency(results.machine.annualConsumables)}</td>
              <td className="border border-zinc-300 p-3 text-right font-mono font-bold text-red-600" style={{ paddingRight: '5px', verticalAlign: 'middle' }}>+{fmtCurrency(results.machine.annualConsumables)}</td>
              <td className="border border-zinc-300 p-3 text-right font-mono font-bold text-red-600" style={{ paddingRight: '5px', verticalAlign: 'middle' }}>N/A</td>
            </tr>
            <tr>
              <td className="border border-zinc-300 p-3 font-medium pl-6" style={{ wordBreak: 'break-word', verticalAlign: 'middle' }}>{t.annualDepreciation}</td>
              <td className="border border-zinc-300 p-3 text-right font-mono" style={{ paddingRight: '5px', verticalAlign: 'middle' }}>{fmtCurrency(results.manual.annualDepreciation)}</td>
              <td className="border border-zinc-300 p-3 text-right font-mono" style={{ paddingRight: '5px', verticalAlign: 'middle' }}>{fmtCurrency(results.machine.annualDepreciation)}</td>
              <td className="border border-zinc-300 p-3 text-right font-mono font-bold text-red-600" style={{ paddingRight: '5px', verticalAlign: 'middle' }}>+{fmtCurrency(results.machine.annualDepreciation)}</td>
              <td className="border border-zinc-300 p-3 text-right font-mono font-bold text-red-600" style={{ paddingRight: '5px', verticalAlign: 'middle' }}>N/A</td>
            </tr>
            <tr>
              <td className="border border-zinc-300 p-3 font-medium pl-6" style={{ wordBreak: 'break-word', verticalAlign: 'middle' }}>{t.materialCostPerPair}</td>
              <td className="border border-zinc-300 p-3 text-right font-mono" style={{ paddingRight: '5px', verticalAlign: 'middle' }}>${sf(params.currentMaterialCost, 3)}</td>
              <td className="border border-zinc-300 p-3 text-right font-mono" style={{ paddingRight: '5px', verticalAlign: 'middle' }}>${sf(params.proposedMaterialCost, 3)}</td>
              <td className="border border-zinc-300 p-3 text-right font-mono font-bold text-emerald-600" style={{ paddingRight: '5px', verticalAlign: 'middle' }}>${sf((params.proposedMaterialCost - params.currentMaterialCost), 3)}</td>
              <td className="border border-zinc-300 p-3 text-right font-mono font-bold text-emerald-600" style={{ paddingRight: '5px', verticalAlign: 'middle' }}>{sf(((params.proposedMaterialCost / params.currentMaterialCost - 1) * 100), 1)}%</td>
            </tr>
            <tr style={{ backgroundColor: '#1e293b', color: '#ffffff' }}>
              <td colSpan={5} className="border border-zinc-300 p-2 text-[10px] font-black uppercase tracking-widest">Unit Cost Impact</td>
            </tr>
            <tr>
              <td className="border border-zinc-300 p-3 font-medium pl-6" style={{ wordBreak: 'break-word', verticalAlign: 'middle' }}>{t.operatingCostPerPair}</td>
              <td className="border border-zinc-300 p-3 text-right font-mono" style={{ paddingRight: '5px', verticalAlign: 'middle' }}>${sf(results.manual.operatingCostPerPair, 3)}</td>
              <td className="border border-zinc-300 p-3 text-right font-mono" style={{ paddingRight: '5px', verticalAlign: 'middle' }}>${sf(results.machine.operatingCostPerPair, 3)}</td>
              <td className="border border-zinc-300 p-3 text-right font-mono font-bold text-emerald-600" style={{ paddingRight: '5px', verticalAlign: 'middle' }}>${sf((results.machine.operatingCostPerPair - results.manual.operatingCostPerPair), 3)}</td>
              <td className="border border-zinc-300 p-3 text-right font-mono font-bold text-emerald-600" style={{ paddingRight: '5px', verticalAlign: 'middle' }}>{sf(((results.machine.operatingCostPerPair / results.manual.operatingCostPerPair - 1) * 100), 1)}%</td>
            </tr>
            <tr className="bg-emerald-600 text-white font-black">
              <td className="border border-emerald-700 p-4 text-sm uppercase tracking-tighter" style={{ wordBreak: 'break-word', verticalAlign: 'middle' }}>{t.totalAnnualCost}</td>
              <td className="border border-emerald-700 p-4 text-right text-sm font-mono" style={{ paddingRight: '5px', verticalAlign: 'middle' }}>{fmtCurrency(results.manual.totalAnnualCost)}</td>
              <td className="border border-emerald-700 p-4 text-right text-sm font-mono" style={{ paddingRight: '5px', verticalAlign: 'middle' }}>{fmtCurrency(results.machine.totalAnnualCost)}</td>
              <td className="border border-emerald-700 p-4 text-right text-sm font-mono" style={{ paddingRight: '5px', verticalAlign: 'middle' }}>{fmtCurrency(results.machine.totalAnnualCost - results.manual.totalAnnualCost)}</td>
              <td className="border border-emerald-700 p-4 text-right text-sm font-mono" style={{ paddingRight: '5px', verticalAlign: 'middle' }}>{sf(((results.machine.totalAnnualCost / results.manual.totalAnnualCost - 1) * 100), 1)}%</td>
            </tr>
            <tr className="bg-blue-600 text-white font-black">
              <td className="border border-blue-700 p-4 text-sm uppercase tracking-tighter" style={{ wordBreak: 'break-word', verticalAlign: 'middle' }}>{t.costPerPair} (FOB)</td>
              <td className="border border-blue-700 p-4 text-right text-sm font-mono" style={{ paddingRight: '5px', verticalAlign: 'middle' }}>${sf(results.manual.costPerPair, 3)}</td>
              <td className="border border-blue-700 p-4 text-right text-sm font-mono" style={{ paddingRight: '5px', verticalAlign: 'middle' }}>${sf(results.machine.costPerPair, 3)}</td>
              <td className="border border-blue-700 p-4 text-right text-sm font-mono" style={{ paddingRight: '5px', verticalAlign: 'middle' }}>-${sf(results.savings.fobImpact, 3)}</td>
              <td className="border border-blue-700 p-4 text-right text-sm font-mono" style={{ paddingRight: '5px', verticalAlign: 'middle' }}>-{sf(((1 - results.machine.costPerPair / results.manual.costPerPair) * 100), 1)}%</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Dual Highlights: ROI & FOB Impact */}
      <div className="grid grid-cols-2 gap-6 mb-10" style={{ pageBreakInside: 'avoid' }}>
        <div className="border-2 border-emerald-600 rounded-xl p-8 bg-emerald-50/50 flex flex-col items-center justify-center shadow-sm">
          <span className="text-[10px] font-black uppercase text-emerald-700 mb-3 tracking-[0.2em]">{t.roi}</span>
          <div className="text-5xl font-mono font-black text-emerald-800 tracking-tighter">
            {sf(results.roiMonths, 1)}
            <span className="text-base ml-1 uppercase">{t.months}</span>
          </div>
          <div className="mt-4 px-4 py-1.5 bg-emerald-600 text-white text-[9px] font-black rounded-full uppercase tracking-widest">
            {results.roiMonths <= 18 ? 'High Priority' : 'Standard ROI'}
          </div>
        </div>
        <div className="border-2 border-blue-600 rounded-xl p-8 bg-blue-50/50 flex flex-col items-center justify-center shadow-sm">
          <span className="text-[10px] font-black uppercase text-blue-700 mb-3 tracking-[0.2em]">Cost per Pair Reduction</span>
          <div className="text-5xl font-mono font-black text-blue-800 tracking-tighter">
            -${sf(results.savings.fobImpact, 3)}
          </div>
          <div className="mt-4 px-4 py-1.5 bg-blue-600 text-white text-[9px] font-black rounded-full uppercase tracking-widest">
            FOB Impact
          </div>
        </div>
      </div>

      {/* Section 3: Verdict */}
      <div className="mb-10" style={{ pageBreakBefore: 'always' }}>
        <h2 className="text-[11px] font-black uppercase text-white px-3 py-2 mb-4 tracking-widest" style={{ backgroundColor: '#1e293b', color: '#ffffff' }}>{t.investmentVerdict}</h2>
        {aiEvaluation ? (
          <div className="border-2 border-zinc-200 rounded-xl p-6 bg-zinc-50/30">
            <div className="flex items-center gap-3 mb-4">
              <span className="text-xs font-black uppercase text-zinc-400 tracking-widest">{t.verdict}:</span>
              <span className={cn(
                "px-4 py-1 text-xs font-black uppercase tracking-[0.2em] rounded",
                aiEvaluation.verdict === 'Strongly Recommend' ? "bg-emerald-600 text-white" : 
                aiEvaluation.verdict === 'Consider with Caution' ? "bg-amber-500 text-black" : "bg-red-600 text-white"
              )}>
                {getTranslatedVerdict(aiEvaluation.verdict)}
              </span>
            </div>
            <p className="text-xs text-zinc-700 leading-relaxed mb-6 font-medium italic border-l-4 border-zinc-300 pl-4">
              {aiEvaluation.summary}
            </p>
            <div className="grid grid-cols-2 gap-8">
              <div className="bg-white p-4 rounded-lg border border-zinc-100 shadow-sm">
                <h3 className="text-[10px] font-black uppercase text-emerald-700 mb-3 flex items-center gap-2">
                  <CheckCircle2 size={14} />
                  {t.pros}
                </h3>
                <ul className="text-[10px] text-zinc-600 space-y-2">
                  {aiEvaluation.pros?.map((p: string, i: number) => (
                    <li key={i} className="flex items-start gap-2">
                      <span className="text-emerald-500 font-bold mt-[-2px]">•</span>
                      <span>{p}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="bg-white p-4 rounded-lg border border-zinc-100 shadow-sm">
                <h3 className="text-[10px] font-black uppercase text-red-700 mb-3 flex items-center gap-2">
                  <AlertTriangle size={14} />
                  {t.cons} / {t.risks}
                </h3>
                <ul className="text-[10px] text-zinc-600 space-y-2">
                  {[...(aiEvaluation.cons || []), ...(aiEvaluation.risks || [])].map((c: string, i: number) => (
                    <li key={i} className="flex items-start gap-2">
                      <span className="text-red-500 font-bold mt-[-2px]">•</span>
                      <span>{c}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        ) : (
          <div className="text-center py-10 border-2 border-dashed border-zinc-200 rounded-xl text-zinc-400 text-xs font-bold uppercase tracking-widest bg-zinc-50/50">
            Analysis Pending
          </div>
        )}
      </div>

      {/* Section 4: Signature Block */}
      <div className="html2pdf__page-break" />
      <div className="mt-auto pt-12" style={{ pageBreakInside: 'avoid' }}>
        <div className="border-2 border-zinc-800 rounded-lg overflow-hidden">
          <table className="w-full text-[10px] border-collapse">
            <tbody>
              <tr>
                <td className="w-1/5 text-center border-r border-zinc-200 p-4">
                  <div className="h-20 mb-3 bg-zinc-50/30 rounded border border-dashed border-zinc-200"></div>
                  <p className="font-black uppercase tracking-tight text-zinc-800">{t.preparedBy}</p>
                  <p className="text-[8px] text-zinc-400 font-bold uppercase mt-1">Date: ____/____/____</p>
                </td>
                <td className="w-1/5 text-center border-r border-zinc-200 p-4">
                  <div className="h-20 mb-3 bg-zinc-50/30 rounded border border-dashed border-zinc-200"></div>
                  <p className="font-black uppercase tracking-tight text-zinc-800">{t.verifiedBy}</p>
                  <p className="text-[8px] text-zinc-400 font-bold uppercase mt-1">Date: ____/____/____</p>
                </td>
                <td className="w-1/5 text-center border-r border-zinc-200 p-4">
                  <div className="h-20 mb-3 bg-zinc-50/30 rounded border border-dashed border-zinc-200"></div>
                  <p className="font-black uppercase tracking-tight text-zinc-800">{t.approvedBy}</p>
                  <p className="text-[8px] text-zinc-400 font-bold uppercase mt-1">Date: ____/____/____</p>
                </td>
                <td className="w-1/5 text-center border-r border-zinc-200 p-4">
                  <div className="h-20 mb-3 bg-zinc-50/30 rounded border border-dashed border-zinc-200"></div>
                  <p className="font-black uppercase tracking-tight text-zinc-800">{t.financeMgr}</p>
                  <p className="text-[8px] text-zinc-400 font-bold uppercase mt-1">Date: ____/____/____</p>
                </td>
                <td className="w-1/5 text-center p-4">
                  <div className="h-20 mb-3 bg-zinc-50/30 rounded border border-dashed border-zinc-200"></div>
                  <p className="font-black uppercase tracking-tight text-zinc-800">{t.gm}</p>
                  <p className="text-[8px] text-zinc-400 font-bold uppercase mt-1">Date: ____/____/____</p>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        
        <div className="mt-12 flex justify-between items-center text-[8px] font-bold text-zinc-400 uppercase tracking-widest border-t border-zinc-100 pt-4">
          <span>Generated by Factory OS ROI Matrix</span>
          <span>Confidential - Internal Use Only</span>
          <span>Page 1 of 1</span>
        </div>
      </div>
    </div>
  );
};
