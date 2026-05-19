import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

// Load env
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '../../.env.local') });

// Setup dummy env variables for Supabase if not present to ensure createClient doesn't return null
process.env.SUPABASE_URL = process.env.SUPABASE_URL || "https://dummy-project.supabase.co";
process.env.SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || "dummy-key";

// In-memory mock database for pgvector simulation
const mockDb = [];

// Helper to construct a standard mock response that supabase-js expects
function createMockFetchResponse(status, bodyData, headers = {}) {
  const defaultHeaders = {
    'content-type': 'application/json',
    ...headers
  };
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: status === 201 ? 'Created' : 'OK',
    headers: {
      get: (name) => defaultHeaders[name.toLowerCase()] || null,
      forEach: (callback) => {
        Object.entries(defaultHeaders).forEach(([k, v]) => callback(v, k));
      }
    },
    json: async () => bodyData,
    text: async () => JSON.stringify(bodyData)
  };
}

// Intercept global fetch to catch Supabase calls and redirect to mock DB
const originalFetch = globalThis.fetch;
globalThis.fetch = async (url, options = {}) => {
  const urlStr = String(url);
  
  // If it's a Supabase API call
  if (urlStr.includes('supabase.co')) {
    const method = (options.method || 'GET').toUpperCase();
    const body = options.body ? JSON.parse(options.body) : null;
    
    // 1. Insert (Upsert)
    if (method === 'POST' && urlStr.includes('/rest/v1/memories')) {
      const newRow = {
        id: mockDb.length + 1,
        user_id: body.user_id,
        content: body.content,
        metadata: body.metadata || {},
        embedding: body.embedding,
        created_at: new Date().toISOString()
      };
      mockDb.push(newRow);
      return createMockFetchResponse(201, [newRow]);
    }
    
    // 2. RPC (match_documents)
    if (method === 'POST' && urlStr.includes('/rest/v1/rpc/match_documents')) {
      const { query_embedding, match_threshold, match_count, filter_user_id } = body;
      
      // Calculate cosine similarity helper
      const dotProduct = (a, b) => a.reduce((sum, val, i) => sum + val * b[i], 0);
      const magnitude = (arr) => Math.sqrt(arr.reduce((sum, val) => sum + val * val, 0));
      const cosineSimilarity = (a, b) => {
        const magA = magnitude(a);
        const magB = magnitude(b);
        return (magA && magB) ? dotProduct(a, b) / (magA * magB) : 0;
      };

      const matched = mockDb
        .filter(row => !filter_user_id || row.user_id === filter_user_id)
        .map(row => {
          const similarity = cosineSimilarity(row.embedding, query_embedding);
          return {
            id: row.id,
            content: row.content,
            metadata: row.metadata,
            similarity
          };
        })
        .filter(item => item.similarity > match_threshold)
        .sort((a, b) => b.similarity - a.similarity)
        .slice(0, match_count);

      return createMockFetchResponse(200, matched);
    }

    // 3. Delete
    if (method === 'DELETE' && urlStr.includes('/rest/v1/memories')) {
      mockDb.length = 0; // Clear all
      return createMockFetchResponse(200, []);
    }

    // 4. Stats (GET or HEAD)
    if ((method === 'GET' || method === 'HEAD') && urlStr.includes('/rest/v1/memories')) {
      const count = mockDb.length;
      return createMockFetchResponse(200, [], {
        'content-range': `0-0/${count}`
      });
    }
  }

  // Fallback to real fetch for non-supabase (like Gemini embedding APIs)
  return originalFetch(url, options);
};

// Mock Express response helper
function createMockResponse() {
  const res = {
    statusCode: 200,
    headers: {},
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(data) {
      this.body = data;
      return this;
    }
  };
  return res;
}

async function runTest() {
  console.log("=== A iniciar Teste E2E RAG (pgvector Mock) ===");

  // Dynamically import handlers so dummy env is set
  const { default: upsertHandler } = await import('../../api/memory/upsert.js');
  const { default: queryHandler } = await import('../../api/memory/query.js');
  const { default: deleteHandler } = await import('../../api/memory/delete.js');
  const { default: statsHandler } = await import('../../api/memory/stats.js');

  const userId = "alexandre_test_user";

  // Documents to insert
  const docs = [
    { content: "Automação industrial com PLC permite controle robusto de processos.", metadata: { tag: "industrial" } },
    { content: "LLMs e RAG melhoram as respostas dos chatbots com contexto relevante.", metadata: { tag: "ia" } },
    { content: "O conselho do Córtex Digital usa múltiplos lobos para tomada de decisão.", metadata: { tag: "cortex" } }
  ];

  // Queries to run
  const queries = [
    "Como controlar processos industriais?",
    "Como funciona o Córtex Digital?",
    "O que melhora as respostas das IAs?"
  ];

  // 1. Clear database first
  const resDel = createMockResponse();
  await deleteHandler({ method: 'DELETE', body: { user_id: userId } }, resDel);
  console.log("Database inicializada/limpa.");

  // 2. Insert documents
  const insertResults = [];
  for (const doc of docs) {
    const req = {
      method: 'POST',
      body: { user_id: userId, content: doc.content, metadata: doc.metadata }
    };
    const res = createMockResponse();
    const t0 = Date.now();
    await upsertHandler(req, res);
    const t1 = Date.now();

    insertResults.push({
      content: doc.content,
      status: res.statusCode === 200 ? "sucesso" : "erro",
      latency_ms: t1 - t0
    });
    console.log(`Documento inserido: "${doc.content.slice(0, 30)}..." em ${t1 - t0}ms`);
  }

  // 3. Query documents
  const queryResults = [];
  for (const q of queries) {
    const req = {
      method: 'POST',
      body: { query: q, user_id: userId, threshold: 0.1, limit: 3 }
    };
    const res = createMockResponse();
    const t0 = Date.now();
    await queryHandler(req, res);
    const t1 = Date.now();

    queryResults.push({
      query: q,
      latency_ms: t1 - t0,
      results: res.body?.data || []
    });
    console.log(`Query: "${q}" executada em ${t1 - t0}ms. Resultados encontrados: ${res.body?.data?.length || 0}`);
  }

  // 4. Get stats
  const resStats = createMockResponse();
  await statsHandler({ method: 'GET', query: { user_id: userId } }, resStats);
  const count = resStats.body?.count || 0;
  console.log(`Total de documentos na base de dados: ${count}`);

  // Write report
  const resultsDir = path.join(__dirname, 'results');
  if (!fs.existsSync(resultsDir)) {
    fs.mkdirSync(resultsDir, { recursive: true });
  }

  const report = {
    test_date: new Date().toISOString(),
    status: "success",
    total_documents: count,
    insertions: insertResults,
    queries: queryResults
  };

  const reportPath = path.join(resultsDir, 'rag-test.json');
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2), 'utf8');
  console.log(`Relatório de teste RAG guardado em: ${reportPath}`);
}

runTest();
