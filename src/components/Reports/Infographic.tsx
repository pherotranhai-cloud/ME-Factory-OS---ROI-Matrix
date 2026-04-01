import React from 'react';
import { TrendingUp, Users, Zap, CheckCircle2 } from 'lucide-react';

interface InfographicProps {
  data: {
    title: string;
    keyStats: string[];
    highlights: string[];
  };
  params: any;
  results: any;
}

export const Infographic: React.FC<InfographicProps> = ({ data, params, results }) => {
  return (
    <div 
      id="infographic-card"
      className="w-[800px] bg-gradient-to-br from-zinc-900 to-black p-12 border-4 border-emerald-500/30 rounded-3xl shadow-2xl relative overflow-hidden"
    >
      {/* Background Accents */}
      <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/10 blur-[100px] rounded-full -translate-y-1/2 translate-x-1/2" />
      <div className="absolute bottom-0 left-0 w-64 h-64 bg-purple-500/10 blur-[100px] rounded-full translate-y-1/2 -translate-x-1/2" />

      <div className="relative z-10 space-y-10">
        {/* Header */}
        <div className="text-center space-y-2">
          <h1 className="text-4xl font-black uppercase tracking-tighter text-white">
            {data.title || 'CAPEX ROI ANALYSIS'}
          </h1>
          <div className="h-1 w-32 bg-emerald-500 mx-auto rounded-full" />
          <p className="text-zinc-500 text-sm font-bold uppercase tracking-widest pt-2">
            {params.equipmentName || 'Manufacturing Equipment'} • {params.shoeModel || 'Adidas Production'}
          </p>
        </div>

        {/* Main Stats Grid */}
        <div className="grid grid-cols-3 gap-6">
          <div className="bg-zinc-800/50 p-6 rounded-2xl border border-zinc-700 text-center space-y-2">
            <TrendingUp className="mx-auto text-emerald-400" size={32} />
            <div className="text-3xl font-black text-white">${results.savings.totalAnnualSaving.toLocaleString()}</div>
            <div className="text-[10px] font-bold uppercase text-zinc-500 tracking-widest">Annual Savings</div>
          </div>
          <div className="bg-zinc-800/50 p-6 rounded-2xl border border-zinc-700 text-center space-y-2">
            <Zap className="mx-auto text-amber-400" size={32} />
            <div className="text-3xl font-black text-white">{results.roiMonths.toFixed(1)}</div>
            <div className="text-[10px] font-bold uppercase text-zinc-500 tracking-widest">ROI (Months)</div>
          </div>
          <div className="bg-zinc-800/50 p-6 rounded-2xl border border-zinc-700 text-center space-y-2">
            <Users className="mx-auto text-blue-400" size={32} />
            <div className="text-3xl font-black text-white">-{params.currentManpower - params.proposedManpower}</div>
            <div className="text-[10px] font-bold uppercase text-zinc-500 tracking-widest">Labor Reduction</div>
          </div>
        </div>

        {/* AI Key Stats & Highlights */}
        <div className="grid grid-cols-2 gap-8">
          <div className="space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-widest text-emerald-500 flex items-center gap-2">
              <CheckCircle2 size={16} /> Key Metrics
            </h3>
            <div className="space-y-3">
              {data.keyStats.map((stat, i) => (
                <div key={i} className="flex items-center gap-3 bg-zinc-800/30 p-3 rounded-xl border border-zinc-700/50">
                  <div className="w-2 h-2 bg-emerald-500 rounded-full" />
                  <span className="text-zinc-300 text-sm font-medium">{stat}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-widest text-purple-500 flex items-center gap-2">
              <Zap size={16} /> Project Highlights
            </h3>
            <div className="space-y-3">
              {data.highlights.map((highlight, i) => (
                <div key={i} className="flex items-center gap-3 bg-zinc-800/30 p-3 rounded-xl border border-zinc-700/50">
                  <div className="w-2 h-2 bg-purple-500 rounded-full" />
                  <span className="text-zinc-300 text-sm font-medium">{highlight}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="pt-8 border-t border-zinc-800 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-emerald-500 rounded flex items-center justify-center text-black font-black text-xs">S</div>
            <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-600">Synthetix-PM AI Assistant</span>
          </div>
          <div className="text-[10px] font-bold uppercase tracking-widest text-zinc-600">
            Report Generated: {new Date().toLocaleDateString()}
          </div>
        </div>
      </div>
    </div>
  );
};
