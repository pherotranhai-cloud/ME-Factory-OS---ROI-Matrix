import { Client } from '@neondatabase/serverless';
import { Handler } from '@netlify/functions';

export const handler: Handler = async (event) => {
  const adminSecret = event.headers['x-admin-secret'];
  if (adminSecret !== process.env.ADMIN_SECRET_KEY) {
    return {
      statusCode: 401,
      body: JSON.stringify({ error: 'Unauthorized' }),
    };
  }

  const client = new Client(process.env.DATABASE_URL);
  await client.connect();

  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        name TEXT,
        email TEXT UNIQUE,
        department TEXT,
        role TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS reports (
        id SERIAL PRIMARY KEY,
        project_name TEXT,
        user_id INTEGER,
        current_params JSONB,
        new_params JSONB,
        results JSONB,
        image_url TEXT,
        ai_evaluation JSONB,
        status TEXT DEFAULT 'draft',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS machines_catalog (
        id SERIAL PRIMARY KEY,
        machine_name TEXT,
        category TEXT,
        default_power REAL,
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
        payback_period_months REAL,
        roi_percentage REAL,
        ai_verdict TEXT,
        status TEXT DEFAULT 'Draft',
        tags JSONB,
        language_codes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(user_id) REFERENCES users(id)
      );

      CREATE TABLE IF NOT EXISTS report_history (
        id SERIAL PRIMARY KEY,
        report_id INTEGER,
        status_from TEXT,
        status_to TEXT,
        changed_by TEXT,
        comment TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(report_id) REFERENCES roi_reports(id)
      );

      CREATE TABLE IF NOT EXISTS report_embeddings (
        id SERIAL PRIMARY KEY,
        report_id INTEGER,
        embedding_vector TEXT,
        summary_text TEXT,
        FOREIGN KEY(report_id) REFERENCES roi_reports(id)
      );
    `);

    return {
      statusCode: 200,
      body: JSON.stringify({ message: 'Database migration successful' }),
    };
  } catch (error: any) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message }),
    };
  } finally {
    await client.end();
  }
};
