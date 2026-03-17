import { Client } from '@neondatabase/serverless';
import { GoogleGenAI } from '@google/genai';
import { Handler } from '@netlify/functions';

export const handler: Handler = async () => {
  const results: any = {
    database: 'unknown',
    gemini: 'unknown',
    timestamp: new Date().toISOString(),
  };

  // 1. Check Database
  const client = new Client(process.env.DATABASE_URL);
  try {
    await client.connect();
    await client.query('SELECT 1');
    results.database = 'connected';
  } catch (error: any) {
    results.database = `error: ${error.message}`;
  } finally {
    await client.end();
  }

  // 2. Check Gemini API
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
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
