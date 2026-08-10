import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

describe('browser module identity', () => {
    it('loads the large block atlas module through one URL everywhere', () => {
        const consumers = [
            'js/GameMain.js',
            'js/PlayerInteraction.js',
            'js/furnace.js',
            'js/inventory.js',
            'js/mobs.js',
            'js/onboarding.js',
            'js/world.js'
        ];
        const specifiers = consumers.map(file => {
            const source = readFileSync(file, 'utf8');
            return source.match(/\.\/blocks\.js\?v=[^'\"]+/)?.[0];
        });

        expect(new Set(specifiers)).toEqual(new Set(['./blocks.js?v=20260801b']));
    });

    it('cache-busts the browser entry after atlas changes', () => {
        const source = readFileSync('index.html', 'utf8');

        expect(source).toContain('./js/GameMain.js?v=20260801i');
    });

    it('loads the painterly held-item models through current browser URLs', () => {
        const gameSource = readFileSync('js/GameMain.js', 'utf8');
        const playerSource = readFileSync('js/Player.js', 'utf8');

        expect(gameSource).toContain('./Player.js?v=20260801b');
        expect(playerSource).toContain('./heldItemModels.js?v=20260801a');
    });

    it('loads the current frame-time diagnostics module', () => {
        const source = readFileSync('js/GameMain.js', 'utf8');

        expect(source).toContain('./frameRateTracker.js?v=20260731b');
    });

    it('loads the story orchestrator through its current URL', () => {
        const source = readFileSync('js/GameMain.js', 'utf8');

        expect(source).toContain('./storyOrchestrator.js?v=20260731a');
    });

    it('loads sound through one versioned URL everywhere', () => {
        const consumers = ['js/GameMain.js', 'js/inventory.js', 'js/mobs.js', 'js/weather.js'];
        const specifiers = consumers.map(file => {
            const source = readFileSync(file, 'utf8');
            return source.match(/\.\/sound\.js\?v=[^'\"]+/)?.[0];
        });

        expect(new Set(specifiers)).toEqual(new Set(['./sound.js?v=20260731a']));
    });

    it('loads world generation through one versioned URL everywhere', () => {
        const consumers = ['js/GameMain.js', 'js/newGameSpawn.js', 'js/weather.js'];
        const specifiers = consumers.map(file => {
            const source = readFileSync(file, 'utf8');
            return source.match(/\.\/world\.js\?v=[^'\"]+/)?.[0];
        });

        expect(new Set(specifiers)).toEqual(new Set(['./world.js?v=20260801d']));
    });

    it('loads the village-chest worker through the current world-generation URL', () => {
        const source = readFileSync('js/world.js', 'utf8');

        expect(source).toContain("./chunkWorker.js?v=20260801d");
    });

    it('uses one shared terrain-height rule in the worker and main thread', () => {
        const consumers = ['js/chunkWorker.js', 'js/world.js'];
        const specifiers = consumers.map(file => {
            const source = readFileSync(file, 'utf8');
            return source.match(/\.\/terrainHeightRules\.js\?v=[^'\"]+/)?.[0];
        });

        expect(new Set(specifiers)).toEqual(new Set(['./terrainHeightRules.js?v=20260801a']));
    });

    it('uses one shared floating-island rule for generation and natural spawning', () => {
        const consumers = ['js/GameMain.js', 'js/chunkWorker.js'];
        const specifiers = consumers.map(file => {
            const source = readFileSync(file, 'utf8');
            return source.match(/\.\/naturalSpawnRules\.js\?v=[^'\"]+/)?.[0];
        });

        expect(new Set(specifiers)).toEqual(new Set(['./naturalSpawnRules.js?v=20260731a']));
    });

    it('loads the current villager movement module', () => {
        const source = readFileSync('js/GameMain.js', 'utf8');

        expect(source).toContain('./npc.js?v=20260731a');
    });

    it('loads inventory through one versioned URL everywhere', () => {
        const consumers = [
            'js/GameMain.js',
            'js/PlayerInteraction.js',
            'js/furnace.js',
            'js/itemCollection.js',
            'js/tradeUI.js'
        ];
        const specifiers = consumers.map(file => {
            const source = readFileSync(file, 'utf8');
            return source.match(/\.\/inventory\.js\?v=[^'\"]+/)?.[0];
        });

        expect(new Set(specifiers)).toEqual(new Set(['./inventory.js?v=20260801c']));
    });

    it('loads the Game singleton through one versioned URL everywhere', () => {
        const consumers = [
            'js/GameMain.js',
            'js/PlayerInteraction.js',
            'js/furnace.js',
            'js/inventory.js',
            'js/mobs.js',
            'js/touch.js',
            'js/tradeUI.js'
        ];
        const specifiers = consumers.map(file => {
            const source = readFileSync(file, 'utf8');
            return source.match(/\.\/Game\.js\?v=[^'\"]+/)?.[0];
        });

        expect(new Set(specifiers)).toEqual(new Set(['./Game.js?v=20260716b']));
    });

    it('loads touch detection through one versioned URL everywhere', () => {
        const consumers = ['js/GameMain.js', 'js/particles.js'];
        const specifiers = consumers.map(file => {
            const source = readFileSync(file, 'utf8');
            return source.match(/\.\/touch\.js\?v=[^'\"]+/)?.[0];
        });

        expect(new Set(specifiers)).toEqual(new Set(['./touch.js?v=20260801a']));
    });

    it('loads story progress through one versioned URL everywhere', () => {
        const consumers = ['js/GameMain.js', 'js/PlayerInteraction.js', 'js/saveMigrations.js', 'js/tradeUI.js'];
        const specifiers = consumers.map(file => {
            const source = readFileSync(file, 'utf8');
            return source.match(/\.\/storyProgress\.js\?v=[^'\"]+/)?.[0];
        });

        expect(new Set(specifiers)).toEqual(new Set(['./storyProgress.js?v=20260730c']));
    });

    it('loads the blood moon cycle through one versioned URL everywhere', () => {
        const consumers = ['js/GameMain.js', 'js/saveMigrations.js'];
        const specifiers = consumers.map(file => {
            const source = readFileSync(file, 'utf8');
            return source.match(/\.\/bloodMoonCycle\.js\?v=[^'\"]+/)?.[0];
        });

        expect(new Set(specifiers)).toEqual(new Set(['./bloodMoonCycle.js?v=20260730a']));
    });

    it('loads dialog focus management through one versioned URL everywhere', () => {
        const consumers = ['js/GameMain.js', 'js/PlayerInteraction.js', 'js/furnace.js', 'js/inventory.js', 'js/tradeUI.js'];
        const specifiers = consumers.map(file => {
            const source = readFileSync(file, 'utf8');
            return source.match(/\.\/dialogFocus\.js\?v=[^'\"]+/)?.[0];
        });

        expect(new Set(specifiers)).toEqual(new Set(['./dialogFocus.js?v=20260718b']));
    });

    it('loads the trade UI through one versioned URL everywhere', () => {
        const consumers = ['js/GameMain.js', 'js/PlayerInteraction.js'];
        const specifiers = consumers.map(file => {
            const source = readFileSync(file, 'utf8');
            return source.match(/\.\/tradeUI\.js\?v=[^'\"]+/)?.[0];
        });

        expect(new Set(specifiers)).toEqual(new Set(['./tradeUI.js?v=20260730b']));
    });

    it('loads the furnace through one versioned URL everywhere', () => {
        const consumers = ['js/GameMain.js', 'js/PlayerInteraction.js'];
        const specifiers = consumers.map(file => {
            const source = readFileSync(file, 'utf8');
            return source.match(/\.\/furnace\.js\?v=[^'\"]+/)?.[0];
        });

        expect(new Set(specifiers)).toEqual(new Set(['./furnace.js?v=20260723e']));
    });

    it('loads structure and village-chest rules through one versioned URL everywhere', () => {
        const consumers = ['js/GameMain.js', 'js/PlayerInteraction.js'];
        const specifiers = consumers.map(file => {
            const source = readFileSync(file, 'utf8');
            return source.match(/\.\/structures\.js\?v=[^'\"]+/)?.[0];
        });

        expect(new Set(specifiers)).toEqual(new Set(['./structures.js?v=20260731c']));
    });

    it('loads player interaction through the current browser URL', () => {
        const source = readFileSync('js/GameMain.js', 'utf8');

        expect(source).toContain('./PlayerInteraction.js?v=20260801b');
    });

    it('loads the character-editor bridge through the current browser URL', () => {
        const source = readFileSync('js/GameMain.js', 'utf8');

        expect(source).toContain('./characterEditorBridge.js?v=20260801a');
    });

    it('loads thin-block interaction targeting through the current browser URL', () => {
        const source = readFileSync('js/PlayerInteraction.js', 'utf8');

        expect(source).toContain('./blockInteractionTarget.js?v=20260801a');
    });

    it('loads the production graphics style through one URL everywhere', () => {
        const consumers = [
            'js/GameMain.js',
            'js/PlayerInteraction.js'
        ];
        const specifiers = consumers.map(file => {
            const source = readFileSync(file, 'utf8');
            return source.match(/\.\/graphicsStyle\.js\?v=[^'\"]+/)?.[0];
        });

        expect(new Set(specifiers)).toEqual(new Set(['./graphicsStyle.js?v=20260801a']));
    });

    it('loads torch lighting through one URL everywhere', () => {
        const consumers = ['js/GameMain.js', 'js/Player.js', 'js/PlayerInteraction.js'];
        const specifiers = consumers.map(file => {
            const source = readFileSync(file, 'utf8');
            return source.match(/\.\/torchLights\.js\?v=[^'\"]+/)?.[0];
        });

        expect(new Set(specifiers)).toEqual(new Set(['./torchLights.js?v=20260719a']));
    });

    it('loads block type constants through one lightweight URL everywhere', () => {
        const consumers = ['js/blocks.js', 'js/equipmentRules.js'];
        const specifiers = consumers.map(file => {
            const source = readFileSync(file, 'utf8');
            return source.match(/\.\/blockTypes\.js\?v=[^'\"]+/)?.[0];
        });

        expect(new Set(specifiers)).toEqual(new Set(['./blockTypes.js?v=20260723a']));
    });
});
