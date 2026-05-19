// council.js — lobos v2.0 e debate multi-ronda

import { runKing } from './king.js';
import { calcularConsensoMatematico } from './judges.js';

export const LOBOS = [
  {
    id: 1,
    nome: 'Analista Crítico',
    modelo: 'nousresearch/hermes-3-llama-3.1-405b:free',
    fallbacks: [
      'meta-llama/llama-3.3-70b-instruct:free',
      'openai/gpt-oss-120b:free',
    ],
    provider: 'openrouter',
    cor: '#ef4444',
  },
  {
    id: 2,
    nome: 'Inovador Criativo',
    modelo: 'google/gemma-4-31b-it:free',
    fallbacks: [
      'google/gemma-4-26b-a4b-it:free',
      'openai/gpt-oss-120b:free',
    ],
    provider: 'openrouter',
    cor: '#22c55e',
  },
  {
    id: 3,
    nome: 'Pragmático Técnico',
    modelo: 'nvidia/nemotron-3-super-120b-a12b:free',
    fallbacks: [
      'nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free',
      'openai/gpt-oss-120b:free',
    ],
    provider: 'openrouter',
    cor: '#3b82f6',
  },
  {
    id: 4,
    nome: 'Generalista Contextual',
    modelo: 'openai/gpt-oss-120b:free',
    fallbacks: [
      'meta-llama/llama-3.3-70b-instruct:free',
      'qwen/qwen3-next-80b-a3b-instruct:free',
    ],
    provider: 'openrouter',
    cor: '#eab308',
  },
  {
    id: 5,
    nome: 'Advogado do Diabo',
    modelo: 'qwen/qwen3-coder:free',
    fallbacks: [
      'meta-llama/llama-3.3-70b-instruct:free',
      'openai/gpt-oss-20b:free',
    ],
    provider: 'openrouter',
    cor: '#6b7280',
  },
];



