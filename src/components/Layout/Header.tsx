import React, { useState, useEffect } from 'react';
import { Download, Save, Sparkles, Sun, Moon } from 'lucide-react';

export const Header = ({ activeTab, t, advancedResults, isEvaluating, isSaving, handleEvaluate, handleExportPDF, handleSave, onAnalyze }: any) => {
  const [isDarkMode, setIsDarkMode] = useState(true);

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

        {activeTab === 'roi' && advancedResults && (
          <div className="flex items-center gap-3">
            <button onClick={onAnalyze} className="factory-btn bg-emerald-600 hover:bg-emerald-500 text-white border-emerald-500 flex items-center gap-2 shadow-lg shadow-emerald-900/20 h-10 px-5">
              <Sparkles size={16} /> AI Analyze Project
            </button>
            <button onClick={handleEvaluate} disabled={isEvaluating} className="factory-btn bg-blue-600 hover:bg-blue-500 text-white border-blue-500 flex items-center gap-2 shadow-lg shadow-blue-900/20 h-10 px-5">
              {isEvaluating ? 'Evaluating...' : 'AI Evaluate'}
            </button>
            <button onClick={handleExportPDF} disabled={isSaving} className="factory-btn bg-zinc-800 hover:bg-zinc-700 text-white border-zinc-700 flex items-center gap-2 shadow-lg shadow-black/20 h-10 px-5">
              <Download size={16} /> Export PDF
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
