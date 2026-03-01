import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
  server: {
    proxy: {
      '/ws': {
        target: 'ws://localhost:3000',
        ws: true,
        configure: (proxy) => {
          const ignoreCodes = new Set(['EPIPE', 'ECONNRESET']);

          const origEmit = proxy.emit.bind(proxy);
          proxy.emit = function (event: string, ...args: unknown[]) {
            if (event === 'error' && args[0] instanceof Error) {
              const code = (args[0] as NodeJS.ErrnoException).code;
              if (code && ignoreCodes.has(code)) return true;
            }
            return origEmit(event, ...args);
          } as typeof proxy.emit;

          proxy.on('proxyReqWs', (_proxyReq, _req, socket) => {
            socket.on('error', (err) => {
              const code = (err as NodeJS.ErrnoException).code;
              if (code && ignoreCodes.has(code)) return;
              console.error('[ws proxy socket]', err.message);
            });
          });

          proxy.on('open', (proxySocket) => {
            proxySocket.on('error', (err) => {
              const code = (err as NodeJS.ErrnoException).code;
              if (code && ignoreCodes.has(code)) return;
              console.error('[ws proxy upstream]', err.message);
            });
          });
        },
      },
    },
  },
});
