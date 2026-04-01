import React from 'react';
import { Sparkles, CheckCircle2, AlertTriangle } from 'lucide-react';
import { motion } from 'framer-motion';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const AIEvaluation = ({ aiEvaluation }: { aiEvaluation: any }) => {
  if (!aiEvaluation) return null;

  const isPositive = aiEvaluation.verdict === "Strongly Recommend" || aiEvaluation.verdict === "Duyệt Gấp";
  const isCaution = aiEvaluation.verdict === "Consider with Caution" || aiEvaluation.verdict === "Cân Nhắc Kỹ";

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }} 
      animate={{ opacity: 1, y: 0 }} 
      className="factory-card bg-emerald-950/5 border-emerald-500/20"
    >
      <div className="flex items-center gap-2 mb-4">
        <Sparkles className="text-emerald-500" size={18} />
        <h3 className="text-[10px] font-bold uppercase tracking-[0.2em] text-emerald-500/80">AI Strategic Evaluation</h3>
      </div>
      <div className="mb-6">
        <span className={cn(
          "px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-[0.15em] border shadow-sm transition-all",
          isPositive ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30 shadow-emerald-500/10" :
          isCaution ? "bg-amber-500/10 text-amber-400 border-amber-500/30 shadow-amber-500/10" :
          "bg-red-500/10 text-red-400 border-red-500/30 shadow-red-500/10"
        )}>
          {aiEvaluation.verdict}
        </span>
      </div>
      <p className="text-sm text-zinc-400 mb-8 leading-relaxed font-medium italic">"{aiEvaluation.summary}"</p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="space-y-4">
          <h4 className="text-[10px] font-bold uppercase tracking-widest text-emerald-500/80 flex items-center gap-2">
            <div className="w-1 h-3 bg-emerald-500 rounded-full" />
            Strategic Advantages
          </h4>
          <ul className="space-y-3">
            {aiEvaluation.pros?.map((p: string, i: number) => (
              <li key={i} className="text-[11px] text-zinc-500 flex items-start gap-3 group">
                <CheckCircle2 size={14} className="text-emerald-500/50 mt-0.5 group-hover:text-emerald-500 transition-colors" />
                <span className="group-hover:text-zinc-300 transition-colors">{p}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="space-y-4">
          <h4 className="text-[10px] font-bold uppercase tracking-widest text-amber-500/80 flex items-center gap-2">
            <div className="w-1 h-3 bg-amber-500 rounded-full" />
            Critical Risks
          </h4>
          <ul className="space-y-3">
            {aiEvaluation.cons?.map((c: string, i: number) => (
              <li key={i} className="text-[11px] text-zinc-500 flex items-start gap-3 group">
                <AlertTriangle size={14} className="text-red-500/50 mt-0.5 group-hover:text-red-500 transition-colors" />
                <span className="group-hover:text-zinc-300 transition-colors">{c}</span>
              </li>
            ))}
            {aiEvaluation.risks?.map((r: string, i: number) => (
              <li key={i} className="text-[11px] text-zinc-500 flex items-start gap-3 group">
                <AlertTriangle size={14} className="text-amber-500/50 mt-0.5 group-hover:text-amber-500 transition-colors" />
                <span className="group-hover:text-zinc-300 transition-colors">{r}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </motion.div>
  );
};
