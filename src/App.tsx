import React from 'react';
import { Dashboard } from './components/Dashboard/Dashboard';
import { ROICalculatorForm } from './components/Forms/ROICalculatorForm';
import { CAPEXReportTemplate, generatePDF } from './components/Reports/PDFTemplate';
import { AIEvaluation } from './components/Reports/AIEvaluation';
import { Sidebar } from './components/Layout/Sidebar';
import { Header } from './components/Layout/Header';
import { useAppState } from './hooks/useAppState';
import { TRANSLATIONS } from './constants/translations';

export default function App() {
  const {
    activeTab, setActiveTab,
    lang, setLang,
    projectName,
    params, setParams,
    uploadedImages, setUploadedImages,
    advancedResults,
    aiEvaluation, setAiEvaluation,
    isEvaluating, setIsEvaluating,
    isSaving, setIsSaving,
    resetForm
  } = useAppState();

  const t = TRANSLATIONS[lang];

  const handleSave = async () => {
    setIsSaving(true);
    try {
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
          roi_percentage: advancedResults ? (advancedResults.savings.totalAnnualSaving / params.unitPrice) * 100 : 0,
          ai_verdict: aiEvaluation?.verdict,
          status: 'Draft',
          tags: ['ROI', params.machineType, params.shoeModel],
          annual_output: advancedResults?.machine.annualCapacity
        })
      });
      
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

        Provide a structured evaluation in JSON format with:
        - pros: array of 3-4 strings
        - cons: array of 2-3 strings
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
        pros: [], cons: [], risks: []
      });
    } finally {
      setIsEvaluating(false);
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
    <div className="flex h-screen overflow-hidden bg-[#0a0a0a]">
      <Sidebar 
        activeTab={activeTab} 
        setActiveTab={setActiveTab} 
        lang={lang} 
        setLang={setLang} 
        resetForm={resetForm} 
        t={t} 
      />

      <main className="flex-1 overflow-y-auto relative">
        <Header 
          activeTab={activeTab} 
          t={t} 
          advancedResults={advancedResults} 
          isEvaluating={isEvaluating} 
          isSaving={isSaving} 
          handleEvaluate={handleEvaluate} 
          handleExportPDF={handleExportPDF} 
          handleSave={handleSave} 
        />

        <div className="p-8">
          {activeTab === 'dashboard' && <Dashboard lang={lang} t={t} />}
          {activeTab === 'roi' && (
            <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8">
              <div className="lg:col-span-5">
                <ROICalculatorForm 
                  t={t} 
                  params={params} 
                  setParams={setParams} 
                  uploadedImages={uploadedImages} 
                  setUploadedImages={setUploadedImages} 
                />
              </div>
              <div className="lg:col-span-7 space-y-6">
                <AIEvaluation aiEvaluation={aiEvaluation} />

                {advancedResults && (
                  <div className="bg-zinc-900 p-4 rounded-xl border border-zinc-800 overflow-auto max-h-[800px]">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-xs font-bold uppercase tracking-widest text-zinc-400">Report Preview</h3>
                      <span className="text-[10px] text-zinc-500">A4 Format</span>
                    </div>
                    <div className="scale-[0.8] origin-top-left">
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
                )}
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
