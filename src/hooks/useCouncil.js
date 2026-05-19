import { useCallback, useEffect, useRef, useState } from "react";
import { callOpenRouter, OR_MODELS } from "../lib/openrouter.js";
import { calcularConsensoMatematico, runJudges } from "../api/judges.js";
import { runKing } from "../api/king.js";
import {
  LOBOS,
  construirSystemPromptOmega,
  runDagCognitivo,
  runDebate as runDebateApi,
  runDebateStream as runDebateStreamApi,
  precisaAprovacao,
  gerarMensagemAprovacao,
} from "../api/council.js";
import { runGraders } from "../utils/graders.js";
import { getJuizesParaPergunta } from "../utils/orchestrator.js";
import { detectFrustration } from "../utils/detectFrustration.js";
import { classifyError } from "../utils/errorMessages.js";
import { GENERATION_STATES } from "../utils/generationStates.js";
import { trimHistory, HISTORY_LIMIT } from "../utils/trimHistory.js";
import { queryMemories } from "../lib/memory.js";
import {
  buildMemoryEntry,
  saveMemoryEntry,
  getLastSessionContext,
  getLastSessionContextFromSupabase,
} from "../utils/sessionMemory.js";

// Cache curta de respostas dos lobos para evitar chamadas repetidas.
const responseCache = new Map();
const CACHE_TTL = 5 * 60 * 1000;

export const FASES_DAG = {
  OCIOSO: "ocioso",
  GERACAO: "geracao",
  CRITICA: "critica",
  SINTESE: "sintese",
};

function cacheGet(id, q) {
  const k = id + "::" + q;
  const c = responseCache.get(k);
  if (c && Date.now() - c.t < CACHE_TTL) return c.v;
  return null;
}

function cacheSet(id, q, v) {
  responseCache.set(id + "::" + q, { v, t: Date.now() });
}

function upsertJudge(prev, next) {
  const idx = prev.findIndex((item) => item.juiz === next.juiz);
  if (idx === -1) return [...prev, next];
  return prev.map((item, i) => (i === idx ? next : item));
}

function dedupeJudges(judges) {
  const vistos = new Set();
  return judges.filter((judge) => {
    if (!judge?.juiz || vistos.has(judge.juiz)) return false;
    vistos.add(judge.juiz);
    return true;
  });
}

function fallbackDosLobos(lobes) {
  const validos = lobes.filter((l) => !l.isErr && l.result?.length > 10);
  const origem = validos.length ? validos : lobes;
  return origem.length
    ? origem.map((l) => `**${l.label}:** ${l.result}`).join("\n\n")
    : "Nenhum serviço respondeu. Verifica a ligação.";
}

function valorSettled(resultado, fallback = {}) {
  return resultado?.status === "fulfilled" ? resultado.value : fallback;
}

function erroSettled(resultado) {
  return resultado?.status === "rejected" ? resultado.reason?.message || "Serviço indisponível" : null;
}

function lobeDebateParaUI(lobe, index, ronda1, ronda2, ronda3, lobeConfidenceScore) {
  const primeira = valorSettled(ronda1?.[index], {});
  const segunda = valorSettled(ronda2?.[index], primeira);
  const terceira = valorSettled(ronda3?.[index], segunda);
  const erro = erroSettled(ronda3?.[index]) || erroSettled(ronda2?.[index]) || erroSettled(ronda1?.[index]);
  const result = erro ? `[Erro em ${lobe.nome}: ${erro}]` : terceira.resposta || segunda.resposta || primeira.resposta || "";
  const isErr = !!erro || !result || result.startsWith("[Erro");

  return {
    id: `debate-${lobe.id}`,
    streamId: lobe.id,
    label: lobe.nome,
    sub: lobe.provider,
    color: lobe.cor,
    icon: ["◉", "◈", "◐", "◑", "◒"][index] || "◌",
    _key: `debate-${lobe.id}-${index}`,
    result,
    ronda1: primeira.resposta || "",
    ronda2: segunda.resposta || "",
    ronda3: terceira.resposta || "",
    critique: {
      text: segunda.resposta || "",
      target: { 1: 2, 2: 3, 3: 4, 4: 5, 5: 1 }[lobe.id],
      from: { 1: 5, 2: 1, 3: 2, 4: 3, 5: 4 }[lobe.id]
    },
    srcModel: lobe.modelo,
    srcReal: !isErr,
    isErr,
    latency: terceira.latency || segunda.latency || primeira.latency || null,
    confidence: lobeConfidenceScore(result, isErr),
  };
}

