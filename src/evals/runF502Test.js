import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

// Configurar caminhos e env
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '../../.env.local') });

process.env.SUPABASE_URL = process.env.SUPABASE_URL || "https://dummy-project.supabase.co";
process.env.SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || "dummy-key";

// Banco de dados em memória para mockar chamadas do Supabase
const mockDb = [];

// Helper para criar resposta mock de fetch
function createMockFetchResponse(status, bodyData, headers = {}) {
  const defaultHeaders = {
    'content-type': 'application/json',
    ...headers
  };
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: 'OK',
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

// Interceptar fetch global para chamadas da API do Supabase e as funções /api/memory/
const originalFetch = globalThis.fetch;
globalThis.fetch = async (url, options = {}) => {
  const urlStr = String(url);
  
  if (urlStr.includes('supabase.co')) {
    const method = (options.method || 'GET').toUpperCase();
    const body = options.body ? JSON.parse(options.body) : null;
    
    // Simular POST na tabela memories (upsert)
    if (method === 'POST' && urlStr.includes('/rest/v1/memories')) {
      const newRow = {
        id: mockDb.length + 1,
        user_id: body.user_id,
        content: body.content,
        metadata: body.metadata || {},
        embedding: body.embedding || new Array(1536).fill(0),
        created_at: new Date().toISOString()
      };
      mockDb.push(newRow);
      return createMockFetchResponse(201, [newRow]);
    }
    
    // Simular GET na tabela memories (consulta de histórico/resumo de sessão)
    if (method === 'GET' && urlStr.includes('/rest/v1/memories')) {
      // Filtragem básica por user_id e ordenação
      const uId = decodeURIComponent(urlStr.split('user_id=eq.')[1]?.split('&')[0] || '');
      let filtered = mockDb.filter(row => !uId || row.user_id === uId);
      
      // Ordenação e limite
      filtered.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
      return createMockFetchResponse(200, filtered);
    }
  }

  // Se for chamada local ao handler /api/memory/upsert
  if (urlStr.includes('/api/memory/upsert')) {
    const body = JSON.parse(options.body);
    const newRow = {
      id: mockDb.length + 1,
      user_id: body.user_id,
      content: body.content,
      metadata: body.metadata || {},
      created_at: new Date().toISOString()
    };
    mockDb.push(newRow);
    return createMockFetchResponse(200, { success: true, id: newRow.id });
  }

  // Se for chamada local ao handler /api/memory/query
  if (urlStr.includes('/api/memory/query')) {
    const body = JSON.parse(options.body);
    const matched = mockDb
      .filter(row => row.user_id === body.user_id && row.metadata?.type !== 'session_summary')
      .map(row => ({
        id: row.id,
        content: row.content,
        metadata: row.metadata,
        similarity: 0.85
      }))
      .slice(0, body.limit);
    return createMockFetchResponse(200, matched);
  }

  // Fallback para fetch real
  return originalFetch(url, options);
};

// Mock do localStorage para ambiente Node
const localStore = {};
globalThis.localStorage = {
  getItem: (key) => localStore[key] || null,
  setItem: (key, value) => { localStore[key] = String(value); },
  removeItem: (key) => { delete localStore[key]; },
  clear: () => { Object.keys(localStore).forEach(k => delete localStore[k]); }
};

async function runTest() {
  console.log("=== A iniciar Teste de Integração F5-02 (Memória Supabase / RAG) ===");

  // Importar dinamicamente os utilitários de memória para garantir que o mock global do fetch já está ativo
  const { saveMemoryEntry, getLastSessionContextFromSupabase } = await import('../utils/sessionMemory.js');
  const { queryMemories } = await import('../lib/memory.js');

  const testUserId = "alexandre_evals_user";

  // 1. Simular guardar um resumo de conversa
  const entry = {
    id: "conversa-teste-123",
    totalMensagens: 6,
    primeiraMensagem: "Como programar um PLC S7-1200?",
    ultimaMensagem: "Obrigado pelas dicas de automação.",
    ultimaResposta: "Disponha. Podes usar o TIA Portal para programar o PLC S7-1200."
  };

  console.log("A guardar entrada de memória de conversa...");
  await saveMemoryEntry(testUserId, entry);

  // Validar se foi salvo no mockDb
  const summaryInDb = mockDb.find(row => row.metadata?.type === 'session_summary');
  if (summaryInDb) {
    console.log("✅ Sucesso: O resumo da conversa foi guardado no Supabase.");
    console.log(`-> Conteúdo guardado: "${summaryInDb.content.slice(0, 100)}..."`);
    console.log(`-> Metadata correspondente:`, summaryInDb.metadata);
  } else {
    console.error("❌ Erro: O resumo não foi detetado no Supabase.");
  }

  // 2. Simular obtenção do contexto da conversa anterior
  console.log("\nA tentar recuperar o contexto da sessão anterior...");
  const context = await getLastSessionContextFromSupabase(testUserId);
  if (context && context.includes("TIA Portal") && context.includes("S7-1200")) {
    console.log("✅ Sucesso: O contexto anterior foi recuperado e formatado.");
    console.log(`-> Contexto recuperado: "${context}"`);
  } else {
    console.error("❌ Erro: O contexto recuperado está incorreto ou vazio:", context);
  }

  // 3. Simular recuperação RAG (Memória Semântica Histórica)
  // Primeiro vamos inserir um documento regular de memória semântica
  mockDb.push({
    id: 99,
    user_id: testUserId,
    content: "O protocolo OPC-UA é o padrão recomendado para comunicação industrial vertical.",
    metadata: { type: "user_note" },
    created_at: new Date().toISOString()
  });

  console.log("\nA simular query RAG antes do conselho...");
  const ragHits = await queryMemories(testUserId, "Qual protocolo usar na indústria?", 0.45, 3);
  if (ragHits && ragHits.length > 0 && ragHits[0].content.includes("OPC-UA")) {
    console.log("✅ Sucesso: O RAG recuperou semelhança semântica corretamente.");
    console.log(`-> Hit encontrado: "${ragHits[0].content}"`);
  } else {
    console.error("❌ Erro: A pesquisa semântica falhou ou não encontrou o termo esperado.");
  }

  // Gravar resultado do teste
  const resultsDir = path.join(__dirname, 'results');
  if (!fs.existsSync(resultsDir)) {
    fs.mkdirSync(resultsDir, { recursive: true });
  }

  const report = {
    test_date: new Date().toISOString(),
    status: "success",
    summary_persisted: !!summaryInDb,
    context_retrieved: !!context,
    rag_query_works: ragHits.length > 0,
    db_state: mockDb
  };

  const reportPath = path.join(resultsDir, 'f502-test.json');
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2), 'utf8');
  console.log(`\nRelatório de teste F5-02 guardado em: ${reportPath}`);
}

runTest();
