import React from 'react';
import { useSwipeable } from 'react-swipeable';
import ChatBubble from '../../components/ChatBubble.jsx';
import useHapticFeedback from '../hooks/useHapticFeedback.js';

export default function SwipeableChatBubble({ onDelete, children, bubbleProps }) {
  const haptic = useHapticFeedback();

  const handlers = useSwipeable({
    onSwipedLeft: () => {
      haptic.leve();
      if (onDelete) onDelete();
    },
    delta: 40, // Increased delta as requested to avoid accidental swipes
    preventDefaultTouchmoveEvent: false, // Let pan-y handle the scroll properly without aggressive prevent default
    trackTouch: true,
    trackMouse: false, 
  });

  return (
    <div {...handlers} style={{ touchAction: 'pan-y', width: '100%' }}>
      {/* Either use children, or render a ChatBubble using bubbleProps */}
      {children ? children : (
        <ChatBubble {...bubbleProps} />
      )}
    </div>
  );
}
