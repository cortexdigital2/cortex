import { describe, expect, it, vi } from "vitest";
import { deveUsarGroundingWeb, obterGroundingWeb } from "./useCouncil.js";

describe("useCouncil grounding web F5-05", () => {
  it("detecta perguntas factuais sem userAgent", () => {
    expect(deveUsarGroundingWeb("Quem é o CEO actual?")).toBe(true);
    expect(deveUsarGroundingWeb("Notícia hoje sobre IA em 2026")).toBe(true);
    expect(deveUsarGroundingWeb("Ajuda-me a desenhar uma arquitectura")).toBe(false);
  });

  it("obtém fontes Tavily e devolve contexto system pronto para injectar", async () => {
    const tavilySearchFake = vi.fn(async () => ({
      results: [
        { title: "Fonte A", url: "https://a.pt", content: "Resumo factual A" },
        { title: "Fonte B", url: "https://b.pt", content: "Resumo factual B" },
      ],
    }));

    const resultado = await obterGroundingWeb("quando foi anunciado?", tavilySearchFake);

    expect(tavilySearchFake).toHaveBeenCalledWith("quando foi anunciado?", { maxResults: 3 });
    expect(resultado.webSources).toEqual([
      { title: "Fonte A", url: "https://a.pt", content: "Resumo factual A" },
      { title: "Fonte B", url: "https://b.pt", content: "Resumo factual B" },
    ]);
    expect(resultado.contexto).toContain("[Fontes Web Verificadas]");
    expect(resultado.contexto).toContain("- Fonte A: Resumo factual A");
  });

  it("falha silenciosamente quando Tavily falha", async () => {
    const resultado = await obterGroundingWeb("notícia actual", async () => {
      throw new Error("tavily indisponível");
    });

    expect(resultado).toEqual({ contexto: "", webSources: [] });
  });
});
