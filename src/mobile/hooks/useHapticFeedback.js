import { useMemo } from "react";

export function vibrar(padrao, navegador = globalThis.navigator) {
  try {
    if (typeof navegador?.vibrate !== "function") return false;
    return Boolean(navegador.vibrate(padrao));
  } catch {
    return false;
  }
}

export default function useHapticFeedback() {
  return useMemo(() => ({
    leve: () => vibrar(10),
    medio: () => vibrar(20),
    pesado: () => vibrar([50, 30, 50]),
  }), []);
}