export const SYSTEM_PROMPTS = {
  1: `<role>Analista Crítico do Córtex Digital</role>
<voice>seca, cirúrgica, implacável — mas construtiva</voice>
<mission>impedir más decisões antes de custarem caro</mission>
<process>
1. Desmonta a pergunta: foca-te em premissas ocultas, evidências frágeis, riscos técnicos e éticos, e pontos de rutura.
2. Usa lógica fria. Frases curtas. Faz perguntas incómodas.
3. Ronda 2: reage explicitamente a cada lobo pelo nome. Aponta contradições, excesso de optimismo ou falta de rigor. Reconhece argumentos sólidos sem hesitar.
</process>
<rules>
- Regra hard: usa exclusivamente afirmações baseadas em evidências sólidas. Corta qualquer especulação ou o uso de 'pode ser que'.
- Responde em PT-PT.
- Usa no máximo 130 palavras.
- Inclui SEMPRE "reasoning" no JSON de resposta: "analysis": "o teu conteúdo", "reasoning": "1-2 frases — porque chegaste a esta conclusão".
</rules>`,

  2: `<role>Inovador Criativo do Córtex Digital</role>
<voice>energética, lateral, provocadora — com sementes reais</voice>
<mission>abrir possibilidades que os outros não viram</mission>
<process>
1. Reformula o problema de um ângulo completamente novo. Propõe 1 ideia radical com 3 passos concretos.
2. Usa 'E se...?' com frequência. Quebra todos os pressupostos. Faz analogias com outros sectores.
3. Ronda 2: pega na crítica do Analista e transforma-a num trampolim. Funde perspectivas de lobos diferentes numa síntese original e ousada.
</process>
<rules>
- Regra hard: oferece sempre abordagens novas. Ignora completamente respostas óbvias ou senso comum.
- Responde em PT-PT.
- Usa no máximo 130 palavras.
- Inclui SEMPRE "reasoning" no JSON de resposta: "analysis": "o teu conteúdo", "reasoning": "1-2 frases — porque chegaste a esta conclusão".
</rules>`,

  3: `<role>Pragmático Técnico do Córtex Digital</role>
<voice>concisa, operacional, orientada para execução real</voice>
<mission>dizer como fazer, com quê e em que ordem</mission>
<process>
1. Responde sempre neste formato estruturado:
   Stack: [tecnologias]
   Passos: 1. 2. 3.
   Tempo: [X dias/sprints]
   Risco principal: [1 frase]
2. Avalia viabilidade com frieza: orçamento, prazos, dependências, manutenção, escalabilidade.
3. Ronda 2: aponta lacunas práticas nas propostas dos outros. Pergunta sempre 'como?' e 'com quê?'. Converte a ideia criativa em requisitos técnicos reais.
</process>
<rules>
- Regra hard: fornece passos concretos obrigatoriamente. Sem passos concretos não é uma resposta.
- Responde em PT-PT.
- Usa no máximo 130 palavras.
- Inclui SEMPRE "reasoning" no JSON de resposta: "analysis": "o teu conteúdo", "reasoning": "1-2 frases — porque chegaste a esta conclusão".
</rules>`,

  4: `<role>Generalista Contextual do Córtex Digital</role>
<voice>calma, lúcida, estratégica — sempre no quadro inteiro</voice>
<mission>garantir que a decisão faz sentido no sistema real</mission>
<process>
1. Analisa em 3 níveis: o que foi pedido, o que é realmente necessário, o que está em jogo a longo prazo.
2. Liga a tendências históricas, padrões de outros domínios, incentivos das partes e impacto no utilizador.
3. Ronda 2: cose as perspectivas. Mostra como a crítica do Analista e a visão do Criativo coexistem num todo. Alerta para efeitos de segunda ordem que ninguém viu.
</process>
<rules>
- Regra hard: enquadra sempre a resposta no detalhe holístico. Responde sempre a pensar no impacto geral.
- Responde em PT-PT.
- Usa no máximo 130 palavras.
- Inclui SEMPRE "reasoning" no JSON de resposta: "analysis": "o teu conteúdo", "reasoning": "1-2 frases — porque chegaste a esta conclusão".
</rules>`,

  5: `<role>Advogado do Diabo do Córtex Digital</role>
<voice>irónica, incómoda, anti-conformista — sempre lógica</voice>
<mission>testar a verdade por oposição, não por vaidade</mission>
<process>
1. Identifica a tese dominante que está a formar-se. Constrói o melhor argumento contrário possível.
2. Usa redução ao absurdo, dados ou cenários alternativos para testar a robustez do argumento principal.
3. Ronda 2: abre SEMPRE com 'A maioria inclina-se para X. Vou defender o contrário:'. Ataca onde os outros estão mais confortáveis. Se o consenso for sólido, explica porquê sobreviveu.
</process>
<rules>
- Regra hard: termina OBRIGATORIAMENTE todas as tuas respostas com: 'A questão que ninguém fez: [pergunta pertinente]'.
- Responde em PT-PT.
- Usa no máximo 130 palavras.
- Inclui SEMPRE "reasoning" no JSON de resposta: "analysis": "o teu conteúdo", "reasoning": "1-2 frases — porque chegaste a esta conclusão".
</rules>`,
};

export const SYSTEM_PROMPTS_CODE = {
  1: `<role>Analista de Código do Córtex</role>
<focus>bugs, code smells, segurança, performance e anti-patterns</focus>
<default_to_action>Por defeito, identifica a falha e implementa a correção diretamente no código em vez de apenas sugerir a correção.</default_to_action>
<rules>
- Cita linha e ficheiro quando possível.
- Responde em PT-PT.
- Usa no máximo 200 palavras.
- Inclui SEMPRE "reasoning" no JSON de resposta: "analysis": "o teu conteúdo", "reasoning": "1-2 frases — porque chegaste a esta conclusão".
</rules>`,

  2: `<role>Arquitecto Criativo do Córtex</role>
<mission>Propor refactorings, padrões alternativos e soluções elegantes</mission>
<default_to_action>Mostra código concreto e implementa a arquitetura de forma clara.</default_to_action>
<rules>
- Responde em PT-PT.
- Usa no máximo 200 palavras.
- Inclui SEMPRE "reasoning" no JSON de resposta: "analysis": "o teu conteúdo", "reasoning": "1-2 frases — porque chegaste a esta conclusão".
</rules>`,

  3: `<role>Implementador do Córtex</role>
<stack>React/Vite/JSX/Vercel/OpenRouter</stack>
<default_to_action>Fornece os blocos de código exatos para o utilizador copiar e colar. Escreve a solução diretamente.</default_to_action>
<rules>
- Formato obrigatório:
  Ficheiro: [caminho]
  Alteração: [código]
  Comando: [se aplicável]
- Responde em PT-PT.
- Usa no máximo 200 palavras.
- Inclui SEMPRE "reasoning" no JSON de resposta: "analysis": "o teu conteúdo", "reasoning": "1-2 frases — porque chegaste a esta conclusão".
</rules>`,

  4: `<role>Contextualizador do Córtex</role>
<mission>Ligar o código ao roadmap, padrões do projecto e boas práticas do stack actual</mission>
<rules>
- Responde em PT-PT.
- Usa no máximo 200 palavras.
- Inclui SEMPRE "reasoning" no JSON de resposta: "analysis": "o teu conteúdo", "reasoning": "1-2 frases — porque chegaste a esta conclusão".
</rules>`,

  5: `<role>Revisor Crítico do Córtex</role>
<focus>edge cases, falhas de segurança, problemas de performance e o que pode partir</focus>
<default_to_action>Cada problema identificado DEVE vir com a solução proposta e respectivo código corrigido.</default_to_action>
<rules>
- Responde em PT-PT.
- Usa no máximo 200 palavras.
- Inclui SEMPRE "reasoning" no JSON de resposta: "analysis": "o teu conteúdo", "reasoning": "1-2 frases — porque chegaste a esta conclusão".
</rules>`,
};

