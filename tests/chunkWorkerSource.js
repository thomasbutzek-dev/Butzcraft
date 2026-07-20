import { readFileSync } from 'node:fs';

export function readChunkWorkerSource() {
    return readFileSync('js/chunkWorker.js', 'utf8').replace(
        /^import .*undergroundStructures.*\r?\n/m,
        'const generateUndergroundStructures = () => ({ structures: [], entities: [], chests: [], spawners: [] });\n'
    );
}
