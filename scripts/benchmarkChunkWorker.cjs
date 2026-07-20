const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { spawnSync } = require('node:child_process');
const { performance } = require('node:perf_hooks');

const workerSource = fs.readFileSync(path.join(__dirname, '..', 'js', 'chunkWorker.js'), 'utf8')
    .replace(/^import .*undergroundStructures.*\r?\n/m, '');
const undergroundSource = fs.readFileSync(path.join(__dirname, '..', 'js', 'undergroundStructures.js'), 'utf8')
    .replace('export function generateUndergroundStructures', 'function generateUndergroundStructures');
const config = {
    CHUNK_SIZE: 16,
    CHUNK_HEIGHT: 64,
    WATER_LEVEL: 32,
    CLOUD_HEIGHT: 58
};

function createWorkerRuntime(variant) {
    const messages = [];
    const self = {
        postMessage(message) {
            messages.push(message);
        }
    };
    const context = vm.createContext({ self, console });
    vm.runInContext(undergroundSource, context, { filename: 'undergroundStructures.js' });
    vm.runInContext(workerSource, context, { filename: 'chunkWorker.js' });
    self.onmessage({
        data: {
            type: 'init',
            config,
            blockColors: {},
            blockTex: {},
            graphicsVariant: variant,
            reducedGraphicsDetail: false,
            worldGenerationVersion: 2
        }
    });
    return { self, messages };
}

function takeMessage(runtime, type) {
    const message = runtime.messages.pop();
    runtime.messages.length = 0;
    if (!message || message.type !== type) {
        throw new Error(`Expected ${type} worker message.`);
    }
    return message;
}

function benchmarkVariant(variant, radius = 2) {
    const runtime = createWorkerRuntime(variant);
    const chunks = new Map();
    const coordinates = [];
    for (let cx = -radius; cx <= radius; cx++) {
        for (let cz = -radius; cz <= radius; cz++) coordinates.push([cx, cz]);
    }

    const generationStartedAt = performance.now();
    for (const [cx, cz] of coordinates) {
        runtime.self.onmessage({ data: { type: 'generate', cx, cz, epoch: 0 } });
        const message = takeMessage(runtime, 'terrain');
        chunks.set(`${cx},${cz}`, message.data);
    }
    const generationMs = performance.now() - generationStartedAt;

    let vertices = 0;
    let triangles = 0;
    let outputBytes = 0;
    const meshStartedAt = performance.now();
    for (const [cx, cz] of coordinates) {
        const neighbors = [];
        for (let dx = -1; dx <= 1; dx++) {
            for (let dz = -1; dz <= 1; dz++) {
                if (dx === 0 && dz === 0) continue;
                const data = chunks.get(`${cx + dx},${cz + dz}`);
                if (data) neighbors.push({ cx: cx + dx, cz: cz + dz, data: data.buffer.slice(0) });
            }
        }
        runtime.self.onmessage({
            data: {
                type: 'mesh',
                cx,
                cz,
                centerData: chunks.get(`${cx},${cz}`).buffer.slice(0),
                neighbors,
                blockMeta: {},
                epoch: 0
            }
        });
        const message = takeMessage(runtime, 'meshResult');
        for (const mesh of [message.opaque, message.water]) {
            if (!mesh) continue;
            vertices += mesh.pos.length / 3;
            triangles += mesh.idx.length / 3;
            outputBytes += mesh.pos.byteLength + mesh.col.byteLength + mesh.norm.byteLength
                + mesh.uv.byteLength + mesh.sway.byteLength + mesh.atlasUV.byteLength
                + mesh.idx.byteLength;
        }
    }
    const meshMs = performance.now() - meshStartedAt;

    return {
        variant,
        chunks: coordinates.length,
        generationMs,
        meshMs,
        totalMs: generationMs + meshMs,
        vertices,
        triangles,
        outputMiB: outputBytes / (1024 * 1024)
    };
}

const requestedVariant = process.argv.find(argument => /^--variant=[ABC]$/.test(argument))?.slice(-1);
if (requestedVariant) {
    process.stdout.write(JSON.stringify(benchmarkVariant(requestedVariant)));
    return;
}

function benchmarkMedian(variant, repetitions = 3) {
    const samples = [];
    for (let index = 0; index < repetitions; index++) {
        const child = spawnSync(process.execPath, [__filename, `--variant=${variant}`], { encoding: 'utf8' });
        if (child.status !== 0) throw new Error(child.stderr || `Variant ${variant} benchmark failed.`);
        samples.push(JSON.parse(child.stdout));
    }
    samples.sort((left, right) => left.totalMs - right.totalMs);
    return samples[Math.floor(samples.length / 2)];
}

const results = ['A', 'B', 'C'].map(variant => benchmarkMedian(variant));
console.table(results.map(result => ({
    variant: result.variant,
    chunks: result.chunks,
    generationMs: result.generationMs.toFixed(1),
    meshMs: result.meshMs.toFixed(1),
    totalMs: result.totalMs.toFixed(1),
    triangles: result.triangles,
    outputMiB: result.outputMiB.toFixed(2)
})));

const baseline = results[0].totalMs;
const regressions = results.slice(1).filter(result => result.totalMs / baseline > 1.5);
if (regressions.length > 0) {
    console.error(`Chunk performance regression: ${regressions.map(result => `${result.variant} ${(result.totalMs / baseline).toFixed(2)}x`).join(', ')}`);
    process.exitCode = 1;
}
