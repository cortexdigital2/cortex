// Córtex Digital — Supabase memory layer
// Todas as operações usam service key via proxy /api — nunca exposta no frontend

const SB_URL = import.meta.env.VITE_SUPABASE_URL;
const SB_ANON = import.meta.env.VITE_SUPABASE_ANON_KEY;

const MAX_SEMANTIC = 80;
const MAX_PATTERNS = 12;
const MAX_EPISODIC = 15;

function headers() {
  return {
    apikey: SB_ANON,
    Authorization: `Bearer ${SB_ANON}`,
    "Content-Type": "application/json",
  };
}

async function sbGet(path) {
  const res = await fetch(`${SB_URL}/rest/v1/${path}`, { headers: headers() });
  if (!res.ok) throw new Error(`Supabase GET ${res.status}`);
  return res.json();
}

async function sbPost(path, body, prefer = "") {
  const res = await fetch(`${SB_URL}/rest/v1/${path}`, {
    method: "POST",
    headers: { ...headers(), ...(prefer ? { Prefer: prefer } : {}) },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Supabase POST ${res.status}: ${err.slice(0, 120)}`);
  }
  return res.status === 204 ? null : res.json();
}

async function sbPatch(path, body) {
  const res = await fetch(`${SB_URL}/rest/v1/${path}`, {
    method: "PATCH",
    headers: { ...headers(), Prefer: "return=representation" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Supabase PATCH ${res.status}: ${err.slice(0, 120)}`);
  }
  return res.json();
}

async function sbDelete(path) {
  const res = await fetch(`${SB_URL}/rest/v1/${path}`, {
    method: "DELETE",
    headers: headers(),
  });
  if (!res.ok) throw new Error(`Supabase DELETE ${res.status}`);
}

// ── BRAIN ────────────────────────────────────────────────────

export async function getBrain(userId) {
  const rows = await sbGet(
    `brain_state?user_id=eq.${encodeURIComponent(userId)}&select=*`,
  );
  if (!rows?.length) return null;
  const r = rows[0];
  return {
    semantic: Array.isArray(r.semantic) ? r.semantic : [],
    episodic: Array.isArray(r.episodic) ? r.episodic : [],
    patterns: Array.isArray(r.patterns) ? r.patterns : [],
    procedural: r.procedural ?? {
      format: "conciso",
      lang: "pt",
      level: "médio",
    },
    sessions: r.sessions ?? 0,
    lastReflect: r.last_reflect ?? null,
  };
}

export async function saveBrain(userId, brain) {
  const payload = {
    user_id: userId,
    semantic: (brain.semantic ?? []).slice(-MAX_SEMANTIC),
    episodic: (brain.episodic ?? []).slice(-MAX_EPISODIC),
    patterns: (brain.patterns ?? []).slice(-MAX_PATTERNS),
    procedural: brain.procedural ?? {},
    sessions: brain.sessions ?? 0,
    last_reflect: brain.lastReflect ?? null,
    updated_at: new Date().toISOString(),
  };
  return sbPost("brain_state", payload, "resolution=merge-duplicates");
}

export async function mergeBrainReflect(userId, ext) {
  const current = (await getBrain(userId)) ?? {
    semantic: [],
    episodic: [],
    patterns: [],
    procedural: {},
    sessions: 0,
  };
  const updated = {
    ...current,
    semantic: [...current.semantic, ...(ext.new_semantic ?? [])].slice(
      -MAX_SEMANTIC,
    ),
    patterns: [
      ...new Set([...current.patterns, ...(ext.new_patterns ?? [])]),
    ].slice(-MAX_PATTERNS),
    episodic: ext.session_summary
      ? [...current.episodic, ext.session_summary].slice(-MAX_EPISODIC)
      : current.episodic,
    procedural: { ...current.procedural, ...(ext.procedural_update ?? {}) },
    lastReflect: new Date().toISOString(),
  };
  return saveBrain(userId, updated);
}

// ── CONVERSAS ────────────────────────────────────────────────

export async function getConversations(userId, limit = 50) {
  return sbGet(
    `conversations?user_id=eq.${encodeURIComponent(userId)}&order=updated_at.desc&limit=${limit}&select=id,title,created_at,updated_at`,
  );
}

export async function createConversation(userId, title = "Nova conversa") {
  const rows = await sbPost(
    "conversations",
    { user_id: userId, title },
    "return=representation",
  );
  return rows?.[0] ?? null;
}

export async function updateConversationTitle(convId, title) {
  return sbPatch(`conversations?id=eq.${convId}`, { title });
}

export async function deleteConversation(convId) {
  return sbDelete(`conversations?id=eq.${convId}`);
}

// ── MENSAGENS ────────────────────────────────────────────────

export async function getMessages(convId, limit = 200) {
  return sbGet(
    `messages?conversation_id=eq.${convId}&order=created_at.asc&limit=${limit}`,
  );
}

export async function saveMessage(convId, msg) {
  const payload = {
    conversation_id: convId,
    role: msg.role,
    content: msg.content ?? "",
    structured: msg.structured ?? null,
    council: msg.council ?? null,
    lobe_results: msg.lobeResults ?? null,
    used_memory: msg.usedMemory ?? null,
    council_decision: msg.councilDecision ?? null,
  };
  return sbPost("messages", payload, "return=representation");
}

export async function saveMessages(convId, msgs) {
  const payloads = msgs.map((msg) => ({
    conversation_id: convId,
    role: msg.role,
    content: msg.content ?? "",
    structured: msg.structured ?? null,
    council: msg.council ?? null,
    lobe_results: msg.lobeResults ?? null,
    used_memory: msg.usedMemory ?? null,
    council_decision: msg.councilDecision ?? null,
  }));
  return sbPost("messages", payloads, "return=representation");
}

// ── QSTASH TRIGGER ───────────────────────────────────────────
// Chama /api/reflect de forma assíncrona via QStash
// Requer VITE_QSTASH_URL e VITE_QSTASH_TOKEN no .env
// Nota: em produção este trigger deve ser feito server-side para não expor o token

export async function triggerReflect(userId, buf, mem) {
  const qstashUrl = import.meta.env.VITE_QSTASH_URL;
  const qstashToken = import.meta.env.VITE_QSTASH_TOKEN;
  if (!qstashUrl || !qstashToken) return;

  const target = "https://cortex-five-hazel.vercel.app/api/reflect";
  try {
    await fetch(`${qstashUrl}/v2/publish/${encodeURIComponent(target)}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${qstashToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ userId, buf, mem }),
    });
  } catch (e) {
    console.warn("[memory] triggerReflect falhou:", e.message);
  }
}

// ── RAG CLIENT METHODS (F5-01) ───────────────────────────────

export async function upsertMemory(userId, content, metadata = {}) {
  const res = await fetch('/api/memory/upsert', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ user_id: userId, content, metadata }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`RAG upsert falhou: ${err}`);
  }
  return res.json();
}

export async function queryMemories(userId, query, threshold = 0.5, limit = 3) {
  const res = await fetch('/api/memory/query', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ user_id: userId, query, threshold, limit }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`RAG query falhou: ${err}`);
  }
  return res.json();
}

export async function deleteMemory(userId, id = null) {
  const res = await fetch('/api/memory/delete', {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ user_id: userId, id }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`RAG delete falhou: ${err}`);
  }
  return res.json();
}

export async function getMemoryStats(userId) {
  const res = await fetch(`/api/memory/stats?user_id=${encodeURIComponent(userId)}`, {
    method: 'GET',
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`RAG stats falhou: ${err}`);
  }
  return res.json();
}
