import React, { useState, useEffect } from 'react';
import { 
  LayoutDashboard, 
  FilePlus, 
  History, 
  Settings, 
  MessageSquare, 
  Download, 
  Cpu, 
  TrendingUp, 
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  ChevronDown,
  Languages,
  Upload,
  Image as ImageIcon,
  X,
  Printer,
  Search,
  Filter,
  DollarSign,
  BarChart3,
  PieChart as PieChartIcon,
  Activity,
  Clock,
  ArrowUpRight,
  Plus,
  Minus,
  Save,
  Trash2
} from 'lucide-react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell
} from 'recharts';
import { motion, AnimatePresence } from 'motion/react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { GoogleGenAI } from "@google/genai";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import html2pdf from 'html2pdf.js';

// --- Dashboard Components ---

const StatusBadge = ({ status }: { status: string }) => {
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

const StatusChangeDropdown = ({ reportId, currentStatus, onUpdate }: { reportId: number, currentStatus: string, onUpdate: (status: string) => void }) => {
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

const Dashboard = ({ lang, t }: { lang: Language, t: any }) => {
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

      // Safely parse JSON or return fallback values if it's HTML/Error
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
      // Fallback to empty states to prevent crashing
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

  // Use Optional Chaining (?.) and empty array fallback to prevent map/filter crashes
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

// --- Utils ---
function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// --- Types ---
type Language = 'VI' | 'EN' | 'ZH-CN' | 'ZH-TW' | 'ID' | 'MY';

const TRANSLATIONS: Record<Language, any> = {
  EN: {
    dashboard: "Dashboard",
    newRoi: "New ROI Matrix",
    history: "History Logs",
    aiAssistant: "AI Assistant",
    sysStatus: "SYS_STATUS: OPTIMAL",
    exportPdf: "Export PDF",
    saveReport: "Save Report",
    step: "Step",
    generalInfo: "General Information",
    techSpecs: "Technical Specifications",
    prodData: "Production Data Comparison",
    manual: "Current State",
    machine: "Proposed State",
    prev: "Previous",
    next: "Next",
    annualSavings: "Cost per Pair Reduction",
    roi: "ROI (Months)",
    months: "MONTHS",
    metric: "Metric",
    diff: "Diff",
    aiEvaluator: "AI Objective Evaluator",
    runAnalysis: "Run AI Analysis",
    regenerate: "Regenerate AI Review",
    verdict: "Verdict",
    pros: "Pros",
    cons: "Cons",
    risks: "Risks",
    summary: "Summary",
    awaiting: "Awaiting Analysis",
    analyzing: "Analyzing...",
    shoeModel: "Shoe Model",
    date: "Date",
    equipment: "Equipment",
    machineType: "Machine Type",
    brand: "Brand",
    scopeOfWork: "Scope of Work",
    powerSupply: "Power Supply",
    powerConsumption: "Power Consumption",
    speed: "Speed",
    unitPrice: "Unit Price",
    metricName: "METRIC NAME",
    remark: "REMARK",
    production: "PRODUCTION",
    consumptionCost: "CONSUMPTION COST",
    others: "OTHERS",
    capacityHour: "Capacity / Hour",
    annualCapacity: "Annual Capacity",
    defectiveRate: "Defective Rate",
    actualGoodOutput: "Actual Good Output",
    manpowerDemand: "Manpower Demand",
    annualLaborCost: "Annual Labor Cost",
    annualMaterialCost: "Annual Material Cost",
    annualEnergyCost: "Annual Energy Cost",
    totalAnnualCost: "Total Annual Cost",
    investmentVerdict: "INVESTMENT VERDICT",
    machinePhoto: "Machine Photo",
    capexProposal: "CAPEX INVESTMENT PROPOSAL",
    maintenanceCost: "Maintenance Cost",
    consumablesCost: "Consumables Cost",
    depreciation: "Depreciation",
    preparedBy: "Prepared by",
    verifiedBy: "Verified by",
    approvedBy: "Approved by",
    financeMgr: "Finance Mgr",
    gm: "GM",
    annualMaintenance: "Annual Maintenance",
    annualConsumables: "Annual Consumables",
    annualDepreciation: "Annual Depreciation",
    costPerPair: "Cost per Pair",
    fobImpact: "FOB Impact",
    machineQuantity: "Machine Quantity",
    operatingCostPerPair: "Operating Cost per Pair",
    materialCostPerPair: "Material Cost per Pair",
  },
  VI: {
    dashboard: "Bảng điều khiển",
    newRoi: "Ma trận ROI mới",
    history: "Lịch sử",
    aiAssistant: "Trợ lý AI",
    sysStatus: "TRẠNG THÁI: TỐI ƯU",
    exportPdf: "Xuất PDF",
    saveReport: "Lưu báo cáo",
    step: "Bước",
    generalInfo: "Thông tin chung",
    techSpecs: "Thông số kỹ thuật",
    prodData: "So sánh dữ liệu sản xuất",
    manual: "Trạng thái hiện tại",
    machine: "Trạng thái đề xuất",
    prev: "Trước",
    next: "Tiếp theo",
    annualSavings: "Giảm chi phí trên mỗi đôi",
    roi: "ROI (Tháng)",
    months: "THÁNG",
    metric: "Chỉ số",
    diff: "Chênh lệch",
    aiEvaluator: "Đánh giá khách quan AI",
    runAnalysis: "Chạy phân tích AI",
    regenerate: "Tạo lại đánh giá AI",
    verdict: "Kết luận",
    pros: "Ưu điểm",
    cons: "Nhược điểm",
    risks: "Rủi ro",
    summary: "Tóm tắt",
    awaiting: "Đang chờ phân tích",
    analyzing: "Đang phân tích...",
    shoeModel: "Mẫu giày",
    date: "Ngày",
    equipment: "Thiết bị",
    machineType: "Loại máy",
    brand: "Thương hiệu",
    scopeOfWork: "Phạm vi công việc",
    powerSupply: "Nguồn điện",
    powerConsumption: "Tiêu thụ điện",
    speed: "Tốc độ",
    unitPrice: "Đơn giá",
    metricName: "TÊN CHỈ SỐ",
    remark: "GHI CHÚ",
    production: "SẢN XUẤT",
    consumptionCost: "CHI PHÍ TIÊU THỤ",
    others: "KHÁC",
    capacityHour: "Công suất / Giờ",
    annualCapacity: "Công suất hàng năm",
    defectiveRate: "Tỷ lệ phế phẩm",
    actualGoodOutput: "Sản lượng đạt chuẩn",
    manpowerDemand: "Nhu cầu nhân lực",
    annualLaborCost: "Chi phí nhân công hàng năm",
    annualMaterialCost: "Chi phí vật tư hàng năm",
    annualEnergyCost: "Chi phí năng lượng hàng năm",
    totalAnnualCost: "Tổng chi phí hàng năm",
    investmentVerdict: "KẾT LUẬN ĐẦU TƯ",
    machinePhoto: "Ảnh máy móc",
    capexProposal: "ĐỀ XUẤT ĐẦU TƯ CAPEX",
    maintenanceCost: "Chi phí bảo trì",
    consumablesCost: "Chi phí vật tư tiêu hao",
    depreciation: "Khấu hao",
    preparedBy: "Người lập",
    verifiedBy: "Người kiểm tra",
    approvedBy: "Người phê duyệt",
    financeMgr: "Quản lý tài chính",
    gm: "Tổng giám đốc",
    annualMaintenance: "Bảo trì hàng năm",
    annualConsumables: "Vật tư hàng năm",
    annualDepreciation: "Khấu hao hàng năm",
    costPerPair: "Chi phí mỗi đôi",
    fobImpact: "Tác động FOB",
    machineQuantity: "Số lượng máy",
    operatingCostPerPair: "Chi phí vận hành/đôi",
    materialCostPerPair: "Chi phí vật tư/đôi",
  },
  'ZH-CN': {
    dashboard: "仪表板",
    newRoi: "新投资回报矩阵",
    history: "历史日志",
    aiAssistant: "AI 助手",
    sysStatus: "系统状态：最佳",
    exportPdf: "导出 PDF",
    saveReport: "保存报告",
    step: "步骤",
    generalInfo: "一般信息",
    techSpecs: "技术规格",
    prodData: "生产数据对比",
    manual: "当前状态",
    machine: "建议状态",
    prev: "上一步",
    next: "下一步",
    annualSavings: "年度总节省",
    roi: "投资回报期 (月)",
    months: "月",
    metric: "指标",
    diff: "差异",
    aiEvaluator: "AI 客观评估器",
    runAnalysis: "运行 AI 分析",
    regenerate: "重新生成 AI 评论",
    verdict: "结论",
    pros: "优点",
    cons: "缺点",
    risks: "风险",
    summary: "摘要",
    awaiting: "等待分析",
    analyzing: "正在分析...",
    shoeModel: "鞋款",
    date: "日期",
    equipment: "设备",
    machineType: "机器类型",
    brand: "品牌",
    scopeOfWork: "工作范围",
    powerSupply: "电源",
    powerConsumption: "功耗",
    speed: "速度",
    unitPrice: "单价",
    metricName: "指标名称",
    remark: "备注",
    production: "生产",
    consumptionCost: "消耗成本",
    others: "其他",
    capacityHour: "产能 / 小时",
    annualCapacity: "年产能",
    defectiveRate: "不良率",
    actualGoodOutput: "实际良品产量",
    manpowerDemand: "人力需求",
    annualLaborCost: "年度人工成本",
    annualMaterialCost: "年度材料成本",
    annualEnergyCost: "年度能源成本",
    totalAnnualCost: "年度总成本",
    investmentVerdict: "投资结论",
    machinePhoto: "机器照片",
    capexProposal: "CAPEX 投资建议书",
    maintenanceCost: "维护成本",
    consumablesCost: "耗材成本",
    depreciation: "折旧",
    preparedBy: "制表",
    verifiedBy: "审核",
    approvedBy: "批准",
    financeMgr: "财务经理",
    gm: "总经理",
    annualMaintenance: "年度维护",
    annualConsumables: "年度耗材",
    annualDepreciation: "年度折旧",
    costPerPair: "单双成本",
    fobImpact: "FOB 影响",
  },
  'ZH-TW': {
    dashboard: "儀表板",
    newRoi: "新投資回報矩陣",
    history: "歷史日誌",
    aiAssistant: "AI 助手",
    sysStatus: "系統狀態：最佳",
    exportPdf: "導出 PDF",
    saveReport: "保存報告",
    step: "步驟",
    generalInfo: "一般信息",
    techSpecs: "技術規格",
    prodData: "生產數據對比",
    manual: "當前狀態",
    machine: "建議狀態",
    prev: "上一步",
    next: "下一步",
    annualSavings: "年度總節省",
    roi: "投資回收期 (月)",
    months: "月",
    metric: "指標",
    diff: "差異",
    aiEvaluator: "AI 客觀評估器",
    runAnalysis: "運行 AI 分析",
    regenerate: "重新生成 AI 評論",
    verdict: "結論",
    pros: "優點",
    cons: "缺點",
    risks: "風險",
    summary: "摘要",
    awaiting: "等待分析",
    analyzing: "正在分析...",
    shoeModel: "鞋款",
    date: "日期",
    equipment: "設備",
    machineType: "機器類型",
    brand: "品牌",
    scopeOfWork: "工作範圍",
    powerSupply: "電源",
    powerConsumption: "功耗",
    speed: "速度",
    unitPrice: "單價",
    metricName: "指標名稱",
    remark: "備註",
    production: "生產",
    consumptionCost: "消耗成本",
    others: "其他",
    capacityHour: "產能 / 小時",
    annualCapacity: "年產能",
    defectiveRate: "不良率",
    actualGoodOutput: "實際良品產量",
    manpowerDemand: "人力需求",
    annualLaborCost: "年度人工成本",
    annualMaterialCost: "年度材料成本",
    annualEnergyCost: "年度能源成本",
    totalAnnualCost: "年度總成本",
    investmentVerdict: "投資結論",
    machinePhoto: "機器照片",
    capexProposal: "CAPEX 投資建議書",
    maintenanceCost: "維護成本",
    consumablesCost: "耗材成本",
    depreciation: "折舊",
    preparedBy: "制表",
    verifiedBy: "審核",
    approvedBy: "批准",
    financeMgr: "財務經理",
    gm: "總經理",
    annualMaintenance: "年度維護",
    annualConsumables: "年度耗材",
    annualDepreciation: "年度折舊",
    costPerPair: "單雙成本",
    fobImpact: "FOB 影響",
  },
  ID: {
    dashboard: "Dasbor",
    newRoi: "Matriks ROI Baru",
    history: "Log Riwayat",
    aiAssistant: "Asisten AI",
    sysStatus: "STATUS_SISTEM: OPTIMAL",
    exportPdf: "Ekspor PDF",
    saveReport: "Simpan Laporan",
    step: "Langkah",
    generalInfo: "Informasi Umum",
    techSpecs: "Spesifikasi Teknis",
    prodData: "Perbandingan Data Produksi",
    manual: "Kondisi Saat Ini",
    machine: "Kondisi Diusulkan",
    prev: "Sebelumnya",
    next: "Berikutnya",
    annualSavings: "Total Penghematan Tahunan",
    roi: "Periode ROI (Bulan)",
    months: "BULAN",
    metric: "Metrik",
    diff: "Diff",
    aiEvaluator: "Evaluator Objektif AI",
    runAnalysis: "Jalankan Analisis AI",
    regenerate: "Buat Ulang Tinjauan AI",
    verdict: "Putusan",
    pros: "Kelebihan",
    cons: "Kekurangan",
    risks: "Risiko",
    summary: "Ringkasan",
    awaiting: "Menunggu Analisis",
    analyzing: "Menganalisis...",
    shoeModel: "Model Sepatu",
    date: "Tanggal",
    equipment: "Peralatan",
    machineType: "Tipe Mesin",
    brand: "Merek",
    scopeOfWork: "Lingkup Kerja",
    powerSupply: "Catu Daya",
    powerConsumption: "Konsumsi Daya",
    speed: "Kecepatan",
    unitPrice: "Harga Satuan",
    metricName: "NAMA METRIK",
    remark: "CATATAN",
    production: "PRODUKSI",
    consumptionCost: "BIAYA KONSUMSI",
    others: "LAINNYA",
    capacityHour: "Kapasitas / Jam",
    annualCapacity: "Kapasitas Tahunan",
    defectiveRate: "Tingkat Cacat",
    actualGoodOutput: "Output Bagus Aktual",
    manpowerDemand: "Permintaan Tenaga Kerja",
    annualLaborCost: "Biaya Tenaga Kerja Tahunan",
    annualMaterialCost: "Biaya Material Tahunan",
    annualEnergyCost: "Biaya Energi Tahunan",
    totalAnnualCost: "Total Biaya Tahunan",
    investmentVerdict: "PUTUSAN INVESTASI",
    machinePhoto: "Foto Mesin",
    capexProposal: "PROPOSAL INVESTASI CAPEX",
    maintenanceCost: "Biaya Pemeliharaan",
    consumablesCost: "Biaya Habis Pakai",
    depreciation: "Depresiasi",
    preparedBy: "Disiapkan oleh",
    verifiedBy: "Diverifikasi oleh",
    approvedBy: "Disetujui oleh",
    financeMgr: "Manajer Keuangan",
    gm: "GM",
    annualMaintenance: "Pemeliharaan Tahunan",
    annualConsumables: "Habis Pakai Tahunan",
    annualDepreciation: "Depresiasi Tahunan",
    costPerPair: "Biaya per Pasang",
    fobImpact: "Dampak FOB",
  },
  MY: {
    dashboard: "Papan Pemuka",
    newRoi: "Matriks ROI Baharu",
    history: "Log Sejarah",
    aiAssistant: "Pembantu AI",
    sysStatus: "STATUS_SISTEM: OPTIMAL",
    exportPdf: "Eksport PDF",
    saveReport: "Simpan Laporan",
    step: "Langkah",
    generalInfo: "Maklumat Am",
    techSpecs: "Spesifikasi Teknikal",
    prodData: "Perbandingan Data Pengeluaran",
    manual: "Keadaan Semasa",
    machine: "Keadaan Cadangan",
    prev: "Sebelumnya",
    next: "Seterusnya",
    annualSavings: "Jumlah Simpanan Tahunan",
    roi: "Tempoh ROI (Bulan)",
    months: "BULAN",
    metric: "Metrik",
    diff: "Diff",
    aiEvaluator: "Penilai Objektif AI",
    runAnalysis: "Jalankan Analisis AI",
    regenerate: "Jana Semula Semakan AI",
    verdict: "Keputusan",
    pros: "Kelebihan",
    cons: "Kekurangan",
    risks: "Risiko",
    summary: "Ringkasan",
    awaiting: "Menunggu Analisis",
    analyzing: "Menganalisis...",
    shoeModel: "Model Kasut",
    date: "Tarikh",
    equipment: "Peralatan",
    machineType: "Jenis Mesin",
    brand: "Jenama",
    scopeOfWork: "Skop Kerja",
    powerSupply: "Bekalan Kuasa",
    powerConsumption: "Penggunaan Kuasa",
    speed: "Kelajuan",
    unitPrice: "Harga Unit",
    metricName: "NAMA METRIK",
    remark: "CATATAN",
    production: "PENGELUARAN",
    consumptionCost: "KOS PENGGUNAAN",
    others: "LAIN-LAIN",
    capacityHour: "Kapasiti / Jam",
    annualCapacity: "Kapasiti Tahunan",
    defectiveRate: "Kadar Kecacatan",
    actualGoodOutput: "Output Baik Sebenar",
    manpowerDemand: "Permintaan Tenaga Kerja",
    annualLaborCost: "Kos Buruh Tahunan",
    annualMaterialCost: "Kos Bahan Tahunan",
    annualEnergyCost: "Kos Tenaga Tahunan",
    totalAnnualCost: "Jumlah Kos Tahunan",
    investmentVerdict: "KEPUTUSAN PELABURAN",
    machinePhoto: "Foto Mesin",
    capexProposal: "PROPOSAL PELABURAN CAPEX",
    maintenanceCost: "Kos Penyelenggaraan",
    consumablesCost: "Kos Bahan Habis Guna",
    depreciation: "Susut Nilai",
    preparedBy: "Disediakan oleh",
    verifiedBy: "Disahkan oleh",
    approvedBy: "Diluluskan oleh",
    financeMgr: "Pengurus Kewangan",
    gm: "GM",
    annualMaintenance: "Penyelenggaraan Tahunan",
    annualConsumables: "Bahan Habis Guna Tahunan",
    annualDepreciation: "Susut Nilai Tahunan",
    costPerPair: "Kos per Pasang",
    fobImpact: "Impak FOB",
  }
};

interface ROIParams {
  // General Info
  shoeModel: string;
  date: string;
  equipmentName: string;
  machineType: string;
  brand: string;
  scopeOfWork: string;
  machineQuantity: number;
  
  // Technical Specs
  powerSupplyV: string;
  powerConsumptionKW: number;
  speedSPrs: number;
  unitPrice: number;
  
  // Production Data - Manual
  manualCapacityPerHour: number;
  manualDefectiveRate: number;
  manualManpower: number;
  
  // Production Data - Machine
  machineCapacityPerHour: number;
  machineDefectiveRate: number;
  machineManpower: number;
  
  // Shared
  currentMaterialCost: number;
  proposedMaterialCost: number;
  workingHoursPerDay: number;
  localLaborCost: number; // Salary
  
  // New Fields
  maintenanceCostPerYear: number;
  consumablesCostPerYear: number;
  depreciationYears: number;
}

interface ROIResults {
  manual: {
    annualCapacity: number;
    actualGoodCapacity: number;
    manpowerDemand: number;
    annualLaborCost: number;
    annualMaterialCost: number;
    annualEnergyCost: number;
    annualMaintenance: number;
    annualConsumables: number;
    annualDepreciation: number;
    totalAnnualCost: number;
    costPerPair: number;
  };
  machine: {
    annualCapacity: number;
    actualGoodCapacity: number;
    manpowerDemand: number;
    annualLaborCost: number;
    annualMaterialCost: number;
    annualEnergyCost: number;
    annualMaintenance: number;
    annualConsumables: number;
    annualDepreciation: number;
    totalAnnualCost: number;
    costPerPair: number;
  };
  savings: {
    manpowerSaving: number;
    laborSaving: number;
    materialSaving: number;
    energySaving: number;
    maintenanceSaving: number;
    consumablesSaving: number;
    totalAnnualSaving: number;
    fobImpact: number;
  };
  roiMonths: number;
}

// --- Components ---

// --- Components ---

const VERDICT_TRANSLATIONS: Record<Language, Record<string, string>> = {
  EN: {
    "Strongly Recommend": "Strongly Recommend",
    "Consider with Caution": "Consider with Caution",
    "Not Recommended": "Not Recommended"
  },
  VI: {
    "Strongly Recommend": "Khuyến nghị mạnh mẽ",
    "Consider with Caution": "Cân nhắc thận trọng",
    "Not Recommended": "Không khuyến nghị"
  },
  'ZH-CN': {
    "Strongly Recommend": "强烈推荐",
    "Consider with Caution": "谨慎考虑",
    "Not Recommended": "不推荐"
  },
  'ZH-TW': {
    "Strongly Recommend": "強烈推薦",
    "Consider with Caution": "謹慎考慮",
    "Not Recommended": "不推薦"
  },
  ID: {
    "Strongly Recommend": "Sangat Direkomendasikan",
    "Consider with Caution": "Pertimbangkan dengan Hati-hati",
    "Not Recommended": "Tidak Direkomendasikan"
  },
  MY: {
    "Strongly Recommend": "Sangat Disyorkan",
    "Consider with Caution": "Pertimbangkan dengan Berhati-hati",
    "Not Recommended": "Tidak Disyorkan"
  }
};

const INITIAL_PARAMS: ROIParams = {
  shoeModel: 'AIR-MAX-2026',
  date: new Date().toISOString().split('T')[0],
  equipmentName: 'Auto-Stitching Unit v4',
  machineType: 'Stitching',
  brand: 'ME-TECH',
  scopeOfWork: 'Assembly Line A',
  machineQuantity: 1,
  powerSupplyV: '220V',
  powerConsumptionKW: 2.5,
  speedSPrs: 15,
  unitPrice: 15000,
  manualCapacityPerHour: 45,
  manualDefectiveRate: 2.5,
  manualManpower: 12,
  machineCapacityPerHour: 180,
  machineDefectiveRate: 0.5,
  machineManpower: 1,
  currentMaterialCost: 0.15,
  proposedMaterialCost: 0.15,
  workingHoursPerDay: 8,
  localLaborCost: 450,
  maintenanceCostPerYear: 500,
  consumablesCostPerYear: 300,
  depreciationYears: 5
};

const safeFixed = (num: any, digits: number = 0) => {
  if (num === null || num === undefined || isNaN(num)) return "0";
  if (num === Infinity) return "N/A";
  return Number(num).toFixed(digits);
};

const CAPEXReportTemplate = ({ params, results, aiEvaluation, t, uploadedImages, lang }: any) => {
  const fmt = (num: any) => (num ?? 0).toLocaleString(undefined, { maximumFractionDigits: 0 });
  const fmtCurrency = (num: any) => '$' + (num ?? 0).toLocaleString(undefined, { maximumFractionDigits: 0 });
  const sf = (num: any, d: number = 0) => safeFixed(num, d);

  const getTranslatedVerdict = (verdict: string) => {
    return VERDICT_TRANSLATIONS[lang as Language]?.[verdict] || verdict;
  };

  return (
    <div id="capex-template" className="bg-white p-[40px] text-black overflow-hidden" style={{ width: '794px', minHeight: '1123px', display: 'flex', flexDirection: 'column', fontFamily: 'Arial, sans-serif' }}>
      {/* Header */}
      <div className="border-b-4 border-emerald-600 pb-6 mb-8 flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-black text-emerald-800 uppercase tracking-tight">{t.capexProposal}</h1>
          <p className="text-[10px] text-zinc-500 font-mono mt-2 tracking-widest">REF: {params.project_id || `${params.shoeModel.toUpperCase()}-${params.date.replace(/-/g, '')}`}</p>
        </div>
        <div className="text-right">
          <div className="flex items-center justify-end gap-2 text-emerald-600 mb-1">
            <Cpu size={20} />
            <span className="font-mono font-black text-xl tracking-tighter italic">FACTORY OS</span>
          </div>
          <p className="text-[10px] text-zinc-400 font-bold uppercase tracking-[0.2em]">Manufacturing Excellence</p>
        </div>
      </div>

      {/* Section 1: Machine Info & Photo - CSS Grid Fix */}
      <div className="grid grid-cols-2 gap-6 mb-10" style={{ pageBreakInside: 'avoid' }}>
        <div className="overflow-hidden">
          <h2 className="text-[11px] font-black uppercase text-white px-3 py-2 mb-4 tracking-widest" style={{ backgroundColor: '#1e293b', color: '#ffffff' }}>{t.generalInfo}</h2>
          <table className="w-full text-[11px] border-collapse">
            <tbody>
              <tr className="border-b border-zinc-200">
                <td className="py-3 font-bold text-zinc-500 w-1/3 uppercase tracking-tighter">{t.shoeModel}</td>
                <td className="py-3 font-medium">{params.shoeModel}</td>
              </tr>
              <tr className="border-b border-zinc-200">
                <td className="py-3 font-bold text-zinc-500 uppercase tracking-tighter">{t.date}</td>
                <td className="py-3 font-medium">{params.date}</td>
              </tr>
              <tr className="border-b border-zinc-200">
                <td className="py-3 font-bold text-zinc-500 uppercase tracking-tighter">{t.equipment}</td>
                <td className="py-3 font-medium">{params.equipmentName}</td>
              </tr>
              <tr className="border-b border-zinc-200">
                <td className="py-3 font-bold text-zinc-500 uppercase tracking-tighter">{t.brand}</td>
                <td className="py-3 font-medium">{params.brand}</td>
              </tr>
              <tr className="border-b border-zinc-200">
                <td className="py-3 font-bold text-zinc-500 uppercase tracking-tighter">{t.machineQuantity}</td>
                <td className="py-3 font-medium">{params.machineQuantity}</td>
              </tr>
              <tr className="border-b border-zinc-200">
                <td className="py-3 font-bold text-zinc-500 uppercase tracking-tighter">{t.unitPrice}</td>
                <td className="py-3 font-black text-emerald-700 text-base">{fmtCurrency(params.unitPrice * params.machineQuantity)}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <div className="flex flex-col items-center justify-center border-2 border-zinc-100 rounded-xl p-4 bg-zinc-50/50 shadow-inner overflow-hidden">
          {uploadedImages.length > 0 ? (
            <img 
              src={uploadedImages[0]} 
              alt="Machine" 
              className="max-w-full max-h-[60mm] object-contain mb-4 rounded shadow-md"
              referrerPolicy="no-referrer"
            />
          ) : (
            <div className="w-full h-[60mm] flex flex-col items-center justify-center text-zinc-300 italic text-[10px] gap-2">
              <ImageIcon size={32} className="opacity-20" />
              <span>No Image Provided</span>
            </div>
          )}
          <div className="w-full h-[1px] bg-zinc-200 mb-2" />
          <p className="text-[9px] font-black uppercase text-zinc-400 tracking-widest">{t.machinePhoto}</p>
        </div>
      </div>

      {/* Section 2: Logic & Data Table */}
      <div className="mb-10" style={{ pageBreakInside: 'avoid' }}>
        <h2 className="text-[11px] font-black uppercase text-white px-3 py-2 mb-4 tracking-widest" style={{ backgroundColor: '#1e293b', color: '#ffffff' }}>{t.prodData}</h2>
        <table className="w-full text-[11px] border-collapse border-2 border-zinc-800" style={{ tableLayout: 'fixed' }}>
          <thead>
            <tr className="bg-zinc-100">
              <th className="border border-zinc-300 p-3 text-left font-black uppercase tracking-tighter text-zinc-600" style={{ width: '40%', wordBreak: 'break-word', verticalAlign: 'middle' }}>{t.metricName}</th>
              <th className="border border-zinc-300 p-3 text-right font-black uppercase tracking-tighter text-zinc-600" style={{ width: '20%', wordBreak: 'break-word', verticalAlign: 'middle', paddingRight: '5px' }}>{t.manual}</th>
              <th className="border border-zinc-300 p-3 text-right font-black uppercase tracking-tighter text-zinc-600" style={{ width: '20%', wordBreak: 'break-word', verticalAlign: 'middle', paddingRight: '5px' }}>{t.machine}</th>
              <th className="border border-zinc-300 p-3 text-right font-black uppercase tracking-tighter text-zinc-600" style={{ width: '10%', wordBreak: 'break-word', verticalAlign: 'middle', paddingRight: '5px' }}>{t.diff}</th>
              <th className="border border-zinc-300 p-3 text-right font-black uppercase tracking-tighter text-zinc-600" style={{ width: '10%', wordBreak: 'break-word', verticalAlign: 'middle', paddingRight: '5px' }}>% Diff</th>
            </tr>
          </thead>
          <tbody>
            {/* Production */}
            <tr style={{ backgroundColor: '#1e293b', color: '#ffffff' }}>
              <td colSpan={5} className="border border-zinc-300 p-2 text-[10px] font-black uppercase tracking-widest">{t.production}</td>
            </tr>
            <tr>
              <td className="border border-zinc-300 p-3 font-medium pl-6" style={{ wordBreak: 'break-word', verticalAlign: 'middle' }}>{t.capacityHour}</td>
              <td className="border border-zinc-300 p-3 text-right font-mono" style={{ paddingRight: '5px', verticalAlign: 'middle' }}>{fmt(params.manualCapacityPerHour)}</td>
              <td className="border border-zinc-300 p-3 text-right font-mono" style={{ paddingRight: '5px', verticalAlign: 'middle' }}>{fmt(params.machineCapacityPerHour)}</td>
              <td className="border border-zinc-300 p-3 text-right font-mono font-bold text-emerald-600" style={{ paddingRight: '5px', verticalAlign: 'middle' }}>+{fmt(params.machineCapacityPerHour - params.manualCapacityPerHour)}</td>
              <td className="border border-zinc-300 p-3 text-right font-mono font-bold text-emerald-600" style={{ paddingRight: '5px', verticalAlign: 'middle' }}>+{sf(((params.machineCapacityPerHour / params.manualCapacityPerHour - 1) * 100), 1)}%</td>
            </tr>
            <tr>
              <td className="border border-zinc-300 p-3 font-medium pl-6" style={{ wordBreak: 'break-word', verticalAlign: 'middle' }}>{t.annualCapacity}</td>
              <td className="border border-zinc-300 p-3 text-right font-mono" style={{ paddingRight: '5px', verticalAlign: 'middle' }}>{fmt(results.manual.annualCapacity)}</td>
              <td className="border border-zinc-300 p-3 text-right font-mono" style={{ paddingRight: '5px', verticalAlign: 'middle' }}>{fmt(results.machine.annualCapacity)}</td>
              <td className="border border-zinc-300 p-3 text-right font-mono font-bold text-emerald-600" style={{ paddingRight: '5px', verticalAlign: 'middle' }}>+{fmt(results.machine.annualCapacity - results.manual.annualCapacity)}</td>
              <td className="border border-zinc-300 p-3 text-right font-mono font-bold text-emerald-600" style={{ paddingRight: '5px', verticalAlign: 'middle' }}>+{sf(((results.machine.annualCapacity / results.manual.annualCapacity - 1) * 100), 1)}%</td>
            </tr>
            <tr>
              <td className="border border-zinc-300 p-3 font-medium pl-6" style={{ wordBreak: 'break-word', verticalAlign: 'middle' }}>{t.defectiveRate}</td>
              <td className="border border-zinc-300 p-3 text-right font-mono" style={{ paddingRight: '5px', verticalAlign: 'middle' }}>{params.manualDefectiveRate}%</td>
              <td className="border border-zinc-300 p-3 text-right font-mono" style={{ paddingRight: '5px', verticalAlign: 'middle' }}>{params.machineDefectiveRate}%</td>
              <td className="border border-zinc-300 p-3 text-right font-mono font-bold text-emerald-600" style={{ paddingRight: '5px', verticalAlign: 'middle' }}>-{fmt(params.manualDefectiveRate - params.machineDefectiveRate)}%</td>
              <td className="border border-zinc-300 p-3 text-right font-mono font-bold text-emerald-600" style={{ paddingRight: '5px', verticalAlign: 'middle' }}>-{sf(((1 - params.machineDefectiveRate / params.manualDefectiveRate) * 100), 1)}%</td>
            </tr>
            <tr>
              <td className="border border-zinc-300 p-3 font-medium pl-6" style={{ wordBreak: 'break-word', verticalAlign: 'middle' }}>{t.actualGoodOutput}</td>
              <td className="border border-zinc-300 p-3 text-right font-mono" style={{ paddingRight: '5px', verticalAlign: 'middle' }}>{fmt(results.manual.actualGoodCapacity)}</td>
              <td className="border border-zinc-300 p-3 text-right font-mono" style={{ paddingRight: '5px', verticalAlign: 'middle' }}>{fmt(results.machine.actualGoodCapacity)}</td>
              <td className="border border-zinc-300 p-3 text-right font-mono font-bold text-emerald-600" style={{ paddingRight: '5px', verticalAlign: 'middle' }}>+{fmt(results.machine.actualGoodCapacity - results.manual.actualGoodCapacity)}</td>
              <td className="border border-zinc-300 p-3 text-right font-mono font-bold text-emerald-600" style={{ paddingRight: '5px', verticalAlign: 'middle' }}>+{sf(((results.machine.actualGoodCapacity / results.manual.actualGoodCapacity - 1) * 100), 1)}%</td>
            </tr>
            {/* Costs */}
            <tr style={{ backgroundColor: '#1e293b', color: '#ffffff' }}>
              <td colSpan={5} className="border border-zinc-300 p-2 text-[10px] font-black uppercase tracking-widest">{t.consumptionCost}</td>
            </tr>
            <tr>
              <td className="border border-zinc-300 p-3 font-medium pl-6" style={{ wordBreak: 'break-word', verticalAlign: 'middle' }}>{t.manpowerDemand}</td>
              <td className="border border-zinc-300 p-3 text-right font-mono" style={{ paddingRight: '5px', verticalAlign: 'middle' }}>{results.manual.manpowerDemand}</td>
              <td className="border border-zinc-300 p-3 text-right font-mono" style={{ paddingRight: '5px', verticalAlign: 'middle' }}>{results.machine.manpowerDemand}</td>
              <td className="border border-zinc-300 p-3 text-right font-mono font-bold text-emerald-600" style={{ paddingRight: '5px', verticalAlign: 'middle' }}>{results.machine.manpowerDemand - results.manual.manpowerDemand}</td>
              <td className="border border-zinc-300 p-3 text-right font-mono font-bold text-emerald-600" style={{ paddingRight: '5px', verticalAlign: 'middle' }}>{sf(((results.machine.manpowerDemand / results.manual.manpowerDemand - 1) * 100), 1)}%</td>
            </tr>
            <tr>
              <td className="border border-zinc-300 p-3 font-medium pl-6" style={{ wordBreak: 'break-word', verticalAlign: 'middle' }}>{t.annualLaborCost}</td>
              <td className="border border-zinc-300 p-3 text-right font-mono" style={{ paddingRight: '5px', verticalAlign: 'middle' }}>{fmtCurrency(results.manual.annualLaborCost)}</td>
              <td className="border border-zinc-300 p-3 text-right font-mono" style={{ paddingRight: '5px', verticalAlign: 'middle' }}>{fmtCurrency(results.machine.annualLaborCost)}</td>
              <td className="border border-zinc-300 p-3 text-right font-mono font-bold text-emerald-600" style={{ paddingRight: '5px', verticalAlign: 'middle' }}>{fmtCurrency(results.machine.annualLaborCost - results.manual.annualLaborCost)}</td>
              <td className="border border-zinc-300 p-3 text-right font-mono font-bold text-emerald-600" style={{ paddingRight: '5px', verticalAlign: 'middle' }}>{sf(((results.machine.annualLaborCost / results.manual.annualLaborCost - 1) * 100), 1)}%</td>
            </tr>
            <tr>
              <td className="border border-zinc-300 p-3 font-medium pl-6" style={{ wordBreak: 'break-word', verticalAlign: 'middle' }}>{t.annualMaintenance}</td>
              <td className="border border-zinc-300 p-3 text-right font-mono" style={{ paddingRight: '5px', verticalAlign: 'middle' }}>{fmtCurrency(results.manual.annualMaintenance)}</td>
              <td className="border border-zinc-300 p-3 text-right font-mono" style={{ paddingRight: '5px', verticalAlign: 'middle' }}>{fmtCurrency(results.machine.annualMaintenance)}</td>
              <td className="border border-zinc-300 p-3 text-right font-mono font-bold text-red-600" style={{ paddingRight: '5px', verticalAlign: 'middle' }}>+{fmtCurrency(results.machine.annualMaintenance)}</td>
              <td className="border border-zinc-300 p-3 text-right font-mono font-bold text-red-600" style={{ paddingRight: '5px', verticalAlign: 'middle' }}>N/A</td>
            </tr>
            <tr>
              <td className="border border-zinc-300 p-3 font-medium pl-6" style={{ wordBreak: 'break-word', verticalAlign: 'middle' }}>{t.annualConsumables}</td>
              <td className="border border-zinc-300 p-3 text-right font-mono" style={{ paddingRight: '5px', verticalAlign: 'middle' }}>{fmtCurrency(results.manual.annualConsumables)}</td>
              <td className="border border-zinc-300 p-3 text-right font-mono" style={{ paddingRight: '5px', verticalAlign: 'middle' }}>{fmtCurrency(results.machine.annualConsumables)}</td>
              <td className="border border-zinc-300 p-3 text-right font-mono font-bold text-red-600" style={{ paddingRight: '5px', verticalAlign: 'middle' }}>+{fmtCurrency(results.machine.annualConsumables)}</td>
              <td className="border border-zinc-300 p-3 text-right font-mono font-bold text-red-600" style={{ paddingRight: '5px', verticalAlign: 'middle' }}>N/A</td>
            </tr>
            <tr>
              <td className="border border-zinc-300 p-3 font-medium pl-6" style={{ wordBreak: 'break-word', verticalAlign: 'middle' }}>{t.annualDepreciation}</td>
              <td className="border border-zinc-300 p-3 text-right font-mono" style={{ paddingRight: '5px', verticalAlign: 'middle' }}>{fmtCurrency(results.manual.annualDepreciation)}</td>
              <td className="border border-zinc-300 p-3 text-right font-mono" style={{ paddingRight: '5px', verticalAlign: 'middle' }}>{fmtCurrency(results.machine.annualDepreciation)}</td>
              <td className="border border-zinc-300 p-3 text-right font-mono font-bold text-red-600" style={{ paddingRight: '5px', verticalAlign: 'middle' }}>+{fmtCurrency(results.machine.annualDepreciation)}</td>
              <td className="border border-zinc-300 p-3 text-right font-mono font-bold text-red-600" style={{ paddingRight: '5px', verticalAlign: 'middle' }}>N/A</td>
            </tr>
            <tr>
              <td className="border border-zinc-300 p-3 font-medium pl-6" style={{ wordBreak: 'break-word', verticalAlign: 'middle' }}>{t.materialCostPerPair}</td>
              <td className="border border-zinc-300 p-3 text-right font-mono" style={{ paddingRight: '5px', verticalAlign: 'middle' }}>${sf(params.currentMaterialCost, 3)}</td>
              <td className="border border-zinc-300 p-3 text-right font-mono" style={{ paddingRight: '5px', verticalAlign: 'middle' }}>${sf(params.proposedMaterialCost, 3)}</td>
              <td className="border border-zinc-300 p-3 text-right font-mono font-bold text-emerald-600" style={{ paddingRight: '5px', verticalAlign: 'middle' }}>${sf((params.proposedMaterialCost - params.currentMaterialCost), 3)}</td>
              <td className="border border-zinc-300 p-3 text-right font-mono font-bold text-emerald-600" style={{ paddingRight: '5px', verticalAlign: 'middle' }}>{sf(((params.proposedMaterialCost / params.currentMaterialCost - 1) * 100), 1)}%</td>
            </tr>
            <tr style={{ backgroundColor: '#1e293b', color: '#ffffff' }}>
              <td colSpan={5} className="border border-zinc-300 p-2 text-[10px] font-black uppercase tracking-widest">Unit Cost Impact</td>
            </tr>
            <tr>
              <td className="border border-zinc-300 p-3 font-medium pl-6" style={{ wordBreak: 'break-word', verticalAlign: 'middle' }}>{t.operatingCostPerPair}</td>
              <td className="border border-zinc-300 p-3 text-right font-mono" style={{ paddingRight: '5px', verticalAlign: 'middle' }}>${sf(results.manual.operatingCostPerPair, 3)}</td>
              <td className="border border-zinc-300 p-3 text-right font-mono" style={{ paddingRight: '5px', verticalAlign: 'middle' }}>${sf(results.machine.operatingCostPerPair, 3)}</td>
              <td className="border border-zinc-300 p-3 text-right font-mono font-bold text-emerald-600" style={{ paddingRight: '5px', verticalAlign: 'middle' }}>${sf((results.machine.operatingCostPerPair - results.manual.operatingCostPerPair), 3)}</td>
              <td className="border border-zinc-300 p-3 text-right font-mono font-bold text-emerald-600" style={{ paddingRight: '5px', verticalAlign: 'middle' }}>{sf(((results.machine.operatingCostPerPair / results.manual.operatingCostPerPair - 1) * 100), 1)}%</td>
            </tr>
            <tr className="bg-emerald-600 text-white font-black">
              <td className="border border-emerald-700 p-4 text-sm uppercase tracking-tighter" style={{ wordBreak: 'break-word', verticalAlign: 'middle' }}>{t.totalAnnualCost}</td>
              <td className="border border-emerald-700 p-4 text-right text-sm font-mono" style={{ paddingRight: '5px', verticalAlign: 'middle' }}>{fmtCurrency(results.manual.totalAnnualCost)}</td>
              <td className="border border-emerald-700 p-4 text-right text-sm font-mono" style={{ paddingRight: '5px', verticalAlign: 'middle' }}>{fmtCurrency(results.machine.totalAnnualCost)}</td>
              <td className="border border-emerald-700 p-4 text-right text-sm font-mono" style={{ paddingRight: '5px', verticalAlign: 'middle' }}>{fmtCurrency(results.machine.totalAnnualCost - results.manual.totalAnnualCost)}</td>
              <td className="border border-emerald-700 p-4 text-right text-sm font-mono" style={{ paddingRight: '5px', verticalAlign: 'middle' }}>{sf(((results.machine.totalAnnualCost / results.manual.totalAnnualCost - 1) * 100), 1)}%</td>
            </tr>
            <tr className="bg-blue-600 text-white font-black">
              <td className="border border-blue-700 p-4 text-sm uppercase tracking-tighter" style={{ wordBreak: 'break-word', verticalAlign: 'middle' }}>{t.costPerPair} (FOB)</td>
              <td className="border border-blue-700 p-4 text-right text-sm font-mono" style={{ paddingRight: '5px', verticalAlign: 'middle' }}>${sf(results.manual.costPerPair, 3)}</td>
              <td className="border border-blue-700 p-4 text-right text-sm font-mono" style={{ paddingRight: '5px', verticalAlign: 'middle' }}>${sf(results.machine.costPerPair, 3)}</td>
              <td className="border border-blue-700 p-4 text-right text-sm font-mono" style={{ paddingRight: '5px', verticalAlign: 'middle' }}>-${sf(results.savings.fobImpact, 3)}</td>
              <td className="border border-blue-700 p-4 text-right text-sm font-mono" style={{ paddingRight: '5px', verticalAlign: 'middle' }}>-{sf(((1 - results.machine.costPerPair / results.manual.costPerPair) * 100), 1)}%</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Dual Highlights: ROI & FOB Impact */}
      <div className="grid grid-cols-2 gap-6 mb-10" style={{ pageBreakInside: 'avoid' }}>
        <div className="border-2 border-emerald-600 rounded-xl p-8 bg-emerald-50/50 flex flex-col items-center justify-center shadow-sm">
          <span className="text-[10px] font-black uppercase text-emerald-700 mb-3 tracking-[0.2em]">{t.roi}</span>
          <div className="text-5xl font-mono font-black text-emerald-800 tracking-tighter">
            {sf(results.roiMonths, 1)}
            <span className="text-base ml-1 uppercase">{t.months}</span>
          </div>
          <div className="mt-4 px-4 py-1.5 bg-emerald-600 text-white text-[9px] font-black rounded-full uppercase tracking-widest">
            {results.roiMonths <= 18 ? 'High Priority' : 'Standard ROI'}
          </div>
        </div>
        <div className="border-2 border-blue-600 rounded-xl p-8 bg-blue-50/50 flex flex-col items-center justify-center shadow-sm">
          <span className="text-[10px] font-black uppercase text-blue-700 mb-3 tracking-[0.2em]">Cost per Pair Reduction</span>
          <div className="text-5xl font-mono font-black text-blue-800 tracking-tighter">
            -${sf(results.savings.fobImpact, 3)}
          </div>
          <div className="mt-4 px-4 py-1.5 bg-blue-600 text-white text-[9px] font-black rounded-full uppercase tracking-widest">
            FOB Impact
          </div>
        </div>
      </div>

      {/* Section 3: Verdict */}
      <div className="mb-10" style={{ pageBreakBefore: 'always' }}>
        <h2 className="text-[11px] font-black uppercase text-white px-3 py-2 mb-4 tracking-widest" style={{ backgroundColor: '#1e293b', color: '#ffffff' }}>{t.investmentVerdict}</h2>
        {aiEvaluation ? (
          <div className="border-2 border-zinc-200 rounded-xl p-6 bg-zinc-50/30">
            <div className="flex items-center gap-3 mb-4">
              <span className="text-xs font-black uppercase text-zinc-400 tracking-widest">{t.verdict}:</span>
              <span className={cn(
                "px-4 py-1 text-xs font-black uppercase tracking-[0.2em] rounded",
                aiEvaluation.verdict === 'Strongly Recommend' ? "bg-emerald-600 text-white" : 
                aiEvaluation.verdict === 'Consider with Caution' ? "bg-amber-500 text-black" : "bg-red-600 text-white"
              )}>
                {getTranslatedVerdict(aiEvaluation.verdict)}
              </span>
            </div>
            <p className="text-xs text-zinc-700 leading-relaxed mb-6 font-medium italic border-l-4 border-zinc-300 pl-4">
              {aiEvaluation.summary}
            </p>
            <div className="grid grid-cols-2 gap-8">
              <div className="bg-white p-4 rounded-lg border border-zinc-100 shadow-sm">
                <h3 className="text-[10px] font-black uppercase text-emerald-700 mb-3 flex items-center gap-2">
                  <CheckCircle2 size={14} />
                  {t.pros}
                </h3>
                <ul className="text-[10px] text-zinc-600 space-y-2">
                  {aiEvaluation.pros?.map((p: string, i: number) => (
                    <li key={i} className="flex items-start gap-2">
                      <span className="text-emerald-500 font-bold mt-[-2px]">•</span>
                      <span>{p}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="bg-white p-4 rounded-lg border border-zinc-100 shadow-sm">
                <h3 className="text-[10px] font-black uppercase text-red-700 mb-3 flex items-center gap-2">
                  <AlertTriangle size={14} />
                  {t.cons} / {t.risks}
                </h3>
                <ul className="text-[10px] text-zinc-600 space-y-2">
                  {[...(aiEvaluation.cons || []), ...(aiEvaluation.risks || [])].map((c: string, i: number) => (
                    <li key={i} className="flex items-start gap-2">
                      <span className="text-red-500 font-bold mt-[-2px]">•</span>
                      <span>{c}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        ) : (
          <div className="text-center py-10 border-2 border-dashed border-zinc-200 rounded-xl text-zinc-400 text-xs font-bold uppercase tracking-widest bg-zinc-50/50">
            Analysis Pending
          </div>
        )}
      </div>

      {/* Section 4: Signature Block */}
      <div className="html2pdf__page-break" />
      <div className="mt-auto pt-12" style={{ pageBreakInside: 'avoid' }}>
        <div className="border-2 border-zinc-800 rounded-lg overflow-hidden">
          <table className="w-full text-[10px] border-collapse">
            <tbody>
              <tr>
                <td className="w-1/5 text-center border-r border-zinc-200 p-4">
                  <div className="h-20 mb-3 bg-zinc-50/30 rounded border border-dashed border-zinc-200"></div>
                  <p className="font-black uppercase tracking-tight text-zinc-800">{t.preparedBy}</p>
                  <p className="text-[8px] text-zinc-400 font-bold uppercase mt-1">Date: ____/____/____</p>
                </td>
                <td className="w-1/5 text-center border-r border-zinc-200 p-4">
                  <div className="h-20 mb-3 bg-zinc-50/30 rounded border border-dashed border-zinc-200"></div>
                  <p className="font-black uppercase tracking-tight text-zinc-800">{t.verifiedBy}</p>
                  <p className="text-[8px] text-zinc-400 font-bold uppercase mt-1">Date: ____/____/____</p>
                </td>
                <td className="w-1/5 text-center border-r border-zinc-200 p-4">
                  <div className="h-20 mb-3 bg-zinc-50/30 rounded border border-dashed border-zinc-200"></div>
                  <p className="font-black uppercase tracking-tight text-zinc-800">{t.approvedBy}</p>
                  <p className="text-[8px] text-zinc-400 font-bold uppercase mt-1">Date: ____/____/____</p>
                </td>
                <td className="w-1/5 text-center border-r border-zinc-200 p-4">
                  <div className="h-20 mb-3 bg-zinc-50/30 rounded border border-dashed border-zinc-200"></div>
                  <p className="font-black uppercase tracking-tight text-zinc-800">{t.financeMgr}</p>
                  <p className="text-[8px] text-zinc-400 font-bold uppercase mt-1">Date: ____/____/____</p>
                </td>
                <td className="w-1/5 text-center p-4">
                  <div className="h-20 mb-3 bg-zinc-50/30 rounded border border-dashed border-zinc-200"></div>
                  <p className="font-black uppercase tracking-tight text-zinc-800">{t.gm}</p>
                  <p className="text-[8px] text-zinc-400 font-bold uppercase mt-1">Date: ____/____/____</p>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        
        <div className="mt-12 flex justify-between items-center text-[8px] font-bold text-zinc-400 uppercase tracking-widest border-t border-zinc-100 pt-4">
          <span>Generated by Factory OS ROI Matrix</span>
          <span>Confidential - Internal Use Only</span>
          <span>Page 1 of 1</span>
        </div>
      </div>
    </div>
  );
};


const SidebarItem = ({ icon: Icon, label, active, onClick }: any) => (
  <button
    onClick={onClick}
    className={cn(
      "w-full flex items-center gap-3 px-4 py-3 transition-all group relative",
      active ? "bg-emerald-950/30 text-emerald-400" : "text-zinc-500 hover:text-zinc-300 hover:bg-zinc-900/50"
    )}
  >
    {active && <div className="absolute left-0 top-0 bottom-0 w-1 bg-emerald-500" />}
    <Icon size={18} className={cn("transition-transform group-hover:scale-110", active && "text-emerald-500")} />
    <span className="text-xs font-bold uppercase tracking-widest">{label}</span>
  </button>
);

const InputField = ({ label, value, onChange, type = "number", suffix }: any) => (
  <div className="mb-4">
    <label className="factory-label">{label}</label>
    <div className="relative">
      <input
        type={type}
        value={value ?? ''}
        onChange={(e) => onChange(type === "number" ? parseFloat(e.target.value) || 0 : e.target.value)}
        className="factory-input w-full"
      />
      {suffix && (
        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-zinc-600 font-mono">
          {suffix}
        </span>
      )}
    </div>
  </div>
);

const ImageUpload = ({ images, setImages }: { images: string[], setImages: (imgs: string[]) => void }) => {
  const [uploading, setUploading] = useState(false);

  const handleImageUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setUploading(true);
    const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME || 'dpxunp88i';
    const uploadPreset = 'ml_default';

    const formData = new FormData();
    formData.append('file', file);
    formData.append('upload_preset', uploadPreset);   

    try {
      const res = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      if (data.secure_url) {
        setUploadedImages(prev => [...prev, data.secure_url]);
      } else {
        console.error("Upload Error Detail:", data);
        alert("Upload failed: " + (data.error?.message || "Unknown error"));
      }
    } catch (err) {
      console.error("Upload fetch error:", err);
    } finally {
      setUploading(false);
    }
  };

  const removeImage = (index: number) => {
    setImages(images.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-4">
      <label className="factory-label">Machine Photos (Max 3)</label>
      <div className="grid grid-cols-3 gap-2">
        {images?.map((url, i) => (
          <div key={i} className="relative aspect-square factory-border overflow-hidden group">
            <img src={url} alt="Upload" className="w-full h-full object-cover" />
            <button 
              onClick={() => removeImage(i)}
              className="absolute top-1 right-1 p-1 bg-red-600 text-white rounded opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <X size={10} />
            </button>
          </div>
        ))}
        {images.length < 3 && (
          <label className="aspect-square factory-border flex flex-col items-center justify-center cursor-pointer hover:bg-zinc-900 transition-colors border-dashed">
            <input type="file" multiple accept="image/*" className="hidden" onChange={handleFileChange} disabled={uploading} />
            <Upload size={16} className={uploading ? "animate-bounce text-emerald-500" : "text-zinc-500"} />
            <span className="text-[8px] font-bold uppercase mt-2 text-zinc-600">{uploading ? 'Uploading...' : 'Add Photo'}</span>
          </label>
        )}
      </div>
    </div>
  );
};

const ResultCard = ({ label, value, subValue, trend }: any) => (
  <div className="factory-card flex flex-col justify-between">
    <div>
      <span className="factory-label">{label}</span>
      <div className="text-2xl font-mono font-bold text-emerald-400 mt-1">
        {value}
      </div>
    </div>
    {subValue && (
      <div className="mt-4 text-[10px] font-mono text-zinc-500 flex items-center gap-1">
        {trend === 'up' && <TrendingUp size={12} className="text-emerald-500" />}
        {subValue}
      </div>
    )}
  </div>
);

// --- Main App ---

export default function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [reports, setReports] = useState<any[]>([]);
  const [loadingReports, setLoadingReports] = useState(false);
  const [editingReportId, setEditingReportId] = useState<number | null>(null);
  const [currentStatus, setCurrentStatus] = useState<string>('Draft');

  useEffect(() => {
    if (activeTab === 'history') {
      fetchReports();
    }
  }, [activeTab]);

  const fetchReports = async () => {
    setLoadingReports(true);
    try {
      const response = await fetch('/api/reports');
      if (!response.ok) throw new Error('Failed to fetch reports');
      const data = await response.json();
      setReports(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingReports(false);
    }
  };
  const [lang, setLang] = useState<Language>('EN');
  const [projectName, setProjectName] = useState('New Project ROI');

  const [roiStep, setRoiStep] = useState(1);
  const [uploadedImages, setUploadedImages] = useState<string[]>([]);
  const reportRef = React.useRef<HTMLDivElement>(null);
  const templateRef = React.useRef<HTMLDivElement>(null);
  const [params, setParams] = useState<ROIParams>(INITIAL_PARAMS);

  const [advancedResults, setAdvancedResults] = useState<ROIResults | null>(null);

  const calculateAdvancedROI = (p: ROIParams): ROIResults => {
    const DAYS_PER_YEAR = 312;
    const HOURS_PER_YEAR = p.workingHoursPerDay * DAYS_PER_YEAR;
    const POWER_RATE_USD = 0.075; // Approx $0.075 per kWh

    // Manual Calculations
    const manualAnnualCapacity = p.manualCapacityPerHour * p.machineQuantity * HOURS_PER_YEAR;
    const manualActualGood = manualAnnualCapacity * (1 - p.manualDefectiveRate / 100);
    const manualAnnualLabor = p.manualManpower * p.machineQuantity * p.localLaborCost * 12;
    const manualAnnualEnergy = 0; 
    const manualAnnualMaintenance = 0;
    const manualAnnualConsumables = 0;
    const manualAnnualDepreciation = 0;

    // Total Annual Cost = Labor + Maintenance + Consumables + Energy + Depreciation
    const manualTotalAnnualCost = manualAnnualLabor + manualAnnualEnergy + manualAnnualMaintenance + manualAnnualConsumables + manualAnnualDepreciation;
    // Cost per Pair = Total Annual Cost / Total Annual Output
    const manualCostPerPair = manualActualGood > 0 ? manualTotalAnnualCost / manualActualGood : 0;
    const manualAnnualMaterial = manualActualGood * p.currentMaterialCost;

    // Machine Calculations
    const machineAnnualCapacity = p.machineCapacityPerHour * p.machineQuantity * HOURS_PER_YEAR;
    const machineActualGood = machineAnnualCapacity * (1 - p.machineDefectiveRate / 100);
    const machineAnnualLabor = p.machineManpower * p.machineQuantity * p.localLaborCost * 12;
    const machineAnnualEnergy = p.powerConsumptionKW * p.machineQuantity * HOURS_PER_YEAR * POWER_RATE_USD;
    const machineAnnualMaintenance = p.maintenanceCostPerYear * p.machineQuantity;
    const machineAnnualConsumables = p.consumablesCostPerYear * p.machineQuantity;
    const machineAnnualDepreciation = p.depreciationYears > 0 ? (p.unitPrice * p.machineQuantity) / p.depreciationYears : 0;
    
    // Total Annual Cost = Labor + Maintenance + Consumables + Energy + Depreciation
    const machineTotalAnnualCost = machineAnnualLabor + machineAnnualEnergy + machineAnnualMaintenance + machineAnnualConsumables + machineAnnualDepreciation;
    // Cost per Pair = Total Annual Cost / Total Annual Output
    const machineCostPerPair = machineActualGood > 0 ? machineTotalAnnualCost / machineActualGood : 0;
    const machineAnnualMaterial = machineActualGood * p.proposedMaterialCost;

    // Savings for SAME OUTPUT (Target = Machine Capacity)
    const manualWorkersNeededForMachineOutput = (p.machineCapacityPerHour / p.manualCapacityPerHour) * p.manualManpower * p.machineQuantity;
    const manpowerSaving = manualWorkersNeededForMachineOutput - (p.machineManpower * p.machineQuantity);
    const laborSaving = manpowerSaving * p.localLaborCost * 12;

    // Material Saving (due to lower defective rate)
    const manualMaterialForSameOutput = machineAnnualCapacity * p.currentMaterialCost * (1 + p.manualDefectiveRate / 100);
    const machineMaterialForSameOutput = machineAnnualCapacity * p.proposedMaterialCost * (1 + p.machineDefectiveRate / 100);
    const materialSaving = manualMaterialForSameOutput - machineMaterialForSameOutput;

    const energySaving = 0 - machineAnnualEnergy;
    const maintenanceSaving = manualAnnualMaintenance - machineAnnualMaintenance;
    const consumablesSaving = manualAnnualConsumables - machineAnnualConsumables;
    
    // FOB Impact is the improvement in operating cost per pair
    const fobImpact = manualCostPerPair - machineCostPerPair;
    const totalAnnualSaving = fobImpact * machineActualGood;
    const roiMonths = totalAnnualSaving > 0 ? ((p.unitPrice * p.machineQuantity) / (totalAnnualSaving / 12)) : Infinity;

    return {
      manual: {
        annualCapacity: manualAnnualCapacity,
        actualGoodCapacity: manualActualGood,
        manpowerDemand: p.manualManpower * p.machineQuantity,
        annualLaborCost: manualAnnualLabor,
        annualMaterialCost: manualAnnualMaterial,
        annualEnergyCost: manualAnnualEnergy,
        annualMaintenance: manualAnnualMaintenance,
        annualConsumables: manualAnnualConsumables,
        annualDepreciation: manualAnnualDepreciation,
        totalAnnualCost: manualTotalAnnualCost,
        costPerPair: manualCostPerPair
      },
      machine: {
        annualCapacity: machineAnnualCapacity,
        actualGoodCapacity: machineActualGood,
        manpowerDemand: p.machineManpower * p.machineQuantity,
        annualLaborCost: machineAnnualLabor,
        annualMaterialCost: machineAnnualMaterial,
        annualEnergyCost: machineAnnualEnergy,
        annualMaintenance: machineAnnualMaintenance,
        annualConsumables: machineAnnualConsumables,
        annualDepreciation: machineAnnualDepreciation,
        totalAnnualCost: machineTotalAnnualCost,
        costPerPair: machineCostPerPair
      },
      savings: {
        manpowerSaving,
        laborSaving,
        materialSaving,
        energySaving,
        maintenanceSaving,
        consumablesSaving,
        totalAnnualSaving,
        fobImpact
      },
      roiMonths
    };
  };

  useEffect(() => {
    setAdvancedResults(calculateAdvancedROI(params));
  }, [params]);

  const [aiEvaluation, setAiEvaluation] = useState<any>(null);
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      // Save to generic reports table
      const response = await fetch('/api/reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          project_name: projectName,
          current_params: params,
          new_params: params,
          results: advancedResults,
          ai_evaluation: aiEvaluation,
          image_url: JSON.stringify(uploadedImages)
        })
      });

      // Save to structured roi_reports table
      const projectId = `CAPEX-${new Date().getFullYear()}-${Math.floor(Math.random() * 1000).toString().padStart(3, '0')}`;
      await fetch('/api/roi-reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          project_id: projectId,
          machine_name: params.equipmentName,
          shoe_model: params.shoeModel,
          vendor: params.brand,
          investment_cost: params.unitPrice,
          labor_saving_cost: advancedResults?.savings.laborSaving,
          energy_saving_cost: advancedResults?.savings.energySaving,
          other_savings: (advancedResults?.savings.materialSaving || 0) + (advancedResults?.savings.maintenanceSaving || 0) + (advancedResults?.savings.consumablesSaving || 0),
          annual_savings: advancedResults?.savings.totalAnnualSaving,
          roi_months: advancedResults?.roiMonths,
          roi_percentage: (advancedResults?.savings.totalAnnualSaving / params.unitPrice) * 100,
          ai_verdict: aiEvaluation?.verdict,
          status: 'Draft',
          tags: ['ROI', params.machineType, params.shoeModel],
          annual_output: params.annualOutput
        })
      });
      
      if (!response.ok) throw new Error('Failed to save report');
      
      alert(`Report saved successfully. Project ID: ${projectId}`);
      setActiveTab('dashboard');
    } catch (error: any) {
      console.error(error);
      alert('Error saving report: ' + error.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleEvaluate = async () => {
    setIsEvaluating(true);
    setAiEvaluation(null);
    try {
      const prompt = `
        Act as a Senior Investment Analyst in the Shoe Manufacturing industry. 
        Analyze these ROI numbers and provide an evaluation in ${lang} language.
        
        Project: ${projectName}
        Params: ${JSON.stringify(params)}
        Calculated Results: ${JSON.stringify(advancedResults)}

        Ensure technical terms like "Manpower demand", "Defective rate", and "ROI period" are translated with industry-standard accuracy for ${lang}.
        
        Provide a structured evaluation in JSON format with:
        - pros: array of 3-4 strings (financial/technical gains)
        - cons: array of 2-3 strings (potential risks like maintenance, skill requirements)
        - risks: array of strings
        - verdict: Choose one: "Strongly Recommend", "Consider with Caution", or "Not Recommended"
        - summary: A 2-sentence executive summary.
      `;

      const response = await fetch('/api/evaluate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt })
      });

      if (!response.ok) throw new Error('AI Evaluation failed');
      const data = await response.json();
      setAiEvaluation(data);
    } catch (error: any) {
      console.error("AI Error:", error);
      setAiEvaluation({
        verdict: "Error",
        summary: error.message || "Connection to AI service failed.",
        pros: [],
        cons: [],
        risks: []
      });
    } finally {
      setIsEvaluating(false);
    }
  };

  const t = TRANSLATIONS[lang];

  const handleExportPDF = async () => {
    if (!advancedResults) return;
    
    setIsSaving(true);
    
    try {
      const element = templateRef.current;
      if (!element) throw new Error("Template not found");

      const opt: any = {
        margin: 15,
        filename: `CAPEX_Proposal_${params.shoeModel}_${params.date}.pdf`,
        image: { type: 'jpeg', quality: 1.0 },
        html2canvas: { 
          scale: 2, 
          useCORS: true,
          logging: false,
          letterRendering: true,
          windowWidth: 1200
        },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
      };

      // Temporarily show the template for capture if needed, 
      // but html2pdf can often capture hidden elements if they are in the DOM.
      // We'll ensure it's rendered but off-screen.
      
      await html2pdf().set(opt).from(element).save();
    } catch (err) {
      console.error(err);
      alert('PDF Export failed: ' + (err as Error).message);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="flex h-screen overflow-hidden bg-[#0a0a0a]">
      {/* Sidebar */}
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
              setEditingReportId(null);
              setProjectName('New Project ROI');
              setParams(INITIAL_PARAMS);
              setAiEvaluation(null);
              setUploadedImages([]);
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

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto relative">
        <header className="sticky top-0 z-10 bg-[#0a0a0a]/80 backdrop-blur-md border-b border-zinc-800 px-8 py-4 flex justify-between items-center">
          <div className="flex items-center gap-4">
            <h1 className="text-sm font-bold uppercase tracking-[0.2em] text-zinc-200">
              {activeTab === 'roi' ? t.newRoi : t.dashboard}
            </h1>
            <div className="h-4 w-[1px] bg-zinc-800" />
            {activeTab === 'roi' && (
              <>
                <input 
                  type="text" 
                  value={projectName ?? ''} 
                  onChange={(e) => setProjectName(e.target.value)}
                  className="bg-transparent border-none text-emerald-500 font-mono text-xs focus:ring-0 w-48"
                  placeholder="Project Name..."
                />
                {editingReportId && (
                  <div className="flex items-center gap-2 ml-4">
                    <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Status:</span>
                    <StatusChangeDropdown 
                      reportId={editingReportId} 
                      currentStatus={currentStatus} 
                      onUpdate={(newStatus) => setCurrentStatus(newStatus)} 
                    />
                  </div>
                )}
              </>
            )}
            <div className="h-4 w-[1px] bg-zinc-800" />
            <span className="text-[10px] font-mono text-zinc-500">{t.sysStatus}</span>
          </div>
          <div className="flex gap-2">
            <button 
              onClick={handleExportPDF}
              className="factory-btn flex items-center gap-2 hover:bg-zinc-800 transition-colors"
            >
              <Printer size={14} />
              {t.exportPdf}
            </button>
            <button 
              onClick={handleSave}
              disabled={isSaving}
              className="factory-btn bg-emerald-600 text-white border-emerald-500 disabled:bg-emerald-900"
            >
              {isSaving ? 'Saving...' : t.saveReport}
            </button>
          </div>
        </header>

        <div className="p-8 max-w-7xl mx-auto">
          <AnimatePresence mode="wait">
            {activeTab === 'dashboard' ? (
              <motion.div
                key="dashboard"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
              >
                <Dashboard lang={lang} t={t} />
              </motion.div>
            ) : activeTab === 'roi' ? (
              <motion.div
                key="roi"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="grid grid-cols-12 gap-8"
              >
                {/* Left: Multi-step Form */}
                <div className="col-span-5 space-y-6">
                  <div className="flex gap-2 mb-4">
                    {[1, 2, 3].map((s) => (
                      <button
                        key={s}
                        onClick={() => setRoiStep(s)}
                        className={cn(
                          "flex-1 py-2 text-[10px] font-bold uppercase tracking-widest border transition-all",
                          roiStep === s ? "bg-emerald-600 border-emerald-500 text-white" : "bg-zinc-900/50 border-zinc-800 text-zinc-500 hover:border-zinc-700"
                        )}
                      >
                        {t.step} {s}
                      </button>
                    ))}
                  </div>

                  <div className="factory-card min-h-[500px]">
                    {roiStep === 1 && (
                      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
                        <h2 className="text-xs font-bold uppercase tracking-widest text-emerald-500 mb-6">{t.generalInfo}</h2>
                        <InputField label="Shoe Model" type="text" value={params.shoeModel} onChange={(v: any) => setParams({...params, shoeModel: v})} />
                        <InputField label="Date" type="date" value={params.date} onChange={(v: any) => setParams({...params, date: v})} />
                        <InputField label="Equipment Name" type="text" value={params.equipmentName} onChange={(v: any) => setParams({...params, equipmentName: v})} />
                        <InputField label="Machine Type" type="text" value={params.machineType} onChange={(v: any) => setParams({...params, machineType: v})} />
                        <InputField label="Brand" type="text" value={params.brand} onChange={(v: any) => setParams({...params, brand: v})} />
                        <InputField label="Scope of Work" type="text" value={params.scopeOfWork} onChange={(v: any) => setParams({...params, scopeOfWork: v})} />
                        <InputField label="Machine Quantity" type="number" value={params.machineQuantity} onChange={(v: any) => setParams({...params, machineQuantity: v})} />
                      </motion.div>
                    )}

                    {roiStep === 2 && (
                      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
                        <h2 className="text-xs font-bold uppercase tracking-widest text-blue-500 mb-6">{t.techSpecs}</h2>
                        <InputField label="Power Supply" type="text" value={params.powerSupplyV} onChange={(v: any) => setParams({...params, powerSupplyV: v})} suffix="V" />
                        <InputField label="Power Consumption" value={params.powerConsumptionKW} onChange={(v: any) => setParams({...params, powerConsumptionKW: v})} suffix="kW" />
                        <InputField label="Speed" value={params.speedSPrs} onChange={(v: any) => setParams({...params, speedSPrs: v})} suffix="s/prs" />
                        <InputField label="Unit Price (Total Cost)" value={params.unitPrice} onChange={(v: any) => setParams({...params, unitPrice: v})} suffix="USD" />
                        
                        <div className="grid grid-cols-2 gap-4">
                          <InputField label={t.maintenanceCost} value={params.maintenanceCostPerYear} onChange={(v: any) => setParams({...params, maintenanceCostPerYear: v})} suffix="USD/Yr" />
                          <InputField label={t.consumablesCost} value={params.consumablesCostPerYear} onChange={(v: any) => setParams({...params, consumablesCostPerYear: v})} suffix="USD/Yr" />
                        </div>
                        <InputField label={t.depreciation} value={params.depreciationYears} onChange={(v: any) => setParams({...params, depreciationYears: v})} suffix="Years" />

                        <div className="pt-4 border-t border-zinc-800">
                          <ImageUpload images={uploadedImages} setImages={setUploadedImages} />
                        </div>
                      </motion.div>
                    )}

                    {roiStep === 3 && (
                      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
                        <h2 className="text-xs font-bold uppercase tracking-widest text-amber-500 mb-6">{t.prodData}</h2>
                        
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-4 p-4 bg-zinc-900/30 border border-zinc-800 rounded">
                            <span className="text-[10px] font-bold uppercase text-zinc-500">{t.manual}</span>
                            <InputField label="Capacity / Hr" value={params.manualCapacityPerHour} onChange={(v: any) => setParams({...params, manualCapacityPerHour: v})} suffix="prs" />
                            <InputField label="Defective Rate" value={params.manualDefectiveRate} onChange={(v: any) => setParams({...params, manualDefectiveRate: v})} suffix="%" />
                            <InputField label="Manpower" value={params.manualManpower} onChange={(v: any) => setParams({...params, manualManpower: v})} suffix="prs" />
                          </div>
                          <div className="space-y-4 p-4 bg-emerald-950/10 border border-emerald-900/30 rounded">
                            <span className="text-[10px] font-bold uppercase text-emerald-500">{t.machine}</span>
                            <InputField label="Capacity / Hr" value={params.machineCapacityPerHour} onChange={(v: any) => setParams({...params, machineCapacityPerHour: v})} suffix="prs" />
                            <InputField label="Defective Rate" value={params.machineDefectiveRate} onChange={(v: any) => setParams({...params, machineDefectiveRate: v})} suffix="%" />
                            <InputField label="Manpower" value={params.machineManpower} onChange={(v: any) => setParams({...params, machineManpower: v})} suffix="prs" />
                          </div>
                        </div>

                        <div className="pt-4 border-t border-zinc-800 space-y-4">
                          <div className="grid grid-cols-2 gap-4">
                            <InputField label={`${t.materialCostPerPair} (${t.manual})`} value={params.currentMaterialCost} onChange={(v: any) => setParams({...params, currentMaterialCost: v})} suffix="USD/prs" />
                            <InputField label={`${t.materialCostPerPair} (${t.machine})`} value={params.proposedMaterialCost} onChange={(v: any) => setParams({...params, proposedMaterialCost: v})} suffix="USD/prs" />
                          </div>
                          <InputField label="Working Hours / Day" value={params.workingHoursPerDay} onChange={(v: any) => setParams({...params, workingHoursPerDay: v})} suffix="hrs" />
                          <InputField label="Local Labor Cost" value={params.localLaborCost} onChange={(v: any) => setParams({...params, localLaborCost: v})} suffix="USD/mo" />
                        </div>
                      </motion.div>
                    )}

                    <div className="mt-8 flex justify-between">
                      <button 
                        onClick={() => setRoiStep(Math.max(1, roiStep - 1))}
                        disabled={roiStep === 1}
                        className="factory-btn disabled:opacity-30"
                      >
                        {t.prev}
                      </button>
                      <button 
                        onClick={() => setRoiStep(Math.min(3, roiStep + 1))}
                        disabled={roiStep === 3}
                        className="factory-btn bg-emerald-600 text-white border-emerald-500 disabled:opacity-30"
                      >
                        {t.next}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Right: Results & AI */}
                <div className="col-span-7 space-y-6" ref={reportRef}>
                  {advancedResults && (
                    <>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="factory-card flex flex-col justify-between border-emerald-500 bg-emerald-950/20">
                          <div>
                            <span className="factory-label text-emerald-400">{t.roi}</span>
                            <div className="text-3xl font-mono font-black text-emerald-400 mt-1">
                              {safeFixed(advancedResults.roiMonths, 1)}
                              <span className="text-sm ml-1 uppercase">{t.months}</span>
                            </div>
                          </div>
                        </div>
                        <div className="factory-card flex flex-col justify-between border-blue-500 bg-blue-950/20">
                          <div>
                            <span className="factory-label text-blue-400">{t.annualSavings}</span>
                            <div className="text-3xl font-mono font-black text-blue-400 mt-1">
                              -${safeFixed(advancedResults.savings.fobImpact, 3)}
                              <span className="text-sm ml-1 uppercase">/ PRS</span>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Technical Specs Summary (For PDF) */}
                      <div className="factory-card bg-zinc-900/20 border-zinc-800">
                        <h3 className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 mb-3">Technical Overview</h3>
                        <div className="grid grid-cols-3 gap-4 font-mono text-[10px]">
                          <div>
                            <span className="text-zinc-600 block uppercase">Machine</span>
                            <span className="text-zinc-300">{params.equipmentName}</span>
                          </div>
                          <div>
                            <span className="text-zinc-600 block uppercase">Brand</span>
                            <span className="text-zinc-300">{params.brand}</span>
                          </div>
                          <div>
                            <span className="text-zinc-600 block uppercase">Power</span>
                            <span className="text-zinc-300">{params.powerConsumptionKW} kW / {params.powerSupplyV}</span>
                          </div>
                        </div>
                      </div>

                      {/* Comparison Table */}
                      <div className="factory-card overflow-hidden p-0">
                        <div className="p-4 border-b border-zinc-800 flex justify-between items-center">
                          <h3 className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">{t.manual} vs. {t.machine}</h3>
                          <span className="text-[9px] font-mono text-zinc-600">UNIT: USD / PRS</span>
                        </div>
                        <table className="w-full text-left border-collapse">
                          <thead>
                            <tr className="bg-zinc-900/50 border-b border-zinc-800">
                              <th className="p-3 text-[9px] font-bold uppercase tracking-widest text-zinc-500">{t.metric}</th>
                              <th className="p-3 text-[9px] font-bold uppercase tracking-widest text-zinc-500">{t.manual}</th>
                              <th className="p-3 text-[9px] font-bold uppercase tracking-widest text-zinc-500">{t.machine}</th>
                              <th className="p-3 text-[9px] font-bold uppercase tracking-widest text-zinc-500">{t.diff} / %</th>
                            </tr>
                          </thead>
                          <tbody className="font-mono text-[11px]">
                            <tr className="border-b border-zinc-900">
                              <td className="p-3 text-zinc-400">Annual Capacity</td>
                              <td className="p-3">{(advancedResults.manual.annualCapacity ?? 0).toLocaleString()}</td>
                              <td className="p-3">{(advancedResults.machine.annualCapacity ?? 0).toLocaleString()}</td>
                              <td className="p-3 text-emerald-500">+{safeFixed(((advancedResults.machine.annualCapacity / advancedResults.manual.annualCapacity - 1) * 100), 0)}%</td>
                            </tr>
                            <tr className="border-b border-zinc-900">
                              <td className="p-3 text-zinc-400">Actual Good Capacity</td>
                              <td className="p-3">{(advancedResults.manual.actualGoodCapacity ?? 0).toLocaleString()}</td>
                              <td className="p-3">{(advancedResults.machine.actualGoodCapacity ?? 0).toLocaleString()}</td>
                              <td className="p-3 text-emerald-500">+{safeFixed(((advancedResults.machine.actualGoodCapacity / advancedResults.manual.actualGoodCapacity - 1) * 100), 0)}%</td>
                            </tr>
                            <tr className="border-b border-zinc-900">
                              <td className="p-3 text-zinc-400">Manpower Demand</td>
                              <td className="p-3">{advancedResults.manual.manpowerDemand}</td>
                              <td className="p-3">{advancedResults.machine.manpowerDemand}</td>
                              <td className={cn("p-3", advancedResults.machine.manpowerDemand < advancedResults.manual.manpowerDemand ? "text-emerald-500" : "text-red-500")}>
                                {advancedResults.machine.manpowerDemand - advancedResults.manual.manpowerDemand}
                              </td>
                            </tr>
                            <tr className="border-b border-zinc-900">
                              <td className="p-3 text-zinc-400">Material Cost / Pair</td>
                              <td className="p-3">${safeFixed(params.currentMaterialCost, 3)}</td>
                              <td className="p-3">${safeFixed(params.proposedMaterialCost, 3)}</td>
                              <td className={cn("p-3", params.proposedMaterialCost <= params.currentMaterialCost ? "text-emerald-500" : "text-red-500")}>
                                {safeFixed(((params.proposedMaterialCost / params.currentMaterialCost - 1) * 100), 1)}%
                              </td>
                            </tr>
                            <tr className="border-b border-zinc-900">
                              <td className="p-3 text-zinc-400">Operating Cost / Pair</td>
                              <td className="p-3">${safeFixed(advancedResults.manual.operatingCostPerPair, 3)}</td>
                              <td className="p-3">${safeFixed(advancedResults.machine.operatingCostPerPair, 3)}</td>
                              <td className={cn("p-3", advancedResults.machine.operatingCostPerPair < advancedResults.manual.operatingCostPerPair ? "text-emerald-500" : "text-red-500")}>
                                {safeFixed(((advancedResults.machine.operatingCostPerPair / advancedResults.manual.operatingCostPerPair - 1) * 100), 1)}%
                              </td>
                            </tr>
                            <tr className="border-b border-zinc-900">
                              <td className="p-3 text-zinc-400">Cost per Pair (FOB)</td>
                              <td className="p-3">${safeFixed(advancedResults.manual.costPerPair, 3)}</td>
                              <td className="p-3">${safeFixed(advancedResults.machine.costPerPair, 3)}</td>
                              <td className={cn("p-3", advancedResults.machine.costPerPair < advancedResults.manual.costPerPair ? "text-emerald-500" : "text-red-500")}>
                                -{safeFixed(((1 - advancedResults.machine.costPerPair / advancedResults.manual.costPerPair) * 100), 1)}%
                              </td>
                            </tr>
                            <tr className="border-b border-zinc-900 bg-emerald-950/5">
                              <td className="p-3 text-emerald-400 font-bold">Total Annual Cost</td>
                              <td className="p-3 text-zinc-500">${(advancedResults.manual.totalAnnualCost ?? 0).toLocaleString(undefined, {maximumFractionDigits: 0})}</td>
                              <td className="p-3 text-emerald-400">${(advancedResults.machine.totalAnnualCost ?? 0).toLocaleString(undefined, {maximumFractionDigits: 0})}</td>
                              <td className={cn("p-3", advancedResults.machine.totalAnnualCost < advancedResults.manual.totalAnnualCost ? "text-emerald-500" : "text-red-500")}>
                                {safeFixed(((advancedResults.machine.totalAnnualCost / advancedResults.manual.totalAnnualCost - 1) * 100), 1)}%
                              </td>
                            </tr>
                          </tbody>
                        </table>
                      </div>

                      {/* AI Section */}
                      <div className="factory-card border-emerald-900/30 bg-emerald-950/5">
                        <div className="flex justify-between items-center mb-4">
                          <h2 className="text-[10px] font-bold uppercase tracking-widest text-emerald-400 flex items-center gap-2">
                            <Cpu size={14} />
                            {t.aiEvaluator}
                          </h2>
                          <button 
                            onClick={handleEvaluate}
                            disabled={isEvaluating}
                            className="text-[10px] font-bold uppercase tracking-widest px-3 py-1 bg-emerald-600/20 border border-emerald-500/50 text-emerald-400 hover:bg-emerald-600 hover:text-white transition-all disabled:opacity-50"
                          >
                            {isEvaluating ? t.analyzing : (aiEvaluation ? t.regenerate : t.runAnalysis)}
                          </button>
                        </div>

                        {isEvaluating ? (
                          <div className="space-y-3 animate-pulse">
                            <div className="h-12 bg-zinc-900/50 border border-zinc-800" />
                            <div className="grid grid-cols-2 gap-3">
                              <div className="h-24 bg-zinc-900/50 border border-zinc-800" />
                              <div className="h-24 bg-zinc-900/50 border border-zinc-800" />
                            </div>
                          </div>
                        ) : aiEvaluation ? (
                          <div className="space-y-4">
                            <div className="flex items-center gap-4 p-3 bg-black/40 border border-zinc-800">
                              <div className={cn(
                                "px-2 py-0.5 text-[9px] font-bold uppercase tracking-widest",
                                aiEvaluation.verdict === 'Strongly Recommend' ? "bg-emerald-500 text-black" : 
                                aiEvaluation.verdict === 'Consider with Caution' ? "bg-amber-500 text-black" : "bg-red-500 text-white"
                              )}>
                                {aiEvaluation.verdict}
                              </div>
                              <p className="text-[10px] text-zinc-400 font-mono leading-relaxed">
                                {aiEvaluation.summary}
                              </p>
                            </div>
                            
                            <div className="grid grid-cols-2 gap-4">
                              <div className="space-y-2">
                                <span className="text-[9px] font-bold uppercase text-emerald-500">{t.pros}</span>
                                <ul className="space-y-1">
                                  {aiEvaluation.pros?.map((p: string, i: number) => (
                                    <li key={i} className="text-[10px] text-zinc-400 flex items-start gap-2">
                                      <div className="w-1 h-1 bg-emerald-500 rounded-full mt-1.5 shrink-0" />
                                      {p}
                                    </li>
                                  ))}
                                </ul>
                              </div>
                              <div className="space-y-2">
                                <span className="text-[9px] font-bold uppercase text-amber-500">{t.cons} / {t.risks}</span>
                                <ul className="space-y-1">
                                  {[...(aiEvaluation.cons || []), ...(aiEvaluation.risks || [])].map((c: string, i: number) => (
                                    <li key={i} className="text-[10px] text-zinc-400 flex items-start gap-2">
                                      <div className="w-1 h-1 bg-amber-500 rounded-full mt-1.5 shrink-0" />
                                      {c}
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            </div>
                          </div>
                        ) : (
                          <div className="h-20 flex flex-col items-center justify-center border border-dashed border-zinc-800 text-zinc-600">
                            <span className="text-[9px] font-bold uppercase tracking-widest">{t.awaiting}</span>
                          </div>
                        )}
                      </div>

                      {/* Image Gallery Preview */}
                      {uploadedImages.length > 0 && (
                        <div className="factory-card">
                          <h3 className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 mb-4 flex items-center gap-2">
                            <ImageIcon size={14} />
                            Equipment Visuals
                          </h3>
                          <div className="grid grid-cols-3 gap-4">
                            {uploadedImages?.map((url, i) => (
                              <div key={i} className="aspect-video factory-border overflow-hidden bg-black">
                                <img src={url} alt="Machine" className="w-full h-full object-contain" />
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </motion.div>
            ) : activeTab === 'history' ? (
              <motion.div
                key="history"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="space-y-6"
              >
                <div className="flex justify-between items-end mb-8">
                  <div>
                    <h2 className="text-2xl font-black italic uppercase tracking-tighter">Report Repository</h2>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Historical ROI Analysis Data</p>
                  </div>
                  <button 
                    onClick={fetchReports}
                    className="p-2 hover:bg-zinc-800 rounded text-zinc-400 hover:text-white transition-colors"
                  >
                    <TrendingUp size={16} />
                  </button>
                </div>

                {loadingReports ? (
                  <div className="h-64 flex items-center justify-center">
                    <div className="text-[10px] font-bold uppercase tracking-widest animate-pulse">Accessing Secure Database...</div>
                  </div>
                ) : reports.length === 0 ? (
                  <div className="h-64 flex flex-col items-center justify-center border border-dashed border-zinc-800 text-zinc-600">
                    <History size={48} className="mb-4 opacity-20" />
                    <p className="text-[10px] font-bold uppercase tracking-widest">No historical data found</p>
                  </div>
                ) : (
                  <div className="grid gap-4">
                    {Array.isArray(reports) && reports.map((report) => (
                      <div key={report.id} className="factory-card group hover:border-zinc-500 transition-all">
                        <div className="flex justify-between items-start">
                          <div>
                            <h3 className="text-sm font-black italic uppercase tracking-tighter">{report.project_name || 'Untitled Project'}</h3>
                            <p className="text-[9px] text-zinc-500 font-bold uppercase tracking-widest mt-1">
                              {new Date(report.created_at).toLocaleDateString()} • {report.current_params?.machineModel || 'N/A'}
                            </p>
                          </div>
                          <div className="flex gap-2">
                            <button 
                              onClick={() => {
                                setProjectName(report.project_name);
                                setParams({ ...INITIAL_PARAMS, ...report.current_params });
                                setAiEvaluation(report.ai_evaluation);
                                setUploadedImages(report.image_url || []);
                                setEditingReportId(report.id);
                                setCurrentStatus(report.status || 'Draft');
                                setActiveTab('roi');
                              }}
                              className="px-3 py-1 bg-zinc-800 hover:bg-zinc-700 text-[9px] font-bold uppercase tracking-widest rounded transition-colors"
                            >
                              Load
                            </button>
                          </div>
                        </div>
                        <div className="mt-4 grid grid-cols-3 gap-2 text-[9px] font-bold uppercase tracking-widest">
                          <div className="p-2 bg-zinc-900 rounded border border-zinc-800">
                            <span className="text-zinc-500 block mb-1">ROI</span>
                            <span className="text-emerald-500">{safeFixed(report.results?.roiPercentage, 1)}%</span>
                          </div>
                          <div className="p-2 bg-zinc-900 rounded border border-zinc-800">
                            <span className="text-zinc-500 block mb-1">{t.roi}</span>
                            <span className="text-amber-500">{safeFixed(report.results?.roiMonths, 1)} Mo</span>
                          </div>
                          <div className="p-2 bg-zinc-900 rounded border border-zinc-800">
                            <span className="text-zinc-500 block mb-1">Annual Saving</span>
                            <span className="text-white">${report.results?.totalAnnualSaving?.toLocaleString()}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </motion.div>
            ) : (
              <motion.div
                key="dashboard"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex flex-col items-center justify-center h-[60vh] text-zinc-700"
              >
                <LayoutDashboard size={64} className="mb-4 opacity-20" />
                <h2 className="text-xl font-black italic uppercase tracking-tighter">System Ready</h2>
                <p className="text-[10px] font-bold uppercase tracking-widest mt-2">Select "New ROI Matrix" to begin calculation</p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </main>

      {/* Floating AI Assistant Toggle */}
      <button 
        onClick={() => setActiveTab('ai')}
        className="fixed bottom-8 right-8 w-14 h-14 bg-emerald-600 text-white rounded-full shadow-2xl shadow-emerald-500/20 flex items-center justify-center hover:scale-110 transition-transform z-50"
      >
        <MessageSquare size={24} />
      </button>

      {/* Hidden Template for PDF Export */}
      <div style={{ position: 'absolute', left: '-9999px', top: '-9999px', width: '210mm' }}>
        <div ref={templateRef}>
          {advancedResults && (
            <CAPEXReportTemplate 
              params={params} 
              results={advancedResults} 
              aiEvaluation={aiEvaluation} 
              t={TRANSLATIONS[lang]} 
              uploadedImages={uploadedImages} 
              lang={lang}
            />
          )}
        </div>
      </div>
    </div>
  );
}
