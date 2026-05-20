import { afterEach, beforeEach, describe, expect, it } from "vitest";

const localStorageOriginal = globalThis.localStorage;

beforeEach(() => {
  globalThis.localStorage = {
    getItem: () => null,
    setItem: () => {},
    removeItem: () => {},
    clear: () => {},
  };
});

afterEach(() => {
  if (localStorageOriginal === undefined) {
    delete globalThis.localStorage;
    return;
  }

  globalThis.localStorage = localStorageOriginal;
});

describe("confidence badges", () => {
  it("não mostra badge quando a confiança final é 70 ou superior", async () => {
    const { obterBadgeConfianca } = await import("./cortex-digital.jsx");

    expect(obterBadgeConfianca(70)).toBeNull();
    expect(obterBadgeConfianca(95)).toBeNull();
  });

  it("mostra badge amarelo entre 40 e 69", async () => {
    const { obterBadgeConfianca } = await import("./cortex-digital.jsx");

    expect(obterBadgeConfianca(40)).toMatchObject({
      texto: "Confiança média",
      cor: "#f59e0b",
      icone: "⚠️",
    });
    expect(obterBadgeConfianca(69)).toMatchObject({
      texto: "Confiança média",
      cor: "#f59e0b",
      icone: "⚠️",
    });
  });

  it("mostra badge vermelho abaixo de 40", async () => {
    const { obterBadgeConfianca } = await import("./cortex-digital.jsx");

    expect(obterBadgeConfianca(39)).toMatchObject({
      texto: "Baixa confiança",
      cor: "#ef4444",
      icone: "🔴",
    });
  });
});
