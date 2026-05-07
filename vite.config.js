/* Vite-Konfiguration für Butzcraft.
 *
 * Kontext / Trade-offs:
 *  - Bestehender Setup-Modus (`npm start`): Express-Server (server.js) liefert statische Files
 *    UND stellt /api/save & /api/load bereit. Three.js wird via importmap vom unpkg-CDN geladen.
 *    Worker (chunkWorker.js) wird als reines URL-String an `new Worker(...)` übergeben.
 *  - Vite-Dev-Modus (`npm run dev`): Vite serviert die Files mit HMR (CSS/HTML schnellerer Reload).
 *    Da Express weiterhin auf 3000 läuft, proxyen wir /api/* direkt durch.
 *  - Vite-Build-Modus (`npm run build`): Erzeugt dist/ mit gebündelten ES-Modulen.
 *    ACHTUNG: Funktioniert noch NICHT End-to-End — der Worker müsste auf das `?worker`-Pattern
 *    umgestellt werden und das importmap durch echte three-Imports ersetzt. Build wird hier
 *    aufgeführt, ist aber als Migrationspfad zu verstehen, nicht Production-ready.
 *
 *  Daher: `npm run dev` ist die nutzbare neue Funktion. `npm run build` ist Future-Work.
 */
import { defineConfig } from 'vite';

export default defineConfig({
    root: '.',
    server: {
        port: 5173,
        // Express-Backend auf 3000 für /api/save & /api/load proxyen.
        // So bleibt das Save/Load-Feature funktionsfähig im Vite-Dev-Modus.
        proxy: {
            '/api': {
                target: 'http://localhost:3000',
                changeOrigin: true
            }
        },
        // Wichtig: Service-Worker / Web-Worker müssen aus dem Root erreichbar bleiben.
        // 'js/' ist relativ zur HTML, Vite serviert das ohne Probleme.
        fs: { strict: false }
    },
    // Build-Konfiguration ist explizit unvollständig — siehe Hinweis oben.
    build: {
        outDir: 'dist',
        emptyOutDir: true,
        rollupOptions: {
            input: 'index.html',
            external: [
                'three',
                /^three\/addons\//
            ]
        }
    },
    // Vitest-Konfig wird von vitest.config.js übernommen, hier nicht doppeln.
    optimizeDeps: {
        // three NICHT pre-bundeln — das wird per importmap vom CDN geladen.
        exclude: ['three']
    }
});
