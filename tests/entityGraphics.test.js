import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';

const entityMaterialsPath = 'js/entityMaterials.js';
const entityMaterialsSource = existsSync(entityMaterialsPath) ? readFileSync(entityMaterialsPath, 'utf8') : '';
const mobsSource = readFileSync('js/mobs.js', 'utf8');
const npcSource = readFileSync('js/npc.js', 'utf8');
const characterSource = readFileSync('js/characterModel.js', 'utf8');

describe('painterly entity graphics', () => {
    it('loads two matching entity atlases for deterministic variation', () => {
        expect(entityMaterialsSource).toContain('entity-material-tiles-a.png');
        expect(entityMaterialsSource).toContain('entity-material-tiles-b.png');
        expect(entityMaterialsSource).toContain('selectEntityTextureVariant');
    });

    it('maps land, aquatic and flying creatures to painted material families', () => {
        for (const [type, tile] of Object.entries({ zombie: 0, skeleton: 1, spider: 2, pig: 3, chicken: 4, sheep: 5, cow: 6, fish: 7, octopus: 8, turtle: 9, parrot: 10 })) {
            expect(mobsSource).toContain(`${type}: ${tile}`);
        }
        expect(mobsSource).toContain('getPainterlyEntityTexture');
    });

    it('gives villagers painted skin and profession materials', () => {
        expect(npcSource).toContain('VILLAGER_SKIN_TILE = 11');
        expect(npcSource).toContain('PROFESSION_TEXTURE_TILES = [12, 13, 14, 15]');
        expect(npcSource).toContain('getPainterlyEntityTexture');
    });

    it('softens player textures only for the painterly graphics styles', () => {
        expect(characterSource).toContain('graphicsPrototype.usesPainterlyTextures ? THREE.LinearFilter : THREE.NearestFilter');
    });
});
