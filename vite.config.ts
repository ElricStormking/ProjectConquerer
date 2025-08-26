import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  build: {
    target: 'es2015',
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true,
        drop_debugger: true
      }
    },
    rollupOptions: {
      output: {
        manualChunks: {
          phaser: ['phaser']
        }
      }
    }
  },
  server: {
    port: 3000,
    host: true
  },
  optimizeDeps: {
    include: ['phaser']
  }
});