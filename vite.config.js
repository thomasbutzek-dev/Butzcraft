/* Vite-Konfiguration fuer Butzcraft.
 *
 * Express (`npm start`) liefert die App aus dem Repo-Root und die Save/Load-API.
 * Three.js wird lokal aus node_modules geladen, damit Mobile-Browser nicht von
 * externen CDN-Imports abhaengen.
 */
import { defineConfig } from 'vite';

export default defineConfig({
    root: '.',
    server: {
        port: 5173,
        proxy: {
            '/api': {
                target: 'http://localhost:3000',
                changeOrigin: true
            }
        },
        fs: { strict: false }
    },
    build: {
        outDir: 'dist',
        emptyOutDir: true,
        rollupOptions: {
            input: 'index.html'
        }
    },
    optimizeDeps: {
        include: ['three']
    }
});