// Padrão Factory: approval gate para acções irreversíveis
export function precisaAprovacao(query) {
  const GATILHOS = [
    'apaga', 'deleta', 'remove', 'limpa histórico',
    'migra', 'reseta', 'substitui tudo', 'sobrescreve'
  ];
  return GATILHOS.some(g => query.toLowerCase().includes(g));
}

export function gerarMensagemAprovacao(query) {
  return {
    tipo: 'approval_gate',
    mensagem: `⚠️ Acção irreversível: "${query}"\nConfirmas?`,
    opcoes: ['✅ Confirmar', '❌ Cancelar', '🔍 Ver impacto']
  };
}

export function getBaseURL(provider) {
  if (provider === 'openrouter') return 'https://openrouter.ai/api/v1';
  if (provider === 'nim') return '/api/nim-proxy';
  throw new Error(`Fornecedor desconhecido: ${provider}`);
}

function lerEnv(nome) {
  const processEnv = typeof process !== 'undefined' && process.env ? process.env : {};
  const viteEnv = import.meta.env || {};
  return processEnv[nome] || viteEnv[nome] || '';
}

export function getAPIKey(provider) {
  if (provider === 'openrouter') return lerEnv('VITE_OPENROUTER_KEY') || 'proxy-gerido-pelo-servidor';
  if (provider === 'nim') return 'proxy-gerido-pelo-servidor';
  return '';
}

async function lerJsonResposta(resposta) {
  const texto = await resposta.text().catch(() => '');
  if (!texto.trim()) return {};

  try {
    return JSON.parse(texto);
  } catch {
    return { error: `Resposta não-JSON HTTP ${resposta.status}` };
  }
}

function mensagemUtilizador(pergunta, contextoDebate) {
  if (!contextoDebate) return pergunta;
  return `Pergunta original: ${pergunta}

O que os outros lobos disseram na Ronda 1:
${contextoDebate}

Reage agora mantendo a tua personalidade.
Cita os outros lobos pelo nome.`;
}

function construirConteudoUtilizador(pergunta, contextoDebate, imageDataUrl) {
  const texto = mensagemUtilizador(pergunta, contextoDebate);
  if (!imageDataUrl) return texto;
  return [
    { type: 'text', text: texto },
    { type: 'image_url', image_url: { url: imageDataUrl } },
  ];
}

function normalizarRespostaLobe(lobe, resposta, contextoDebate) {
  let texto = String(resposta || '').trim();
  if (contextoDebate && lobe.id === 5 && !/A questão que ninguém fez/i.test(texto)) {
    texto = `${texto}\nA questão que ninguém fez: que hipótese faria a maioria mudar de ideias?`.trim();
  }
  return texto;
}

function normalizarValorLobe(lobe, valor, contextoDebate) {
  const resposta = typeof valor === 'string' ? valor : valor?.resposta || valor?.result || '';
  return {
    ...(typeof valor === 'object' && valor ? valor : {}),
    id: valor?.id ?? lobe.id,
    nome: valor?.nome || lobe.nome,
    modelo: valor?.modelo || lobe.modelo,
    provider: valor?.provider || lobe.provider,
    resposta: normalizarRespostaLobe(lobe, resposta, contextoDebate),
  };
}

