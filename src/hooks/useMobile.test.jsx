import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import useMobile, {
  MOBILE_QUERY,
  PORTRAIT_QUERY,
  actualizarAlturaApp,
  lerEstadoMobile,
  subscreverMediaQuery,
} from "./useMobile.js";

function criarMatchMedia(matchesPorQuery) {
  return (query) => ({
    media: query,
    matches: Boolean(matchesPorQuery[query]),
  });
}

function EstadoMobileProbe() {
  const estado = useMobile();
  return <span>{`${estado.isMobile}:${estado.isPortrait}`}</span>;
}

describe("useMobile", () => {
  it("lê estado inicial com matchMedia e não com largura directa", () => {
    const estado = lerEstadoMobile(criarMatchMedia({
      [MOBILE_QUERY]: true,
      [PORTRAIT_QUERY]: false,
    }));

    expect(estado).toEqual({ isMobile: true, isPortrait: false });
  });

  it("expõe o estado inicial no hook", () => {
    const anterior = globalThis.window;
    globalThis.window = {
      matchMedia: criarMatchMedia({
        [MOBILE_QUERY]: true,
        [PORTRAIT_QUERY]: true,
      }),
      innerHeight: 640,
      addEventListener: () => {},
      removeEventListener: () => {},
    };

    const html = renderToStaticMarkup(<EstadoMobileProbe />);

    globalThis.window = anterior;
    expect(html).toContain("true:true");
  });

  it("actualiza --app-height para corrigir 100vh em Safari iOS", () => {
    const chamadas = [];
    const documento = {
      documentElement: {
        style: {
          setProperty: (nome, valor) => chamadas.push([nome, valor]),
        },
      },
    };

    actualizarAlturaApp({ innerHeight: 712 }, documento);

    expect(chamadas).toEqual([["--app-height", "712px"]]);
  });

  it("remove listeners de media query no cleanup", () => {
    const chamadas = [];
    const mediaQuery = {
      addEventListener: (evento, handler) => chamadas.push(["add", evento, handler]),
      removeEventListener: (evento, handler) => chamadas.push(["remove", evento, handler]),
    };
    const handler = () => {};

    const cleanup = subscreverMediaQuery(mediaQuery, handler);
    cleanup();

    expect(chamadas[0]).toEqual(["add", "change", handler]);
    expect(chamadas[1]).toEqual(["remove", "change", handler]);
  });
});
