import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';

const supabaseUrl = (process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '').trim().replace(/"/g, '');
const supabaseKey = (process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || '').trim().replace(/"/g, '');

export const supabase = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;

const openaiKey = process.env.OPENAI_API_KEY || process.env.VITE_OPENAI_API_KEY;
const geminiKey = (process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY || '').trim().replace(/"/g, '');

const openai = openaiKey ? new OpenAI({ apiKey: openaiKey }) : null;

// Helper to generate deterministic mock embeddings if everything else fails
function getMockEmbedding(text) {
  const embedding = new Array(1536).fill(0);
  // Simple hash to make it semi-deterministic for testing
  let hash = 0;
  for (let i = 0; i < text.length; i++) {
    hash = (hash << 5) - hash + text.charCodeAt(i);
    hash |= 0;
  }
  for (let i = 0; i < 1536; i++) {
    embedding[i] = Math.sin(hash + i) * 0.1;
  }
  return embedding;
}

export async function generateEmbedding(text) {
  // 1. Try OpenAI
  if (openai) {
    try {
      const response = await openai.embeddings.create({
        model: "text-embedding-3-small",
        input: text.replace(/\n/g, ' '),
      });
      return response.data[0].embedding;
    } catch (e) {
      console.warn("OpenAI Embedding failed, trying Gemini or Mock:", e.message);
    }
  }

  // 2. Try Gemini
  if (geminiKey) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:embedContent?key=${geminiKey}`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: "models/text-embedding-004",
          content: { parts: [{ text }] }
        })
      });
      if (res.ok) {
        const data = await res.json();
        const geminiEmbedding = data.embedding?.values;
        if (Array.isArray(geminiEmbedding)) {
          // Pad 768 to 1536
          const padded = new Array(1536).fill(0);
          for (let i = 0; i < geminiEmbedding.length; i++) {
            padded[i] = geminiEmbedding[i];
          }
          return padded;
        }
      } else {
        console.warn("Gemini Embedding API returned status:", res.status);
      }
    } catch (e) {
      console.warn("Gemini Embedding failed, falling back to mock:", e.message);
    }
  }

  // 3. Fallback to deterministic mock
  console.log("Using Mock Embedding for text:", text.slice(0, 30) + "...");
  return getMockEmbedding(text);
}