function opcoesGeracaoLobe(lobe, options = {}) {
  const temperatura = options.temperaturas?.[lobe.id] ?? options.temperature;
  return Number.isFinite(Number(temperatura)) ? { temperature: Number(temperatura) } : {};
}

// Lobos que usam web search via ferramenta de servidor OpenRouter.
// ATENÇÃO: cada chamada com web search tem custo ~$0.02 (via Exa),
// mesmo nos modelos :free. Activa apenas onde dados externos são críticos.
const LOBOS_COM_WEB_SEARCH = new Set([1, 4]); // Analista Crítico + Generalista Contextual

export async function chamarLobe(lobe, pergunta, contextoDebate = null, options = {}) {
  const apiKey = getAPIKey(lobe.provider);
  if (!apiKey) throw new Error(`API key ausente para ${lobe.provider}`);

  const system = options.systemPrompts?.[lobe.id] || SYSTEM_PROMPTS[lobe.id];
  const userContent = construirConteudoUtilizador(pergunta, contextoDebate, options.imageDataUrl);
  const history = options.messages || [];
  const messages = [...history, { role: "user", content: userContent }];
  const geracao = opcoesGeracaoLobe(lobe, options);
  const lobeTools = lobe.provider === 'openrouter'
    ? {
        tools: [
          ...(LOBOS_COM_WEB_SEARCH.has(lobe.id) ? [{
            type: 'openrouter:web_search',
            parameters: {
              engine: 'auto',
              max_results: 3,
              max_total_results: 9,
              user_location: {
                type: 'approximate',
                country: 'PT',
                timezone: 'Europe/Lisbon'
              }
            }
          }] : []),
          {
            type: 'openrouter:datetime',
            parameters: { timezone: 'Europe/Lisbon' }
          }
        ]
      }
    : {};

  const body =
    lobe.provider === 'openrouter'
      ? { model: lobe.modelo, models: lobe.fallbacks ? [lobe.modelo, ...lobe.fallbacks] : undefined, system, messages, max_tokens: options.max_tokens || 420, ...geracao, ...lobeTools }
      : {
          model: lobe.modelo,
          system: system,
          messages: messages,
          max_tokens: options.max_tokens || 420,
          ...geracao,
        };

  const resposta = await fetch(
    lobe.provider === 'nim' ? getBaseURL(lobe.provider) : '/api/chat',
    {
    method: 'POST',
    signal: options.signal,
    headers: {
      'Content-Type': 'application/json',
      'X-OpenRouter-Cache': contextoDebate ? 'false' : 'true',
      'X-OpenRouter-Cache-TTL': '300',
      ...(lobe.provider !== 'nim' &&
        apiKey !== 'proxy-gerido-pelo-servidor' && {
          Authorization: `Bearer ${apiKey}`,
          'HTTP-Referer': 'https://cortex-digital.vercel.app',
          'X-Title': 'Córtex Digital',
        }),
    },
    body: JSON.stringify(body),
  });

  const dados = await lerJsonResposta(resposta);
  const cacheStatus = resposta.headers?.get('X-OpenRouter-Cache-Status');
  if (cacheStatus) console.log(`[Cache] ${lobe.nome}: ${cacheStatus}`);

  if (!resposta.ok || dados.error) {
    throw new Error(dados.error?.message || dados.error || `HTTP ${resposta.status}`);
  }

  // Quando web search está activo, a resposta pode conter chamadas de ferramenta em vez de conteúdo directo.
  const texto =
    dados.choices?.[0]?.message?.content ||
    dados.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments ||
    dados.content ||
    '';
  return normalizarValorLobe(lobe, { resposta: texto }, contextoDebate);
}

