import "dotenv/config";
import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import fs from "fs";
import cors from "cors";
import Database from "better-sqlite3";
import { Pool } from "@neondatabase/serverless";
import multer from "multer";
import { v2 as cloudinary } from "cloudinary";
import serverless from "serverless-http";
import { GoogleGenAI } from "@google/genai";

const isProd = process.env.NODE_ENV === "production" || process.env.DATABASE_URL;

// Database Connection
let db: any;
let pgPool: Pool | null = null;

const getPool = () => {
  if (isProd && !pgPool && process.env.DATABASE_URL) {
    pgPool = new Pool({ connectionString: process.env.DATABASE_URL });
  }
  return pgPool;
};

if (!isProd || !process.env.DATABASE_URL) {
  db = new Database("database.sqlite");
  // Initialize SQLite Database
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT,
      email TEXT UNIQUE,
      department TEXT,
      role TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS reports (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_name TEXT,
      user_id INTEGER,
      current_params TEXT, -- JSON
      new_params TEXT,     -- JSON
      results TEXT,        -- JSON
      image_url TEXT,
      ai_evaluation TEXT,
      status TEXT DEFAULT 'draft',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS machines_catalog (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      machine_name TEXT,
      category TEXT,
      default_power REAL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS roi_reports (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      project_id TEXT UNIQUE,
      machine_name TEXT,
      shoe_model TEXT,
      vendor TEXT,
      investment_cost REAL,
      labor_saving_cost REAL,
      energy_saving_cost REAL,
      other_savings REAL,
      annual_savings REAL,
      annual_output REAL,
      fob_impact REAL,
      roi_months REAL,
      roi_percentage REAL,
      ai_verdict TEXT,
      ai_evaluation TEXT, -- JSON object
      status TEXT DEFAULT 'Draft',
      tags TEXT, -- JSON array
      image_url TEXT, -- JSON array
      form_data TEXT, -- JSON object
      language_codes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS report_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      report_id INTEGER,
      status_from TEXT,
      status_to TEXT,
      changed_by TEXT,
      comment TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(report_id) REFERENCES roi_reports(id)
    );

    CREATE TABLE IF NOT EXISTS report_embeddings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      report_id INTEGER,
      embedding_vector TEXT,
      summary_text TEXT,
      FOREIGN KEY(report_id) REFERENCES roi_reports(id)
    );
  `);

  try {
    db.exec("ALTER TABLE roi_reports ADD COLUMN annual_output REAL;");
  } catch (e) {}
  try {
    db.exec("ALTER TABLE roi_reports ADD COLUMN fob_impact REAL;");
  } catch (e) {}
  try {
    db.exec("ALTER TABLE roi_reports ADD COLUMN image_url TEXT;");
  } catch (e) {}
}

// Cloudinary Config
if (process.env.CLOUDINARY_URL) {
  cloudinary.config({
    cloudinary_url: process.env.CLOUDINARY_URL
  });
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(cors());
  app.use(express.json());

  // Helper for DB queries
  const query = async (text: string, params: any[] = []) => {
    const pool = getPool();
    if (pool) {
      const res = await pool.query(text.replace(/\?/g, (_, i) => `$${i + 1}`), params);
      return res.rows;
    } else {
      const stmt = db.prepare(text);
      if (text.trim().toUpperCase().startsWith("SELECT")) {
        return stmt.all(...params);
      } else {
        const info = stmt.run(...params);
        return { insertId: info.lastInsertRowid, changes: info.changes };
      }
    }
  };

  const queryOne = async (text: string, params: any[] = []) => {
    const rows = await query(text, params);
    return Array.isArray(rows) ? rows[0] : rows;
  };

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
      res.json({ id: (result as any).insertId || (result as any)[0]?.id });
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
      const reports = await query(q.replace(/ILIKE/g, getPool() ? "ILIKE" : "LIKE"), params);
      res.json(reports.map((r: any) => ({
        ...r,
        tags: typeof r.tags === 'string' ? JSON.parse(r.tags || "[]") : r.tags,
        form_data: typeof r.form_data === 'string' ? JSON.parse(r.form_data || "{}") : r.form_data,
        image_url: typeof r.image_url === 'string' ? JSON.parse(r.image_url || "[]") : r.image_url,
        ai_evaluation: typeof r.ai_evaluation === 'string' ? JSON.parse(r.ai_evaluation || "null") : r.ai_evaluation
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
        annual_savings, annual_output, fob_impact, roi_months, roi_percentage, 
        ai_verdict, ai_evaluation, status, tags, image_url, form_data 
      } = req.body;

      const result = await query(`
        INSERT INTO roi_reports (
          project_id, machine_name, shoe_model, vendor, investment_cost, 
          labor_saving_cost, energy_saving_cost, other_savings, 
          annual_savings, annual_output, fob_impact, roi_months, roi_percentage, 
          ai_verdict, ai_evaluation, status, tags, image_url, form_data
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING id
      `, [
        project_id, machine_name, shoe_model, vendor, investment_cost,
        labor_saving_cost, energy_saving_cost, other_savings,
        annual_savings, annual_output, fob_impact, roi_months, roi_percentage,
        ai_verdict, typeof ai_evaluation === 'string' ? ai_evaluation : JSON.stringify(ai_evaluation || null), status || 'Draft', JSON.stringify(tags || []), JSON.stringify(image_url || []), JSON.stringify(form_data || {})
      ]);

      res.json({ id: (result as any).insertId || (result as any)[0]?.id });
    } catch (err) {
      res.status(500).json({ error: "Failed to save ROI report" });
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

      await query(`
        UPDATE roi_reports SET
          project_id = ?, machine_name = ?, shoe_model = ?, vendor = ?, investment_cost = ?, 
          labor_saving_cost = ?, energy_saving_cost = ?, other_savings = ?, 
          annual_savings = ?, annual_output = ?, fob_impact = ?, roi_months = ?, roi_percentage = ?, 
          ai_verdict = ?, ai_evaluation = ?, status = ?, tags = ?, image_url = ?, form_data = ?
        WHERE id = ?
      `, [
        project_id, machine_name, shoe_model, vendor, investment_cost,
        labor_saving_cost, energy_saving_cost, other_savings,
        annual_savings, annual_output, fob_impact, roi_months, roi_percentage,
        ai_verdict, typeof ai_evaluation === 'string' ? ai_evaluation : JSON.stringify(ai_evaluation || null), status || 'Draft', JSON.stringify(tags || []), JSON.stringify(image_url || []), JSON.stringify(form_data || {}),
        id
      ]);

      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: "Failed to update ROI report" });
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
          AVG(roi_months) as avg_roi,
          AVG(fob_impact) as avg_fob_impact,
          COUNT(*) as total_projects
        FROM roi_reports
        WHERE status IN ('Approved', 'Implemented')
      `);

      const activeCount = await queryOne(`
        SELECT COUNT(*) as count FROM roi_reports WHERE status IN ('Pending', 'Approved', 'Implemented')
      `);

      const distribution = await query(`
        SELECT status as name, COUNT(*) as value FROM roi_reports GROUP BY status
      `);

      const comparison = await query(`
        SELECT machine_name, investment_cost as investment, fob_impact as fob_impact FROM roi_reports
        ORDER BY created_at DESC LIMIT 10
      `);

      res.json({
        topStats: {
          totalInvestment: Number(stats.total_investment) || 0,
          totalSavings: Number(stats.total_savings) || 0,
          totalOutput: Number(stats.total_output) || 0,
          avgROI: Number(stats.avg_roi) || 0,
          totalFOBSavings: Number(stats.avg_fob_impact) || 0,
          activeProjects: Number(activeCount.count) || 0
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

  app.post("/api/infographic", async (req, res) => {
    try {
      const { params, results } = req.body;
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) return res.status(500).json({ error: "Gemini API Key not configured" });

      const prompt = `
        Dựa vào dữ liệu dự án CAPEX sau, hãy tạo nội dung ngắn gọn để làm Infographic báo cáo.
        Thiết bị: ${params?.equipmentName || 'Máy mới'}
        Tiết kiệm: ${results?.savings?.totalAnnualSaving || 0} USD/năm
        ROI: ${results?.roiMonths || 0} tháng
        
        Trả về ĐÚNG định dạng JSON gồm:
        {
          "title": "Tiêu đề Infographic",
          "keyStats": [ "Stat 1", "Stat 2", "Stat 3" ],
          "highlights": [ "Điểm nổi bật 1", "Điểm nổi bật 2" ]
        }
      `;

      const ai = new GoogleGenAI({ apiKey });
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: [{ parts: [{ text: prompt }] }],
        config: { responseMimeType: "application/json" }
      });
      res.json(JSON.parse(response.text || "{}"));
    } catch (err: any) {
      console.error("Infographic Error:", err);
      res.status(500).json({ error: err.message });
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
