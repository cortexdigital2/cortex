import React from "react";
import ChatBubble from "./ChatBubble.jsx";
import JudgeCard from "./JudgeCard";
import { exportarExcel, exportarNotion, exportarWord } from "../hooks/useExport.js";
import { falarTexto } from "../hooks/useVoice.js";
import { classifyError } from "../utils/errorMessages.js";

function pct(valor) {
  if (typeof valor !== "number") return null;
  return Math.max(0, Math.min(100, Math.round(valor)));
}

function scoreColor(valor) {
  const score = pct(valor) ?? 0;
  if (score >= 75) return "#22c55e";
  if (score >= 45) return "#f59e0b";
  return "#ef4444";
}

function ScoreBar({ label, value, T }) {
  const score = pct(value);
  if (score === null) return null;
  const cor = scoreColor(score);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 5, minWidth: 0 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
        <span style={{ color: T.ts || "var(--text)", fontSize: 10, fontWeight: 700 }}>{label}</span>
        <span style={{ color: cor, fontSize: 10, fontWeight: 800 }}>{score}%</span>
      </div>
      <div
        style={{
          height: 6,
          borderRadius: 999,
          background: T.s2 || "var(--social-bg)",
          border: `1px solid ${T.b1 || "var(--border)"}`,
          overflow: "hidden",
        }}
      >
        <div
          style={{
            width: `${score}%`,
            height: "100%",
            background: cor,
            transition: "width 250ms ease",
          }}
        />
      </div>
    </div>
  );
}

function obterTextoPrincipal(m, king) {
  return (king?.veredicto || m.structured?.final || m.content || "").trim();
}

function sanitizarErroRei(texto) {
  const valor = String(texto || "");
  if (/Unexpected end of JSON input|Failed to execute 'json'/i.test(valor)) {
    return "JSON inválido ou resposta vazia do proxy /api/chat";
  }
  return valor;
}

function obterPergunta(msgs, i) {
  return msgs
    .slice(0, i)
    .reverse()
    .find((x) => x.role === "user")?.content || "";
}

function obterLobosExport(m) {
  return (m.lobeResults || []).map((lobe) => ({
    nome: lobe.nome || lobe.label,
    resposta: lobe.resposta || lobe.result,
    modelo: lobe.modelo || lobe.srcModel,
    confianca: lobe.confianca ?? lobe.confidence,
  }));
}

const estiloExport = {
  background: "var(--bg-secondary, var(--social-bg, #14141e))",
  border: "1px solid var(--border, rgba(255,255,255,0.12))",
  borderRadius: 8,
  padding: "6px 14px",
  cursor: "pointer",
  fontSize: 13,
  color: "var(--text-primary, var(--text-h, #f5f5ff))",
  transition: "background 0.2s, opacity 0.2s",
  fontFamily: "inherit",
};

const estiloInput = {
  background: "var(--bg-secondary, var(--social-bg, #14141e))",
  border: "1px solid var(--border, rgba(255,255,255,0.12))",
  borderRadius: 8,
  padding: "7px 10px",
  color: "var(--text-primary, var(--text-h, #f5f5ff))",
  fontSize: 12,
  minWidth: 220,
  flex: "1 1 220px",
  fontFamily: "inherit",
};

