import React from 'react';
import { Cpu, CheckCircle2, AlertTriangle } from 'lucide-react';
import { motion } from 'framer-motion';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const AIEvaluation = ({ aiEvaluation }: { aiEvaluation: any }) => {
  if (!aiEvaluation) return null;

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="factory-card bg-blue-950/20 border-blue-900/50">
      <div className="flex items-center gap-2 mb-4">
        <Cpu className="text-blue-500" size={20} />
        <h3 className="text-xs font-bold uppercase tracking-widest text-blue-500">AI Evaluation</h3>
      </div>
      <div className="mb-4">
        <span className={cn(
          "px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest border",
          (aiEvaluation.verdict === "Strongly Recommend" || aiEvaluation.verdict === "Duyệt Gấp") ? "bg-emerald-900/30 text-emerald-500 border-emerald-800/50" :
          (aiEvaluation.verdict === "Consider with Caution" || aiEvaluation.verdict === "Cân Nhắc Kỹ") ? "bg-amber-900/30 text-amber-500 border-amber-800/50" :
          "bg-red-900/30 text-red-500 border-red-800/50"
        )}>
          {aiEvaluation.verdict}
        </span>
      </div>
      <p className="text-sm text-zinc-300 mb-6 leading-relaxed">{aiEvaluation.summary}</p>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <h4 className="text-[10px] font-bold uppercase tracking-widest text-emerald-500 mb-2 flex items-center gap-1"><CheckCircle2 size={12} /> Pros</h4>
          <ul className="space-y-2">
            {aiEvaluation.pros?.map((p: string, i: number) => <li key={i} className="text-xs text-zinc-400 flex items-start gap-2"><span className="text-emerald-500 mt-0.5">•</span> {p}</li>)}
          </ul>
        </div>
        <div>
          <h4 className="text-[10px] font-bold uppercase tracking-widest text-red-500 mb-2 flex items-center gap-1"><AlertTriangle size={12} /> Risks & Cons</h4>
          <ul className="space-y-2">
            {aiEvaluation.cons?.map((c: string, i: number) => <li key={i} className="text-xs text-zinc-400 flex items-start gap-2"><span className="text-red-500 mt-0.5">•</span> {c}</li>)}
            {aiEvaluation.risks?.map((r: string, i: number) => <li key={i} className="text-xs text-zinc-400 flex items-start gap-2"><span className="text-amber-500 mt-0.5">•</span> {r}</li>)}
          </ul>
        </div>
      </div>
    </motion.div>
  );
};
