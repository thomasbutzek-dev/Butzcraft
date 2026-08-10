import { readFileSync } from 'node:fs';

export function readChunkWorkerSource() {
    const naturalSpawnRules = readFileSync('js/naturalSpawnRules.js', 'utf8')
        .replace(/\bexport\s+/g, '');
    const terrainHeightRules = readFileSync('js/terrainHeightRules.js', 'utf8')
        .replace(/\bexport\s+/g, '');
    return readFileSync('js/chunkWorker.js', 'utf8')
        .replace(
            /^import .*undergroundStructures.*\r?\n/m,
            'const generateUndergroundStructures = () => ({ structures: [], entities: [], chests: [], spawners: [] });\n'
        )
        .replace(
            /^import .*naturalSpawnRules.*\r?\n/m,
            `${naturalSpawnRules}\n`
        )
        .replace(
            /^import .*terrainHeightRules.*\r?\n/m,
            `${terrainHeightRules}\n`
        );
}
