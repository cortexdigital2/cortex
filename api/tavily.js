const TAVILY_URL = "https://api.tavily.com/search";
const TAVILY_TIMEOUT_MS = 5000;

function respostaVazia(res) {
  return res.status(200).json({ results: [] });
}

function maxResultados(valor) {
  const numero = Number(valor);
  if (!Number.isFinite(numero)) return 3;
  return Math.max(1, Math.min(10, Math.round(numero)));
}

function normalizarResultados(dados) {
  if (!Array.isArray(dados?.results)) return [];
  return dados.results
    .map((item) => ({
      title: String(item?.title || "").trim(),
      url: String(item?.url || "").trim(),
      content: String(item?.content || "").trim(),
    }))
    .filter((item) => item.title && item.url);
}

async function fetchComTimeout(url, options) {
  const ctrl = new AbortController();
  const timeout = setTimeout(() => ctrl.abort(), TAVILY_TIMEOUT_MS);

  try {
    return await fetch(url, { ...options, signal: ctrl.signal });
  } finally {
    clearTimeout(timeout);
  }
}

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") return respostaVazia(res);

    const apiKey = process.env.TAVILY_API_KEY;
    const query = String(req.body?.query || "").trim();
    if (!apiKey || !query) return respostaVazia(res);

    const resposta = await fetchComTimeout(TAVILY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        api_key: apiKey,
        query,
        search_depth: "basic",
        max_results: maxResultados(req.body?.maxResults),
      }),
    });

    if (!resposta.ok) return respostaVazia(res);

    const dados = await resposta.json().catch(() => ({}));
    return res.status(200).json({ results: normalizarResultados(dados) });
  } catch {
    // Tavily é opcional: falhas de rede ou timeout nunca quebram o chat.
    return respostaVazia(res);
  }
}
