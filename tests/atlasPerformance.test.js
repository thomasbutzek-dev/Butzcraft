import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

describe('atlas publication', () => {
    it('encodes browser atlas snapshots asynchronously and refreshes existing icons', () => {
        const blocksSource = readFileSync('js/blocks.js', 'utf8');
        const gameMainSource = readFileSync('js/GameMain.js', 'utf8');

        expect(blocksSource).toContain('canvas.toBlob(blob =>');
        expect(blocksSource).toContain('URL.createObjectURL(blob)');
        expect(blocksSource).toContain('version !== atlasSnapshotVersion');
        expect(gameMainSource).toContain("window.addEventListener('butzcraft:atlas-ready'");
        expect(gameMainSource).toContain("document.querySelectorAll('.flat-icon, .mc-face, .mini-icon')");
    });
});
