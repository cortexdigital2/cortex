import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import MobileInput from "./MobileInput.jsx";

describe("MobileInput", () => {
  it("renderiza overlay fixo no fundo com safe-area e input a 16px", () => {
    const html = renderToStaticMarkup(
      <MobileInput value="Olá" onChange={() => {}} onSend={() => {}} />
    );

    expect(html).toContain("position:fixed");
    expect(html).toContain("bottom:0");
    expect(html).toContain("env(safe-area-inset-bottom)");
    expect(html).toContain("font-size:16px");
    expect(html).toContain("var(--bg)");
    expect(html).toContain("var(--border)");
    expect(html).toContain("var(--accent)");
    expect(html).toContain("var(--text-h)");
  });

  it("mostra botão de stop só quando recebe onStop", () => {
    const semStop = renderToStaticMarkup(
      <MobileInput value="Olá" onChange={() => {}} onSend={() => {}} />
    );
    const comStop = renderToStaticMarkup(
      <MobileInput value="Olá" onChange={() => {}} onSend={() => {}} onStop={() => {}} />
    );

    expect(semStop).not.toContain("Parar geração");
    expect(comStop).toContain("Parar geração");
    expect(comStop).toContain("■");
  });

  it("mantém a textarea editável quando está vazia e só bloqueia o envio", () => {
    const html = renderToStaticMarkup(
      <MobileInput value="" onChange={() => {}} onSend={() => {}} />
    );

    expect(html).toContain("<textarea");
    expect(html).not.toContain("<textarea disabled");
    expect(html).toContain("<button type=\"button\" disabled=\"\"");
  });
});
