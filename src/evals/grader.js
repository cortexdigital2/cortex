export function gradeResponse(resposta, entry) {
  let score = 0;
  // keyword match — 50 pts
  const lower = resposta.toLowerCase();
  const hits = entry.keywords_esperadas.filter(k => lower.includes(k.toLowerCase()));
  score += Math.round((hits.length / entry.keywords_esperadas.length) * 50);
  
  // comprimento adequado — 25 pts
  if (resposta.length > 200) score += 25;
  else if (resposta.length > 80) score += 10;
  
  // sem "não sei" ou "erro" — 25 pts
  const bloqueios = ["não sei", "erro", "desculpa"];
  if (!bloqueios.some(b => lower.includes(b))) score += 25;
  
  return { score, hits, max: 100 };
}
