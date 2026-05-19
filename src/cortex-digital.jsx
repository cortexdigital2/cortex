import { useState, useEffect, useRef, useCallback } from "react";
import KingCard from './components/KingCard';
import MessageList from './components/MessageList';
import DebateTimeline from './components/DebateTimeline';
import BlueprintsPanel from './components/BlueprintsPanel';
import EvalsPanel from './components/EvalsPanel'
import FileUpload from './components/FileUpload.jsx';
import AlertaBanner from './components/AlertaBanner.jsx';
import EstadoVazio from './components/EstadoVazio.jsx';
import SidePanel from './components/SidePanel.jsx';
import Slider from './components/Slider.jsx';
import MemoryBanner from './components/MemoryBanner.jsx';
import Toast, { useToast } from './components/Toast.jsx';
import FrustrationBanner from './components/FrustrationBanner.jsx';
import CouncilGrid from './components/CouncilGrid.jsx';
import useCouncil from './hooks/useCouncil';
import { useAutoResize } from "./hooks/useAutoResize.js";
import { useStreaming } from "./hooks/useStreaming.js";
import { ouvirMicrofone } from "./hooks/useVoice.js";
import { LOBOS, runDebateStream as runDebateStreamApi, SYSTEM_PROMPTS_CODE } from "./api/council.js";
import { getUserId } from "./lib/auth.js";
import { generateChips } from "./utils/generateChips.js";
import { gerarChipsLocais } from "./utils/generateChips.js";
import {
  clearMemory,
  injectSessionContext,
  shouldShowMemoryBanner,
} from "./utils/sessionMemory.js";

const MV="cortex-v12";
const MAX_BUF=8;
const COMPRESS_THRESHOLD = 20; 
const COMPRESS_KEEP_TAIL = 6;
const MAX_SEMANTIC=80;
const MAX_PATTERNS=12;
const MAX_EPISODIC=15;
const MAX_STORED=200;
const BUILD = typeof __BUILD_NUM__ !== "undefined" ? __BUILD_NUM__ : "DEV";
const APP_VERSION = `v12.${BUILD}`;

const THEMES={
  cortex:    {name:"Córtex",     emoji:"🧠",bg:"#08080c",s1:"#0f0f16",s2:"#14141e",s3:"#1a1a26",b1:"#222232",b2:"#161622",tx:"#e8e8f8",ts:"#6868a0",tf:"#2a2a44"},
  grok:      {name:"Grok",       emoji:"⚡",bg:"#060608",s1:"#0d0d10",s2:"#121215",s3:"#181820",b1:"#202025",b2:"#141418",tx:"#f0f0f8",ts:"#505060",tf:"#1e1e28"},
  neural:    {name:"Neural",     emoji:"🔬",bg:"#04060a",s1:"#080c14",s2:"#0c1020",s3:"#101828",b1:"#162030",b2:"#0e1828",tx:"#d8ecff",ts:"#3a6090",tf:"#0c1828"},
  obsidian:  {name:"Obsidian",   emoji:"🪨",bg:"#0a0a0a",s1:"#111111",s2:"#161616",s3:"#1e1e1e",b1:"#252525",b2:"#1c1c1c",tx:"#eeeeee",ts:"#666666",tf:"#2a2a2a"},
  midnight:  {name:"Midnight",   emoji:"🌙",bg:"#03030f",s1:"#07071a",s2:"#0a0a22",s3:"#0e0e2e",b1:"#14143a",b2:"#0d0d2a",tx:"#d0d0ff",ts:"#5050a0",tf:"#14143a"},
  gemini:    {name:"Gemini",     emoji:"🌀",bg:"#070a0f",s1:"#0c1018",s2:"#101520",s3:"#141a28",b1:"#1c2638",b2:"#141e30",tx:"#d8e4ff",ts:"#4a6898",tf:"#182040"},
  perplexity:{name:"Perplexity", emoji:"🔷",bg:"#090a0e",s1:"#10111a",s2:"#14151e",s3:"#181924",b1:"#202230",b2:"#181928",tx:"#e4e8ff",ts:"#5060a0",tf:"#202040"},
  crimson:   {name:"Crimson",    emoji:"🔴",bg:"#0e0608",s1:"#180a0c",s2:"#200e10",s3:"#261216",b1:"#2e1418",b2:"#200e10",tx:"#f0d0d4",ts:"#905060",tf:"#2e1418"},
  amber:     {name:"Amber",      emoji:"🟡",bg:"#0c0800",s1:"#180f00",s2:"#201500",s3:"#281c00",b1:"#302000",b2:"#201500",tx:"#fff0c0",ts:"#a07830",tf:"#302000"},
  forest:    {name:"Forest",     emoji:"🌿",bg:"#060c08",s1:"#0a120c",s2:"#0e1810",s3:"#121e14",b1:"#1a2e1c",b2:"#121e14",tx:"#d0e8d4",ts:"#5a9060",tf:"#182818"},
  violet:    {name:"Violet",     emoji:"🟣",bg:"#0c0712",s1:"#120a1c",s2:"#180e26",s3:"#1e1230",b1:"#261838",b2:"#160e22",tx:"#e0d0ff",ts:"#7060a0",tf:"#1e1430"},
  teal:      {name:"Teal",       emoji:"🩵",bg:"#03100e",s1:"#051816",s2:"#07201e",s3:"#0a2826",b1:"#0e3030",b2:"#0a2828",tx:"#c0f0f0",ts:"#309898",tf:"#0e3030"},
  light:     {name:"Claro",      emoji:"☀️",bg:"#f4f3f0",s1:"#ffffff",s2:"#eeede8",s3:"#e6e4de",b1:"#d0cdc6",b2:"#dbd8d0",tx:"#181816",ts:"#666056",tf:"#aaa898"},
  paper:     {name:"Paper",      emoji:"📄",bg:"#f8f6f0",s1:"#fffef8",s2:"#f0ece0",s3:"#e8e0d0",b1:"#d8d0c0",b2:"#e8e0d0",tx:"#2a2416",ts:"#7a7060",tf:"#c0b898"},
  // ── Novos temas v11 ──
  anthropic: {name:"Anthropic",  emoji:"🟠",bg:"#0d0b08",s1:"#141210",s2:"#1c1916",s3:"#231f1b",b1:"#302820",b2:"#241e18",tx:"#faf9f5",ts:"#b0aea5",tf:"#4a3828"},
  ocean:     {name:"Ocean",      emoji:"🌊",bg:"#020d14",s1:"#041420",s2:"#06192a",s3:"#082034",b1:"#0c2a42",b2:"#071a2c",tx:"#c8eeff",ts:"#3a7a9c",tf:"#0c2030"},
  arctic:    {name:"Arctic",     emoji:"🧊",bg:"#040810",s1:"#070c18",s2:"#0a1020",s3:"#0d1428",b1:"#121c38",b2:"#0a1020",tx:"#ddeeff",ts:"#5580aa",tf:"#182038"},
  sunset:    {name:"Sunset",     emoji:"🌅",bg:"#0e0608",s1:"#180c08",s2:"#22100c",s3:"#2c1410",b1:"#341810",b2:"#240e0a",tx:"#ffeedd",ts:"#cc6644",tf:"#4a1e14"},
  matrix:    {name:"Matrix",     emoji:"💚",bg:"#000d00",s1:"#011201",s2:"#011802",s3:"#021e02",b1:"#032a03",b2:"#021802",tx:"#00ff41",ts:"#007a1e",tf:"#003010"},
  sakura:    {name:"Sakura",     emoji:"🌸",bg:"#0e050a",s1:"#160810",s2:"#1e0c16",s3:"#26101e",b1:"#2e1428",b2:"#200c18",tx:"#ffd0e8",ts:"#c06090",tf:"#401030"},
  slate:     {name:"Slate",      emoji:"🪞",bg:"#0c0e10",s1:"#111418",s2:"#161a1e",s3:"#1c2028",b1:"#222830",b2:"#181c22",tx:"#d8dde8",ts:"#6070a0",tf:"#242a38"},
};

const AC={
  grok:"#f59e0b",gemini:"#8b5cf6",perp:"#0ea5e9",genspark:"#ff6b6b",
  manus:"#22d3ee",claude:"#10b981",reflex:"#6366f1",
  openai:"#74aa9c",deepseek:"#4d9fff",llama:"#e879f9",mistral:"#f97316",nemotron:"#a3e635",
  ollama_codigo:"#634b37",ollama_debug:"#c9c17f"
};
// ── URLs DAS CHAVES — para busca automática quando a chave expira ─────────────
const KEY_URLS={
  grok:      "console.x.ai",
  gemini:    "aistudio.google.com/apikey",
  perp:      "console.groq.com/keys",
  openai:    "platform.openai.com/api-keys",
  deepseek:  "platform.deepseek.com/api_keys",
  llama:     "console.groq.com/keys",
  mistral:   "console.mistral.ai/api-keys",
  nemotron:  "build.nvidia.com",
  claude:    "console.anthropic.com/settings/keys",
};

// ── MODO DE DESENVOLVIMENTO — acesso sem PIN ─────────────────────────────────
// Para ativar: localStorage.setItem("cortex-dev-bypass","1")  → recarrega
// Para revogar: localStorage.removeItem("cortex-dev-bypass")  → recarrega
const DEV_MODE = localStorage.getItem("cortex-dev-bypass") === "1";

const LOBE_ICONS = ["◉", "◈", "◐", "◑", "◒"];
const lobeLabel = (l) => l.label || l.nome || String(l.id);
const lobeColor = (l) => l.color || l.cor || AC.claude;
const MODELS = LOBOS.map((l) => ({
  id: l.id,
  name: l.nome,
  version: l.modelo,
  color: l.cor,
}));

const defaultBrain={episodic:[],semantic:[],patterns:[],procedural:{format:"conciso",lang:"pt",level:"médio"},sessions:0,lastReflect:null};
const defaultKeys = {
  grok:"",
  gemini:"", 
  perp:"", 
  claude:"",
  openai:"", 
  deepseek:"", 
  llama:"",
  mistral:"", 
  nemotron:"", 
  genspark:"", 
  manus:""
};

// ── PIN DE DESENVOLVIMENTO — muda em localStorage("cortex-dev-pin") ────────
const DEV_PIN_KEY="cortex-dev-pin";
function getDevPin(){return localStorage.getItem(DEV_PIN_KEY)||"3004";}

// ── ARMAZENAMENTO SEGURO ────────────────────────────────────────────
async function safeGet(key,fallback){
  try{const local=localStorage.getItem(key);if(local)return JSON.parse(local)??fallback;}catch{}
  try{const r=await window.storage.get(key);if(!r?.value)return fallback;return JSON.parse(r.value)??fallback;}
  catch{return fallback;}
}
async function safePut(key,val){
  try{localStorage.setItem(key,JSON.stringify(val));}catch{}
  try{await window.storage.set(key,JSON.stringify(val));}catch{}
}

function normBrain(r){
  if(!r||typeof r!=="object")return{...defaultBrain};
  return{
    episodic:Array.isArray(r.episodic)?r.episodic:[],
    semantic:Array.isArray(r.semantic)?r.semantic:[],
    patterns:Array.isArray(r.patterns)?r.patterns:[],
    procedural:r.procedural&&typeof r.procedural==="object"?{...defaultBrain.procedural,...r.procedural}:{...defaultBrain.procedural},
    sessions:typeof r.sessions==="number"?r.sessions:0,
    lastReflect:r.lastReflect||null,
  };
}

// ── AUXILIARES ──────────────────────────────────────────────────
function buildMem(b){
  const p=[];
  if(b.semantic.length)p.push("FACTOS:\n"+b.semantic.slice(-15).map(s=>`• [${s.tipo}] ${s.descricao}`).join("\n"));
  if(b.episodic.length)p.push("PASSADO:\n"+b.episodic.slice(-5).map(e=>`• ${e}`).join("\n"));
  if(b.patterns.length)p.push("PADRÕES:\n"+b.patterns.map(x=>`• ${x}`).join("\n"));
  return p.join("\n\n")||"Vazio.";
}
function selectUsedMem(brain,q){
  const ql=q.toLowerCase();
  const scored=brain.semantic.map(s=>({text:`[${s.tipo}] ${s.descricao}`,score:ql.split(" ").filter(w=>w.length>3&&s.descricao.toLowerCase().includes(w)).length}));
  scored.sort((a,b)=>b.score-a.score);
  return[...scored.slice(0,3).map(s=>s.text),...brain.episodic.slice(-2)].filter(Boolean).slice(0,5);
}
function heuristicDecision(q){
  const s=q.toLowerCase();
  if(/c[oó]digo|code|programar|script|bug|erro|implementar/.test(s))return"Pergunta técnica → priorizei DeepSeek + Córtex.";
  if(/hoje|atual|notícia|recente|2025|2026|mercado|preço/.test(s))return"Pergunta factual → priorizei Perplexity + Grok.";
  if(/porquê|filosofia|contexto|história|tendência|futuro/.test(s))return"Pergunta conceptual → priorizei Gemini + Nemotron.";
  if(/\beu\b|\bmeu\b|\bminha\b|pessoal|objetivo|estudo|curso/.test(s))return"Pergunta pessoal → memória semântica + Córtex.";
  return"Pergunta mista → o Córtex combinou todos os lobos.";
}
function seedToMem(text,tipo){
  return text.split(/[.\n]/).map(s=>s.trim()).filter(s=>s.length>20).slice(0,3).map(s=>({tipo,descricao:s.slice(0,160),importancia:"alta"}));
}
function safeParseReflect(raw){
  try{
    const p=JSON.parse(raw.replace(/```json|```/g,"").trim());
    return{new_semantic:Array.isArray(p.new_semantic)?p.new_semantic:[],new_patterns:Array.isArray(p.new_patterns)?p.new_patterns:[],procedural_update:(p.procedural_update&&typeof p.procedural_update==="object")?p.procedural_update:{},session_summary:typeof p.session_summary==="string"?p.session_summary:""};
  }catch{return{new_semantic:[],new_patterns:[],procedural_update:{},session_summary:""};}
}

