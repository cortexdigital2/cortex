import React from "react";
import LobeCard from "./LobeCard";
import ClaudeCard from "./ClaudeCard";
import ChatBubble from "./ChatBubble";
import { HISTORY_LIMIT } from "../utils/trimHistory";
import SwipeableChatBubble from "../mobile/components/SwipeableChatBubble";
import LongPressMenu from "../mobile/components/LongPressMenu";
const GENERIC_ERROR_SUGGESTIONS = new Set([
  "Tenta reformular a pergunta",
  "Reporta o erro",
  "Continua sem juízes",
]);

const MessageList = React.memo(function MessageList({
  msgs,
  T,
  AC,
  CopyBtn,
  Markdown,
  showCouncil,
  setShowCouncil,
  isMobile,
  phase,
  setPhase,
  setMsgs,
  buildMem,
  brain,
  invoke,
  P,
  toast,
  ClaudeCardComponent = ClaudeCard,
  BeforeVerdictComponent,
  textosParciais,
  aStreaming,
  onSuggestionClick = () => {},
}) {
  const ClaudeCardView = ClaudeCardComponent;

  const handleCopy = (msg) => {
    const text = msg.structured?.final || msg.content || "";
    navigator.clipboard.writeText(text);
    toast?.("Copiado para a área de transferência", "sucesso");
  };

  const handleShare = (msg) => {
    const text = msg.structured?.final || msg.content || "";
    if (navigator.share) {
      navigator.share({ title: "Córtex Digital", text }).catch(() => {});
    } else {
      handleCopy(msg);
    }
  };

  const handleFork = (msg) => {
    toast?.("Fork (Branching) em desenvolvimento.", "aviso");
  };

  const wrapMobileGestures = (contentNode, msg) => {
    if (!isMobile) return contentNode;
    return (
      <LongPressMenu
        message={msg}
        onCopy={handleCopy}
        onShare={handleShare}
        onFork={handleFork}
      >
        <SwipeableChatBubble onDelete={() => setMsgs((prev) => prev.filter((x) => x.id !== msg.id))}>
          {contentNode}
        </SwipeableChatBubble>
      </LongPressMenu>
    );
  };

  return (
    <>
      {msgs.map((m, i) => {
        // Separador de contexto truncado
        const showContextSeparator = i === msgs.length - HISTORY_LIMIT && msgs.length > HISTORY_LIMIT;
        
        const sugestoesRei = [
          ...(m.king?.suggestions || []),
          ...(m.sugestoes || []),
          ...(m.structured?.nextActions || []),
        ]
          .filter(Boolean)
          .filter((sugestao) => !GENERIC_ERROR_SUGGESTIONS.has(String(sugestao)))
          .slice(0, 3);

        return (
          <React.Fragment key={`msg-group-${i}`}>
            {showContextSeparator && (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "12px",
                  margin: "24px 0",
                  opacity: 0.6,
                }}
              >
                <div style={{ flex: 1, height: "1px", background: "linear-gradient(to right, transparent, var(--ts), transparent)" }} />
                <span style={{ fontSize: "10px", color: "var(--ts)", letterSpacing: "1px", textTransform: "lowercase" }}>
                  · · · contexto activo a partir daqui · · ·
                </span>
                <div style={{ flex: 1, height: "1px", background: "linear-gradient(to right, transparent, var(--ts), transparent)" }} />
              </div>
            )}
            <div
              key={`msg-${i}-${m.id || m.role || "sem-id"}`}
          className="msg-in"
          style={{
            alignSelf: m.role === "user" ? "flex-end" : "stretch",
            maxWidth: m.role === "user" ? "82%" : "100%",
            display: "flex",
            flexDirection: "column",
            gap: 8,
          }}
        >
          {m.role === "user" ? wrapMobileGestures((
            <ChatBubble
              papel="user"
              cor={AC.claude}
              meta={
                m.complexity
                  ? m.complexity === "SIMPLE"
                    ? "⚡ Simples"
                    : m.complexity === "MEDIUM"
                    ? "⚙️ Médio"
                    : "🧠 Complexo"
                  : null
              }
            >
              {m.anexo?.previewUrl && (
                <img
                  src={m.anexo.previewUrl}
                  alt="Imagem anexada"
                  style={{
                    display: "block",
                    maxWidth: "100%",
                    maxHeight: 200,
                    borderRadius: 8,
                    marginBottom: 8,
                    objectFit: "cover",
                  }}
                />
              )}
              {m.content}
              {m.anexo && !m.anexo.previewUrl && (
                <div
                  style={{
                    marginTop: 8,
                    border: `1px solid ${AC.claude}33`,
                    borderRadius: 10,
                    padding: "6px 9px",
                    fontSize: 11,
                    color: T.ts,
                  }}
                >
                  📎 {m.anexo.nome}
                </div>
              )}
            </ChatBubble>
          ), m) : m.systemNote ? (
            <div
              style={{
                alignSelf: "center",
                fontSize: 10,
                color: m.compressNote ? AC.perp : AC.claude,
                background: m.compressNote ? `${AC.perp}12` : `${AC.claude}12`,
                border: `1px solid ${m.compressNote ? AC.perp : AC.claude}22`,
                borderRadius: 999,
                padding: "6px 10px",
                letterSpacing: 0.2,
              }}
            >
              {m.content}
            </div>
          ) : wrapMobileGestures((
            <ClaudeCardView
              m={m}
              i={i}
              msgs={msgs}
              T={T}
              AC={AC}
              CopyBtn={CopyBtn}
              Markdown={Markdown}
              showCouncil={showCouncil}
              setShowCouncil={setShowCouncil}
              isMobile={isMobile}
              toast={toast}
              beforeVerdict={
                BeforeVerdictComponent && m.modoDebate ? (
                  <BeforeVerdictComponent
                    ronda1={m.debate?.ronda1}
                    ronda2={m.debate?.ronda2}
                    ronda3={m.debate?.ronda3}
                    modoDebate={m.modoDebate}
                  />
                ) : null
              }
            >
              {/* Conselho expandido */}
              {showCouncil === m.id && m.lobeResults?.length > 0 && (
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: isMobile ? "1fr" : "repeat(auto-fit,minmax(280px,1fr))",
                    alignItems: "start",
                    gap: 10,
                    paddingTop: 2,
                  }}
                >
                  {m.lobeResults.map((l, idx) => (
                    <LobeCard
                      key={`lobe-${l.id}-${idx}`}
                      l={l}
                      idx={idx}
                      T={T}
                      phase={phase}
                      msgs={msgs}
                      i={i}
                      m={m}
                      setPhase={setPhase}
                      setMsgs={setMsgs}
                      buildMem={buildMem}
                      brain={brain}
                      invoke={invoke}
                      P={P}
                      Markdown={Markdown}
                      textosParciais={textosParciais}
                      aStreaming={aStreaming}
                    />
                  ))}
                </div>
              )}
              {sugestoesRei.length > 0 && (
                <div
                  style={{
                    display: "inline-flex",
                    gap: "8px",
                    flexWrap: "wrap",
                    marginTop: "8px",
                  }}
                >
                  {sugestoesRei.map((sugestao, idx) => (
                    <button
                      key={`sugestao-rei-${m.id || i}-${idx}`}
                      type="button"
                      onClick={() => onSuggestionClick(sugestao)}
                      style={{
                        border: "1px solid var(--accent)",
                        borderRadius: "20px",
                        padding: "4px 12px",
                        fontSize: "13px",
                        cursor: "pointer",
                        background: "transparent",
                        color: "var(--accent)",
                        transition: "background 0.2s",
                        fontFamily: "inherit",
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = "rgba(168,85,247,0.1)";
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = "transparent";
                      }}
                    >
                      {sugestao}
                    </button>
                  ))}
                </div>
              )}
            </ClaudeCardView>
          ), m)}
        </div>
          </React.Fragment>
        );
      })}
    </>
  );
});

export default MessageList;
