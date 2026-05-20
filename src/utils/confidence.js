export function obterBadgeConfianca(confiancaFinal) {
  const valor = Number(confiancaFinal);
  if (!Number.isFinite(valor) || valor >= 70) return null;
  if (valor >= 40) return { texto: "Confiança média", cor: "#f59e0b", icone: "⚠️" };
  return { texto: "Baixa confiança", cor: "#ef4444", icone: "🔴" };
}

export function obterFontesWebMensagem(mensagem) {
  const fontes = mensagem?.webSources || mensagem?.structured?.webSources || mensagem?.king?.webSources || [];
  if (!Array.isArray(fontes)) return [];
  return fontes
    .map((fonte) => {
      const content = String(fonte?.content || "").trim();
      return {
        title: String(fonte?.title || "").trim(),
        url: String(fonte?.url || "").trim(),
        ...(content ? { content } : {}),
      };
    })
    .filter((fonte) => fonte.title && fonte.url)
    .slice(0, 3);
}
