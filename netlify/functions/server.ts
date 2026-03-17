import "dotenv/config";
import express from "express";
import cors from "cors";
import { Client } from "@neondatabase/serverless";
import { v2 as cloudinary } from "cloudinary";
import serverless from "serverless-http";
import { GoogleGenAI } from "@google/genai";

// Database Connection
let pgClient: Client | null = null;

if (process.env.DATABASE_URL) {
  pgClient = new Client(process.env.DATABASE_URL);
  pgClient.connect().catch(err => console.error("NeonDB Connection Error:", err));
}

// Cloudinary Config
if (process.env.CLOUDINARY_URL) {
  cloudinary.config({
    cloudinary_url: process.env.CLOUDINARY_URL
  });
}

const app = express();
app.use(cors());
app.use(express.json());

// Helper for DB queries
const query = async (text: string, params: any[] = []) => {
  if (pgClient) {
    const res = await pgClient.query(text.replace(/\?/g, (_, i) => `$${i + 1}`), params);
    return res.rows;
  }
  throw new Error("Database not connected");
};

const queryOne = async (text: string, params: any[] = []) => {
  const rows = await query(text, params);
  return Array.isArray(rows) ? rows[0] : rows;
};

// API Routes
app.post("/api/upload", async (req: any, res) => {
  // Note: Netlify Functions have limits on file uploads. 
  // For production, it's better to use Cloudinary's direct upload from the frontend.
  // But for now, we'll proxy if it's small or just return error for large files.
  res.status(400).json({ error: "Use client-side upload for production" });
});

app.get("/api/reports", async (req, res) => {
  try {
    const reports = await query("SELECT * FROM reports ORDER BY created_at DESC");
    res.json(reports.map((r: any) => ({
      ...r,
      current_params: typeof r.current_params === 'string' ? JSON.parse(r.current_params || '{}') : r.current_params,
      new_params: typeof r.new_params === 'string' ? JSON.parse(r.new_params || '{}') : r.new_params,
      results: typeof r.results === 'string' ? JSON.parse(r.results || '{}') : r.results,
      ai_evaluation: typeof r.ai_evaluation === 'string' ? JSON.parse(r.ai_evaluation || 'null') : r.ai_evaluation,
      image_url: typeof r.image_url === 'string' ? JSON.parse(r.image_url || '[]') : r.image_url
    })));
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch reports" });
  }
});

app.post("/api/reports", async (req, res) => {
  try {
    const { project_name, current_params, new_params, results, ai_evaluation, image_url } = req.body;
    const result = await query(
      "INSERT INTO reports (project_name, current_params, new_params, results, ai_evaluation, image_url) VALUES (?, ?, ?, ?, ?, ?) RETURNING id",
      [project_name, JSON.stringify(current_params), JSON.stringify(new_params), JSON.stringify(results), JSON.stringify(ai_evaluation), image_url]
    );
    res.json({ id: result[0]?.id });
  } catch (err) {
    res.status(500).json({ error: "Failed to save report" });
  }
});

app.get("/api/roi-reports", async (req, res) => {
  try {
    const { search } = req.query;
    let q = "SELECT * FROM roi_reports";
    const params: any[] = [];
    if (search) {
      q += " WHERE machine_name ILIKE ? OR project_id ILIKE ? OR vendor ILIKE ? OR shoe_model ILIKE ?";
      const p = `%${search}%`;
      params.push(p, p, p, p);
    }
    q += " ORDER BY created_at DESC";
    const reports = await query(q, params);
    res.json(reports.map((r: any) => ({
      ...r,
      tags: typeof r.tags === 'string' ? JSON.parse(r.tags || "[]") : r.tags
    })));
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch ROI reports" });
  }
});

app.post("/api/roi-reports", async (req, res) => {
  try {
    const { 
      project_id, machine_name, shoe_model, vendor, investment_cost, 
      labor_saving_cost, energy_saving_cost, other_savings, 
      annual_savings, annual_output, payback_period_months, roi_percentage, 
      ai_verdict, status, tags 
    } = req.body;

    const result = await query(`
      INSERT INTO roi_reports (
        project_id, machine_name, shoe_model, vendor, investment_cost, 
        labor_saving_cost, energy_saving_cost, other_savings, 
        annual_savings, annual_output, payback_period_months, roi_percentage, 
        ai_verdict, status, tags
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING id
    `, [
      project_id, machine_name, shoe_model, vendor, investment_cost,
      labor_saving_cost, energy_saving_cost, other_savings,
      annual_savings, annual_output, payback_period_months, roi_percentage,
      ai_verdict, status || 'Draft', JSON.stringify(tags || [])
    ]);

    res.json({ id: result[0]?.id });
  } catch (err) {
    res.status(500).json({ error: "Failed to save ROI report" });
  }
});

app.patch("/api/roi-reports/:id/status", async (req, res) => {
  try {
    const { id } = req.params;
    const { status, changed_by, comment } = req.body;
    const report = await queryOne("SELECT status FROM roi_reports WHERE id = ?", [id]);
    if (!report) return res.status(404).json({ error: "Report not found" });

    await query("UPDATE roi_reports SET status = ? WHERE id = ?", [status, id]);
    await query(
      "INSERT INTO report_history (report_id, status_from, status_to, changed_by, comment) VALUES (?, ?, ?, ?, ?)",
      [id, report.status, status, changed_by, comment]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Failed to update status" });
  }
});

app.get("/api/report-history", async (req, res) => {
  try {
    const history = await query(`
      SELECT h.*, r.machine_name, r.project_id 
      FROM report_history h
      JOIN roi_reports r ON h.report_id = r.id
      ORDER BY h.created_at DESC LIMIT 10
    `);
    res.json(history);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch history" });
  }
});

app.get("/api/dashboard-stats", async (req, res) => {
  try {
    const stats = await queryOne(`
      SELECT 
        SUM(investment_cost) as total_investment,
        SUM(annual_savings) as total_savings,
        SUM(annual_output) as total_output,
        AVG(payback_period_months) as avg_payback
      FROM roi_reports
      WHERE status IN ('Approved', 'Implemented')
    `);

    const distribution = await query(`
      SELECT status, COUNT(*) as count FROM roi_reports GROUP BY status
    `);

    const comparison = await query(`
      SELECT machine_name, investment_cost, annual_savings FROM roi_reports
      ORDER BY created_at DESC LIMIT 10
    `);

    res.json({
      topStats: {
        totalInvestment: Number(stats.total_investment) || 0,
        totalSavings: Number(stats.total_savings) || 0,
        totalOutput: Number(stats.total_output) || 0,
        avg_payback: Number(stats.avg_payback) || 0
      },
      statusDistribution: distribution,
      comparisonData: comparison
    });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch dashboard stats" });
  }
});

app.delete("/api/roi-reports/:id", async (req, res) => {
  try {
    const { id } = req.params;
    await query("DELETE FROM report_history WHERE report_id = ?", [id]);
    await query("DELETE FROM report_embeddings WHERE report_id = ?", [id]);
    await query("DELETE FROM roi_reports WHERE id = ?", [id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Failed to delete report" });
  }
});

app.post("/api/evaluate", async (req, res) => {
  try {
    const { prompt } = req.body;
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) return res.status(500).json({ error: "Gemini API Key not configured" });

    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: [{ parts: [{ text: prompt }] }],
      config: { responseMimeType: "application/json" }
    });
    res.json(JSON.parse(response.text || "{}"));
  } catch (err: any) {
    console.error("Gemini Error:", err);
    res.status(500).json({ error: err.message });
  }
});

export const handler = serverless(app);
