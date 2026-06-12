import React, { useState, useEffect } from 'react';
import { 
  DollarSign, 
  TrendingUp, 
  Clock, 
  Activity, 
  BarChart3, 
  PieChart as PieChartIcon, 
  FilePlus, 
  Search, 
  CheckCircle2, 
  X, 
  Trash2,
  ChevronDown,
  Eye,
  Download,
  Edit2
} from 'lucide-react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell
} from 'recharts';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { Language } from '../../types';
import { CAPEXReportTemplate, generatePDF } from '../Reports/PDFTemplate';
import { TRANSLATIONS } from '../../constants/translations';
import { calculateAdvancedROI } from '../../hooks/useAppState';

import { API_BASE_URL } from '../../config/api';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const StatusBadge = ({ status }: { status: string }) => {
  const colors: any = {
    'Draft': 'bg-slate-200 text-slate-700 border-slate-300',
    'Pending': 'bg-orange-100 text-orange-700 border-orange-200',
    'Approved': 'bg-emerald-100 text-emerald-700 border-emerald-200',
    'Implemented': 'bg-blue-100 text-blue-700 border-blue-200',
    'Dropped': 'bg-red-100 text-red-700 border-red-200'
  };
  return (
    <span className={cn("px-2 py-0.5 rounded-full text-[10px] font-bold border whitespace-nowrap shadow-sm", colors[status] || colors['Draft'])}>
      {status}
    </span>
  );
};

