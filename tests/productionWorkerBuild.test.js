// @vitest-environment node

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'vite';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const outputDir = mkdtempSync(join(tmpdir(), 'butzcraft-worker-build-'));
let workerCode;
let mainCode;

beforeAll(async () => {
    await build({
        root: projectRoot,
        logLevel: 'silent',
        build: {
            outDir: outputDir,
            emptyOutDir: true,
            rollupOptions: { input: resolve(projectRoot, 'index.html') }
        }
    });

    const assetsDir = join(outputDir, 'assets');
    const workerFiles = readdirSync(assetsDir).filter(name => /^chunkWorker-.*\.js$/.test(name));
    expect(workerFiles).toHaveLength(1);
    workerCode = readFileSync(join(assetsDir, workerFiles[0]), 'utf8');

    const indexHtml = readFileSync(join(outputDir, 'index.html'), 'utf8');
    const mainFile = indexHtml.match(/<script[^>]+src="\.\/assets\/([^"]+\.js)"/)?.[1];
    expect(mainFile).toBeTruthy();
    mainCode = readFileSync(join(assetsDir, mainFile), 'utf8');
}, 30000);

afterAll(() => {
    rmSync(outputDir, { recursive: true, force: true });
});

describe('production worker build', () => {
    it('does not reference JavaScript modules missing from the build output', () => {
        const relativeImports = [...workerCode.matchAll(/(?:from\s*|import\s*)['"](\.[^'"]+)['"]/g)]
            .map(match => match[1]);
        const missingImports = relativeImports.filter(specifier => {
            const fileName = specifier.split('?')[0];
            return !existsSync(resolve(outputDir, 'assets', fileName));
        });

        expect(missingImports).toEqual([]);
    });
});

describe('production game build', () => {
    it('does not leave the village spawn state as an unresolved global', () => {
        expect(mainCode).not.toMatch(/\b_spawnedVillageKeys\b/);
    });
});