// ── INSTRUÇÕES DOS MODELOS ──────────────────────────────────────────────────
function detectLang(){return "Responde em Português de Portugal.";}
const P={
  grok:    (m,q)=>`És o GROK — especialista em factos. Dá dados concretos e precisos. Sem introdução. Memória:\n${m}\nPergunta: ${q}\nMáx. 100 palavras. ${detectLang(q)}`,
  gemini:  (m,q)=>`És o GEMINI — pensador sistémico. Encontra padrões e visão de conjunto. Memória:\n${m}\nPergunta: ${q}\nMáx. 100 palavras. ${detectLang(q)}`,
  perp:    (m,q)=>`És o PERPLEXITY — informação actual. Dá informação recente, precisa e com fontes. Memória:\n${m}\nPergunta: ${q}\nMáx. 100 palavras. ${detectLang(q)}`,
  genspark:(m,q)=>`És o GENSPARK — síntese criativa. Traz ângulos novos e soluções inesperadas. Memória:\n${m}\nPergunta: ${q}\nMáx. 100 palavras. ${detectLang(q)}`,
  manus:   (m,q)=>`És o MANUS — agente autónomo e planeador de execução passo a passo.\nMEMÓRIA:\n${m}\nPEDIDO: "${q}"\nPassos agentivos, ferramentas e acções. Máx. 120 palavras. Sem introdução. Português de Portugal.`,
  openai:  (m,q)=>`És um especialista em raciocínio. Faz análise estruturada e clara. Memória:\n${m}\nPergunta: ${q}\nMáx. 100 palavras. ${detectLang(q)}`,
  deepseek:(m,q)=>`És o DEEPSEEK — especialista em código e lógica. Para código, usa blocos markdown. Memória:\n${m}\nPergunta: ${q}\nMáx. 100 palavras. ${detectLang(q)}`,
  llama:   (m,q)=>`És o LLAMA — conhecimento comunitário amplo e experiência prática em código aberto. Memória:\n${m}\nPergunta: ${q}\nMáx. 100 palavras. ${detectLang(q)}`,
  mistral: (m,q)=>`És o MISTRAL — rápido e preciso. Sem enchimento. Memória:\n${m}\nPergunta: ${q}\nMáx. 80 palavras. ${detectLang(q)}`,
  nemotron:(m,q)=>`És o NEMOTRON — rigor científico. Usa evidência e cita mecanismos. Memória:\n${m}\nPergunta: ${q}\nMáx. 100 palavras. ${detectLang(q)}`,
  ollama_codigo:(m,q)=>`Assistente local de código. Dá código limpo e funcional com explicação breve. Memória:\n${m}\nPergunta: ${q}\nMáx. 100 palavras. ${detectLang(q)}`,
  ollama_debug:(m,q)=>`Especialista local de debug. Encontra a causa raiz e dá a correcção exacta. Memória:\n${m}\nPergunta: ${q}\nMáx. 100 palavras. ${detectLang(q)}`,
  compress: (msgs) => `Resume este histórico de conversa num parágrafo compacto (máx. 80 palavras). Mantém factos, decisões e contexto essencial. Sem introdução.\n\n${msgs.join("\n")}`,
cortex: (m, q, lobes) => `
Tu és o Córtex Pré-Frontal — o juiz e sintetizador de um conselho multi-IA.
Regras obrigatórias:
1. Responde sempre em Português de Portugal.
2. Identifica as respostas mais úteis, resolve contradições e sintetiza numa única resposta abrangente.
3. Se houver código, usa markdown.
4. NÃO escrevas introduções, nem números antes das frases, nem "⚡ Síntese:".
5. Usa citações inline obrigatórias no campo "final": após cada afirmação coloca [NomeLobo] entre parênteses retos. Exemplo: "A solução mais eficiente é usar indexação. [DeepSeek] No entanto, para dados pequenos uma pesquisa linear pode bastar. [Grok][Gemini]"
6. Se não tiveres dados suficientes para afirmar algo, escreve [Incerto] em vez de inventar.
7. Devolve APENAS um objeto JSON válido (sem markdown), com esta estrutura exata:
{
  "final": "resposta com citações inline [NomeLobo] após cada afirmação",
  "consensus": ["ponto concordante 1", "ponto concordante 2"],
  "divergence": ["ponto de divergência 1"],
  "confidence": "alta|média|baixa",
  "nextActions": ["passo 1", "passo 2"],
  "sources": ["Lobo1", "Lobo2"]
}


MEMÓRIA:
${m}


PERGUNTA DO UTILIZADOR:
${q}


RESPOSTAS DOS LOBOS DO CONSELHO:
${lobes.map(l => "[ " + l.label + " ]: " + l.result).join("\n\n")}
`.trim(),

  refine: (q) => `
És um optimizador de perguntas para um conselho multi-IA.
Reescreve a pergunta do utilizador para ficar mais clara, específica e adequada a análise paralela por IA.
Regras:
- Português de Portugal
- Máx. 2 frases
- Remove ambiguidades e acrescenta contexto implícito quando for óbvio
- Devolve APENAS a pergunta reescrita, sem explicação
Original: "${q}"
`.trim(),

  judge: (q, lobeResults) => `És o juiz de um conselho de IA com 11 lobos.
Pergunta: "${q}"
Respostas dos lobos:
${lobeResults.map(l => `[${l.label}]: ${l.result?.slice(0, 120)}`).join("\n")}
Escreve UMA frase (máx. 80 palavras) em Português de Portugal a explicar que lobos foram mais úteis e porquê. Sem listas.`.trim(),

reflect: (buf, mem) => `Analisa esta conversa e devolve APENAS JSON válido, sem markdown.
Estrutura obrigatória:
{
  "new_semantic": [{"tipo": "string", "descricao": "string", "importancia": "alta|média|baixa"}],
  "new_patterns": ["padrão 1", "padrão 2"],
  "procedural_update": {"format": "conciso|detalhado", "lang": "pt", "level": "básico|médio|avançado"},
  "session_summary": "resumo da sessão em 1 frase"
}
Regras: new_semantic máx 5 itens; new_patterns máx 3; só factos novos não presentes na memória.
MEMÓRIA ATUAL:
${mem}
CONVERSA:
${buf}`.trim(),
};
const OLLAMA_URL = "http://localhost:3333/ollama";
const OLLAMA_MODELS = {
  codigo:   "qwen2.5-coder:1.5b",
  debug:    "qwen2.5-coder:1.5b",
  conversa: "qwen2.5-coder:1.5b",
  fallback: "qwen2.5-coder:1.5b",
};

async function callOllama(sys, msg, modelKey = "codigo", signal) {
  const model = OLLAMA_MODELS[modelKey] || OLLAMA_MODELS.codigo;
  const prompt = `${sys}\n\nPERGUNTA: ${msg}\n\nResponde em Português de Portugal. Máx. 120 palavras.`;
  const r = await fetch(OLLAMA_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model, prompt }),
    signal
  });
  if (!r.ok) throw new Error("Ollama " + r.status);
  const d = await r.json();
  return (d.response || "").trim();
}
const LOBOS_IDS = LOBOS.map((l) => l.id);
const COMPLEXITY_SIMPLE_LOBES = [2];
const COMPLEXITY_MEDIUM_LOBES = [1, 2, 5];

function classifyQuery(q) {
  try {
    const words = q.trim().split(/\s+/).length;
    const s = q.toLowerCase();

    if (words < 8 && /^(olá|oi|bom dia|boa tarde|obrigad|ok|sim|não|certo|fixe|hey|hi|hello)/.test(s))
      return "SIMPLE";

    const complexPatterns = /porquê|porque\s|como\s|compara|analisa|debate|diferença|vantagens?|desvantagens?|explica|impacto|estratégia|avalia|crítica|pros\s|contras\s|trade.?off/i;
    if (complexPatterns.test(s) || words > 25) return "COMPLEX";

    return "MEDIUM";
  } catch {
    return "COMPLEX"; // falha silenciosa → todos os lobos
  }
}

function routerDecide(query) {
  const q = query.toLowerCase();
  const level = classifyQuery(query);

  if (level === "SIMPLE") return COMPLEXITY_SIMPLE_LOBES;

  const isCode    = /código|code|programar|script|bug|erro|implementar|react|js|python|jsx/.test(q);
  const isDebug   = /debug|problema|falha|crash|corrig|fix|não funciona/.test(q);
  const isCurrent = /hoje|atual|recente|2026|notícia|mercado|preço/.test(q);
  const isPlan    = /plano|etapas|passos|estratégia|roadmap|arquitetura/.test(q);

  if (level === "MEDIUM") {
    if (isCode && isDebug) return [1, 3, 5];
    if (isCode)            return [1, 3, 2];
    if (isCurrent)         return [1, 4, 5];
    if (isPlan)            return [2, 3, 4];
    return COMPLEXITY_MEDIUM_LOBES;
  }

  // COMPLEX → corre os 5 lobos oficiais do conselho v12.
  if (isCode && isDebug) return LOBOS_IDS;
  if (isCode)            return LOBOS_IDS;
  if (isCurrent)         return LOBOS_IDS;
  if (isPlan)            return LOBOS_IDS;
  return LOBOS_IDS; // geral complexo
}

// ── CHAMADAS À API ────────────────────────────────────────────────
async function callProxyChat(model, sys, msg, tokens=420) {
  const r = await fetchWithTimeout("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model, system: sys, messages: [{ role: "user", content: msg }], max_tokens: tokens })
  });
  const d = await r.json();
  if(d.error) throw new Error(d.error);
  return d.content||"";
}

async function callClaude(sys, msg, tokens=700) {
  // Chaves ficam sempre no servidor; esta reserva usa apenas modelos gratuitos via OpenRouter.
  try {
    return await callProxyChat("google/gemini-2.5-pro-exp-03-25:free", sys, msg, tokens);
  } catch {
    return callProxyChat("meta-llama/llama-3.3-70b-instruct:free", sys, msg, tokens);
  }
}

// ── PEDIDOS COM TIMEOUT ─────────────────────────────────────
async function fetchWithTimeout(url, opts={}, ms=30000){
  const ctrl=new AbortController();
  const tid=setTimeout(()=>ctrl.abort(),ms);
  try{
    const r=await fetch(url,{...opts,signal:ctrl.signal});
    clearTimeout(tid);
    return r;
  }catch(e){
    clearTimeout(tid);
    if(e.name==="AbortError")throw new Error(`Timeout após ${ms/1000}s`);
    throw e;
  }
}

// ── MARKDOWN ─────────────────────────────────────────────────
function Markdown({text,color,faint}){
  const lines=text.split("\n");
  const out=[];let i=0;
  while(i<lines.length){
    const line=lines[i];
    if(line.startsWith("```")){
      const lang=line.slice(3).trim();const code=[];i++;
      while(i<lines.length&&!lines[i].startsWith("```")){code.push(lines[i]);i++;}
      out.push(<div key={`md-code-${i}-${code.length}`} style={{marginTop:6,marginBottom:6}}>{lang&&<div style={{fontSize:9,color:faint,fontFamily:"monospace",marginBottom:2}}>{lang}</div>}<pre style={{margin:0,padding:"9px 12px",background:"#0d0d18",border:"1px solid #2a2a3a",borderRadius:8,fontSize:11,lineHeight:1.6,color:"#c8d3f5",overflowX:"auto",fontFamily:"monospace",whiteSpace:"pre"}}>{code.join("\n")}</pre></div>);
      i++;continue;
    }
    if(line.startsWith("### ")){out.push(<div key={`md-h3-${i}-${line.slice(4,14)}`} style={{fontSize:13,fontWeight:700,color,marginTop:8,marginBottom:2}}>{iFmt(line.slice(4))}</div>);i++;continue;}
    if(line.startsWith("## ")) {out.push(<div key={`md-h2-${i}-${line.slice(3,13)}`} style={{fontSize:14,fontWeight:800,color,marginTop:10,marginBottom:3}}>{iFmt(line.slice(3))}</div>);i++;continue;}
    if(line.startsWith("# "))  {out.push(<div key={`md-h1-${i}-${line.slice(2,12)}`} style={{fontSize:15,fontWeight:800,color,marginTop:12,marginBottom:4}}>{iFmt(line.slice(2))}</div>);i++;continue;}
    if(/^[-*•] /.test(line)){out.push(<div key={`md-bullet-${i}-${line.slice(2,12)}`} style={{display:"flex",gap:6,marginTop:2}}><span style={{color:faint,flexShrink:0}}>•</span><span>{iFmt(line.slice(2))}</span></div>);i++;continue;}
    if(/^\d+\. /.test(line)){const n=line.match(/^(\d+)\. /)[1];out.push(<div key={`md-number-${i}-${n}`} style={{display:"flex",gap:6,marginTop:2}}><span style={{color:faint,flexShrink:0,minWidth:14}}>{n}.</span><span>{iFmt(line.replace(/^\d+\. /,""))}</span></div>);i++;continue;}
    if(line.startsWith("> ")){out.push(<div key={`md-quote-${i}-${line.slice(2,12)}`} style={{borderLeft:`2px solid ${faint}`,paddingLeft:10,margin:"4px 0",color:faint,fontSize:12,fontStyle:"italic"}}>{iFmt(line.slice(2))}</div>);i++;continue;}
    if(/^---+$/.test(line.trim())){out.push(<hr key={`md-hr-${i}-${line.length}`} style={{border:"none",borderTop:"1px solid #2a2a3a",margin:"8px 0"}}/>);i++;continue;}
    if(line.trim()===""){out.push(<div key={`md-empty-${i}`} style={{height:5}}/>);i++;continue;}
    out.push(<div key={`md-line-${i}-${line.slice(0,10)}`} style={{marginTop:1,lineHeight:1.75}}>{iFmt(line)}</div>);i++;
  }
  return <div style={{fontSize:13,color,display:"flex",flexDirection:"column",gap:1,wordBreak:"break-word"}}>{out}</div>;
}
function iFmt(text){
  const parts=[];const rx=/(\*\*(.+?)\*\*|\*(.+?)\*|`(.+?)`)/g;let last=0,m;
  while((m=rx.exec(text))!==null){
    if(m.index>last)parts.push(text.slice(last,m.index));
    if(m[2]!==undefined)parts.push(<b key={m.index} style={{fontWeight:700}}>{m[2]}</b>);
    else if(m[3]!==undefined)parts.push(<em key={m.index}>{m[3]}</em>);
    else if(m[4]!==undefined)parts.push(<code key={m.index} style={{background:"#1a1a2e",padding:"1px 5px",borderRadius:4,fontSize:11,fontFamily:"monospace",color:"#7dd3fc"}}>{m[4]}</code>);
    last=m.index+m[0].length;
  }
  if(last<text.length)parts.push(text.slice(last));
  if(text.startsWith("⚡"))return <span style={{fontWeight:700,color:"#f59e0b"}}>{parts.length?parts:text}</span>;
  return parts.length?parts:text;
}

function CopyBtn({text,T,t}){
  const [copied,setCopied]=useState(false);
  return <button onClick={()=>{navigator.clipboard?.writeText(text).then(()=>{setCopied(true);setTimeout(()=>setCopied(false),1800);});}} title={t?.answer?.copy || "Copiar"} style={{background:"transparent",border:`1px solid ${T.b1}`,borderRadius:5,padding:"2px 7px",color:copied?"#10b981":T.tf,fontSize:9,cursor:"pointer",transition:"color 0.2s"}}>{copied?(t?.answer?.copied || "✓ copiado"):(t?.answer?.copy || "⎘ copiar")}</button>;
}

function Toggle({on,onChange,color}){
  return <button onClick={()=>onChange(!on)} style={{width:36,height:20,borderRadius:10,background:on?color:"#444",border:"none",cursor:"pointer",position:"relative",transition:"background 0.2s",flexShrink:0}}>
    <div style={{width:14,height:14,borderRadius:"50%",background:"white",position:"absolute",top:3,left:on?19:3,transition:"left 0.2s",boxShadow:"0 1px 4px #00000044"}}/>
  </button>;
}

