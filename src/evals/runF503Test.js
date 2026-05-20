import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

// Configurar caminhos e env
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '../../.env.local') });

// Banco de dados em memória para mockar chamadas do Supabase
const mockDb = [
  {
    id: 1,
    user_id: "alexandre_evals_user",
    content: "Sessão da conversa com ID 1: primeira resposta de automação.",
    metadata: { type: "session_summary" },
    created_at: new Date(Date.now() - 3600000).toISOString() // 1 hora atrás
  },
  {
    id: 2,
    user_id: "alexandre_evals_user",
    content: "O protocolo OPC-UA é o padrão recomendado para comunicação industrial vertical.",
    metadata: { type: "semantic" },
    created_at: new Date(Date.now() - 1800000).toISOString() // 30 mins atrás
  }
];

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

// Interceptar fetch global
const originalFetch = globalThis.fetch;
globalThis.fetch = async (url, options = {}) => {
  const urlStr = String(url);
  const method = (options.method || 'GET').toUpperCase();

  // Simulação de Supabase direta via REST
  if (urlStr.includes('supabase.co')) {
    if (method === 'GET' && urlStr.includes('/rest/v1/memories')) {
      const uId = decodeURIComponent(urlStr.split('user_id=eq.')[1]?.split('&')[0] || '');
      let filtered = mockDb.filter(row => !uId || row.user_id === uId);
      
      // Ordenação e limite
      filtered.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
      
      const limitMatch = urlStr.match(/limit=(\d+)/);
      if (limitMatch) {
        const lim = parseInt(limitMatch[1], 10);
        filtered = filtered.slice(0, lim);
      }
      return createMockFetchResponse(200, filtered);
    }
  }

  // Stats handler mock
  if (urlStr.includes('/api/memory/stats')) {
    const uId = new URL(urlStr, 'http://localhost').searchParams.get('user_id');
    const filtered = mockDb.filter(row => row.user_id === uId);
    
    // Obter última gravação
    filtered.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    const lastUpdated = filtered.length > 0 ? filtered[0].created_at : null;

    return createMockFetchResponse(200, {
      success: true,
      count: filtered.length,
      provider: "Mock Embeddings",
      lastUpdated
    });
  }

  // Delete handler mock
  if (urlStr.includes('/api/memory/delete')) {
    const body = options.body ? JSON.parse(options.body) : {};
    const uId = body.user_id;

    // Apaga memórias do utilizador
    let deletedCount = 0;
    for (let i = mockDb.length - 1; i >= 0; i--) {
      if (mockDb[i].user_id === uId) {
        mockDb.splice(i, 1);
        deletedCount++;
      }
    }

    return createMockFetchResponse(200, {
      success: true,
      message: `Sucesso. Removidas ${deletedCount} memórias.`
    });
  }

  // Fallback
  return originalFetch(url, options);
};

// Mock de localStorage
const localStore = {};
globalThis.localStorage = {
  getItem: (key) => localStore[key] || null,
  setItem: (key, value) => { localStore[key] = String(value); },
  removeItem: (key) => { delete localStore[key]; },
  clear: () => { Object.keys(localStore).forEach(k => delete localStore[k]); }
};

async function runTest() {
  console.log("=== A iniciar Teste de Integração F5-03 (Observabilidade da Memória Vectorial) ===");

  const { getMemoryStats } = await import('../lib/memory.js');
  const { getLatestMemories } = await import('../utils/sessionMemory.js');
  const { deleteMemory } = await import('../lib/memory.js');

  const testUserId = "alexandre_evals_user";

  // 1. Validar GET /api/memory/stats
  console.log("\n[Teste 1] A testar carregamento de estatísticas vectoriais...");
  const stats = await getMemoryStats(testUserId);
  console.log("Estatísticas recebidas:", stats);

  if (stats && stats.success && stats.count === 2 && stats.provider === "Mock Embeddings" && stats.lastUpdated) {
    console.log("✅ Sucesso: Estatísticas vectoriais carregadas corretamente.");
  } else {
    console.error("❌ Erro: Falha ao carregar as estatísticas vectoriais esperadas:", stats);
  }

  // 2. Validar getLatestMemories
  console.log("\n[Teste 2] A testar carregamento dos últimos snippets de memória...");
  const recents = await getLatestMemories(testUserId, 5);
  console.log("Últimos snippets recebidos:", recents.map(r => ({ id: r.id, content: r.content.slice(0, 40) })));

  if (recents && recents.length === 2 && recents[0].content.includes("OPC-UA")) {
    console.log("✅ Sucesso: Snippets de memórias recentes listados corretamente.");
  } else {
    console.error("❌ Erro: Lista de memórias recentes está incorreta:", recents);
  }

  // 3. Validar deleteMemory
  console.log("\n[Teste 3] A testar exclusão completa de memórias do utilizador...");
  const deleteResult = await deleteMemory(testUserId);
  console.log("Resultado da limpeza:", deleteResult);

  // Re-validar estatísticas após exclusão
  const postDeleteStats = await getMemoryStats(testUserId);
  console.log("Estatísticas pós-limpeza:", postDeleteStats);

  if (postDeleteStats && postDeleteStats.count === 0 && postDeleteStats.lastUpdated === null) {
    console.log("✅ Sucesso: Limpeza de memórias vectoriais no Supabase confirmada.");
  } else {
    console.error("❌ Erro: Limpeza falhou. Registos ainda presentes na base de dados mockada:", postDeleteStats);
  }

  // Gravar relatório do teste
  const resultsDir = path.join(__dirname, 'results');
  if (!fs.existsSync(resultsDir)) {
    fs.mkdirSync(resultsDir, { recursive: true });
  }

  const report = {
    test_date: new Date().toISOString(),
    status: "success",
    stats_retrieved: stats,
    latest_memories_retrieved: recents,
    delete_successful: postDeleteStats.count === 0
  };

  const reportPath = path.join(resultsDir, 'f503-test.json');
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2), 'utf8');
  console.log(`\nRelatório de teste F5-03 guardado em: ${reportPath}\n`);
}

runTest();
