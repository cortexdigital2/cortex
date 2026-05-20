// Pesquisa web em tempo real via Tavily.
// O browser chama apenas o endpoint serverless para não expor a chave.

const MAX_RESULTS = 3;

export function normalizarTavilyResults(results = []) {
  if (!Array.isArray(results)) return [];
  return results
    .map((r) => ({
      title: String(r?.title || "").trim(),
      url: String(r?.url || "").trim(),
      content: String(r?.content || "").replace(/\s+/g, " ").trim(),
    }))
    .filter((r) => r.title && r.url);
}

export async function tavilySearch(query, opts = {}) {
  try {
    const res = await fetch("/api/tavily", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        query,
        maxResults: opts.maxResults ?? MAX_RESULTS,
      }),
    });
    if (!res.ok) return { results: [] };
    const data = await res.json().catch(() => ({ results: [] }));
    return { results: normalizarTavilyResults(data.results) };
  } catch {
    return { results: [] };
  }
}

// Formata resultados para injetar no prompt de um lobo
export function formatTavilyContext(data) {
  const results = normalizarTavilyResults(data?.results);
  if (!results.length) return "";
  const lines = results
    .slice(0, 3)
    .map((r) => `- ${r.title}: ${r.content.slice(0, 200)}\n  ${r.url}`);
  return `[Fontes Web Verificadas]\n${lines.join("\n")}`;
}
