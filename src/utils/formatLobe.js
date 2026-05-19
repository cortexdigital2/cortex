export function formatLobeResponse(raw) {
  if (!raw) return "";
  if (typeof raw !== "string") return String(raw);

  // 1. Tentar parse completo se for JSON válido (para respostas já finalizadas)
  try {
    const clean = raw.replace(/```json|```/g, "").trim();
    const match = clean.match(/\{[\s\S]*\}/);
    if (match) {
      const j = JSON.parse(match[0]);
      if (j.analysis || j.reasoning) {
        let out = j.analysis || "";
        
        if (j.suggestions && Array.isArray(j.suggestions)) {
          out += "\n\n" + j.suggestions.map(s => `- ${s}`).join("\n");
        }
        
        if (j.reasoning) {
          out += `\n\n**Reasoning:** ${j.reasoning}`;
        }
        return out.trim();
      }
    }
  } catch {}

  // 2. Fallback para limpeza de stream (quando o JSON ainda está a ser escrito caracter a caracter)
  let partial = raw.replace(/```json|```/g, "");
  
  // Limpar a abertura do JSON
  partial = partial.replace(/^\{\s*/, "");
  
  // Substituir as chaves principais por formatação limpa
  partial = partial.replace(/"analysis"\s*:\s*"/g, "");
  partial = partial.replace(/",\s*"reasoning"\s*:\s*"/g, "\n\n**Reasoning:** ");
  
  // Se houver um array de suggestions (Generalista Contextual costuma inventar isto), tentar limpar o array format se não estiver fechado
  // Isto é um best-effort para evitar lixo visual no ecrã.
  partial = partial.replace(/"suggestions"\s*:\s*\[/g, "\n\n");
  partial = partial.replace(/\],/g, "\n");
  
  // Limpar fecho do JSON
  partial = partial.replace(/"\s*\}\s*$/, "");
  partial = partial.replace(/"$/, ""); // se acabar a streamar uma string

  // Restaurar escapes simples
  partial = partial.replace(/\\n/g, "\n").replace(/\\"/g, '"');

  return partial.trim() || raw;
}
