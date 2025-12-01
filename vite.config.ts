import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');
  return {
    // Use relative paths for Capacitor compatibility
    // This works for both PWA (web) and native (Capacitor)
    base: './',
    
    server: {
      port: 3000,
      host: '0.0.0.0',
      strictPort: true,
    },
    
    plugins: [react()],
    
    define: {
      'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
      // Required for some crypto libraries in native webview
      global: 'globalThis',
    },
    
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
        '@noble/hashes/utils': path.resolve(__dirname, 'node_modules/@noble/hashes/utils.js'),
      }
    },
    
    build: {
      outDir: 'dist',
      assetsDir: 'assets',
      // Generate sourcemaps for debugging in development
      sourcemap: mode === 'development',
      // Ensure proper chunking for mobile performance
      rollupOptions: {
        output: {
          manualChunks: {
            // Separate vendor chunks for better caching
            'vendor-react': ['react', 'react-dom', 'react-router-dom'],
            'vendor-nostr': ['nostr-tools'],
            'vendor-cashu': ['@cashu/cashu-ts'],
          }
        }
      }
    },
    
    // Ensure crypto libraries work in native webview
    optimizeDeps: {
      esbuildOptions: {
        define: {
          global: 'globalThis'
        }
      }
    }
  };
});