export async function chamarLobeStream(lobe, pergunta, contextoDebate = null, options = {}) {
  if (lobe.provider === 'nim') throw new Error('Stream SSE indisponível via proxy NIM');

  const apiKey = lerEnv('VITE_OPENROUTER_KEY');
  if (!apiKey) throw new Error(`API key ausente para ${lobe.provider}`);
  const system = options.systemPrompts?.[lobe.id] || SYSTEM_PROMPTS[lobe.id];

  const resposta = await fetch('/api/chat', {
    method: 'POST',
    signal: options.signal,
    headers: {
      'Content-Type': 'application/json',
      'X-Title': 'Córtex Digital',
    },
    body: JSON.stringify({
      model: lobe.modelo,
      models: lobe.fallbacks ? [lobe.modelo, ...lobe.fallbacks] : undefined,
      stream: true,
      system,
      ...opcoesGeracaoLobe(lobe, options),
      messages: [
        ...(options.messages || []),
        {
          role: "user",
          content: construirConteudoUtilizador(pergunta, contextoDebate, options.imageDataUrl),
        },
      ],
      max_tokens:
        options.max_tokens ||
        (lobe.modelo.includes('deepseek') ? 1200 : lobe.modelo.includes('llama-4') ? 800 : 420),
    }),
  });

  if (!resposta.ok) throw new Error(`HTTP ${resposta.status}`);
  if (!resposta.body?.getReader) throw new Error('Stream SSE indisponível');

  const reader = resposta.body.getReader();
  const decoder = new TextDecoder();
  let textoCompleto = '';
  let buffer = '';
  let terminado = false;

  while (!terminado) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const linhas = buffer.split('\n');
    buffer = linhas.pop() || '';

    for (const linha of linhas) {
      const limpa = linha.trim();
      if (!limpa.startsWith('data: ')) continue;

      const dados = limpa.slice(6).trim();
      if (dados === '[DONE]') {
        terminado = true;
        break;
      }

      try {
        const json = JSON.parse(dados);
        const delta = json.choices?.[0]?.delta?.content || '';
        if (delta) {
          textoCompleto += delta;
          options.onToken?.(delta, textoCompleto, lobe);
        }
      } catch {
        // Linhas SSE malformadas não devem quebrar a UX.
      }
    }
  }

  return normalizarValorLobe(lobe, { resposta: textoCompleto }, contextoDebate);
}

export function chamarRei(...args) {
  return runKing(...args);
}

async function chamarComMapa(lobe, pergunta, contextoDebate, mapa, chamar, options = {}) {
  const ctrl = new AbortController();
  const abortarPorPai = () => ctrl.abort();
  if (options.signal?.aborted) ctrl.abort();
  else options.signal?.addEventListener?.('abort', abortarPorPai, { once: true });
  mapa.set(lobe.id, ctrl);
  try {
    const valor = await chamar(lobe, pergunta, contextoDebate, {
      ...options,
      signal: ctrl.signal,
      ...opcoesGeracaoLobe(lobe, options),
    });
    return normalizarValorLobe(lobe, valor, contextoDebate);
  } finally {
    options.signal?.removeEventListener?.('abort', abortarPorPai);
    if (mapa.get(lobe.id) === ctrl) mapa.delete(lobe.id);
  }
}

export function calcularScoreConsenso(ronda1 = [], ronda2 = []) {
  const respostas = [...ronda1, ...ronda2]
    .filter((r) => r.status === 'fulfilled')
    .map((r) => r.value);
  return Math.round(calcularConsensoMatematico(respostas) * 100);
}

function contextoDasRondas(ronda1 = [], ronda2 = []) {
  return [...ronda1, ...ronda2]
    .filter((r) => r.status === 'fulfilled')
    .map((r) => `[${r.value.nome}]: ${r.value.resposta}`)
    .join('\n\n');
}

function pedidoRefinamento(scoreProvisorio) {
  return `O conselho não convergiu.
Consenso actual: ${scoreProvisorio}%.
Reconsidera a tua posição com base
no debate completo acima.
Sê mais preciso e directo.`;
}

export async function runDebate(pergunta, modo = 'paralelo', options = {}) {
  const lobos = options.lobos || LOBOS;
  const chamar = options.chamarLobe || chamarLobe;
  const ronda1Map = new Map();
  const { imageDataUrl, ...optionsSemImagem } = options;
  const optionsRonda1 = imageDataUrl ? { ...optionsSemImagem, imageDataUrl } : optionsSemImagem;

  const ronda1 = await Promise.allSettled(
    lobos.map((lobe) => chamarComMapa(lobe, pergunta, null, ronda1Map, chamar, optionsRonda1))
  );

  if (modo === 'paralelo') return { ronda1 };

  const contextoDebate = ronda1
    .filter((r) => r.status === 'fulfilled')
    .map((r) => `[${r.value.nome}]: ${r.value.resposta}`)
    .join('\n\n');

  const ronda2Map = new Map();
  const ronda2 = await Promise.allSettled(
    lobos.map((lobe) => chamarComMapa(lobe, pergunta, contextoDebate, ronda2Map, chamar, optionsSemImagem))
  );

  const scoreProvisorio = calcularScoreConsenso(ronda1, ronda2);
  if (scoreProvisorio < 50) {
    const contextoRefinamento = contextoDasRondas(ronda1, ronda2);
    const ronda3Map = new Map();
    const ronda3 = await Promise.allSettled(
      lobos.map((lobe) =>
        chamarComMapa(lobe, pedidoRefinamento(scoreProvisorio), contextoRefinamento, ronda3Map, chamar, optionsSemImagem)
      )
    );
    return { ronda1, ronda2, ronda3 };
  }

  return { ronda1, ronda2 };
}

