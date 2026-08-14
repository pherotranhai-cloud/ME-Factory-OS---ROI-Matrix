import "dotenv/config";
import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import fs from "fs";
import cors from "cors";
import multer from "multer";
import { v2 as cloudinary } from "cloudinary";
import serverless from "serverless-http";
import {
  callStructured,
  projectContext,
  projectHistory,
  EvaluationSchema,
  InfographicSchema,
  ChatSchema,
  AIError,
} from "./src/server/ai";
import {
  evaluationSystemPrompt,
  chatSystemPrompt,
  infographicSystemPrompt,
  infographicUserPrompt,
  resolveLanguage,
  VERDICTS,
} from "./src/server/prompts";

import { createClient } from "@supabase/supabase-js";

const isProd = process.env.NODE_ENV === "production" || process.env.DATABASE_URL;

// Supabase Connection
let supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || "";
if (supabaseUrl && !supabaseUrl.startsWith("http")) {
  supabaseUrl = "https://" + supabaseUrl;
}
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || "";

const supabase = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;

// Cloudinary Config
if (process.env.CLOUDINARY_URL) {
  cloudinary.config({
    cloudinary_url: process.env.CLOUDINARY_URL
  });
}

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 5000;

  app.use(cors({
    origin: ['https://roi-matrix.netlify.app', 'http://localhost:3000', 'http://localhost:5173'], // Cho phép cả production và local test
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    credentials: true
  }));
  app.use(express.json());

  // Multer for local uploads (dev only)
  const uploadsDir = path.join(process.cwd(), "uploads");
  if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir);
  app.use("/uploads", express.static(uploadsDir));

  const storage = multer.diskStorage({
    destination: "uploads/",
    filename: (req, file, cb) => {
      cb(null, Date.now() + "-" + Math.round(Math.random() * 1E9) + path.extname(file.originalname));
    },
  });
  const upload = multer({ storage });

  // API Routes
  app.post("/api/upload", upload.array("images", 3), async (req: any, res) => {
    try {
      const files = req.files as any[];
      if (!files || files.length === 0) return res.status(400).json({ error: "No files uploaded" });

      if (process.env.CLOUDINARY_URL) {
        const uploadPromises = files.map(file => 
          cloudinary.uploader.upload(file.path, { folder: "factory_os" })
        );
        const results = await Promise.all(uploadPromises);
        // Clean up local files
        files.forEach(file => fs.unlinkSync(file.path));
        return res.json({ urls: results.map(r => r.secure_url) });
      } else {
        const urls = files.map(file => `/uploads/${file.filename}`);
        res.json({ urls });
      }
    } catch (err: any) {
      console.error("Upload Error:", err);
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/reports", async (req, res) => {
    try {
      if (!supabase) return res.status(500).json({ error: "Supabase not configured" });
      const { data: reports, error } = await supabase.from('reports').select('*').order('created_at', { ascending: false });
      if (error) throw error;
      res.json(reports);
    } catch (err: any) {
      console.error("Reports Fetch Error:", err.message || err);
      res.json([]);
    }
  });

  app.post("/api/reports", async (req, res) => {
    try {
      const { project_name, current_params, new_params, results, ai_evaluation, image_url } = req.body;
      
      if (supabase) {
        const { data, error } = await supabase
          .from("reports")
          .insert({
            project_name,
            current_params: current_params || {}, // JSONB
            new_params: new_params || {},         // JSONB
            results: results || {},               // JSONB
            ai_evaluation: ai_evaluation || {},   // JSONB
            image_url
          })
          .select("id")
          .single();
          
        if (error) throw error;
        return res.json({ id: data.id });
      }


    } catch (err) {
      res.status(500).json({ error: "Failed to save report" });
    }
  });

  app.get("/api/roi-reports", async (req, res) => {
    try {
      const { search } = req.query;
      
      if (!supabase) return res.status(500).json({ error: "Supabase not configured" });

      let queryBuilder = supabase.from('roi_reports').select('*').order('created_at', { ascending: false });
      if (search) {
        queryBuilder = queryBuilder.or(`machine_name.ilike.%${search}%,project_id.ilike.%${search}%,vendor.ilike.%${search}%,shoe_model.ilike.%${search}%`);
      }
      const { data, error } = await queryBuilder;
      if (error) throw error;
      return res.json(data);
    } catch (err: any) {
      console.error("ROI Reports Error:", err.message || err);
      res.json([]);
    }
  });

  app.post("/api/roi-reports", async (req, res) => {
    try {
      const { 
        project_id, machine_name, shoe_model, vendor, investment_cost, 
        labor_saving_cost, energy_saving_cost, other_savings, 
        annual_savings, annual_output, fob_impact, roi_months, roi_percentage, 
        ai_verdict, ai_evaluation, status, tags, image_url, form_data 
      } = req.body;

      if (supabase) {
        // 1. Create or Find User
        let user_id = null;
        const { data: user } = await supabase.from('users').select('id').limit(1).maybeSingle();
        
        if (user) {
            user_id = user.id;
        } else {
            const { data: newUser } = await supabase.from('users').insert({
                name: 'System Operator', 
                email: 'operator@laiyih.com', 
                role: 'Operator'
            }).select('id').single();
            user_id = newUser?.id || null;
        }

        // 2. Insert into roi_reports
        const { data, error } = await supabase
          .from("roi_reports")
          .insert({
            user_id,
            project_id, machine_name, shoe_model, vendor, investment_cost,
            labor_saving_cost, energy_saving_cost, other_savings,
            annual_savings, annual_output, fob_impact, roi_months, roi_percentage,
            ai_verdict, ai_evaluation: ai_evaluation || {}, status: status || 'Draft',
            tags: tags || [], image_url: image_url || [], form_data: form_data || {}
          })
          .select("id")
          .single();
          
        if (error) throw error;
        
        // 3. Insert into report_embeddings
        const summaryText = `Project ${project_id} | ${machine_name} by ${vendor}. Verdict: ${ai_verdict || 'N/A'}. Annual Savings: $${annual_savings || 0}`;
        await supabase.from('report_embeddings').insert({
            report_id: data.id,
            summary_text: summaryText
        });

        return res.json({ id: data.id });
      }

      return res.status(500).json({ error: 'Supabase required' });
    } catch (err: any) {
      console.error(err);
      res.status(500).json({ error: "Failed to save ROI report", details: err.message });
    }
  });

  app.patch("/api/roi-reports/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const { 
        project_id, machine_name, shoe_model, vendor, investment_cost, 
        labor_saving_cost, energy_saving_cost, other_savings, 
        annual_savings, annual_output, fob_impact, roi_months, roi_percentage, 
        ai_verdict, ai_evaluation, status, tags, image_url, form_data 
      } = req.body;

      if (supabase) {
        const { error } = await supabase
          .from("roi_reports")
          .update({
            project_id, machine_name, shoe_model, vendor, investment_cost,
            labor_saving_cost, energy_saving_cost, other_savings,
            annual_savings, annual_output, fob_impact, roi_months, roi_percentage,
            ai_verdict, ai_evaluation: ai_evaluation || {}, status: status || 'Draft',
            tags: tags || [], image_url: image_url || [], form_data: form_data || {}
          })
          .eq("id", id);
          
        if (error) throw error;
        
        // Update report_embeddings summary if it exists, or insert if it doesn't
        // We can do an upsert but we don't have the primary key of embeddings readily available, 
        //, so we can delete the existing one and recreate.
        const summaryText = `Project ${project_id} | ${machine_name} by ${vendor}. Verdict: ${ai_verdict || 'N/A'}. Annual Savings: $${annual_savings || 0}`;
        await supabase.from('report_embeddings').delete().eq('report_id', id);
        await supabase.from('report_embeddings').insert({
            report_id: id,
            summary_text: summaryText
        });

        return res.json({ success: true });
      }

      return res.status(500).json({ error: 'Supabase required' });
    } catch (err: any) {
      console.error(err);
      res.status(500).json({ error: "Failed to update ROI report", details: err.message });
    }
  });

  app.patch("/api/roi-reports/:id/status", async (req, res) => {
    try {
      const { id } = req.params;
      const { status, changed_by, comment } = req.body;
      if (!supabase) return res.status(500).json({ error: "Supabase not configured" });
      
      const { data: report, error: fetchErr } = await supabase.from('roi_reports').select('status').eq('id', id).single();
      if (fetchErr || !report) return res.status(404).json({ error: "Report not found" });

      const { error: updateErr } = await supabase.from('roi_reports').update({ status }).eq('id', id);
      if (updateErr) throw updateErr;

      const { error: historyErr } = await supabase.from('report_history').insert({
        report_id: id,
        status_from: report.status,
        status_to: status,
        changed_by,
        comment
      });
      if (historyErr) throw historyErr;

      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: "Failed to update status" });
    }
  });

  app.get("/api/report-history", async (req, res) => {
    try {
      if (!supabase) return res.status(500).json({ error: "Supabase not configured" });
      const { data, error } = await supabase
        .from('roi_reports')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) throw error;

      res.json(data);
    } catch (err: any) {
      console.error("History Error:", err.message || err);
      res.json([]);
    }
  });

  app.get("/api/dashboard/analytics", async (req, res) => {
    try {
      // Check Supabase config on Production
      const hasSupabaseEnv = process.env.SUPABASE_URL && process.env.SUPABASE_ANON_KEY;
      
      const defaultResponse = {
        topStats: {
          totalInvestment: 0,
          avgROI: 0,
          totalFOBSavings: 0,
          activeProjects: 0
        },
        statusDistribution: [],
        investmentVsSaving: [],
        vendorInvestment: [],
        roiDistribution: []
      };

      if (supabase && hasSupabaseEnv) {
        try {
          const { data: reports, error } = await supabase.from('roi_reports').select('*');
          
          if (error) {
            console.error("Supabase dashboard analytics error:", error);
            return res.json(defaultResponse); // Graceful fallback
          }

          let totalInvestment = 0;
          let avgROI = 0;
          let avgFobImpact = 0;
          let activeCount = 0;
          let roiSum = 0;
          let roiCount = 0;
          let fobSum = 0;
          let fobCount = 0;

          const distribution: Record<string, number> = {};
          const vendors: Record<string, number> = {};
          const investmentVsSaving: any[] = [];
          const roiDistribution: any[] = [];
          
          // Safe array processing
          const safeReports = Array.isArray(reports) ? reports : [];

          for (const report of safeReports) {
            // Status distribution
            const status = report.status || 'Draft';
            distribution[status] = (distribution[status] || 0) + 1;

            // Vendor investment
            const vendor = report.vendor || 'Unknown';
            vendors[vendor] = (vendors[vendor] || 0) + (Number(report.investment_cost) || 0);

            // Check if active or approved
            if (status !== 'Rejected') {
              activeCount++;
            }

            if (status === 'Approved' || status === 'Active' || status === 'Pending') {
              totalInvestment += Number(report.investment_cost) || 0;
            }

            if (report.roi_months) {
              roiSum += Number(report.roi_months);
              roiCount++;
            }
            if (report.fob_impact) {
              // Negative fob_impact generally means savings
              fobSum += Number(report.fob_impact);
              fobCount++;
            }

            investmentVsSaving.push({
              name: report.machine_name || 'Unnamed Project',
              investment: Number(report.investment_cost) || 0,
              savings: Number(report.annual_savings) || 0
            });

            roiDistribution.push({
              name: report.machine_name || 'Unnamed Project',
              roi: Number(report.roi_months) || 0
            });
          }

          if (roiCount > 0) avgROI = roiSum / roiCount;
          if (fobCount > 0) avgFobImpact = fobSum / fobCount;

          return res.json({
            topStats: {
              totalInvestment,
              avgROI,
              // P1-07: this used to return the AVERAGE under a field named "total",
              // and the card label said total. Both are now reported explicitly.
              totalFOBSavings: fobSum,
              avgFOBImpact: avgFobImpact,
              activeProjects: activeCount
            },
            statusDistribution: Object.entries(distribution).map(([name, value]) => ({ name, value })),
            investmentVsSaving,
            vendorInvestment: Object.entries(vendors).map(([name, value]) => ({ name, value })),
            roiDistribution
          });
        } catch (innerErr) {
          console.error("Dashboard calculation error:", innerErr);
          return res.json(defaultResponse); // Fallback on processing error
        }
      }

      return res.json(defaultResponse);
    } catch (err) {
      // 500 should be avoided if possible, return safe response
      console.error("Dashboard API Error:", err);
      res.json({
        topStats: { totalInvestment: 0, avgROI: 0, totalFOBSavings: 0, activeProjects: 0 },
        statusDistribution: [],
        investmentVsSaving: [],
        vendorInvestment: [],
        roiDistribution: []
      });
    }
  });


  app.delete("/api/roi-reports/:id", async (req, res) => {
    try {
      const { id } = req.params;
      if (!supabase) return res.status(500).json({ error: "Supabase not configured" });
      
      await supabase.from('report_history').delete().eq('report_id', id);
      await supabase.from('report_embeddings').delete().eq('report_id', id);
      const { error } = await supabase.from('roi_reports').delete().eq('id', id);
      
      if (error) throw error;
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: "Failed to delete report" });
    }
  });

  /* ----------------------------- AI routes -----------------------------
   * All three share src/server/ai.ts for bounded calls, schema validation and
   * a single repair retry, and src/server/prompts for the rubric. Routes no
   * longer hold prompt text of their own — that is what allowed one deployment
   * to ship without the audit rubric entirely (P2-02).
   * -------------------------------------------------------------------- */

  const sendAIError = (res: any, err: unknown, label: string) => {
    if (err instanceof AIError) {
      console.error(`${label}:`, err.message, err.detail ?? "");
      return res.status(err.status).json({ error: err.message });
    }
    const message = err instanceof Error ? err.message : String(err);
    console.error(`${label}:`, message);
    return res.status(502).json({ error: "The AI service is unavailable. Please try again." });
  };

  app.post("/api/evaluate", async (req, res) => {
    try {
      const { prompt, targetLanguage } = req.body ?? {};
      if (typeof prompt !== "string" || prompt.trim() === "") {
        return res.status(400).json({ error: "A project payload is required." });
      }

      const lang = resolveLanguage(targetLanguage);
      const evaluation = await callStructured({
        system: evaluationSystemPrompt(lang),
        user: prompt,
        schema: EvaluationSchema,
      });

      // Nudge an off-enum verdict back onto the contract the UI styles against,
      // rather than letting it render as a rejection.
      const allowed = VERDICTS[lang];
      if (!allowed.includes(evaluation.verdict)) {
        const match = allowed.find((v) => evaluation.verdict.toLowerCase().includes(v.toLowerCase()));
        evaluation.verdict = match ?? allowed[1];
      }

      res.json(evaluation);
    } catch (err) {
      sendAIError(res, err, "Evaluate");
    }
  });

  app.post("/api/chat", async (req, res) => {
    try {
      const { messages, contextData, targetLanguage } = req.body ?? {};
      const lang = resolveLanguage(targetLanguage);

      let history: unknown[] = [];
      if (supabase) {
        try {
          const { data } = await supabase
            .from("roi_reports")
            .select("project_id, machine_name, vendor, shoe_model, investment_cost, annual_savings, roi_months, fob_impact, ai_verdict, status")
            .order("created_at", { ascending: false })
            .limit(8);
          history = data ?? [];
        } catch (e) {
          console.error("Chat history lookup failed:", e);
        }
      }

      const turns: Array<{ role: string; content?: string; text?: string }> = Array.isArray(messages)
        ? messages
        : typeof messages === "string"
          ? [{ role: "user", content: messages }]
          : [];

      if (turns.length === 0) return res.status(400).json({ error: "A message is required." });

      const transcript = turns
        .slice(-12)
        .map((m) => `${m.role === "assistant" || m.role === "model" ? "Assistant" : "User"}: ${m.content ?? m.text ?? ""}`)
        .join("\n");

      const { text } = await callStructured({
        system: chatSystemPrompt(lang, projectContext(contextData), projectHistory(history)),
        user: transcript,
        schema: ChatSchema,
        json: false,
      });

      res.json({ text });
    } catch (err) {
      sendAIError(res, err, "Chat");
    }
  });

  app.post("/api/infographic", async (req, res) => {
    try {
      const { params, results, targetLanguage } = req.body ?? {};
      const lang = resolveLanguage(targetLanguage);

      const payback = results?.payback?.kind === "months"
        ? `${Number(results.payback.months).toFixed(1)} months`
        : results?.payback?.kind === "immediate"
          ? "Immediate"
          : "No payback";

      const copy = await callStructured({
        system: infographicSystemPrompt(lang),
        user: infographicUserPrompt({
          equipmentName: params?.equipmentName ?? "",
          shoeModel: params?.shoeModel ?? "",
          annualSaving: Number(results?.savings?.totalAnnualSaving) || 0,
          payback,
          costPerPairDelta: Number(results?.savings?.fobImpact) || 0,
          operatorsFreed: Number(results?.savings?.manpowerSaving) || 0,
        }),
        schema: InfographicSchema,
      });

      res.json(copy);
    } catch (err) {
      sendAIError(res, err, "Infographic");
    }
  });

  if (!process.env.NETLIFY) {
    if (process.env.NODE_ENV !== "production") {
      const vite = await createViteServer({ server: { middlewareMode: true }, appType: "spa" });
      app.use(vite.middlewares);
    } else {
      const distPath = path.join(process.cwd(), "dist");
      app.use(express.static(distPath));
      app.get("*", (req, res) => res.sendFile(path.join(distPath, "index.html")));
    }
    app.listen(PORT, "0.0.0.0", () => console.log(`Server running on http://localhost:${PORT}`));
  }

  return app;
}

const appPromise = startServer();
export const handler = serverless(async (req: any, res: any) => {
  const app = await appPromise;
  return serverless(app)(req, res);
});
