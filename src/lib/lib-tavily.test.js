import { afterEach, describe, expect, it, vi } from "vitest";
import { formatTavilyContext, tavilySearch } from "./lib-tavily.js";

describe("lib-tavily", () => {
  const fetchOriginal = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = fetchOriginal;
    vi.restoreAllMocks();
  });

  it("usa o endpoint /api/tavily com maxResults por defeito a 3", async () => {
    globalThis.fetch = vi.fn(async () => ({
      ok: true,
      json: async () => ({ results: [] }),
    }));

    await tavilySearch("quando abre a feira?");

    expect(globalThis.fetch).toHaveBeenCalledWith(
      "/api/tavily",
      expect.objectContaining({
        method: "POST",
        headers: { "Content-Type": "application/json" },
      })
    );
    expect(JSON.parse(globalThis.fetch.mock.calls[0][1].body)).toEqual({
      query: "quando abre a feira?",
      maxResults: 3,
    });
  });

  it("falha silenciosamente no cliente quando o endpoint falha", async () => {
    globalThis.fetch = vi.fn(async () => {
      throw new Error("sem rede");
    });

    await expect(tavilySearch("notícia actual")).resolves.toEqual({ results: [] });
  });

  it("formata contexto verificado com três fontes e snippets até 200 caracteres", () => {
    const longo = "x".repeat(240);
    const contexto = formatTavilyContext({
      results: [
        { title: "A", url: "https://a.pt", content: longo },
        { title: "B", url: "https://b.pt", content: "Resumo B" },
        { title: "C", url: "https://c.pt", content: "Resumo C" },
        { title: "D", url: "https://d.pt", content: "Resumo D" },
      ],
    });

    expect(contexto).toContain("[Fontes Web Verificadas]");
    expect(contexto).toContain("- A: " + "x".repeat(200));
    expect(contexto).toContain("  https://a.pt");
    expect(contexto).not.toContain("Resumo D");
  });
});
