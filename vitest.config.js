/* Vitest-Konfiguration für Butzcraft.
 *
 * Wichtige Entscheidungen:
 *  - environment: 'jsdom' damit Module, die window/document anfassen, ohne Polyfills laufen.
 *    Browser-only Module (Three.js mit WebGL) werden NICHT gemocked — Tests müssen sich
 *    auf reine Logik beschränken (recipes.js, Game.js Proxy, Helper-Funktionen).
 *  - include: tests/ verzeichnis — bewusst getrennt von js/ damit ESM-Browser-Pfade unberührt bleiben.
 */
import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        environment: 'jsdom',
        globals: false,
        include: ['tests/**/*.test.js'],
        // js/blocks_test.js ist ein Browser-Smoke-Test, kein Vitest-Test
        exclude: ['node_modules/**', 'js/blocks_test.js']
    }
});
