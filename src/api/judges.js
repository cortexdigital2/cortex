export const TODOS_JUIZES = [
  {
    id: "factual",
    nome: "Juiz Factual",
    emoji: "⚖️",
    systemPrompt: `És um verificador de factos interno. Sem introduções.
Lê as respostas dos lobos e lista apenas:
- Contradições internas entre lobos
- Afirmações implausíveis ou sem suporte lógico
- Dados que parecem desactualizados com base no contexto
Não tentes verificar factos externos — avalia só o que os lobos afirmaram.
Se não há problemas: "Sem problemas detectados."
Devolve APENAS JSON sem markdown:
{ "score": 0.0, "problemas": [], "validados": [], "recomendacao": "" }`,
  },
  {
    id: "tecnico",
    nome: "Juiz Técnico",
    emoji: "🔬",
    systemPrompt: `És um engenheiro sénior especialista em React 18, JSX, Node.js 20, Vercel Serverless.
Avalia código e soluções técnicas. Cita o lobe específico onde encontras cada problema.
Identifica: bugs, vulnerabilidades (ex: keys expostas), más práticas, ineficiências.
Se o conteúdo não for técnico: "Pergunta não técnica — avaliação não aplicável."
Devolve APENAS JSON sem markdown:
{ "score": 0.0, "problemas": [], "validados": [], "recomendacao": "" }`,
  },
  {
    id: "relevancia",
    nome: "Juiz de Relevância",
    emoji: "🎯",
    systemPrompt: `Pergunta única: cada lobe responde mesmo ao que foi perguntado?
Para cada lobe: Sim / Parcialmente / Não — com uma frase de justificação.
Penaliza: desvios de tópico, respostas vagas, generalidades sem aplicação.
Devolve APENAS JSON sem markdown:
{ "score": 0.0, "problemas": [], "validados": [], "recomendacao": "" }`,
  },
  {
    id: "coerencia",
    nome: "Juiz de Coerência",
    emoji: "🧠",
    systemPrompt: `Analisa a consistência lógica entre as respostas dos lobos.
Passo a passo:
1. Posição central de cada lobe em uma frase
2. Onde concordam e onde divergem
3. Contradições directas, saltos lógicos, premissas incompatíveis
4. Lobos mais internamente consistentes e porquê
Devolve APENAS JSON sem markdown:
{ "score": 0.0, "problemas": [], "validados": [], "recomendacao": "" }`,
  },
  {
    id: "historico",
    nome: "Juiz Histórico",
    emoji: "📅",
    systemPrompt: `Compara a resposta actual de cada lobe com as suas respostas anteriores nesta sessão.
Detecta: contradições entre turnos, deriva de posição, inconsistências que sugerem alucinação sistemática.
Se é o primeiro turno: "Sem histórico para comparar."
Devolve APENAS JSON sem markdown:
{ "score": 0.0, "problemas": [], "validados": [], "recomendacao": "" }`,
  },
];

const cacheJuizes = new Map();
const CACHE_TTL = 10 * 60 * 1000;
const JUDGE_TIMEOUT_MS = 25000;

function textoDoLobe(lobe) {
  if (!lobe) return "";
  if (typeof lobe === "string") return lobe;
  return lobe.resultado || lobe.result || lobe.content || "";
}

function normalizarScore(score) {
  const n = Number(score);
  if (!Number.isFinite(n)) return 0;
  const decimal = n > 1 ? n / 100 : n;
  return Math.max(0, Math.min(1, decimal));
}

function garantirArray(valor) {
  if (Array.isArray(valor)) return valor.filter(Boolean).map(String);
  if (typeof valor === "string" && valor.trim()) return [valor.trim()];
  return [];
}

function formatarRespostasLobos(respostasLobos) {
  if (typeof respostasLobos === "string") return respostasLobos;
  if (!Array.isArray(respostasLobos)) return "";

  return respostasLobos
    .map((lobe, idx) => {
      const nome = lobe.label || lobe.nome || lobe.id || `Lobe ${idx + 1}`;
      return `[${nome}]\n${textoDoLobe(lobe)}`;
    })
    .join("\n\n---\n\n");
}

function tokenizar(texto) {
  return String(texto)
    .toLowerCase()
    .split(/\W+/)
    .filter((w) => w.length > 3);
}

function vectorizar(texto) {
  const vetor = {};
  tokenizar(texto).forEach((token) => {
    vetor[token] = (vetor[token] || 0) + 1;
  });
  return vetor;
}

function cosineSimilarity(a, b) {
  const vocab = new Set([...Object.keys(a), ...Object.keys(b)]);
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  vocab.forEach((word) => {
    const va = a[word] || 0;
    const vb = b[word] || 0;
    dotProduct += va * vb;
    normA += va * va;
    normB += vb * vb;
  });

  return normA && normB ? dotProduct / (Math.sqrt(normA) * Math.sqrt(normB)) : 0;
}

export function calcularConsensoMatematico(respostasLobos = []) {
  const textos = (Array.isArray(respostasLobos) ? respostasLobos : [])
    .map(textoDoLobe)
    .filter((texto) => texto.trim().length > 0);

  const vetores = textos.map(vectorizar);
  let somaSim = 0;
  let pares = 0;

  for (let i = 0; i < vetores.length; i++) {
    for (let j = i + 1; j < vetores.length; j++) {
      somaSim += cosineSimilarity(vetores[i], vetores[j]);
      pares++;
    }
  }

  return pares > 0 ? Number((somaSim / pares).toFixed(6)) : 0;
}

