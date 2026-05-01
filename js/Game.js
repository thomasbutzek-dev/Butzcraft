/* js/Game.js - Butzcraft zentraler State-Container (Phase 1)
 *
 * MIGRATIONS-PFAD aus window-Pollution heraus:
 *
 *  Phase 1 (HIER): Game proxy-zu-window. Existierender Code unverändert. Neuer Code soll
 *                  `import { Game } from './Game.js'` benutzen anstatt window.player etc.
 *
 *  Phase 2 (später): Bestehende Module schrittweise migrieren — pro PR ein Modul:
 *                  - PlayerInteraction.js: window.player → Game.player
 *                  - mobs.js: window.droppedItems → Game.droppedItems
 *                  - inventory.js: window.* Recipe-Hooks → Game-Methoden
 *
 *  Phase 3 (final): window.* Assignments aus GameMain.js entfernen, Game.set*() aufrufen.
 *                  Tests können Game.reset() aufrufen statt window-Properties zu löschen.
 *
 * Vorteile dieses inkrementellen Ansatzes:
 *  - Kein Big-Bang-Refactor (Risiko zu hoch für Hobby-Projekt)
 *  - Jede Migration ist isoliert testbar
 *  - Game-Singleton dient als ausgezeichneter Insertion-Point für Tests/Mocks
 */

// Liste der Slots, die Game verwaltet. Jeder bekommt eine Property mit get/set,
// die transparent durch zu window.* leitet — solange GameMain noch dort schreibt.
//
// Sprint 6: `touchActive` ergänzt (war fehlende Lücke aus dem Sprint-5-Review).
const PROXIED_SLOTS = [
    'player', 'world', 'scene', 'camera', 'renderer', 'controls',
    'mobs', 'droppedItems', 'projectiles',
    'sunMesh', 'moonMesh', 'starsMesh', 'starsMat', 'celestialGroup',
    'BLOCK_TYPES', 'BLOCK_TEX', 'SoundManager',
    'inventorySlots',
    'webglContextLost', 'touchActive'
];

class GameClass {
    constructor() {
        // Define accessor properties auf this, die transparent gegen window proxien.
        for (const slot of PROXIED_SLOTS) {
            Object.defineProperty(this, slot, {
                get: () => (typeof window !== 'undefined' ? window[slot] : undefined),
                set: (v) => { if (typeof window !== 'undefined') window[slot] = v; },
                enumerable: true,
                configurable: true
            });
        }
    }

    // Convenience: Player-Position. null wenn Spiel nicht aktiv.
    get playerPosition() {
        return this.player?.controls?.getObject?.()?.position || null;
    }

    // Convenience: Render-Stats für Profiling/HUDs.
    get renderStats() {
        if (!this.renderer) return null;
        return {
            calls: this.renderer.info.render.calls,
            triangles: this.renderer.info.render.triangles,
            geometries: this.renderer.info.memory.geometries,
            textures: this.renderer.info.memory.textures
        };
    }

    // Reset für Test-Szenarien. Setzt alle Slots auf undefined (sowohl auf Game als auch auf window).
    // NICHT für Production-Code — nur für Tests/Tear-Down.
    reset() {
        for (const slot of PROXIED_SLOTS) {
            this[slot] = undefined;
        }
    }
}

export const Game = new GameClass();

// Auch als window.Game verfügbar machen — ermöglicht Debug-Console-Zugriff
// (`Game.player.health` in DevTools) ohne import-Statement.
if (typeof window !== 'undefined') {
    window.Game = Game;
}