function Splash(){
  return <div style={{display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",height:"100dvh",background:"#08080c",gap:14}}>
    <div style={{display:"flex",gap:8}}>{Object.values(AC).slice(0,8).map((c,i)=><div key={`accent-${i}-${c}`} style={{width:10,height:10,borderRadius:"50%",background:c,animation:`orb 1.4s ${i*0.18}s ease-in-out infinite`}}/>)}</div>
    <p style={{color:AC.claude,fontFamily:"monospace",fontSize:11,margin:0,letterSpacing:2}}>CÓRTEX {APP_VERSION}</p>
    <style>{`@keyframes orb{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.2;transform:scale(1.4)}}`}</style>
  </div>;
}

function Modal({T,title,onClose,children}){
  return (
    <div
      onClick={e=>{if(e.target===e.currentTarget)onClose();}}
      style={{
        position:"fixed",inset:0,background:"#00000099",zIndex:1000,
        display:"flex",alignItems:"center",justifyContent:"center",padding:14,
        animation:"modalFadeIn 220ms cubic-bezier(0.4,0,0.2,1)"
      }}
    >
      <div style={{
        background:T.s1,
        border:`1px solid ${T.b1}`,
        borderRadius:17,
        padding:18,
        maxWidth:520,
        width:"100%",
        maxHeight:"84vh",
        overflowY:"auto",
        display:"flex",
        flexDirection:"column",
        gap:11,
        boxShadow:"0 20px 60px #00000088",
        animation:"modalSlideIn 220ms cubic-bezier(0.4,0,0.2,1)"
      }}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between"}}>
          <h3 style={{margin:0,fontSize:13,fontWeight:800,color:T.tx}}>{title}</h3>
          <button
            onClick={onClose}
            style={{
              background:"transparent",border:"none",cursor:"pointer",
              color:T.ts,fontSize:17,lineHeight:1,
              width:32,height:32,display:"flex",alignItems:"center",justifyContent:"center",
              borderRadius:"50%",transition:"background 220ms cubic-bezier(0.4,0,0.2,1)"
            }}
          >✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}

function KeyRow({ api, T, value, onChange }) {
  const [draft, setDraft] = useState(value);
  const [show, setShow] = useState(false);
  const [status, setStatus] = useState(null);
  const active = value?.trim().length > 10;
  const dirty = draft !== value;

  // Auto-guardar quando perde foco
  const handleBlur = () => {
    if (dirty && draft.trim().length > 10) onChange(draft);
  };

  async function testKey() {
    if (draft.trim().length < 10) return;
    setStatus("testing");
    try {
      const modelByApi = {
        gemini: "google/gemini-2.5-flash",
        grok: "x-ai/grok-3",
        perp: "perplexity/sonar",
        openai: "openai/gpt-4o",
        deepseek: "deepseek/deepseek-chat",
      };
      const r = await fetchWithTimeout("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: modelByApi[api.id] || "meta-llama/llama-3.3-70b-instruct:free",
          messages: [{ role: "user", content: "olá" }],
          max_tokens: 5,
        }),
      });
      const d = await r.json();
      const ok = r.ok && !d.error && typeof d.content === "string";
      setStatus(ok ? "ok" : "err");
    } catch { setStatus("err"); }
    setTimeout(() => setStatus(null), 3000);
  }

  return (
    <div style={{ background: T.s2, borderRadius: 11, padding: "9px 11px" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 5 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <div style={{ width: 6, height: 6, borderRadius: "50%", background: active ? api.color : T.b2,
            boxShadow: active ? `0 0 6px ${api.color}` : "none", transition: "all 0.3s" }} />
          <span style={{ fontSize: 11, fontWeight: 600, color: T.tx }}>{api.label}</span>
          <span style={{ fontSize: 9, color: T.ts }}>{api.desc}</span>
        </div>
        <span style={{ fontSize: 9, fontWeight: 600, padding: "2px 7px", borderRadius: 20,
          background: active ? `${api.color}22` : T.s1, border: `1px solid ${active ? `${api.color}44` : T.b1}`,
          color: active ? api.color : T.tf }}>
          {active ? "Activa" : "Simulada"}
        </span>
      </div>
      <div style={{ display: "flex", gap: 5 }}>
        <input
          type={show ? "text" : "password"}
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onBlur={handleBlur}
          onKeyDown={e => { if (e.key === "Enter") { onChange(draft); e.target.blur(); } }}
          placeholder={api.ph}
          style={{ flex: 1, background: T.s1, border: `1px solid ${active ? `${api.color}55` : T.b1}`,
            borderRadius: 8, padding: "6px 9px", color: T.tx, fontSize: 10, fontFamily: "monospace", outline: "none" }}
        />
        <button onClick={() => setShow(v => !v)}
          style={{ background: T.s1, border: `1px solid ${T.b1}`, borderRadius: 8, width: 32, height: 32,
            cursor: "pointer", fontSize: 11, color: T.ts, display: "flex", alignItems: "center", justifyContent: "center" }}>
          {show ? "🙈" : "👁"}
        </button>
      </div>
      <div style={{ display: "flex", gap: 5, marginTop: 5 }}>
        <button onClick={testKey} disabled={draft.trim().length < 10 || status === "testing"}
          style={{ flex: 1, background: T.s1, border: `1px solid ${T.b1}`, borderRadius: 8, padding: "5px 0",
            cursor: "pointer", fontSize: 10, fontFamily: "inherit", fontWeight: status ? 700 : 400,
            color: status === "ok" ? "#10b981" : status === "err" ? "#ef4444" : T.ts }}>
          {status === "testing" ? "A testar..." : status === "ok" ? "Válida" : status === "err" ? "Inválida" : "Testar"}
        </button>
        <button onClick={() => onChange(draft)} disabled={!dirty}
          style={{ flex: 1, background: dirty ? `${api.color}22` : T.s1,
            border: `1px solid ${dirty ? `${api.color}66` : T.b1}`, borderRadius: 8, padding: "5px 0",
            cursor: dirty ? "pointer" : "default", fontSize: 10, fontFamily: "inherit", fontWeight: dirty ? 700 : 400,
            color: dirty ? api.color : T.tf, transition: "all 0.2s" }}>
          {dirty ? "Guardar" : "Guardado"}
        </button>
      </div>
      <a href={`https://${api.link}`} target="_blank" rel="noreferrer"
        style={{ fontSize: 8, color: T.tf, textDecoration: "none", marginTop: 3, display: "inline-block" }}>
        {api.link} ↗
      </a>
    </div>
  );
}
function btn(T,color){return{background:`${color}18`,border:`1px solid ${color}33`,borderRadius:10,padding:"6px 12px",color,cursor:"pointer",fontSize:11,fontFamily:"inherit",fontWeight:600,whiteSpace:"nowrap",transition:"all 0.22s cubic-bezier(0.4,0,0.2,1)",boxShadow:"0 1px 4px #00000022"};}
function navBtn(T){
  return {
    background:"transparent",
    border:`1px solid ${T.b1}`,
    borderRadius:10,
    padding:"8px 10px",
    minWidth:44,
    minHeight:44,
    color:T.ts,
    cursor:"pointer",
    fontSize:12,
    flexShrink:0,
    transition:"all 220ms cubic-bezier(0.4,0,0.2,1)",
    userSelect:"none"
  };
}
async function compressContext(buf, claudeKey, perpKey) {
  if (buf.length <= COMPRESS_THRESHOLD) return { buf, compressed: false };

  const tail = buf.slice(-COMPRESS_KEEP_TAIL);
  const toCompress = buf.slice(0, buf.length - COMPRESS_KEEP_TAIL);

  try {
    const summary = await callClaude(
      "Conversation summarizer. Return only the summary paragraph.",
      P.compress(toCompress),
      200,
      claudeKey,
      perpKey
    );
    if (!summary?.trim()) throw new Error("vazio");

    return {
      buf: [`SUMMARY: ${summary.trim()}`, ...tail],
      compressed: true,
      before: buf.length,
      after: COMPRESS_KEEP_TAIL + 1
    };
  } catch {
    return { buf, compressed: false }; // falha silenciosa
  }
}
// ── COMPONENTE PRINCIPAL ─────────────────────────────────────────────────────
export default function Cortex(){
  const [currentApprovalGate, setCurrentApprovalGate] = useState(null);
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < 768);
  const [brain,setBrain]     = useState(defaultBrain);
  const [msgs,setMsgs]       = useState([]);
  const { send: runCouncil, invoke: runInvoke, lobeResults, cacheSize, phase, setPhase, stopGeneration, isGenerating, frustrationLevel, setFrustrationLevel, guardarMemoriaSessao, getLastSessionContext, partialTexts } = useCouncil(msgs, setMsgs);
  const [input,setInput]     = useState("");
  const [buf,setBuf]         = useState([]);  const [loaded,setLoaded]   = useState(false);
  const [page,setPage]       = useState("chat");
  const [pagina, setPagina] = useState('chat'); // 'chat' | 'mapas'
  const [theme,setTheme]     = useState("cortex");
  const [keys,setKeys]       = useState(defaultKeys);
  const { toasts, toast, removerToast } = useToast();
  const [modelsOn,setModelsOn] = useState(Object.fromEntries(MODELS.map(m=>[m.id,true])));
  const [temperaturas,setTemperaturas] = useState(Object.fromEntries(MODELS.map(m=>[m.id,0.7])));
  const [lobeConfigAberto,setLobeConfigAberto] = useState(null);
  const [modoDebate, setModoDebate] = useState(false);
  const [modoCode, setModoCode] = useState(false);
  const [userId, setUserId] = useState("anon");
  const [sugestoesIniciais, setSugestoesIniciais] = useState(() => gerarChipsLocais("casual"));

  // modais
  const [showGuide,setShowGuide]   = useState(false);
  const [showExport,setShowExport] = useState(false);
  const [showImport,setShowImport] = useState(false);
  const [importTxt,setImportTxt]   = useState("");
  const [importErr,setImportErr]   = useState("");
  const [showSeed,setShowSeed]     = useState(false);
  const [seedP,setSeedP] = useState("");
  const [seedC,setSeedC] = useState("");
  const [seedO,setSeedO] = useState("");
  const [showTP,setShowTP]         = useState(false);
  const [showModels,setShowModels] = useState(false);
  const [showEvals, setShowEvals] = useState(false)
  const [showSidebar, setShowSidebar] = useState(false);
  const [showBlueprintsPanel, setShowBlueprintsPanel] = useState(false);
  const [showForensePanel, setShowForensePanel] = useState(false);
  const [showCouncil, setShowCouncil] = useState(null);
  const [conversations, setConversations] = useState([]);
  const [currentConvId, setCurrentConvId] = useState(null);
  const [atBottom,setAtBottom]     = useState(true);
  const [devUnlocked,setDevUnlocked] = useState(()=>DEV_MODE);
  const [pinInput,setPinInput]       = useState("");
  const [pinErr,setPinErr]           = useState(false);
  const [fabOpen, setFabOpen] = useState(false);
  const [focusMode] = useState(false);
  const [focusLobes] = useState(new Set(LOBOS.map(l=>l.id)));
  const [showFileUpload, setShowFileUpload] = useState(false);
  const [ficheiroAnexado, setFicheiroAnexado] = useState(null);
  const [frustrationDismissed, setFrustrationDismissed] = useState(false);
  const [contextoSessaoAnterior, setContextoSessaoAnterior] = useState(null);
  const [memoryBannerDismissed, setMemoryBannerDismissed] = useState(false);
  const { textosParciais, aStreaming, onToken, iniciar, terminar } = useStreaming();
  const { ref: inputRef, ajustar } = useAutoResize({
    minHeight: 52,
    maxHeight: 200
  });

  const botRef  = useRef(null);
  const chatRef = useRef(null);
  const sessionMemoryRef = useRef({ msgs: [], currentConvId: null });
  const uploadPreviewUrlsRef = useRef(new Set());
  const T = THEMES[theme];

  const hP=keys.perp?.trim().length>10, hC=keys.claude?.trim().length>10;
  const inputChars = input.length;
  const inputTokens = Math.round(inputChars / 4);
  const inputCounterWarn = inputChars > 2000;

  const load = useCallback(async () => {
    try{
      const b  = await safeGet(MV+"-brain",  defaultBrain);
      const m  = await safeGet(MV+"-msgs",   []);
      const k  = await safeGet("cortex-keys-global", null) || await safeGet(MV+"-keys", defaultKeys);
      const t  = await safeGet(MV+"-theme",  "cortex");
      const mo = await safeGet(MV+"-models", null);
      const temps = await safeGet(MV+"-temperaturas", null);
      const convs = await safeGet(MV+"-convs", []);
      setConversations(Array.isArray(convs) ? convs : []);
      setBrain(normBrain(b));
      setMsgs(Array.isArray(m)?m:[]);
      setKeys({...defaultKeys,...(k&&typeof k==="object"?k:{})});
      setTheme(typeof t==="string"&&THEMES[t]?t:"cortex");
      setModelsOn(mo&&typeof mo==="object"?mo:Object.fromEntries(MODELS.map(x=>[x.id,true])));
      setTemperaturas(temps&&typeof temps==="object"?{...Object.fromEntries(MODELS.map(x=>[x.id,0.7])),...temps}:Object.fromEntries(MODELS.map(x=>[x.id,0.7])));
    }catch{
      toast("Erro ao carregar ficheiro");
    }
    setLoaded(true);
  }, [toast]);

  useEffect(()=>{load();},[load]);
  useEffect(()=>{
    let cancelado = false;
    getUserId()
      .then((id) => {
        if (!cancelado) setUserId(id || "anon");
      })
      .catch(() => {});
    return () => {
      cancelado = true;
    };
  },[]);
  useEffect(()=>{
    let cancelado = false;
    generateChips({
      texto: input,
      frustrationLevel,
      userId,
    })
      .then((chips) => {
        if (!cancelado) setSugestoesIniciais(chips);
      })
      .catch(() => {
        if (!cancelado) setSugestoesIniciais(gerarChipsLocais("casual"));
      });
    return () => {
      cancelado = true;
    };
  },[input, frustrationLevel, userId]);
  useEffect(()=>() => {
    uploadPreviewUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
    uploadPreviewUrlsRef.current.clear();
  },[]);
  useEffect(()=>{
    if(!atBottom) return undefined;
    const frame = requestAnimationFrame(()=>{
      botRef.current?.scrollIntoView({behavior:"smooth", block:"end"});
    });
    return () => cancelAnimationFrame(frame);
  },[msgs,phase,showCouncil,atBottom]);
  useEffect(()=>{
    ajustar();
  },[input, ajustar]);

  useEffect(()=>{
    sessionMemoryRef.current = { msgs, currentConvId };
  },[msgs, currentConvId]);

  useEffect(()=>{
    if (!loaded) return;
    if (msgs.some((m)=>m.role==="user")) return;
    setContextoSessaoAnterior(getLastSessionContext());
  },[loaded, currentConvId, getLastSessionContext, msgs]);

  useEffect(()=>{
    const guardarAntesDeSair = () => {
      const actual = sessionMemoryRef.current;
      guardarMemoriaSessao(actual.msgs, actual.currentConvId);
    };
    window.addEventListener("beforeunload", guardarAntesDeSair);
    return () => {
      guardarAntesDeSair();
      window.removeEventListener("beforeunload", guardarAntesDeSair);
    };
  },[guardarMemoriaSessao]);

  // Bloqueio automático das chaves ao navegar para outra página
  useEffect(()=>{if(page!=="keys"&&!DEV_MODE)setDevUnlocked(false);},[page]);

  useEffect(()=>{
    const handler=()=>setIsMobile(window.innerWidth<768);
    window.addEventListener("resize",handler);
    return ()=>window.removeEventListener("resize",handler);
  },[]);

  useEffect(()=>{
    if(!isMobile) setFabOpen(false);
  },[isMobile]);

  useEffect(()=>{
    if(showGuide || showModels || showTP || showSidebar || showBlueprintsPanel || showForensePanel) setFabOpen(false);
  },[showGuide,showModels,showTP,showSidebar,showBlueprintsPanel,showForensePanel]);

const saveConvs = c => safePut(MV+"-convs", c.slice(0,50));
  const saveBrain  = b  => safePut(MV+"-brain",  b);
  const saveMsgs   = m  => safePut(MV+"-msgs",   m.slice(-MAX_STORED));
  const saveKeys   = k  => safePut("cortex-keys-global", k);
  const saveTheme  = t  => safePut(MV+"-theme",  t);
  const saveModels = mo => safePut(MV+"-models", mo);
  const saveTemperaturas = temps => safePut(MV+"-temperaturas", temps);
function newChat() {
  if (msgs.length>0) {
    autoSaveConv(msgs, currentConvId);
    guardarMemoriaSessao(msgs, currentConvId);
  }
  setCurrentConvId(Date.now());
  setMsgs([]); saveMsgs([]); setBuf([]);
  setContextoSessaoAnterior(getLastSessionContext());
  setMemoryBannerDismissed(false);
  setShowSidebar(false);
  setFrustrationDismissed(false);
  setFrustrationLevel("none");
}

function switchConv(conv) {
  if (msgs.length>0) {
    autoSaveConv(msgs, currentConvId);
    guardarMemoriaSessao(msgs, currentConvId);
  }
  setMsgs(conv.msgs);
  setCurrentConvId(conv.id);
  setBuf([]);
  setContextoSessaoAnterior(null);
  setMemoryBannerDismissed(true);
  setShowSidebar(false);
  setFrustrationDismissed(false);
  setFrustrationLevel("none");
}

function usarContextoSessaoAnterior() {
  if (!contextoSessaoAnterior) return;
  setMsgs((prev) => {
    if (prev.some((m) => m.role === "user")) return prev;
    const actualizadas = injectSessionContext(prev, contextoSessaoAnterior);
    saveMsgs(actualizadas);
    return actualizadas;
  });
  setMemoryBannerDismissed(true);
  toast("Contexto anterior adicionado.", "sucesso");
}

function ignorarContextoSessaoAnterior() {
  setMemoryBannerDismissed(true);
  setContextoSessaoAnterior(null);
}

function deleteConv(convId, e) {
  e.stopPropagation();
  setConversations(prev => { const u=prev.filter(c=>c.id!==convId); saveConvs(u); return u; });
  if (convId===currentConvId) { setMsgs([]); saveMsgs([]); setBuf([]); setCurrentConvId(null); }
}

function autoSaveConv(currentMsgs, convId){
  if(!currentMsgs.length) return convId;
  const title=currentMsgs.find(m=>m.role==="user")?.content?.slice(0,45)||"Conversa";
  const cid=convId||Date.now();
  const conv={id:cid,title,msgs:currentMsgs,updatedAt:new Date().toISOString()};
  setConversations(prev=>{
    const updated=[conv,...prev.filter(c=>c.id!==cid)].slice(0,50);
    saveConvs(updated);
    return updated;
  });
  return cid;
}

function lobeConfidenceScore(result, isErr) {
  if (isErr || !result) return 0;
  const len = result.length;
  if (len < 50)  return 20;
  if (len < 150) return 50;
  if (len < 400) return 75;
  return 92;
}
async function invoke(id, sys, msg) {
  return runInvoke(id, sys, msg, { toast, callOllama });
}

async function handleFileUpload(ficheiro) {
  let anexo = ficheiro;

  if (ficheiro?.previewUrl) {
    try {
      const blob = await fetch(ficheiro.previewUrl).then((res) => res.blob());
      const previewUrl = URL.createObjectURL(blob);
      uploadPreviewUrlsRef.current.add(previewUrl);
      anexo = { ...ficheiro, previewUrl };
    } catch {
      // Mantém o painel montado para preservar a URL de objecto original se a cópia falhar.
    }
  }

  setFicheiroAnexado(anexo);
  setShowFileUpload(!ficheiro?.previewUrl || anexo.previewUrl !== ficheiro.previewUrl ? false : true);
  toast(`Ficheiro anexado: ${ficheiro.nome}`, "success");
}

function removerFicheiroAnexado() {
  if (ficheiroAnexado?.previewUrl && uploadPreviewUrlsRef.current.has(ficheiroAnexado.previewUrl)) {
    URL.revokeObjectURL(ficheiroAnexado.previewUrl);
    uploadPreviewUrlsRef.current.delete(ficheiroAnexado.previewUrl);
  }
  setFicheiroAnexado(null);
}

async function send(query, options = {}) {
  const q = (query || input).trim();
  if (q) setMemoryBannerDismissed(true);
  const imagemDataUrlEnvio = ficheiroAnexado?.imageDataUrl || null;
  const anexoUpload = ficheiroAnexado
    ? {
        nome: ficheiroAnexado.nome,
        tipo: ficheiroAnexado.tipo,
        tamanho: ficheiroAnexado.tamanho,
        conteudo: ficheiroAnexado.conteudo,
        previewUrl: ficheiroAnexado.previewUrl,
      }
    : null;
  let qComFicheiro = q;

  if (ficheiroAnexado?.conteudo) {
    qComFicheiro = `[Ficheiro: ${ficheiroAnexado.nome}]\n[Conteúdo]:\n${ficheiroAnexado.conteudo.slice(0, 12000)}\n\nPergunta do utilizador: ${q}`;
  } else if (ficheiroAnexado?.previewUrl) {
    qComFicheiro = `[Imagem anexada: ${ficheiroAnexado.nome}]\n\nPergunta do utilizador: ${q}`;
  }
  setFicheiroAnexado(null);

  const resultado = await runCouncil(qComFicheiro, {
    input,
    displayQuery: q,
    anexoUpload,
    imageDataUrl: imagemDataUrlEnvio,
    setInput,
    classifyQuery,
    saveMsgs,
    compressContext,
    buf,
    setBuf,
    keys,
    buildMem,
    brain,
    selectUsedMem,
    routerDecide,
    LOBES: LOBOS,
    modelsOn,
    temperaturas,
    focusMode,
    focusLobes,
    P,
    callClaude,
    hC,
    hP,
    normalizeCouncilPayload,
    heuristicDecision,
    saveBrain,
    setBrain,
    safeParseReflect,
    MAX_BUF,
    MAX_SEMANTIC,
    MAX_PATTERNS,
    MAX_EPISODIC,
    toast,
    autoSaveConv,
    currentConvId,
    taRef: inputRef,
    lobeConfidenceScore,
    modoDebate: modoDebate ? "debate" : "paralelo",
    systemPrompts: modoCode && modoDebate ? SYSTEM_PROMPTS_CODE : undefined,
    runDebateStream: runDebateStreamApi,
    streaming: { textosParciais, aStreaming, onToken, iniciar, terminar },
    options,
  });
  if (resultado?.tipo === 'approval_gate') {
    setCurrentApprovalGate({ ...resultado, query: qComFicheiro });
    ajustar(true);
    return;
  }

  ajustar(true);
  return resultado;
}

  function aplicarSugestaoRei(sugestao) {
    const texto = typeof sugestao === "string" ? sugestao : sugestao?.texto || "";
    if (!texto) return;
    setInput(texto);
    requestAnimationFrame(() => {
      ajustar();
      inputRef.current?.focus();
    });
  }

  async function regenerate(){
    if(phase)return;
    const lastUser=[...msgs].reverse().find(m=>m.role==="user");
    if(!lastUser)return;
    const idx=msgs.lastIndexOf(lastUser);
    const trimmed=msgs.slice(0,idx);
    setMsgs(trimmed);saveMsgs(trimmed);setBuf(buf.slice(0,-2));
    toast("A regenerar conselho...","info");
    await send(lastUser.content);
  }

  function exportConv(){
    const lines=[`# Conversa — ${"Bem-vindo ao Córtex"}`,`> ${new Date().toLocaleString()}`,""];
    msgs.forEach(m=>{
      if(m.role==="user")lines.push(`## 🧑 Tu`,m.content,"");
      else if(m.systemNote)lines.push(`> ${m.content}`,"");
      else{lines.push(`## 🧠 Córtex`,m.content,"");if(m.councilDecision)lines.push(`> ⚖ ${m.councilDecision}`,"");}
    });
    const md=lines.join("\n");
    navigator.clipboard?.writeText(md);
    const a=document.createElement("a");a.href=URL.createObjectURL(new Blob([md],{type:"text/markdown"}));a.download=`cortex-${Date.now()}.md`;a.click();
    toast("Relatório exportado","success");
  }

  function applySeed(){
    const entries=[...seedToMem(seedP,"facto"),...seedToMem(seedC,"facto"),...seedToMem(seedO,"objetivo")];
    if(!entries.length)return;
    const nb={...brain,semantic:[...brain.semantic,...entries].slice(-MAX_SEMANTIC),episodic:[...brain.episodic,"Configuração inicial (seed manual)."].slice(-MAX_EPISODIC)};
    setBrain(nb);saveBrain(nb);setShowSeed(false);setSeedP("");setSeedC("");setSeedO("");
    toast("Memória guardada","success");
  }

  function doImport(){
    setImportErr("");
    try{
      const raw=JSON.parse(importTxt);
      if(!Array.isArray(raw.semantic)||!Array.isArray(raw.episodic))throw new Error("Formato inválido.");
      setBrain(normBrain(raw));saveBrain(normBrain(raw));setBuf([]);setShowImport(false);setImportTxt("");
      toast("Memória importada","success");
    }catch(e){setImportErr(`Erro: ${e.message}`);}
  }

  const phases={
    council:{label:`Conselho de Lobos (${LOBOS.filter(l=>modelsOn[l.id]!==false).length})`,color:"#a78bfa",pct:"50%"},
    judges:{label:"Juízes", color:AC.perp, pct:"68%"},
    rei:{label:"Veredicto do Rei", color:AC.claude, pct:"88%"},
    cortex: {label:"Córtex", color:AC.claude, pct:"88%"},
    reflex: {label:"Reflexão", color:AC.reflex, pct:"100%"},
  };

const safeParseJson = (value, fallback = null) => {
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
};

const extractJsonBlock = (text) => {
  if (!text || typeof text !== "string") return null;

  const fenced = text.match(/```json\s*([\s\S]*?)\s*```/i);
  if (fenced?.[1]) {
    const parsed = safeParseJson(fenced[1], null);
    if (parsed) return parsed;
  }

  const genericFence = text.match(/```[\s\S]*?((?:\x7b|\x5b)[\s\S]*(?:\x7d|\x5d))[\s\S]*?```/);
  if (genericFence?.[1]) {
    const parsed = safeParseJson(genericFence[1], null);
    if (parsed) return parsed;
  }

  const firstBrace = text.indexOf("{");
  const lastBrace = text.lastIndexOf("}");
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    const candidate = text.slice(firstBrace, lastBrace + 1);
    const parsed = safeParseJson(candidate, null);
    if (parsed) return parsed;
  }

  return null;
};

function normalizeCouncilPayload(raw, fallbackText = "") {
  if (!raw) {
    return {
      final: fallbackText || "Sem resposta estruturada.",
      consensus: [],
      divergence: [],
      confidence: "média",
      nextActions: []
    };
  }

  if (typeof raw === "string") {
    const parsed = extractJsonBlock(raw);
    if (parsed) return normalizeCouncilPayload(parsed, raw);

    return {
      final: raw,
      consensus: [],
      divergence: [],
      confidence: "média",
      nextActions: []
    };
  }

  const final =
    raw.final ||
    raw.answer ||
    raw.response ||
    raw.summary ||
    fallbackText ||
    "Sem resposta estruturada.";

  return {
    final,
    consensus: Array.isArray(raw.consensus) ? raw.consensus : [],
    divergence: Array.isArray(raw.divergence) ? raw.divergence : [],
    confidence: raw.confidence || "média",
    nextActions: Array.isArray(raw.nextActions)
      ? raw.nextActions
      : Array.isArray(raw.next_actions)
      ? raw.next_actions
      : []
  };
}

  if(!loaded)return <Splash/>;
  const cur=phase?phases[phase]:null;
  const mostrarMemoryBanner = shouldShowMemoryBanner({
    page,
    dismissed: memoryBannerDismissed,
    context: contextoSessaoAnterior,
    messages: msgs,
  });
  if (pagina === 'blueprints') return (
    <BlueprintsPanel onVoltar={() => setPagina('chat')} />
  );
  return (
    <div style={{display:"flex",flexDirection:"column",height:"100dvh",background:T.bg,color:T.tx,fontFamily:"-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif",overflow:"hidden"}}>
      <style>{`
  @keyframes orb{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.2;transform:scale(1.4)}}
  @keyframes pulse{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.4;transform:scale(1.2)}}
  @keyframes toastIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
  @keyframes brainPulse{0%,100%{box-shadow:0 0 30px ${AC.claude}55,inset 0 0 20px ${AC.claude}22}50%{box-shadow:0 0 50px ${AC.claude}88,inset 0 0 30px ${AC.claude}44}}
  @keyframes orbit0{from{transform:translate(-50%,-50%) rotate(0deg) translateX(38px)}to{transform:translate(-50%,-50%) rotate(360deg) translateX(38px)}}
  @keyframes orbit1{from{transform:translate(-50%,-50%) rotate(72deg) translateX(34px)}to{transform:translate(-50%,-50%) rotate(432deg) translateX(34px)}}
  @keyframes orbit2{from{transform:translate(-50%,-50%) rotate(144deg) translateX(40px)}to{transform:translate(-50%,-50%) rotate(504deg) translateX(40px)}}
  @keyframes orbit3{from{transform:translate(-50%,-50%) rotate(216deg) translateX(32px)}to{transform:translate(-50%,-50%) rotate(576deg) translateX(32px)}}
  @keyframes orbit4{from{transform:translate(-50%,-50%) rotate(288deg) translateX(36px)}to{transform:translate(-50%,-50%) rotate(648deg) translateX(36px)}}
  @keyframes shimmer{0%{background-position:-400px 0}100%{background-position:400px 0}}
  @keyframes lobePop{0%{opacity:0;transform:scale(0.94) translateY(5px)}100%{opacity:1;transform:scale(1) translateY(0)}}
  @keyframes fadeIn{from{opacity:0;transform:translateY(4px)}to{opacity:1;transform:translateY(0)}}
  @keyframes piscar{0%,100%{opacity:1}50%{opacity:0}}
  @keyframes modalFadeIn{from{opacity:0}to{opacity:1}}
  @keyframes modalSlideIn{from{opacity:0;transform:translateY(-8px) scale(0.98)}to{opacity:1;transform:translateY(0) scale(1)}}
  @keyframes sidebarSlideIn{from{opacity:0;transform:translateX(-14px)}to{opacity:1;transform:translateX(0)}}
  .pulse{animation:pulse 1.5s ease-in-out infinite}
  .msg-in{animation:fadeIn 0.22s ease}
  .lobe-card{animation:lobePop 0.2s ease both}
  .skeleton{background:linear-gradient(90deg,#ffffff08 0%,#ffffff14 50%,#ffffff08 100%);background-size:400px 100%;animation:shimmer 1.4s infinite linear;border-radius:6px}
  button{transition:transform 0.14s ease,opacity 0.14s ease!important}
  button:active{transform:scale(0.95)!important}
  *{box-sizing:border-box}
  textarea,input{caret-color:#10b981}
  ::-webkit-scrollbar{width:4px}
  ::-webkit-scrollbar-thumb{background:#ffffff14;border-radius:2px}
  details>summary{list-style:none;user-select:none}
  details>summary::-webkit-details-marker{display:none}
  button{
    transition:
      transform 0.24s cubic-bezier(0.4,0,0.2,1),
      opacity   0.24s cubic-bezier(0.4,0,0.2,1),
      background 0.24s cubic-bezier(0.4,0,0.2,1),
      box-shadow 0.24s cubic-bezier(0.4,0,0.2,1)!important;
    will-change:transform,opacity;
  }
  @media (hover:hover){
  button:hover{
    opacity:0.92;
    transform:translateY(-1px);
    box-shadow:0 3px 10px #00000028;
  }
}

  button:active{
    transform:translateY(0px) scale(0.97)!important;
    opacity:0.82;
    transition:
      transform 0.1s cubic-bezier(0.4,0,0.2,1),
      opacity   0.1s ease!important;
        }
      `}</style>

      {/* ── NOTIFICAÇÕES ─────────────────────────────────────────── */}
      <Toast toasts={toasts} onFechar={removerToast} />

      {/* ── MODAIS ─────────────────────────────────────────── */}
      {showGuide && (
        <Modal T={T} title={"Guia"} onClose={()=>setShowGuide(false)}>
          <div style={{fontSize:12,lineHeight:1.8,color:T.ts,display:"flex",flexDirection:"column",gap:10}}>
            <p><b style={{color:T.tx}}>{"O Conselho"}</b><br/>{"Discussão entre diferentes perspectivas de IA."}</p>
            <div style={{display:"grid",gridTemplateColumns:"auto 1fr auto",gap:"3px 10px",background:T.s2,borderRadius:10,padding:11,fontSize:11}}>
              {[["◉ Grok","Factos empíricos","grok-3"],["◈ Gemini","Contexto amplo","gemini-2.5-flash"],["◇ Perplexity","Web actual","sonar-pro"],["◎ Genspark","Síntese multi-IA","simulado"],["◍ Manus","Agente autónomo","via Claude"],["○ OpenAI","Raciocínio","gpt-4o"],["◐ DeepSeek","Código/Lógica","deepseek-chat"],["◑ Llama","Código aberto","llama-4-scout"],["◒ Mistral","Velocidade","mistral-large"],["◓ Nemotron","Ciência","nemotron-4-340b"],["◆ Claude","Juiz final","claude-opus-4-6"]].map(([l,d,v],i)=>(
                <span key={`model-info-${i}-${l}`} style={{display:"contents"}}><span style={{fontWeight:700,color:T.tx}}>{l}</span><span>{d}</span><span style={{color:T.tf,fontFamily:"monospace",fontSize:8}}>{v}</span></span>
              ))}
            </div>
            <p><b style={{color:T.tx}}>{"O Córtex"}</b><br/>{"Integração final do conhecimento."}</p>
            <p><b style={{color:T.tx}}>{"Memória"}</b><br/>{"Retenção a longo prazo e RAG."}</p>
            <p style={{color:T.tf,fontSize:10}}>{"Dica: usa o microfone para falares com o sistema."}</p>
          </div>
        </Modal>
      )}

      {showExport && (
        <Modal T={T} title={"Exportar Memória"} onClose={()=>setShowExport(false)}>
          <p style={{fontSize:11,color:T.ts,marginBottom:7}}>{"JSON do teu cérebro:"}</p>
          <textarea readOnly value={JSON.stringify(normBrain(brain),null,2)} onClick={e=>e.target.select()} style={{width:"100%",height:180,background:T.s2,border:`1px solid ${T.b1}`,borderRadius:8,padding:9,color:T.tx,fontSize:10,fontFamily:"monospace",resize:"vertical",outline:"none",boxSizing:"border-box"}}/>
          <button onClick={()=>navigator.clipboard?.writeText(JSON.stringify(normBrain(brain),null,2)).then(()=>toast("Copiado","success"))} style={{...btn(T,AC.claude),marginTop:7,width:"100%"}}>{"📋 Copiar"}</button>
        </Modal>
      )}

      {showImport && (
        <Modal T={T} title={"Importar Memória"} onClose={()=>{setShowImport(false);setImportErr("");setImportTxt("");}}>
          <textarea value={importTxt} onChange={e=>setImportTxt(e.target.value)} placeholder={'{"episodic":[],"semantic":[],...}'} style={{width:"100%",height:180,background:T.s2,border:`1px solid ${T.b1}`,borderRadius:8,padding:9,color:T.tx,fontSize:10,fontFamily:"monospace",resize:"vertical",outline:"none",boxSizing:"border-box"}}/>
          {importErr && <div style={{color:"#fca5a5",fontSize:11,marginTop:4}}>{importErr}</div>}
          <button onClick={doImport} style={{...btn(T,AC.claude),marginTop:7,width:"100%"}}>{"✓ Importar e substituir"}</button>
        </Modal>
      )}

      {showSeed && (
        <Modal T={T} title={"Semente da Memória"} onClose={()=>setShowSeed(false)}>
          <div style={{display:"flex",flexDirection:"column",gap:11}}>
            {[["Perfil pessoal","Curso, contexto, preferências e forma de trabalho...",seedP,setSeedP],
              ["Contexto técnico","Projectos, stack, ferramentas e restrições importantes...",seedC,setSeedC],
              ["Objectivos","Objectivos actuais, prioridades e próximos passos...",seedO,setSeedO]
            ].map(([lbl,ph,val,set])=>(
              <div key={lbl} style={{display:"flex",flexDirection:"column",gap:4}}>
                <label style={{fontSize:11,fontWeight:600,color:T.ts}}>{lbl}</label>
                <textarea value={val} onChange={e=>set(e.target.value)} placeholder={ph} rows={3} style={{background:T.s2,border:`1px solid ${T.b1}`,borderRadius:8,padding:"7px 9px",color:T.tx,fontSize:11,fontFamily:"inherit",resize:"vertical",outline:"none",lineHeight:1.5}}/>
              </div>
            ))}
            <button onClick={applySeed} style={{...btn(T,AC.claude),width:"100%"}}>{"Guardar"}</button>
            <p style={{fontSize:9,color:T.tf,margin:0}}>{"Define o conhecimento inicial."}</p>
          </div>
        </Modal>
      )}

      {showTP && (
        <Modal T={T} title={"Tema"} onClose={()=>setShowTP(false)}>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:7}}>
            {Object.entries(THEMES).map(([key,th],idx)=>(
              <button key={`theme-${idx}-${key}`} onClick={()=>{setTheme(key);saveTheme(key);setShowTP(false);}} style={{background:theme===key?th.s2:"transparent",border:`2px solid ${theme===key?AC.claude:th.b1}`,borderRadius:13,padding:"9px 11px",cursor:"pointer",fontFamily:"inherit",display:"flex",alignItems:"center",gap:9,transition:"all 0.15s",boxShadow:theme===key?`0 0 12px ${AC.claude}44`:"none"}}>
                <span style={{fontSize:18}}>{th.emoji}</span>
                <div style={{textAlign:"left"}}>
                  <div style={{fontSize:11,fontWeight:700,color:theme===key?th.tx:T.ts}}>{th.name}</div>
                  <div style={{display:"flex",gap:3,marginTop:3}}>{[th.bg,th.s1,AC.claude,th.tx].map((c,i)=><div key={`theme-swatch-${i}-${c}`} style={{width:10,height:10,borderRadius:"50%",background:c,border:`1px solid ${th.b1}`}}/>)}</div>
                </div>
                {theme===key&&<span style={{marginLeft:"auto",color:AC.claude,fontWeight:700}}>✓</span>}
              </button>
            ))}
          </div>
        </Modal>
      )}

      {showModels && (
        <Modal T={T} title={"Modelos"} onClose={()=>setShowModels(false)}>
          <p style={{fontSize:11,color:T.ts,marginBottom:8}}>{"Activa e desactiva lobos."}</p>
          <div style={{display:"flex",flexDirection:"column",gap:6}}>
            {MODELS.filter(m=>m.id!=="claude").map((m,idx)=>(
              <div key={`model-${idx}-${m.id}`} style={{background:T.s2,borderRadius:9,padding:"8px 11px",border:`1px solid ${lobeConfigAberto===m.id?m.color+"55":"transparent"}`}}>
                <div style={{display:"flex",alignItems:"center",gap:9}}>
                  <div style={{width:7,height:7,borderRadius:"50%",background:modelsOn[m.id]!==false?m.color:"#666",flexShrink:0}}/>
                  <button
                    type="button"
                    onClick={()=>setLobeConfigAberto(v=>v===m.id?null:m.id)}
                    style={{flex:1,background:"transparent",border:"none",padding:0,textAlign:"left",cursor:"pointer",fontFamily:"inherit"}}
                  >
                    <div style={{fontSize:11,fontWeight:700,color:T.tx}}>{m.name} <span style={{fontSize:8,color:T.ts,fontFamily:"monospace",opacity:0.9}}>{m.version}</span></div>
                    <div style={{fontSize:9,color:T.tf,marginTop:2}}>Clicar para ajustar temperatura</div>
                  </button>
                  <Toggle on={modelsOn[m.id]!==false} onChange={v=>{const ne={...modelsOn,[m.id]:v};setModelsOn(ne);saveModels(ne);}} color={m.color}/>
                </div>
                {lobeConfigAberto===m.id && (
                  <div style={{marginTop:10,paddingTop:10,borderTop:`1px solid ${T.b1}`}}>
                    <Slider
                      valor={temperaturas[m.id] ?? 0.7}
                      min={0}
                      max={1}
                      passo={0.1}
                      cor={m.color}
                      label={`Temperatura de ${m.name}`}
                      onChange={(valor)=>{
                        const next={...temperaturas,[m.id]:valor};
                        setTemperaturas(next);
                        saveTemperaturas(next);
                      }}
                    />
                  </div>
                )}
              </div>
            ))}
          </div>
        </Modal>
      )}

      {/* ── NAVEGAÇÃO ────────────────────────────────────────────── */}