function parseJsonSeguro(valor) {
  if (!valor || typeof valor !== "string") return null;
  try {
    return JSON.parse(valor);
  } catch {
    const match = valor.match(/\{[\s\S]*\}/);
    if (!match) return null;
    try {
      return JSON.parse(match[0]);
    } catch {
      return null;
    }
  }
}

function garantirTresChips(suggestions) {
  const base = Array.isArray(suggestions) ? suggestions.filter(Boolean).map(String).slice(0, 3) : [];
  for (const fallback of ["Aprofunda isto", "Mostra exemplos", "Resume a decisão"]) {
    if (base.length >= 3) break;
    if (!base.includes(fallback)) base.push(fallback);
  }
  return base;
}

function primeiroLoboValido(payloadOmega) {
  return (payloadOmega?.fase_alpha || []).find((item) => item?.sucesso && item?.lobo)?.lobo || "Lobe X";
}

function garantirCitacaoLobe(texto, payloadOmega) {
  const valor = String(texto || "").trim();
  if (/\[[^\]]+\]/.test(valor)) return valor;
  return `${valor || "Síntese concluída."} [${primeiroLoboValido(payloadOmega)}]`;
}

function lobeDagParaUI(lobe, index, faseAlpha = [], faseBeta = [], lobeConfidenceScore) {
  const alpha = faseAlpha.find((item) => item.lobo === lobe.nome);
  const betaComoRevisor = faseBeta.find((item) => item.lobo === lobe.nome);
  const erro = alpha?.sucesso === false ? alpha.conteudo || "Lobo indisponível" : null;
  const result = erro ? `[Erro em ${lobe.nome}: ${erro}]` : alpha?.conteudo || "";
  const isErr = Boolean(erro) || !result || result.startsWith("[Erro");

  return {
    id: `dag-${lobe.id}`,
    streamId: lobe.id,
    label: lobe.nome,
    sub: lobe.provider,
    color: lobe.cor,
    icon: ["◉", "◈", "◐", "◑", "◒"][index] || "◌",
    _key: `dag-${lobe.id}-${index}`,
    result,
    ronda1: alpha?.conteudo || "",
    ronda2: betaComoRevisor?.conteudo || "",
    ronda3: "",
    critique: {
      text: betaComoRevisor?.conteudo || "",
      targets: betaComoRevisor?.alvos_criticados || [],
      incoming: faseBeta
        .filter((item) => item.alvos_criticados?.includes(lobe.nome))
        .map((item) => ({ from: item.lobo, text: item.conteudo })),
    },
    srcModel: alpha?.modelo || lobe.modelo,
    srcReal: !isErr,
    isErr,
    latency: alpha?.telemetria?.tempo_ms || null,
    tokens: alpha?.telemetria?.total_tokens || null,
    confidence: lobeConfidenceScore(result, isErr),
  };
}

