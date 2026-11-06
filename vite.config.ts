import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { fileURLToPath } from 'url';
import { defineConfig } from 'vite';

const projectRoot = fileURLToPath(new URL('.', import.meta.url));

const apiProxy = {
  '/api': {
    target: 'http://127.0.0.1:8787',
    changeOrigin: true,
    xfwd: true,
    secure: false,
  },
  '/mhatsapp-proxy': {
    target: 'https://api.mhatsapp.com',
    changeOrigin: true,
    secure: true,
    rewrite: (p: string) => p.replace(/^\/mhatsapp-proxy/, ''),
  },
};

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(projectRoot, '.'),
      },
    },
    build: {
      // Sunucu çalışırken alınan yeni build, açık tarayıcı sekmelerinin kullandığı
      // hash'li dinamik modülleri silmesin. Yeni index yalnız yeni dosyalara gider;
      // eski sekmeler ise yenilenene kadar mevcut parçalarla çalışmayı sürdürür.
      emptyOutDir: true,
      rolldownOptions: {
        output: {
          // Cloudflare tünelinde her küçük dosya ayrı gecikme oluşturuyor.
          // Ortak React ve ikon modüllerini tek istekle alınabilecek paketlerde tut.
          manualChunks(id: string) {
            const normalized = id.replace(/\\/g, '/');
            if (normalized.includes('/node_modules/lucide-react/')) return 'icons-vendor';
            if (
              normalized.includes('/node_modules/react/') ||
              normalized.includes('/node_modules/react-dom/') ||
              normalized.includes('/node_modules/scheduler/')
            ) {
              return 'react-vendor';
            }
          },
        },
      },
    },
    server: {
      host: '0.0.0.0',
      port: 3000,
      strictPort: true,
      // Allow Cloudflare Quick Tunnel hostnames for external e-Nstitü testing.
      allowedHosts: ['.trycloudflare.com', 'dersbende.com.tr'],
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      hmr: process.env.DISABLE_HMR !== 'true',
      watch: process.env.DISABLE_HMR === 'true' ? null : {
        // These folders contain thousands of Python/package files or frequently
        // changing SQLite/WAL data. Watching them stalls the dev server and can
        // make even localhost API requests wait for tens of seconds.
        ignored: [
          '**/.venv/**',
          '**/.git/**',
          '**/data/**',
          '**/backups/**',
          '**/exports/**',
          '**/output/**',
          '**/tmp/**',
          '**/python_solver/__pycache__/**',
        ],
      },
      proxy: apiProxy,
    },
    preview: {
      host: '0.0.0.0',
      port: 3000,
      strictPort: true,
      allowedHosts: ['.trycloudflare.com', 'dersbende.com.tr'],
      // Genel yayın optimize edilmiş dist paketini sunarken API aynı origin'de kalır.
      proxy: apiProxy,
    },
  };
});