<nav style={{display:"grid",gridTemplateColumns:isMobile?"1fr auto":"minmax(260px,1fr) auto",alignItems:"center",minHeight:64,padding:"8px 12px",background:`linear-gradient(180deg, ${T.s1}, ${T.bg})`,borderBottom:`1px solid ${AC.claude}44`,gap:12,flexShrink:0,boxShadow:`0 8px 24px ${T.b2}66`}}>
  <button
    type="button"
    onClick={()=>{setPage("chat");setPagina("chat");}}
    style={{display:"flex",alignItems:"center",gap:11,background:"transparent",border:"none",padding:0,cursor:"pointer",fontFamily:"inherit",textAlign:"left",minWidth:0}}
    title="Voltar ao chat"
  >
    <div style={{width:40,height:40,borderRadius:12,background:`linear-gradient(135deg, ${AC.claude}33, ${AC.claude}12)`,border:`1px solid ${AC.claude}55`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:13,fontWeight:900,color:AC.claude,letterSpacing:0.5,boxShadow:`0 0 18px ${AC.claude}22`,flexShrink:0}}>CD</div>
    <div style={{minWidth:0}}>
      <div style={{display:"flex",alignItems:"baseline",gap:7,flexWrap:"wrap"}}>
        <div style={{fontSize:15,fontWeight:900,letterSpacing:0.6,color:T.tx,lineHeight:1}}>{"Córtex"}</div>
        <span style={{fontSize:10,fontWeight:800,color:AC.claude,letterSpacing:0.4}}>{MV.split("-")[1]}</span>
      </div>
      <div style={{fontSize:10,color:T.ts,marginTop:5,letterSpacing:0.2,whiteSpace:"normal"}}>{"Plataforma multi-agente"}</div>
    </div>
  </button>

  <div style={{display:"flex",alignItems:"center",justifyContent:"flex-end",gap:6,overflowX:"auto",WebkitOverflowScrolling:"touch",paddingBottom:1}}>
    {!isMobile && [["chat","▣","Chat"],...(DEV_MODE?[["keys","🔑","Chaves API"]]:[]),["memory","🧠","Memória"],["settings","⚙","Definições"]].map(([p,ico,lbl],idx)=>{
      const active=page===p&&pagina!=="blueprints";
      return (
        <button
          key={`nav-${idx}-${p}`}
          type="button"
          onClick={()=>{setPage(p);setPagina("chat");}}
          style={{background:active?`${AC.claude}20`:T.s2,border:`1px solid ${active?AC.claude+"66":T.b1}`,borderRadius:12,minHeight:42,padding:"8px 13px",transition:"all 220ms cubic-bezier(0.4,0,0.2,1)",boxShadow:active?`0 0 16px ${AC.claude}22`:"none",color:active?AC.claude:T.ts,cursor:"pointer",fontSize:12,fontFamily:"inherit",fontWeight:active?800:600,display:"flex",alignItems:"center",gap:7,flexShrink:0}}
        >
          <span>{ico}</span>
          <span>{lbl}</span>
          {p==="memory"&&brain.semantic.length>0&&(
            <span style={{background:`${AC.claude}33`,color:AC.claude,borderRadius:10,padding:"0 5px",fontSize:9,fontWeight:900}}>
              {brain.semantic.length}
            </span>
          )}
        </button>
      );
    })}

    {!isMobile && (
      <button
        type="button"
        onClick={() => {setShowBlueprintsPanel(true);setPage("chat");setPagina("chat");}}
        style={{background:showBlueprintsPanel?`${AC.claude}20`:T.s2,border:`1px solid ${showBlueprintsPanel?AC.claude+"66":T.b1}`,borderRadius:12,minHeight:42,padding:"8px 13px",transition:"all 220ms cubic-bezier(0.4,0,0.2,1)",boxShadow:showBlueprintsPanel?`0 0 16px ${AC.claude}22`:"none",color:showBlueprintsPanel?AC.claude:T.ts,cursor:"pointer",fontSize:12,fontFamily:"inherit",fontWeight:showBlueprintsPanel?800:600,display:"flex",alignItems:"center",gap:7,flexShrink:0}}
      >
        <span>🗺️</span>
        <span>Mapas</span>
      </button>
    )}

    {!isMobile && (
      <button
        type="button"
        onClick={() => setModoCode((m) => !m)}
        style={{background:modoCode?"var(--accent)":"transparent",border:`1px solid ${modoCode?"var(--accent)":T.b1}`,borderRadius:12,minHeight:42,padding:"8px 13px",transition:"all 220ms cubic-bezier(0.4,0,0.2,1)",boxShadow:modoCode?"0 0 16px var(--accent-bg)":"none",color:modoCode?"white":"var(--text-secondary, #8a8aa0)",cursor:"pointer",fontSize:12,fontFamily:"inherit",fontWeight:modoCode?800:600,display:"flex",alignItems:"center",gap:7,flexShrink:0}}
        title={"Modo Code Agent"}
      >
        {"💻 Código"}
      </button>
    )}

    {!isMobile && (
      <>
        <button type="button" onClick={()=>setShowModels(true)} style={{...navBtn(T),minWidth:42,minHeight:42,background:T.s2}} title={"Lobos"}>◈</button>
        <button type="button" onClick={()=>setShowTP(true)} style={{...navBtn(T),minWidth:42,minHeight:42,background:T.s2}} title={"Tema"}>{THEMES[theme].emoji}</button>
        <button type="button" onClick={()=>setShowGuide(true)} style={{...navBtn(T),minWidth:42,minHeight:42,background:T.s2}} title={"Guia"}>?</button>
      </>
    )}

    <button
      type="button"
      onClick={()=>setShowSidebar(v=>!v)}
      style={{...navBtn(T),minWidth:42,minHeight:42,background:showSidebar?`${AC.claude}22`:T.s2,borderColor:showSidebar?`${AC.claude}55`:T.b1}}
      title={"Histórico"}
    >
      ☰
    </button>
  </div>
