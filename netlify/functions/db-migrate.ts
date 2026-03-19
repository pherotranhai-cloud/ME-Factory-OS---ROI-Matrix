import { neon } from '@neondatabase/serverless';
import { Handler } from '@netlify/functions';

export const handler: Handler = async (event) => {
  const adminSecret = event.headers['x-admin-secret'];
  if (adminSecret !== process.env.ADMIN_SECRET_KEY) {
    return { statusCode: 401, body: JSON.stringify({ error: 'Unauthorized' }) };
  }

  // Dùng HTTP thay vì Client/WebSocket
  const sql = neon(process.env.DATABASE_URL!);

  try {
    await sql`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        name TEXT,
        email TEXT UNIQUE,
        department TEXT,
        role TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS roi_reports (
        id SERIAL PRIMARY KEY,
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
        roi_months REAL, 
        roi_percentage REAL,
        ai_verdict TEXT,
        status TEXT DEFAULT 'Draft',
        tags JSONB,
        language_codes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS report_history (
        id SERIAL PRIMARY KEY,
        report_id INTEGER,
        status_from TEXT,
        status_to TEXT,
        changed_by TEXT,
        comment TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `;

    return {
      statusCode: 200,
      body: JSON.stringify({ message: 'Database migration successful. Tables updated!' }),
    };
  } catch (error: any) {
    return { statusCode: 500, body: JSON.stringify({ error: error.message }) };
  }
};