export async function invocarReiClaude({ pergunta, payloadOmega, callClaude, signal } = {}) {
  if (signal?.aborted) throw new DOMException("Operação cancelada", "AbortError");
  if (typeof callClaude !== "function") throw new Error("callClaude indisponível para a síntese Ómega");

  const system = construirSystemPromptOmega(payloadOmega?.fase_alpha || [], payloadOmega?.fase_beta || []);
  const bruto = await callClaude(system, JSON.stringify(payloadOmega, null, 2), 2200);
  if (signal?.aborted) throw new DOMException("Operação cancelada", "AbortError");

  const parseado = parseJsonSeguro(bruto) || { veredicto: String(bruto || "").trim() };
  const scoreConsenso = Number(payloadOmega?.conselho_metadata?.score_consenso_pct || 0);
  const confiancaFinal = Number.isFinite(Number(parseado.confianca_final))
    ? Math.max(0, Math.min(100, Math.round(Number(parseado.confianca_final))))
    : scoreConsenso;

  return {
    raciocinio: Array.isArray(parseado.raciocinio) ? parseado.raciocinio.filter(Boolean).map(String) : [],
    veredicto: garantirCitacaoLobe(parseado.veredicto || parseado.final || parseado.answer, payloadOmega),
    confianca_lobos: Number.isFinite(Number(parseado.confianca_lobos))
      ? Math.round(Number(parseado.confianca_lobos))
      : scoreConsenso,
    confianca_juizes: parseado.confianca_juizes ?? null,
    confianca_final: confiancaFinal,
    admite_incerteza: confiancaFinal < 40 ? true : Boolean(parseado.admite_incerteza),
    razao_incerteza: confiancaFinal < 40
      ? parseado.razao_incerteza || "Consenso preliminar inferior a 40%."
      : parseado.razao_incerteza || null,
    suggestions: garantirTresChips(parseado.suggestions || parseado.chips),
    planning_summary: parseado.planning_summary || `Síntese Ómega baseada em ${primeiroLoboValido(payloadOmega)}.`,
    pergunta,
  };
}

export async function runDebate(pergunta, modo = "paralelo", options = {}) {
  return runDebateApi(pergunta, modo, options);
}

export async function runDebateStream(pergunta, modo = "paralelo", options = {}) {
  return runDebateStreamApi(pergunta, modo, options);
}