</nav>


{/* Progresso */}
{phase && <div style={{height:2,background:T.b2,flexShrink:0}}><div style={{height:"100%",width:cur?.pct||"0%",background:`linear-gradient(90deg,${cur?.color}88,${cur?.color})`,transition:"width 0.8s ease"}}/></div>}
      {/* ── CONVERSA ───────────────────────────────────────────── */}
      {page==="chat" && (
        <>
        <>
  <SidePanel aberto={showSidebar} onFechar={()=>setShowSidebar(false)} titulo={"Histórico"}>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:10,marginBottom:10}}>
      <span style={{fontSize:11,color:T.ts}}>{conversations.length} {"Conversas"}</span>
      <button onClick={newChat} style={{...btn(T,AC.claude),fontSize:9,padding:"4px 10px"}}>{"Nova Conversa"}</button>
    </div>
    <div style={{display:"flex",flexDirection:"column",gap:6}}>
      {conversations.length===0
        ?<div style={{fontSize:11,color:T.tf,textAlign:"center",marginTop:24,lineHeight:1.8}}>Sem histórico<br/>Cria uma nova conversa para começar.</div>
        :conversations.map((conv,idx)=>(
          <div key={`conversation-${idx}-${conv.id}`} onClick={()=>switchConv(conv)} style={{background:conv.id===currentConvId?`${AC.claude}18`:T.s2,border:`1px solid ${conv.id===currentConvId?AC.claude+"44":T.b1}`,borderRadius:10,padding:"9px 10px",cursor:"pointer",display:"flex",alignItems:"flex-start",gap:8,transition:"background 0.2s, border-color 0.2s"}}>
            <div style={{flex:1,minWidth:0}}>
              <div style={{fontSize:11,fontWeight:700,color:T.tx,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{conv.title}</div>
              <div style={{fontSize:9,color:T.ts,marginTop:3}}>{conv.msgs?.filter(m=>m.role==="user").length || 0} mensagens · {new Date(conv.updatedAt).toLocaleDateString("pt-PT")}</div>
            </div>
            <button onClick={e=>deleteConv(conv.id,e)} aria-label="Apagar conversa" style={{background:"transparent",border:"none",color:T.tf,cursor:"pointer",fontSize:12,flexShrink:0,opacity:0.65,padding:2,lineHeight:1}}>✕</button>
          </div>
        ))
      }
    </div>
    <div style={{marginTop:12,paddingTop:10,borderTop:`1px solid ${T.b1}`,fontSize:9,color:T.tf,lineHeight:1.6}}>
      {"Nota de memória"}
    </div>
  </SidePanel>
  <SidePanel
    aberto={showBlueprintsPanel}
    onFechar={()=>setShowBlueprintsPanel(false)}
    titulo="Mapas e blueprints"
    largura="min(920px, 94vw)"
  >
    <BlueprintsPanel compact onVoltar={()=>setShowBlueprintsPanel(false)} />
  </SidePanel>
  <SidePanel
    aberto={showForensePanel}
    onFechar={()=>setShowForensePanel(false)}
    titulo="Modo Forense"
    largura="min(520px, 94vw)"
  >
    <div style={{display:"flex",flexDirection:"column",gap:12}}>
      <AlertaBanner tipo="info" mensagem="Diagnóstico local da sessão actual do Córtex." />
      {[
        ["Mensagens", msgs.length],
        ["Conversas guardadas", conversations.length],
        ["Factos na memória", brain.semantic.length],
        ["Sessões memorizadas", brain.sessions],
        ["Lobos activos", MODELS.filter(m=>modelsOn[m.id]!==false).length],
        ["Fase actual", phase || "parado"],
      ].map(([label, value])=>(
        <div key={`forense-${label}`} style={{display:"flex",justifyContent:"space-between",gap:12,border:`1px solid ${T.b1}`,background:T.s2,borderRadius:10,padding:"9px 10px",fontSize:12}}>
          <span style={{color:T.ts}}>{label}</span>
          <strong style={{color:AC.claude}}>{value}</strong>
        </div>
      ))}
      <button type="button" onClick={exportConv} style={{...btn(T,AC.gemini),width:"100%"}}>Exportar conversa actual</button>
    </div>
  </SidePanel>
</>
          {DEV_MODE && (
  <div style={{display:"flex",alignItems:"center",gap:7,padding:"3px 12px",background:T.s2,borderBottom:`1px solid ${T.b2}`,fontSize:8,flexShrink:0,overflowX:"auto"}}>
    {LOBOS.map((l,i)=>{
      const cor = lobeColor(l);
      const active=phase==="council";
      const done=["judges","rei","cortex","reflex"].includes(phase);
      return <div key={`lobe-${l.id}-${i}`} style={{display:"flex",alignItems:"center",gap:i<LOBOS.length-1?6:0}}>
        <div style={{display:"flex",alignItems:"center",gap:2}}>
          <div style={{width:5,height:5,borderRadius:"50%",background:(active||done)?cor:"#444",boxShadow:active?`0 0 6px ${cor}`:"none",transition:"all 0.3s"}} className={active?"pulse":""}/>
          <span style={{color:(active||done)?cor:T.ts,fontWeight:active?700:400,letterSpacing:1,opacity:(active||done)?1:0.7}}>{lobeLabel(l)}</span>
        </div>
        {i<LOBOS.length-1&&<span style={{color:T.ts,opacity:0.15}}>·</span>}
      </div>;
    })}
    <div style={{marginLeft:"auto",display:"flex",gap:7,color:T.tf,flexShrink:0}}>
      <span><b style={{color:AC.claude}}>{brain.semantic.length}</b> fac</span>
      <span><b style={{color:AC.gemini}}>{brain.sessions}</b> sess</span>
      <span><b style={{color:AC.grok}}>{buf.length}/{MAX_BUF}</b> buf</span>
      <span><b style={{color:T.ts}}>{msgs.filter(m=>m.role==="user").length}</b> msg</span>
      <span title="Respostas em cache"><b style={{color:AC.perp}}>{cacheSize}</b>⚡</span>
    </div>
  </div>
)}
{/* ── FAB MÓVEL ───────────────────────────────────── */}
{isMobile && (
  <>
    <div
      onClick={() => setFabOpen(false)}
      style={{
        position:"fixed",
        inset:0,
        zIndex:1190,
        background:"rgba(0,0,0,0.56)",
        opacity:fabOpen ? 1 : 0,
        pointerEvents:fabOpen ? "auto" : "none",
        transition:"opacity 300ms cubic-bezier(0.4,0,0.2,1)"
      }}
    />

    <div
      style={{
        position:"fixed",
        left:0,
        right:0,
        bottom:0,
        zIndex:1200,
        background:T.s1,
        borderTop:`1px solid ${T.b1}`,
        borderRadius:"22px 22px 0 0",
        boxShadow:"0 -12px 42px #00000066",
        padding:"10px 14px calc(16px + env(safe-area-inset-bottom))",
        transform:fabOpen ? "translateY(0)" : "translateY(108%)",
        opacity:fabOpen ? 1 : 0.98,
        transition:"transform 300ms cubic-bezier(0.4,0,0.2,1), opacity 300ms cubic-bezier(0.4,0,0.2,1)",
        willChange:"transform, opacity"
      }}
    >
      <div style={{display:"flex",alignItems:"center",justifyContent:"center",position:"relative",padding:"4px 0 10px"}}>
        <div style={{width:38,height:4,borderRadius:999,background:T.b1}} />
        <button
          onClick={()=>setFabOpen(false)}
          aria-label={"Fechar"}
          style={{
            position:"absolute",
            right:2,
            top:-2,
            width:44,
            height:44,
            borderRadius:"50%",
            background:"transparent",
            border:`1px solid ${T.b1}`,
            color:T.ts,
            fontSize:14,
            cursor:"pointer",
            display:"flex",
            alignItems:"center",
            justifyContent:"center"
          }}
        >
          ✕
        </button>
      </div>

      <div style={{padding:"2px 2px 0"}}>
        <div style={{fontSize:11,fontWeight:800,color:T.tx,letterSpacing:0.4,marginBottom:10}}>
          {"Menu"}
        </div>

        <div style={{display:"grid",gridTemplateColumns:"repeat(4,minmax(0,1fr))",gap:8}}>
          {[
            {
              key:"memory",
              icon:"🧠",
              label:"Memória",
              active:page==="memory",
              onClick:()=>{setPage("memory");setFabOpen(false);}
            },
            {
              key:"models",
              icon:"◈",
              label:"Modelos",
              active:showModels,
              onClick:()=>{setShowModels(true);setFabOpen(false);}
            },
            {
              key:"theme",
              icon:THEMES[theme].emoji,
              label:"Tema",
              active:showTP,
              onClick:()=>{setShowTP(true);setFabOpen(false);}
            },
            {
              key:"guide",
              icon:"?",
              label:"Guia",
              active:showGuide,
              onClick:()=>{setShowGuide(true);setFabOpen(false);}
            },
            {
              key:"blueprints",
              icon:"🗺️",
              label:"Mapas",
              active:showBlueprintsPanel,
              onClick:()=>{setShowBlueprintsPanel(true);setPagina("chat");setPage("chat");setFabOpen(false);}
            },
            {
              key:"code",
              icon:"💻",
              label:"Código",
              active:modoCode,
              onClick:()=>{setModoCode((m) => !m);setFabOpen(false);}
            }
          ].map((item,idx)=>(
            <button
              key={`fab-${idx}-${item.key}`}
              onClick={item.onClick}
              style={{
                minWidth:44,
                minHeight:44,
                padding:"12px 6px",
                borderRadius:14,
                border:`1px solid ${item.active ? AC.claude+"55" : T.b1}`,
                background:item.active ? `${AC.claude}18` : T.s2,
                color:item.active ? AC.claude : T.tx,
                display:"flex",
                flexDirection:"column",
                alignItems:"center",
                justifyContent:"center",
                gap:6,
                cursor:"pointer",
                fontFamily:"inherit",
                transition:"all 300ms cubic-bezier(0.4,0,0.2,1)"
              }}
            >
              <span style={{fontSize:18,lineHeight:1}}>{item.icon}</span>
              <span style={{fontSize:10,fontWeight:700,letterSpacing:0.2}}>{item.label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>

    <button
      onClick={() => setFabOpen(v => !v)}
      aria-label={fabOpen ? "Fechar" : "Menu"}
      style={{
        position:"fixed",
        right:16,
        bottom:`calc(16px + env(safe-area-inset-bottom))`,
        zIndex:1201,
        width:56,
        height:56,
        borderRadius:"50%",
        background:fabOpen ? `${AC.claude}` : T.s1,
        border:`1px solid ${fabOpen ? AC.claude+"aa" : T.b1}`,
        color:fabOpen ? "#ffffff" : T.tx,
        fontSize:22,
        cursor:"pointer",
        boxShadow:fabOpen ? `0 10px 28px ${AC.claude}55` : "0 10px 28px #00000044",
        display:"flex",
        alignItems:"center",
        justifyContent:"center",
        transform:fabOpen ? "rotate(90deg)" : "rotate(0deg)",
        transition:"transform 300ms cubic-bezier(0.4,0,0.2,1), background 300ms cubic-bezier(0.4,0,0.2,1), box-shadow 300ms cubic-bezier(0.4,0,0.2,1), color 300ms cubic-bezier(0.4,0,0.2,1), border-color 300ms cubic-bezier(0.4,0,0.2,1)"
      }}
    >
      ⚙
    </button>
  </>
)}

          <div ref={chatRef} onScroll={e=>{const el=e.currentTarget;setAtBottom(el.scrollHeight-el.scrollTop-el.clientHeight<60);}} style={{flex:1,overflowY:"auto",padding:"13px 12px 7px",position:"relative"}}>
            {mostrarMemoryBanner && (
              <MemoryBanner
                onUsarContexto={usarContextoSessaoAnterior}
                onIgnorar={ignorarContextoSessaoAnterior}
              />
            )}
            {!atBottom&&msgs.length>0&&(
              <button onClick={()=>{botRef.current?.scrollIntoView({behavior:"smooth"});setAtBottom(true);}} style={{position:"sticky",bottom:10,left:"50%",transform:"translateX(-50%)",zIndex:10,display:"flex",alignItems:"center",gap:5,background:T.s1,border:`1px solid ${AC.claude}55`,borderRadius:18,padding:"5px 13px",color:AC.claude,fontSize:10,cursor:"pointer",fontFamily:"inherit",boxShadow:`0 4px 16px ${T.b2}88`,marginBottom:4}}>{"Descer"}</button>
            )}
            {msgs.length===0 ? (
              <div style={{minHeight:"80%",display:"flex",flexDirection:"column",justifyContent:"center"}}>
                <EstadoVazio
                  titulo={"Bem-vindo ao Córtex"}
                  subtitulo={`${"O que vamos explorar hoje?"} ${"Lobos oficiais"} · ${"Veredicto"} Rei/Codex`}
                  sugestoes={sugestoesIniciais}
                  onSugestao={aplicarSugestaoRei}
                />
                <div style={{display:"flex",justifyContent:"center",alignItems:"center",gap:12,fontSize:10,color:T.ts}}>
                  {brain.semantic.length>0
                    ?<span>🧠 {brain.semantic.length} {"Factos".toLowerCase()} · {brain.sessions} {"Sessões".toLowerCase()}</span>
                    :<button onClick={()=>setShowSeed(true)} style={{...btn(T,AC.genspark),fontSize:10,padding:"4px 10px"}}>{"Configurar o Cérebro"}</button>
                  }
                  {conversations.length>0&&<span style={{color:T.tf}}>· {conversations.length} {"Conversas"}</span>}
                </div>
              </div>
            ) : (
              <div style={{display:"flex",flexDirection:"column",gap:12,maxWidth:800,margin:"0 auto"}}>
<MessageList
  msgs={msgs}
  T={T}
  AC={AC}
  CopyBtn={CopyBtn}
  Markdown={Markdown}
  showCouncil={showCouncil}
  setShowCouncil={setShowCouncil}
  isMobile={isMobile}
  phase={phase}
  setPhase={setPhase}
  setMsgs={setMsgs}
  buildMem={buildMem}
  brain={brain}
  invoke={invoke}
  P={P}
  toast={toast}
  ClaudeCardComponent={KingCard}
  BeforeVerdictComponent={DebateTimeline}
  textosParciais={textosParciais}
  aStreaming={aStreaming}
  onSuggestionClick={aplicarSugestaoRei}
/>

                {cur&&(
                  <div style={{display:"flex",justifyContent:"flex-start"}}>
                    <div style={{background:T.s1,border:`1px solid ${T.b1}`,borderRadius:"3px 18px 18px 18px",padding:"14px 16px",minWidth:240,maxWidth:"80%",boxShadow:`0 2px 12px ${T.b2}88`}}>
                      {/* Rótulo da fase */}
                      <div style={{display:"flex",alignItems:"center",gap:7,marginBottom:10}}>
                        <div style={{display:"flex",gap:2}}>{LOBOS.map((l,index)=><div key={`lobe-${l.id}-${index}`} style={{width:5,height:5,borderRadius:"50%",background:lobeColor(l),opacity:phase==="council"?1:0.08,transition:"opacity 0.5s"}} className={phase==="council"?"pulse":""}/>)}</div>
                        <span style={{fontSize:10,color:cur.color,fontWeight:600,letterSpacing:1}}>{cur.label}</span>
                      </div>
                      {/* CouncilGrid para Streaming em tempo real */}
                      {(aStreaming || phase === 'council' || phase === 'judges') ? (
                        <CouncilGrid
                          lobos={LOBOS}
                          resultados={lobeResults}
                          parciais={partialTexts.current}
                          fase={phase}
                          aStreaming={isGenerating && phase === 'council'}
                        />
                      ) : (
                        <div style={{display:"flex",flexDirection:"column",gap:6}}>
                          <div className="skeleton" style={{height:10,width:"90%"}}/>
                          <div className="skeleton" style={{height:10,width:"75%"}}/>
                          <div className="skeleton" style={{height:10,width:"60%"}}/>
                        </div>
                      )}
                      {/* Barra de progresso */}
                      <div style={{height:2,background:T.b2,borderRadius:2,overflow:"hidden",marginTop:10}}>
                        <div style={{height:"100%",width:cur.pct,background:`linear-gradient(90deg,${cur.color}66,${cur.color})`,transition:"width 1s ease"}}/>
                      </div>
                    </div>
                  </div>
                )}
                <div ref={botRef} style={{height:isMobile?96:44,scrollMarginBottom:isMobile?120:64}}/>
              </div>
            )}
          </div>

          <div style={{padding:"8px 10px",paddingBottom:isMobile?"calc(72px + env(safe-area-inset-bottom))":"10px",background:T.s1,borderTop:`1px solid ${T.b2}`,flexShrink:0}}>
            <label style={{ fontSize:'0.85rem', color:'var(--text-muted)', display:'flex', alignItems:'center', gap:'6px', maxWidth:820, margin:'0 auto 6px' }}>
              <input
                type="checkbox"
                checked={modoDebate}
                onChange={e => setModoDebate(e.target.checked)}
              />
              🐺 Modo Debate
              {modoDebate &&
                <span style={{ color:'var(--warning)' }}>⏱ ~2× mais lento</span>
              }
            </label>
            {(modoDebate || aStreaming) && (
              <div style={{maxWidth:820,margin:"0 auto 8px"}}>
                <AlertaBanner
                  tipo="info"
                  mensagem={aStreaming ? "Streaming a correr — respostas parciais dos lobos." : "Modo debate activo — os lobos fazem segunda ronda antes do Rei."}
                />
              </div>
            )}
            {currentApprovalGate && (
              <div style={{maxWidth:820,margin:"0 auto 12px"}}>
                <AlertaBanner
                  tipo="aviso"
                  mensagem={currentApprovalGate.mensagem}
                >
                  <div style={{display:"flex",gap:8,marginTop:10}}>
                    <button onClick={()=>{
                      send(currentApprovalGate.query, { aprovado: true });
                      setCurrentApprovalGate(null);
                    }} style={btn(T, "#ef4444")}>Confirmar</button>
                    <button onClick={()=>setCurrentApprovalGate(null)} style={btn(T, T.ts)}>Cancelar</button>
                    <button onClick={()=>toast("Esta acção pode remover dados permanentemente.", "info")} style={btn(T, AC.gemini)}>Ver impacto</button>
                  </div>
                </AlertaBanner>
              </div>
            )}
            {showFileUpload && (
              <div style={{maxWidth:820,margin:"0 auto 8px",background:T.s2,border:`1px solid ${T.b1}`,borderRadius:14,padding:12,boxShadow:`0 8px 30px ${T.b2}88`}}>
                <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:10,marginBottom:10}}>
                  <strong style={{fontSize:12,color:T.tx}}>Anexar ficheiro</strong>
                  <button type="button" onClick={()=>setShowFileUpload(false)} style={{background:"transparent",border:`1px solid ${T.b1}`,borderRadius:8,color:T.ts,cursor:"pointer",fontSize:12,padding:"4px 9px",fontFamily:"inherit"}}>Fechar</button>
                </div>
                <FileUpload onUpload={handleFileUpload} />
              </div>
            )}
            {frustrationLevel === "high" && !phase && !frustrationDismissed && (
              <div style={{maxWidth:820,margin:"0 auto"}}>
                <FrustrationBanner 
                  onRetry={() => {
                    setFrustrationDismissed(true);
                    regenerate(); 
                  }}
                  onDismiss={() => {
                    setFrustrationDismissed(true);
                    setFrustrationLevel("none");
                  }}
                  T={T}
                />
              </div>
            )}
            <div style={{display:"flex",gap:8,maxWidth:820,margin:"0 auto",alignItems:"flex-end"}}>
              {/* caixa de texto */}
              <div style={{flex:1,display:"flex",background:T.s2,border:`1px solid ${T.b1}`,borderRadius:16,padding:"8px 10px",alignItems:"flex-end",boxShadow:`0 2px 14px ${T.b2}66`,transition:"border-color 0.2s",gap:8}}>
  <button type="button" onClick={()=>setShowFileUpload(p=>!p)} title="Anexar ficheiro" style={{background:ficheiroAnexado?`${AC.claude}18`:"transparent",border:`1px solid ${ficheiroAnexado?AC.claude+"55":T.b1}`,borderRadius:10,width:38,height:52,cursor:"pointer",fontSize:17,color:ficheiroAnexado?AC.claude:T.ts,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>📎</button>
  {ficheiroAnexado && (
    <div style={{maxWidth:150,minHeight:52,display:"flex",alignItems:"center",gap:6,border:`1px solid ${AC.claude}33`,background:`${AC.claude}10`,borderRadius:10,padding:"6px 8px",color:AC.claude,fontSize:10,flexShrink:0}}>
      <span style={{overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}} title={ficheiroAnexado.nome}>{ficheiroAnexado.nome}</span>
      <button type="button" onClick={removerFicheiroAnexado} title="Remover ficheiro" style={{background:"transparent",border:"none",color:T.ts,cursor:"pointer",fontSize:12,padding:0,lineHeight:1}}>✕</button>
    </div>
  )}
  <div style={{position:"relative",flex:1,minWidth:0}}>
    <textarea
      ref={inputRef}
      value={input}
      onChange={e=>{setInput(e.target.value);requestAnimationFrame(() => ajustar());}}
      onKeyDown={e=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();send();ajustar(true);}}}
      placeholder="Pergunta ao conselho..."
      disabled={!!phase}
      rows={1}
      style={{width:"100%",background:"transparent",border:"none",outline:"none",fontSize:13,color:T.tx,fontFamily:"inherit",resize:"none",overflow:"hidden",transition:"height 0.15s ease",minHeight:"52px",height:"52px",maxHeight:200,padding:"0.75rem 1rem 1.35rem",lineHeight:"1.5"}}
    />
    <div
      aria-hidden="true"
      style={{
        position:"absolute",
        right:12,
        bottom:6,
        fontSize:10,
        color:inputCounterWarn?"#f59e0b":T.tf,
        pointerEvents:"none",
        fontVariantNumeric:"tabular-nums",
      }}
    >
      {inputChars} chars · ~{inputTokens} tokens
    </div>
  </div>
  <div style={{display:"flex",gap:3,alignItems:"flex-end",flexShrink:0}}>
    {msgs.filter(m=>m.role==="user").length>0&&!phase&&
      <button onClick={regenerate} style={{background:"transparent",border:"none",borderRadius:8,width:30,height:30,cursor:"pointer",fontSize:13,color:T.ts,display:"flex",alignItems:"center",justifyContent:"center",transition:"all 0.18s",opacity:0.75}} onMouseEnter={e=>{e.currentTarget.style.opacity="1";e.currentTarget.style.color=AC.claude;}} onMouseLeave={e=>{e.currentTarget.style.opacity="0.75";e.currentTarget.style.color=T.ts;}} title={"Regerar Resposta"}>↺</button>}
    <button onClick={() => {
      ouvirMicrofone(setInput, (msg, type) => toast(msg, type));
    }} style={{background:"transparent",border:"none",borderRadius:8,width:30,height:30,cursor:"pointer",fontSize:13,color:T.ts,display:"flex",alignItems:"center",justifyContent:"center",transition:"all 0.18s",opacity:0.7}} onMouseEnter={e=>e.currentTarget.style.opacity="1"} onMouseLeave={e=>e.currentTarget.style.opacity="0.7"} title={"Ditado por Voz"}>🎙</button>
        {msgs.length>0&&
      <button onClick={exportConv} style={{background:"transparent",border:"none",borderRadius:8,width:30,height:30,cursor:"pointer",fontSize:13,color:T.ts,display:"flex",alignItems:"center",justifyContent:"center",transition:"all 0.18s",opacity:0.75}} onMouseEnter={e=>{e.currentTarget.style.opacity="1";e.currentTarget.style.color=AC.gemini;}} onMouseLeave={e=>{e.currentTarget.style.opacity="0.75";e.currentTarget.style.color=T.ts;}} title={"Exportar"}>↓</button>}
  </div>
</div>
              {/* botão enviar / parar */}
              {isGenerating ? (
                <button
                  type="button"
                  onClick={stopGeneration}
                  title="Parar geração"
                  style={{background:"rgba(239,68,68,0.18)",border:"1px solid rgba(239,68,68,0.44)",borderRadius:14,minWidth:72,height:44,cursor:"pointer",fontSize:12,fontWeight:800,color:"#fecaca",transition:"background 0.2s, box-shadow 0.2s, opacity 0.2s",display:"flex",alignItems:"center",justifyContent:"center",gap:6,boxShadow:"0 0 16px rgba(239,68,68,0.25)",flexShrink:0,fontFamily:"inherit"}}
                >■ Parar</button>
              ) : (
                <button
                  onClick={()=>{send();ajustar(true);}}
                  disabled={!!phase||!input.trim()}
                  style={{background:input.trim()&&!phase?"var(--accent)":"#333",border:"none",borderRadius:14,width:44,height:44,cursor:input.trim()&&!phase?"pointer":"not-allowed",fontSize:16,color:"#fff",transition:"background 0.2s, box-shadow 0.2s, opacity 0.2s",opacity:phase?0.4:1,display:"flex",alignItems:"center",justifyContent:"center",boxShadow:input.trim()&&!phase?"0 0 16px rgba(168,85,247,0.45)":"none",flexShrink:0}}
                  onMouseEnter={e=>{if(input.trim()&&!phase)e.currentTarget.style.background="#7e22ce";}}
                  onMouseLeave={e=>{if(input.trim()&&!phase)e.currentTarget.style.background="var(--accent)";}}
                >▶</button>
              )}
              {/* botão nova conversa */}
              <button onClick={newChat} title={"Nova Conversa"} style={{background:T.s2,border:`1px solid ${T.b1}`,borderRadius:14,width:44,height:44,cursor:"pointer",fontSize:16,color:T.ts,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,transition:"all 0.15s"}} onMouseEnter={e=>{e.currentTarget.style.borderColor=AC.claude+"66";e.currentTarget.style.color=AC.claude;}} onMouseLeave={e=>{e.currentTarget.style.borderColor=T.b1;e.currentTarget.style.color=T.ts;}}>+</button>
            </div>
            {buf.length>0&&<div style={{fontSize:8,color:T.tf,textAlign:"center",marginTop:4}}>{`${buf.length} / ${MAX_BUF} tokens`}</div>}
          </div>
        </>
      )}

      {/* ── CHAVES API ─────────────────────────────────────────── */}
      {page==="keys" && !devUnlocked && (
  <div style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:18,padding:24}}>
    <div style={{fontSize:36,fontWeight:900,color:AC.claude}}>◆</div>
    <div style={{textAlign:"center"}}>
      <div style={{fontSize:15,fontWeight:800,color:T.tx,marginBottom:4}}>{"Modo de Desenvolvimento"}</div>
      <div style={{fontSize:11,color:T.ts}}>{"Insira o PIN de acesso"}</div>
    </div>
    <div style={{display:"flex",flexDirection:"column",gap:8,width:"100%",maxWidth:280}}>
      <input type="password" value={pinInput} onChange={e=>{setPinInput(e.target.value);setPinErr(false);}} onKeyDown={e=>{if(e.key==="Enter"){if(pinInput===getDevPin()){setDevUnlocked(true);setPinInput("");}else{setPinErr(true);setPinInput("");}}} } placeholder={"PIN"} maxLength={12} style={{background:T.s2,border:`1px solid ${pinErr?"#ef4444":T.b1}`,borderRadius:12,padding:"10px 14px",color:T.tx,fontSize:14,fontFamily:"monospace",outline:"none",textAlign:"center",letterSpacing:4}} autoFocus/>
      {pinErr&&<div style={{fontSize:10,color:"#ef4444",textAlign:"center"}}>{"PIN inválido"}</div>}
      <button onClick={()=>{if(pinInput===getDevPin()){setDevUnlocked(true);setPinInput("");setPinErr(false);}else{setPinErr(true);setPinInput("");}}} style={{background:`${AC.claude}22`,border:`1px solid ${AC.claude}44`,borderRadius:10,padding:"8px 0",color:AC.claude,fontSize:12,fontWeight:700,cursor:"pointer",fontFamily:"inherit"}}>{"Entrar"}</button>
    </div>
    <div style={{fontSize:9,color:T.tf,textAlign:"center",maxWidth:240}}>{"O PIN protege as chaves da API de acessos indevidos no browser."}</div>
  </div>
)}

