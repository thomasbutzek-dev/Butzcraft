/* js/Game.js - Butzcraft zentraler State-Container
 *
 * MIGRATIONS-PFAD aus window-Pollution heraus:
 *
 *  Phase 1 (complete): Game proxies legacy window state while modules migrate.
 *
 *  Phase 2 (complete): PlayerInteraction and mob state use Game; the obsolete
 *                      global recipe refresh hook was removed from inventory.
 *
 *  Phase 3 (complete): Game owns shared runtime state; private and imported dependencies stay local.
 *
 * Vorteile dieses inkrementellen Ansatzes:
 *  - Kein Big-Bang-Refactor (Risiko zu hoch für Hobby-Projekt)
 *  - Jede Migration ist isoliert testbar
 *  - Game-Singleton dient als ausgezeichneter Insertion-Point für Tests/Mocks
 */

const STATE_DEFAULTS = Object.freeze({
    player: undefined,
    world: undefined,
    renderer: undefined,
    droppedItems: undefined,
    webglContextLost: false,
    touchActive: false
});

class GameClass {
    constructor() {
        this.reset();
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
        Object.assign(this, STATE_DEFAULTS);
    }
}

export const Game = new GameClass();

// Auch als window.Game verfügbar machen — ermöglicht Debug-Console-Zugriff
// (`Game.player.health` in DevTools) ohne import-Statement.
if (typeof window !== 'undefined') {
    window.Game = Game;
}
