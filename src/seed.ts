import Database from "better-sqlite3";

const db = new Database("database.sqlite");

const seedData = [
  {
    project_id: "CAPEX-2026-001",
    machine_name: "Auto-Stitching Unit v4",
    shoe_model: "AIR-MAX-2026",
    vendor: "ME-TECH",
    investment_cost: 15000,
    annual_savings: 8500,
    payback_period_months: 21.2,
    status: "Approved",
    tags: JSON.stringify(["ROI", "Stitching", "AIR-MAX-2026"])
  },
  {
    project_id: "CAPEX-2026-002",
    machine_name: "Laser Cutting Unit",
    shoe_model: "ZOOM-RUN-2026",
    vendor: "LASER-PRO",
    investment_cost: 25000,
    annual_savings: 12000,
    payback_period_months: 25.0,
    status: "Implemented",
    tags: JSON.stringify(["ROI", "Cutting", "ZOOM-RUN-2026"])
  },
  {
    project_id: "CAPEX-2026-003",
    machine_name: "Heat Press Unit",
    shoe_model: "FLEX-2026",
    vendor: "HEAT-TECH",
    investment_cost: 8000,
    annual_savings: 3000,
    payback_period_months: 32.0,
    status: "Pending Approval",
    tags: JSON.stringify(["ROI", "Press", "FLEX-2026"])
  },
  {
    project_id: "CAPEX-2026-004",
    machine_name: "Injection Molding Machine",
    shoe_model: "DURABLE-2026",
    vendor: "MOLD-MASTER",
    investment_cost: 45000,
    annual_savings: 22000,
    payback_period_months: 24.5,
    status: "Approved",
    tags: JSON.stringify(["ROI", "Molding", "DURABLE-2026"])
  }
];

const insert = db.prepare(`
  INSERT OR IGNORE INTO roi_reports (
    project_id, machine_name, shoe_model, vendor, investment_cost, annual_savings, payback_period_months, status, tags
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

for (const data of seedData) {
  insert.run(
    data.project_id, data.machine_name, data.shoe_model, data.vendor,
    data.investment_cost, data.annual_savings, data.payback_period_months,
    data.status, data.tags
  );
}

console.log("Database seeded successfully.");