export const StatusChangeDropdown = ({ reportId, currentStatus, onUpdate }: { reportId: number, currentStatus: string, onUpdate: (status: string) => void }) => {
  const [isOpen, setIsOpen] = useState(false);
  const statuses = ['Draft', 'Approved', 'Dropped'];

  const handleUpdate = async (newStatus: string) => {
    try {
      await fetch(`${API_BASE_URL}/roi-reports/${reportId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          status: newStatus,
          changed_by: 'Admin User',
          comment: `Status changed from ${currentStatus} to ${newStatus}`
        })
      });
      onUpdate(newStatus);
      setIsOpen(false);
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="relative">
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-1 text-[10px] font-bold text-slate-500 hover:text-ims-primary transition-colors"
      >
        <StatusBadge status={currentStatus} />
        <ChevronDown size={12} />
      </button>
      {isOpen && (
        <div className="absolute right-0 mt-1 w-40 bg-white border border-ims-primary/20 rounded-lg shadow-xl z-20 overflow-hidden">
          {statuses.map(s => (
            <button
              key={s}
              onClick={() => handleUpdate(s)}
              className="w-full text-left px-4 py-2 text-[10px] font-bold text-slate-700 hover:bg-ims-primary/10 hover:text-ims-primary transition-colors"
            >
              {s}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export const Dashboard = ({ lang, t, refreshTrigger, onEditReport }: { lang: Language, t: any, refreshTrigger: number, onEditReport: (report: any) => void }) => {
  const [stats, setStats] = useState<any>({});
  const [history, setHistory] = useState<any[]>([]);
  const [reports, setReports] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [isLoading, setIsLoading] = useState(true);
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null);
  const [selectedReport, setSelectedReport] = useState<any>(null);

  const fetchDashboardData = async () => {
    setIsLoading(true);
    try {
      const [statsRes, historyRes, reportsRes] = await Promise.all([
        fetch(`${API_BASE_URL}/dashboard/analytics`).catch(() => null),
        fetch(`${API_BASE_URL}/report-history`).catch(() => null),
        fetch(`${API_BASE_URL}/roi-reports`).catch(() => null)
      ]);

      const safeJson = async (res: Response | null, fallback: any) => {
        if (!res || !res.ok) return fallback;
        try {
          return await res.json();
        } catch (e) {
          return fallback;
        }
      };

      const statsData = await safeJson(statsRes, {});
      const historyData = await safeJson(historyRes, []);
      const reportsData = await safeJson(reportsRes, []);

      setStats(statsData || {});
      setHistory(Array.isArray(historyData) ? historyData : []);
      setReports(Array.isArray(reportsData) ? reportsData : []);
    } catch (err) {
      console.error("Dashboard Fetch Error:", err);
      setStats({});
      setHistory([]);
      setReports([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async (id: number) => {
    try {
      const res = await fetch(`${API_BASE_URL}/roi-reports/${id}`, { method: 'DELETE' });
      if (res.ok) {
        fetchDashboardData();
        setDeleteConfirm(null);
      }
    } catch (err) {
      console.error("Delete Error:", err);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, [refreshTrigger]);

  const filteredReports = (reports || []).filter(r => {
    const matchesSearch = 
      r?.machine_name?.toLowerCase().includes(search.toLowerCase()) ||
      r?.project_id?.toLowerCase().includes(search.toLowerCase()) ||
      r?.vendor?.toLowerCase().includes(search.toLowerCase()) ||
      r?.shoe_model?.toLowerCase().includes(search.toLowerCase());
    
    const matchesStatus = statusFilter === 'All' || r?.status === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

  const COLORS = ['#006D77', '#83C5BE', '#FFDDD2', '#E29578', '#002124', '#00a896'];

  const investmentVsSaving = React.useMemo(() => {
    return stats?.investmentVsSaving || [];
  }, [stats]);

  const statusDistribution = React.useMemo(() => {
    return stats?.statusDistribution || [];
  }, [stats]);

  const vendorInvestment = React.useMemo(() => {
    return stats?.vendorInvestment || [];
  }, [stats]);

  const roiDistribution = React.useMemo(() => {
    return stats?.roiDistribution || [];
  }, [stats]);

  const handleExportPDF = async (report: any) => {
    try {
      // We need to temporarily render the template to capture it
      setSelectedReport(report);
      setTimeout(async () => {
        await generatePDF('capex-template', `CAPEX_Proposal_${report.shoe_model}_${report.created_at.split('T')[0]}.pdf`);
      }, 500);
    } catch (err: any) {
      console.error(err);
      alert('PDF Export failed: ' + err.message);
    }
  };

  if (isLoading) return (
    <div className="flex items-center justify-center h-full">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-ims-primary"></div>
    </div>
  );

  return (
    <div className="p-8 space-y-8 max-w-7xl mx-auto">
      {/* Top Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {[
          { label: t.totalApprovedInvestment || 'Total Approved Investment', value: `$${(stats?.topStats?.totalInvestment || 0).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}`, icon: DollarSign },
          { label: t.globalFobImpact || 'Global FOB Impact', value: `-$${(stats?.topStats?.totalFOBSavings || 0).toLocaleString(undefined, {minimumFractionDigits: 4, maximumFractionDigits: 4})}`, icon: TrendingUp },
          { label: t.averageRoi || 'Average ROI', value: `${(stats?.topStats?.avgROI || 0).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})} ${t.months || 'Months'}`, icon: Clock },
          { label: t.activeProjects || 'Active Projects', value: stats?.topStats?.activeProjects || 0, icon: Activity },
        ].map((stat, i) => (
          <div key={i} className="glass-card p-6 flex flex-col justify-center rounded-[20px]">
            <div className="flex justify-between items-start mb-4">
              <div className={`p-3 bg-ims-primary/10 rounded-2xl`}>
                <stat.icon className={`text-ims-primary`} size={24} strokeWidth={1.5} />
              </div>
            </div>
            <h3 className="text-slate-500 text-xs font-bold uppercase tracking-widest mb-1">{stat.label}</h3>
            <p className="text-3xl font-sans font-black tracking-tight text-[#002D32]">{stat.value}</p>
          </div>
        ))}
      </div>

      {/* Main Content Area */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Chart 1: Investment vs Saving */}
        <div className="glass-card p-6 flex flex-col rounded-[20px] min-h-[350px]">
          <h3 className="text-sm font-bold text-[#002D32] mb-6 uppercase tracking-widest flex items-center gap-2">
            <BarChart3 size={18} className="text-ims-primary" strokeWidth={1.5} />
            {t.investmentVsSavings || 'Investment vs Savings'}
          </h3>
          <div className="flex-1 w-full relative min-h-[300px]">
            {!investmentVsSaving || investmentVsSaving.length === 0 ? (
              <div className="absolute inset-0 flex items-center justify-center text-slate-500 font-medium">No Data Available</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%" minHeight={300} aspect={2}>
                <BarChart data={investmentVsSaving}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#cbd5e1" vertical={false} opacity={0.3} />
                  <XAxis dataKey="name" stroke="#64748b" fontSize={10} tickLine={false} axisLine={false} />
                  <YAxis stroke="#64748b" fontSize={10} tickLine={false} axisLine={false} tickFormatter={(val) => `$${val/1000}k`} />
                  <RechartsTooltip 
                    contentStyle={{ backgroundColor: 'rgba(255, 255, 255, 0.9)', backdropFilter: 'blur(12px)', borderColor: 'rgba(0,109,119,0.2)', fontSize: '12px', borderRadius: '12px', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }}
                    formatter={(value: number) => value.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}
                  />
                  <Bar dataKey="investment" name={t.investment || 'Investment'} fill="#006D77" fillOpacity={0.8} radius={[10, 10, 0, 0]} isAnimationActive={false} />
                  <Bar dataKey="savings" name={t.savings || 'Savings'} fill="#83C5BE" fillOpacity={0.9} radius={[10, 10, 0, 0]} isAnimationActive={false} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Chart 2: Project Status Distribution */}
        <div className="glass-card p-6 flex flex-col rounded-[20px] min-h-[350px]">
          <h3 className="text-sm font-bold text-[#002D32] mb-6 uppercase tracking-widest flex items-center gap-2">
            <PieChartIcon size={18} className="text-ims-primary" strokeWidth={1.5} />
            {t.projectStatus || 'Project Status'}
          </h3>
          <div className="flex-1 w-full relative min-h-[300px]">
            {!statusDistribution || statusDistribution.length === 0 ? (
              <div className="absolute inset-0 flex items-center justify-center text-slate-500 font-medium">No Data Available</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%" minHeight={300} aspect={2}>
                <PieChart>
                  <Pie data={statusDistribution} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label isAnimationActive={false}>
                    {statusDistribution.map((entry, index) => <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />)}
                  </Pie>
                  <RechartsTooltip contentStyle={{ backgroundColor: 'rgba(255, 255, 255, 0.9)', backdropFilter: 'blur(12px)', borderColor: 'rgba(0,109,119,0.2)', fontSize: '12px', borderRadius: '12px' }} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Chart 3: Investment by Vendor */}
        <div className="glass-card p-6 flex flex-col rounded-[20px] min-h-[350px]">
          <h3 className="text-sm font-bold text-[#002D32] mb-6 uppercase tracking-widest flex items-center gap-2">
            <PieChartIcon size={18} className="text-ims-primary" strokeWidth={1.5} />
            {t.investmentByVendor || 'Investment by Vendor'}
          </h3>
          <div className="flex-1 w-full relative min-h-[300px]">
            {!vendorInvestment || vendorInvestment.length === 0 ? (
              <div className="absolute inset-0 flex items-center justify-center text-slate-500 font-medium">No Data Available</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%" minHeight={300} aspect={2}>
                <PieChart>
                  <Pie data={vendorInvestment} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={60} outerRadius={80} label isAnimationActive={false}>
                    {vendorInvestment.map((entry, index) => <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />)}
                  </Pie>
                  <RechartsTooltip contentStyle={{ backgroundColor: 'rgba(255, 255, 255, 0.9)', backdropFilter: 'blur(12px)', borderColor: 'rgba(0,109,119,0.2)', fontSize: '12px', borderRadius: '12px' }} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Chart 4: ROI Distribution */}
        <div className="glass-card p-6 flex flex-col rounded-[20px] min-h-[350px]">
          <h3 className="text-sm font-bold text-[#002D32] mb-6 uppercase tracking-widest flex items-center gap-2">
            <BarChart3 size={18} className="text-ims-primary" strokeWidth={1.5} />
            {t.roiDistribution || 'ROI Distribution (Months)'}
          </h3>
          <div className="flex-1 w-full relative min-h-[300px]">
            {!roiDistribution || roiDistribution.length === 0 ? (
              <div className="absolute inset-0 flex items-center justify-center text-slate-500 font-medium">No Data Available</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%" minHeight={300} aspect={2}>
                <BarChart data={roiDistribution}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#cbd5e1" vertical={false} opacity={0.3} />
                  <XAxis dataKey="name" stroke="#64748b" fontSize={10} tickLine={false} axisLine={false} />
                  <YAxis stroke="#64748b" fontSize={10} tickLine={false} axisLine={false} />
                  <RechartsTooltip 
                    contentStyle={{ backgroundColor: 'rgba(255, 255, 255, 0.9)', backdropFilter: 'blur(12px)', borderColor: 'rgba(0,109,119,0.2)', fontSize: '12px', borderRadius: '12px', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }}
                    formatter={(value: number) => value.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}
                  />
                  <Bar dataKey="roi" name={t.roiMonths || 'ROI (Months)'} fill="#002124" fillOpacity={0.8} radius={[10, 10, 0, 0]} isAnimationActive={false} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>

      {/* Projects Table */}
      <div className="glass-card rounded-[20px] overflow-hidden flex flex-col">
        <div className="p-6 border-b border-ims-primary/10 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <h3 className="text-sm font-bold text-[#002D32] uppercase tracking-widest flex items-center gap-2">
            <FilePlus size={18} className="text-ims-primary" strokeWidth={1.5} />
            {t.capexProjects || 'CAPEX Projects'}
          </h3>
          <div className="flex items-center gap-3 w-full sm:w-auto">
            <div className="relative flex-1 sm:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
              <input 
                type="text" 
                placeholder={t.searchProjects || "Search projects..."}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full bg-white/50 border border-ims-primary/20 rounded-xl pl-9 pr-4 py-2 text-xs text-[#002D32] focus:outline-none focus:border-ims-primary focus:ring-2 focus:ring-ims-primary/30 transition-all font-mono"
              />
            </div>
            <select 
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-white/50 border border-ims-primary/20 rounded-xl px-4 py-2 text-xs text-[#002D32] focus:outline-none focus:border-ims-primary focus:ring-2 focus:ring-ims-primary/30 transition-all font-mono"
            >
              <option value="All">{t.allStatus || 'All Status'}</option>
              <option value="Draft">{t.draft || 'Draft'}</option>
              <option value="Pending">{t.pending || 'Pending'}</option>
              <option value="Approved">{t.approved || 'Approved'}</option>
              <option value="Implemented">{t.implemented || 'Implemented'}</option>
              <option value="Dropped">{t.dropped || 'Dropped'}</option>
            </select>
          </div>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-ims-primary/5">
                <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-[#4A6B6F] border-b border-ims-primary/10">{t.projectIdMachine || 'Project ID / Machine'}</th>
                <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-[#4A6B6F] border-b border-ims-primary/10">{t.status || 'Status'}</th>
                <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-[#4A6B6F] border-b border-ims-primary/10">{t.investment || 'Investment'}</th>
                <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-[#4A6B6F] border-b border-ims-primary/10">{t.fobImpact || 'FOB Impact'}</th>
                <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-[#4A6B6F] border-b border-ims-primary/10">{t.roi || 'ROI'}</th>
                <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-[#4A6B6F] border-b border-ims-primary/10 text-right">{t.actions || 'Actions'}</th>
              </tr>
            </thead>
            <tbody>
              {filteredReports.map((r) => (
                <tr key={r.id} className="border-b border-ims-primary/5 hover:bg-ims-primary/5 transition-colors group">
                  <td className="px-6 py-4">
                    <div className="font-bold text-sm text-[#002D32]">{r.machine_name || 'Unnamed Project'}</div>
                    <div className="text-[10px] text-slate-500 mt-1 font-mono">{r.project_id || `REQ-${r.id}`} • {r.shoe_model}</div>
                  </td>
                  <td className="px-6 py-4">
                    <StatusChangeDropdown reportId={r.id} currentStatus={r.status || 'Draft'} onUpdate={fetchDashboardData} />
                  </td>
                  <td className="px-6 py-4 font-mono text-sm text-[#002D32]">
                    ${(r.investment_cost || 0).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}
                  </td>
                  <td className="px-6 py-4">
                    <span className="font-mono text-sm text-ims-primary font-bold">
                      -${(r.fob_impact || 0).toLocaleString(undefined, {minimumFractionDigits: 4, maximumFractionDigits: 4})}
                    </span>
                  </td>
                  <td className="px-6 py-4 font-mono text-sm text-ims-primary">
                    {(r.roi_months || r.payback_period || 0).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})} mo
                  </td>
                  <td className="px-6 py-4 text-right relative">
                    <div className="flex items-center justify-end gap-2">
                       <button 
                        onClick={() => setSelectedReport(r)}
                        className="p-2 text-slate-400 hover:text-ims-primary hover:bg-ims-primary/10 rounded-lg transition-all"
                        title="View Report"
                      >
                        <Eye size={16} />
                      </button>
                      <button 
                        onClick={() => onEditReport(r)}
                        className="p-2 text-slate-400 hover:text-blue-500 hover:bg-blue-500/10 rounded-lg transition-all"
                        title="Edit Report"
                      >
                        <Edit2 size={16} />
                      </button>
                      {deleteConfirm === r.id ? (
                        <div className="flex items-center justify-end gap-2">
                          <span className="text-[10px] text-red-500 font-bold uppercase">Sure?</span>
                          <button onClick={() => handleDelete(r.id)} className="p-1.5 bg-red-500/10 text-red-600 rounded hover:bg-red-500 hover:text-white transition-colors">
                            <CheckCircle2 size={14} />
                          </button>
                          <button onClick={() => setDeleteConfirm(null)} className="p-1.5 bg-slate-200 text-slate-600 rounded hover:text-slate-700 transition-colors">
                            <X size={14} />
                          </button>
                        </div>
                      ) : (
                        <button onClick={() => setDeleteConfirm(r.id)} className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-all opacity-0 group-hover:opacity-100">
                          <Trash2 size={16} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {filteredReports.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-slate-500 text-sm font-bold uppercase tracking-widest">
                    {t.noProjectsFound || 'No projects found'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
      
      {/* Hidden Template for PDF Export */}
      <div id="capex-template" className="hidden">
        {selectedReport && (
          <CAPEXReportTemplate 
            params={selectedReport.form_data} 
            results={calculateAdvancedROI(selectedReport.form_data)} 
            aiEvaluation={selectedReport.ai_evaluation} 
            t={t} 
            uploadedImages={selectedReport.image_url} 
            lang={lang} 
          />
        )}
      </div>
    </div>
  );
};