{page==="keys" && devUnlocked && (
  <div style={{flex:1,overflowY:"auto",padding:16,display:"flex",flexDirection:"column",gap:10,maxWidth:580,width:"100%",margin:"0 auto"}}>
    <div style={{display:"flex",alignItems:"center",justifyContent:"space-between"}}>
      <h2 style={{margin:0,fontSize:14,fontWeight:800,color:T.tx}}>{"Gestor de Chaves API"}</h2>
      <button onClick={()=>{setDevUnlocked(false);setPinInput("");}} style={{fontSize:9,color:T.ts,background:"transparent",border:`1px solid ${T.b1}`,borderRadius:6,padding:"3px 8px",cursor:"pointer",fontFamily:"inherit"}}>{"Bloquear"}</button>
    </div>
    <p style={{margin:0,fontSize:11,color:T.ts}}>{"As tuas chaves são encriptadas e guardadas apenas no teu localStorage."}</p>
    {[
      {id:"grok",    label:"Grok",           color:AC.grok,             link:"console.x.ai",               ph:"xai-...",     desc:"Grátis · grok-3"},
      {id:"gemini",  label:"Gemini",         color:AC.gemini,           link:"aistudio.google.com/apikey",  ph:"AIza...",     desc:"Grátis · gemini-2.5-flash"},
      {id:"perp",    label:"Groq (Lobo Web)",color:AC.perp,             link:"console.groq.com",            ph:"gsk_...",     desc:"Grátis · llama-3.3-70b"},
      {id:"openai",  label:"OpenAI",         color:AC.openai||"#74aa9c",link:"platform.openai.com/api-keys",ph:"sk-proj-...", desc:"gpt-4o"},
      {id:"deepseek",label:"DeepSeek",       color:AC.deepseek||"#4d9fff",link:"platform.deepseek.com",    ph:"sk-...",      desc:"deepseek-chat"},
      {id:"llama",   label:"Llama (Groq)",   color:AC.llama||"#e879f9", link:"console.groq.com/keys",       ph:"gsk_...",     desc:"llama-4-scout via Groq"},
      {id:"mistral", label:"Mistral",        color:AC.mistral||"#f97316",link:"console.mistral.ai/api-keys",ph:"...",         desc:"mistral-large-latest"},
      {id:"genspark", label:"Genspark",  color:AC.genspark, link:"www.genspark.ai/settings/api",  ph:"gs-...",     desc:"Síntese multi-IA"},
      {id:"manus",    label:"Manus",     color:AC.manus,    link:"manus.im",                       ph:"manus-...",  desc:"Agente autónomo"},
      {id:"claude",  label:"Claude",         color:AC.claude,           link:"console.anthropic.com",       ph:"sk-ant-...",  desc:"Pago · claude-sonnet"},
    ].map((api,idx)=>(
      <KeyRow key={`api-${idx}-${api.id}`} api={api} T={T} value={keys[api.id]||""} onChange={v=>{
        const nk={...keys,[api.id]:v};setKeys(nk);saveKeys(nk);
      }}/>
    ))}
  </div>
)}
      {/* ── MEMÓRIA ─────────────────────────────────────────── */}
      {page==="memory" && (
        <div style={{flex:1,overflowY:"auto",padding:13,display:"flex",flexDirection:"column",gap:11,maxWidth:700,width:"100%",margin:"0 auto",boxSizing:"border-box"}}>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",flexWrap:"wrap",gap:7}}>
            <div><h2 style={{margin:0,fontSize:14,fontWeight:800,color:T.tx}}>{"Banco de Memória"}</h2><p style={{margin:"2px 0 0",fontSize:10,color:T.ts}}>{"Episódica, semântica e padrões de raciocínio."}</p></div>
            <div style={{display:"flex",gap:5,flexWrap:"wrap"}}>
              {[[()=>setShowSeed(true),AC.genspark,"Semente"],[()=>setShowExport(true),AC.perp,"Exportar"],[()=>setShowImport(true),AC.gemini,"Importar"],[()=>{if(confirm("Apagar TODA a memória?")){setBrain(defaultBrain);saveBrain(defaultBrain);setBuf([]);}},  "#ef4444","Apagar"]].map(([fn,c,lbl],i)=><button key={`memory-action-${i}-${lbl}`} onClick={fn} style={{...btn(T,c),padding:"4px 8px"}}>{lbl}</button>)}
            </div>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(130px,1fr))",gap:7}}>
            {[[brain.semantic.length,"Factos",AC.claude,"◆"],[brain.sessions,"Sessões",AC.gemini,"◈"],[brain.patterns.length,"Padrões",AC.grok,"◉"],[brain.semantic.length+brain.episodic.length+brain.patterns.length,"Total",AC.genspark,"◎"]].map(([n,l,c,ic],idx)=>(
              <div key={`memory-stat-${idx}-${l}`} style={{background:T.s1,border:`1px solid ${T.b1}`,borderRadius:13,padding:"11px 7px",textAlign:"center"}}>
                <div style={{fontSize:10,color:c,marginBottom:2}}>{ic}</div>
                <div style={{fontSize:21,fontWeight:800,color:T.tx,lineHeight:1}}>{n}</div>
                <div style={{fontSize:8,color:T.ts,marginTop:2}}>{l}</div>
              </div>
            ))}
          </div>
          {[{title:"Semântica",sub:"Conhecimento base",color:AC.claude,icon:"◆",items:brain.semantic.slice().reverse().map(x=>`[${x.tipo}] ${x.descricao}`)},{title:"Episódica",sub:"Histórico contínuo",color:AC.gemini,icon:"◈",items:brain.episodic.slice().reverse()},{title:"Padrões",sub:"Raciocínio dedutivo",color:AC.grok,icon:"◉",items:brain.patterns}].map((sec,idx)=>(
            <div key={`memory-section-${idx}-${sec.title}`} style={{background:T.s1,border:`1px solid ${T.b1}`,borderRadius:13,overflow:"hidden"}}>
              <div style={{padding:"9px 13px",borderBottom:sec.items.length>0?`1px solid ${T.b2}`:"none",display:"flex",alignItems:"center",gap:6}}>
                <span style={{color:sec.color,fontSize:12}}>{sec.icon}</span>
                <div><div style={{fontSize:11,fontWeight:600,color:T.tx}}>{sec.title}</div><div style={{fontSize:9,color:T.ts}}>{sec.sub}</div></div>
                <span style={{marginLeft:"auto",fontSize:9,color:T.tf,background:T.s2,border:`1px solid ${T.b1}`,borderRadius:20,padding:"1px 6px"}}>{sec.items.length}</span>
              </div>
              {sec.items.length===0?<div style={{padding:"11px 13px",fontSize:10,color:T.tf,fontStyle:"italic"}}>{"Memória vazia"}</div>:sec.items.map((it,i)=><div key={`memory-item-${i}-${String(it).slice(0,10)}`} style={{padding:"6px 13px",fontSize:10,color:T.ts,borderBottom:i<sec.items.length-1?`1px solid ${T.b2}`:"none",lineHeight:1.5}}>• {it}</div>)}
            </div>
          ))}
          {brain.lastReflect&&<div style={{fontSize:8,color:T.tf,textAlign:"center"}}>{"Última reflexão:"} {new Date(brain.lastReflect).toLocaleString("pt-PT")}</div>}
        </div>
      )}

      {/* ── DEFINIÇÕES ───────────────────────────────────────── */}
      {page==="settings" && (
        <div style={{flex:1,overflowY:"auto",padding:"18px 16px 24px",maxWidth:880,width:"100%",margin:"0 auto",boxSizing:"border-box"}}>
          <div style={{display:"flex",alignItems:"flex-end",justifyContent:"space-between",gap:12,marginBottom:16,flexWrap:"wrap"}}>
            <div>
              <h2 style={{margin:0,fontSize:20,fontWeight:900,color:T.tx,letterSpacing:0.2}}>{"Definições Globais"}</h2>
              <p style={{margin:"6px 0 0",fontSize:12,color:T.ts,lineHeight:1.5}}>Córtex v12 com {MODELS.length} lobos oficiais, memória local e proxy sem servidor.</p>
            </div>
            <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
              <span style={{border:`1px solid ${AC.claude}44`,background:`${AC.claude}12`,color:AC.claude,borderRadius:999,padding:"5px 9px",fontSize:11,fontWeight:800}}>Compilação {BUILD}</span>
              <span style={{border:`1px solid ${T.b1}`,background:T.s2,color:T.ts,borderRadius:999,padding:"5px 9px",fontSize:11}}>{Object.values(keys).filter(k=>k?.trim().length>10).length}/{Object.keys(keys).length} chaves</span>
            </div>
          </div>

          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(190px,1fr))",gap:10,marginBottom:14}}>
            {[
              {icon:THEMES[theme].emoji,title:"Personalização",sub:`${THEMES[theme].name} · ${Object.keys(THEMES).length} temas disponíveis`,action:"Alterar Tema",color:AC.claude,onClick:()=>setShowTP(true)},
              {icon:"🔑",title:"Chaves API",sub:`${Object.values(keys).filter(k=>k?.trim().length>10).length} de ${Object.keys(keys).length} chaves configuradas`,action:"Gerir",color:AC.perp,onClick:()=>setPage("keys")},
              {icon:"◈",title:"Lobos",sub:`${MODELS.filter(m=>modelsOn[m.id]!==false).length}/${MODELS.length} lobos activos`,action:"Gerir",color:AC.gemini,onClick:()=>setShowModels(true)},
              {icon:"🧠",title:"Banco de Memória",sub:`${brain.semantic.length} factos · ${brain.sessions} conversas`,action:"Abrir",color:AC.grok,onClick:()=>setPage("memory")},
              {icon:"🔬",title:"Modo Forense",sub:`${msgs.length} mensagens · fase ${phase || "parado"}`,action:"Abrir",color:AC.deepseek,onClick:()=>setShowForensePanel(true)},
            ].map((card,idx)=>(
              <button key={`settings-card-${idx}-${card.title}`} type="button" onClick={card.onClick} style={{background:T.s1,border:`1px solid ${T.b1}`,borderRadius:14,padding:14,textAlign:"left",cursor:"pointer",fontFamily:"inherit",minHeight:118,display:"flex",flexDirection:"column",justifyContent:"space-between",boxShadow:`0 8px 24px ${T.b2}55`,transition:"border-color 0.2s, transform 0.2s"}}>
                <div style={{display:"flex",alignItems:"center",gap:9}}>
                  <span style={{width:30,height:30,borderRadius:10,display:"flex",alignItems:"center",justifyContent:"center",background:`${card.color}18`,border:`1px solid ${card.color}44`,color:card.color,fontSize:15}}>{card.icon}</span>
                  <div style={{minWidth:0}}>
                    <div style={{fontSize:13,fontWeight:850,color:T.tx}}>{card.title}</div>
                    <div style={{fontSize:10,color:T.ts,marginTop:3,lineHeight:1.4}}>{card.sub}</div>
                  </div>
                </div>
                <div style={{fontSize:11,fontWeight:800,color:card.color,marginTop:12}}>{card.action} →</div>
              </button>
            ))}
          </div>

          <div style={{background:T.s1,border:`1px solid ${T.b1}`,borderRadius:16,padding:14,boxShadow:`0 8px 24px ${T.b2}55`,marginBottom:14,display:"flex",alignItems:"center",justifyContent:"space-between",gap:12,flexWrap:"wrap"}}>
            <div style={{minWidth:220,flex:1}}>
              <div style={{fontSize:14,fontWeight:900,color:T.tx}}>{"Memória de sessões anteriores"}</div>
              <div style={{fontSize:11,color:T.ts,lineHeight:1.5,marginTop:4}}>
                {"O Córtex guarda um resumo das últimas conversas para oferecer continuidade."}
              </div>
            </div>
            <button
              type="button"
              onClick={()=>{
                clearMemory();
                setContextoSessaoAnterior(null);
                setMemoryBannerDismissed(true);
                toast("Memória apagada.", "sucesso");
              }}
              style={btn(T,"#ef4444")}
            >
              {"Apagar memória"}
            </button>
          </div>

          <div style={{background:T.s1,border:`1px solid ${T.b1}`,borderRadius:16,padding:14,boxShadow:`0 8px 24px ${T.b2}55`}}>
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:10,marginBottom:10}}>
              <div>
                <div style={{fontSize:14,fontWeight:900,color:T.tx}}>{"Arquitectura"}</div>
                <div style={{fontSize:10,color:T.ts,marginTop:3}}>Router inteligente escolhe só os lobos necessários; nunca corre uma lista antiga de 11 ao mesmo tempo.</div>
              </div>
              <button type="button" onClick={()=>setShowModels(true)} style={btn(T,AC.gemini)}>Configurar lobos</button>
            </div>
            <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(230px,1fr))",gap:8}}>
              {MODELS.map((m,idx)=>(
                <div key={`arch-${idx}-${m.id}`} style={{padding:"10px 11px",border:`1px solid ${lobeConfigAberto===m.id?m.color+"55":T.b2}`,borderRadius:12,background:T.s2}}>
                  <div style={{display:"flex",gap:9,alignItems:"center"}}>
                    <span style={{width:9,height:9,borderRadius:"50%",background:modelsOn[m.id]!==false?m.color:T.tf,boxShadow:modelsOn[m.id]!==false?`0 0 10px ${m.color}66`:"none",flexShrink:0}}/>
                    <div style={{minWidth:0,flex:1}}>
                      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:8}}>
                        <button
                          type="button"
                          onClick={()=>setLobeConfigAberto(v=>v===m.id?null:m.id)}
                          style={{background:"transparent",border:"none",padding:0,fontFamily:"inherit",fontSize:11,fontWeight:800,color:T.tx,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",cursor:"pointer",textAlign:"left"}}
                        >
                          {m.name}
                        </button>
                        <span style={{fontSize:9,color:modelsOn[m.id]!==false?AC.claude:T.tf,fontWeight:800}}>{modelsOn[m.id]!==false?"activo":"inactivo"}</span>
                      </div>
                      <div style={{fontSize:9,color:T.ts,marginTop:3,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{m.version}</div>
                    </div>
                  </div>
                  {lobeConfigAberto===m.id && (
                    <div style={{marginTop:10,paddingTop:9,borderTop:`1px solid ${T.b1}`}}>
                      <Slider
                        valor={temperaturas[m.id] ?? 0.7}
                        min={0}
                        max={1}
                        passo={0.1}
                        cor={m.color}
                        label="Temperatura"
                        onChange={(valor)=>{
                          const next={...temperaturas,[m.id]:valor};
                          setTemperaturas(next);
                          saveTemperaturas(next);
                        }}
                      />
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
      {import.meta.env.DEV && (
        <>
          <button
            onClick={() => setShowEvals(true)}
            style={{
              position: 'fixed', bottom: '1rem', right: '1rem',
              background: 'var(--cor-fundo-2)',
              border: '1px solid var(--cor-borda)',
              borderRadius: '8px', padding: '0.4rem 0.8rem',
              cursor: 'pointer', fontSize: '0.85rem', zIndex: 999
            }}
          >🧪 Avaliações</button>
          {showEvals && <EvalsPanel onClose={() => setShowEvals(false)} />}
        </>
      )}
 </div>
    );
  }
