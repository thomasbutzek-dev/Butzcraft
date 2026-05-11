/* Vite-Konfiguration fuer Butzcraft.
 *
 * Express (`npm start`) liefert die App aus dem Repo-Root und die Save/Load-API.
 * Three.js wird lokal aus node_modules geladen, damit Mobile-Browser nicht von
 * externen CDN-Imports abhaengen.
 */
import { defineConfig } from 'vite';

export default defineConfig({
    // GitHub Pages hostet unter /<repo>/, Render meist unter /. Relative Assets
    // funktionieren in beiden Umgebungen und verhindern den Mobile-Startfehler
    // "Engine-Datei wurde nicht geladen" durch /assets/... 404s.
    base: './',
    plugins: [{
        name: 'butzcraft-engine-script-diagnostics',
        transformIndexHtml(html) {
            return html.replace(
                /<script type="module" crossorigin src="([^"]*assets\/index-[^"]+\.js)"><\/script>/,
                `<script type="module" crossorigin src="$1" onload="window.__butzcraftEngineAssetLoaded=true; if (window.__butzcraftStartRequested && !window.__butzcraftGameMainEvaluating && window.__butzcraftRefreshStartStatus) window.__butzcraftRefreshStartStatus('Engine-Datei geladen. Warte auf Ausfuehrung...')" onerror="window.__butzcraftShowStartError && window.__butzcraftShowStartError('Engine-Datei konnte nicht geladen werden')"></script>`
            );
        }
    }],
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
