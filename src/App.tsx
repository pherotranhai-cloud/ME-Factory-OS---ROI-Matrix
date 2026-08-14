import React from 'react';
import { Dashboard } from './components/Dashboard/Dashboard';
import { ReportHistory } from './components/Dashboard/ReportHistory';
import { AIChatbot } from './components/AI/AIChatbot';
import { ROICalculatorForm } from './components/Forms/ROICalculatorForm';
import { CAPEXReportTemplate, generatePDF } from './components/Reports/PDFTemplate';
import { AIEvaluation } from './components/Reports/AIEvaluation';
import { Infographic } from './components/Reports/Infographic';
import { Sidebar } from './components/Layout/Sidebar';
import { Header } from './components/Layout/Header';
import { useAppState } from './hooks/useAppState';
import { TRANSLATIONS } from './constants/translations';
import html2canvas from 'html2canvas';

import { exportToExcel } from './utils/excelExport';
import { exportProjectToExcel } from './utils/projectExcel';
import { exportProjectToPdf } from './utils/projectPdf';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { API_BASE_URL } from './config/api';
import { ROIResults } from './types';
import { ProjectWorkspace } from './components/Project/ProjectWorkspace';
import { ProjectInput } from './domain/model';
import { newProjectDefaults } from './domain/adapt';
import { loadProject, summarise } from './domain/persist';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Annual saving as a percentage of the investment actually at risk (net, per the
 * agreed basis). Returns 0 rather than NaN/Infinity when there is no net spend.
 */
const roiPercentage = (results: ROIResults | null): number => {
  if (!results) return 0;
  const basis = results.investment.applied;
  if (!basis || !Number.isFinite(basis)) return 0;
  return (results.savings.totalAnnualSaving / basis) * 100;
};

