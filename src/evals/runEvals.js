import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { runDagCognitivo, chamarRei } from '../api/council.js';
import { LOBOS } from '../api/council.js';
import { gradeResponse } from './grader.js';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '../../.env.local') });
dotenv.config({ path: path.join(__dirname, '../../.env') });

const OPENROUTER_KEY = process.env.VITE_OPENROUTER_KEY;
if (!OPENROUTER_KEY) {
  console.error("VITE_OPENROUTER_KEY não está definido no .env");
  process.exit(1);
}

// Polyfill fetch to intercept relative API calls made by council.js
const originalFetch = globalThis.fetch;
globalThis.fetch = async (url, options) => {
  let finalUrl = url;
  if (url === '/api/chat') {
    finalUrl = 'https://openrouter.ai/api/v1/chat/completions';
    options.headers = {
      ...options.headers,
      'Authorization': `Bearer ${OPENROUTER_KEY}`
    };
  }
  return originalFetch(finalUrl, options);
};

// Polyfill para garantir que o council não falha no lerEnv() caso use VITE_*
globalThis.import = { meta: { env: process.env } };

async function runEvals() {
  const datasetPath = path.join(__dirname, 'dataset.json');
  const dataset = JSON.parse(fs.readFileSync(datasetPath, 'utf8'));
  
  const resultsDir = path.join(__dirname, 'results');
  if (!fs.existsSync(resultsDir)) {
    fs.mkdirSync(resultsDir, { recursive: true });
  }

  const resultados = [];
  let totalScore = 0;

  console.log(`A iniciar evals para ${dataset.length} perguntas...`);

  for (const entry of dataset) {
    console.log(`\nProcessando [${entry.id}] ${entry.pergunta}`);
    const t0 = Date.now();
    let score = 0;
    let custo = 0;
    let resumo = "";

    try {
      // Executar o DAG (ronda 1 e ronda 2)
      const resDag = await runDagCognitivo(entry.pergunta, { lobos: LOBOS.slice(0, 5) });
      
      // O DAG no Córtex v12 tem payload_omega que passa ao Rei
      const veredicto = await chamarRei(
        entry.pergunta,
        resDag.payload_omega,
        { lobos: LOBOS.slice(0, 5) }
      );
      
      resumo = veredicto.veredicto;

      // Calcular Score
      const grade = gradeResponse(resumo, entry);
      score = grade.score;
      totalScore += score;

      // Estimar custo (simplificado)
      // assumindo ~10k tokens totais por pergunta no pipeline DAG x $0.0001 (modelos free são $0 mas vamos colocar algo se cobrassem, ou $0)
      custo = 0.0000; 

      console.log(`=> Score: ${score} | Hits: ${grade.hits.join(', ')}`);
    } catch (err) {
      console.error(`=> Erro na pergunta ${entry.id}:`, err.message);
      resumo = `Erro: ${err.message}`;
    }

    const t1 = Date.now();
    const latencia = t1 - t0;

    resultados.push({
      id: entry.id,
      score,
      latencia_ms: latencia,
      custo_eur: custo,
      resposta_resumo: resumo
    });
  }

  const media_score = Math.round(totalScore / dataset.length);

  const report = {
    data: new Date().toISOString().split('T')[0],
    total: dataset.length,
    media_score,
    resultados
  };

  const reportPath = path.join(resultsDir, 'report.json');
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2), 'utf8');
  console.log(`\nEvals concluídas. Média: ${media_score}/100. Relatório guardado em ${reportPath}`);
}

runEvals();
