import React from 'react';
import { Download, Save } from 'lucide-react';

export const Header = ({ activeTab, t, advancedResults, isEvaluating, isSaving, handleEvaluate, handleExportPDF, handleSave }: any) => {
  return (
    <header className="sticky top-0 z-10 bg-[#0a0a0a]/80 backdrop-blur-md border-b border-zinc-800 px-8 py-4 flex justify-between items-center">
      <div className="flex items-center gap-4">
        <h1 className="text-sm font-bold uppercase tracking-[0.2em] text-zinc-200">
          {activeTab === 'roi' ? t.newRoi : t.dashboard}
        </h1>
      </div>
      {activeTab === 'roi' && advancedResults && (
        <div className="flex items-center gap-2">
          <button onClick={handleEvaluate} disabled={isEvaluating} className="factory-btn bg-blue-600 hover:bg-blue-500 text-white border-blue-500">
            {isEvaluating ? 'Evaluating...' : 'AI Evaluate'}
          </button>
          <button onClick={handleExportPDF} disabled={isSaving} className="factory-btn bg-zinc-800 hover:bg-zinc-700 text-white border-zinc-700">
            <Download size={14} /> Export PDF
          </button>
          <button onClick={handleSave} disabled={isSaving} className="factory-btn">
            <Save size={14} /> {isSaving ? 'Saving...' : t.save}
          </button>
        </div>
      )}
    </header>
  );
};
