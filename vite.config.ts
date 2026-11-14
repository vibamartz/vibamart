import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig, loadEnv } from 'vite';

function getFirebaseConfig(env: Record<string, string>) {
  const projectId = env.VITE_FIREBASE_PROJECT_ID || env.FIREBASE_PROJECT_ID || 'viba-mart';
  return {
    apiKey: env.VITE_FIREBASE_API_KEY || env.FIREBASE_API_KEY || 'AIzaSyAjDLibmV7qNGHK_PzbuVkS-UE-q63sJGs',
    authDomain: env.VITE_FIREBASE_AUTH_DOMAIN || env.FIREBASE_AUTH_DOMAIN || 'viba-mart.firebaseapp.com',
    projectId: projectId,
    storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET || env.FIREBASE_STORAGE_BUCKET || 'viba-mart.firebasestorage.app',
    messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID || env.FIREBASE_MESSAGING_SENDER_ID || '1069210639894',
    appId: env.VITE_FIREBASE_APP_ID || env.FIREBASE_APP_ID || '1:1069210639894:web:9723003d1c6c07bb055f37',
    measurementId: env.VITE_FIREBASE_MEASUREMENT_ID || env.FIREBASE_MEASUREMENT_ID || 'G-XB3NP07F7Y',
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');
  return {
    plugins: [react(), tailwindcss()],
    define: {
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY || ''),
      'process.env.RAZORPAY_KEY_ID': JSON.stringify(env.RAZORPAY_KEY_ID || ''),
      'process.env.GOOGLE_MAPS_PLATFORM_KEY': JSON.stringify(env.GOOGLE_MAPS_PLATFORM_KEY || env.VITE_GOOGLE_MAPS_PLATFORM_KEY || ''),
      'process.env.FIREBASE_CONFIG': JSON.stringify(getFirebaseConfig(env)),
      'process.env.FIREBASE_VAPID_KEY': JSON.stringify(env.VITE_FIREBASE_VAPID_KEY || env.FIREBASE_VAPID_KEY || 'BI5XgN7vW8KlbVFVtIB_Wq4ncDE0aqbbWMGllCIKRIbeO2fCoNQP6DnCAJ6ZuFGO9sHulaJrwGP5C_VvSJ9xDgY'),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
        'react': path.resolve(__dirname, 'node_modules/react'),
        'react-dom': path.resolve(__dirname, 'node_modules/react-dom'),
        'react-hot-toast': path.resolve(__dirname, 'src/shared/components/toast/index.ts'),
      },
    },
    build: {
      chunkSizeWarningLimit: 6000,
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      proxy: {
        '/api': {
          target: 'http://localhost:3000',
          changeOrigin: true,
          secure: false,
          configure: (proxy) => {
            proxy.on('error', (_err, _req, res: any) => {
              if (res && !res.headersSent && typeof res.writeHead === 'function') {
                res.writeHead(502, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({
                  success: false,
                  error: 'Backend API service unavailable',
                  message: 'Backend API service unavailable'
                }));
              }
            });
          }
        }
      }
    },
  };
});
