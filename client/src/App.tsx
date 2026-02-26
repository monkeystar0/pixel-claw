import { useRef, useEffect } from 'react';
import { useWebSocket } from './hooks/useWebSocket.js';

export function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { connected, sessions, channels } = useWebSocket();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener('resize', resize);

    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = '#e0e0e0';
    ctx.font = '16px monospace';
    ctx.fillText('pixel-claw', 20, 30);

    ctx.font = '12px monospace';
    ctx.fillText(`Sessions: ${sessions.length}`, 20, 55);
    ctx.fillText(`Channels: ${channels.length}`, 20, 75);

    return () => window.removeEventListener('resize', resize);
  }, [sessions, channels]);

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <canvas ref={canvasRef} style={{ width: '100%', height: '100%' }} />
      <div style={{
        position: 'absolute',
        top: 8,
        right: 8,
        padding: '4px 8px',
        background: connected ? '#2d5a2d' : '#5a2d2d',
        borderRadius: 4,
        fontSize: 12,
        fontFamily: 'monospace',
      }}>
        {connected ? 'Connected' : 'Disconnected'}
      </div>
    </div>
  );
}
