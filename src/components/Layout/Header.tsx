import React, { useState, useRef, useEffect } from 'react';
import { Download, Save, Sparkles, FileSpreadsheet, Image as ImageIcon, Wand2, Share2, ChevronDown } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const Header = ({ activeTab, t, viewMode, setViewMode, advancedResults, isEvaluating, isSaving, isGeneratingInfographic, handleEvaluate, handleExportPDF, handleExportExcel, handleGenerateInfographic, handleSave, onAnalyze }: any) => {
  const isActionDisabled = !advancedResults && viewMode !== 'preview';
  const disabledClass = "opacity-50 cursor-not-allowed pointer-events-none";

  const [aiMenuOpen, setAiMenuOpen] = useState(false);
  const [exportMenuOpen, setExportMenuOpen] = useState(false);
  const aiRef = useRef<HTMLDivElement>(null);
  const exportRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (aiRef.current && !aiRef.current.contains(event.target as Node)) {
        setAiMenuOpen(false);
      }
      if (exportRef.current && !exportRef.current.contains(event.target as Node)) {
        setExportMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-[16px] border-b border-white/60 px-8 py-4 flex flex-col md:flex-row justify-between items-center transition-colors shadow-sm gap-4 md:gap-0">
      {/* Left Side: Context & View Switcher */}
      <div className="flex items-center gap-6">
        {activeTab !== 'roi' && (
          <h1 className="text-base font-black uppercase tracking-widest text-[#002D32]">
            {/* Was hardcoded to "Dashboard" for every tab that is not the
                calculator, so the title contradicted the sidebar. */}
            {activeTab === 'analysis' ? (t.analysis || 'Analysis')
              : activeTab === 'history' ? (t.history || 'History Logs')
              : activeTab === 'ai' ? (t.aiAssistant || 'AI Assistant')
              : (t.dashboard || 'Dashboard')}
          </h1>
        )}
        
        {activeTab === 'roi' && (
          <div className="bg-slate-200/60 p-1 rounded-full flex items-center shadow-inner">
            <button 
              onClick={() => setViewMode('form')}
              className={cn("px-4 py-1.5 text-[10px] font-bold uppercase tracking-widest rounded-full transition-all duration-300", viewMode === 'form' ? "bg-white text-[#002D32] shadow-sm" : "text-slate-500 hover:text-[#006D77]")}
            >
              Requirements Form
            </button>
            <button 
              onClick={() => setViewMode('preview')}
              className={cn("px-4 py-1.5 text-[10px] font-bold uppercase tracking-widest rounded-full transition-all duration-300", viewMode === 'preview' ? "bg-white text-[#002D32] shadow-sm" : "text-slate-500 hover:text-[#006D77]")}
            >
              Report Preview
            </button>
          </div>
        )}
      </div>

      {/* Right Side: Action Toolbelt */}
      <div className="flex items-center gap-4 text-sm font-bold">
        {activeTab === 'roi' && (
          <div className="flex items-center gap-3">
            {/* AI Actions Dropdown */}
            <div className="relative" ref={aiRef}>
              <button 
                onClick={() => setAiMenuOpen(!aiMenuOpen)}
                className="factory-btn bg-white/80 text-[#006D77] border border-[#006D77]/20 hover:bg-[#83C5BE]/20 flex items-center gap-2 h-10 px-4 rounded-xl transition-all shadow-none"
              >
                <Wand2 size={16} strokeWidth={2} /> 
                <span className="hidden sm:inline">AI Smart Actions</span>
                <ChevronDown size={14} className={cn("transition-transform duration-200", aiMenuOpen && "rotate-180")} />
              </button>
              
              {aiMenuOpen && (
                <div className="absolute right-0 top-full mt-2 w-56 bg-white/90 backdrop-blur-md border border-slate-200 shadow-xl rounded-[12px] p-2 flex flex-col gap-1 z-50">
                  <button 
                    onClick={() => { onAnalyze(); setAiMenuOpen(false); }} 
                    className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-bold text-[#002D32] hover:bg-[#006D77]/10 transition-colors w-full text-left"
                  >
                    <Sparkles size={16} className="text-[#006D77]" /> AI Analyze Project
                  </button>
                  <button 
                    onClick={() => { handleEvaluate(); setAiMenuOpen(false); }} 
                    disabled={isEvaluating || isActionDisabled}
                    className={cn(
                      "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-bold text-[#002D32] hover:bg-[#006D77]/10 transition-colors w-full text-left",
                      (isEvaluating || isActionDisabled) && "opacity-50 cursor-not-allowed"
                    )}
                  >
                    <Sparkles size={16} className="text-[#006D77]" /> {isEvaluating ? 'Evaluating...' : 'AI Evaluate'}
                  </button>
                  <button 
                    onClick={() => { handleGenerateInfographic(); setAiMenuOpen(false); }} 
                    disabled={isGeneratingInfographic || isActionDisabled}
                    className={cn(
                      "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-bold text-[#002D32] hover:bg-[#006D77]/10 transition-colors w-full text-left",
                      (isGeneratingInfographic || isActionDisabled) && "opacity-50 cursor-not-allowed"
                    )}
                  >
                    <ImageIcon size={16} className="text-[#006D77]" /> {isGeneratingInfographic ? 'Generating...' : t.aiInfographic || 'AI Infographic'}
                  </button>
                </div>
              )}
            </div>
            
            <div className="w-px h-6 bg-slate-200 mx-1"></div>

            {/* Share & Export Actions Dropdown */}
            <div className="relative" ref={exportRef}>
              <button 
                onClick={() => setExportMenuOpen(!exportMenuOpen)}
                className="factory-btn bg-[#006D77] text-white hover:bg-[#005259] flex items-center gap-2 h-10 px-4 rounded-[12px] transition-all shadow-sm"
              >
                <Share2 size={16} strokeWidth={2} /> 
                <span className="hidden sm:inline">Share & Export</span>
                <ChevronDown size={14} className={cn("transition-transform duration-200", exportMenuOpen && "rotate-180")} />
              </button>
              
              {exportMenuOpen && (
                <div className="absolute right-0 top-full mt-2 w-56 bg-white/90 backdrop-blur-md border border-slate-200 shadow-xl rounded-[12px] p-2 flex flex-col gap-1 z-50">
                  <button 
                    onClick={() => { handleExportPDF(); setExportMenuOpen(false); }} 
                    disabled={isSaving || isActionDisabled}
                    className={cn(
                      "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-bold text-[#002D32] hover:bg-slate-100 transition-colors w-full text-left",
                      (isSaving || isActionDisabled) && "opacity-50 cursor-not-allowed"
                    )}
                  >
                    <Download size={16} className="text-[#4A6B6F]" /> Export PDF
                  </button>
                  <button 
                    onClick={() => { handleExportExcel(); setExportMenuOpen(false); }} 
                    disabled={isSaving || isActionDisabled}
                    className={cn(
                      "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-bold text-[#002D32] hover:bg-slate-100 transition-colors w-full text-left",
                      (isSaving || isActionDisabled) && "opacity-50 cursor-not-allowed"
                    )}
                  >
                    <FileSpreadsheet size={16} className="text-[#4A6B6F]" /> Export Excel
                  </button>
                  <div className="h-px w-full bg-slate-200 my-1"></div>
                  <button 
                    onClick={() => { handleSave(); setExportMenuOpen(false); }} 
                    disabled={isSaving}
                    className={cn(
                      "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-bold text-[#002D32] hover:bg-slate-100 transition-colors w-full text-left",
                      isSaving && "opacity-50 cursor-not-allowed"
                    )}
                  >
                    <Save size={16} className="text-[#4A6B6F]" /> {isSaving ? 'Saving...' : 'Save Report'}
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </header>
  );
};

