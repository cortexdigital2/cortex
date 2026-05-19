# Córtex Digital — Contexto do Projeto

## Identificação
- **Aluno:** Alexandre — CTeSP Automação e Gestão Industrial, IPCB Castelo Branco
- **Versão atual:** v12
- **Localização local:** `C:\Users\Alexandre\Desktop\Computador Inteligência Adaptativa`
- **Ficheiro principal:** `src/cortex-digital.jsx`

## Stack
- React 18 + Vite 5.4.21
- Deploy: Vercel (sem servidor local)
- Proxy de APIs: Vercel serverless functions (`/api/*`)
- Sem Tailwind, sem shadcn, sem Express, sem SQLite

## Arquitectura
- **5 lobos oficiais** em paralelo (`Promise.allSettled`) com **Rei como juiz final**
  (`meta-llama/llama-3.3-70b-instruct:free` via OpenRouter, definido em `src/api/king.js`)
- Router inteligente (`routerDecide()`) — usa apenas lobos oficiais de `LOBOS`
- Todos passam por `/api/chat` (proxy serverless OpenRouter)
- Memória em `localStorage` (migração para Supabase planeada)
- Constante de versão: `const MV = "cortex-v12"` no topo do ficheiro

## Modelos Activos (2026-05-14)
| Lobe                  | Modelo                                              |
|-----------------------|-----------------------------------------------------|
| Analista Crítico      | qwen/qwen3-next-80b-a3b-instruct:free               |
| Inovador Criativo     | google/gemma-4-31b-it:free                          |
| Pragmático Técnico    | nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free  |
| Generalista Contextual| openai/gpt-oss-120b:free                            |
| Advogado do Diabo     | nousresearch/hermes-3-llama-3.1-405b:free           |
| **Rei (Juiz)**        | meta-llama/llama-3.3-70b-instruct:free              |

## OpenRouter Plugins Activos
- `file-parser` PDF — engine cloudflare-ai (substitui pdfjs-dist)
- `response-healing` — Rei non-streaming; corrige JSON malformado
- `openrouter:web_search` — Analista Crítico (id=1) + Generalista (id=4); max 3, PT
- `openrouter:datetime` — todos os lobos, Europe/Lisbon
- `openrouter/fusion` — fallback Rei em falha (pago, só activa quando Llama falha)

### Plugins Obsoletos (não usar)
- `{ id: 'web' }` → substituído por openrouter:web_search
- sufixo `:online` → substituído por tools array
- `pdfjs-dist` local → substituído por file-parser plugin

## Nomenclatura
- `lobos` = agentes individuais
- `council` = síntese final pelo Rei
- `pills` = botões da navbar
- `LOBOS` = array oficial dos 5 lobos em `src/api/council.js`
- `LOBES` = alias legado, prop interna em useCouncil
- `P` = objeto de prompts | `T` = tema (cores) | `AC` = accent colors por modelo
- `invoke()` = chamada individual por lobe
- `send()` = dispara o council completo
- `chamarLobeStream()` = SSE parcial por lobe em council.js
- `runDebateStream()` = debate multi-lobe SSE com fallback
- `routerDecide()` = router inteligente de seleção de lobos
- `normalizeCouncilPayload()` = normaliza payload da resposta
- `safeParseReflect()` = parse seguro da reflexão

## Hooks
- `useCouncil.js` = orquestração council, debate, juízes e Rei
- `useStreaming.js` = estado parcial por lobe durante SSE
- `useAutoResize.js` = auto-resize do input principal
- `useFileUpload.js` = F4-02 upload universal + previews
- `useExport.js` = F4-03 export Word/Excel/Notion

## Forma de Trabalho (Padrão Codex CLI)
- Patches incrementais, **um de cada vez**
- Substitui blocos exactos — nunca reescreve ficheiro inteiro
- Não quebra funcionalidades sem aviso explícito
- Usa `.catch(() => {})` onde externas não podem quebrar UX
- Preambles 8-12 palavras antes de tool calls, sem "Certamente!"
- Timeout 8s por lobe — AbortController Map por lobe
- Promise.allSettled sempre (NUNCA Promise.all)

## Contexto de Sistema Disponível
- `SOUL.md` — valores, personalidade e regras de ouro do sistema
- `AGENTS.md` — arquitectura completa, modelos, roadmap detalhado
- `.claude/skills/cortex-digital` — skill principal do projeto
- `.codex/` — contexto para Codex CLI

## Fase 4 — Estado actual
- F4-00: Routing dinâmico ✅
- F4-01: Upload imagens Gemini ⏳
- F4-02: Upload Universal ⏳
- F4-03: Export Word/Excel/Notion ⏳
- F4-04: Voz STT→debate→TTS ✅
- F4-05: Citações inline Claude ✅
- F4-06: Defesas prompt injection ✅
- F4-07: Evals runner ✅ (HOJE)
- F4-08: Multilinguismo PT real ⏳
- F4-09: Melhoria automática pergunta ✅
- F4-10: Compressão de contexto ✅

Fase 4: 7/11 ✅

## Segurança
- xlsx removido → exceljs ✅
- protobufjs audit fix ✅
- UTF-8 encoding headers ✅
- Mojibake cortex-digital.jsx ✅

## Stack actual
React + Vite | Vercel | Supabase | Qdrant
OpenRouter | Claude 3.5/3.7 | Tavily | Stripe

## Próximo: Fase 5
- F5-01: RAG Qdrant
- F5-02: Memória entre sessões
- F5-03: Knowledge Graph
