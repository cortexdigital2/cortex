import { useEffect, useState } from "react";

export const MOBILE_QUERY = "(max-width: 767px)";
export const PORTRAIT_QUERY = "(orientation: portrait)";

export function lerEstadoMobile(matchMediaFn = globalThis.window?.matchMedia?.bind(globalThis.window)) {
  if (typeof matchMediaFn !== "function") {
    return { isMobile: false, isPortrait: false };
  }

  return {
    isMobile: Boolean(matchMediaFn(MOBILE_QUERY).matches),
    isPortrait: Boolean(matchMediaFn(PORTRAIT_QUERY).matches),
  };
}

export function actualizarAlturaApp(janela = globalThis.window, documento = globalThis.document) {
  const altura = janela?.innerHeight;
  const raiz = documento?.documentElement;
  if (!altura || !raiz?.style?.setProperty) return;

  raiz.style.setProperty("--app-height", `${altura}px`);
}

export function subscreverMediaQuery(mediaQuery, handler) {
  if (!mediaQuery) return () => {};

  if (typeof mediaQuery.addEventListener === "function") {
    mediaQuery.addEventListener("change", handler);
    return () => mediaQuery.removeEventListener("change", handler);
  }

  if (typeof mediaQuery.addListener === "function") {
    mediaQuery.addListener(handler);
    return () => mediaQuery.removeListener(handler);
  }

  return () => {};
}

export default function useMobile() {
  const [estado, setEstado] = useState(() => lerEstadoMobile());

  useEffect(() => {
    const janela = globalThis.window;
    if (!janela || typeof janela.matchMedia !== "function") {
      actualizarAlturaApp();
      return () => {};
    }

    const mobileQuery = janela.matchMedia(MOBILE_QUERY);
    const portraitQuery = janela.matchMedia(PORTRAIT_QUERY);

    const actualizar = () => {
      setEstado({
        isMobile: Boolean(mobileQuery.matches),
        isPortrait: Boolean(portraitQuery.matches),
      });
      actualizarAlturaApp(janela, globalThis.document);
    };

    actualizar();

    const limparMobile = subscreverMediaQuery(mobileQuery, actualizar);
    const limparPortrait = subscreverMediaQuery(portraitQuery, actualizar);
    janela.addEventListener?.("resize", actualizar);
    janela.addEventListener?.("orientationchange", actualizar);

    return () => {
      limparMobile();
      limparPortrait();
      janela.removeEventListener?.("resize", actualizar);
      janela.removeEventListener?.("orientationchange", actualizar);
    };
  }, []);

  return estado;
}
