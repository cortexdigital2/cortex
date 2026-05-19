function normalizarScore(score, fallback = 0.5) {
  const n = Number(score);
  if (!Number.isFinite(n)) return fallback;
  const decimal = n > 1 ? n / 100 : n;
  return Math.max(0, Math.min(1, decimal));
}

function garantirSugestoes(suggestions) {
  const base = Array.isArray(suggestions) ? suggestions.filter(Boolean).map(String).slice(0, 3) : [];
  while (base.length < 3) {
    base.push(["Aprofunda isto", "Mostra exemplos", "Resume a decisão"][base.length]);
  }
  return base;
}

const PLACEHOLDER_REI_RE = /\[(?:Lobe X|Juiz Y|Nome do Juiz|elemento|Nome do Lobe)\]/i;

const JUIZ_REI = {
  modelo: "meta-llama/llama-3.3-70b-instruct:free",
  provider: "openrouter",
};

function temPlaceholderDoPrompt(texto) {
  return PLACEHOLDER_REI_RE.test(String(texto || ""));
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
  // Evita mensagens técnicas do browser quando /api/chat devolve vazio ou HTML.
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

function textoDoLobe(lobe) {
  if (!lobe) return "";
  if (typeof lobe === "string") return lobe;
  if (lobe.ronda1 || lobe.ronda2) {
    return [`Ronda 1: ${lobe.ronda1 || "sem resposta"}`, `Ronda 2: ${lobe.ronda2 || lobe.result || "sem resposta"}`].join("\n");
  }
  return lobe.resultado || lobe.result || lobe.content || "";
}

function nomeDoLobe(lobe, idx) {
  return lobe?.label || lobe?.nome || lobe?.id || `Lobe ${idx + 1}`;
}

function excerto(texto, max = 220) {
  const limpo = String(texto || "").replace(/\s+/g, " ").trim();
  if (limpo.length <= max) return limpo;
  return `${limpo.slice(0, max).trim()}...`;
}

function lobosValidos(respostasLobos) {
  return (Array.isArray(respostasLobos) ? respostasLobos : [])
    .map((lobe, idx) => ({
      nome: nomeDoLobe(lobe, idx),
      texto: textoDoLobe(lobe),
    }))
    .filter((lobe) => lobe.texto.trim().length > 0);
}

function juizesComSucesso(veredictoJuizes) {
  return (Array.isArray(veredictoJuizes) ? veredictoJuizes : []).filter((j) => j.sucesso);
}

function criarRaciocinioSeguro(respostasLobos, veredictoJuizes, consensoMatematico) {
  const lobos = lobosValidos(respostasLobos).map((lobe) => lobe.nome).slice(0, 3);
  const juizes = juizesComSucesso(veredictoJuizes).map((juiz) => juiz.nome).slice(0, 3);
  const consenso = Math.round(normalizarScore(consensoMatematico, 0) * 100);

  return [
    lobos.length
      ? `Comparei as respostas de ${lobos.join(", ")}.`
      : "Não houve respostas úteis dos lobos para comparar.",
    juizes.length
      ? `Usei ${juizes.join(", ")} como validação adicional.`
      : "Sem juízes válidos; usei o consenso matemático como sinal principal.",
    `Consenso matemático entre lobos: ${consenso}%.`,
  ];
}

function criarVeredictoSeguro(respostasLobos, veredictoJuizes, consensoMatematico) {
  const lobos = lobosValidos(respostasLobos);
  const juizes = juizesComSucesso(veredictoJuizes);
  const citacoesLobos = lobos.slice(0, 2).map((lobe) => `[${lobe.nome}]`).join(" e ");
  const juizPrincipal = juizes[0] ? `[${juizes[0].nome}]` : null;
  const validado = juizes.flatMap((j) => j.resultado?.validados || []).find(Boolean);
  const problema = juizes.flatMap((j) => j.resultado?.problemas || []).find(Boolean);
  const recomendacao = juizes.map((j) => j.resultado?.recomendacao).find(Boolean);
  const baseLobos = lobos.slice(0, 2).map((lobe) => excerto(lobe.texto)).filter(Boolean).join(" ");
  const consenso = Math.round(normalizarScore(consensoMatematico, 0) * 100);

  if (!baseLobos) {
    return `Não tenho respostas úteis dos lobos para formar um veredicto fiável. Consenso matemático: ${consenso}%.`;
  }

  const partes = [
    `${citacoesLobos || "Os lobos"} indicam: ${baseLobos}`,
    juizPrincipal && validado ? `${juizPrincipal} validou: ${validado}` : null,
    problema ? `Atenção: ${problema}` : null,
    recomendacao ? `Recomendação: ${recomendacao}` : null,
  ].filter(Boolean);

  return partes.join(" ");
}

export function calcularConfiancaFinal(scoreConsenso, scoreJuizes, divergenciaEntreCamadas) {
  const base = (normalizarScore(scoreConsenso, 0) * 0.3 + normalizarScore(scoreJuizes) * 0.7) * 100;
  const penalizacao = divergenciaEntreCamadas > 0.3 ? 15 : 0;
  return Math.max(0, Math.min(100, Math.round(base - penalizacao)));
}

export function formatarContextoRei(pergunta, respostasLobos, veredictoJuizes, consensoMatematico) {
  // Compacta o input do Rei para reduzir custo sem perder os sinais essenciais.
  const resumoJuizes = (Array.isArray(veredictoJuizes) ? veredictoJuizes : [])
    .filter((j) => j.sucesso)
    .map((j) => {
      const r = j.resultado || {};
      const problemas = r.problemas?.length ? r.problemas.join("; ") : "Nenhum";
      return `${j.emoji} ${j.nome} | Score: ${(normalizarScore(r.score, 0) * 100).toFixed(
        0,
      )}% | Problemas: ${problemas} | Rec: ${r.recomendacao || "—"}`;
    })
    .join("\n");

  const lobosFormatados = Array.isArray(respostasLobos)
    ? respostasLobos
        .map((lobe, idx) => `[${nomeDoLobe(lobe, idx)}]: ${textoDoLobe(lobe).slice(0, 500)}`)
        .join("\n\n")
    : String(respostasLobos || "");

  const planning = `PLANNING:
- Lobos válidos: ${lobosValidos(respostasLobos).map(l=>l.nome).join(', ')}
- Consenso: ${(normalizarScore(consensoMatematico,0)*100).toFixed(0)}%
- Dissent: ${lobosValidos(respostasLobos).length>=2 ? 'verificar' : 'insuficiente'}
- Acção: ${normalizarScore(consensoMatematico,0)>=0.8 ? 'sintetizar directo' : 'resolver conflitos primeiro'}`;

  return `${planning}

PERGUNTA: ${pergunta}

CONSENSO MATEMÁTICO ENTRE LOBOS: ${(normalizarScore(consensoMatematico, 0) * 100).toFixed(0)}%

RESUMO DOS LOBOS:
${lobosFormatados}

RESUMO DOS JUÍZES:
${resumoJuizes || "Nenhum juiz correu com sucesso."}`;
}

export const SYSTEM_REI = `<role>Rei do Córtex Digital</role>
<mission>O teu veredicto é a palavra final. Agrega as respostas dos 5 lobos e juízes para uma decisão coesa e inquestionável.</mission>
<process>
0. Lê PLANNING e confirma lobos disponíveis antes de sintetizar.
1. Indica quais lobos têm mais suporte dos juízes.
2. Identifica contradições críticas.
3. Decide quais informações usar e justifica em frases curtas.
4. Sintetiza a resposta final.
</process>
<rules>
- Cita inline [Nome do Lobe] e [Nome do Juiz] usando APENAS nomes reais recebidos. Nunca uses placeholders.
- Nunca ignores problemas identificados por 2 ou mais juízes.
- Usa APENAS texto em PT-PT natural, directo e sem jargão.
- Admite explicitamente incerteza ('não sei com confiança') quando o consenso for inferior a 40%.
- Termina sempre o teu ciclo cognitivo a devolver as 3 sugestões em tom conversacional.
</rules>

Devolve APENAS o seguinte JSON (sem formatação markdown envolvente):
<json_schema>
{
  "raciocinio": ["síntese curta baseada nos nomes reais recebidos"],
  "planning_summary": "1 frase: lobos usados + acção tomada",
  "veredicto": "resposta final com citações inline usando apenas nomes reais do contexto",
  "confianca_lobos": 0,
  "confianca_juizes": 0,
  "confianca_final": 0,
  "admite_incerteza": false,
  "razao_incerteza": null,
  "suggestions": ["sugestão 1", "sugestão 2", "sugestão 3"]
}
</json_schema>`;

function scoreMedioJuizes(veredictoJuizes) {
  const juizesSucesso = (Array.isArray(veredictoJuizes) ? veredictoJuizes : []).filter(
    (j) => j.sucesso && typeof j.resultado?.score === "number",
  );

  return juizesSucesso.length
    ? juizesSucesso.reduce((acc, j) => acc + normalizarScore(j.resultado.score, 0), 0) /
        juizesSucesso.length
    : 0.5;
}

function normalizarResultadoRei(parseado, consensoMatematico, scoreJuizesMedio, respostasLobos, veredictoJuizes) {
  const consenso = normalizarScore(consensoMatematico, 0);
  const juizes = normalizarScore(scoreJuizesMedio);
  const divergencia = Math.abs(consenso - juizes);
  const confiancaFinal = calcularConfiancaFinal(consenso, juizes, divergencia);
  const raciocinioRecebido = Array.isArray(parseado?.raciocinio)
    ? parseado.raciocinio.filter(Boolean).map(String).filter((item) => !temPlaceholderDoPrompt(item))
    : [];
  const veredictoRecebido = String(parseado?.veredicto || "").trim();
  const veredictoSeguro = veredictoRecebido && !temPlaceholderDoPrompt(veredictoRecebido)
    ? veredictoRecebido
    : criarVeredictoSeguro(respostasLobos, veredictoJuizes, consensoMatematico);

  return {
    raciocinio: raciocinioRecebido.length
      ? raciocinioRecebido
      : criarRaciocinioSeguro(respostasLobos, veredictoJuizes, consensoMatematico),
    veredicto: veredictoSeguro,
    confianca_lobos: Math.round(consenso * 100),
    confianca_juizes: Math.round(juizes * 100),
    confianca_final: confiancaFinal,
    admite_incerteza:
      confiancaFinal < 40 ? true : Boolean(parseado?.admite_incerteza),
    razao_incerteza:
      confiancaFinal < 40
        ? parseado?.razao_incerteza || "Confiança final abaixo de 40%."
        : parseado?.razao_incerteza || null,
    suggestions: garantirSugestoes(parseado?.suggestions),
    planning_summary: typeof parseado?.planning_summary === 'string'
      ? parseado.planning_summary.trim()
      : null,
  };
}

// FALLBACK PAGO — só em falha do Rei principal.
// Fusion usa Claude Opus + GPT internamente; activa apenas quando Llama 3.3 falha ou devolve vazio.
const JUIZ_FALLBACK = {
  modelo: "nousresearch/hermes-3-llama-3.1-405b:free",
  provider: "openrouter",
};

async function chamarModeloRei(modelo, contexto, abortSignal, options = {}) {
  // response-healing corrige JSON malformado automaticamente (OpenRouter plugin).
  // NÃO adicionar stream:true — response-healing exige non-streaming.
  
  // Trunca e constrói o histórico se existirem mensagens prévias
  const messages = options.messages || [];
  const payloadMessages = [
    ...messages,
    { role: "user", content: contexto }
  ];

  const resposta = await fetch("/api/chat", {
    method: "POST",
    signal: abortSignal,
    headers: {
      "Content-Type": "application/json",
      "X-OpenRouter-Cache": "true",
      "X-OpenRouter-Cache-TTL": "600",
    },
    body: JSON.stringify({
      model: modelo,
      system: SYSTEM_REI,
      messages: payloadMessages,
      plugins: [{ id: "response-healing" }],
      response_format: { type: "json_object" },
      max_tokens: 1500,
    }),
  });

  const dados = await lerJsonResposta(resposta);
  const cacheStatus = resposta.headers?.get("X-OpenRouter-Cache-Status");
  if (cacheStatus) console.log(`[Cache] Rei (${modelo}): ${cacheStatus}`);

  if (!resposta.ok || dados.error) throw new Error(dados.error || `HTTP ${resposta.status}`);

  const textoRei = dados.choices?.[0]?.message?.content || dados.content || "";
  const parseado = extrairJson(textoRei);
  if (!parseado) throw new Error("Rei não devolveu JSON válido");
  return parseado;
}

export async function runKing(
  pergunta,
  respostasLobos,
  veredictoJuizes,
  consensoMatematico,
  abortSignal,
  options = {},
) {
  try {
    const contexto = formatarContextoRei(
      pergunta,
      respostasLobos,
      veredictoJuizes,
      consensoMatematico,
    );
    const scoreJuizesMedio = scoreMedioJuizes(veredictoJuizes);

    let parseado;
    try {
      parseado = await chamarModeloRei(JUIZ_REI.modelo, contexto, abortSignal, options);
    } catch (errPrimario) {
      if (errPrimario.name === "AbortError") throw errPrimario;
      // FALLBACK PAGO — só em falha do modelo principal.
      parseado = await chamarModeloRei(JUIZ_FALLBACK.modelo, contexto, abortSignal, options);
    }

    return normalizarResultadoRei(
      parseado,
      consensoMatematico,
      scoreJuizesMedio,
      respostasLobos,
      veredictoJuizes,
    );
  } catch (err) {
    if (err.name === "AbortError") return null;

    // Modo degradado gracioso: a UX continua mesmo sem juízes/Rei.
    return {
      raciocinio: ["Juízes indisponíveis — síntese directa dos lobos."],
      veredicto:
        "Modo simplificado: painel de juízes indisponível. Resposta baseada directamente nos lobos.",
      confianca_lobos: Math.round(normalizarScore(consensoMatematico, 0) * 100),
      confianca_juizes: null,
      confianca_final: Math.round(normalizarScore(consensoMatematico, 0) * 60),
      admite_incerteza: true,
      razao_incerteza: `Erro no Rei: ${err.message}`,
      suggestions: ["Tenta reformular a pergunta", "Reporta o erro", "Continua sem juízes"],
      modo_degradado: true,
    };
  }
}
