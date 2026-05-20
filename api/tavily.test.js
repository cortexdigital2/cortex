import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

function criarReq(body = {}) {
  return {
    method: "POST",
    body,
  };
}

function criarRes() {
  return {
    statusCode: 200,
    payload: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.payload = payload;
      return this;
    },
  };
}

describe("api/tavily", () => {
  const envOriginal = process.env.TAVILY_API_KEY;
  const fetchOriginal = globalThis.fetch;

  beforeEach(() => {
    vi.resetModules();
    process.env.TAVILY_API_KEY = "tavily-test-key";
  });

  afterEach(() => {
    process.env.TAVILY_API_KEY = envOriginal;
    globalThis.fetch = fetchOriginal;
    vi.restoreAllMocks();
  });

  it("chama Tavily com pesquisa basic e normaliza resultados", async () => {
    globalThis.fetch = vi.fn(async () => ({
      ok: true,
      json: async () => ({
        results: [
          { title: "Fonte A", url: "https://exemplo.pt/a", content: "Resumo A", score: 0.9 },
          { title: "Fonte B", url: "https://exemplo.pt/b", content: "Resumo B" },
        ],
      }),
    }));

    const { default: handler } = await import("./tavily.js");
    const res = criarRes();
    await handler(criarReq({ query: "quem ganhou hoje?", maxResults: 2 }), res);

    expect(res.statusCode).toBe(200);
    expect(res.payload).toEqual({
      results: [
        { title: "Fonte A", url: "https://exemplo.pt/a", content: "Resumo A" },
        { title: "Fonte B", url: "https://exemplo.pt/b", content: "Resumo B" },
      ],
    });
    expect(globalThis.fetch).toHaveBeenCalledWith(
      "https://api.tavily.com/search",
      expect.objectContaining({
        method: "POST",
        signal: expect.any(Object),
        headers: { "Content-Type": "application/json" },
      })
    );
    expect(JSON.parse(globalThis.fetch.mock.calls[0][1].body)).toMatchObject({
      api_key: "tavily-test-key",
      query: "quem ganhou hoje?",
      search_depth: "basic",
      max_results: 2,
    });
  });

  it("devolve sempre 200 com lista vazia se Tavily falhar", async () => {
    globalThis.fetch = vi.fn(async () => {
      throw new Error("rede indisponível");
    });

    const { default: handler } = await import("./tavily.js");
    const res = criarRes();
    await handler(criarReq({ query: "notícia actual" }), res);

    expect(res.statusCode).toBe(200);
    expect(res.payload).toEqual({ results: [] });
  });
});
