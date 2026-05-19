import { describe, expect, it } from "vitest";
import { vibrar } from "./useHapticFeedback.js";

describe("useHapticFeedback", () => {
  it("envia o padrão de vibração quando suportado", () => {
    const chamadas = [];
    const navegador = {
      vibrate: (padrao) => {
        chamadas.push(padrao);
        return true;
      },
    };

    expect(vibrar(10, navegador)).toBe(true);
    expect(vibrar([50, 30, 50], navegador)).toBe(true);
    expect(chamadas).toEqual([10, [50, 30, 50]]);
  });

  it("falha silenciosamente quando navigator.vibrate não existe", () => {
    expect(() => vibrar(20, {})).not.toThrow();
    expect(vibrar(20, {})).toBe(false);
  });

  it("falha silenciosamente quando o browser lança erro", () => {
    const navegador = {
      vibrate: () => {
        throw new Error("bloqueado");
      },
    };

    expect(() => vibrar(20, navegador)).not.toThrow();
    expect(vibrar(20, navegador)).toBe(false);
  });
});
