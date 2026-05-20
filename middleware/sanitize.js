// middleware/sanitize.js — F4-06 v2 (hardened)

const INJECTION_PATTERNS = [
  /ignore (all |previous |above )?instructions/i,
  /you are now|act as|pretend (you are|to be)/i,
  /system\s*prompt|jailbreak|dan mode/i,
  /\[\[.*\]\]/,
  /<\|.*\|>/,
  // eslint-disable-next-line no-control-regex
  /\u0000|\u200b|\u200c|\u200d|\u200e|\u200f|\u2028|\u2029/,
  /\\u00[0-9a-f]{2}|&#x?[0-9a-f]+;/i,
  /\[SYSTEM\]|\[INST\]|\[\/INST\]|<s>|<\/s>/i,
];
const MAX_INPUT_LENGTH = 4000;
const MAX_MESSAGE_LENGTH = 60000; // Permite contextos longos agregados pelo sistema (ex: debate, veredicto do Rei)

// ← FIX 2: normalizar unicode antes de testar
function normalizeText(str) {
  return typeof str === "string" ? str.normalize("NFKC").trim() : str;
}

function checkPatterns(text, res) {
  const normalized = normalizeText(text);
  for (const p of INJECTION_PATTERNS) {
    if (p.test(normalized)) {
      // ← FIX 3: logar tentativas bloqueadas
      console.warn(
        `[SECURITY] Input bloqueado | pattern: ${p} | preview: "${normalized.slice(0, 80)}"`,
      );
      res
        .status(400)
        .json({ error: "Input bloqueado por política de segurança." });
      return false;
    }
  }
  return true;
}

function sanitize(req, res, next) {
  const { query, prompt, messages } = req.body || {};

  // texto cru
  const texto = normalizeText(query || prompt || "");
  if (typeof texto === "string" && texto.length > 0) {
    if (texto.length > MAX_INPUT_LENGTH)
      return res.status(400).json({ error: "Input demasiado longo." });
    if (!checkPatterns(texto, res)) return;
  }

  // messages array
  if (Array.isArray(messages)) {
    for (const m of messages) {
      if (!m || typeof m !== "object") continue;

      if (m.role === "system" && m._injected !== true)
        return res.status(400).json({ error: "System role não permitido." });

      // ← FIX 4: sanitizar também tool_calls nested
      const content = normalizeText(m.content || "");
      if (content.length > MAX_MESSAGE_LENGTH)
        return res.status(400).json({ error: "Mensagem demasiado longa." });
      if (!checkPatterns(content, res)) return;

      if (m.tool_calls) {
        for (const tc of m.tool_calls) {
          const args = normalizeText(
            typeof tc?.function?.arguments === "string"
              ? tc.function.arguments
              : JSON.stringify(tc?.function?.arguments || ""),
          );
          if (!checkPatterns(args, res)) return;
        }
      }
    }
  }

  next();
}

export default sanitize;
