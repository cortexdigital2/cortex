import { describe, expect, it } from "vitest";
import { FASES_DAG, invocarReiClaude } from "./useCouncil.js";

describe("useCouncil DAG Sprint 3", () => {
  it("expõe a sequência de estados cognitivos", () => {
    expect(FASES_DAG).toEqual({
      OCIOSO: "ocioso",
      GERACAO: "geracao",
      CRITICA: "critica",
      SINTESE: "sintese",
    });
  });

  it("invoca Claude com JSON Ómega e garante citação + 3 chips", async () => {
    const payloadOmega = {
      conselho_metadata: {
        score_consenso_pct: 72,
        lobos_em_falha: ["Advogado do Diabo"],
        tempo_ms: 500,
      },
      fase_alpha: [
        {
          lobo: "Analista Crítico",
          modelo: "modelo-a",
          sucesso: true,
          conteudo: "Há risco técnico.",
          telemetria: { tempo_ms: 10, total_tokens: 20 },
        },
      ],
      fase_beta: [],
    };
    const chamadas = [];
    const resposta = await invocarReiClaude({
      pergunta: "O que fazer?",
      payloadOmega,
      callClaude: async (system, msg, tokens) => {
        chamadas.push({ system, msg, tokens });
        return JSON.stringify({
          veredicto: "Executa o plano por fases.",
          confianca_final: 81,
          suggestions: ["Mostra o plano"],
        });
      },
    });

    expect(JSON.parse(chamadas[0].msg)).toEqual(payloadOmega);
    expect(chamadas[0].system).toContain("ignora automaticamente");
    expect(resposta.veredicto).toContain("[Analista Crítico]");
    expect(resposta.suggestions).toEqual(["Mostra o plano", "Aprofunda isto", "Mostra exemplos"]);
    expect(resposta.confianca_final).toBe(81);
  });
});
