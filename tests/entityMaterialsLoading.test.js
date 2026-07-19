import { afterEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import * as THREE from 'three';

afterEach(() => {
    vi.restoreAllMocks();
    vi.resetModules();
});

describe('entity material loading', () => {
    it('waits for both entity atlases before starting the game', async () => {
        const completeLoads = [];
        vi.spyOn(THREE.TextureLoader.prototype, 'load').mockImplementation((url, onLoad) => {
            const texture = new THREE.Texture();
            completeLoads.push(() => onLoad(texture));
            return texture;
        });

        const materials = await import('../js/entityMaterials.js');
        let ready = false;
        const preload = materials.preloadEntityMaterials().then(() => { ready = true; });

        await Promise.resolve();
        expect(ready).toBe(false);
        expect(completeLoads).toHaveLength(2);

        completeLoads.forEach(complete => complete());
        await preload;
        expect(ready).toBe(true);

        const gameMainSource = readFileSync('js/GameMain.js', 'utf8');
        const preloadCall = gameMainSource.indexOf('await preloadEntityMaterials();');
        const initCall = gameMainSource.indexOf('init();', preloadCall);
        expect(preloadCall).toBeGreaterThan(-1);
        expect(initCall).toBeGreaterThan(preloadCall);
    });
});