export default function App() {
  const {
    activeTab, setActiveTab,
    lang, setLang,
    projectName, setProjectName,
    params, setParams,
    uploadedImages, setUploadedImages,
    editingReportId, setEditingReportId,
    currentStatus, setCurrentStatus,
    advancedResults,
    aiEvaluation, setAiEvaluation,
    isEvaluating, setIsEvaluating,
    isSaving, setIsSaving,
    chatMessages, setChatMessages,
    resetForm,
    triggerRefresh,
    refreshTrigger
  } = useAppState();

  const [editingReportData, setEditingReportData] = React.useState<any>(null);
  // The rebuilt analysis path. Kept beside the legacy calculator rather than
  // replacing it, so stored projects keep opening while the new model beds in.
  const [project, setProject] = React.useState<ProjectInput>(() => newProjectDefaults());
  // Set when the open project came from a legacy row, so the workspace can say
  // that its figures are a restatement rather than the ones that were approved.
  const [projectWasImported, setProjectWasImported] = React.useState(false);
  const [viewMode, setViewMode] = React.useState<'form' | 'preview'>('form');
  const [aiPrompt, setAiPrompt] = React.useState('');
  const [isGeneratingInfographic, setIsGeneratingInfographic] = React.useState(false);
  const [infographicData, setInfographicData] = React.useState<any>(null);
  const infographicRef = React.useRef<HTMLDivElement>(null);

  const t = TRANSLATIONS[lang];

  const handleExportExcel = async () => {
    if (!advancedResults) return;
    try {
      // Photos and the AI verdict now travel into the workbook rather than being
      // dropped on the floor (P3-01, P3-08).
      await exportToExcel(params, advancedResults, t, {
        images: uploadedImages ?? [],
        aiEvaluation,
      });
    } catch (err: any) {
      console.error(err);
      alert('Excel Export failed: ' + err.message);
    }
  };

  /**
   * The rebuilt path exports from the engine trace, so the workbook and the
   * on-screen report are two renderings of one calculation rather than two
   * transcriptions of it.
   */
  const handleExportProject = async (input: ProjectInput) => {
    try {
      await exportProjectToExcel(input, { images: uploadedImages ?? [] });
    } catch (err: any) {
      console.error(err);
      alert('Excel export failed: ' + err.message);
    }
  };

  const handleExportProjectPdf = async (input: ProjectInput) => {
    try {
      await exportProjectToPdf(input);
    } catch (err: any) {
      console.error(err);
      alert('PDF export failed: ' + err.message);
    }
  };

  /**
   * Save the rebuilt analysis. The flat columns the dashboard reads are derived
   * from the same engine run that produced the on-screen report, and the input
   * itself goes into `form_data` — so what reopens is what was entered, and the
   * figures are recomputed rather than trusted from storage.
   */
  const handleSaveProject = async (input: ProjectInput) => {
    setIsSaving(true);
    try {
      const isUpdate = !!editingReportData?.id;
      const url = isUpdate ? `${API_BASE_URL}/roi-reports/${editingReportData.id}` : `${API_BASE_URL}/roi-reports`;
      const projectId = editingReportData?.project_id
        || `CAPEX-${new Date().getFullYear()}-${Math.floor(Math.random() * 1000).toString().padStart(3, '0')}`;
      const summary = summarise(input);

      const res = await fetch(url, {
        method: isUpdate ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...summary,
          project_id: projectId,
          vendor: '',
          ai_verdict: 'Draft',
          ai_evaluation: null,
          status: 'Draft',
          tags: ['ROI', 'Rebuilt', input.article].filter(Boolean),
          image_url: uploadedImages ?? [],
        }),
      });
      if (!res.ok) throw new Error(`Server returned ${res.status}`);

      // Saved once, then edited in place — otherwise a second Save would create
      // a duplicate row rather than update the one just written.
      if (!isUpdate) {
        const saved = await res.json().catch(() => null);
        if (saved?.id) setEditingReportData({ id: saved.id, project_id: projectId });
      }
      setProjectWasImported(false);
      triggerRefresh();
      alert(`Project ${isUpdate ? 'updated' : 'saved'}. Project ID: ${projectId}`);
    } catch (err: any) {
      console.error(err);
      alert('Save failed: ' + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  /**
   * Open a stored row. Rows written by the rebuilt workspace reopen there; older
   * rows open in the legacy calculator and are also adapted into the workspace
   * so they can be reviewed under the corrected model.
   */
  const openStoredReport = (report: any) => {
    setEditingReportData(report);
    setProjectName(report.machine_name || 'ROI Project');
    setAiEvaluation(report.ai_evaluation);
    setUploadedImages(report.image_url);
    setEditingReportId(report.id);

    const { input, wasImported } = loadProject(report.form_data);
    setProject(input);
    setProjectWasImported(wasImported);

    if (wasImported) {
      setParams(report.form_data);
      setViewMode('form');
      setActiveTab('roi');
    } else {
      setActiveTab('analysis');
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const isUpdate = !!editingReportData?.id;
      const url = isUpdate ? `${API_BASE_URL}/roi-reports/${editingReportData.id}` : `${API_BASE_URL}/roi-reports`;
      const method = isUpdate ? 'PATCH' : 'POST';
      const projectId = editingReportData?.project_id || `CAPEX-${new Date().getFullYear()}-${Math.floor(Math.random() * 1000).toString().padStart(3, '0')}`;
      
      await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          project_id: projectId,
          machine_name: params.equipmentName,
          shoe_model: params.shoeModel,
          vendor: params.brand,
          // P1-02: this was `params.unitPrice`, a property that does not exist on
          // ROIParams — it saved `undefined` and left roi_percentage as NaN.
          investment_cost: advancedResults?.investment.gross ?? 0,
          // Net investment is deliberately not sent: the server's insert
          // whitelists its columns and never read this field, so it was a dead
          // write that read as though net were persisted. Net is recoverable by
          // recomputing from `form_data`, which is stored in full. Persisting it
          // as its own column needs that column to exist first.
          labor_saving_cost: advancedResults?.savings.laborSaving,
          energy_saving_cost: advancedResults?.savings.energySaving,
          other_savings: (advancedResults?.savings.materialSaving || 0) + (advancedResults?.savings.maintenanceSaving || 0) + (advancedResults?.savings.consumablesSaving || 0),
          annual_savings: advancedResults?.savings.totalAnnualSaving,
          // null when the proposal never pays back — distinguishable from "not computed".
          roi_months: advancedResults?.roiMonths ?? null,
          roi_percentage: roiPercentage(advancedResults),
          ai_verdict: typeof aiEvaluation?.verdict === 'string' ? aiEvaluation.verdict : (aiEvaluation?.verdict?.verdict || 'Draft'),
          ai_evaluation: aiEvaluation,
          status: 'Draft',
          tags: ['ROI', params.machineType, params.shoeModel],
          annual_output: advancedResults?.proposed.annualCapacity,
          fob_impact: advancedResults?.savings.fobImpact,
          image_url: uploadedImages,
          form_data: params
        })
      });
      
      alert(`Report ${isUpdate ? 'updated' : 'saved'} successfully. Project ID: ${projectId}`);
      triggerRefresh();
      setEditingReportData(null);
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
        Project: ${projectName}
        Params: ${JSON.stringify(params)}
        Calculated Results: ${JSON.stringify(advancedResults)}
      `;

      const response = await fetch(`${API_BASE_URL}/evaluate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, targetLanguage: lang })
      });

      const data = await response.json().catch(() => ({}));
      // The server returns a readable sentence; show that rather than a status code.
      if (!response.ok) throw new Error(data?.error || 'AI evaluation failed.');
      setAiEvaluation(data);
    } catch (error: any) {
      console.error("AI Error:", error);
      setAiEvaluation({
        verdict: "Error",
        summary: error.message || "Connection to AI service failed.",
        pros: [], cons: [], risks: []
      });
    } finally {
      setIsEvaluating(false);
    }
  };

  const handleGenerateInfographic = async () => {
    if (!advancedResults) return;
    setIsGeneratingInfographic(true);
    try {
      const response = await fetch(`${API_BASE_URL}/infographic`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          params: params,
          results: advancedResults,
          targetLanguage: lang
        })
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data?.error || 'Infographic generation failed.');
      setInfographicData(data);
    } catch (err: any) {
      console.error(err);
      alert('Infographic generation failed: ' + err.message);
    } finally {
      setIsGeneratingInfographic(false);
    }
  };

  const handleDownloadInfographic = async () => {
    const element = document.getElementById('infographic-card');
    if (!element) return;

    try {
      const canvas = await html2canvas(element, {
        backgroundColor: '#000000',
        scale: 2,
        logging: false,
        useCORS: true
      });
      
      const image = canvas.toDataURL('image/png', 1.0);
      
      // Download the image
      const link = document.createElement('a');
      link.href = image;
      link.download = `Infographic_${params.equipmentName || 'CAPEX'}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      // Add to uploadedImages state
      setUploadedImages([...(uploadedImages || []), image].slice(0, 3));
      
      // Clear infographic data after download
      setInfographicData(null);
      alert('Infographic downloaded and added to report images.');
    } catch (err: any) {
      console.error('Capture Error:', err);
      alert('Failed to capture infographic: ' + err.message);
    }
  };

  const handleExportPDF = async () => {
    if (!advancedResults) return;
    setIsSaving(true);
    try {
      await generatePDF('capex-template', `CAPEX_Proposal_${params.shoeModel}_${params.date}.pdf`);
    } catch (err: any) {
      console.error(err);
      alert('PDF Export failed: ' + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="flex h-screen overflow-hidden bg-gradient-to-br from-[#F4F9F9] via-[#EDF6F9] to-[#83C5BE]/30 text-[#002D32] transition-colors duration-500">
      <Sidebar 
        activeTab={activeTab} 
        setActiveTab={setActiveTab} 
        lang={lang} 
        setLang={setLang} 
        resetForm={() => { 
          resetForm(); 
          setEditingReportData(null);
          setEditingReportId(null);
          setViewMode('form');
        }} 
        t={t} 
      />

      <main className="flex-1 overflow-y-auto relative">
        <Header 
          activeTab={activeTab} 
          t={t} 
          viewMode={viewMode}
          setViewMode={setViewMode}
          advancedResults={advancedResults} 
          isEvaluating={isEvaluating} 
          isSaving={isSaving} 
          isGeneratingInfographic={isGeneratingInfographic}
          handleEvaluate={handleEvaluate} 
          handleExportPDF={handleExportPDF} 
          handleExportExcel={handleExportExcel}
          handleGenerateInfographic={handleGenerateInfographic}
          handleSave={handleSave} 
          onAnalyze={() => {
            setAiPrompt(`Tôi đang xem xét dự án ${params.equipmentName || 'này'}. Dữ liệu ROI: ${JSON.stringify({ params, advancedResults })}. Cho tôi xin đánh giá nhanh, trực diện theo góc nhìn quản lý nhà máy.`);
            setActiveTab('ai');
          }}
        />

        <div className="p-8">
          {infographicData && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center bg-white/20 backdrop-blur-[16px] p-4">
              <div className="bg-white/80 rounded-[32px] p-8 max-w-4xl w-full max-h-[90vh] overflow-y-auto shadow-[0_32px_120px_rgba(0,109,119,0.15)] border border-white/60">
                <div className="flex justify-between items-center mb-6">
                  <h2 className="text-xl font-bold text-ims-primary tracking-tight">AI Infographic Preview</h2>
                  <button 
                    onClick={() => setInfographicData(null)}
                    className="text-[#4A6B6F] hover:text-ims-primary hover:bg-ims-primary/10 p-2 rounded-full transition-colors"
                  >
                    <span className="sr-only">Close</span>
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>

                <div className="flex justify-center mb-8 overflow-hidden rounded-[24px] border border-white/60 bg-white/80 shadow-inner">
                  <div className="scale-[0.6] sm:scale-[0.7] md:scale-[0.8] lg:scale-[1.0] origin-center py-12">
                    <Infographic 
                      data={infographicData} 
                      params={params} 
                      results={advancedResults} 
                    />
                  </div>
                </div>

                <div className="flex gap-4 justify-end">
                  <button
                    onClick={() => setInfographicData(null)}
                    className="px-6 py-3 rounded-xl border border-ims-primary/20 text-[#4A6B6F] font-bold hover:bg-[#83C5BE]/20 hover:text-[#006D77] transition-all"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleDownloadInfographic}
                    className="px-8 py-3 rounded-xl bg-ims-primary text-white font-black hover:bg-[#005259] transition-all shadow-[0_8px_20px_rgba(0,109,119,0.25)] flex items-center gap-2 transform hover:-translate-y-1"
                  >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                    Download Image
                  </button>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'dashboard' && <Dashboard lang={lang} t={t} refreshTrigger={refreshTrigger} onEditReport={openStoredReport} />}
          {activeTab === 'history' && <ReportHistory lang={lang} t={t} setActiveTab={setActiveTab} refreshTrigger={refreshTrigger} onEditReport={openStoredReport} />}
          {activeTab === 'analysis' && (
            <ProjectWorkspace
              value={project}
              onChange={(next, opts) => {
                setProject(next);
                if (opts?.replaced) {
                  setProjectWasImported(false);
                  // A different project must not update the row the last one
                  // came from, so the edit target is released with it.
                  setEditingReportData(null);
                }
              }}
              onExport={handleExportProject}
              onExportPdf={handleExportProjectPdf}
              onSave={handleSaveProject}
              wasImported={projectWasImported}
              isSaving={isSaving}
            />
          )}
          {activeTab === 'ai' && <AIChatbot lang={lang} t={t} params={params} advancedResults={advancedResults} initialPrompt={aiPrompt} setAiPrompt={setAiPrompt} messages={chatMessages} setMessages={setChatMessages} />}
          {activeTab === 'roi' && (
            <div className="max-w-5xl mx-auto">
              {viewMode === 'form' ? (
                <ROICalculatorForm 
                  t={t} 
                  params={params} 
                  setParams={setParams} 
                  uploadedImages={uploadedImages} 
                  setUploadedImages={setUploadedImages} 
                  advancedResults={advancedResults}
                  onAnalyze={() => {
                    setAiPrompt(`Tôi đang xem xét dự án ${params.equipmentName || 'này'}. Dữ liệu ROI: ${JSON.stringify({ params, advancedResults })}. Cho tôi xin đánh giá nhanh, trực diện theo góc nhìn quản lý nhà máy.`);
                    setActiveTab('ai');
                  }}
                />
              ) : (
                <div className="space-y-8 pb-20">
                  <AIEvaluation aiEvaluation={aiEvaluation} />

                  {advancedResults ? (
                    <div className="bg-white/80 p-8 rounded-[24px] border border-white/60 shadow-[0_8px_32px_rgba(0,109,119,0.1)] flex flex-col items-center backdrop-blur-[16px]">
                      <div className="w-full flex items-center justify-between mb-6 border-b border-ims-primary/10 pb-4">
                        <div className="flex items-center gap-3">
                          <div className="w-2 h-2 rounded-full bg-ims-primary animate-pulse" />
                          <h3 className="text-sm font-bold uppercase tracking-widest text-[#4A6B6F]">Live Report Preview</h3>
                        </div>
                        <span className="text-[10px] text-ims-primary/70 font-mono">A4 STANDARD FORMAT</span>
                      </div>
                      
                      <div className="bg-white rounded shadow-2xl overflow-hidden transform transition-transform hover:scale-[1.01] duration-500">
                        <CAPEXReportTemplate 
                          params={params} 
                          results={advancedResults} 
                          aiEvaluation={aiEvaluation} 
                          t={t} 
                          uploadedImages={uploadedImages} 
                          lang={lang} 
                        />
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-20 bg-white/60 rounded-[24px] border border-dashed border-[#006D77]/20 backdrop-blur-[12px]">
                      <p className="text-[#4A6B6F] font-bold">Please complete the form to see the report preview.</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
