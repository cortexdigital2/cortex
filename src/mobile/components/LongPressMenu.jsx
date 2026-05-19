import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useLongPress } from 'use-long-press';
import useHapticFeedback from '../hooks/useHapticFeedback.js';

export default function LongPressMenu({ children, onCopy, onShare, onFork, message }) {
  const [showMenu, setShowMenu] = useState(false);
  const haptic = useHapticFeedback();

  const longPressProps = useLongPress(
    () => {
      haptic.medio();
      setShowMenu(true);
    },
    {
      threshold: 500, // 500ms
      preventDefault: false, // Let pan-y handle scroll, preventDefault might block touches
      cancelOnMovement: true,
      cancelOutsideElement: true
    }
  );

  const handleClose = () => setShowMenu(false);

  // Cleanup: garante que o portal fecha se o componente desmontar com o menu aberto
  useEffect(() => {
    return () => setShowMenu(false);
  }, []);

  // Portal Bottom Sheet
  const bottomSheet = showMenu ? createPortal(
    <div 
      style={{
        position: 'fixed',
        top: 0, left: 0, right: 0, bottom: 0,
        backgroundColor: 'rgba(0,0,0,0.5)',
        zIndex: 99999,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'flex-end',
      }}
      onClick={handleClose}
    >
      <div 
        style={{
          background: 'var(--bg, #1e1e24)',
          borderTopLeftRadius: '16px',
          borderTopRightRadius: '16px',
          padding: '24px 16px',
          boxShadow: '0 -4px 20px rgba(0,0,0,0.3)',
          animation: 'slideUp 0.2s ease-out forwards',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{
          width: '40px', height: '4px', backgroundColor: '#555', 
          borderRadius: '2px', margin: '0 auto 16px'
        }} />
        
        <h3 style={{ margin: '0 0 16px 8px', fontSize: '14px', color: 'var(--text-muted, #8a8aa0)'}}>
          Ações da Mensagem
        </h3>

        <button
          onClick={() => {
            haptic.leve();
            onCopy(message);
            handleClose();
          }}
          style={btnStyle}
        >
          📋 Copiar Texto
        </button>
        <button
          onClick={() => {
            haptic.leve();
            onShare(message);
            handleClose();
          }}
          style={btnStyle}
        >
          📤 Partilhar
        </button>
        <button
          onClick={() => {
            haptic.leve();
            onFork(message);
            handleClose();
          }}
          style={btnStyle}
        >
          🍴 Fazer Fork
        </button>
      </div>
    </div>,
    document.body
  ) : null;

  return (
    <>
      {/* Required style to stop the context menu on mobile on long press natively */}
      <div {...longPressProps} style={{ WebkitTouchCallout: 'none', width: '100%' }}>
        {children}
      </div>
      {bottomSheet}
    </>
  );
}

const btnStyle = {
  display: 'block',
  width: '100%',
  padding: '16px',
  background: 'rgba(255,255,255,0.05)',
  border: 'none',
  color: 'var(--text-h, #f5f5ff)',
  textAlign: 'left',
  cursor: 'pointer',
  borderRadius: '12px',
  marginBottom: '8px',
  fontSize: '16px',
  fontWeight: '500'
};
