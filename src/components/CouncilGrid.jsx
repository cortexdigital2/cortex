import React, { useMemo, useState } from 'react';
import { formatLobeResponse } from '../utils/formatLobe.js';

// pairingMap: prop reservada para v2 — setas visuais de crítica entre lobos


export default function CouncilGrid({
  lobos = [],
  resultados = [],
  parciais = {},
  fase = 'council',
  aStreaming = false,
}) {
  const [selecionado, setSelecionado] = useState(null);
  
  React.useEffect(() => {
    if (selecionado) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [selecionado]);

  const fases = useMemo(
    () => [
      { id: 'council', label: 'Respostas' },
      { id: 'critique', label: 'Crítica' },
      { id: 'judges', label: 'Análise' },
      { id: 'rei', label: 'Síntese' },
      { id: 'reflex', label: 'Reflexão' },
    ],
    []
  );

  const idxFase = useMemo(() => {
    const mapping = { council: 0, critique: 1, judges: 2, rei: 3, cortex: 3, reflex: 4 };
    return mapping[fase] ?? 0;
  }, [fase]);

  const getResultado = (lobo) =>
    resultados.find((r) => String(r.id).includes(String(lobo.id))) || null;

  const getEstado = (res, txt) => {
    if (res) return res.isErr ? 'error' : 'done';
    if (txt) return 'writing';
    if (aStreaming && fase === 'council') return 'thinking';
    return 'idle';
  };

  const getPreview = (res, txt, lobo) => {
    const base = txt || res?.ronda3 || res?.ronda2 || res?.ronda1 || res?.result || '';
    if (base) return formatLobeResponse(base);
    return `Aguardando ${lobo.nome?.split(' ')?.[0] || 'lobo'}...`;
  };

  const abrir = (lobo, res, txt, estado) => {
    const resposta = txt || res?.result || res?.ronda3 || res?.ronda2 || res?.ronda1 || '';
    setSelecionado({
      ...lobo,
      resposta: formatLobeResponse(resposta),
      estado,
      latency: res?.latency ?? null,
      confidence: res?.confidence ?? null,
      isErr: !!res?.isErr,
    });
  };

  return (
    <section className="council-grid-shell" aria-label="Conselho de Lobos">
      <div className="pipeline-stepper" aria-label="Fases do debate">
        {fases.map((faseItem, i) => (
          <div
            key={faseItem.id}
            className={`step ${i <= idxFase ? 'active' : ''} ${faseItem.id === fase ? 'current' : ''}`}
          >
            <span className="step-dot" />
            <span className="step-label">{faseItem.label}</span>
          </div>
        ))}
      </div>

      <div className="lobes-grid">
        {lobos.map((lobo, idx) => {
          const res = getResultado(lobo);
          const txt = parciais?.[lobo.id] || '';
          const estado = getEstado(res, txt);
          const preview = getPreview(res, txt, lobo);
          const tempo = res?.latency ? `${(res.latency / 1000).toFixed(1)}s` : '—';
          const progresso = typeof res?.confidence === 'number' ? Math.max(8, Math.min(100, res.confidence)) : (estado === 'thinking' ? 18 : 0);
          const icon = lobo.icon || ['◉', '◈', '◐', '◑', '◒'][idx] || '◌';
          const nome = lobo.nome || res?.label || 'Lobo';
          const cor = lobo.cor || '#7c3aed';

          return (
            <button
              key={lobo.id}
              type="button"
              className={`lobo-card ${estado}`}
              onClick={() => abrir({ ...lobo, nome, icon, cor }, res, txt, estado)}
              style={{ '--accent': cor }}
              aria-label={`Abrir detalhes de ${nome}`}
            >
              <div className="lobo-top">
                <span className="lobo-icon">
                  {fase === 'critique' && estado === 'writing' ? '⚔️' : icon}
                </span>
                <span className={`lobo-state ${estado}`} />
              </div>

              <div className="lobo-meta">
                <strong className="lobo-name">{nome.split(' ')[0]}</strong>
                <span className="lobo-time">{tempo}</span>
              </div>

              <p className="lobo-preview">{preview.length > 90 ? `${preview.slice(0, 90)}...` : preview}</p>

              <div className="lobo-meter" aria-hidden="true">
                <span style={{ width: `${progresso}%` }} />
              </div>
            </button>
          );
        })}
      </div>

      {selecionado ? (
        <div className="sheet-overlay" onClick={() => setSelecionado(null)} role="presentation">
          <div className="sheet-panel" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
            <div className="sheet-handle" />
            <div className="sheet-header">
              <span className="sheet-icon" style={{ color: selecionado.cor }}>{selecionado.icon}</span>
              <div className="sheet-title">
                <h3>{selecionado.nome}</h3>
                <p>{selecionado.estado}</p>
              </div>
              <button className="sheet-close" type="button" onClick={() => setSelecionado(null)}>
                Fechar
              </button>
            </div>

            <div className="sheet-stats">
              <div><span>Tempo</span><strong>{selecionado.latency != null ? `${(selecionado.latency / 1000).toFixed(1)}s` : '—'}</strong></div>
              <div><span>Confiança</span><strong>{selecionado.confidence != null ? `${Math.round(selecionado.confidence)}%` : '—'}</strong></div>
              <div><span>Erro</span><strong>{selecionado.isErr ? 'Sim' : 'Não'}</strong></div>
            </div>

            <div className="sheet-body">
              <p className="sheet-label">Resposta</p>
              <p className="sheet-text">{selecionado.resposta || 'Sem conteúdo disponível.'}</p>
            </div>
          </div>
        </div>
      ) : null}

      <style>{`\
        .council-grid-shell{padding:12px;border:1px solid rgba(255,255,255,.08);border-radius:18px;background:rgba(10,10,15,.72);backdrop-filter:blur(14px)}\
        .pipeline-stepper{display:flex;justify-content:space-between;gap:8px;margin-bottom:12px;padding-bottom:10px;border-bottom:1px solid rgba(255,255,255,.08)}\
        .step{flex:1;display:flex;flex-direction:column;align-items:center;gap:4px;opacity:.28}\
        .step.active{opacity:.68}\
        .step.current{opacity:1}\
        .step-dot{width:7px;height:7px;border-radius:999px;background:#64748b}\
        .step.current .step-dot{background:#7c3aed;box-shadow:0 0 0 3px rgba(124,58,237,.16)}\
        .step-label{font-size:10px;line-height:1;text-transform:uppercase;letter-spacing:.04em;color:#cbd5e1;text-align:center}\
        .lobes-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px}\
        .lobo-card{appearance:none;border:none;display:flex;flex-direction:column;gap:8px;padding:10px;border-radius:14px;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.08);color:inherit;text-align:left;min-height:118px;transition:transform .14s ease, background .14s ease, border-color .14s ease}\
        .lobo-card:active{transform:scale(.98)}\
        .lobo-card.thinking{border-color:rgba(59,130,246,.35)}\
        .lobo-card.writing{border-color:rgba(16,185,129,.28)}\
        .lobo-card.done{border-color:rgba(16,185,129,.22)}\
        .lobo-card.error{border-color:rgba(239,68,68,.35)}\
        .lobo-top{display:flex;align-items:center;justify-content:space-between}\
        .lobo-icon{font-size:18px;line-height:1;color:var(--accent)}\
        .lobo-state{width:8px;height:8px;border-radius:999px;background:#64748b;box-shadow:0 0 0 3px rgba(100,116,139,.14)}\
        .lobo-state.thinking{background:#3b82f6;box-shadow:0 0 0 3px rgba(59,130,246,.18);animation:pulse 1.1s ease-in-out infinite}\
        .lobo-state.writing{background:#10b981;box-shadow:0 0 0 3px rgba(16,185,129,.16)}\
        .lobo-state.done{background:#10b981;box-shadow:0 0 0 3px rgba(16,185,129,.12)}\
        .lobo-state.error{background:#ef4444;box-shadow:0 0 0 3px rgba(239,68,68,.18)}\
        .lobo-meta{display:flex;justify-content:space-between;gap:8px;align-items:baseline}\
        .lobo-name{font-size:12px;font-weight:700;color:#f8fafc;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}\
        .lobo-time{font-size:10px;color:#94a3b8;white-space:nowrap}\
        .lobo-preview{margin:0;font-size:10px;line-height:1.35;color:#cbd5e1;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden;min-height:40px}\
        .lobo-meter{height:4px;border-radius:999px;overflow:hidden;background:rgba(255,255,255,.08);margin-top:auto}\
        .lobo-meter>span{display:block;height:100%;border-radius:inherit;background:linear-gradient(90deg,#7c3aed,#06b6d4)}\
        .sheet-overlay{position:fixed;inset:0;background:rgba(0,0,0,.58);z-index:20000;display:flex;align-items:flex-end}\
        .sheet-panel{width:100%;max-height:78vh;overflow:auto;background:#0b0b14;border-top-left-radius:22px;border-top-right-radius:22px;border:1px solid rgba(255,255,255,.08);padding:16px 16px 24px;box-shadow:0 -20px 60px rgba(0,0,0,.35)}\
        .sheet-handle{width:42px;height:4px;border-radius:999px;background:rgba(255,255,255,.18);margin:0 auto 14px}\
        .sheet-header{display:flex;align-items:center;gap:12px;margin-bottom:14px}\
        .sheet-icon{font-size:28px;line-height:1}\
        .sheet-title h3{margin:0;font-size:18px;color:#f8fafc}\
        .sheet-title p{margin:2px 0 0;font-size:12px;color:#94a3b8;text-transform:capitalize}\
        .sheet-close{margin-left:auto;background:rgba(255,255,255,.05);border:none;color:#fff;padding:10px 16px;border-radius:12px;font-size:12px;min-height:44px;display:flex;align-items:center;justify-content:center}\
        .sheet-stats{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:14px}\
        .sheet-stats div{padding:10px;border-radius:14px;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.06)}\
        .sheet-stats span{display:block;font-size:10px;color:#94a3b8;margin-bottom:4px}\
        .sheet-stats strong{font-size:13px;color:#f8fafc}\
        .sheet-body{padding-top:2px}\
        .sheet-label{margin:0 0 6px;font-size:11px;letter-spacing:.04em;text-transform:uppercase;color:#94a3b8}\
        .sheet-text{margin:0;color:#e2e8f0;line-height:1.55;font-size:14px;white-space:pre-wrap}\
        @keyframes pulse{0%,100%{opacity:.55}50%{opacity:1}}\
        @media (max-width:420px){.lobes-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.sheet-stats{grid-template-columns:1fr}.sheet-panel{max-height:82vh}}\
      `}</style>
    </section>
  );
}
