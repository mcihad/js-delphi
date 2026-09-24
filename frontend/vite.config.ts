import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

// The IDE imports the *same* vcl.ts the BuildService copies into every build: the form
// designer instantiates the real runtime classes (WYSIWYG guarantee).
const runtime = fileURLToPath(new URL('../backend/runtime', import.meta.url));
const backend = process.env.JSD_BACKEND ?? 'http://127.0.0.1:8000';

export default defineConfig({
  resolve: {
    alias: {
      '@vcl': `${runtime}/vcl.ts`,
      '@runtime': runtime,
    },
  },
  server: {
    port: 5173,
    fs: { allow: ['..'] },
    proxy: {
      '/api': backend,
      '/preview': backend,
      '/ws': { target: backend.replace(/^http/, 'ws'), ws: true },
    },
  },
  build: {
    target: 'es2022',
    chunkSizeWarningLimit: 8000,
    rollupOptions: {
      output: {
        manualChunks: (id) => (id.includes('monaco-editor') ? 'monaco' : undefined),
      },
    },
  },
  worker: { format: 'es' },
});
