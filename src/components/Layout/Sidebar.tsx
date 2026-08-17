import React from 'react';
import { LayoutDashboard, FilePlus, Cpu, Languages, History, MessageSquare, Calculator } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { type Language } from '../../types';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const SidebarItem = ({ icon: Icon, label, active, onClick }: any) => (
  <button
    onClick={onClick}
    className={cn(
      "w-full flex items-center gap-3 px-6 py-4 text-xs font-bold uppercase tracking-widest transition-all duration-300",
      active ? "bg-[#006D77] text-white shadow-md border-l-4 border-[#006D77]" : "text-[#4A6B6F] hover:bg-[#83C5BE]/20 hover:text-[#006D77] border-l-4 border-transparent"
    )}
  >
    <Icon className={cn("w-5 h-5", active ? "text-white" : "text-[#006D77]")} strokeWidth={1.5} />
    {label}
  </button>
);

export const Sidebar = ({ activeTab, setActiveTab, lang, setLang, resetForm, t }: any) => {
  return (
    <aside className="w-64 glass-card border-r border-white/40 flex flex-col z-10 m-4 rounded-3xl overflow-hidden shadow-[4px_0_24px_rgba(0,109,119,0.05)]">
      <div className="p-6 border-b border-ims-primary/10 bg-white/30 backdrop-blur-md">
        <div className="flex items-center gap-3 text-ims-primary mb-1">
          <Cpu className="h-8 w-8 text-ims-primary" strokeWidth={1.5} />
          <span className="font-mono font-black text-xl tracking-tighter italic shadow-sm">LY ROI MATRIX</span>
        </div>
        <span className="text-[10px] text-ims-primary/70 font-bold uppercase tracking-[0.1em]">Manufacturing Excellence</span>
      </div>

      <nav className="flex-1 py-6 space-y-1">
        <SidebarItem icon={LayoutDashboard} label={t.dashboard} active={activeTab === 'dashboard'} onClick={() => setActiveTab('dashboard')} />
        <SidebarItem
          icon={Calculator}
          label={t.analysis || 'Analysis'}
          active={activeTab === 'analysis'}
          onClick={() => setActiveTab('analysis')}
        />
        <SidebarItem 
          icon={FilePlus} 
          label={t.newRoi} 
          active={activeTab === 'roi'} 
          onClick={() => {
            setActiveTab('roi');
            resetForm();
          }} 
        />
        <SidebarItem icon={History} label={t.history} active={activeTab === 'history'} onClick={() => setActiveTab('history')} />
        <SidebarItem icon={MessageSquare} label={t.aiAssistant} active={activeTab === 'ai'} onClick={() => setActiveTab('ai')} />
      </nav>

      <div className="p-5 border-t border-ims-primary/10 bg-white/20 backdrop-blur-md">
        <div className="grid grid-cols-3 gap-2 mb-3">
          {(['EN', 'VI', 'ZH-CN', 'ZH-TW', 'ID', 'MY'] as Language[]).map(l => (
            <button
              key={l}
              onClick={() => setLang(l)}
              className={cn(
                "text-[10px] font-bold py-1.5 rounded-lg border transition-all duration-300",
                lang === l ? "bg-[#006D77] border-[#006D77] text-white shadow-md shadow-[#006D77]/20" : "bg-white/50 border-[#006D77]/20 text-[#4A6B6F] hover:border-[#006D77]/50 hover:bg-white/80"
              )}
            >
              {l}
            </button>
          ))}
        </div>
        <div className="w-full flex items-center justify-between px-4 py-2 bg-white/40 border border-white/60 rounded-xl">
          <div className="flex items-center gap-2">
            <Languages size={14} className="text-ims-primary" strokeWidth={1.5} />
            <span className="text-xs font-bold text-[#4A6B6F]">{lang}</span>
          </div>
        </div>
      </div>
    </aside>
  );
};
