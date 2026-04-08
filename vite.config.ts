/// <reference types="vitest" />
import path from 'path';
import { defineConfig, loadEnv, Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import fs from 'fs';

// Path to Breez SDK WASM file
const BREEZ_WASM_SOURCE = path.join(__dirname, 'node_modules/@breeztech/breez-sdk-spark/web/breez_sdk_spark_wasm_bg.wasm');
const BREEZ_WASM_PUBLIC = path.join(__dirname, 'public/breez_sdk_spark_wasm_bg.wasm');

// Plugin to handle Breez SDK WASM
function breezWasmPlugin(): Plugin {
  return {
    name: 'breez-wasm-plugin',
    
    // Copy WASM to public on server start
    buildStart() {
      if (fs.existsSync(BREEZ_WASM_SOURCE)) {
        fs.copyFileSync(BREEZ_WASM_SOURCE, BREEZ_WASM_PUBLIC);
        console.log('✅ [Breez WASM] Copied to public/');
      } else {
        console.warn('⚠️ [Breez WASM] Source file not found:', BREEZ_WASM_SOURCE);
      }
    },
    
    // Serve WASM with correct MIME type
    configureServer(server) {
      // This middleware runs BEFORE Vite's default handling
      server.middlewares.use((req, res, next) => {
        // Check if request is for WASM file (could be various paths)
        if (req.url?.includes('breez_sdk_spark_wasm_bg.wasm')) {
          console.log(`🔵 [Breez WASM] Intercepted request: ${req.url}`);
          
          // Try to serve from source location
          if (fs.existsSync(BREEZ_WASM_SOURCE)) {
            console.log(`✅ [Breez WASM] Serving from: ${BREEZ_WASM_SOURCE}`);
            res.setHeader('Content-Type', 'application/wasm');
            res.setHeader('Cache-Control', 'public, max-age=31536000');
            fs.createReadStream(BREEZ_WASM_SOURCE).pipe(res);
            return;
          }
          
          console.warn('⚠️ [Breez WASM] File not found!');
        }
        next();
      });
    },
    
    // Handle WASM in production build
    generateBundle() {
      // Copy WASM to output for production builds
      if (fs.existsSync(BREEZ_WASM_SOURCE)) {
        this.emitFile({
          type: 'asset',
          fileName: 'breez_sdk_spark_wasm_bg.wasm',
          source: fs.readFileSync(BREEZ_WASM_SOURCE)
        });
      }
    }
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');
  return {
    // Use relative paths for Capacitor compatibility
    base: './',
    
    server: {
      port: 3000,
      host: '0.0.0.0',
      strictPort: true,
      // Allow serving files from parent directories
      fs: {
        allow: ['..', 'node_modules']
      }
    },
    
    plugins: [breezWasmPlugin(), react()],
    
    define: {
      'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
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
      sourcemap: mode === 'development',
      rollupOptions: {
        output: {
          manualChunks: {
            'vendor-react': ['react', 'react-dom', 'react-router-dom'],
            'vendor-nostr': ['nostr-tools'],
            'vendor-cashu': ['@cashu/cashu-ts'],
            'vendor-breez': ['@breeztech/breez-sdk-spark'],
            'vendor-crypto': ['@noble/hashes', '@scure/bip32', '@scure/bip39'],
            'vendor-pdf': ['jspdf', 'html2canvas'],
            'vendor-qr': ['qrcode', 'jsqr'],
          }
        }
      }
    },
    
    optimizeDeps: {
      // Don't pre-bundle Breez SDK - let it load WASM at runtime
      exclude: ['@breeztech/breez-sdk-spark'],
      esbuildOptions: {
        define: {
          global: 'globalThis'
        },
        target: 'esnext'
      }
    },
    
    // Include WASM in asset handling
    assetsInclude: ['**/*.wasm'],
    
    esbuild: {
      target: 'esnext'
    },
    
    // Worker format for WASM support
    worker: {
      format: 'es'
    },

    test: {
      environment: 'happy-dom',
      globals: false,
      include: ['**/*.{test,spec}.{ts,tsx}'],
      exclude: [
        'node_modules',
        'dist',
        'android',
        'ios',
        '.claude/**',
      ],
      setupFiles: ['./test/setup.ts'],
      testTimeout: 10_000,
      coverage: {
        provider: 'v8',
        include: ['utils/**', 'services/paymentRouter.ts', 'services/giftWrapService.ts'],
        exclude: ['**/*.test.ts', 'node_modules/**'],
      },
    }
  };
});
