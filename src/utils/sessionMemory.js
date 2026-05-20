import { upsertMemory, getLastSessionSummary, getLatestMemories } from "../lib/memory.js";

/**
 * Chave usada no localStorage.
 * Prefixo "cortex_" para não colidir com outras chaves.
 */
const MEMORY_KEY = "cortex_session_memory";
const MAX_MEMORY_ENTRIES = 5;

/**
 * Gera um resumo simples da conversa para guardar.
 * Não usa LLM — extrai as primeiras e últimas mensagens.
 *
 * @param {Array} messages - Histórico completo da conversa
 * @param {string} conversationId - ID da conversa
 * @returns {Object} Entrada de memória
 */
export function buildMemoryEntry(messages, conversationId) {
  const lista = Array.isArray(messages) ? messages : [];
  const userMessages = lista.filter((m) => m.role === "user");
  const lastAssistant = [...lista].reverse().find((m) => m.role === "assistant");
  const agora = new Date();

  return {
    id: conversationId,
    data: agora.toLocaleDateString("pt-PT"),
    hora: agora.toLocaleTimeString("pt-PT", {
      hour: "2-digit",
      minute: "2-digit",
    }),
    primeiraMensagem: userMessages[0]?.content?.slice(0, 100) || "",
    ultimaMensagem: userMessages[userMessages.length - 1]?.content?.slice(0, 100) || "",
    ultimaResposta: lastAssistant?.content?.slice(0, 150) || "",
    totalMensagens: lista.length,
  };
}

/**
 * Guarda entrada de memória no localStorage e no Supabase.
 * Mantém máximo MAX_MEMORY_ENTRIES entradas no localStorage (FIFO).
 *
 * @param {string} userId - ID do utilizador
 * @param {Object} entry - Resultado de buildMemoryEntry()
 */
export async function saveMemoryEntry(userId, entry) {
  // 1. Backup local
  try {
    const existing = loadMemoryEntries();
    const updated = [entry, ...existing].slice(0, MAX_MEMORY_ENTRIES);
    localStorage.setItem(MEMORY_KEY, JSON.stringify(updated));
  } catch {
    // localStorage indisponível — ignorar silenciosamente
  }

  // 2. Persistência Supabase RAG
  if (!userId || userId === "anon") return;
  const content = `Sessão da conversa com ID ${entry.id}. Primeira pergunta do utilizador: "${entry.primeiraMensagem}". Última pergunta do utilizador: "${entry.ultimaMensagem}". Resposta final dada pelo Córtex Digital: "${entry.ultimaResposta}".`;
  const metadata = {
    type: "session_summary",
    conversation_id: entry.id,
    total_messages: entry.totalMensagens,
    timestamp: new Date().toISOString()
  };
  try {
    await upsertMemory(userId, content, metadata);
  } catch (e) {
    console.warn("[sessionMemory] erro ao guardar sessão no Supabase:", e.message);
  }
}

/**
 * Carrega todas as entradas de memória guardadas localmente.
 * @returns {Array} Array de entradas (pode ser vazio)
 */
export function loadMemoryEntries() {
  try {
    const raw = localStorage.getItem(MEMORY_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/**
 * Formata a entrada mais recente como contexto (versão síncrona / legada).
 *
 * @returns {string|null} Texto de contexto ou null se vazio
 */
export function getLastSessionContext() {
  const entries = loadMemoryEntries();
  if (!entries.length) return null;

  const last = entries[0];
  return `Contexto da sessão anterior (${last.data} ${last.hora}): ` +
    `O utilizador perguntou sobre "${last.primeiraMensagem}" ` +
    `e terminou com "${last.ultimaMensagem}". ` +
    `Última resposta dada: "${last.ultimaResposta}".`;
}

/**
 * Formata o contexto da sessão anterior obtido do Supabase (com fallback local).
 *
 * @param {string} userId - ID do utilizador
 * @returns {Promise<string|null>} Texto de contexto ou null
 */
export async function getLastSessionContextFromSupabase(userId) {
  if (!userId || userId === "anon") {
    return getLastSessionContext();
  }

  try {
    const lastSummary = await getLastSessionSummary(userId);
    if (lastSummary) {
      const dataStr = new Date(lastSummary.created_at || lastSummary.metadata?.timestamp || Date.now()).toLocaleDateString("pt-PT");
      return `Contexto da sessão anterior (${dataStr}): ${lastSummary.content}`;
    }
  } catch (e) {
    console.warn("[sessionMemory] erro ao obter contexto do Supabase, fallback para local:", e.message);
  }

  return getLastSessionContext();
}

/**
 * Decide se o banner de continuação deve aparecer.
 *
 * @param {Object} estado - Estado mínimo da UI
 * @returns {boolean} true se deve mostrar o banner
 */
export function shouldShowMemoryBanner({ page, dismissed, context, messages }) {
  const lista = Array.isArray(messages) ? messages : [];
  return page === "chat" &&
    dismissed !== true &&
    !!context &&
    !lista.some((m) => m.role === "user");
}

/**
 * Injecta contexto anterior como primeira mensagem de sistema.
 *
 * @param {Array} messages - Mensagens actuais da conversa
 * @param {string} context - Contexto formatado da sessão anterior
 * @param {Function} criarId - Gerador opcional de ID para testes
 * @returns {Array} Mensagens com contexto ou array original se já houver utilizador
 */
export function injectSessionContext(messages, context, criarId = () => Date.now() + Math.random()) {
  if (!context) return messages;
  const lista = Array.isArray(messages) ? messages : [];
  if (lista.some((m) => m.role === "user")) return messages;

  const mensagemSistema = {
    id: criarId(),
    role: "system",
    content: context,
    systemNote: true,
    memoryContext: true,
  };

  return [mensagemSistema, ...lista.filter((m) => !m.memoryContext)];
}

/**
 * Limpa toda a memória guardada.
 */
export function clearMemory() {
  try {
    localStorage.removeItem(MEMORY_KEY);
  } catch {
    // localStorage indisponível — ignorar silenciosamente
  }
}

export { getLatestMemories };

