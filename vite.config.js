import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { sentryVitePlugin } from "@sentry/vite-plugin";

// Porta do vercel dev (usa variável de ambiente ou 3001 como padrão)
const API_PORT = process.env.API_PORT || 3001;

export default defineConfig({
  // SPA explícito: impede que o Vite tente analisar index.html como módulo JS
  appType: "spa",

  plugins: [
    react(),
    sentryVitePlugin({
      authToken: process.env.SENTRY_AUTH_TOKEN,
      org: "firstoff2",
      project: "lesma",
      silent: true,
      telemetry: false,
      disable: !process.env.SENTRY_AUTH_TOKEN,
    }),
  ],

  build: {
    sourcemap: true,
  },

  define: {
    __BUILD_NUM__: JSON.stringify(Date.now()),
  },

  server: {
    // Proxy só activo quando corre `npm run dev` sem vercel dev.
    // Com `vercel dev`, o /api é tratado directamente pelo vercel.
    proxy: {
      "/api": {
        target: `http://localhost:${API_PORT}`,
        changeOrigin: true,
      },
    },
  },
});
