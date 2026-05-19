import React from "react";
import ChatBubble from "./ChatBubble";
import ErrorMessage from "./ErrorMessage.jsx";
import LobeLoader from "./LobeLoader";
import { formatLobeResponse } from "../utils/formatLobe.js";

const LobeCard = React.memo(function LobeCard({
  l,
  idx,
  T,
  phase,
  msgs,
  i,
  m,
  setPhase,
  setMsgs,
  buildMem,
  brain,
  invoke,
  P,
  Markdown,
  textosParciais,
  aStreaming,
}) {
  const streamKey = l.streamId ?? l.id;
  const textoParcial = textosParciais?.[streamKey] || textosParciais?.[l.id] || "";
  const respostaBruta = textoParcial || l.result || "";
  const respostaVisivel = formatLobeResponse(respostaBruta);
  const corLobe = l.color || l.cor || "#10b981";
  const nomeLobe = l.label || l.nome || l.id || "Lobo";

  return (
    <div
      className="lobe-card"
      style={{
        position: "relative",
        alignSelf: "start",
        height: "fit-content",
        background: T.s2,
        border: `1px solid ${corLobe}33`,
        borderRadius: 14,
        padding: "12px 12px 10px",
        boxShadow: "0 4px 14px #00000016",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 8,
          marginBottom: 8,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
          <div
            style={{
              width: 26,
              height: 26,
              borderRadius: 8,
              background: `${corLobe}20`,
              border: `1px solid ${corLobe}44`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 13,
              flexShrink: 0,
            }}
          >
            {["🔍", "💡", "⚙️", "🌐", "😈"][idx] || "🐺"}
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 11, fontWeight: 800, color: corLobe, letterSpacing: 0.3 }}>
              {nomeLobe}
            </div>
            <div
              style={{
                fontSize: 9,
                color: T.tf,
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {l.srcModel}
              {l.srcReal === false ? " · simulado" : ""}
            </div>
          </div>
        </div>

        {/* Anel de confiança, latência e botão ao mesmo nível */}
        {l.confidence != null && (
          <div
            style={{
              width: 28,
              height: 28,
              borderRadius: "50%",
              background: `conic-gradient(${corLobe} ${l.confidence * 3.6}deg, ${T.s2} 0deg)`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            <div
              style={{
                width: 20,
                height: 20,
                borderRadius: "50%",
                background: T.s2,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 8,
                color: corLobe,
                fontWeight: 800,
              }}
            >
              {l.confidence}
            </div>
          </div>
        )}
        {/* Latência */}
        {l.latency && (
          <span
            style={{
              fontSize: 8,
              color: T.tf,
              background: T.s1,
              border: `1px solid ${T.b1}`,
              borderRadius: 999,
              padding: "2px 6px",
              flexShrink: 0,
            }}
          >
            ⏱ {l.latency}ms
          </span>
        )}
        <button
          onClick={async () => {
            if (phase) return;
            const q = msgs
              .slice(0, i)
              .reverse()
              .find((x) => x.role === "user")?.content;
            if (!q) return;
            setPhase("council");
            setMsgs((prev) =>
              prev.map((msg) => {
                if (msg.id !== m.id) return msg;
                return {
                  ...msg,
                  lobeResults: (msg.lobeResults || []).map((item) =>
                    item.id === l.id
                      ? { ...item, result: "A regenerar...", isErr: false, regenerating: true }
                      : item
                  ),
                };
              })
            );
            try {
              const mem = buildMem(brain);
              const r = await invoke(l.id, P[l.id]?.(mem, q) || `Resposta: ${q}`, q);
              setMsgs((prev) =>
                prev.map((msg) => {
                  if (msg.id !== m.id) return msg;
                  return {
                    ...msg,
                    lobeResults: (msg.lobeResults || []).map((item) =>
                      item.id === l.id
                        ? {
                            ...item,
                            result: r.result,
                            srcModel: r.model,
                            srcReal: r.real,
                            isErr:
                              !r.result || r.result.startsWith("[") || r.result.startsWith("Tempo"),
                            regenerating: false,
                          }
                        : item
                    ),
                  };
                })
              );
            } catch {
              setMsgs((prev) =>
                prev.map((msg) => {
                  if (msg.id !== m.id) return msg;
                  return {
                    ...msg,
                    lobeResults: (msg.lobeResults || []).map((item) =>
                      item.id === l.id ? { ...item, regenerating: false } : item
                    ),
                  };
                })
              );
            }
            setPhase(null);
          }}
          title="Regenerar lobo"
          style={{
            width: 28,
            height: 28,
            borderRadius: 9,
            border: `1px solid ${T.b1}`,
            background: "transparent",
            color: l.regenerating ? corLobe : T.ts,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 12,
            flexShrink: 0,
          }}
        >
          {l.regenerating ? "◌" : "🔄"}
        </button>
      </div>

      <div
        style={{
          minHeight: 54,
          fontSize: 12,
          color: l.isErr ? "#fca5a5" : T.tx,
          lineHeight: 1.65,
        }}
      >
        {l.isErr && (
          <ErrorMessage error={`${nomeLobe} falhou — a usar reserva quando disponível.`} />
        )}

        {l.regenerating || (!respostaBruta && aStreaming) ? (
          <LobeLoader cor={corLobe} texto="A pensar..." />
        ) : (
          <ChatBubble papel="assistant" nome={nomeLobe} cor={corLobe}>
            <Markdown text={respostaVisivel} color={l.isErr ? "#fca5a5" : T.tx} faint={T.ts} />
            {aStreaming && textoParcial && (
              <span
                style={{
                  display: "inline-block",
                  width: "2px",
                  height: "1em",
                  background: corLobe,
                  marginLeft: "2px",
                  animation: "piscar 1s step-end infinite",
                  verticalAlign: "-0.12em",
                }}
              />
            )}
          </ChatBubble>
        )}
      </div>
    </div>
  );
});

export default LobeCard;