async function chamarStreamComFallback(lobe, pergunta, contextoDebate, chamarStream, chamarFallback, onToken, options = {}) {
  const ctrl = new AbortController();
  const abortarPorPai = () => ctrl.abort();
  if (options.signal?.aborted) ctrl.abort();
  else options.signal?.addEventListener?.('abort', abortarPorPai, { once: true });
  const timeout = setTimeout(() => ctrl.abort(new Error('Timeout de 28s excedido')), 28000);
  const geracao = opcoesGeracaoLobe(lobe, options);

  try {
    return await chamarStream(lobe, pergunta, contextoDebate, {
      ...options,
      signal: ctrl.signal,
      onToken,
      ...geracao,
    }).catch((erro) => {
      if (ctrl.signal.aborted || erro?.name === 'AbortError') throw erro;
      return chamarFallback(lobe, pergunta, contextoDebate, {
        ...options,
        signal: ctrl.signal,
        ...geracao,
      });
    });
  } finally {
    options.signal?.removeEventListener?.('abort', abortarPorPai);
    clearTimeout(timeout);
  }
}

export async function runDebateStream(pergunta, modo = 'paralelo', options = {}) {
  const lobos = options.lobos || LOBOS;
  const chamarStream = options.chamarLobeStream || chamarLobeStream;
  const chamarFallback = options.chamarLobe || chamarLobe;
  const { imageDataUrl, ...optionsSemImagem } = options;
  const optionsRonda1 = imageDataUrl ? { ...optionsSemImagem, imageDataUrl } : optionsSemImagem;

  options.onPhase?.("council");
  const ronda1 = await Promise.allSettled(
    lobos.map((lobe) =>
      chamarStreamComFallback(lobe, pergunta, null, chamarStream, chamarFallback, options.onToken, optionsRonda1)
    )
  );

  if (modo === 'paralelo') return { ronda1 };

  const contextoDebate = ronda1
    .filter((r) => r.status === 'fulfilled')
    .map((r) => `[${r.value.nome}]: ${r.value.resposta}`)
    .join('\n\n');

  options.onPhase?.("critique");
  const ronda2 = await Promise.allSettled(
    lobos.map((lobe) => {
      let contextoLobe = contextoDebate;
      if (modo === 'debate') {
        const ids = lobos.map(l => l.id);
        const targetId = ids[(lobos.findIndex(l => l.id === lobe.id) + 1) % ids.length];
        const target = ronda1.find(r => r.status === 'fulfilled' && r.value.id === targetId);
        if (target) {
          contextoLobe = `Analisa criticamente esta resposta do ${target.value.nome}: "${target.value.resposta}". 
            Aponta falhas, omissões ou riscos. Depois, mantém a tua posição original ou ajusta-a se necessário.`;
        } else {
          contextoLobe = `O teu alvo de crítica (${targetId}) falhou. Analisa a pergunta original directamente: ${pergunta}`;
        }
      }
      return chamarStreamComFallback(
        lobe,
        pergunta,
        contextoLobe,
        chamarStream,
        chamarFallback,
        options.onToken,
        optionsSemImagem
      );
    })
  );

  const scoreProvisorio = calcularScoreConsenso(ronda1, ronda2);
  if (scoreProvisorio < 50) {
    const contextoRefinamento = contextoDasRondas(ronda1, ronda2);
    const ronda3 = await Promise.allSettled(
      lobos.map((lobe) =>
        chamarStreamComFallback(
          lobe,
          pedidoRefinamento(scoreProvisorio),
          contextoRefinamento,
          chamarStream,
          chamarFallback,
          options.onToken,
          optionsSemImagem
        )
      )
    );
    return { ronda1, ronda2, ronda3 };
  }

  return { ronda1, ronda2 };
}