export default function useCouncil(msgs, setMsgs) {
  const [phase, setPhase] = useState(FASES_DAG.OCIOSO);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationState, setGenerationState] = useState(GENERATION_STATES.IDLE);
  const [generationTime, setGenerationTime] = useState(0);
  const [lobeResults, setLobeResults] = useState([]);
  const [judgeResults, setJudgeResults] = useState([]);
  const [kingResult, setKingResult] = useState(null);
  const [gradersResult, setGradersResult] = useState(null);
  const [consensusScore, setConsensusScore] = useState(0);
  const [debateResult, setDebateResult] = useState(null);
  const [frustrationLevel, setFrustrationLevel] = useState("none");
  const abortControllerRef = useRef(null);
  const controllersRef = useRef(new Map());
  const stopRequestedRef = useRef(false);
  const partialTextRef = useRef({});
  const saveMsgsRef = useRef(null);
  const interruptedMessageAddedRef = useRef(false);

  useEffect(() => {
    const controllers = controllersRef.current;
    return () => {
      controllers.forEach((ctrl) => ctrl.abort());
      controllers.clear();
      abortControllerRef.current?.abort();
    };
  }, []);

  function textoParcialActual() {
    return Object.entries(partialTextRef.current)
      .map(([id, texto]) => `**Lobo ${id}:** ${texto}`)
      .filter((linha) => linha.trim().length > 12)
      .join("\n\n");
  }

  function adicionarMensagemInterrompida() {
    if (interruptedMessageAddedRef.current) return;
    interruptedMessageAddedRef.current = true;

    const textoParcial = textoParcialActual();
    const content = `${textoParcial ? `${textoParcial}\n\n` : ""}Geração interrompida.`;
    const msg = {
      id: Date.now() + Math.random(),
      role: "assistant",
      content,
      structured: { final: content },
      interrupted: true,
      councilDecision: "Geração interrompida pelo utilizador.",
    };

    setMsgs((prev) => {
      const actualizadas = [...prev, msg];
      saveMsgsRef.current?.(actualizadas);
      return actualizadas;
    });
  }

  function stopGeneration() {
    stopRequestedRef.current = true;
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    controllersRef.current.forEach((ctrl) => ctrl.abort());
    controllersRef.current.clear();
    adicionarMensagemInterrompida();
    setIsGenerating(false);
    setGenerationState(GENERATION_STATES.STOPPED);
    setPhase(FASES_DAG.OCIOSO);
  }

  function devePararGeracao() {
    return stopRequestedRef.current || abortControllerRef.current?.signal?.aborted;
  }

  const guardarMemoriaSessao = useCallback(async (historicoAnterior, conversationIdAnterior, userId) => {
    if (!Array.isArray(historicoAnterior) || historicoAnterior.length === 0) return;
    const temUtilizador = historicoAnterior.some((m) => m.role === "user");
    const temAssistente = historicoAnterior.some((m) => m.role === "assistant");
    if (!temUtilizador || !temAssistente) return;

    const entry = buildMemoryEntry(
      historicoAnterior,
      conversationIdAnterior || `sessao-${Date.now()}`
    );
    await saveMemoryEntry(userId, entry);
  }, []);

  async function invoke(id, sys, msg, ctx = {}) {
    const { toast, callOllama } = ctx;
    const ctrl = new AbortController();
    controllersRef.current.set(id, ctrl);

    const ok = (text, real = true, latency = null) => ({
      result: text,
      model: OR_MODELS[id] || id,
      real,
      latency,
    });

    try {
      const cached = cacheGet(id, msg);
      if (cached) return { ...cached, fromCache: true };

      if (id === "ollama_codigo") {
        try {
          const t0 = Date.now();
          const r = ok(await callOllama(sys, msg, "codigo", ctrl.signal), true, Date.now() - t0);
          cacheSet(id, msg, r);
          return r;
        } catch (e) {
          return ok("Ollama Código indisponível: " + e.message, false);
        }
      }

      if (id === "ollama_debug") {
        try {
          const t0 = Date.now();
          const r = ok(await callOllama(sys, msg, "debug", ctrl.signal), true, Date.now() - t0);
          cacheSet(id, msg, r);
          return r;
        } catch (e) {
          return ok("Ollama Debug indisponível: " + e.message, false);
        }
      }

      const t0 = Date.now();
      const text = await callOpenRouter(id, sys, msg, 420, 30000, { signal: ctrl.signal });
      const r = ok(text, true, Date.now() - t0);
      cacheSet(id, msg, r);
      return r;
    } catch (e) {
      if (e.name === "AbortError") {
        return { result: "Geração interrompida.", model: id, real: false };
      }
      const errMsg = e.message || "";
      const erro = classifyError(e);
      toast?.(`${id}: ${erro.mensagem} ${erro.accao}.`, "erro");
      const nomeLobe = LOBOS.find((lobe) => String(lobe.id) === String(id))?.nome || id;
      return { result: `[Erro em ${nomeLobe}: ${errMsg || "serviço indisponível"}]`, model: id, real: false };
    } finally {
      if (controllersRef.current.get(id) === ctrl) controllersRef.current.delete(id);
    }
  }

  async function send(query, ctx = {}) {
    const {
      input,
      setInput,
      classifyQuery,
      saveMsgs,
      compressContext,
      buf,
      setBuf,
      keys,
      buildMem,
      brain,
      selectUsedMem,
      routerDecide,
      LOBES,
      modelsOn,
      temperaturas,
      focusMode,
      focusLobes,
      P,
      callClaude,
      hC,
      hP,
      normalizeCouncilPayload,
      heuristicDecision,
      saveBrain,
      setBrain,
      safeParseReflect,
      MAX_BUF,
      MAX_SEMANTIC,
      MAX_PATTERNS,
      MAX_EPISODIC,
      toast,
      autoSaveConv,
      currentConvId,
      taRef,
      lobeConfidenceScore,
      modoDebate = "paralelo",
      runDebateStream = runDebateStreamApi,
      streaming,
      displayQuery,
      anexoUpload,
      imageDataUrl,
      systemPrompts,
      userId,
    } = ctx;

    const q = (query || input).trim();
    if (!q || phase !== FASES_DAG.OCIOSO) return;

    if (precisaAprovacao(q) && !ctx.options?.aprovado) {
      return gerarMensagemAprovacao(q);
    }

    abortControllerRef.current = new AbortController();
    stopRequestedRef.current = false;
    partialTextRef.current = {};
    interruptedMessageAddedRef.current = false;
    saveMsgsRef.current = saveMsgs;
    setIsGenerating(true);
    setGenerationState(GENERATION_STATES.THINKING);
    setGenerationTime(0);
    const startTime = Date.now();

    setJudgeResults([]);
    setKingResult(null);
    setGradersResult(null);
    setConsensusScore(0);
    setDebateResult(null);

    const complexityLevel = classifyQuery(q);
    setInput("");
    const uMsg = {
      id: Date.now() + Math.random(),
      role: "user",
      content: displayQuery || q,
      complexity: complexityLevel,
      anexo: anexoUpload || null,
    };
    const nm = [...msgs, uMsg];
    setMsgs(nm);
    saveMsgs(nm);

    // Trunca o histórico enviado ao modelo (preserva estado local completo)
    const messagesParaEnviar = trimHistory(nm, HISTORY_LIMIT);

    // RAG: Recuperação automática de contexto semântico do Supabase
    let ragContext = "";
    if (userId && userId !== "anon") {
      try {
        const ragHits = await queryMemories(userId, q, 0.45, 3);
        if (ragHits && ragHits.length > 0) {
          ragContext = ragHits
            .map((hit) => `- [Semelhança: ${Math.round(hit.similarity * 100)}%]: "${hit.content}"`)
            .join("\n");
        }
      } catch (e) {
        console.warn("[useCouncil] RAG query falhou:", e.message);
      }
    }

    if (ragContext) {
      messagesParaEnviar.push({
        id: `rag-context-${Date.now()}`,
        role: "system",
        content: `[Memória Semântica Histórica Recuperada via RAG]\nUse as seguintes informações históricas se forem úteis/relevantes para responder à pergunta atual do utilizador:\n${ragContext}`,
        systemNote: true,
      });
    }

    const frLevel = detectFrustration(nm);
    setFrustrationLevel(frLevel);

    const { buf: bufComprimido, compressed, before, after } = await compressContext(
      [...buf, `USER: ${q}`],
      keys.claude,
      keys.perp
    );
    const newBuf = bufComprimido;
    const mem = buildMem(brain);
    const usedMem = selectUsedMem(brain, q);

    let councilLobes = LOBES.filter(
      (l) =>
        modelsOn[l.id] !== false &&
        (!focusMode || focusLobes.has(l.id))
    ).slice(0, 5);

    if (!councilLobes.length && focusMode) {
      councilLobes = LOBES.filter(
        (l) => modelsOn[l.id] !== false
      ).slice(0, 5);
    }

    let qFinal = q;
    if (frLevel === "low" || frLevel === "high") {
      qFinal += "\n\n[System Note: The user seems frustrated. Please adopt an extremely empathetic, clear, and helpful tone.]";
    }

    setPhase(FASES_DAG.GERACAO);
    try {
      const refined = await callOpenRouter("gemini", P.refine(q), q, 120, 3500, {
        signal: abortControllerRef.current.signal,
      });
      if (
        refined &&
        refined.trim().length > 10 &&
        refined.trim().length < q.length * 3 &&
        !refined.includes("{") &&
        !refined.includes("```")
      )
        qFinal = refined.trim() + (frLevel !== "none" ? "\n\n[System Note: The user seems frustrated. Please adopt an extremely empathetic, clear, and helpful tone.]" : "");
    } catch (e) {
      if (devePararGeracao() || e.name === "AbortError") {
        setIsGenerating(false);
        setPhase(FASES_DAG.OCIOSO);
        return;
      }
      // Falha silenciosa.
    }
    if (devePararGeracao()) return;

    let debateResultado = null;
    let payloadOmega = null;
    let nextLobeResults = [];

    let activeTemps = temperaturas;
    if (frLevel === "high") {
      activeTemps = { ...temperaturas };
      Object.keys(activeTemps).forEach(k => activeTemps[k] = 0.2);
    }

    debateResultado = await runDagCognitivo(qFinal, {
      lobos: councilLobes,
      temperaturas: activeTemps,
      imageDataUrl,
      systemPrompts,
      messages: messagesParaEnviar,
      signal: abortControllerRef.current.signal,
      controllersMap: controllersRef.current,
      onPhase: (p) => setPhase(p),
      onAlpha: (faseAlpha) => {
        setGenerationState((s) => (s === GENERATION_STATES.THINKING ? GENERATION_STATES.WRITING : s));
        const uiAlpha = councilLobes.map((l, i) => lobeDagParaUI(l, i, faseAlpha, [], lobeConfidenceScore));
        setLobeResults(uiAlpha);
      },
    });
    if (devePararGeracao()) return;
    setDebateResult(debateResultado);
    payloadOmega = debateResultado.payload_omega;
    nextLobeResults = councilLobes.map((l, i) =>
      lobeDagParaUI(l, i, debateResultado.fase_alpha, debateResultado.fase_beta, lobeConfidenceScore)
    );
    setLobeResults(nextLobeResults);
    nextLobeResults
      .filter((l) => l.isErr)
      .slice(0, 2)
      .forEach((l) => toast?.(`Lobo ${l.label || l.id} falhou — a usar reserva`, "aviso"));

    const consenso = (payloadOmega?.conselho_metadata?.score_consenso_pct || 0) / 100;
    setConsensusScore(consenso);

    let veredictoJuizes = [];
    setJudgeResults(veredictoJuizes);
    if (devePararGeracao()) return;

    setPhase(FASES_DAG.SINTESE);
    let resultadoRei = null;
    const ctrlRei = new AbortController();
    const abortarReiPorPai = () => ctrlRei.abort();
    if (abortControllerRef.current.signal.aborted) ctrlRei.abort();
    else abortControllerRef.current.signal.addEventListener("abort", abortarReiPorPai, { once: true });
    controllersRef.current.set("rei", ctrlRei);
    try {
      resultadoRei = await invocarReiClaude({
        pergunta: q,
        payloadOmega,
        callClaude,
        signal: ctrlRei.signal,
      });
      setKingResult(resultadoRei);
    } catch (e) {
      if (!devePararGeracao()) {
        const erro = classifyError(e);
        toast?.(`Síntese: ${erro.mensagem} ${erro.accao}.`, "erro");
      }
    } finally {
      abortControllerRef.current.signal.removeEventListener("abort", abortarReiPorPai);
      if (controllersRef.current.get("rei") === ctrlRei) controllersRef.current.delete("rei");
    }

    if (!stopRequestedRef.current) {
      setGenerationState(GENERATION_STATES.DONE);
      setGenerationTime(Math.round((Date.now() - startTime) / 1000));
      setTimeout(() => setGenerationState(GENERATION_STATES.IDLE), 2000);
    }

    if (devePararGeracao()) return;

    const graders = runGraders(resultadoRei || {});
    setGradersResult(graders);

    let cR;
    let structured;
    if (resultadoRei) {
      cR = resultadoRei.veredicto || fallbackDosLobos(nextLobeResults);
      structured = {
        final: cR,
        consensus: (payloadOmega?.fase_alpha || [])
          .filter((item) => item.sucesso)
          .map((item) => `${item.lobo}: ${String(item.conteudo || "").slice(0, 140)}`)
          .slice(0, 5),
        divergence: (payloadOmega?.fase_beta || [])
          .filter((item) => item.sucesso)
          .map((item) => `${item.lobo} criticou ${item.alvos_criticados.join(", ")}: ${String(item.conteudo || "").slice(0, 140)}`)
          .slice(0, 5),
        nextActions: resultadoRei.suggestions || [],
        confidence: `${resultadoRei.confianca_final}%`,
        king: resultadoRei,
      };
    } else {
      setPhase(FASES_DAG.SINTESE);
      try {
      const validLobes = nextLobeResults.filter((l) => !l.isErr && l.result?.length > 10);
      if (hC || hP)
        cR = await callClaude(
          "Juiz executivo de um cérebro de conselho multi-IA.",
          P.cortex(mem, q, validLobes.length ? validLobes : nextLobeResults),
          5400,
          keys.claude,
          keys.perp
        );
      else {
        const validFb = nextLobeResults.filter((l) => !l.isErr && l.result?.length > 10);
        cR =
          validFb.length > 0
            ? validFb.map((l) => `**${l.label}:** ${l.result}`).join("\n\n")
            : "Nenhum serviço respondeu. Verifica a ligação.";
      }
    } catch (e) {
      cR = nextLobeResults.map((l) => `**${l.label}:** ${l.result}`).join("\n\n");
      const erro = classifyError(e);
      toast?.(`Córtex: ${erro.mensagem} ${erro.accao}.`, "erro");
    }

      structured = normalizeCouncilPayload(cR, typeof cR === "string" ? cR : "");
    }
    if (devePararGeracao()) return;

    let cDecision = heuristicDecision(q);
    if (resultadoRei) {
      cDecision = `Rei: confiança final ${resultadoRei.confianca_final}%`;
    } else {
      try {
        cDecision = await callClaude(
          "Juiz de um conselho de IA com 11 lobos.",
          P.judge(q, nextLobeResults),
          80,
          keys.claude,
          keys.perp
        );
      } catch {}
    }
    if (devePararGeracao()) return;

    const council = Object.fromEntries(nextLobeResults.map((l) => [l.id, l.result]));

    const aMsg = {
      id: Date.now() + Math.random(),
      role: "assistant",
      // Garante reserva quando o Córtex não devolve JSON estruturado.
      content: (structured?.final || cR || "").trim(),
      structured,
      council,
      lobeResults: nextLobeResults,
      debate: debateResultado,
      faseBeta: debateResultado?.fase_beta || [],
      payloadOmega,
      modoDebate: false,
      judges: veredictoJuizes,
      king: resultadoRei,
      graders,
      consensoMatematico: consenso,
      usedMemory: usedMem,
      councilDecision: cDecision,
      refinedQuery: qFinal !== q ? qFinal : null,
    };

    const fm = [...nm, aMsg];
    setMsgs(fm);
    saveMsgs(fm);

    const buf2 = [...newBuf, `BRAIN: ${(structured?.final || cR || "").trim()}`];
    setBuf(buf2);
    const perguntaMemoria = q.replace(/\s+/g, " ").trim();
    const respostaMemoria = (structured?.final || cR || "").replace(/\s+/g, " ").trim();
    const resumoEpisodico = respostaMemoria
      ? `Pergunta: ${perguntaMemoria.slice(0, 180)} | Resposta: ${respostaMemoria.slice(0, 320)}`
      : "";
    let nb = {
      ...brain,
      sessions: brain.sessions + 1,
      episodic: resumoEpisodico
        ? [...brain.episodic, resumoEpisodico].slice(-MAX_EPISODIC)
        : brain.episodic,
    };
    if (buf2.length >= MAX_BUF && nb.sessions >= 1) {
      setPhase("reflex");
      try {
        const raw = await callClaude(
          "Return only valid JSON.",
          P.reflect(buf2.join("\n"), buildMem(nb)),
          480,
          keys.claude,
          keys.perp
        );
        const ext = safeParseReflect(raw);
        nb = {
          ...nb,
          semantic: [...nb.semantic, ...(ext.new_semantic || [])].slice(-MAX_SEMANTIC),
          patterns: [...new Set([...nb.patterns, ...(ext.new_patterns || [])])].slice(-MAX_PATTERNS),
          episodic: ext.session_summary
            ? [...nb.episodic, ext.session_summary].slice(-MAX_EPISODIC)
            : nb.episodic,
          procedural: { ...nb.procedural, ...(ext.procedural_update || {}) },
          lastReflect: new Date().toISOString(),
        };
      } catch {
        toast("Falha na reflexão subconsciente.");
      }
      setBuf([]);
    }

    setBrain(nb);
    saveBrain(nb);
    setPhase(FASES_DAG.OCIOSO);

    if (compressed) {
      const note = {
        id: Date.now() + Math.random(),
        role: "assistant",
        content: `⚡ Contexto comprimido (${before}→${after} msgs)`,
        systemNote: true,
        compressNote: true,
      };
      setMsgs((prev) => {
        const u = [...prev, note];
        saveMsgs(u);
        return u;
      });
    }

    autoSaveConv(fm, currentConvId);
    if (resultadoRei) toast?.("Rei terminou o veredicto", "sucesso");
    setIsGenerating(false);
    abortControllerRef.current = null;
    setTimeout(() => taRef.current?.focus(), 80);
  }

  return {
    send,
    invoke,
    lobeResults,
    judgeResults,
    kingResult,
    gradersResult,
    consensusScore,
    debateResult,
    cacheSize: responseCache.size,
    phase: phase === FASES_DAG.OCIOSO ? null : phase,
    setPhase,
    stopGeneration,
    isGenerating,
    frustrationLevel,
    setFrustrationLevel,
    generationState,
    generationTime,
    guardarMemoriaSessao,
    getLastSessionContext,
    partialTexts: partialTextRef
  };
}
