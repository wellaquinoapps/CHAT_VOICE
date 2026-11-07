import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
// https://vitejs.dev/config/
export default defineConfig({
    plugins: [react()],
    resolve: {
        alias: {
            '@': path.resolve(__dirname, './src'),
        },
    },
    server: {
        port: 5173,
        host: true,
        proxy: {
            // In dev, redirect all Supabase Edge Function calls to local server
            '/api': {
                target: 'http://localhost:3001',
                changeOrigin: true,
                rewrite: function (p) { return p.replace(/^\/api/, '/functions/v1'); },
            },
        },
    },
});
