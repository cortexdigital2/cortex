// components/PainelSintese.jsx
import React, { useMemo } from 'react';

export const PainelSintese = ({ respostaBruta }) => {
  const conteudoProcessado = useMemo(() => {
    if (!respostaBruta) return null;

    // 1. Extrair Score de Confiança
    const regexScore = /Confiança:\s*\*?\*?\s*(\d{1,3})%/i;
    const matchScore = respostaBruta.match(regexScore);
    const scoreConfianca = matchScore ? parseInt(matchScore[1], 10) : null;

    // 2. Extrair Sugestões de Resposta Rápida (Chips)
    const regexSugestoes = /Sugestões:\s*\n1\.\s*(.+)\n2\.\s*(.+)\n3\.\s*(.+)/i;
    const matchSugestoes = respostaBruta.match(regexSugestoes);
    const chips = matchSugestoes ? [matchSugestoes[1], matchSugestoes[2], matchSugestoes[3]] : [];

    // Limpar o texto principal para não exibir os metadados brutos na UI
    let textoLimpo = respostaBruta
     .replace(regexScore, '')
     .replace(regexSugestoes, '')
     .replace(/\*\*Sugestões:\*\*/i, '') // Limpa o cabeçalho se existir
     .trim();

    return { scoreConfianca, chips, textoLimpo };
  }, [respostaBruta]);

  // Função para estilizar dinamicamente as citações no texto
  const renderizarTextoComCitas = (texto) => {
    const partes = texto.split(/(\[[^\]]+\])/g);
    
    return partes.map((parte, index) => {
      if (parte.startsWith('[')) {
        return (
          <span 
            key={index} 
            style={{
              color: 'var(--wolf-purple, #7C3AED)',
              fontWeight: '600',
              backgroundColor: 'var(--bg-secondary, #111118)',
              padding: '0 4px',
              borderRadius: '4px',
              cursor: 'pointer',
              transition: 'background-color 0.2s ease'
            }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--neon-cyan, #06B6D4)'}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'var(--bg-secondary, #111118)'}
          >
            {parte}
          </span>
        );
      }
      return <span key={index}>{parte}</span>;
    });
  };

  if (!conteudoProcessado) return null;

  return (
    <div style={{
      backgroundColor: 'var(--bg-primary, #0A0A0F)',
      border: '1px solid var(--border-subtle, #374151)',
      borderRadius: '12px',
      padding: '24px',
      color: 'var(--text-primary, #ffffff)'
    }}>
      {/* Cabeçalho com Score */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '16px'
      }}>
        <h2 style={{
          fontSize: '20px',
          fontWeight: 'bold',
          color: 'var(--wolf-purple, #7C3AED)',
          margin: 0
        }}>
          Veredicto do Rei
        </h2>
        {conteudoProcessado.scoreConfianca && (
          <div style={{
            padding: '4px 12px',
            borderRadius: '9999px',
            fontSize: '14px',
            fontWeight: 'bold',
            backgroundColor: conteudoProcessado.scoreConfianca >= 70 ? 'rgba(16, 185, 129, 0.2)' : 
                             conteudoProcessado.scoreConfianca >= 40 ? 'rgba(234, 179, 8, 0.2)' : 'rgba(239, 68, 68, 0.2)',
            color: conteudoProcessado.scoreConfianca >= 70 ? 'var(--neon-cyan, #10b981)' : 
                   conteudoProcessado.scoreConfianca >= 40 ? '#eab308' : '#ef4444'
          }}>
            {conteudoProcessado.scoreConfianca}% Confiança
          </div>
        )}
      </div>

      {/* Corpo do Texto */}
      <div style={{
        maxWidth: 'none',
        color: 'var(--text-secondary, #d1d5db)',
        marginBottom: '24px',
        whiteSpace: 'pre-wrap',
        lineHeight: '1.625'
      }}>
        {renderizarTextoComCitas(conteudoProcessado.textoLimpo)}
      </div>

      {/* Chips de Resposta Rápida */}
      {conteudoProcessado.chips.length > 0 && (
        <div style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '8px',
          marginTop: '16px',
          borderTop: '1px solid var(--border-subtle, #374151)',
          paddingTop: '16px'
        }}>
          {conteudoProcessado.chips.map((chip, i) => (
            <button 
              key={i} 
              style={{
                backgroundColor: 'var(--bg-secondary, #111118)',
                border: '1px solid var(--border-subtle, #374151)',
                color: 'var(--text-primary, #ffffff)',
                fontSize: '14px',
                padding: '8px 16px',
                borderRadius: '9999px',
                transition: 'all 0.2s ease',
                cursor: 'pointer'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = 'var(--neon-cyan, #06B6D4)';
                e.currentTarget.style.color = 'var(--neon-cyan, #06B6D4)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = 'var(--border-subtle, #374151)';
                e.currentTarget.style.color = 'var(--text-primary, #ffffff)';
              }}
            >
              {chip}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