const KingCard = React.memo(function KingCard({
  m,
  i,
  msgs,
  T,
  AC,
  CopyBtn,
  Markdown,
  showCouncil,
  setShowCouncil,
  isMobile,
  toast,
  beforeVerdict,
  PainelSinteseComponent,
  children,
}) {
  const king = m.king || m.resultadoRei || m.structured?.king || null;
  const textoPrincipal = obterTextoPrincipal(m, king);
  const judges = m.judges || m.juizesResultados || [];
  const graders = m.graders || null;
  const accent = AC?.claude || "var(--accent)";
  const [notionToken, setNotionToken] = React.useState("");
  const [notionPageId, setNotionPageId] = React.useState("");
  const [mostrarNotion, setMostrarNotion] = React.useState(false);
  const [exportando, setExportando] = React.useState(false);
  const dadosExport = {
    pergunta: obterPergunta(msgs, i),
    lobos: obterLobosExport(m),
    veredicto: textoPrincipal,
  };

  async function executarExport(tipo) {
    if (!dadosExport.veredicto) return;
    if (tipo === "notion" && (!notionToken || !notionPageId)) {
      setMostrarNotion(true);
      return;
    }

    setExportando(true);
    try {
      if (tipo === "word") await exportarWord(dadosExport);
      if (tipo === "excel") await exportarExcel(dadosExport);
      if (tipo === "notion") await exportarNotion({ ...dadosExport, notionToken, notionPageId });
      toast?.(tipo === "notion" ? "Exportado para Notion" : "Relatório exportado", "sucesso");
    } catch (e) {
      console.error("[Export]", e);
      const erro = classifyError(e);
      toast?.(`${erro.mensagem} ${erro.accao}.`, "erro");
    } finally {
      setExportando(false);
    }
  }

  return (
    <div
      style={{
        background: T.s1 || "var(--bg)",
        border: `1px solid ${T.b1 || "var(--border)"}`,
        borderRadius: 8,
        overflow: "hidden",
        boxShadow: "0 10px 28px #00000020",
        animation: "fadeIn 250ms cubic-bezier(0.4,0,0.2,1)",
      }}
    >
      {/* Cabeçalho do Rei */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 10,
          padding: "12px 14px",
          background: `linear-gradient(135deg, ${accent}18 0%, ${accent}08 100%)`,
          borderBottom: `1px solid ${T.b1 || "var(--border)"}`,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
          <div
            style={{
              width: 30,
              height: 30,
              borderRadius: 8,
              background: `${accent}22`,
              border: `1px solid ${accent}44`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: accent,
              fontSize: 14,
              fontWeight: 900,
              flexShrink: 0,
            }}
          >
            R
          </div>

          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 12, fontWeight: 900, color: T.tx || "var(--text-h)" }}>
              Rei do Córtex
            </div>
            <div style={{ fontSize: 10, color: T.ts || "var(--text)" }}>
              Veredicto final com juízes dinâmicos
            </div>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
          <CopyBtn text={textoPrincipal} T={T} />

          <button
            onClick={() => falarTexto(textoPrincipal)}
            title="Ouvir veredicto"
            style={{
              background: "transparent",
              border: `1px solid ${T.b1 || "var(--border)"}`,
              borderRadius: 5,
              padding: "2px 7px",
              color: T.tf || "var(--text)",
              fontSize: 9,
              cursor: "pointer",
            }}
          >
            🔊
          </button>

          <button
            onClick={async () => {
              const question = obterPergunta(msgs, i);
              const shareText = `Pergunta:\n${question}\n\nResposta:\n${textoPrincipal}`;

              if (navigator.share && isMobile) {
                try {
                  await navigator.share({ text: shareText });
                } catch {
                  // Cancelamento de partilha não deve quebrar a UX.
                }
              } else {
                await navigator.clipboard?.writeText(shareText);
                toast?.("Resposta copiada para partilha", "success");
              }
            }}
            title="Partilhar"
            style={{
              background: "transparent",
              border: `1px solid ${T.b1 || "var(--border)"}`,
              borderRadius: 5,
              padding: "2px 7px",
              color: T.tf || "var(--text)",
              fontSize: 9,
              cursor: "pointer",
            }}
          >
            📤
          </button>

          {m.lobeResults?.length > 0 && (
            <button
              onClick={() => setShowCouncil(showCouncil === m.id ? null : m.id)}
              title={showCouncil === m.id ? "Ocultar conselho" : "Ver conselho"}
              style={{
                background: showCouncil === m.id ? `${accent}16` : "transparent",
                border: `1px solid ${showCouncil === m.id ? accent + "44" : T.b1 || "var(--border)"}`,
                borderRadius: 5,
                padding: "2px 7px",
                color: showCouncil === m.id ? accent : T.tf || "var(--text)",
                fontSize: 9,
                cursor: "pointer",
              }}
            >
              {showCouncil === m.id ? "Ocultar" : `Lobos ${m.lobeResults.length}`}
            </button>
          )}
        </div>
      </div>

      <div style={{ padding: "14px", display: "flex", flexDirection: "column", gap: 12 }}>
        {beforeVerdict}

        {king?.modo_degradado && (
          <div
            style={{
              background: "#f59e0b14",
              border: "1px solid #f59e0b44",
              borderRadius: 8,
              padding: "8px 10px",
              color: T.tx || "var(--text-h)",
              fontSize: 11,
              lineHeight: 1.5,
            }}
          >
            Modo degradado: {sanitizarErroRei(king.razao_incerteza)}
          </div>
        )}

        <div style={{ paddingBottom: 4, borderBottom: `1px solid ${T.b1 || "var(--border)"}` }}>
          {PainelSinteseComponent ? (
            <PainelSinteseComponent respostaBruta={textoPrincipal} />
          ) : (
            <ChatBubble papel="rei" nome="Rei do Córtex" cor={accent} destaque>
              <Markdown text={textoPrincipal} color={T.tx || "var(--text-h)"} faint={T.ts || "var(--text)"} />
            </ChatBubble>
          )}
        </div>

        {dadosExport.veredicto && (
          <div
            style={{
              display: "flex",
              gap: 8,
              flexWrap: "wrap",
              marginTop: 0,
              paddingTop: 12,
              borderTop: "1px solid var(--border, rgba(255,255,255,0.12))",
            }}
          >
            <button
              type="button"
              onClick={() => executarExport("word")}
              disabled={exportando}
              style={{ ...estiloExport, opacity: exportando ? 0.55 : 1 }}
              onMouseEnter={(e) => { e.currentTarget.style.background = "var(--accent-bg, rgba(168,85,247,0.1))"; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = estiloExport.background; }}
            >
              📄 Word
            </button>
            <button
              type="button"
              onClick={() => executarExport("excel")}
              disabled={exportando}
              style={{ ...estiloExport, opacity: exportando ? 0.55 : 1 }}
              onMouseEnter={(e) => { e.currentTarget.style.background = "var(--accent-bg, rgba(168,85,247,0.1))"; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = estiloExport.background; }}
            >
              📊 Excel
            </button>
            <button
              type="button"
              onClick={() => executarExport("notion")}
              disabled={exportando}
              style={{ ...estiloExport, opacity: exportando ? 0.55 : 1 }}
              onMouseEnter={(e) => { e.currentTarget.style.background = "var(--accent-bg, rgba(168,85,247,0.1))"; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = estiloExport.background; }}
            >
              {exportando ? "⏳" : "📝"} Notion
            </button>
          </div>
        )}

        {mostrarNotion && (
          <div style={{ marginTop: -4, display: "flex", gap: 8, flexWrap: "wrap" }}>
            <input
              type="password"
              placeholder="Token de integração Notion"
              value={notionToken}
              onChange={(e) => setNotionToken(e.target.value)}
              style={estiloInput}
            />
            <input
              type="text"
              placeholder="ID da página"
              value={notionPageId}
              onChange={(e) => setNotionPageId(e.target.value)}
              style={estiloInput}
            />
          </div>
        )}

        {king && (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: isMobile ? "1fr" : "repeat(3,minmax(0,1fr))",
              gap: 10,
              paddingBottom: 4,
              borderBottom: `1px solid ${T.b1 || "var(--border)"}`,
            }}
          >
            <ScoreBar label="Lobos" value={king.confianca_lobos} T={T} />
            <ScoreBar label="Juízes" value={king.confianca_juizes} T={T} />
            <ScoreBar label="Final" value={king.confianca_final} T={T} />
          </div>
        )}

        {king?.raciocinio?.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <div style={{ color: AC?.gemini || accent, fontSize: 11, fontWeight: 900 }}>
              Raciocínio resumido
            </div>
            {king.raciocinio.map((item, idx) => (
              <div
                key={`suggestion-${idx}-${item.slice(0, 10)}`}
                style={{
                  background: T.s2 || "var(--social-bg)",
                  border: `1px solid ${T.b1 || "var(--border)"}`,
                  borderRadius: 8,
                  padding: "8px 10px",
                  color: T.tx || "var(--text-h)",
                  fontSize: 12,
                  lineHeight: 1.55,
                }}
              >
                {idx + 1}. {item}
              </div>
            ))}
          </div>
        )}

        {judges.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <div style={{ color: AC?.perp || accent, fontSize: 11, fontWeight: 900 }}>
              Juízes
            </div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: isMobile ? "1fr" : "repeat(2,minmax(0,1fr))",
                gap: 8,
              }}
            >
              {judges.map((judge) => (
                <JudgeCard key={`judge-${judge.juiz}-${judge.nome}`} judge={judge} T={T} compact />
              ))}
            </div>
          </div>
        )}

        {graders && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 8,
              background: T.s2 || "var(--social-bg)",
              border: `1px solid ${graders.passou_todos ? "#22c55e44" : "#f59e0b44"}`,
              borderRadius: 8,
              padding: "8px 10px",
              color: T.ts || "var(--text)",
              fontSize: 10,
            }}
          >
            <span>Graders automáticos</span>
            <strong style={{ color: graders.passou_todos ? "#22c55e" : "#f59e0b" }}>
              {graders.passou_todos ? "passou" : "atenção"}
            </strong>
          </div>
        )}

        {m.refinedQuery && (
          <div style={{ fontSize: 9, color: T.tf || "var(--text)", fontStyle: "italic" }}>
            Pergunta refinada: "{m.refinedQuery}"
          </div>
        )}

        {children}
      </div>
    </div>
  );
});

export default KingCard;
