import sanitize from "../middleware/sanitize.js";

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const PROD_ORIGIN = "https://cortex-digital.vercel.app";
const RATE_LIMIT_WINDOW_MS = 60 * 1000;
const RATE_LIMIT_MAX_REQUESTS = 20;

const rateLimitChat = new Map();

const FREE_FALLBACKS = [
  "google/gemma-3-4b-it:free",
  "google/gemma-3n-e4b-it:free",
  "liquid/lfm-2.5-1.2b-instruct:free",
  "openai/gpt-oss-120b:free",
  "nvidia/nemotron-3-nano-30b-a3b:free",
];

async function lerJsonSeguro(resposta) {
  const texto = await resposta.text().catch(() => "");
  if (!texto.trim()) return {};
  try {
    return JSON.parse(texto);
  } catch {
    return { error: `Resposta não-JSON HTTP ${resposta.status}` };
  }
}

function erroTexto(erro) {
  if (!erro) return "";
  if (typeof erro === "string") return erro;
  return erro.message || JSON.stringify(erro);
}

function obterIp(req) {
  const forwarded = req.headers?.["x-forwarded-for"] || req.headers?.["x-real-ip"];
  if (Array.isArray(forwarded)) return forwarded[0]?.split(",")[0]?.trim() || "desconhecido";
  if (typeof forwarded === "string" && forwarded.trim()) return forwarded.split(",")[0].trim();
  return req.socket?.remoteAddress || req.connection?.remoteAddress || "desconhecido";
}

export function limparRateLimitChat() {
  rateLimitChat.clear();
}

export function verificarRateLimitChat(req, agora = Date.now()) {
  const ip = obterIp(req);
  const actual = rateLimitChat.get(ip);

  // Janela fixa simples por IP; suficiente para proteger o gateway serverless.
  if (!actual || actual.resetAt <= agora) {
    rateLimitChat.set(ip, { count: 1, resetAt: agora + RATE_LIMIT_WINDOW_MS });
    return { permitido: true };
  }

  if (actual.count >= RATE_LIMIT_MAX_REQUESTS) {
    return { permitido: false };
  }

  actual.count += 1;
  rateLimitChat.set(ip, actual);
  return { permitido: true };
}

export default async function handler(req, res) {
  // Segurança: Sanitize input
  let nextCalled = false;
  sanitize(req, res, () => {
    nextCalled = true;
  });
  if (!nextCalled) return;

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Método não permitido" });
  }

  const limite = verificarRateLimitChat(req);
  if (!limite.permitido) {
    return res.status(429).json({ error: "Demasiados pedidos. Aguarda 1 minuto." });
  }

  const { model, messages, system, max_tokens, plugins, response_format } = req.body || {};
  const apiKey = process.env.OPENROUTER_API_KEY || process.env.VITE_OPENROUTER_API_KEY;

  if (!apiKey) {
    return res.status(500).json({ error: "OPENROUTER_API_KEY não configurada no Vercel" });
  }

  if (typeof model !== "string" || !model.trim() || !Array.isArray(messages)) {
    return res.status(400).json({ error: "Campos obrigatórios: model, messages" });
  }

  const payload = {
    max_tokens: max_tokens || 420,
    messages: system ? [{ role: "system", content: system, _injected: true }, ...messages] : messages,
    plugins: plugins || undefined,
    response_format: response_format || undefined,
  };

  const modelos = model.endsWith(":free")
    ? [model, ...FREE_FALLBACKS.filter((m) => m !== model)]
    : [model];

  let ultimoErro = null;
  let ultimoStatus = 502;

  try {
    for (const modeloAtual of modelos) {
      const isStream = req.body.stream === true;
      const upstream = await fetch(OPENROUTER_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
          "HTTP-Referer": PROD_ORIGIN,
          "X-Title": "Córtex Digital",
        },
        body: JSON.stringify({ 
          ...payload, 
          model: modeloAtual,
          stream: isStream 
        }),
      });

      if (upstream.ok) {
        if (isStream) {
          res.setHeader("Content-Type", "text/event-stream");
          res.setHeader("Cache-Control", "no-cache");
          res.setHeader("Connection", "keep-alive");
          
          const reader = upstream.body.getReader();
          
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            res.write(value);
          }
          return res.end();
        } else {
          const dados = await lerJsonSeguro(upstream);
          if (dados.choices?.[0]) {
            return res.status(200).json(dados);
          }
          ultimoErro = dados;
        }
      } else {
        ultimoStatus = upstream.status;
        ultimoErro = await lerJsonSeguro(upstream);
      }
    }

    return res.status(ultimoStatus).json({
      error: "OpenRouter devolveu erro",
      status: ultimoStatus,
      detail: erroTexto(ultimoErro?.error || ultimoErro),
    });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
