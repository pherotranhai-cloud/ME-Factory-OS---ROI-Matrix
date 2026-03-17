import Database from "better-sqlite3";

const db = new Database("database.sqlite");

console.log("⚙️ Initializing ME Factory OS Database...");

try {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT,
      email TEXT UNIQUE,
      department TEXT,
      role TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS machines_catalog (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      machine_name TEXT,
      category TEXT,
      default_power REAL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS reports (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_name TEXT,
      current_params TEXT,
      new_params TEXT,
      results TEXT,
      ai_evaluation TEXT,
      image_url TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS report_embeddings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      report_id INTEGER,
      embedding_vector TEXT,
      summary_text TEXT,
      FOREIGN KEY(report_id) REFERENCES roi_reports(id)
    );
  `);
  console.log("✅ Database tables initialized successfully.");
} catch (error) {
  console.error("❌ Database initialization failed:", error);
}
