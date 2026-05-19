import { describe, expect, it } from "vitest";
import {
  LOBOS,
  calcularConsensoPreliminar,
  construirPayloadOmega,
  construirSystemPromptOmega,
  extrairTelemetriaOpenRouter,
  runDagCognitivo,
} from "./council.js";

function resultadoAlpha(nome, conteudo, sucesso = true) {
  return {
    lobo: nome,
    modelo: "modelo-teste",
    sucesso,
    conteudo,
    telemetria: { tempo_ms: 12, total_tokens: 34 },
  };
}

describe("DAG cognitivo Sprint 3", () => {
  it("calcula consenso preliminar por Sørensen-Dice com bigramas", () => {
    const alto = calcularConsensoPreliminar([
      resultadoAlpha("A", "motor electrico eficiente"),
      resultadoAlpha("B", "motor electrico eficiente"),
    ]);
    const baixo = calcularConsensoPreliminar([
      resultadoAlpha("A", "motor electrico eficiente"),
      resultadoAlpha("B", "poesia visual abstracta"),
    ]);

    expect(alto).toBe(100);
    expect(baixo).toBeLessThan(30);
  });

  it("constrói o prompt Ómega com citações obrigatórias, chips e lobos falhados ignorados", () => {
    const prompt = construirSystemPromptOmega(
      [resultadoAlpha("Analista Crítico", "risco", true), resultadoAlpha("Pragmático Técnico", "", false)],
      [resultadoAlpha("Advogado do Diabo", "crítica", true)]
    );

    expect(prompt).toContain("Claude");
    expect(prompt).toContain("[Analista Crítico]");
    expect(prompt).toContain("3 chips");
    expect(prompt).toContain("ignora automaticamente");
    expect(prompt).toContain("Pragmático Técnico");
  });

  it("constrói JSON Ómega com metadata, Alpha e Beta", () => {
    const payload = construirPayloadOmega({
      resultadosAlpha: [
        resultadoAlpha("Analista Crítico", "A"),
        resultadoAlpha("Inovador Criativo", "", false),
      ],
      resultadosBeta: [
        {
          lobo: "Analista Crítico",
          alvos_criticados: ["Inovador Criativo", "Generalista Contextual"],
          sucesso: true,
          conteudo: "crítica",
          telemetria: { tempo_ms: 20, total_tokens: 10 },
        },
      ],
      tempoMs: 1234,
    });

    expect(payload).toEqual({
      conselho_metadata: {
        score_consenso_pct: expect.any(Number),
        lobos_em_falha: ["Inovador Criativo"],
        tempo_ms: 1234,
      },
      fase_alpha: expect.arrayContaining([
        expect.objectContaining({ lobo: "Analista Crítico", sucesso: true }),
      ]),
      fase_beta: expect.arrayContaining([
        expect.objectContaining({
          lobo: "Analista Crítico",
          alvos_criticados: ["Inovador Criativo", "Generalista Contextual"],
          sucesso: true,
        }),
      ]),
    });
  });

  it("extrai usage.total_tokens para telemetria OpenRouter", () => {
    expect(extrairTelemetriaOpenRouter({ usage: { total_tokens: 321 } }, 45, "hit")).toEqual({
      tempo_ms: 45,
      total_tokens: 321,
      cache_status: "hit",
    });
  });

  it("executa Alpha com 5 lobos e Beta só com os 2 revisores fixos, avançando se um falhar", async () => {
    const chamadas = [];
    async function chamarLobeFake(lobe, pergunta, contextoDebate) {
      chamadas.push({ id: lobe.id, nome: lobe.nome, contextoDebate });
      if (contextoDebate && lobe.id === 5) throw new Error("beta indisponível");
      return {
        id: lobe.id,
        nome: lobe.nome,
        modelo: lobe.modelo,
        resposta: `${lobe.nome} respondeu a ${pergunta}`,
        telemetria: { tempo_ms: lobe.id, total_tokens: lobe.id * 10 },
      };
    }

    const resultado = await runDagCognitivo("Pergunta crítica", {
      lobos: LOBOS,
      chamarLobe: chamarLobeFake,
    });

    expect(chamadas.slice(0, 5).map((c) => c.id)).toEqual([1, 2, 3, 4, 5]);
    expect(chamadas.slice(5).map((c) => c.id)).toEqual([1, 5]);
    expect(chamadas[5].contextoDebate).toContain("[Inovador Criativo]");
    expect(chamadas[5].contextoDebate).toContain("[Generalista Contextual]");
    expect(chamadas[6].contextoDebate).toContain("[Pragmático Técnico]");
    expect(chamadas[6].contextoDebate).toContain("[Analista Crítico]");
    expect(resultado.fase_beta).toHaveLength(2);
    expect(resultado.fase_beta[1]).toMatchObject({
      lobo: "Advogado do Diabo",
      alvos_criticados: ["Pragmático Técnico", "Analista Crítico"],
      sucesso: false,
    });
    expect(resultado.payload_omega.conselho_metadata.lobos_em_falha).toContain("Advogado do Diabo");
  });
});
