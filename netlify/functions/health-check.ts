import { neon } from '@neondatabase/serverless';
import { GoogleGenAI } from '@google/genai';
import { Handler } from '@netlify/functions';

export const handler: Handler = async () => {
  const results: any = {
    database: 'unknown',
    gemini: 'unknown',
    timestamp: new Date().toISOString(),
  };

  // 1. Check Database using HTTP
  try {
    const sql = neon(process.env.DATABASE_URL!);
    await sql`SELECT 1`;
    results.database = 'connected';
  } catch (error: any) {
    results.database = `error: ${error.message}`;
  }

  // 2. Check Gemini API
  try {
    if (!process.env.GEMINI_API_KEY) throw new Error("Missing API Key");
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: [{ parts: [{ text: 'ping' }] }]
    });
    if (response.text) {
      results.gemini = 'connected';
    }
  } catch (error: any) {
    results.gemini = `error: ${error.message}`;
  }

  return {
    statusCode: results.database === 'connected' && results.gemini === 'connected' ? 200 : 500,
    body: JSON.stringify(results),
  };
};