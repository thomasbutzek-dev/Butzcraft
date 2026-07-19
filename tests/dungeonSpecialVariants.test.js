import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { describe, expect, it } from 'vitest';

function loadPainterlyTextureFor(graphicsVariant) {
    const self = {};
    const context = vm.createContext({
        self,
        console,
        Math,
        Set,
        Uint8Array,
        Int16Array,
        Float32Array,
        Uint32Array,
        ArrayBuffer
    });
    const source = readFileSync('js/chunkWorker.js', 'utf8');
    vm.runInContext(`${source}\nself.painterlyTextureFor = painterlyTextureFor;`, context);
    vm.runInContext(`GRAPHICS_VARIANT = '${graphicsVariant}';`, context);
    return self.painterlyTextureFor;
}

function collectVariants(selectTexture, blockType, fallback) {
    const variants = new Set();
    for (let x = -48; x <= 48; x += 3) {
        for (let z = -48; z <= 48; z += 3) {
            variants.add(selectTexture(blockType, null, x, 24, z, fallback));
        }
    }
    return variants;
}

describe('painterly dungeon and special-block variants', () => {
    it('varies mossy stone, spawners, pressure plates, and fire within coherent atlas families', () => {
        const selectTexture = loadPainterlyTextureFor('B');

        expect([...collectVariants(selectTexture, 84, 84)]).toEqual(expect.arrayContaining([84, 191, 192, 193]));
        expect([...collectVariants(selectTexture, 83, 83)]).toEqual(expect.arrayContaining([83, 194, 195, 196]));
        expect([...collectVariants(selectTexture, 79, 79)]).toEqual(expect.arrayContaining([79, 197, 198, 199]));
        expect([...collectVariants(selectTexture, 86, 86)]).toEqual(expect.arrayContaining([86, 201, 202, 203]));
    });

    it('keeps variant A on the original dungeon and special-block tiles', () => {
        const selectTexture = loadPainterlyTextureFor('A');

        expect(selectTexture(84, null, 12, 24, -6, 84)).toBe(84);
        expect(selectTexture(83, null, 12, 24, -6, 83)).toBe(83);
        expect(selectTexture(79, null, 12, 24, -6, 79)).toBe(79);
        expect(selectTexture(86, null, 12, 24, -6, 86)).toBe(86);
    });
});
