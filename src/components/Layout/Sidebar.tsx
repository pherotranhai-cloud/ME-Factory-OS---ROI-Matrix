import React from 'react';
import { LayoutDashboard, FilePlus, Cpu, Languages, History, MessageSquare } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { Language } from '../../types';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const SidebarItem = ({ icon: Icon, label, active, onClick }: any) => (
  <button
    onClick={onClick}
    className={cn(
      "w-full flex items-center gap-3 px-6 py-3 text-[11px] font-bold uppercase tracking-widest transition-all",
      active ? "bg-emerald-900/20 text-emerald-500 border-r-2 border-emerald-500" : "text-zinc-500 hover:bg-zinc-900/50 hover:text-zinc-300"
    )}
  >
    <Icon size={16} />
    {label}
  </button>
);

export const Sidebar = ({ activeTab, setActiveTab, lang, setLang, resetForm, t }: any) => {
  return (
    <aside className="w-64 factory-border border-r border-zinc-800 flex flex-col bg-[#0d0d0d]">
      <div className="p-6 border-b border-zinc-800">
        <div className="flex items-center gap-2 text-emerald-500 mb-1">
          <Cpu size={24} />
          <span className="font-mono font-black text-lg tracking-tighter italic">FACTORY OS</span>
        </div>
        <span className="text-[9px] text-zinc-600 font-bold uppercase tracking-widest">Manufacturing Excellence</span>
      </div>

      <nav className="flex-1 py-4">
        <SidebarItem icon={LayoutDashboard} label={t.dashboard} active={activeTab === 'dashboard'} onClick={() => setActiveTab('dashboard')} />
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

      <div className="p-4 border-t border-zinc-800">
        <div className="grid grid-cols-3 gap-1 mb-2">
          {(['EN', 'VI', 'ZH-CN', 'ZH-TW', 'ID', 'MY'] as Language[]).map(l => (
            <button
              key={l}
              onClick={() => setLang(l)}
              className={cn(
                "text-[8px] font-bold py-1 border transition-all",
                lang === l ? "bg-emerald-600 border-emerald-500 text-white" : "bg-zinc-900 border-zinc-800 text-zinc-500 hover:border-zinc-700"
              )}
            >
              {l}
            </button>
          ))}
        </div>
        <div className="w-full flex items-center justify-between px-3 py-2 bg-zinc-900/50 rounded">
          <div className="flex items-center gap-2">
            <Languages size={14} className="text-zinc-500" />
            <span className="text-[10px] font-bold text-zinc-400">{lang}</span>
          </div>
        </div>
      </div>
    </aside>
  );
};