export function hashRespostas(valor) {
  const texto = typeof valor === "string" ? valor : JSON.stringify(valor || "");
  let hash = 2166136261;

  for (let i = 0; i < texto.length; i++) {
    hash ^= texto.charCodeAt(i);
    hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
  }

  return (hash >>> 0).toString(36).slice(0, 32);
}

function extrairJson(texto) {
  if (!texto || typeof texto !== "string") return null;

  try {
    return JSON.parse(texto);
  } catch {
    const match = texto.match(/\{[\s\S]*\}/);
    if (!match) return null;
    try {
      return JSON.parse(match[0]);
    } catch {
      return null;
    }
  }
}

async function lerJsonResposta(resposta) {
  // Evita expor erros brutos do browser quando /api/chat devolve vazio ou HTML.
  if (typeof resposta.text === "function") {
    const texto = await resposta.text();
    if (!texto.trim()) throw new Error("Resposta vazia do proxy /api/chat");
    try {
      return JSON.parse(texto);
    } catch {
      throw new Error("JSON inválido do proxy /api/chat");
    }
  }

  try {
    return await resposta.json();
  } catch {
    throw new Error("JSON inválido ou resposta vazia do proxy /api/chat");
  }
}

function normalizarResultadoJuiz(resultado) {
  return {
    score: normalizarScore(resultado?.score),
    problemas: garantirArray(resultado?.problemas),
    validados: garantirArray(resultado?.validados),
    recomendacao:
      typeof resultado?.recomendacao === "string" ? resultado.recomendacao : "",
  };
}

function criarSignalComTimeout(signalExterno, timeoutMs) {
  const ctrl = new AbortController();
  const abortar = () => ctrl.abort();
  const timer = setTimeout(abortar, timeoutMs);

  if (signalExterno) {
    if (signalExterno.aborted) ctrl.abort();
    else signalExterno.addEventListener("abort", abortar, { once: true });
  }

  return {
    signal: ctrl.signal,
    limpar() {
      clearTimeout(timer);
      signalExterno?.removeEventListener?.("abort", abortar);
    },
  };
}

async function chamarJuizComCache(juiz, pergunta, respostasLobos, signalExterno) {
  const respostasFormatadas = formatarRespostasLobos(respostasLobos);
  const chave = `${juiz.id}-${hashRespostas({ pergunta, respostas: respostasFormatadas })}`;
  const cached = cacheJuizes.get(chave);

  if (cached && Date.now() - cached.t < CACHE_TTL) {
    return { ...cached.valor, cache: true };
  }

  const timeout = criarSignalComTimeout(signalExterno, JUDGE_TIMEOUT_MS);

  try {
    const resposta = await fetch("/api/chat", {
      method: "POST",
      signal: timeout.signal,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemma-4-31b-it:free",
        system: juiz.systemPrompt,
        messages: [
          {
            role: "user",
            content: `Pergunta original: ${pergunta}\n\nRespostas dos lobos:\n${respostasFormatadas}`,
          },
        ],
        max_tokens: 400,
      }),
    });

    const dados = await lerJsonResposta(resposta);
    if (!resposta.ok || dados.error) throw new Error(dados.error || `HTTP ${resposta.status}`);

    const content = dados.choices?.[0]?.message?.content || dados.content || "";
    const parseado = extrairJson(content);
    if (!parseado) throw new Error("JSON não encontrado na resposta");

    const entrada = {
      juiz: juiz.id,
      emoji: juiz.emoji,
      nome: juiz.nome,
      resultado: normalizarResultadoJuiz(parseado),
      sucesso: true,
    };

    cacheJuizes.set(chave, { valor: entrada, t: Date.now() });
    return entrada;
  } catch (err) {
    if (err.name === "AbortError") return null;

    return {
      juiz: juiz.id,
      emoji: juiz.emoji,
      nome: juiz.nome,
      resultado: {
        score: 0,
        problemas: [`Erro: ${err.message}`],
        validados: [],
        recomendacao: "ignorar",
      },
      sucesso: false,
      erro: err.message,
    };
  } finally {
    timeout.limpar();
  }
}

export async function runJudges(
  pergunta,
  respostasLobos,
  juizesActivos,
  abortSignal,
  onJuizCompleto,
) {
  const activos = Array.isArray(juizesActivos) ? juizesActivos : [];
  const juizesParaCorrer = TODOS_JUIZES.filter((juiz) => activos.includes(juiz.id));

  const promessas = juizesParaCorrer.map((juiz) =>
    chamarJuizComCache(juiz, pergunta, respostasLobos, abortSignal).then((resultado) => {
      if (resultado && onJuizCompleto) onJuizCompleto(resultado);
      return resultado;
    }),
  );

  const resultados = await Promise.allSettled(promessas);
  return resultados
    .filter((r) => r.status === "fulfilled" && r.value !== null)
    .map((r) => r.value);
}

export function limparCacheJuizes() {
  cacheJuizes.clear();
}
