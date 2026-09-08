import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { createApiMiddleware } from './server/api';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  if (env.PLANTNET_API_KEY) {
    process.env.PLANTNET_API_KEY = env.PLANTNET_API_KEY;
  }

  return {
    plugins: [
      react(),
      {
        name: 'komorebi-api',
        configureServer(server) {
          server.middlewares.use(createApiMiddleware());
        },
        configurePreviewServer(server) {
          server.middlewares.use(createApiMiddleware());
        },
      },
    ],
    server: {
      host: '127.0.0.1',
      port: 5173,
    },
    preview: {
      host: '127.0.0.1',
      port: 4173,
    },
  };
});
