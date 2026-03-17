import "dotenv/config";
import express from "express";
import cors from "cors";
import serverless from "serverless-http";
import { neon, neonConfig } from '@neondatabase/serverless';

// 1. ÉP NEON DÙNG HTTP (Bắt buộc cho Netlify Functions)
neonConfig.fetchConnectionCache = true;

// 2. KHỞI TẠO SQL CLIENT DUY NHẤT
const sql = neon(process.env.DATABASE_URL!);

const app = express();
app.use(cors());
app.use(express.json());

// 3. HELPER QUERY MỚI (Dùng cú pháp của Neon HTTP)
// Thay thế hàm query cũ dùng Client/pg sang dùng sql tag
const dbQuery = async (queryText: string, params: any[] = []) => {
  // Chuyển đổi dấu ? của bạn sang định dạng Neon ($1, $2...)
  let i = 0;
  const formattedQuery = queryText.replace(/\?/g, () => `$${++i}`);
  return await sql(formattedQuery, params);
};

// --- CÁC ROUTE API ĐÃ ĐƯỢC VÁ LỖI ---

// Lấy danh sách báo cáo
app.get("/api/roi-reports", async (req, res) => {
  try {
    const reports = await dbQuery("SELECT * FROM roi_reports ORDER BY created_at DESC");
    res.json(reports);
  } catch (err) {
    console.error("GET Reports Error:", err);
    res.status(500).json({ error: "Failed to fetch reports" });
  }
});

// Lưu báo cáo mới
app.post("/api/roi-reports", async (req, res) => {
  try {
    const r = req.body;
    const result = await dbQuery(
      `INSERT INTO roi_reports 
      (project_id, machine_name, shoe_model, vendor, investment_cost, annual_output, fob_impact, roi_months, status) 
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING id`,
      [r.project_id, r.machine_name, r.shoe_model, r.vendor, r.investment_cost, r.annual_output, r.fob_impact, r.roi_months, r.status || 'Draft']
    );
    res.json({ success: true, id: result[0].id });
  } catch (err) {
    console.error("POST Report Error:", err);
    res.status(500).json({ error: "Failed to save report" });
  }
});

// Lấy dữ liệu Dashboard (Sửa lỗi logic tính toán)
app.get("/api/dashboard-stats", async (req, res) => {
  try {
    const stats = await dbQuery(`
      SELECT 
        SUM(investment_cost) as total_investment,
        AVG(roi_months) as avg_roi,
        SUM(fob_impact) as total_fob_savings,
        COUNT(*) as total_projects
      FROM roi_reports WHERE status != 'Dropped'
    `);

    const distribution = await dbQuery(`
      SELECT status as name, COUNT(*) as value FROM roi_reports GROUP BY status
    `);

    const comparison = await dbQuery(`
      SELECT machine_name, investment_cost as investment, fob_impact FROM roi_reports LIMIT 10
    `);

    res.json({
      topStats: {
        totalInvestment: Number(stats[0].total_investment) || 0,
        avgROI: Number(stats[0].avg_roi) || 0,
        totalFOBSavings: Number(stats[0].total_fob_savings) || 0,
        activeProjects: Number(stats[0].total_projects) || 0
      },
      statusDistribution: distribution,
      comparisonData: comparison
    });
  } catch (err) {
    console.error("Dashboard Stats Error:", err);
    res.status(500).json({ error: "Failed to fetch dashboard stats" });
  }
});

// Xóa báo cáo
app.delete("/api/roi-reports/:id", async (req, res) => {
  try {
    const { id } = req.params;
    await dbQuery("DELETE FROM roi_reports WHERE id = ?", [id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Failed to delete" });
  }
});

// Export cho Netlify
export const handler = serverless(app);