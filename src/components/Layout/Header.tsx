import React, { useState, useEffect } from 'react';
import { Download, Save, Sparkles, Sun, Moon, FileSpreadsheet, Image as ImageIcon } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const Header = ({ activeTab, t, viewMode, advancedResults, isEvaluating, isSaving, isGeneratingInfographic, handleEvaluate, handleExportPDF, handleExportExcel, handleGenerateInfographic, handleSave, onAnalyze }: any) => {
  const [isDarkMode, setIsDarkMode] = useState(true);

  const isActionDisabled = !advancedResults && viewMode !== 'preview';
  const disabledClass = "opacity-50 cursor-not-allowed pointer-events-none";

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.remove('light-mode');
    } else {
      document.documentElement.classList.add('light-mode');
    }
  }, [isDarkMode]);

  return (
    <header className="sticky top-0 z-10 bg-[#0a0a0a]/80 backdrop-blur-md border-b border-zinc-800 px-8 py-4 flex justify-between items-center transition-colors dark:bg-[#0a0a0a]/80">
      <div className="flex items-center gap-4">
        <h1 className="text-sm font-bold uppercase tracking-[0.2em] text-zinc-200">
          {activeTab === 'roi' ? t.newRoi : t.dashboard}
        </h1>
      </div>
      <div className="flex items-center gap-4">
        <button 
          onClick={() => setIsDarkMode(!isDarkMode)} 
          className="p-2 rounded-full hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 transition-colors"
          title="Toggle Theme"
        >
          {isDarkMode ? <Sun size={18} /> : <Moon size={18} />}
        </button>

        {activeTab === 'roi' && (
          <div className="flex items-center gap-3">
            <button onClick={onAnalyze} className="factory-btn bg-emerald-600 hover:bg-emerald-500 text-white border-emerald-500 flex items-center gap-2 shadow-lg shadow-emerald-900/20 h-10 px-5">
              <Sparkles size={16} /> AI Analyze Project
            </button>
            <button 
              onClick={handleEvaluate} 
              disabled={isEvaluating || isActionDisabled} 
              className={cn(
                "factory-btn bg-blue-600 hover:bg-blue-500 text-white border-blue-500 flex items-center gap-2 shadow-lg shadow-blue-900/20 h-10 px-5",
                isActionDisabled && disabledClass
              )}
            >
              {isEvaluating ? 'Evaluating...' : 'AI Evaluate'}
            </button>
            <button 
              onClick={handleGenerateInfographic} 
              disabled={isGeneratingInfographic || isActionDisabled} 
              className={cn(
                "factory-btn bg-purple-600 hover:bg-purple-500 text-white border-purple-500 flex items-center gap-2 shadow-lg shadow-purple-900/20 h-10 px-5",
                isActionDisabled && disabledClass
              )}
            >
              <ImageIcon size={16} /> {isGeneratingInfographic ? 'Generating...' : t.aiInfographic || 'AI Infographic'}
            </button>
            <button 
              onClick={handleExportPDF} 
              disabled={isSaving || isActionDisabled} 
              className={cn(
                "factory-btn bg-zinc-800 hover:bg-zinc-700 text-white border-zinc-700 flex items-center gap-2 shadow-lg shadow-black/20 h-10 px-5",
                isActionDisabled && disabledClass
              )}
            >
              <Download size={16} /> Export PDF
            </button>
            <button 
              onClick={handleExportExcel} 
              disabled={isSaving || isActionDisabled} 
              className={cn(
                "factory-btn bg-emerald-800 hover:bg-emerald-700 text-white border-emerald-700 flex items-center gap-2 shadow-lg shadow-black/20 h-10 px-5",
                isActionDisabled && disabledClass
              )}
            >
              <FileSpreadsheet size={16} /> Export Excel
            </button>
            <button onClick={handleSave} disabled={isSaving} className="factory-btn flex items-center gap-2 shadow-lg shadow-black/20 h-10 px-5">
              <Save size={16} /> {isSaving ? 'Saving...' : t.saveReport || 'Save Report'}
            </button>
          </div>
        )}
      </div>
    </header>
  );
};
