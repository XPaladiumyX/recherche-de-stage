import { defineConfig } from 'vite';
import { viteStaticCopy } from 'vite-plugin-static-copy';

export default defineConfig({
  server: {
    host: '127.0.0.1',
    port: 5173,
    proxy: {
      '/api': 'http://127.0.0.1:3001',
    },
  },
  plugins: [
    viteStaticCopy({
      targets: [
        { src: 'js/*', dest: 'js' },
        { src: 'css/*', dest: 'css' },
        { src: 'data/*', dest: 'data' },
        { src: 'data/logos/*', dest: 'data/logos' },
      ],
    }),
  ],
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        main: 'index.html',
        campaign: 'campagne.html',
      },
    },
  },
});
