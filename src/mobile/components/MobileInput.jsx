import useHapticFeedback from "../hooks/useHapticFeedback.js";

export default function MobileInput({
  value,
  onChange,
  onSend,
  onStop,
  inputRef,
  disabled = false,
  placeholder = "Pergunta ao conselho...",
}) {
  const haptic = useHapticFeedback();
  const podeEnviar = Boolean(value?.trim()) && !disabled;

  function enviar() {
    if (!podeEnviar) return;
    haptic.leve();
    onSend?.();
  }

  function parar() {
    haptic.medio();
    onStop?.();
  }

  return (
    <div
      role="region"
      aria-label="Entrada móvel"
      style={{
        position: "fixed",
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 1250,
        background: "var(--bg)",
        borderTop: "1px solid var(--border)",
        padding: "10px 12px calc(10px + env(safe-area-inset-bottom))",
        boxShadow: "0 -12px 32px rgba(0,0,0,0.32)",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "flex-end",
          gap: 8,
          width: "100%",
          maxWidth: 820,
          margin: "0 auto",
        }}
      >
        <textarea
          ref={inputRef}
          value={value}
          onChange={(event) => onChange?.(event.target.value)}
          placeholder={placeholder}
          disabled={disabled}
          rows={1}
          style={{
            flex: 1,
            minWidth: 0,
            minHeight: 44,
            maxHeight: 132,
            resize: "none",
            overflowY: "auto",
            boxSizing: "border-box",
            border: "1px solid var(--border)",
            borderRadius: 14,
            background: "transparent",
            color: "var(--text-h)",
            caretColor: "var(--accent)",
            fontFamily: "inherit",
            fontSize: 16,
            lineHeight: 1.35,
            padding: "11px 12px",
            outline: "none",
          }}
        />

        {onStop && (
          <button
            type="button"
            onClick={parar}
            aria-label="Parar geração"
            title="Parar geração"
            style={{
              width: 48,
              height: 44,
              borderRadius: 14,
              border: "1px solid rgba(239,68,68,0.45)",
              background: "rgba(239,68,68,0.16)",
              color: "#ef4444",
              fontSize: 18,
              fontWeight: 800,
              fontFamily: "inherit",
              cursor: "pointer",
              flexShrink: 0,
            }}
          >
            ■
          </button>
        )}

        <button
          type="button"
          onClick={enviar}
          disabled={!podeEnviar}
          aria-label="Enviar"
          title="Enviar"
          style={{
            width: 48,
            height: 44,
            borderRadius: 14,
            border: "none",
            background: podeEnviar ? "var(--accent)" : "var(--border)",
            color: podeEnviar ? "#ffffff" : "var(--text-h)",
            fontSize: 16,
            fontWeight: 900,
            fontFamily: "inherit",
            cursor: podeEnviar ? "pointer" : "not-allowed",
            opacity: podeEnviar ? 1 : 0.55,
            flexShrink: 0,
          }}
        >
          ▶
        </button>
      </div>
    </div>
  );
}
