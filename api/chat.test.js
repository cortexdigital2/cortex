import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

function criarReq(ip = "203.0.113.10") {
  return {
    method: "POST",
    headers: { "x-forwarded-for": ip },
    socket: { remoteAddress: ip },
    body: {
      model: "openai/gpt-oss-120b:free",
      messages: [{ role: "user", content: "olá" }],
    },
  };
}

function criarRes() {
  return {
    statusCode: 200,
    payload: null,
    headers: {},
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.payload = payload;
      return this;
    },
    setHeader(nome, valor) {
      this.headers[nome] = valor;
    },
    write() {},
    end() {
      this.ended = true;
      return this;
    },
  };
}

describe("api/chat rate limiting", () => {
  let handler;
  const envOriginal = process.env.OPENROUTER_API_KEY;
  const fetchOriginal = globalThis.fetch;

  beforeEach(async () => {
    vi.resetModules();
    process.env.OPENROUTER_API_KEY = "test-key";
    globalThis.fetch = vi.fn(async () => ({
      ok: true,
      status: 200,
      headers: { get: () => null },
      text: async () => JSON.stringify({ choices: [{ message: { content: "ok" } }] }),
    }));
    const mod = await import("./chat.js");
    handler = mod.default;
    mod.limparRateLimitChat?.();
  });

  afterEach(() => {
    process.env.OPENROUTER_API_KEY = envOriginal;
    globalThis.fetch = fetchOriginal;
    vi.restoreAllMocks();
  });

  it("bloqueia o 21.º pedido do mesmo IP por minuto com mensagem PT-PT", async () => {
    for (let i = 0; i < 20; i += 1) {
      const res = criarRes();
      await handler(criarReq(), res);
      expect(res.statusCode).toBe(200);
    }

    const resBloqueado = criarRes();
    await handler(criarReq(), resBloqueado);

    expect(resBloqueado.statusCode).toBe(429);
    expect(resBloqueado.payload).toEqual({
      error: "Demasiados pedidos. Aguarda 1 minuto.",
    });
  });
});
