import "dotenv/config";
import express from "express";
import cors from "cors";
import { Pool, neonConfig } from "@neondatabase/serverless";
import ws from "ws"; // 1. Import thư viện WebSocket
import { v2 as cloudinary } from "cloudinary";
import serverless from "serverless-http";
import { GoogleGenAI } from "@google/genai";

// 2. DÒNG MA THUẬT: Cấp phép cho NeonDB dùng WebSocket trên Netlify
neonConfig.webSocketConstructor = ws; 

// Database Connection
let pgPool: Pool | null = null;

const getPool = () => {
  if (!pgPool && process.env.DATABASE_URL) {
    pgPool = new Pool({ connectionString: process.env.DATABASE_URL });
  }
  return pgPool;
};

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
  const pool = getPool();
  if (pool) {
    try {
      // BỘ LỌC MA THUẬT: Đổi toàn bộ 'undefined' thành 'null' để PostgreSQL không bị lú
      const cleanParams = params.map(p => p === undefined ? null : p);
      
      const res = await pool.query(text.replace(/\?/g, (_, i) => `$${i + 1}`), cleanParams);
      return res.rows;
    } catch (dbErr) {
      console.error("SQL Database Error:", dbErr);
      throw dbErr; 
    }
  }
  throw new Error("Database not connected. Check DATABASE_URL.");
};

const queryOne = async (text: string, params: any[] = []) => {
  const rows = await query(text, params);
  return Array.isArray(rows) ? rows[0] : rows;
};

// --- API Routes ---

app.post("/api/upload", async (req: any, res) => {
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
  } catch (err: any) {
    console.error("GET /api/reports Error:", err);
    res.status(500).json({ error: "Failed to fetch reports", details: err.message || err.toString() });
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
  } catch (err: any) {
    console.error("POST /api/reports Error:", err);
    res.status(500).json({ error: "Failed to save report", details: err.message || err.toString() });
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
  } catch (err: any) {
    console.error("GET /api/roi-reports Error:", err);
    res.status(500).json({ error: "Failed to fetch ROI reports", details: err.message || err.toString() });
  }
});

app.post("/api/roi-reports", async (req, res) => {
  try {
    const { 
      project_id, machine_name, shoe_model, vendor, investment_cost, 
      labor_saving_cost, energy_saving_cost, other_savings, 
      annual_savings, annual_output, roi_months, roi_percentage, 
      ai_verdict, status, tags 
    } = req.body;

    const result = await query(`
      INSERT INTO roi_reports (
        project_id, machine_name, shoe_model, vendor, investment_cost, 
        labor_saving_cost, energy_saving_cost, other_savings, 
        annual_savings, annual_output, roi_months, roi_percentage, 
        ai_verdict, status, tags
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING id
    `, [
      project_id, machine_name, shoe_model, vendor, investment_cost,
      labor_saving_cost, energy_saving_cost, other_savings,
      annual_savings, annual_output, roi_months, roi_percentage,
      ai_verdict, status || 'Draft', JSON.stringify(tags || [])
    ]);

    res.json({ id: result[0]?.id });
  } catch (err: any) {
    console.error("POST /api/roi-reports Error:", err);
    res.status(500).json({ error: "Failed to save ROI report", details: err.message || err.toString() });
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
  } catch (err: any) {
    console.error("PATCH /api/roi-reports/:id/status Error:", err);
    res.status(500).json({ error: "Failed to update status", details: err.message || err.toString() });
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
  } catch (err: any) {
    console.error("GET /api/report-history Error:", err);
    res.status(500).json({ error: "Failed to fetch history", details: err.message || err.toString() });
  }
});

app.get("/api/dashboard-stats", async (req, res) => {
  try {
    const stats = await queryOne(`
      SELECT 
        SUM(investment_cost) as total_investment,
        SUM(annual_savings) as total_savings,
        SUM(annual_output) as total_output,
        AVG(roi_months) as avg_roi
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
        totalInvestment: Number(stats?.total_investment) || 0,
        totalSavings: Number(stats?.total_savings) || 0,
        totalOutput: Number(stats?.total_output) || 0,
        avg_roi: Number(stats?.avg_roi) || 0
      },
      statusDistribution: distribution || [],
      comparisonData: comparison || []
    });
  } catch (err: any) {
    console.error("GET /api/dashboard-stats Error:", err);
    res.status(500).json({ error: "Failed to fetch dashboard stats", details: err.message || err.toString() });
  }
});

app.delete("/api/roi-reports/:id", async (req, res) => {
  try {
    const { id } = req.params;
    await query("DELETE FROM report_history WHERE report_id = ?", [id]);
    await query("DELETE FROM report_embeddings WHERE report_id = ?", [id]);
    await query("DELETE FROM roi_reports WHERE id = ?", [id]);
    res.json({ success: true });
  } catch (err: any) {
    console.error("DELETE /api/roi-reports/:id Error:", err);
    res.status(500).json({ error: "Failed to delete report", details: err.message || err.toString() });
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