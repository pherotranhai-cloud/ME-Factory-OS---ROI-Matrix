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
  ChevronDown
} from 'lucide-react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell
} from 'recharts';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { Language } from '../../types';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const StatusBadge = ({ status }: { status: string }) => {
  const colors: any = {
    'Draft': 'bg-zinc-800 text-zinc-400 border-zinc-700',
    'Pending': 'bg-amber-900/30 text-amber-500 border-amber-800/50',
    'Approved': 'bg-emerald-900/30 text-emerald-500 border-emerald-800/50',
    'Implemented': 'bg-blue-900/30 text-blue-500 border-blue-800/50',
    'Dropped': 'bg-red-900/30 text-red-500 border-red-800/50'
  };
  return (
    <span className={cn("px-2 py-0.5 rounded-full text-[10px] font-bold border whitespace-nowrap", colors[status] || colors['Draft'])}>
      {status}
    </span>
  );
};

export const StatusChangeDropdown = ({ reportId, currentStatus, onUpdate }: { reportId: number, currentStatus: string, onUpdate: (status: string) => void }) => {
  const [isOpen, setIsOpen] = useState(false);
  const statuses = ['Draft', 'Approved', 'Dropped'];

  const handleUpdate = async (newStatus: string) => {
    try {
      await fetch(`/api/roi-reports/${reportId}/status`, {
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
        className="flex items-center gap-1 text-[10px] font-bold text-zinc-400 hover:text-white transition-colors"
      >
        <StatusBadge status={currentStatus} />
        <ChevronDown size={12} />
      </button>
      {isOpen && (
        <div className="absolute right-0 mt-1 w-40 bg-zinc-900 border border-zinc-800 rounded-lg shadow-xl z-20 overflow-hidden">
          {statuses.map(s => (
            <button
              key={s}
              onClick={() => handleUpdate(s)}
              className="w-full text-left px-3 py-2 text-[10px] font-bold text-zinc-400 hover:bg-zinc-800 hover:text-white transition-colors"
            >
              {s}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export const Dashboard = ({ lang, t }: { lang: Language, t: any }) => {
  const [stats, setStats] = useState<any>({});
  const [history, setHistory] = useState<any[]>([]);
  const [reports, setReports] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [isLoading, setIsLoading] = useState(true);
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null);

  const fetchDashboardData = async () => {
    setIsLoading(true);
    try {
      const [statsRes, historyRes, reportsRes] = await Promise.all([
        fetch('/api/dashboard-stats').catch(() => null),
        fetch('/api/report-history').catch(() => null),
        fetch('/api/roi-reports').catch(() => null)
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
      const res = await fetch(`/api/roi-reports/${id}`, { method: 'DELETE' });
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
  }, []);

  const filteredReports = (reports || []).filter(r => {
    const matchesSearch = 
      r?.machine_name?.toLowerCase().includes(search.toLowerCase()) ||
      r?.project_id?.toLowerCase().includes(search.toLowerCase()) ||
      r?.vendor?.toLowerCase().includes(search.toLowerCase()) ||
      r?.shoe_model?.toLowerCase().includes(search.toLowerCase());
    
    const matchesStatus = statusFilter === 'All' || r?.status === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

  const COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#71717a'];

  if (isLoading) return (
    <div className="flex items-center justify-center h-full">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500"></div>
    </div>
  );

  return (
    <div className="p-8 space-y-8 max-w-7xl mx-auto">
      {/* Top Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="factory-border bg-zinc-900/50 p-6 rounded-xl">
          <div className="flex justify-between items-start mb-4">
            <div className="p-2 bg-emerald-500/10 rounded-lg">
              <DollarSign className="text-emerald-500" size={20} />
            </div>
          </div>
          <h3 className="text-zinc-500 text-[10px] font-bold uppercase tracking-widest mb-1">Total Approved Investment</h3>
          <p className="text-2xl font-mono font-bold text-white">${(stats?.topStats?.totalInvestment || 0).toLocaleString()}</p>
        </div>

        <div className="factory-border bg-zinc-900/50 p-6 rounded-xl">
          <div className="flex justify-between items-start mb-4">
            <div className="p-2 bg-emerald-500/10 rounded-lg">
              <TrendingUp className="text-emerald-500" size={20} />
            </div>
          </div>
          <h3 className="text-zinc-500 text-[10px] font-bold uppercase tracking-widest mb-1">Global FOB Impact</h3>
          <p className="text-2xl font-mono font-bold text-emerald-500">-${(stats?.topStats?.totalFOBSavings || 0).toFixed(4)} <span className="text-sm">/prs</span></p>
        </div>

        <div className="factory-border bg-zinc-900/50 p-6 rounded-xl">
          <div className="flex justify-between items-start mb-4">
            <div className="p-2 bg-amber-500/10 rounded-lg">
              <Clock className="text-amber-500" size={20} />
            </div>
          </div>
          <h3 className="text-zinc-500 text-[10px] font-bold uppercase tracking-widest mb-1">Average ROI</h3>
          <p className="text-2xl font-mono font-bold text-white">{(stats?.topStats?.avgROI || 0).toFixed(1)} <span className="text-sm">Months</span></p>
        </div>

        <div className="factory-border bg-zinc-900/50 p-6 rounded-xl">
          <div className="flex justify-between items-start mb-4">
            <div className="p-2 bg-blue-500/10 rounded-lg">
              <Activity className="text-blue-500" size={20} />
            </div>
          </div>
          <h3 className="text-zinc-500 text-[10px] font-bold uppercase tracking-widest mb-1">Active Projects</h3>
          <p className="text-2xl font-mono font-bold text-white">{stats?.topStats?.activeProjects || 0}</p>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Left Column: Charts */}
        <div className="lg:col-span-2 space-y-8">
          <div className="factory-border bg-zinc-900/50 p-6 rounded-xl">
            <h3 className="text-sm font-bold text-white mb-6 uppercase tracking-widest flex items-center gap-2">
              <BarChart3 size={16} className="text-zinc-400" />
              Investment vs FOB Impact
            </h3>
            {stats?.comparisonData && stats.comparisonData.length > 0 ? (
              <div className="h-[300px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={stats.comparisonData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
                    <XAxis dataKey="machine_name" stroke="#a1a1aa" fontSize={10} tickLine={false} axisLine={false} />
                    <YAxis yAxisId="left" orientation="left" stroke="#a1a1aa" fontSize={10} tickLine={false} axisLine={false} tickFormatter={(val) => `$${val/1000}k`} />
                    <YAxis yAxisId="right" orientation="right" stroke="#10b981" fontSize={10} tickLine={false} axisLine={false} />
                    <RechartsTooltip 
                      contentStyle={{ backgroundColor: '#18181b', borderColor: '#27272a', fontSize: '12px' }}
                      itemStyle={{ color: '#e4e4e7' }}
                    />
                    <Legend wrapperStyle={{ fontSize: '10px' }} />
                    <Bar yAxisId="left" dataKey="investment" name="Investment ($)" fill="#3f3f46" radius={[4, 4, 0, 0]} />
                    <Bar yAxisId="right" dataKey="fob_impact" name="FOB Impact ($/prs)" fill="#10b981" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-[300px] flex items-center justify-center text-zinc-600 text-sm font-bold uppercase tracking-widest">No Data Available</div>
            )}
          </div>
        </div>

        {/* Right Column: Status Pie & History */}
        <div className="space-y-8">
          <div className="factory-border bg-zinc-900/50 p-6 rounded-xl">
            <h3 className="text-sm font-bold text-white mb-6 uppercase tracking-widest flex items-center gap-2">
              <PieChartIcon size={16} className="text-zinc-400" />
              Project Status
            </h3>
            {stats?.statusDistribution && stats.statusDistribution.length > 0 ? (
              <div className="h-[200px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={stats.statusDistribution}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={80}
                      paddingAngle={5}
                      dataKey="value"
                    >
                      {stats.statusDistribution.map((entry: any, index: number) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <RechartsTooltip 
                      contentStyle={{ backgroundColor: '#18181b', borderColor: '#27272a', fontSize: '12px' }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-[200px] flex items-center justify-center text-zinc-600 text-sm font-bold uppercase tracking-widest">No Data Available</div>
            )}
            <div className="flex flex-wrap gap-3 mt-4 justify-center">
              {stats?.statusDistribution?.map((s: any, i: number) => (
                <div key={s.name} className="flex items-center gap-1.5 text-[10px] font-bold text-zinc-400">
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }}></div>
                  {s.name} ({s.value})
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Projects Table */}
      <div className="factory-border bg-zinc-900/50 rounded-xl overflow-hidden flex flex-col">
        <div className="p-4 border-b border-zinc-800 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <h3 className="text-sm font-bold text-white uppercase tracking-widest flex items-center gap-2">
            <FilePlus size={16} className="text-zinc-400" />
            CAPEX Projects
          </h3>
          <div className="flex items-center gap-3 w-full sm:w-auto">
            <div className="relative flex-1 sm:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" size={14} />
              <input 
                type="text" 
                placeholder="Search projects..." 
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-lg pl-9 pr-4 py-2 text-xs text-white focus:outline-none focus:border-emerald-500 transition-colors"
              />
            </div>
            <select 
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-zinc-950 border border-zinc-800 rounded-lg px-4 py-2 text-xs text-zinc-300 focus:outline-none focus:border-emerald-500 transition-colors"
            >
              <option value="All">All Status</option>
              <option value="Draft">Draft</option>
              <option value="Pending">Pending</option>
              <option value="Approved">Approved</option>
              <option value="Implemented">Implemented</option>
              <option value="Dropped">Dropped</option>
            </select>
          </div>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-zinc-950/50">
                <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-zinc-500 border-b border-zinc-800">Project ID / Machine</th>
                <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-zinc-500 border-b border-zinc-800">Status</th>
                <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-zinc-500 border-b border-zinc-800">Investment</th>
                <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-zinc-500 border-b border-zinc-800">FOB Impact</th>
                <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-zinc-500 border-b border-zinc-800">ROI</th>
                <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-zinc-500 border-b border-zinc-800 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredReports.map((r) => (
                <tr key={r.id} className="border-b border-zinc-800/50 hover:bg-zinc-800/20 transition-colors group">
                  <td className="px-6 py-4">
                    <div className="font-bold text-sm text-zinc-200">{r.machine_name}</div>
                    <div className="text-[10px] text-zinc-500 mt-1 font-mono">{r.project_id || `REQ-${r.id}`} • {r.shoe_model}</div>
                  </td>
                  <td className="px-6 py-4">
                    <StatusChangeDropdown reportId={r.id} currentStatus={r.status || 'Draft'} onUpdate={fetchDashboardData} />
                  </td>
                  <td className="px-6 py-4 font-mono text-sm text-zinc-300">
                    ${(r.investment_cost || 0).toLocaleString()}
                  </td>
                  <td className="px-6 py-4">
                    <span className="font-mono text-sm text-emerald-500 font-bold">
                      -${(r.fob_impact || 0).toFixed(4)}
                    </span>
                  </td>
                  <td className="px-6 py-4 font-mono text-sm text-amber-500">
                    {r.roi_months || r.payback_period} mo
                  </td>
                  <td className="px-6 py-4 text-right relative">
                    {deleteConfirm === r.id ? (
                      <div className="flex items-center justify-end gap-2">
                        <span className="text-[10px] text-red-400 font-bold uppercase">Sure?</span>
                        <button onClick={() => handleDelete(r.id)} className="p-1.5 bg-red-500/20 text-red-500 rounded hover:bg-red-500 hover:text-white transition-colors">
                          <CheckCircle2 size={14} />
                        </button>
                        <button onClick={() => setDeleteConfirm(null)} className="p-1.5 bg-zinc-800 text-zinc-400 rounded hover:text-white transition-colors">
                          <X size={14} />
                        </button>
                      </div>
                    ) : (
                      <button onClick={() => setDeleteConfirm(r.id)} className="p-2 text-zinc-600 hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-all opacity-0 group-hover:opacity-100">
                        <Trash2 size={16} />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {filteredReports.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-zinc-500 text-sm font-bold uppercase tracking-widest">
                    No projects found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
