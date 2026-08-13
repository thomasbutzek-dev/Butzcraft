// ============================================================
// Butzcraft – chunkWorker.js
// Terrain-Generierung + Chunk-Meshing + Vertex Ambient Occlusion
// Läuft komplett off-main-thread für ruckelfreies Gameplay.
// ============================================================

import { generateUndergroundStructures } from './undergroundStructures.js?v=20260721b';
import { getFloatingIslandAt } from './naturalSpawnRules.js?v=20260731a';
import { getOceanDepthFactor } from './terrainHeightRules.js?v=20260801a';

let CHUNK_SIZE = 16, CHUNK_HEIGHT = 64, WATER_LEVEL = 32, CLOUD_HEIGHT = 50;
let BLOCK_COLORS = {};
let BLOCK_TEX = {};
let WORLD_GENERATION_VERSION = 1;

const BIOMES = { OCEAN: 'Ozean', DESERT: 'Wüste', JUNGLE: 'Urwald', SNOW: 'Schneefeld', PLAINS: 'Grasland' };

// Transparente/Nicht-solide Block-IDs (Faces gegen diese werden gezeichnet)
// 79=Druckplatte, 80=Minengleis: dünn, Nachbarn sollen sichtbar sein
const TRANSPARENT_IDS = new Set([0, -1, 4, 9, 10, 27, 32, 33, 34, 36, 38, 39, 43, 44, 46, 47, 48, 49, 50, 52, 54, 79, 80, 86, 101, 102, 103, 104]);

// 2D-Pflanzen (Stern-Mesh statt Würfel)
const PLANT_2D_IDS = new Set([9, 10, 27, 43, 44, 46, 47, 48, 49, 50, 52, 54, 86]);
const LOG_IDS = new Set([5, 13, 15]);
const PAINTERLY_MATERIAL_IDS = new Set([1, 2, 3, 4, 5, 6, 7, 8, 11, 13, 14, 15, 16, 26, 28, 29, 30, 32, 36, 38, 39, 45, 49, 54, 56, 57, 58, 59, 75, 77, 78, 79, 80, 81, 82, 83, 84, 85, 86, 87, 88]);
const PAINTERLY_TEXTURE_VARIANTS = {
    2: [1, 104, 105, 106],
    3: [2, 116, 117, 118],
    5: [4, 107, 108, 109],
    6: [5, 110, 111, 112],
    7: [6, 134, 135, 136],
    11: [8, 137, 138, 139],
    9: [15, 148, 149, 150],
    10: [16, 151, 152, 153],
    46: [46, 156, 157, 158],
    47: [47, 154],
    48: [48, 155],
    26: [27, 131, 132, 133],
    28: [29, 159, 160, 161],
    33: [39, 162],
    34: [40, 163],
    75: [75, 164, 165, 166],
    80: [80, 167, 168, 169],
    81: [81, 170, 171, 172],
    87: [87, 173, 174, 175],
    85: [85, 176, 177, 178],
    30: [31, 179, 180, 181],
    82: [82, 182, 183, 184],
    88: [88, 185, 186, 187],
    78: [9, 188, 189, 190],
    77: [8, 137, 138, 139],
    84: [84, 191, 192, 193],
    83: [83, 194, 195, 196],
    79: [79, 197, 198, 199],
    86: [86, 201, 202, 203],
    29: [30, 204, 205, 206],
    56: [56, 207, 208, 209],
    57: [57, 210, 211, 212],
    58: [58, 213, 214, 215],
    45: [45, 216, 217, 218],
    8: [7, 219, 220, 221],
    49: [49, 222, 223, 224],
    54: [54, 225, 226, 227],
    13: [10, 228, 229, 230],
    14: [11, 231, 232, 233],
    15: [12, 234, 235, 236],
    16: [13, 237, 238, 239],
    59: [59, 240, 241, 242],
    36: [36, 243, 244, 245],
    32: [38, 246, 247, 248],
    38: [41, 249],
    39: [42, 250],
    43: [43, 125, 126, 127],
    44: [44, 119, 120, 121],
    50: [50, 122, 123, 124],
    52: [52, 128, 129, 130]
};

function spatialVariantIndex(x, y, z, count) {
    let hash = Math.imul(x, 374761393) + Math.imul(y, 668265263) + Math.imul(z, 2147483647);
    hash = Math.imul(hash ^ (hash >>> 13), 1274126177);
    return ((hash ^ (hash >>> 16)) >>> 0) % count;
}

const FURNITURE_DIRECTION_VECTORS = [[1, 0], [-1, 0], [0, 1], [0, -1]];

function resolveFurnitureDirection(blockType, wx, y, wz, getBlock, blockMeta) {
    const key = wx + ',' + y + ',' + wz;
    if (Object.prototype.hasOwnProperty.call(blockMeta, key)) return blockMeta[key] & 3;

    const isPrimary = blockType === 28 || blockType === 38;
    const partnerType = blockType === 28 ? 36 : blockType === 36 ? 28 : blockType === 38 ? 39 : 38;
    for (let direction = 0; direction < FURNITURE_DIRECTION_VECTORS.length; direction++) {
        const [dx, dz] = FURNITURE_DIRECTION_VECTORS[direction];
        const checkX = isPrimary ? wx + dx : wx - dx;
        const checkZ = isPrimary ? wz + dz : wz - dz;
        if (getBlock(checkX, y, checkZ) === partnerType) return direction;
    }
    return 0;
}

function furnitureTextureFor(blockType, wx, y, wz, direction, fallback) {
    const variants = PAINTERLY_TEXTURE_VARIANTS[blockType];
    if (!variants) return fallback;
    const [dx, dz] = FURNITURE_DIRECTION_VECTORS[direction];
    const isSecondary = blockType === 36 || blockType === 39;
    const anchorX = isSecondary ? wx - dx : wx;
    const anchorZ = isSecondary ? wz - dz : wz;
    return variants[spatialVariantIndex(anchorX, y, anchorZ, variants.length)];
}

function furnitureTopUVs(u0, v0, u1, v1, direction) {
    if (direction === 0) return [u0, v1, u0, v0, u1, v0, u1, v1];
    if (direction === 1) return [u1, v0, u1, v1, u0, v1, u0, v0];
    if (direction === 3) return [u1, v1, u0, v1, u0, v0, u1, v0];
    return [u0, v0, u1, v0, u1, v1, u0, v1];
}

function painterlyTextureFor(blockType, face, wx, y, wz, fallback) {
    let variants;
    let patchX = wx;
    let patchY = y;
    let patchZ = wz;
    if (blockType === 33 || blockType === 34) {
        variants = PAINTERLY_TEXTURE_VARIANTS[blockType];
        patchY = 0;
    } else if (blockType === 1) {
        const biome = getBiomeAt(wx, wz);
        variants = face?.d[1] === 1
            ? biome === BIOMES.JUNGLE
                ? [144, 145, 146, 147]
                : [0, 101, 102, 103]
            : face?.d[1] === -1
                ? PAINTERLY_TEXTURE_VARIANTS[2]
                : [53, 113, 114, 115];
        patchX = Math.floor(wx / 8);
        patchY = 0;
        patchZ = Math.floor(wz / 8);
    } else if (blockType === 7) {
        variants = getBiomeAt(wx, wz) === BIOMES.OCEAN
            ? [140, 141, 142, 143]
            : PAINTERLY_TEXTURE_VARIANTS[7];
        patchX = Math.floor(wx / 6);
        patchY = 0;
        patchZ = Math.floor(wz / 6);
    } else {
        variants = PAINTERLY_TEXTURE_VARIANTS[blockType];
        if (!variants) return fallback;
        if (blockType === 2) {
            patchX = Math.floor(wx / 8);
            patchY = Math.floor(y / 4);
            patchZ = Math.floor(wz / 8);
        } else if (blockType === 3 || blockType === 26) {
            patchX = Math.floor(wx / 6);
            patchY = Math.floor(y / 6);
            patchZ = Math.floor(wz / 6);
        } else if (blockType === 5) {
            patchY = 0;
        } else if (blockType === 6) {
            patchX = Math.floor(wx / 2);
            patchY = Math.floor(y / 2);
            patchZ = Math.floor(wz / 2);
        }
    }
    return variants[spatialVariantIndex(patchX, patchY, patchZ, variants.length)];
}

// Würfel-Gesichter: direction + 4 Vertices
const CUBE_FACES = [
    { d: [0, 0, 1],  v: [[0,0,1],[1,0,1],[1,1,1],[0,1,1]] },   // Front (+Z)
    { d: [0, 0,-1],  v: [[1,0,0],[0,0,0],[0,1,0],[1,1,0]] },   // Back  (-Z)
    { d: [-1,0, 0],  v: [[0,0,0],[0,0,1],[0,1,1],[0,1,0]] },   // Left  (-X)
    { d: [1, 0, 0],  v: [[1,0,1],[1,0,0],[1,1,0],[1,1,1]] },   // Right (+X)
    { d: [0, 1, 0],  v: [[0,1,1],[1,1,1],[1,1,0],[0,1,0]] },   // Top   (+Y)
    { d: [0,-1, 0],  v: [[0,0,0],[1,0,0],[1,0,1],[0,0,1]] }    // Bottom(-Y)
];

// AO-Nachbar-Offsets pro Face, pro Vertex (je 3 Nachbarn: side1, side2, corner)
// Berechnet bei Init für jedes Face
const AO_OFFSETS = CUBE_FACES.map(face => {
    const [dx, dy, dz] = face.d;
    // Bestimme die 2 tangentialen Richtungen
    let t1, t2;
    if (dy !== 0) {
        t1 = [1, 0, 0]; t2 = [0, 0, 1];
    } else if (dx !== 0) {
        t1 = [0, 1, 0]; t2 = [0, 0, 1];
    } else {
        t1 = [1, 0, 0]; t2 = [0, 1, 0];
    }
    // Für jeden der 4 Vertices des Faces die 3 AO-Nachbarn berechnen
    return face.v.map(vPos => {
        // Vertex-Position relativ zum Block-Zentrum (-0.5..0.5 pro Achse)
        const cx = vPos[0] - 0.5, cy = vPos[1] - 0.5, cz = vPos[2] - 0.5;
        // Richtung des Vertex in den Tangential-Ebenen
        const s1x = Math.sign(cx * t1[0] + cy * t1[1] + cz * t1[2]);
        const s2x = Math.sign(cx * t2[0] + cy * t2[1] + cz * t2[2]);
        // Die 3 Nachbar-Offsets (relativ zum Nachbar-Block in Face-Richtung)
        return {
            side1: [dx + s1x * t1[0], dy + s1x * t1[1], dz + s1x * t1[2]],
            side2: [dx + s2x * t2[0], dy + s2x * t2[1], dz + s2x * t2[2]],
            corner: [dx + s1x * t1[0] + s2x * t2[0], dy + s1x * t1[1] + s2x * t2[1], dz + s1x * t1[2] + s2x * t2[2]]
        };
    });
});

// AO-Helligkeits-Multiplikatoren (index = AO-Level 0..3)
const AO_CURVE = [0.55, 0.70, 0.85, 1.0];

function vertexAO(side1Solid, side2Solid, cornerSolid) {
    if (side1Solid && side2Solid) return 0;
    return 3 - (side1Solid ? 1 : 0) - (side2Solid ? 1 : 0) - (cornerSolid ? 1 : 0);
}

// ============================================================
// Terrain-Generierung (unverändert)
// ============================================================

function mulberry32(a) {
    return function () {
        var t = a += 0x6D2B79F5;
        t = Math.imul(t ^ t >>> 15, t | 1);
        t ^= t + Math.imul(t ^ t >>> 7, t | 61);
        return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
}

function noise2D(x, z, seed = 123) {
    const getComp = (f, a) => (Math.sin(x * f + seed) + Math.cos(z * f + seed)) * a;
    return getComp(0.1, 2) + getComp(0.05, 4) + getComp(0.02, 5);
}

function getBiomeAt(x, z) {
    const temp = (Math.sin(x * 0.01) + Math.cos(z * 0.01)) * 0.5;
    const humidity = (Math.sin(x * 0.01 + 500) + Math.cos(z * 0.01 + 500)) * 0.5;
    if (temp < -0.4) return BIOMES.SNOW;
    if (temp > 0.2) return humidity < -0.15 ? BIOMES.DESERT : BIOMES.JUNGLE;
    return humidity < -0.25 ? BIOMES.OCEAN : BIOMES.PLAINS;
}

function getTransitionSurfaceBlock(wx, wz, biome, baseBlock) {
    const sampleDistance = 10;
    const neighbors = new Set([
        getBiomeAt(wx - sampleDistance, wz),
        getBiomeAt(wx + sampleDistance, wz),
        getBiomeAt(wx, wz - sampleDistance),
        getBiomeAt(wx, wz + sampleDistance)
    ]);
    neighbors.delete(biome);
    if (neighbors.size === 0) return baseBlock;

    const patch = spatialVariantIndex(Math.floor(wx / 3), 0, Math.floor(wz / 3), 8);
    const touchesGrassland = neighbors.has(BIOMES.PLAINS) || neighbors.has(BIOMES.JUNGLE);

    if (biome === BIOMES.DESERT && touchesGrassland) {
        if (patch === 0) return 1;
        if (patch === 1) return 2;
    }
    if ((biome === BIOMES.PLAINS || biome === BIOMES.JUNGLE) && neighbors.has(BIOMES.DESERT) && patch === 0) {
        return 7;
    }
    if (biome === BIOMES.SNOW && neighbors.has(BIOMES.PLAINS)) {
        if (patch === 0) return 1;
        if (patch === 1) return 3;
    }
    if (biome === BIOMES.PLAINS && neighbors.has(BIOMES.SNOW) && patch === 0) {
        return 11;
    }
    return baseBlock;
}

function getTerrainHeightAt(wx, wz) {
    const biome = getBiomeAt(wx, wz);
    const temperature = (Math.sin(wx * 0.01) + Math.cos(wz * 0.01)) * 0.5;
    const humidity = (Math.sin(wx * 0.01 + 500) + Math.cos(wz * 0.01 + 500)) * 0.5;
    const oceanFactor = getOceanDepthFactor(temperature, humidity);
    let baseH = noise2D(wx, wz) + 38;
    baseH -= oceanFactor * 22;
    if (biome === BIOMES.DESERT) baseH += Math.sin(wx * 0.2) * 2;
    return Math.floor(baseH);
}

function getDesertTemplePlacement(wx, wz) {
    let minH = Infinity, maxH = -Infinity;
    for (let dx = -5; dx <= 5; dx++) {
        for (let dz = -5; dz <= 5; dz++) {
            const sx = wx + dx;
            const sz = wz + dz;
            if (getBiomeAt(sx, sz) !== BIOMES.DESERT) return null;
            const h = getTerrainHeightAt(sx, sz);
            if (h <= WATER_LEVEL + 1) return null;
            minH = Math.min(minH, h);
            maxH = Math.max(maxH, h);
        }
    }
    if (maxH - minH > 3) return null;
    return { baseY: maxH, minH, maxH };
}

function canSpawnPalmAt(wx, wz, h) {
    for (let dx = -2; dx <= 2; dx++) {
        for (let dz = -2; dz <= 2; dz++) {
            const sx = wx + dx;
            const sz = wz + dz;
            if (getBiomeAt(sx, sz) !== BIOMES.DESERT) return false;
            if (getTerrainHeightAt(sx, sz) <= WATER_LEVEL + 1) return false;
            if (Math.abs(getTerrainHeightAt(sx, sz) - h) > 2) return false;
        }
    }
    return true;
}

function meadowPatch(wx, wz) {
    return (Math.sin(wx * 0.31) + Math.cos(wz * 0.27) + Math.sin((wx + wz) * 0.13)) / 3;
}

function choosePlainsVegetation(wx, wz, rng) {
    const patch = meadowPatch(wx, wz);
    const roll = rng();
    if (patch > 0.48) {
        if (roll < 0.16) return rng() < 0.56 ? 9 : 10;
        if (roll < 0.52) return 44;
        if (roll < 0.56) return 43;
        return 0;
    }
    if (patch < -0.48) {
        if (roll < 0.18) return 44;
        if (roll < 0.22) return 46;
        return 0;
    }
    if (roll < 0.05) return rng() < 0.45 ? 9 : 10;
    if (roll < 0.32) return 44;
    if (roll < 0.35) return rng() < 0.55 ? 43 : 52;
    return 0;
}

function spawnSnowRock(data, x, h, z, worldX, worldZ) {
    const rockRng = mulberry32(Math.imul(worldX, 92837111) ^ Math.imul(worldZ, 689287499));
    setBlockLocal(data, x, h, z, 3);
    if (rockRng() < 0.65) {
        const dx = rockRng() < 0.5 ? -1 : 1;
        const dz = rockRng() < 0.5 ? -1 : 1;
        if (getTerrainHeightAt(worldX + dx, worldZ + dz) === h) {
            setBlockLocal(data, x + dx, h, z + dz, 3);
        }
    }
    if (rockRng() < 0.3) setBlockLocal(data, x, h + 1, z, 3);
}

function spawnIceMound(data, x, h, z, worldX, worldZ) {
    const iceRng = mulberry32(Math.imul(worldX, 19349663) ^ Math.imul(worldZ, 83492791));
    setBlockLocal(data, x, h, z, 78);
    const dx = iceRng() < 0.5 ? -1 : 1;
    const dz = iceRng() < 0.5 ? -1 : 1;
    if (getTerrainHeightAt(worldX + dx, worldZ) === h) setBlockLocal(data, x + dx, h, z, 78);
    if (getTerrainHeightAt(worldX, worldZ + dz) === h) setBlockLocal(data, x, h, z + dz, 78);
    if (iceRng() < 0.45) setBlockLocal(data, x, h + 1, z, 78);
}

function spawnTree(data, x, h, z, biome, rng, worldX, worldZ) {
    const isJ = biome === BIOMES.JUNGLE;
    const isSnow = biome === BIOMES.SNOW;
    const th = (isJ ? 8 : isSnow ? 6 : 4) + Math.floor(rng() * 3);
    const wt = isJ ? 13 : 5, lt = isJ ? 14 : 6;
    for (let ty = 0; ty < th; ty++) {
        const iy = h + ty; if (iy < CHUNK_HEIGHT) data[(iy * CHUNK_SIZE * CHUNK_SIZE) + (z * CHUNK_SIZE) + x] = wt;
    }
    const treeRng = mulberry32(Math.imul(worldX, 73856093) ^ Math.imul(worldZ, 19349663));
        const style = Math.floor(treeRng() * 4);
        const profiles = isSnow
            ? [
                [[-4, 0.8], [-3, 2.0], [-2, 1.2], [-1, 1.8], [0, 0.9], [1, 0.4]],
                [[-3, 1.3], [-2, 2.5], [-1, 1.6], [0, 2.0], [1, 0.8], [2, 0.4]],
                [[-4, 0.7], [-3, 1.7], [-2, 2.7], [-1, 1.4], [0, 1.8], [1, 0.5]],
                [[-3, 1.0], [-2, 2.1], [-1, 2.6], [0, 1.5], [1, 1.1], [2, 0.4]]
            ]
            : isJ
            ? [
                [[-2, 2.0], [-1, 2.8], [0, 3.0], [1, 2.5], [2, 1.7]],
                [[-2, 1.5], [-1, 2.3], [0, 2.8], [1, 2.2], [2, 1.5], [3, 0.7]],
                [[-1, 2.8], [0, 3.1], [1, 2.7], [2, 1.4]],
                [[-3, 1.2], [-2, 2.1], [-1, 2.9], [0, 3.2], [1, 2.4], [2, 1.3]]
            ]
            : [
                [[-2, 1.3], [-1, 2.0], [0, 2.2], [1, 1.7], [2, 0.8]],
                [[-2, 1.0], [-1, 1.6], [0, 2.0], [1, 1.6], [2, 1.1], [3, 0.6]],
                [[-1, 2.4], [0, 2.5], [1, 2.1], [2, 0.9]],
                [[-3, 0.8], [-2, 1.5], [-1, 2.1], [0, 2.3], [1, 1.8], [2, 0.7]]
            ];
        const profile = profiles[style];
        const maxRadius = Math.ceil(Math.max(...profile.map(([, radius]) => radius)));
        for (const [dy, radius] of profile) {
            for (let lx = -maxRadius; lx <= maxRadius; lx++) {
                for (let lz = -maxRadius; lz <= maxRadius; lz++) {
                    const irregularity = (treeRng() - 0.5) * 0.55;
                    if (Math.sqrt(lx * lx + lz * lz) > radius + irregularity) continue;
                    if (treeRng() < 0.035 && Math.abs(lx) + Math.abs(lz) > 1) continue;
                    setBlockLocalIfEmpty(data, x + lx, h + th + dy, z + lz, lt);
                }
            }
        }
        if (!isSnow && style >= 2) {
            const branchX = treeRng() < 0.5 ? -1 : 1;
            const branchZ = treeRng() < 0.5 ? -1 : 1;
            setBlockLocalIfEmpty(data, x + branchX, h + th - 2, z, wt);
            setBlockLocalIfEmpty(data, x, h + th - 1, z + branchZ, wt);
            if (style === 3) {
                setBlockLocalIfEmpty(data, x + branchX * 2, h + th - 2, z, lt);
                setBlockLocalIfEmpty(data, x, h + th - 1, z + branchZ * 2, lt);
            }
        }
}

function frostSnowyTreeCanopies(data, cx, cz) {
    const layerSize = CHUNK_SIZE * CHUNK_SIZE;
    for (let rootY = 1; rootY < CHUNK_HEIGHT - 1; rootY++) {
        for (let rootZ = 0; rootZ < CHUNK_SIZE; rootZ++) {
            for (let rootX = 0; rootX < CHUNK_SIZE; rootX++) {
                const rootIndex = rootY * layerSize + rootZ * CHUNK_SIZE + rootX;
                if (data[rootIndex] !== 5 || data[rootIndex - layerSize] === 5) continue;
                const worldX = cx * CHUNK_SIZE + rootX;
                const worldZ = cz * CHUNK_SIZE + rootZ;
                if (getBiomeAt(worldX, worldZ) !== BIOMES.SNOW && data[rootIndex - layerSize] !== 11) continue;

                for (let y = rootY + 2; y <= Math.min(CHUNK_HEIGHT - 2, rootY + 11); y++) {
                    for (let z = Math.max(0, rootZ - 4); z <= Math.min(CHUNK_SIZE - 1, rootZ + 4); z++) {
                        for (let x = Math.max(0, rootX - 4); x <= Math.min(CHUNK_SIZE - 1, rootX + 4); x++) {
                            const index = y * layerSize + z * CHUNK_SIZE + x;
                            if (data[index] === 6 && data[index + layerSize] === 0) data[index] = 77;
                        }
                    }
                }
            }
        }
    }
}

function spawnPalm(data, x, h, z, worldX, worldZ) {
    const palmRng = mulberry32(Math.imul(worldX, 83492791) ^ Math.imul(worldZ, 2971215073));
    const style = Math.floor(palmRng() * 4);
    const th = [5, 6, 4, 7][style];
    let topX = x, topZ = z;
    const leanX = Math.floor(palmRng() * 3) - 1;
    const leanZ = leanX === 0 ? Math.floor(palmRng() * 3) - 1 : 0;
    for (let ty = 0; ty < th; ty++) {
        const leanStep = ty >= Math.ceil(th * 0.58) ? 1 : 0;
        const wx = x + leanX * leanStep, wz = z + leanZ * leanStep, wy = h + ty;
        topX = wx; topZ = wz;
        if (wx >= 0 && wx < CHUNK_SIZE && wz >= 0 && wz < CHUNK_SIZE && wy < CHUNK_HEIGHT)
            data[(wy * CHUNK_SIZE * CHUNK_SIZE) + (wz * CHUNK_SIZE) + wx] = 15;
    }

    const crownY = h + th;
    setBlockLocal(data, topX, crownY - 1, topZ, 15);
    setBlockLocalIfEmpty(data, topX, crownY, topZ, 16);
    const crowns = [
        [[1, 0, 0], [-1, 0, 0], [0, 0, 1], [0, 0, -1], [2, -1, 0], [-2, -1, 0], [0, -1, 2], [0, -1, -2], [1, 0, 1], [-1, 0, -1]],
        [[1, 0, 1], [-1, 0, -1], [1, 0, -1], [-1, 0, 1], [2, -1, 2], [-2, -1, -2], [2, -1, -2], [-2, -1, 2], [1, 1, 0]],
        [[1, 0, 0], [2, 0, 0], [3, -1, 0], [1, 0, 1], [2, -1, 1], [1, 0, -1], [2, -1, -1], [-1, 0, 0], [0, 1, 0]],
        [[1, 0, 0], [-1, 0, 0], [0, 0, 1], [0, 0, -1], [1, 0, 1], [-1, 0, 1], [0, 1, 0]]
    ];
    for (const [dx, dy, dz] of crowns[style]) {
        setBlockLocalIfEmpty(data, topX + dx, crownY + dy, topZ + dz, 16);
    }
}

// ============================================================
// Prozedurale Strukturen
// ============================================================

// Schreibt einen Block in die Chunk-Data — ignoriert Koordinaten außerhalb des Chunks
function setBlockLocal(data, lx, ly, lz, blockId) {
    if (lx < 0 || lx >= CHUNK_SIZE || lz < 0 || lz >= CHUNK_SIZE || ly < 0 || ly >= CHUNK_HEIGHT) return;
    data[(ly * CHUNK_SIZE * CHUNK_SIZE) + (lz * CHUNK_SIZE) + lx] = blockId;
}

function setBlockLocalIfEmpty(data, lx, ly, lz, blockId) {
    if (lx < 0 || lx >= CHUNK_SIZE || lz < 0 || lz >= CHUNK_SIZE || ly < 0 || ly >= CHUNK_HEIGHT) return;
    const index = (ly * CHUNK_SIZE * CHUNK_SIZE) + (lz * CHUNK_SIZE) + lx;
    if (data[index] === 0) data[index] = blockId;
}

const MINE_THEMES = {
    timber: { support: 81, floor: 3, accent: 26, hazard: 'collapse' },
    overgrown: { support: 13, floor: 84, accent: 14, hazard: 'flooded' },
    frozen: { support: 5, floor: 78, accent: 77, hazard: 'frozen' }
};

function getMineTheme(biome) {
    if (biome === BIOMES.JUNGLE) return 'overgrown';
    if (biome === BIOMES.SNOW) return 'frozen';
    return 'timber';
}

function rotateMinePoint(x, z, rotation) {
    if (rotation === 1) return { x: -z, z: x };
    if (rotation === 2) return { x: -x, z: -z };
    if (rotation === 3) return { x: z, z: -x };
    return { x, z };
}

function getMineLine(from, to) {
    const cells = [];
    const dx = Math.sign(to.x - from.x);
    const dz = Math.sign(to.z - from.z);
    const distance = Math.abs(to.x - from.x) + Math.abs(to.z - from.z);
    for (let step = 0; step <= distance; step++) {
        cells.push({ x: from.x + dx * step, z: from.z + dz * step });
    }
    return cells;
}

function createMinePlan(rng, biome) {
    const theme = getMineTheme(biome);
    const rotation = Math.floor(rng() * 4);
    const turn = rng() < 0.5 ? -1 : 1;
    const optionalModules = Math.floor(rng() * 4);
    const modules = [
        { id: 'entrance', type: 'entrance', x: 0, z: 0 },
        { id: 'approach', type: 'tunnel', x: 0, z: 4 },
        { id: 'junction', type: 'junction', x: 0, z: 8 },
        { id: 'bend', type: 'tunnel', x: turn * 4, z: 8 },
        { id: 'reward', type: 'reward', x: turn * 8, z: 8 }
    ];
    const connections = [
        { from: 'entrance', to: 'approach', kind: 'main' },
        { from: 'approach', to: 'junction', kind: 'main' },
        { from: 'junction', to: 'bend', kind: 'main' },
        { from: 'bend', to: 'reward', kind: 'main' }
    ];

    if (optionalModules >= 1) {
        modules.push({ id: 'ore', type: 'ore', x: -turn * 4, z: 8 });
        connections.push({ from: 'junction', to: 'ore', kind: 'branch' });
    }
    if (optionalModules >= 2) {
        modules.push({ id: 'storage', type: 'storage', x: 0, z: 12 });
        connections.push({ from: 'junction', to: 'storage', kind: 'branch' });
    }
    if (optionalModules >= 3) {
        modules.push({ id: 'hazard', type: MINE_THEMES[theme].hazard, x: -turn * 4, z: 12 });
        connections.push({ from: 'storage', to: 'hazard', kind: 'extension' });
    }

    for (const module of modules) {
        const rotated = rotateMinePoint(module.x, module.z, rotation);
        module.x = rotated.x;
        module.z = rotated.z;
    }

    const moduleById = new Map(modules.map(module => [module.id, module]));
    const trackByPosition = new Map();
    for (const connection of connections) {
        const from = moduleById.get(connection.from);
        const to = moduleById.get(connection.to);
        for (const cell of getMineLine(from, to)) {
            const key = cell.x + ',' + cell.z;
            const existing = trackByPosition.get(key);
            if (existing) {
                existing.mainline ||= connection.kind === 'main';
            } else {
                trackByPosition.set(key, { ...cell, mainline: connection.kind === 'main' });
            }
        }
    }

    const bounds = modules.reduce((result, module) => ({
        minX: Math.min(result.minX, module.x - 3),
        maxX: Math.max(result.maxX, module.x + 3),
        minZ: Math.min(result.minZ, module.z - 3),
        maxZ: Math.max(result.maxZ, module.z + 3)
    }), { minX: Infinity, maxX: -Infinity, minZ: Infinity, maxZ: -Infinity });

    return {
        theme,
        modules,
        connections,
        track: [...trackByPosition.values()],
        bounds
    };
}

function getMineRailStyle(wx, y, wz, getBlock) {
    const hasRail = (dx, dz) => [-1, 0, 1]
        .some(dy => getBlock(wx + dx, y + dy, wz + dz) === 80);
    const connected = [
        hasRail(0, -1),
        hasRail(1, 0),
        hasRail(0, 1),
        hasRail(-1, 0)
    ];
    const count = connected.filter(Boolean).length;

    if (count === 4) return { kind: 'crossing', rotation: 0 };
    if (count === 3) {
        const missingDirection = connected.findIndex(value => !value);
        return { kind: 'junction', rotation: (missingDirection + 2) % 4 };
    }
    if (count === 2) {
        if (connected[0] && connected[2]) return { kind: 'straight', rotation: 0 };
        if (connected[1] && connected[3]) return { kind: 'straight', rotation: 1 };
        if (connected[0] && connected[1]) return { kind: 'curve', rotation: 0 };
        if (connected[1] && connected[2]) return { kind: 'curve', rotation: 1 };
        if (connected[2] && connected[3]) return { kind: 'curve', rotation: 2 };
        return { kind: 'curve', rotation: 3 };
    }
    if (count === 1) {
        return { kind: 'straight', rotation: connected[1] || connected[3] ? 1 : 0 };
    }
    return { kind: 'straight', rotation: 0 };
}

function rotateMineRailUVs(u0, v0, u1, v1, rotation) {
    if (rotation === 1) return [u0, v1, u0, v0, u1, v0, u1, v1];
    if (rotation === 2) return [u1, v1, u0, v1, u0, v0, u1, v0];
    if (rotation === 3) return [u1, v0, u1, v1, u0, v1, u0, v0];
    return [u0, v0, u1, v0, u1, v1, u0, v1];
}

function carveMineRoom(data, x, y, z, module, palette) {
    const radius = module.type === 'reward' || module.type === 'storage' ? 3 : 2;
    for (let dx = -radius; dx <= radius; dx++) {
        for (let dz = -radius; dz <= radius; dz++) {
            setBlockLocal(data, x + module.x + dx, y - 1, z + module.z + dz, palette.floor);
            for (let dy = 0; dy <= 3; dy++) {
                setBlockLocal(data, x + module.x + dx, y + dy, z + module.z + dz, 0);
            }
        }
    }
}

function decorateMineRoom(data, x, y, z, module, palette, trackKeys) {
    const placeOffTrack = (dx, dz, blockId, dy = 0) => {
        const px = module.x + dx;
        const pz = module.z + dz;
        if (!trackKeys.has(px + ',' + pz)) setBlockLocal(data, x + px, y + dy, z + pz, blockId);
    };

    if (module.type === 'reward') {
        placeOffTrack(2, 2, 75);
        placeOffTrack(-2, 2, palette.accent);
    } else if (module.type === 'ore') {
        placeOffTrack(2, 0, 56, 1);
        placeOffTrack(-2, 1, 57, 1);
        placeOffTrack(1, -2, 56, 2);
    } else if (module.type === 'storage') {
        placeOffTrack(2, 2, 28);
        placeOffTrack(-2, 2, 59);
        placeOffTrack(2, -2, 26);
    } else if (module.type === 'collapse') {
        placeOffTrack(1, 1, 85);
        placeOffTrack(2, 1, 85);
        placeOffTrack(2, 0, 3, 1);
    } else if (module.type === 'flooded') {
        placeOffTrack(1, 1, 4);
        placeOffTrack(2, 1, 4);
        placeOffTrack(1, 2, 14, 1);
    } else if (module.type === 'frozen') {
        placeOffTrack(1, 1, 78);
        placeOffTrack(2, 1, 77);
        placeOffTrack(1, 2, 78, 1);
    }

    if (palette.accent === 14 && module.type !== 'flooded') placeOffTrack(-2, -2, 14, 1);
    if (palette.accent === 77 && module.type !== 'frozen') placeOffTrack(-2, -2, 77);
}

function placeMineSupport(data, x, y, z, cell, neighbor, supportBlock, trackKeys) {
    const alongZ = neighbor ? neighbor.x === cell.x : true;
    const sides = alongZ ? [[-1, 0], [1, 0]] : [[0, -1], [0, 1]];
    for (const [dx, dz] of sides) {
        if (trackKeys.has((cell.x + dx) + ',' + (cell.z + dz))) continue;
        for (let dy = 0; dy <= 2; dy++) {
            setBlockLocal(data, x + cell.x + dx, y + dy, z + cell.z + dz, supportBlock);
        }
    }
    for (let offset = -1; offset <= 1; offset++) {
        const dx = alongZ ? offset : 0;
        const dz = alongZ ? 0 : offset;
        setBlockLocal(data, x + cell.x + dx, y + 2, z + cell.z + dz, supportBlock);
    }
}

function spawnMineEntrance(data, x, y, z, surfaceY, plan, palette) {
    if (surfaceY === undefined || surfaceY <= y) return;
    const entrance = plan.modules.find(module => module.id === 'entrance');
    const approach = plan.modules.find(module => module.id === 'approach');
    const forwardX = Math.sign(approach.x - entrance.x);
    const forwardZ = Math.sign(approach.z - entrance.z);
    const sideX = forwardZ;
    const sideZ = -forwardX;
    const depth = surfaceY - y;

    for (let step = 0; step <= depth; step++) {
        const sx = x + entrance.x - forwardX * step;
        const sz = z + entrance.z - forwardZ * step;
        const sy = y + step;
        for (let width = -1; width <= 1; width++) {
            const wx = sx + sideX * width;
            const wz = sz + sideZ * width;
            setBlockLocal(data, wx, sy - 1, wz, palette.floor);
            for (let dy = 0; dy <= 2; dy++) setBlockLocal(data, wx, sy + dy, wz, 0);
        }
        setBlockLocal(data, sx, sy, sz, 80);
    }

    const markerX = x + entrance.x - forwardX * depth;
    const markerZ = z + entrance.z - forwardZ * depth;
    setBlockLocal(data, markerX + sideX * 2, surfaceY, markerZ + sideZ * 2, palette.support);
    setBlockLocal(data, markerX - sideX * 2, surfaceY, markerZ - sideZ * 2, palette.support);
    setBlockLocal(data, markerX + sideX * 2, surfaceY + 1, markerZ + sideZ * 2, 101);
    setBlockLocal(data, markerX - sideX * 2, surfaceY + 1, markerZ - sideZ * 2, 101);
}

// Kompakte verlassene Mine mit modularen Räumen und einer durchgehenden Hauptschiene.
function spawnMine(data, x, y, z, surfaceY, rng = () => 0.5, biome = BIOMES.PLAINS) {
    const plan = createMinePlan(rng, biome);
    const palette = MINE_THEMES[plan.theme];
    const trackKeys = new Set(plan.track.map(cell => cell.x + ',' + cell.z));

    for (const module of plan.modules) carveMineRoom(data, x, y, z, module, palette);

    for (const cell of plan.track) {
        for (let dx = -1; dx <= 1; dx++) {
            for (let dz = -1; dz <= 1; dz++) {
                setBlockLocal(data, x + cell.x + dx, y - 1, z + cell.z + dz, palette.floor);
                for (let dy = 0; dy <= 2; dy++) {
                    setBlockLocal(data, x + cell.x + dx, y + dy, z + cell.z + dz, 0);
                }
            }
        }
    }
    for (const cell of plan.track) {
        setBlockLocal(data, x + cell.x, y, z + cell.z, 80);
    }

    for (let index = 0; index < plan.track.length; index += 4) {
        const cell = plan.track[index];
        const neighbor = plan.track.find(other =>
            Math.abs(other.x - cell.x) + Math.abs(other.z - cell.z) === 1
        );
        placeMineSupport(data, x, y, z, cell, neighbor, palette.support, trackKeys);
    }

    for (const module of plan.modules) decorateMineRoom(data, x, y, z, module, palette, trackKeys);
    spawnMineEntrance(data, x, y, z, surfaceY, plan, palette);
    return plan;
}

// Wüstentempel: 11×11 Sandstein-Pyramide mit verfülltem Fundament und ummauerter Kammer
function spawnDesertTemple(data, x, y, z, worldX, worldZ) {
    const size = 11;
    const halfBase = Math.floor(size / 2);

    // Gelände unter dem gesamten Footprint bis zur Tempelbasis verfüllen.
    for (let dx = -halfBase; dx <= halfBase; dx++) {
        for (let dz = -halfBase; dz <= halfBase; dz++) {
            const terrainH = getTerrainHeightAt(worldX + dx, worldZ + dz);
            for (let fy = terrainH; fy < y; fy++) {
                setBlockLocal(data, x + dx, fy, z + dz, 30);
            }
        }
    }

    // Pyramide Schicht für Schicht.
    for (let level = 0; level < 6; level++) {
        const half = halfBase - level;
        if (half < 0) break;
        for (let dx = -half; dx <= half; dx++) {
            for (let dz = -half; dz <= half; dz++) {
                const isEdge = (Math.abs(dx) === half || Math.abs(dz) === half);
                setBlockLocal(data, x + dx, y + level, z + dz, isEdge ? 82 : 30); // SANDSTONE_CARVED / SANDSTONE
            }
        }
    }

    // Massive Kammerhülle unter der Pyramide: kein offener, schwebender Hohlraum.
    for (let dy = -4; dy <= -1; dy++) {
        for (let dx = -4; dx <= 4; dx++) {
            for (let dz = -4; dz <= 4; dz++) {
                const wall = dy === -4 || dy === -1 || Math.abs(dx) === 3 || Math.abs(dz) === 3;
                setBlockLocal(data, x + dx, y + dy, z + dz, wall ? 30 : 0);
            }
        }
    }

    // Zusätzlicher Sockel unter der Kammer, damit sie auch bei kleinen Dünenkanten nicht frei hängt.
    for (let dx = -3; dx <= 3; dx++) {
        for (let dz = -3; dz <= 3; dz++) {
            setBlockLocal(data, x + dx, y - 5, z + dz, 30);
        }
    }

    // Kleine interne Falle und Truhe in der geschlossenen Kammer.
    setBlockLocal(data, x, y - 3, z + 1, 79);  // PRESSURE_PLATE
    setBlockLocal(data, x, y - 3, z - 2, 75);  // CHEST
}

// Iglu: Halbkuppel Radius 5, Schnee-Kuppel, Eis-Boden, Bett + Truhe innen
function spawnIgloo(data, x, y, z) {
    const r = 5;
    for (let dx = -r; dx <= r; dx++) {
        for (let dz = -r; dz <= r; dz++) {
            for (let dy = 0; dy <= r; dy++) {
                const dist = Math.sqrt(dx * dx + dz * dz + dy * dy);
                if (dist >= r - 0.5 && dist <= r + 0.5) {
                    setBlockLocal(data, x + dx, y + dy, z + dz, 77); // SNOW_BLOCK Kuppel
                }
            }
        }
    }
    // Innenraum aushöhlen
    // Eisboden
    for (let dx = -(r - 1); dx <= r - 1; dx++) {
        for (let dz = -(r - 1); dz <= r - 1; dz++) {
            setBlockLocal(data, x + dx, y, z + dz, 78); // ICE_BLOCK
        }
    }
    // Innenraum nach der Kuppel nochmal freischneiden, damit kein Schnee stehenbleibt.
    for (let dx = -3; dx <= 3; dx++) {
        for (let dz = -3; dz <= 3; dz++) {
            for (let dy = 1; dy <= 3; dy++) {
                const roomRadius = dy >= 4 ? 2 : 3;
                if (dx * dx + dz * dz <= roomRadius * roomRadius) {
                    setBlockLocal(data, x + dx, y + dy, z + dz, 0);
                }
            }
        }
    }
    for (let dz = -r; dz <= -r + 2; dz++) {
        setBlockLocal(data, x, y, z + dz, 78);
        setBlockLocal(data, x, y + 1, z + dz, 0);
        setBlockLocal(data, x, y + 2, z + dz, 0);
    }
    // Bett und Truhe innen
    setBlockLocal(data, x - 2, y + 1, z, 38);  // BED_HEAD
    setBlockLocal(data, x - 1, y + 1, z, 39);  // BED_FOOT
    setBlockLocal(data, x + 2, y + 1, z, 75);  // CHEST
}

const DUNGEON_THEMES = {
    catacomb: { wall: 85, accent: 84, floor: 85, decor: 29 },
    ruins: { wall: 29, accent: 84, floor: 84, decor: 14 },
    frozenCrypt: { wall: 85, accent: 78, floor: 78, decor: 77 }
};

function getDungeonTheme(biome) {
    if (biome === BIOMES.JUNGLE) return 'ruins';
    if (biome === BIOMES.SNOW) return 'frozenCrypt';
    return 'catacomb';
}

function getDungeonRoomRadius(room) {
    return room.role === 'encounter' || room.role === 'reward' ? 3 : 2;
}

function createDungeonPlan(rng, biome) {
    const theme = getDungeonTheme(biome);
    const rotation = Math.floor(rng() * 4);
    const turn = rng() < 0.5 ? -1 : 1;
    const optionalRooms = Math.floor(rng() * 3);
    const passageTypes = ['gallery', 'library', 'crypt'];
    const encounterTypes = ['spawner', 'guard'];
    const rewardTypes = ['treasury', 'shrine'];
    const rooms = [
        { id: 'entrance', role: 'entrance', type: 'entrance', x: 0, z: 0 },
        { id: 'passage', role: 'passage', type: passageTypes[Math.floor(rng() * passageTypes.length)], x: 0, z: 6 },
        { id: 'junction', role: 'junction', type: 'junction', x: 0, z: 12 },
        { id: 'encounter', role: 'encounter', type: encounterTypes[Math.floor(rng() * encounterTypes.length)], x: turn * 6, z: 12 },
        { id: 'reward', role: 'reward', type: rewardTypes[Math.floor(rng() * rewardTypes.length)], x: turn * 12, z: 12 }
    ];
    const connections = [
        { from: 'entrance', to: 'passage', kind: 'main' },
        { from: 'passage', to: 'junction', kind: 'main' },
        { from: 'junction', to: 'encounter', kind: 'main' },
        { from: 'encounter', to: 'reward', kind: 'main' }
    ];

    if (optionalRooms >= 1) {
        rooms.push({ id: 'trap', role: 'optional', type: 'trap', x: -turn * 6, z: 12 });
        connections.push({ from: 'junction', to: 'trap', kind: 'branch' });
    }
    if (optionalRooms >= 2) {
        rooms.push({ id: 'secret', role: 'secret', type: 'secret', x: -turn * 6, z: 6 });
        connections.push({ from: 'trap', to: 'secret', kind: 'extension' });
        connections.push({ from: 'secret', to: 'passage', kind: 'loop' });
    }

    for (const room of rooms) {
        const rotated = rotateMinePoint(room.x, room.z, rotation);
        room.x = rotated.x;
        room.z = rotated.z;
    }

    const bounds = rooms.reduce((result, room) => {
        const radius = getDungeonRoomRadius(room);
        return {
            minX: Math.min(result.minX, room.x - radius),
            maxX: Math.max(result.maxX, room.x + radius),
            minZ: Math.min(result.minZ, room.z - radius),
            maxZ: Math.max(result.maxZ, room.z + radius)
        };
    }, { minX: Infinity, maxX: -Infinity, minZ: Infinity, maxZ: -Infinity });

    return { theme, rooms, connections, bounds };
}

function buildDungeonRoom(data, x, y, z, room, palette) {
    const radius = getDungeonRoomRadius(room);
    for (let dx = -radius; dx <= radius; dx++) {
        for (let dz = -radius; dz <= radius; dz++) {
            for (let dy = 0; dy <= 5; dy++) {
                const boundary = Math.abs(dx) === radius || Math.abs(dz) === radius || dy === 0 || dy === 5;
                if (!boundary) {
                    setBlockLocal(data, x + room.x + dx, y + dy, z + room.z + dz, 0);
                    continue;
                }
                const blockType = dy === 0
                    ? palette.floor
                    : spatialVariantIndex(room.x + dx, dy, room.z + dz, 5) === 0
                        ? palette.accent
                        : palette.wall;
                setBlockLocal(data, x + room.x + dx, y + dy, z + room.z + dz, blockType);
            }
        }
    }
}

function carveDungeonConnection(data, x, y, z, from, to, palette) {
    const alongZ = from.x === to.x;
    for (const cell of getMineLine(from, to)) {
        for (let width = -1; width <= 1; width++) {
            const dx = alongZ ? width : 0;
            const dz = alongZ ? 0 : width;
            setBlockLocal(data, x + cell.x + dx, y, z + cell.z + dz, palette.floor);
            for (let dy = 1; dy <= 4; dy++) {
                setBlockLocal(data, x + cell.x + dx, y + dy, z + cell.z + dz, 0);
            }
            setBlockLocal(data, x + cell.x + dx, y + 5, z + cell.z + dz, palette.wall);
        }
    }
}

function decorateDungeonRoom(data, x, y, z, room, palette) {
    const place = (dx, dy, dz, blockType) => {
        setBlockLocal(data, x + room.x + dx, y + dy, z + room.z + dz, blockType);
    };

    if (room.role === 'entrance') {
        place(-1, 1, -1, palette.decor);
        place(1, 1, -1, palette.decor);
    } else if (room.type === 'gallery') {
        for (const [dx, dz] of [[-2, -2], [2, -2], [-2, 2], [2, 2]]) {
            place(dx, 1, dz, palette.accent);
            place(dx, 2, dz, palette.accent);
        }
    } else if (room.type === 'library') {
        place(-2, 1, 1, 26);
        place(-2, 2, 1, 26);
        place(2, 1, -1, 28);
    } else if (room.type === 'crypt') {
        place(-2, 1, 1, 85);
        place(2, 1, -1, 84);
    } else if (room.role === 'junction') {
        place(-1, 1, -1, 86);
    } else if (room.role === 'encounter') {
        place(0, 1, 0, 83);
        place(-2, 1, 2, palette.accent);
        place(2, 1, -2, palette.accent);
    } else if (room.role === 'reward') {
        place(2, 1, 2, 75);
        place(-2, 1, 2, palette.decor);
    } else if (room.type === 'trap') {
        place(0, 1, 0, 79);
        place(1, 1, 0, palette.accent);
    } else if (room.type === 'secret') {
        place(1, 1, 1, 75);
        place(-1, 1, -1, palette.decor);
    }
}

// Modularer Dungeon mit lesbarer Hauptroute und optionaler Schleife.
function spawnDungeon(data, x, y, z, rng, biome = BIOMES.PLAINS) {
    const plan = createDungeonPlan(rng, biome);
    const palette = DUNGEON_THEMES[plan.theme];
    const roomsById = new Map(plan.rooms.map(room => [room.id, room]));

    for (const room of plan.rooms) buildDungeonRoom(data, x, y, z, room, palette);
    for (const connection of plan.connections) {
        carveDungeonConnection(
            data,
            x,
            y,
            z,
            roomsById.get(connection.from),
            roomsById.get(connection.to),
            palette
        );
    }
    for (const room of plan.rooms) decorateDungeonRoom(data, x, y, z, room, palette);
    return plan;
}

function spawnDungeonEntrance(data, x, dungeonY, z, surfaceY) {
    for (let sy = dungeonY + 5; sy <= surfaceY + 1; sy++) {
        setBlockLocal(data, x, sy, z, 0);
        setBlockLocal(data, x + 1, sy, z, 0);
        setBlockLocal(data, x, sy, z + 1, 0);
        setBlockLocal(data, x + 1, sy, z + 1, 0);
    }

    for (let dx = -1; dx <= 2; dx++) {
        for (let dz = -1; dz <= 2; dz++) {
            const edge = dx === -1 || dx === 2 || dz === -1 || dz === 2;
            if (edge) setBlockLocal(data, x + dx, surfaceY, z + dz, 85);
        }
    }
}

// Surface marker above a dungeon: a weathered stone plinth with a small flame.
function spawnDungeonMarker(data, x, surfaceY, z) {
    for (let dx = -1; dx <= 1; dx++) {
        for (let dz = -1; dz <= 1; dz++) {
            const isCenter = dx === 0 && dz === 0;
            const isCorner = Math.abs(dx) === 1 && Math.abs(dz) === 1;
            const blockType = isCenter || isCorner ? 84 : 85;
            setBlockLocal(data, x + dx, surfaceY, z + dz, blockType);
        }
    }

    setBlockLocal(data, x, surfaceY + 1, z, 85);
    setBlockLocal(data, x, surfaceY + 2, z, 84);
    setBlockLocal(data, x, surfaceY + 3, z, 86);
    setBlockLocal(data, x - 1, surfaceY + 1, z, 101);
    setBlockLocal(data, x + 1, surfaceY + 1, z, 101);
}

// NPC-Dorf: Generiert ein kleines Dorf mit Häusern, Brunnen, Wegen
// Gibt villageData zurück (für NPC-Spawning im Main-Thread)
function getVillagePlacement(wx, wz, biome, generationVersion = 2) {
    let minH = Infinity, maxH = -Infinity;
    let biomeSamples = 0, totalSamples = 0;
    const heights = [];
    const radius = generationVersion >= 2 ? 30 : 12;
    const step = generationVersion >= 2 ? 6 : 4;
    for (let dx = -radius; dx <= radius; dx += step) {
        for (let dz = -radius; dz <= radius; dz += step) {
            const sx = wx + dx;
            const sz = wz + dz;
            totalSamples++;
            if (getBiomeAt(sx, sz) === biome) biomeSamples++;
            const h = getTerrainHeightAt(sx, sz);
            if (h <= WATER_LEVEL + 1) return null;
            heights.push(h);
            minH = Math.min(minH, h);
            maxH = Math.max(maxH, h);
        }
    }
    if (generationVersion >= 2 && biomeSamples / totalSamples < 0.72) return null;
    if (generationVersion < 2 && biomeSamples !== totalSamples) return null;
    if (generationVersion < 2) {
        if (maxH - minH > 6) return null;
        return { baseY: maxH };
    }
    heights.sort((a, b) => a - b);
    const lowY = heights[Math.floor(heights.length * 0.1)];
    const highY = heights[Math.floor(heights.length * 0.9)];
    if (highY - lowY > 10) return null;
    return { baseY: heights[Math.floor(heights.length * 0.75)] };
}

const VILLAGE_ROAD_MAX_DISTANCE = 180;
const VILLAGE_ROAD_SEARCH_RADIUS_CHUNKS = Math.ceil(VILLAGE_ROAD_MAX_DISTANCE / CHUNK_SIZE) + 1;
const VILLAGE_ROAD_TRIM = 6;
const VILLAGE_MAX_FOUNDATION_HEIGHT = 2;
const VILLAGE_SITE_OFFSETS = [
    [0, 0],
    [-8, 0], [8, 0], [0, -8], [0, 8],
    [-8, -8], [8, -8], [-8, 8], [8, 8]
];

function getVillagePathBlockForBiome(biome) {
    if (biome === BIOMES.DESERT) return 30;
    if (biome === BIOMES.SNOW) return 78;
    return 87;
}

function getVillageFootprintTerrain(startX, startZ, width, depth) {
    let minH = Infinity;
    let maxH = -Infinity;
    for (let dx = 0; dx < width; dx++) {
        for (let dz = 0; dz < depth; dz++) {
            const height = getTerrainHeightAt(startX + dx, startZ + dz);
            minH = Math.min(minH, height);
            maxH = Math.max(maxH, height);
        }
    }
    return { minH, maxH };
}

function getVillageBuildingFootprint(villageX, villageZ, building, biome) {
    if (biome === BIOMES.SNOW && !building.isLandmark) {
        const radius = building.purpose === 'hall' ? 4 : 3;
        return {
            x: villageX + building.dx + Math.floor(building.width / 2) - radius,
            z: villageZ + building.dz + Math.floor(building.depth / 2) - radius,
            width: radius * 2 + 1,
            depth: radius * 2 + 1
        };
    }
    return {
        x: villageX + building.dx,
        z: villageZ + building.dz,
        width: building.width,
        depth: building.depth
    };
}

function getVillageSite(villageX, villageZ, biome) {
    const villageRng = mulberry32((villageX * 428759) ^ (villageZ * 756839) ^ 314159);
    const plan = createVillagePlan(villageRng, biome, 2);
    const centerTerrain = getVillageFootprintTerrain(villageX - 3, villageZ - 3, 7, 7);
    const footprints = plan.buildings.map(building => getVillageBuildingFootprint(villageX, villageZ, building, biome));
    const suitable = footprints.every(footprint => {
        const terrain = getVillageFootprintTerrain(footprint.x, footprint.z, footprint.width, footprint.depth);
        return terrain.maxH - 1 - terrain.minH <= VILLAGE_MAX_FOUNDATION_HEIGHT;
    });
    if (!suitable || centerTerrain.maxH - 1 - centerTerrain.minH > VILLAGE_MAX_FOUNDATION_HEIGHT) return null;
    return { baseY: centerTerrain.maxH };
}

function getVillageCandidate(scx, scz, generationVersion = WORLD_GENERATION_VERSION) {
    const rng = mulberry32(scx * 55103 + scz * 97127 + 424242);
    if (rng() >= 0.04) return null;

    const wx0 = scx * CHUNK_SIZE;
    const wz0 = scz * CHUNK_SIZE;
    const villageRange = Math.max(0, CHUNK_SIZE - 16);
    const baseX = wx0 + 8 + Math.floor(rng() * villageRange);
    const baseZ = wz0 + 8 + Math.floor(rng() * villageRange);
    const variantRoll = rng();
    const offsets = generationVersion >= 2 ? VILLAGE_SITE_OFFSETS : [[0, 0]];
    for (const [offsetX, offsetZ] of offsets) {
        const x = baseX + offsetX;
        const z = baseZ + offsetZ;
        const biome = getBiomeAt(x, z);
        if (biome !== BIOMES.PLAINS && biome !== BIOMES.DESERT && biome !== BIOMES.SNOW) continue;
        const placement = getVillagePlacement(x, z, biome, generationVersion);
        if (!placement) continue;
        const site = generationVersion >= 2 ? getVillageSite(x, z, biome) : placement;
        if (!site) continue;
        return {
            scx,
            scz,
            x,
            z,
            baseY: site.baseY,
            biome,
            variant: biome === BIOMES.PLAINS ? Math.floor(variantRoll * 2) : 0
        };
    }
    return null;
}

function getNearbyVillageCandidates(cx, cz) {
    const villages = [];
    for (let scx = cx - VILLAGE_ROAD_SEARCH_RADIUS_CHUNKS; scx <= cx + VILLAGE_ROAD_SEARCH_RADIUS_CHUNKS; scx++) {
        for (let scz = cz - VILLAGE_ROAD_SEARCH_RADIUS_CHUNKS; scz <= cz + VILLAGE_ROAD_SEARCH_RADIUS_CHUNKS; scz++) {
            const village = getVillageCandidate(scx, scz);
            if (village) villages.push(village);
        }
    }
    return villages;
}

function villageKey(village) {
    return village.scx + ',' + village.scz;
}

function findNearestVillage(village, villages) {
    let nearest = null;
    let nearestDistSq = VILLAGE_ROAD_MAX_DISTANCE * VILLAGE_ROAD_MAX_DISTANCE;
    for (const other of villages) {
        if (other === village) continue;
        const dx = other.x - village.x;
        const dz = other.z - village.z;
        const distSq = dx * dx + dz * dz;
        if (distSq < nearestDistSq) {
            nearestDistSq = distSq;
            nearest = other;
        }
    }
    return nearest;
}

function paintVillageRoadBlock(data, cx, cz, wx, wz) {
    const surfaceY = getTerrainHeightAt(wx, wz);
    if (surfaceY <= WATER_LEVEL + 1) return;

    const lx = wx - cx * CHUNK_SIZE;
    const lz = wz - cz * CHUNK_SIZE;
    const pathY = Math.min(CHUNK_HEIGHT - 3, surfaceY);
    const pathBlock = getVillagePathBlockForBiome(getBiomeAt(wx, wz));
    setBlockLocal(data, lx, pathY - 1, lz, pathBlock);
    setBlockLocal(data, lx, pathY, lz, 0);
    setBlockLocal(data, lx, pathY + 1, lz, 0);
}

function drawVillageRoad(data, cx, cz, from, to) {
    const dx = to.x - from.x;
    const dz = to.z - from.z;
    const distance = Math.hypot(dx, dz);
    if (distance < VILLAGE_ROAD_TRIM * 2) return;

    const steps = Math.ceil(distance);
    const perpX = -dz / distance;
    const perpZ = dx / distance;
    const bendSeed = Math.sin(from.x * 12.9898 + from.z * 78.233 + to.x * 37.719 + to.z * 11.131);
    const bend = bendSeed * Math.min(10, distance * 0.08);

    for (let s = VILLAGE_ROAD_TRIM; s <= steps - VILLAGE_ROAD_TRIM; s++) {
        const t = s / steps;
        const curve = Math.sin(t * Math.PI) * bend;
        const centerX = Math.round(from.x + dx * t + perpX * curve);
        const centerZ = Math.round(from.z + dz * t + perpZ * curve);

        for (let w = -1; w <= 1; w++) {
            const wx = Math.round(centerX + perpX * w);
            const wz = Math.round(centerZ + perpZ * w);
            paintVillageRoadBlock(data, cx, cz, wx, wz);
        }
    }
}

function drawVillageRoads(data, cx, cz) {
    const villages = getNearbyVillageCandidates(cx, cz);
    const drawnPairs = new Set();
    for (const village of villages) {
        const nearest = findNearestVillage(village, villages);
        if (!nearest) continue;

        const a = villageKey(village);
        const b = villageKey(nearest);
        const pairKey = a < b ? a + '|' + b : b + '|' + a;
        if (drawnPairs.has(pairKey)) continue;
        drawnPairs.add(pairKey);

        drawVillageRoad(data, cx, cz, village, nearest);
    }
}

const VILLAGE_LAYOUTS = {
    farmstead: {
        center: 'well',
        positions: [
            [-12, -9], [7, -11], [-11, 7], [8, 8], [-2, -13], [9, -1], [-13, -1]
        ],
        types: [
            ['farmhouse', 'home'], ['barn', 'storage'], ['workshop', 'workshop'],
            ['bakery', 'trade'], ['meetingHall', 'hall'], ['stable', 'special']
        ]
    },
    courtyard: {
        center: 'market',
        positions: [
            [-9, -9], [-3, -9], [3, -9], [-9, 4], [-3, 4], [3, 4], [-11, -2]
        ],
        types: [
            ['courtyardHome', 'home'], ['storehouse', 'storage'], ['smithy', 'workshop'],
            ['marketStall', 'trade'], ['caravanLodge', 'hall'], ['shrine', 'special']
        ]
    },
    shelteredLine: {
        center: 'hearth',
        positions: [
            [-12, -4], [-6, -4], [0, -4], [6, -4], [-9, 4], [-3, 4], [3, 4]
        ],
        types: [
            ['insulatedHome', 'home'], ['foodStore', 'storage'], ['toolmaker', 'workshop'],
            ['tradingPost', 'trade'], ['longhouse', 'hall'], ['warmingHut', 'special']
        ]
    }
};

const V2_VILLAGE_LAYOUTS = {
    farmstead: {
        center: 'well',
        landmark: ['townHall', 'hall'],
        positions: [
            [-22, -18], [8, -20], [-26, 5], [10, 11], [-5, -28],
            [22, -4], [-12, 1], [-7, 17], [22, 17]
        ],
        types: [
            ['farmhouse', 'home'], ['barn', 'storage'], ['workshop', 'workshop'],
            ['bakery', 'trade'], ['stable', 'special'], ['cottage', 'home'],
            ['granary', 'storage'], ['orchardHouse', 'special']
        ]
    },
    courtyard: {
        center: 'market',
        landmark: ['caravanserai', 'hall'],
        positions: [
            [-17, -16], [-4, -16], [9, -16], [-17, 4], [-4, 4],
            [9, 4], [-27, -5], [20, -5], [-4, 16]
        ],
        types: [
            ['courtyardHome', 'home'], ['storehouse', 'storage'], ['smithy', 'workshop'],
            ['marketStall', 'trade'], ['shrine', 'special'], ['merchantHome', 'home'],
            ['warehouse', 'storage'], ['teaCourt', 'special']
        ]
    },
    shelteredLine: {
        center: 'hearth',
        landmark: ['longhouse', 'hall'],
        positions: [
            [-36, -5], [-23, -5], [-10, -5], [3, -5], [16, -5],
            [29, -5], [-29, 8], [-3, 8], [23, 8]
        ],
        types: [
            ['insulatedHome', 'home'], ['foodStore', 'storage'], ['toolmaker', 'workshop'],
            ['tradingPost', 'trade'], ['warmingHut', 'special'], ['snowCottage', 'home'],
            ['coldStore', 'storage'], ['watchHut', 'special']
        ]
    }
};

function createLegacyVillagePlan(rng, biome) {
    const layout = biome === BIOMES.DESERT ? 'courtyard' : (biome === BIOMES.SNOW ? 'shelteredLine' : 'farmstead');
    const template = VILLAGE_LAYOUTS[layout];
    const professionByPurpose = { home: 1, storage: 1, workshop: 0, trade: 2, hall: 3, special: 1 };
    const buildingCount = 4 + Math.floor(rng() * 4);
    const types = template.types.map(([type, purpose]) => ({ type, purpose }));
    for (let i = types.length - 1; i > 0; i--) {
        const j = Math.floor(rng() * (i + 1));
        [types[i], types[j]] = [types[j], types[i]];
    }

    const buildings = template.positions.slice(0, buildingCount).map(([dx, dz], index) => {
        const role = types[index % types.length];
        const isLarge = role.purpose === 'hall' || role.purpose === 'storage';
        const width = layout === 'courtyard' ? (isLarge ? 5 : 4) : (isLarge ? 6 : 5);
        const depth = layout === 'shelteredLine' ? 5 : (isLarge ? 6 : 5);
        return {
            dx,
            dz,
            width,
            depth,
            type: role.type,
            purpose: role.purpose,
            professionIdx: professionByPurpose[role.purpose]
        };
    });

    return { layout, center: template.center, buildings };
}

function createVillagePlan(rng, biome, generationVersion = 2) {
    if (generationVersion < 2) return createLegacyVillagePlan(rng, biome);
    const layout = biome === BIOMES.DESERT ? 'courtyard' : (biome === BIOMES.SNOW ? 'shelteredLine' : 'farmstead');
    const template = V2_VILLAGE_LAYOUTS[layout];
    const professionByPurpose = { home: 1, storage: 1, workshop: 0, trade: 2, hall: 3, special: 1 };
    const buildingCount = 6 + Math.floor(rng() * 4);
    const roles = template.types.map(([type, purpose]) => ({ type, purpose }));
    for (let i = roles.length - 1; i > 0; i--) {
        const j = Math.floor(rng() * (i + 1));
        [roles[i], roles[j]] = [roles[j], roles[i]];
    }

    const buildings = template.positions.slice(0, buildingCount).map(([baseDx, baseDz], index) => {
        const isLandmark = index === 0;
        const [landmarkType, landmarkPurpose] = template.landmark;
        const role = isLandmark
            ? { type: landmarkType, purpose: landmarkPurpose }
            : roles[(index - 1) % roles.length];
        const isLarge = role.purpose === 'storage' || role.purpose === 'hall';
        const width = isLandmark ? 11 : (isLarge ? 9 : 7);
        const depth = isLandmark ? (layout === 'shelteredLine' ? 9 : 12) : (isLarge ? 10 : 8);
        const residentCount = isLandmark || role.purpose === 'home' ? 2 : 1;
        const jitterX = layout === 'courtyard' ? 0 : Math.floor(rng() * 3) - 1;
        const jitterZ = layout === 'courtyard' ? 0 : Math.floor(rng() * 3) - 1;
        return {
            dx: baseDx + jitterX,
            dz: baseDz + jitterZ,
            width,
            depth,
            stories: isLandmark ? 2 : 1,
            isLandmark,
            residentCount,
            type: role.type,
            purpose: role.purpose,
            professionIdx: professionByPurpose[role.purpose]
        };
    });
    const penDirections = [
        { side: 'right', rect: building => ({ x: building.dx + building.width + 2, z: building.dz + 1, width: 6, depth: 5 }) },
        { side: 'left', rect: building => ({ x: building.dx - 8, z: building.dz + 1, width: 6, depth: 5 }) },
        { side: 'back', rect: building => ({ x: building.dx + 1, z: building.dz + building.depth + 2, width: 6, depth: 5 }) },
        { side: 'front', rect: building => ({ x: building.dx + 1, z: building.dz - 7, width: 6, depth: 5 }) }
    ];
    for (const building of buildings.filter(entry => entry.purpose === 'storage' || entry.purpose === 'special')) {
        const direction = penDirections.find(({ rect }) => {
            const pen = rect(building);
            return buildings.every(other => other === building ||
                pen.x + pen.width <= other.dx || other.dx + other.width <= pen.x ||
                pen.z + pen.depth <= other.dz || other.dz + other.depth <= pen.z);
        });
        if (!direction) continue;
        building.hasPen = true;
        building.penSide = direction.side;
        break;
    }

    return {
        layout,
        center: template.center,
        buildings,
        residentCount: buildings.reduce((sum, building) => sum + building.residentCount, 0)
    };
}

function spawnVillage(data, x, y, z, rng, worldX, worldZ, biome = BIOMES.PLAINS, variant = 0, generationVersion = 2) {
    const plan = createVillagePlan(rng, biome, generationVersion);
    const villageInfo = {
        cx: 0,
        cz: 0,
        layout: plan.layout,
        center: plan.center,
        generationVersion,
        residentCount: plan.residentCount || plan.buildings.length,
        houses: [],
        waypoints: [],
        chests: []
    };
    const styleKey = biome === BIOMES.DESERT ? 'desert' : (biome === BIOMES.SNOW ? 'snow' : (variant === 1 ? 'plainsFarm' : 'plainsClassic'));
    const styles = {
        plainsClassic: {
            path: 87, foundation: 85, floor: 26, wall: 26, roof: 85, roofEdge: 85,
            post: 5, threshold: 26, doorHeader: 26, wellRim: 85, wellBase: 85, wellPost: 5, wellRoof: 26
        },
        plainsFarm: {
            path: 87, foundation: 85, floor: 26, wall: 29, roof: 26, roofEdge: 5,
            post: 5, threshold: 26, doorHeader: 5, wellRim: 29, wellBase: 85, wellPost: 5, wellRoof: 88, market: true
        },
        desert: {
            path: 30, foundation: 30, floor: 30, wall: 30, roof: 19, roofEdge: 15,
            post: 15, threshold: 30, doorHeader: 15, wellRim: 82, wellBase: 30, wellPost: 15, wellRoof: 19, market: true
        },
        snow: {
            path: 78, foundation: 78, floor: 78, wall: 77, roof: 77, roofEdge: 77,
            post: 5, threshold: 78, doorHeader: 77, wellRim: 78, wellBase: 78, wellPost: 5, wellRoof: 77, igloo: true
        }
    };
    const style = styles[styleKey];
    const worldOffsetX = worldX - x;
    const worldOffsetZ = worldZ - z;
    const placeVillageChest = (localX, localY, localZ) => {
        setBlockLocal(data, localX, localY, localZ, 75);
        villageInfo.chests.push({
            x: localX,
            y: localY,
            z: localZ,
            role: 'village_supply',
            lootTable: `village_${plan.layout}`
        });
    };
    const clearAbove = (localX, localZ, fromY, height = 10) => {
        for (let py = fromY; py <= Math.min(CHUNK_HEIGHT - 1, fromY + height); py++) {
            setBlockLocal(data, localX, py, localZ, 0);
        }
    };
    const placeSupportedSurface = (localX, localZ, targetFootY, topBlock = style.path) => {
        const terrainFootY = getTerrainHeightAt(localX + worldOffsetX, localZ + worldOffsetZ);
        for (let py = Math.min(terrainFootY, targetFootY) - 1; py < targetFootY - 1; py++) {
            setBlockLocal(data, localX, py, localZ, style.foundation);
        }
        setBlockLocal(data, localX, targetFootY - 1, localZ, topBlock);
        clearAbove(localX, localZ, targetFootY, 3);
    };
    const getFootprintBaseY = (startWorldX, startWorldZ, width, depth) => {
        let baseY = -Infinity;
        for (let dx = 0; dx < width; dx++) {
            for (let dz = 0; dz < depth; dz++) {
                baseY = Math.max(baseY, getTerrainHeightAt(startWorldX + dx, startWorldZ + dz) - 1);
            }
        }
        return baseY;
    };

    const drawVillageCenter = () => {
        for (let dx = -3; dx <= 3; dx++) {
            for (let dz = -3; dz <= 3; dz++) {
                if (generationVersion >= 2) {
                    placeSupportedSurface(x + dx, z + dz, y, style.path);
                } else {
                    setBlockLocal(data, x + dx, y - 1, z + dz, style.path);
                    setBlockLocal(data, x + dx, y, z + dz, 0);
                    setBlockLocal(data, x + dx, y + 1, z + dz, 0);
                }
            }
        }
        if (generationVersion >= 2) {
            for (const [lampX, lampZ] of [[-4, -4], [4, -4], [-4, 4], [4, 4]]) {
                placeSupportedSurface(x + lampX, z + lampZ, y, style.path);
                setBlockLocal(data, x + lampX, y, z + lampZ, 102);
                setBlockLocal(data, x + lampX, y + 1, z + lampZ, 104);
            }
            for (const [benchX, benchZ] of [[-3, 0], [3, 0]]) {
                setBlockLocal(data, x + benchX, y, z + benchZ, 26);
            }
        }
        villageInfo.waypoints.push({ x, y, z, role: 'center' });

        if (plan.center === 'market') {
            for (const [mx, mz] of [[-3, -3], [2, -3], [-3, 2], [2, 2]]) {
                for (let py = y; py <= y + 2; py++) {
                    setBlockLocal(data, x + mx, py, z + mz, style.wellPost);
                    setBlockLocal(data, x + mx + 1, py, z + mz, style.wellPost);
                }
                setBlockLocal(data, x + mx, y + 3, z + mz, 19);
                setBlockLocal(data, x + mx + 1, y + 3, z + mz, 19);
                setBlockLocal(data, x + mx, y, z + mz + 1, 88);
                placeVillageChest(x + mx + 1, y, z + mz + 1);
            }
            return;
        }

        if (plan.center === 'hearth') {
            for (const [hx, hz] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
                setBlockLocal(data, x + hx, y, z + hz, style.wellRim);
            }
            setBlockLocal(data, x, y - 1, z, style.wellBase);
            setBlockLocal(data, x, y, z, 86);
            for (const [px, pz] of [[-3, -2], [3, -2], [-3, 2], [3, 2]]) {
                for (let py = y; py <= y + 2; py++) setBlockLocal(data, x + px, py, z + pz, style.wellPost);
            }
            for (let dx = -3; dx <= 3; dx++) {
                for (let dz = -2; dz <= 2; dz++) {
                    if (Math.abs(dx) === 3 || Math.abs(dz) === 2) {
                        setBlockLocal(data, x + dx, y + 3, z + dz, style.wellRoof);
                    }
                }
            }
            return;
        }

        for (let dx = -2; dx <= 2; dx++) {
            for (let dz = -2; dz <= 2; dz++) {
                const rim = Math.abs(dx) === 2 || Math.abs(dz) === 2;
                if (rim) {
                    setBlockLocal(data, x + dx, y, z + dz, style.wellRim);
                } else {
                    setBlockLocal(data, x + dx, y - 1, z + dz, style.wellBase);
                    setBlockLocal(data, x + dx, y, z + dz, 4);
                }
            }
        }
        for (const [px, pz] of [[-2, -2], [2, -2], [-2, 2], [2, 2]]) {
            for (let py = y + 1; py <= y + 3; py++) setBlockLocal(data, x + px, py, z + pz, style.wellPost);
        }
        for (let dx = -2; dx <= 2; dx++) {
            for (let dz = -2; dz <= 2; dz++) {
                const edge = Math.abs(dx) === 2 || Math.abs(dz) === 2;
                setBlockLocal(data, x + dx, y + 4, z + dz, edge ? style.roofEdge : style.wellRoof);
            }
        }
    };

    const decorateVillageBuilding = (startX, startZ, floorY, width, depth, building) => {
        const innerX = startX + 1;
        const innerZ = startZ + 1;
        if (building.purpose === 'home') {
            setBlockLocal(data, innerX, floorY + 1, innerZ, 38);
            setBlockLocal(data, innerX, floorY + 1, innerZ + 1, 39);
        } else if (building.purpose === 'storage') {
            placeVillageChest(innerX, floorY + 1, innerZ);
            if (biome === BIOMES.SNOW) {
                placeVillageChest(startX + width - 2, floorY + 1, innerZ);
            } else {
                setBlockLocal(data, startX + width - 2, floorY + 1, innerZ, 88);
            }
        } else if (building.purpose === 'workshop') {
            setBlockLocal(data, innerX, floorY + 1, innerZ, 28);
            setBlockLocal(data, startX + width - 2, floorY + 1, innerZ, 59);
        } else if (building.purpose === 'trade') {
            placeVillageChest(innerX, floorY + 1, innerZ);
            setBlockLocal(data, startX + width - 2, floorY + 1, innerZ, biome === BIOMES.DESERT ? 19 : 88);
        } else if (building.purpose === 'hall') {
            for (let tx = 1; tx < width - 1; tx++) {
                setBlockLocal(data, startX + tx, floorY + 1, startZ + Math.floor(depth / 2), 26);
            }
            setBlockLocal(data, startX + Math.floor(width / 2), floorY + 2, startZ + Math.floor(depth / 2), 101);
        } else {
            const marker = biome === BIOMES.DESERT ? 82 : (biome === BIOMES.SNOW ? 86 : 88);
            setBlockLocal(data, startX + Math.floor(width / 2), floorY + 1, startZ + Math.floor(depth / 2), marker);
        }
    };

    const drawSupportedPath = (startX, startZ, endX, endZ, startY, endY) => {
        const dx = endX - startX;
        const dz = endZ - startZ;
        const steps = Math.max(Math.abs(dx), Math.abs(dz));
        const widthAlongX = Math.abs(dz) >= Math.abs(dx);
        let previousY = startY;
        for (let step = 0; step <= steps; step++) {
            const t = steps > 0 ? step / steps : 0;
            const pathX = Math.round(startX + dx * t);
            const pathZ = Math.round(startZ + dz * t);
            const terrainY = getTerrainHeightAt(pathX + worldOffsetX, pathZ + worldOffsetZ);
            const intendedY = Math.round(startY + (endY - startY) * t);
            const desiredY = Math.max(terrainY, intendedY);
            const targetY = Math.max(previousY - 1, Math.min(previousY + 1, desiredY));
            for (let width = 0; width <= 1; width++) {
                const px = pathX + (widthAlongX ? width : 0);
                const pz = pathZ + (widthAlongX ? 0 : width);
                placeSupportedSurface(px, pz, targetY, style.path);
            }
            previousY = targetY;
        }
    };

    const decorateVillageExterior = (startX, startZ, floorY, width, depth, building) => {
        const accentZ = startZ + Math.min(depth - 2, 2);
        if (building.purpose === 'storage') {
            setBlockLocal(data, startX - 1, floorY, accentZ, 88);
        } else {
            placeVillageChest(startX - 1, floorY, accentZ);
        }

        if (!building.hasPen) return;
        const penX = building.penSide === 'left' ? startX - 8 : startX + (building.penSide === 'right' ? width + 2 : 1);
        const penZ = building.penSide === 'front' ? startZ - 7 : startZ + (building.penSide === 'back' ? depth + 2 : 1);
        const penWidth = 6;
        const penDepth = 5;
        for (let dx = 0; dx < penWidth; dx++) {
            for (let dz = 0; dz < penDepth; dz++) {
                placeSupportedSurface(penX + dx, penZ + dz, floorY + 1, biome === BIOMES.DESERT ? 7 : (biome === BIOMES.SNOW ? 11 : 1));
                const edge = dx === 0 || dx === penWidth - 1 || dz === 0 || dz === penDepth - 1;
                if (!edge) continue;
                const isGate = dz === 0 && dx === Math.floor(penWidth / 2);
                setBlockLocal(data, penX + dx, floorY + 1, penZ + dz, isGate ? 103 : 102);
            }
        }
        if (biome === BIOMES.PLAINS) {
            setBlockLocal(data, penX + 2, floorY + 1, penZ + 2, 43);
            setBlockLocal(data, penX + 4, floorY + 1, penZ + 2, 88);
        } else if (biome === BIOMES.DESERT) {
            setBlockLocal(data, penX + 3, floorY + 1, penZ + 2, 46);
            placeVillageChest(penX + 4, floorY + 1, penZ + 2);
        } else {
            setBlockLocal(data, penX + 3, floorY + 1, penZ + 2, 88);
        }
    };

    // Houses follow the biome-specific village plan.
    const buildIglooHouse = (hx, hz, houseW, houseD, ho, houseWorldX, houseWorldZ, building) => {
        const r = building.purpose === 'hall' ? 4 : 3;
        const cx0 = hx + Math.floor(houseW / 2);
        const cz0 = hz + Math.floor(houseD / 2);
        const centerWorldX = houseWorldX + Math.floor(houseW / 2);
        const centerWorldZ = houseWorldZ + Math.floor(houseD / 2);
        const floorY = getFootprintBaseY(centerWorldX - r, centerWorldZ - r, r * 2 + 1, r * 2 + 1);

        for (let dx = -r; dx <= r; dx++) {
            for (let dz = -r; dz <= r; dz++) {
                const terrainY = getTerrainHeightAt(centerWorldX + dx, centerWorldZ + dz);
                for (let fy = terrainY; fy < floorY; fy++) setBlockLocal(data, cx0 + dx, fy, cz0 + dz, style.foundation);
                setBlockLocal(data, cx0 + dx, floorY, cz0 + dz, style.floor);
                for (let dy = 1; dy <= r + 1; dy++) setBlockLocal(data, cx0 + dx, floorY + dy, cz0 + dz, 0);
            }
        }

        for (let dx = -r; dx <= r; dx++) {
            for (let dz = -r; dz <= r; dz++) {
                for (let dy = 1; dy <= r; dy++) {
                    const dist = Math.sqrt(dx * dx + dz * dz + dy * dy);
                    if (dist >= r - 0.7 && dist <= r + 0.5) {
                        setBlockLocal(data, cx0 + dx, floorY + dy, cz0 + dz, style.wall);
                    }
                }
            }
        }

        for (let dx = -(r - 1); dx <= r - 1; dx++) {
            for (let dz = -(r - 1); dz <= r - 1; dz++) {
                for (let dy = 1; dy <= r - 1; dy++) {
                    const roomRadius = r - 1;
                    if (dx * dx + dz * dz <= roomRadius * roomRadius) {
                        setBlockLocal(data, cx0 + dx, floorY + dy, cz0 + dz, 0);
                    }
                }
            }
        }

        const dirZ = ho.dz < 0 ? 1 : -1;
        const doorZ = cz0 + dirZ * r;
        const porchZ = doorZ + dirZ;
        for (let dz = 0; dz <= 2; dz++) {
            setBlockLocal(data, cx0, floorY, doorZ + dirZ * dz, style.path);
            setBlockLocal(data, cx0, floorY + 1, doorZ + dirZ * dz, 0);
            setBlockLocal(data, cx0, floorY + 2, doorZ + dirZ * dz, 0);
        }
        setBlockLocal(data, cx0, floorY + 1, doorZ, generationVersion >= 2 ? 33 : 0);
        setBlockLocal(data, cx0, floorY + 2, doorZ, generationVersion >= 2 ? 34 : 0);
        setBlockLocal(data, cx0, floorY, porchZ, style.path);
        setBlockLocal(data, cx0, floorY + 1, porchZ, 0);
        setBlockLocal(data, cx0, floorY + 2, porchZ, 0);
        decorateVillageBuilding(cx0 - r, cz0 - r, floorY, r * 2 + 1, r * 2 + 1, building);
        if (generationVersion >= 2) decorateVillageExterior(cx0 - r, cz0 - r, floorY, r * 2 + 1, r * 2 + 1, building);

        const home = { x: cx0, y: floorY + 1, z: cz0 };
        const door = { x: cx0, y: floorY + 1, z: doorZ };
        const porch = { x: cx0, y: floorY + 1, z: porchZ };
        villageInfo.houses.push({
            ...home,
            type: building.type,
            purpose: building.purpose,
            professionIdx: building.professionIdx,
            residentCount: building.residentCount || 1,
            isLandmark: !!building.isLandmark,
            home,
            door,
            porch,
            work: { ...home }
        });
        villageInfo.waypoints.push({ ...porch, role: 'porch' });
        return { pathStartX: cx0, pathStartZ: porchZ, floorY };
    };

    drawVillageCenter();

    for (const building of plan.buildings) {
        const ho = building;
        const hx = x + ho.dx, hz = z + ho.dz;
        const houseW = building.width;
        const houseD = building.depth;
        const houseH = building.stories === 2 ? 7 : 4;
        const houseWorldX = worldX + ho.dx;
        const houseWorldZ = worldZ + ho.dz;

        if (style.igloo && (generationVersion < 2 || !building.isLandmark)) {
            const igloo = buildIglooHouse(hx, hz, houseW, houseD, ho, houseWorldX, houseWorldZ, building);
            const pathStartX = igloo.pathStartX;
            const pathStartZ = igloo.pathStartZ;
            const toCenterX = x - pathStartX;
            const toCenterZ = z - pathStartZ;
            const pathEndX = Math.abs(toCenterX) >= Math.abs(toCenterZ) ? x - Math.sign(toCenterX || 1) * 3 : x;
            const pathEndZ = Math.abs(toCenterX) >= Math.abs(toCenterZ) ? z : z - Math.sign(toCenterZ || 1) * 3;
            if (generationVersion >= 2) {
                drawSupportedPath(pathStartX, pathStartZ, pathEndX, pathEndZ, igloo.floorY + 1, y);
            } else {
                const steps = Math.max(Math.abs(pathStartX - pathEndX), Math.abs(pathStartZ - pathEndZ));
                for (let step = 0; step <= steps; step++) {
                    const t = steps > 0 ? step / steps : 0;
                    const pathX = Math.round(pathStartX + (pathEndX - pathStartX) * t);
                    const pathZ = Math.round(pathStartZ + (pathEndZ - pathStartZ) * t);
                    const pathY = Math.max(y, Math.min(igloo.floorY, getTerrainHeightAt(pathX + worldOffsetX, pathZ + worldOffsetZ)));
                    setBlockLocal(data, pathX, pathY - 1, pathZ, style.path);
                    setBlockLocal(data, pathX, pathY, pathZ, 0);
                    setBlockLocal(data, pathX, pathY + 1, pathZ, 0);
                }
            }
            continue;
        }

        const floorY = getFootprintBaseY(houseWorldX, houseWorldZ, houseW, houseD);
        const wallY = floorY + 1;
        const roofY = wallY + houseH - (generationVersion >= 2 ? 0 : 1);

        // Boden: Planken auf eigener Haus-Hoehe, damit Hang-Haeuser nicht im Terrain versinken.
        for (let dx = 0; dx < houseW; dx++) {
            for (let dz = 0; dz < houseD; dz++) {
                const terrainY = getTerrainHeightAt(houseWorldX + dx, houseWorldZ + dz);
                for (let fy = terrainY; fy < floorY; fy++) {
                    setBlockLocal(data, hx + dx, fy, hz + dz, style.foundation); // COBBLESTONE Fundament
                }
                setBlockLocal(data, hx + dx, floorY - 1, hz + dz, style.foundation); // COBBLESTONE Fundament
                setBlockLocal(data, hx + dx, floorY, hz + dz, style.floor); // PLANKS Boden
                if (generationVersion >= 2) clearAbove(hx + dx, hz + dz, wallY, houseH + 6);
            }
        }

        // Wände: Holz-Planken mit Fenstern
        for (let dy = 0; dy < houseH; dy++) {
            for (let dx = 0; dx < houseW; dx++) {
                for (let dz = 0; dz < houseD; dz++) {
                    const isEdge = (dx === 0 || dx === houseW - 1 || dz === 0 || dz === houseD - 1);
                    if (generationVersion < 2 && dy === houseH - 1) {
                        setBlockLocal(data, hx + dx, wallY + dy, hz + dz, style.roof);
                    } else if (isEdge) {
                        const isMidX = dx > 1 && dx < houseW - 2;
                        const isMidZ = dz > 1 && dz < houseD - 2;
                        const windowLevel = dy === 1 || (generationVersion >= 2 && building.stories === 2 && dy === 5);
                        if (windowLevel && ((dx === 0 || dx === houseW - 1) && isMidZ || (dz === 0 || dz === houseD - 1) && isMidX)) {
                            setBlockLocal(data, hx + dx, wallY + dy, hz + dz, 32); // GLASS
                        } else {
                            setBlockLocal(data, hx + dx, wallY + dy, hz + dz, style.wall); // PLANKS
                        }
                    } else {
                        // Innenraum: Luft
                        setBlockLocal(data, hx + dx, wallY + dy, hz + dz, 0);
                    }
                }
            }
        }

        if (generationVersion >= 2 && building.stories === 2) {
            for (let dx = 1; dx < houseW - 1; dx++) {
                for (let dz = 1; dz < houseD - 1; dz++) {
                    const stairOpening = dx === Math.floor(houseW / 2) && dz >= houseD - 3;
                    if (!stairOpening) setBlockLocal(data, hx + dx, floorY + 4, hz + dz, style.floor);
                }
            }
        }

        // Eckpfeiler und Dachüberstand geben den Häusern eine klarere Silhouette.
        const corners = [[0, 0], [houseW - 1, 0], [0, houseD - 1], [houseW - 1, houseD - 1]];
        for (const [cx0, cz0] of corners) {
            for (let py = wallY; py < roofY; py++) {
                setBlockLocal(data, hx + cx0, py, hz + cz0, style.post); // WOOD
            }
        }
        const roofLayers = generationVersion >= 2 ? Math.ceil(Math.min(houseW, houseD) / 2) : 0;
        if (generationVersion >= 2) {
            for (let layer = 0; layer < roofLayers; layer++) {
                const minX = -1 + layer;
                const maxX = houseW - layer;
                const minZ = -1 + layer;
                const maxZ = houseD - layer;
                if (minX > maxX || minZ > maxZ) break;
                for (let dx = minX; dx <= maxX; dx++) {
                    for (let dz = minZ; dz <= maxZ; dz++) {
                        const edge = dx === minX || dx === maxX || dz === minZ || dz === maxZ;
                        if (edge || layer === roofLayers - 1) {
                            setBlockLocal(data, hx + dx, roofY + layer, hz + dz, layer === 0 ? style.roofEdge : style.roof);
                        }
                    }
                }
            }
        } else {
            for (let dx = -1; dx <= houseW; dx++) {
                for (let dz = -1; dz <= houseD; dz++) {
                    const isOverhang = dx === -1 || dx === houseW || dz === -1 || dz === houseD;
                    if (isOverhang) setBlockLocal(data, hx + dx, roofY, hz + dz, style.roofEdge);
                }
            }
        }

        // Tür (Lücke in der Wand richtung Brunnen)
        const doorDz = ho.dz < 0 ? houseD - 1 : 0;
        const doorDx = Math.floor(houseW / 2);
        setBlockLocal(data, hx + doorDx, wallY, hz + doorDz, generationVersion >= 2 ? 33 : 0);
        setBlockLocal(data, hx + doorDx, wallY + 1, hz + doorDz, generationVersion >= 2 ? 34 : 0);
        setBlockLocal(data, hx + doorDx, wallY + 2, hz + doorDz, style.doorHeader); // PLANKS Tuersturz
        const porchZ = doorDz === 0 ? hz - 1 : hz + houseD;
        setBlockLocal(data, hx + doorDx, floorY - 1, porchZ, style.path); // VILLAGE_PATH
        setBlockLocal(data, hx + doorDx, floorY, porchZ, style.threshold); // PLANKS Schwelle
        setBlockLocal(data, hx + doorDx, floorY + 1, porchZ, 0);
        if (generationVersion >= 2) {
            setBlockLocal(data, hx + doorDx - 1, wallY + 2, porchZ, style.roofEdge);
            setBlockLocal(data, hx + doorDx, wallY + 2, porchZ, style.roofEdge);
            setBlockLocal(data, hx + doorDx + 1, wallY + 2, porchZ, style.roofEdge);
            setBlockLocal(data, hx + doorDx - 1, wallY + 1, porchZ, 104);
            if (building.isLandmark || building.purpose === 'workshop') {
                const chimneyX = hx + houseW - 2;
                const chimneyZ = hz + houseD - 2;
                for (let chimneyY = roofY; chimneyY <= roofY + roofLayers + 1; chimneyY++) {
                    setBlockLocal(data, chimneyX, chimneyY, chimneyZ, style.foundation);
                }
            }
        }

        // Weg vom Haus zum Brunnen
        const pathStartX = hx + doorDx;
        const pathStartZ = porchZ;
        const toCenterX = x - pathStartX;
        const toCenterZ = z - pathStartZ;
        const pathEndX = Math.abs(toCenterX) >= Math.abs(toCenterZ) ? x - Math.sign(toCenterX || 1) * 3 : x;
        const pathEndZ = Math.abs(toCenterX) >= Math.abs(toCenterZ) ? z : z - Math.sign(toCenterZ || 1) * 3;
        if (generationVersion >= 2) {
            drawSupportedPath(pathStartX, pathStartZ, pathEndX, pathEndZ, floorY + 1, y);
        } else {
            const steps = Math.max(Math.abs(pathStartX - pathEndX), Math.abs(pathStartZ - pathEndZ));
            for (let step = 0; step <= steps; step++) {
                const t = steps > 0 ? step / steps : 0;
                const pathX = Math.round(pathStartX + (pathEndX - pathStartX) * t);
                const pathZ = Math.round(pathStartZ + (pathEndZ - pathStartZ) * t);
                const pathY = Math.max(y, Math.min(floorY, getTerrainHeightAt(pathX + worldOffsetX, pathZ + worldOffsetZ)));
                setBlockLocal(data, pathX, pathY - 1, pathZ, style.path);
                setBlockLocal(data, pathX, pathY, pathZ, 0);
                setBlockLocal(data, pathX, pathY + 1, pathZ, 0);
            }
        }
        setBlockLocal(data, hx + doorDx, floorY, porchZ, style.threshold); // PLANKS Schwelle nach Weg-Clear wiederherstellen
        setBlockLocal(data, hx + doorDx, floorY + 1, porchZ, 0);

        if (generationVersion >= 2) {
            const lampX = hx + Math.min(houseW - 2, doorDx + 1);
            placeSupportedSurface(lampX, porchZ, floorY + 1, style.path);
            setBlockLocal(data, lampX, floorY + 1, porchZ, 102);
            setBlockLocal(data, lampX, floorY + 2, porchZ, 104);
        }

        decorateVillageBuilding(hx, hz, floorY, houseW, houseD, building);
        if (generationVersion >= 2) decorateVillageExterior(hx, hz, floorY, houseW, houseD, building);

        const home = { x: hx + Math.floor(houseW / 2), y: floorY + 1, z: hz + Math.floor(houseD / 2) };
        const door = { x: hx + doorDx, y: wallY, z: hz + doorDz };
        const porch = { x: pathStartX, y: floorY + 1, z: pathStartZ };
        villageInfo.houses.push({
            ...home,
            type: building.type,
            purpose: building.purpose,
            professionIdx: building.professionIdx,
            residentCount: building.residentCount || 1,
            isLandmark: !!building.isLandmark,
            home,
            door,
            porch,
            work: { ...home }
        });
        villageInfo.waypoints.push({ ...porch, role: 'porch' });
    }

    return villageInfo;
}

function generateTerrain(cx, cz, buffer) {
    const data = new Uint8Array(buffer);
    data.fill(0);
    const rng = mulberry32(cx * 1000 + cz);
    const villageInfos = []; // Tier 3: gesammelte Dorf-Infos für NPC-Spawning
    const minecartInfos = [];
    const structureInfos = [];
    const chestInfos = [];
    const spawnerInfos = [];

    for (let x = 0; x < CHUNK_SIZE; x++) {
        for (let z = 0; z < CHUNK_SIZE; z++) {
            const wx = cx * CHUNK_SIZE + x, wz = cz * CHUNK_SIZE + z;
            const biome = getBiomeAt(wx, wz);
            const temperature = (Math.sin(wx * 0.01) + Math.cos(wz * 0.01)) * 0.5;
            const humidity = (Math.sin(wx * 0.01 + 500) + Math.cos(wz * 0.01 + 500)) * 0.5;
            const oceanFactor = getOceanDepthFactor(temperature, humidity);
            let baseH = noise2D(wx, wz) + 38;
            baseH -= oceanFactor * 22;
            if (biome === BIOMES.DESERT) baseH += Math.sin(wx * 0.2) * 2;
            const h = Math.floor(baseH);
            const island = getFloatingIslandAt(wx, wz);

            for (let y = 0; y < CHUNK_HEIGHT; y++) {
                const idx = (y * CHUNK_SIZE * CHUNK_SIZE) + (z * CHUNK_SIZE) + x;
                if (y === 0) { data[idx] = 20; continue; }
                if (island) {
                    if (y >= island.y && y < island.y + island.thick) {
                        data[idx] = (y === island.y + island.thick - 1) ? 1 : 2;
                        continue;
                    } else if (y >= island.y - 7 && y < island.y) {
                        const hasVines = mulberry32(wx * 333 + wz * 444)() < 0.25;
                        if (hasVines) {
                            const dropLength = 3 + Math.floor(mulberry32(wx * 555 + wz * 666)() * 5);
                            if (island.y - y <= dropLength) {
                                data[idx] = (biome === BIOMES.SNOW) ? 12 : 6;
                                continue;
                            }
                        }
                    }
                }
                if (y === 1 && rng() < 0.5) { data[idx] = 20; continue; }
                if (y < h - 4) {
                    data[idx] = 3;
                    // Erz-Generierung im Stone-Layer
                    if (y > 1 && y < h - 5) {
                        const oreRng = mulberry32(wx * 7411 + wz * 3319 + y * 1237);
                        const r = oreRng();
                        if (r < 0.018) data[idx] = 56;       // COAL_ORE (häufig, alle Tiefen)
                        else if (r < 0.028 && y < 24) data[idx] = 57; // IRON_ORE (mittel, bis y<24)
                        else if (r < 0.033 && y < 14) data[idx] = 58; // GOLD_ORE (selten, tief)
                    }
                }
                else if (y < h - 1) data[idx] = (biome === BIOMES.DESERT) ? 7 : 2;
                else if (y === h - 1) {
                    let surfaceBlock;
                    if (biome === BIOMES.SNOW) surfaceBlock = 11;
                    else if (biome === BIOMES.DESERT || biome === BIOMES.OCEAN) surfaceBlock = 7;
                    else surfaceBlock = 1;
                    data[idx] = getTransitionSurfaceBlock(wx, wz, biome, surfaceBlock);
                } else if (y >= h && y <= WATER_LEVEL) {
                    data[idx] = (biome === BIOMES.SNOW && y === WATER_LEVEL) ? 12 : 4;
                } else if (y === CLOUD_HEIGHT) {
                    const cloudN = (Math.sin(wx * 0.1) + Math.cos(wz * 0.1)) * 0.5;
                    const cloudLarge = (Math.sin(wx * 0.04) + Math.cos(wz * 0.04)) * 0.5;
                    if (cloudLarge > 0.88 || (cloudLarge > 0.62 && cloudN > 0.28) || (cloudN > 0.74 && rng() < 0.45)) data[idx] = 8;
                } else data[idx] = 0;
            }

            // Seagrass
            if (h <= WATER_LEVEL - 3 && rng() < 0.15) {
                const seagrassY = Math.floor(h) + 1;
                if (seagrassY <= WATER_LEVEL) {
                    data[(seagrassY * CHUNK_SIZE * CHUNK_SIZE) + (z * CHUNK_SIZE) + x] = 54;
                }
            }

            if (h > WATER_LEVEL + 1) {
                const surfIdx = (h * CHUNK_SIZE * CHUNK_SIZE) + (z * CHUNK_SIZE) + x;
                const surfaceIndex = ((h - 1) * CHUNK_SIZE * CHUNK_SIZE) + (z * CHUNK_SIZE) + x;
                const isSnowLandscape = biome === BIOMES.SNOW || data[surfaceIndex] === 11;
                if (biome === BIOMES.PLAINS && !isSnowLandscape) {
                    const plant = choosePlainsVegetation(wx, wz, rng);
                    if (plant) data[surfIdx] = plant;
                }
                if (biome === BIOMES.DESERT) {
                    const r = rng();
                    if (r < 0.01) {
                        const ch = 1 + Math.floor(rng() * 3);
                        for (let cy = 0; cy < ch; cy++) {
                            if (h + cy < CHUNK_HEIGHT) data[((h + cy) * CHUNK_SIZE * CHUNK_SIZE) + (z * CHUNK_SIZE) + x] = 45;
                        }
                    } else if (r < 0.03) data[surfIdx] = 46;
                }
                if (biome === BIOMES.JUNGLE) {
                    const r = rng();
                    const lush = meadowPatch(wx + 100, wz - 60);
                    if (r < 0.16 + Math.max(0, lush) * 0.08) data[surfIdx] = 50;
                    else if (r < 0.22) data[surfIdx] = rng() < 0.7 ? 43 : 52;
                    else if (r < 0.25) data[surfIdx] = rng() < 0.5 ? 47 : 48;
                    else if (r < 0.29 && lush > 0.25) data[surfIdx] = 44;
                }
                if (isSnowLandscape) {
                    const snowFeatureRng = mulberry32(Math.imul(wx, 374761393) ^ Math.imul(wz, 668265263));
                    const snowFeatureRoll = snowFeatureRng();
                    if (snowFeatureRoll < 0.018) spawnSnowRock(data, x, h, z, wx, wz);
                    else if (snowFeatureRoll < 0.03) spawnIceMound(data, x, h, z, wx, wz);
                    else if (snowFeatureRoll < 0.06) data[surfIdx] = 46;
                }
                if (isSnowLandscape) {
                    const snowPlantRoll = rng();
                    if (data[surfIdx] === 0 && snowPlantRoll < 0.012) {
                        data[surfIdx] = rng() < 0.7 ? 46 : 44;
                    }
                }
                if (h === WATER_LEVEL + 1 && (biome === BIOMES.PLAINS || biome === BIOMES.JUNGLE)) {
                    const isShore = rng() < 0.08;
                    if (isShore) {
                        const sh = 1 + Math.floor(rng() * 3);
                        for (let sy = 0; sy < sh; sy++) {
                            if (h + sy < CHUNK_HEIGHT) data[((h + sy) * CHUNK_SIZE * CHUNK_SIZE) + (z * CHUNK_SIZE) + x] = 49;
                        }
                    }
                }
                const treeBiome = isSnowLandscape ? BIOMES.SNOW : biome;
                const tc = (treeBiome === BIOMES.JUNGLE) ? 0.08 : (treeBiome === BIOMES.PLAINS) ? 0.015 : (treeBiome === BIOMES.SNOW) ? 0.0015 : 0;
                if (rng() < tc) spawnTree(data, x, h, z, treeBiome, rng, wx, wz);
                if (biome === BIOMES.DESERT && rng() < 0.008 && canSpawnPalmAt(wx, wz, h)) {
                    spawnPalm(data, x, h, z, wx, wz);
                }
            }
        }
    }

    frostSnowyTreeCanopies(data, cx, cz);
    drawVillageRoads(data, cx, cz);

    // Prozedurale Strukturen: Im 3×3-Nachbar-Chunk-Bereich prüfen, ob eine Struktur startet,
    // die in diesen Chunk hineinragt. Jede Struktur wird deterministisch am Quell-Chunk platziert.
    const structureSourceRadius = WORLD_GENERATION_VERSION >= 2 ? 3 : 1;
    for (let scx = cx - structureSourceRadius; scx <= cx + structureSourceRadius; scx++) {
        for (let scz = cz - structureSourceRadius; scz <= cz + structureSourceRadius; scz++) {
            const srng = mulberry32(scx * 88317 + scz * 23497);
            const wx0 = scx * CHUNK_SIZE, wz0 = scz * CHUNK_SIZE;

            // Verlassene Mine (Spawn-Chance 10%, nur in Plains/Jungle/Snow)
            if (WORLD_GENERATION_VERSION < 2 && srng() < 0.10) {
                const mx = wx0 + Math.floor(srng() * CHUNK_SIZE);
                const mz = wz0 + Math.floor(srng() * CHUNK_SIZE);
                const mb = getBiomeAt(mx, mz);
                if (mb !== BIOMES.DESERT && mb !== BIOMES.OCEAN) {
                    const mh = Math.floor(noise2D(mx, mz) + 38);
                    if (mh > WATER_LEVEL) {
                        const my = Math.max(4, mh - 5 - Math.floor(srng() * 3));
                        // Lokale Koordinaten im aktuellen Chunk
                        const lx = mx - cx * CHUNK_SIZE;
                        const lz = mz - cz * CHUNK_SIZE;
                        const mineRng = mulberry32((mx * 734287) ^ (mz * 912931) ^ 271828);
                        const minePlan = spawnMine(data, lx, my, lz, mh - 1, mineRng, mb);
                        if (scx === cx && scz === cz) {
                            const entrance = minePlan.modules.find(module => module.id === 'entrance');
                            const approach = minePlan.modules.find(module => module.id === 'approach');
                            minecartInfos.push({
                                id: `minecart:${mx},${my},${mz}`,
                                x: mx + approach.x,
                                y: my,
                                z: mz + approach.z,
                                direction: {
                                    x: Math.sign(approach.x - entrance.x),
                                    z: Math.sign(approach.z - entrance.z)
                                }
                            });
                        }
                    }
                }
            }

            // Wüstentempel (Spawn-Chance 7%, nur in Desert)
            if (srng() < 0.07) {
                const tx = wx0 + 5 + Math.floor(srng() * (CHUNK_SIZE - 10));
                const tz = wz0 + 5 + Math.floor(srng() * (CHUNK_SIZE - 10));
                const templePlacement = getDesertTemplePlacement(tx, tz);
                if (templePlacement) {
                    const lx = tx - cx * CHUNK_SIZE;
                    const lz = tz - cz * CHUNK_SIZE;
                    spawnDesertTemple(data, lx, templePlacement.baseY, lz, tx, tz);
                }
            }

            // Iglu (Spawn-Chance 3%, nur in Snow)
            if (srng() < 0.03) {
                const ix = wx0 + 5 + Math.floor(srng() * (CHUNK_SIZE - 10));
                const iz = wz0 + 5 + Math.floor(srng() * (CHUNK_SIZE - 10));
                if (getBiomeAt(ix, iz) === BIOMES.SNOW) {
                    const ih = Math.floor(noise2D(ix, iz) + 38);
                    if (ih > WATER_LEVEL) {
                        const lx = ix - cx * CHUNK_SIZE;
                        const lz = iz - cz * CHUNK_SIZE;
                        spawnIgloo(data, lx, ih, lz);
                    }
                }
            }

            // Legacy dungeon generation remains available only for worldgen-v1 saves.
            if (WORLD_GENERATION_VERSION < 2) {
            // Dungeon (Tier 3): 5% Chance, flach unter der Oberflaeche, Plains/Jungle/Snow
            if (srng() < 0.05) {
                const dx = wx0 + 6 + Math.floor(srng() * (CHUNK_SIZE - 12));
                const dz = wz0 + 6 + Math.floor(srng() * (CHUNK_SIZE - 12));
                const db = getBiomeAt(dx, dz);
                if (db === BIOMES.PLAINS || db === BIOMES.JUNGLE || db === BIOMES.SNOW) {
                    const surfaceY = getTerrainHeightAt(dx, dz);
                    const dungeonDepth = 10 + Math.floor(srng() * 5);
                    const dungeonY = Math.max(18, surfaceY - dungeonDepth);
                    const lx = dx - cx * CHUNK_SIZE;
                    const lz = dz - cz * CHUNK_SIZE;
                    const dungeonRng = mulberry32((dx * 614891) ^ (dz * 982451) ^ 161803);
                    spawnDungeon(data, lx, dungeonY, lz, dungeonRng, db);

                    if (surfaceY > WATER_LEVEL + 1) {
                        spawnDungeonMarker(data, lx, surfaceY, lz);
                        spawnDungeonEntrance(data, lx, dungeonY, lz, surfaceY);
                    }
                }
            }
            }

            // NPC-Dorf (Tier 3): biome-specific villages in plains, desert and snow.
            // Dörfer sind größer als ein Chunk, deshalb werden auch Nachbar-Quellchunks geprüft,
            // damit Häuser/Fundamente/Dächer an Chunkgrenzen nicht abgeschnitten schweben.
            const village = getVillageCandidate(scx, scz, WORLD_GENERATION_VERSION);
            if (village) {
                const lx = village.x - cx * CHUNK_SIZE;
                const lz = village.z - cz * CHUNK_SIZE;
                const villageRng = mulberry32((village.x * 428759) ^ (village.z * 756839) ^ 314159);
                const vInfo = spawnVillage(data, lx, village.baseY, lz, villageRng, village.x, village.z, village.biome, village.variant, WORLD_GENERATION_VERSION);
                // Welt-Koordinaten für NPC-Spawn
                if (scx === cx && scz === cz) {
                    vInfo.cx = cx;
                    vInfo.cz = cz;
                    vInfo.id = `village:${cx},${cz}`;
                    const toWorldPoint = point => {
                        if (!point) return point;
                        point.x += cx * CHUNK_SIZE;
                        point.z += cz * CHUNK_SIZE;
                        return point;
                    };
                    vInfo.houses.forEach(h => {
                        toWorldPoint(h);
                        toWorldPoint(h.home);
                        toWorldPoint(h.door);
                        toWorldPoint(h.porch);
                        toWorldPoint(h.work);
                    });
                    vInfo.waypoints.forEach(toWorldPoint);
                    vInfo.chests.forEach(chest => {
                        toWorldPoint(chest);
                        chest.villageId = vInfo.id;
                    });
                    villageInfos.push(vInfo);
                    chestInfos.push(...vInfo.chests);
                }
            }
        }
    }

    if (WORLD_GENERATION_VERSION >= 2) {
        const underground = generateUndergroundStructures({
            chunk: { cx, cz, data },
            world: {
                seed: 0,
                version: WORLD_GENERATION_VERSION,
                chunkSize: CHUNK_SIZE,
                chunkHeight: CHUNK_HEIGHT,
                waterLevel: WATER_LEVEL
            },
            terrain: {
                biomeAt: getBiomeAt,
                heightAt: getTerrainHeightAt
            }
        });
        structureInfos.push(...underground.structures);
        chestInfos.push(...underground.chests);
        spawnerInfos.push(...underground.spawners);
        for (const entity of underground.entities) {
            if (entity.kind === 'minecart') minecartInfos.push(entity);
        }
    }

    return { data, villageInfos, minecartInfos, structureInfos, chestInfos, spawnerInfos };
}

// ============================================================
// Meshing + Ambient Occlusion
// ============================================================

// Block-Lookup über 5 Chunk-Daten (center + 4 Nachbarn)
function makeGetBlock(centerData, neighbors, cx, cz) {
    // neighbors: { 'cx-1,cz': data, 'cx+1,cz': data, 'cx,cz-1': data, 'cx,cz+1': data }
    return function getBlock(x, y, z) {
        if (y < 0 || y >= CHUNK_HEIGHT) return 0;
        const bcx = Math.floor(x / CHUNK_SIZE);
        const bcz = Math.floor(z / CHUNK_SIZE);
        const lx = x - bcx * CHUNK_SIZE;
        const lz = z - bcz * CHUNK_SIZE;
        let data;
        if (bcx === cx && bcz === cz) {
            data = centerData;
        } else {
            const key = bcx + ',' + bcz;
            data = neighbors[key];
        }
        if (!data) return -1;
        return data[(y * CHUNK_SIZE * CHUNK_SIZE) + (lz * CHUNK_SIZE) + lx];
    };
}

// Prüft ob ein Block "solid" ist (für AO-Berechnung)
function isSolidForAO(blockType) {
    if (blockType <= 0) return false;
    // Wasser, Pflanzen, Wolken etc. erzeugen kein AO
    return !TRANSPARENT_IDS.has(blockType);
}

function buildMesh(cx, cz, getBlock, isWater, blockMeta) {
    blockMeta = blockMeta || {};
    // Pre-allokierte Arrays (dynamisch, da wir die Größe nicht vorhersagen können)
    const pos = [];
    const col = [];
    const norm = [];
    const idx = [];
    const uv = [];
    const sway = [];
    // atlasUV: pro Vertex 2 Floats. Für Special-Blocks (Pflanzen/Türen/Betten/AO-Faces): (-1,-1)
    //          → Shader nutzt vMapUv direkt. Für greedy-merged Würfel-Faces: (cellU0, cellV0)
    //          → Shader macht fract()-Tiling innerhalb der Atlas-Zelle.
    const atlasUV = [];
    let vc = 0;

    // Greedy-Meshing-Tracker: pro Face-Richtung (6) sammeln wir hier die "fully bright"
    // (AO=3 an allen 4 Vertices) Würfel-Faces. Diese werden NACH dem voxel-Loop greedy-gemerged.
    // Faces mit AO-Darkening werden direkt im voxel-Loop emittiert (kein Merging — AO ist per-Vertex,
    // greedy-Merging würde AO-Diskontinuitäten erzeugen).
    //
    // greedyMasks[fi] ist ein Map<sliceIndex, Int16Array(uMax*vMax)>. Eintrag = type*256 + texIdx + 1
    // (0 = nicht mergebar, > 0 = mergebar mit dieser Type/Tex-Kombi).
    const greedyMasks = [new Map(), new Map(), new Map(), new Map(), new Map(), new Map()];
    const FACE_AXIS_INFO = [
        { axis: 2, sign:  1, uAxis: 0, vAxis: 1 }, // +Z
        { axis: 2, sign: -1, uAxis: 0, vAxis: 1 }, // -Z
        { axis: 0, sign: -1, uAxis: 2, vAxis: 1 }, // -X
        { axis: 0, sign:  1, uAxis: 2, vAxis: 1 }, // +X
        { axis: 1, sign:  1, uAxis: 0, vAxis: 2 }, // +Y
        { axis: 1, sign: -1, uAxis: 0, vAxis: 2 }  // -Y
    ];

    for (let y = 0; y < CHUNK_HEIGHT; y++) {
        for (let z = 0; z < CHUNK_SIZE; z++) {
            for (let x = 0; x < CHUNK_SIZE; x++) {
                const wx = cx * CHUNK_SIZE + x;
                const wz = cz * CHUNK_SIZE + z;
                const t = getBlock(wx, y, wz);
                const blockType = t;
                if (blockType === 0 || (blockType === 4) !== isWater) continue;

                // Farb-Berechnung
                const bcHex = BLOCK_COLORS[blockType] || 0xffffff;
                let bcR = ((bcHex >> 16) & 0xff) / 255;
                let bcG = ((bcHex >> 8) & 0xff) / 255;
                let bcB = (bcHex & 0xff) / 255;

                const rng = mulberry32(x * 12 + y * 34 + z * 56 + cx * 78 + cz * 90);
                const variation = 0.9 + rng() * 0.2;
                bcR *= variation; bcG *= variation; bcB *= variation;

                // Gras/Holz: helle Vertex-Color für unverfälschte Atlas-Textur.
                if (blockType === 1 || LOG_IDS.has(blockType)) {
                    const gVar = 0.85 + rng() * 0.3;
                    bcR = gVar; bcG = gVar; bcB = gVar;
                }

                // Wasser: Einheitliche Farbe
                if (blockType === 4) {
                    bcR = ((BLOCK_COLORS[4] >> 16) & 0xff) / 255;
                    bcG = ((BLOCK_COLORS[4] >> 8) & 0xff) / 255;
                    bcB = (BLOCK_COLORS[4] & 0xff) / 255;
                }

                // Painterly atlas colors are already authored; keep only a restrained
                // per-block value variation instead of multiplying by legacy material tints.
                if (PAINTERLY_MATERIAL_IDS.has(blockType)) {
                    const authoredVariation = 0.94 + rng() * 0.12;
                    bcR = authoredVariation;
                    bcG = authoredVariation;
                    bcB = authoredVariation;
                }

                // Helper: push atlasUV-Sentinel (-1,-1) für N Vertices (Special-Blocks ohne Tiling)
                const pushAtlasSentinel = (n) => { for (let i = 0; i < n; i++) atlasUV.push(-1, -1); };

                const pushBox = (x0, y0, z0, x1, y1, z1, texIdx = BLOCK_TEX[blockType] || 0) => {
                    const u0 = (texIdx % 16) / 16;
                    const v0 = 1 - (Math.floor(texIdx / 16) + 1) / 16;
                    const u1 = u0 + 1 / 16;
                    const v1 = v0 + 1 / 16;
                    const faces = [
                        [[x0,y0,z1],[x1,y0,z1],[x1,y1,z1],[x0,y1,z1],[0,0,1]],
                        [[x1,y0,z0],[x0,y0,z0],[x0,y1,z0],[x1,y1,z0],[0,0,-1]],
                        [[x0,y0,z0],[x0,y0,z1],[x0,y1,z1],[x0,y1,z0],[-1,0,0]],
                        [[x1,y0,z1],[x1,y0,z0],[x1,y1,z0],[x1,y1,z1],[1,0,0]],
                        [[x0,y1,z1],[x1,y1,z1],[x1,y1,z0],[x0,y1,z0],[0,1,0]],
                        [[x0,y0,z0],[x1,y0,z0],[x1,y0,z1],[x0,y0,z1],[0,-1,0]]
                    ];
                    for (const face of faces) {
                        const st = vc;
                        for (let vertex = 0; vertex < 4; vertex++) {
                            pos.push(...face[vertex]);
                            col.push(bcR, bcG, bcB);
                            norm.push(...face[4]);
                        }
                        uv.push(u0,v0, u1,v0, u1,v1, u0,v1);
                        sway.push(0,0,0,0);
                        pushAtlasSentinel(4);
                        idx.push(st,st+1,st+2, st,st+2,st+3);
                        vc += 4;
                    }
                };

                if (blockType === 102) {
                    pushBox(x + 0.36, y, z + 0.36, x + 0.64, y + 1, z + 0.64);
                    const neighbors = [
                        [0, -1, x + 0.43, z, x + 0.57, z + 0.5],
                        [0, 1, x + 0.43, z + 0.5, x + 0.57, z + 1],
                        [-1, 0, x, z + 0.43, x + 0.5, z + 0.57],
                        [1, 0, x + 0.5, z + 0.43, x + 1, z + 0.57]
                    ];
                    for (const [ndx, ndz, x0, z0, x1, z1] of neighbors) {
                        const neighbor = getBlock(wx + ndx, y, wz + ndz);
                        if (neighbor !== 102 && neighbor !== 103) continue;
                        pushBox(x0, y + 0.28, z0, x1, y + 0.43, z1);
                        pushBox(x0, y + 0.67, z0, x1, y + 0.82, z1);
                    }
                    continue;
                }

                if (blockType === 103) {
                    const metadata = blockMeta[wx + ',' + y + ',' + wz] || 0;
                    const alongX = (metadata & 1) === 0;
                    const isOpen = (metadata & 4) !== 0;
                    if (alongX) {
                        pushBox(x + 0.04, y, z + 0.38, x + 0.18, y + 1, z + 0.62);
                        pushBox(x + 0.82, y, z + 0.38, x + 0.96, y + 1, z + 0.62);
                        if (isOpen) {
                            pushBox(x + 0.09, y + 0.3, z + 0.5, x + 0.23, y + 0.44, z + 1.18);
                            pushBox(x + 0.09, y + 0.68, z + 0.5, x + 0.23, y + 0.82, z + 1.18);
                        } else {
                            pushBox(x + 0.16, y + 0.3, z + 0.43, x + 0.84, y + 0.44, z + 0.57);
                            pushBox(x + 0.16, y + 0.68, z + 0.43, x + 0.84, y + 0.82, z + 0.57);
                        }
                    } else {
                        pushBox(x + 0.38, y, z + 0.04, x + 0.62, y + 1, z + 0.18);
                        pushBox(x + 0.38, y, z + 0.82, x + 0.62, y + 1, z + 0.96);
                        if (isOpen) {
                            pushBox(x + 0.5, y + 0.3, z + 0.09, x + 1.18, y + 0.44, z + 0.23);
                            pushBox(x + 0.5, y + 0.68, z + 0.09, x + 1.18, y + 0.82, z + 0.23);
                        } else {
                            pushBox(x + 0.43, y + 0.3, z + 0.16, x + 0.57, y + 0.44, z + 0.84);
                            pushBox(x + 0.43, y + 0.68, z + 0.16, x + 0.57, y + 0.82, z + 0.84);
                        }
                    }
                    continue;
                }

                if (blockType === 104) {
                    pushBox(x + 0.28, y + 0.12, z + 0.28, x + 0.72, y + 0.78, z + 0.72);
                    pushBox(x + 0.2, y + 0.78, z + 0.2, x + 0.8, y + 0.9, z + 0.8, 81);
                    continue;
                }

                // ==============================
                // FACKEL (Boden oder Wand)
                // ==============================
                if (blockType === 101) {
                    const mount = blockMeta[wx + ',' + y + ',' + wz] || 0;
                    const bottom = [x + 0.5, y, z + 0.5];
                    const top = [x + 0.5, y + 0.86, z + 0.5];
                    if (mount === 1) {
                        bottom[0] = x + 0.08; bottom[1] = y + 0.2;
                        top[0] = x + 0.27; top[1] = y + 0.92;
                    } else if (mount === 2) {
                        bottom[0] = x + 0.92; bottom[1] = y + 0.2;
                        top[0] = x + 0.73; top[1] = y + 0.92;
                    } else if (mount === 3) {
                        bottom[2] = z + 0.08; bottom[1] = y + 0.2;
                        top[2] = z + 0.27; top[1] = y + 0.92;
                    } else if (mount === 4) {
                        bottom[2] = z + 0.92; bottom[1] = y + 0.2;
                        top[2] = z + 0.73; top[1] = y + 0.92;
                    }

                    const axis = [top[0] - bottom[0], top[1] - bottom[1], top[2] - bottom[2]];
                    const axisLength = Math.hypot(axis[0], axis[1], axis[2]) || 1;
                    axis[0] /= axisLength; axis[1] /= axisLength; axis[2] /= axisLength;
                    const sides = mount === 1 || mount === 2
                        ? [[0, 0, 1], [axis[1], -axis[0], 0]]
                        : mount === 3 || mount === 4
                            ? [[1, 0, 0], [0, axis[2], -axis[1]]]
                            : [[1, 0, 0], [0, 0, 1]];
                    const texIdx = BLOCK_TEX[101] || 200;
                    const u0 = (texIdx % 16) / 16, v0 = 1 - (Math.floor(texIdx / 16) + 1) / 16;
                    const u1 = u0 + 1 / 16, v1 = v0 + 1 / 16;

                    for (const side of sides) {
                        const sideLength = Math.hypot(side[0], side[1], side[2]) || 1;
                        const sx = side[0] / sideLength * 0.13;
                        const sy = side[1] / sideLength * 0.13;
                        const sz = side[2] / sideLength * 0.13;
                        const st = vc;
                        pos.push(
                            bottom[0] - sx, bottom[1] - sy, bottom[2] - sz,
                            bottom[0] + sx, bottom[1] + sy, bottom[2] + sz,
                            top[0] + sx, top[1] + sy, top[2] + sz,
                            top[0] - sx, top[1] - sy, top[2] - sz
                        );
                        col.push(1,1,1, 1,1,1, 1,1,1, 1,1,1);
                        const nx = side[1] * axis[2] - side[2] * axis[1];
                        const ny = side[2] * axis[0] - side[0] * axis[2];
                        const nz = side[0] * axis[1] - side[1] * axis[0];
                        norm.push(nx,ny,nz, nx,ny,nz, nx,ny,nz, nx,ny,nz);
                        uv.push(u0,v0, u1,v0, u1,v1, u0,v1);
                        sway.push(0,0,0,0);
                        pushAtlasSentinel(4);
                        idx.push(st,st+1,st+2, st,st+2,st+3, st+2,st+1,st, st+3,st+2,st);
                        vc += 4;
                    }
                    continue;
                }

                // ==============================
                // MINENGLEIS (flach, aus Nachbarn ausgerichtet)
                // ==============================
                if (blockType === 80) {
                    const style = getMineRailStyle(wx, y, wz, getBlock);
                    const texIdx = style.kind === 'curve'
                        ? 251
                        : style.kind === 'junction'
                            ? 252
                            : style.kind === 'crossing'
                                ? 253
                                : painterlyTextureFor(80, null, wx, y, wz, BLOCK_TEX[80] || 80);
                    const u0 = (texIdx % 16) / 16;
                    const v0 = 1 - (Math.floor(texIdx / 16) + 1) / 16;
                    const u1 = u0 + 1 / 16;
                    const v1 = v0 + 1 / 16;
                    const railUVs = rotateMineRailUVs(u0, v0, u1, v1, style.rotation);
                    const inset = 0.02;
                    const railY = y + 0.08;
                    const st = vc;
                    pos.push(
                        x + inset, railY, z + 1 - inset,
                        x + 1 - inset, railY, z + 1 - inset,
                        x + 1 - inset, railY, z + inset,
                        x + inset, railY, z + inset
                    );
                    col.push(bcR,bcG,bcB, bcR,bcG,bcB, bcR,bcG,bcB, bcR,bcG,bcB);
                    norm.push(0,1,0, 0,1,0, 0,1,0, 0,1,0);
                    uv.push(...railUVs);
                    sway.push(0,0,0,0);
                    pushAtlasSentinel(4);
                    idx.push(st,st+1,st+2, st,st+2,st+3);
                    vc += 4;
                    continue;
                }

                // ==============================
                // 2D-Pflanzen (Stern-Mesh)
                // ==============================
                if (PLANT_2D_IDS.has(blockType)) {
                    const rng2 = mulberry32(x * 123 + y * 456 + z * 789 + cx * 101 + cz * 202);
                    const offX = (rng2() - 0.5) * 0.4;
                    const offZ = (rng2() - 0.5) * 0.4;

                    let scaleY;
                    if (blockType === 44) scaleY = 0.4 + rng2() * 0.3;
                    else if (blockType === 50) scaleY = 0.5 + rng2() * 0.3;
                    else if (blockType === 47 || blockType === 48) scaleY = 0.3 + rng2() * 0.2;
                    else if (blockType === 9 || blockType === 10) scaleY = 0.5 + rng2() * 0.3;
                    else if (blockType === 43 || blockType === 52) scaleY = 0.8 + rng2() * 0.5;
                    else if (blockType === 46) scaleY = 0.7 + rng2() * 0.6;
                    else if (blockType === 49) scaleY = 1.0 + rng2() * 0.6;
                    else if (blockType === 54) scaleY = 0.6 + rng2() * 0.4;
                    else scaleY = 0.7 + rng2() * 0.5;

                    let scaleX = 1.0;
                    if (blockType === 44) scaleX = 0.55 + rng2() * 0.65;
                    else if (blockType === 50) scaleX = 0.75 + rng2() * 0.45;
                    else if (blockType === 9 || blockType === 10) scaleX = 0.55 + rng2() * 0.45;
                    else if (blockType === 43 || blockType === 52) scaleX = 0.9 + rng2() * 0.35;
                    else if (blockType === 46) scaleX = 0.7 + rng2() * 0.5;

                    // Weiße Vertex-Color für Textur-Atlas
                    const pVar = 0.84 + rng2() * 0.28;
                    let pR = pVar, pG = pVar, pB = pVar;
                    if (blockType === 44) {
                        pR *= 0.88 + rng2() * 0.28;
                        pG *= 0.95 + rng2() * 0.18;
                        pB *= 0.76 + rng2() * 0.16;
                    } else if (blockType === 50 || blockType === 43 || blockType === 52) {
                        pR *= 0.82 + rng2() * 0.18;
                        pG *= 0.95 + rng2() * 0.16;
                        pB *= 0.78 + rng2() * 0.16;
                    } else if (blockType === 9 || blockType === 10) {
                        pR *= 0.95 + rng2() * 0.18;
                        pG *= 0.92 + rng2() * 0.16;
                        pB *= 0.92 + rng2() * 0.18;
                    }

                    const texIdx = painterlyTextureFor(blockType, null, wx, y, wz, BLOCK_TEX[blockType] || 15);
                    const u0 = (texIdx % 16) / 16, v0 = 1 - (Math.floor(texIdx / 16) + 1) / 16;
                    const u1 = u0 + 1 / 16, v1 = v0 + 1 / 16;

                    for (let i = 0; i < 3; i++) {
                        const angle = (i * Math.PI) / 3 + (rng2() - 0.5) * 0.16;
                        const c = Math.cos(angle) * 0.5 * scaleX;
                        const s = Math.sin(angle) * 0.5 * scaleX;
                        const st = vc;
                        pos.push(
                            x + 0.5 - c + offX, y, z + 0.5 - s + offZ,
                            x + 0.5 + c + offX, y, z + 0.5 + s + offZ,
                            x + 0.5 + c + offX, y + scaleY, z + 0.5 + s + offZ,
                            x + 0.5 - c + offX, y + scaleY, z + 0.5 - s + offZ
                        );
                        col.push(pR, pG, pB, pR, pG, pB, pR, pG, pB, pR, pG, pB);
                        norm.push(-s, 0, c, -s, 0, c, -s, 0, c, -s, 0, c);
                        uv.push(u0, v0, u1, v0, u1, v1, u0, v1);
                        sway.push(0, 0, 1, 1);
                        pushAtlasSentinel(4);
                        idx.push(st, st + 1, st + 2, st, st + 2, st + 3);
                        vc += 4;
                    }
                    continue;
                }

                // ==============================
                // TÜREN (schmale Wand)
                // ==============================
                if (blockType === 33 || blockType === 34) {
                    const metadata = blockMeta[wx + ',' + y + ',' + wz] || 0;
                    const alongX = (metadata & 1) === 0;
                    const isOpen = (metadata & 4) !== 0;
                    const dR = 1, dG = 1, dB = 1;
                    const texIdx = painterlyTextureFor(blockType, null, wx, y, wz, BLOCK_TEX[blockType] || 0);
                    const u0 = (texIdx % 16) / 16, v0 = 1 - (Math.floor(texIdx / 16) + 1) / 16;
                    const u1 = u0 + 1 / 16, v1 = v0 + 1 / 16;
                    const thick = 0.15;

                    let front_x0, front_x1, front_z0, front_z1, back_x0, back_x1, back_z0, back_z1;
                    let front_nx, front_nz, back_nx, back_nz;

                    const panelAlongZ = alongX === isOpen;
                    if (panelAlongZ) {
                      const centerX = isOpen ? x : x + 0.5;
                      const startZ = isOpen ? z + 0.5 : z;
                      front_x0 = centerX - thick / 2; front_x1 = centerX + thick / 2;
                      front_z0 = startZ; front_z1 = startZ + 1;
                      back_x0 = centerX + thick / 2; back_x1 = centerX - thick / 2;
                      back_z0 = startZ + 1; back_z1 = startZ;
                      front_nx = -1; front_nz = 0;
                      back_nx = 1; back_nz = 0;
                    } else {
                      const startX = isOpen ? x + 0.5 : x;
                      const centerZ = isOpen ? z : z + 0.5;
                      front_x0 = startX; front_x1 = startX + 1;
                      front_z0 = centerZ - thick / 2; front_z1 = centerZ + thick / 2;
                      back_x0 = startX + 1; back_x1 = startX;
                      back_z0 = centerZ + thick / 2; back_z1 = centerZ - thick / 2;
                      front_nx = 0; front_nz = -1;
                      back_nx = 0; back_nz = 1;
                    }

                    // Vorderseite
                    let st = vc;
                    pos.push(front_x0, y, front_z0, front_x1, y, front_z1, front_x1, y + 1, front_z1, front_x0, y + 1, front_z0);
                    col.push(dR, dG, dB, dR, dG, dB, dR, dG, dB, dR, dG, dB);
                    norm.push(front_nx, 0, front_nz, front_nx, 0, front_nz, front_nx, 0, front_nz, front_nx, 0, front_nz);
                    uv.push(u0, v0, u1, v0, u1, v1, u0, v1);
                    sway.push(0, 0, 0, 0);
                    pushAtlasSentinel(4);
                    idx.push(st, st + 1, st + 2, st, st + 2, st + 3); vc += 4;
                    // Rückseite
                    st = vc;
                    pos.push(back_x0, y, back_z0, back_x1, y, back_z1, back_x1, y + 1, back_z1, back_x0, y + 1, back_z0);
                    col.push(dR, dG, dB, dR, dG, dB, dR, dG, dB, dR, dG, dB);
                    norm.push(back_nx, 0, back_nz, back_nx, 0, back_nz, back_nx, 0, back_nz, back_nx, 0, back_nz);
                    uv.push(u0, v0, u1, v0, u1, v1, u0, v1);
                    sway.push(0, 0, 0, 0);
                    pushAtlasSentinel(4);
                    idx.push(st, st + 1, st + 2, st, st + 2, st + 3); vc += 4;
                    continue;
                }

                // ==============================
                // DRUCKPLATTE (sehr dünne Platte, 0.1 hoch)
                // ==============================
                if (blockType === 79) {
                    const plateValue = 1;
                    const pR = plateValue, pG = plateValue, pB = plateValue;
                    const texIdx = painterlyTextureFor(blockType, null, wx, y, wz, BLOCK_TEX[79] || 2);
                    const u0 = (texIdx % 16) / 16, v0 = 1 - (Math.floor(texIdx / 16) + 1) / 16;
                    const u1 = u0 + 1 / 16, v1 = v0 + 1 / 16;
                    const ph = 0.1, inset = 0.05; // leicht eingerückt
                    // Oberseite
                    let st = vc;
                    pos.push(x+inset, y+ph, z+1-inset,  x+1-inset, y+ph, z+1-inset,  x+1-inset, y+ph, z+inset,  x+inset, y+ph, z+inset);
                    col.push(pR,pG,pB, pR,pG,pB, pR,pG,pB, pR,pG,pB);
                    norm.push(0,1,0, 0,1,0, 0,1,0, 0,1,0);
                    uv.push(u0,v0, u1,v0, u1,v1, u0,v1);
                    sway.push(0,0,0,0); pushAtlasSentinel(4);
                    idx.push(st,st+1,st+2, st,st+2,st+3); vc+=4;
                    continue;
                }

                // ==============================
                // BETTEN (halbe Blockhöhe)
                // ==============================
                if (blockType === 38 || blockType === 39) {
                    const bR = 1, bG = 1, bB = 1;
                    const furnitureDirection = resolveFurnitureDirection(blockType, wx, y, wz, getBlock, blockMeta);
                    const texIdx = furnitureTextureFor(blockType, wx, y, wz, furnitureDirection, BLOCK_TEX[blockType] || 0);
                    const u0 = (texIdx % 16) / 16, v0 = 1 - (Math.floor(texIdx / 16) + 1) / 16;
                    const u1 = u0 + 1 / 16, v1 = v0 + 1 / 16;
                    const topUVs = furnitureTopUVs(u0, v0, u1, v1, furnitureDirection);
                    const bh = 0.5;
                    // Oberseite
                    let st = vc;
                    pos.push(x, y + bh, z + 1, x + 1, y + bh, z + 1, x + 1, y + bh, z, x, y + bh, z);
                    col.push(bR, bG, bB, bR, bG, bB, bR, bG, bB, bR, bG, bB);
                    norm.push(0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0);
                    uv.push(...topUVs);
                    sway.push(0, 0, 0, 0);
                    pushAtlasSentinel(4);
                    idx.push(st, st + 1, st + 2, st, st + 2, st + 3); vc += 4;
                    // Vorderseite
                    st = vc;
                    pos.push(x, y, z + 1, x + 1, y, z + 1, x + 1, y + bh, z + 1, x, y + bh, z + 1);
                    col.push(bR, bG, bB, bR, bG, bB, bR, bG, bB, bR, bG, bB);
                    norm.push(0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1);
                    uv.push(u0, v0, u1, v0, u1, v1, u0, v1);
                    sway.push(0, 0, 0, 0);
                    pushAtlasSentinel(4);
                    idx.push(st, st + 1, st + 2, st, st + 2, st + 3); vc += 4;
                    // Rückseite
                    st = vc;
                    pos.push(x + 1, y, z, x, y, z, x, y + bh, z, x + 1, y + bh, z);
                    col.push(bR, bG, bB, bR, bG, bB, bR, bG, bB, bR, bG, bB);
                    norm.push(0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0, -1);
                    uv.push(u0, v0, u1, v0, u1, v1, u0, v1);
                    sway.push(0, 0, 0, 0);
                    pushAtlasSentinel(4);
                    idx.push(st, st + 1, st + 2, st, st + 2, st + 3); vc += 4;
                    // Links
                    st = vc;
                    pos.push(x, y, z, x, y, z + 1, x, y + bh, z + 1, x, y + bh, z);
                    col.push(bR, bG, bB, bR, bG, bB, bR, bG, bB, bR, bG, bB);
                    norm.push(-1, 0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0);
                    uv.push(u0, v0, u1, v0, u1, v1, u0, v1);
                    sway.push(0, 0, 0, 0);
                    pushAtlasSentinel(4);
                    idx.push(st, st + 1, st + 2, st, st + 2, st + 3); vc += 4;
                    // Rechts
                    st = vc;
                    pos.push(x + 1, y, z + 1, x + 1, y, z, x + 1, y + bh, z, x + 1, y + bh, z + 1);
                    col.push(bR, bG, bB, bR, bG, bB, bR, bG, bB, bR, bG, bB);
                    norm.push(1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0);
                    uv.push(u0, v0, u1, v0, u1, v1, u0, v1);
                    sway.push(0, 0, 0, 0);
                    pushAtlasSentinel(4);
                    idx.push(st, st + 1, st + 2, st, st + 2, st + 3); vc += 4;
                    continue;
                }

                // ==============================
                // Standard-Cube mit AO
                // ==============================
                for (let fi = 0; fi < CUBE_FACES.length; fi++) {
                    const f = CUBE_FACES[fi];
                    const nx = wx + f.d[0], ny = y + f.d[1], nz = wz + f.d[2];
                    const neigh = getBlock(nx, ny, nz);
                    const neighType = neigh;

                    let shouldDraw = false;
                    if (isWater) {
                        if (neighType === 0) shouldDraw = true;
                    } else {
                        if (TRANSPARENT_IDS.has(neighType)) shouldDraw = true;
                    }

                    if (shouldDraw) {
                        let texIdx = BLOCK_TEX[blockType] || 0;
                        const isFurnitureTop = (blockType === 28 || blockType === 36) && f.d[1] === 1;
                        const furnitureDirection = isFurnitureTop
                            ? resolveFurnitureDirection(blockType, wx, y, wz, getBlock, blockMeta)
                            : 0;

                        // Gras: Unterschiedliche Texturen pro Seite
                        if (blockType === 1) {
                            if (f.d[1] === 1) texIdx = 0;
                            else if (f.d[1] === -1) texIdx = 1;
                            else texIdx = 53;
                        }
                        texIdx = isFurnitureTop
                            ? furnitureTextureFor(blockType, wx, y, wz, furnitureDirection, texIdx)
                            : painterlyTextureFor(blockType, f, wx, y, wz, texIdx);

                        const eps = 0.5 / 1024;
                        const u0 = (texIdx % 16) / 16 + eps;
                        const v0 = 1 - (Math.floor(texIdx / 16) + 1) / 16 + eps;
                        const u1 = u0 + 1 / 16 - 2 * eps;
                        const v1 = v0 + 1 / 16 - 2 * eps;
                        const uvs = isFurnitureTop
                            ? furnitureTopUVs(u0, v0, u1, v1, furnitureDirection)
                            : [u0, v0, u1, v0, u1, v1, u0, v1];

                        // AO pro Vertex berechnen
                        const aoValues = [0, 0, 0, 0];
                        if (!isWater) {
                            const aoOffs = AO_OFFSETS[fi];
                            for (let vi = 0; vi < 4; vi++) {
                                const off = aoOffs[vi];
                                const s1 = isSolidForAO(getBlock(wx + off.side1[0], y + off.side1[1], wz + off.side1[2]));
                                const s2 = isSolidForAO(getBlock(wx + off.side2[0], y + off.side2[1], wz + off.side2[2]));
                                const cn = isSolidForAO(getBlock(wx + off.corner[0], y + off.corner[1], wz + off.corner[2]));
                                aoValues[vi] = vertexAO(s1, s2, cn);
                            }
                        } else {
                            aoValues[0] = aoValues[1] = aoValues[2] = aoValues[3] = 3;
                        }

                        // Greedy-Meshing-Entscheidung: Faces mit voller Helligkeit (AO=3 an allen 4 Vertices)
                        // werden NICHT direkt emittiert, sondern in greedyMasks gesammelt für späteres Merging.
                        // AO-darkened Faces müssen einzeln bleiben (per-Vertex AO ist mit Merging inkompatibel).
                        const canGreedyMerge = !isWater && !isFurnitureTop &&
                            aoValues[0] === 3 && aoValues[1] === 3 &&
                            aoValues[2] === 3 && aoValues[3] === 3;

                        if (canGreedyMerge) {
                            // In Greedy-Mask einsortieren. Slice + (u,v) im 2D-Mask-Grid bestimmen.
                            const info = FACE_AXIS_INFO[fi];
                            const lc = [x, y, z];
                            const sliceIdx = lc[info.axis];
                            const uMax = (info.uAxis === 1) ? CHUNK_HEIGHT : CHUNK_SIZE;
                            const vMax = (info.vAxis === 1) ? CHUNK_HEIGHT : CHUNK_SIZE;
                            const uIdx = lc[info.uAxis];
                            const vIdx = lc[info.vAxis];
                            let mask = greedyMasks[fi].get(sliceIdx);
                            if (!mask) {
                                mask = new Int16Array(uMax * vMax);
                                greedyMasks[fi].set(sliceIdx, mask);
                            }
                            // Encoding: type * 256 + texIdx + 1 (0 = leer)
                            mask[vIdx * uMax + uIdx] = blockType * 256 + texIdx + 1;
                        } else {
                            // Direkt emittieren mit Atlas-Sentinel (-1,-1) → Shader nutzt vMapUv direkt.
                            const st = vc;
                            const flipQuad = (aoValues[0] + aoValues[2]) < (aoValues[1] + aoValues[3]);

                            for (let vi = 0; vi < 4; vi++) {
                                const v = f.v[vi];
                                pos.push(x + v[0], y + v[1], z + v[2]);
                                const aoMult = AO_CURVE[aoValues[vi]];
                                col.push(bcR * aoMult, bcG * aoMult, bcB * aoMult);
                                norm.push(f.d[0], f.d[1], f.d[2]);
                                uv.push(uvs[vi * 2], uvs[vi * 2 + 1]);
                                sway.push(0);
                                atlasUV.push(-1, -1);
                            }

                            if (flipQuad) {
                                idx.push(st, st + 1, st + 3, st + 1, st + 2, st + 3);
                            } else {
                                idx.push(st, st + 1, st + 2, st, st + 2, st + 3);
                            }
                            vc += 4;
                        }
                    }
                }
            }
        }
    }

    // ==============================
    // GREEDY-MESHING-PASS für AO=3-Faces
    // ==============================
    // Pro Face-Richtung mergen wir Cells mit identischem (type, texIdx) zu möglichst großen Rechtecken.
    // Der Atlas-Tile wird im Fragment-Shader getiled (vAtlasUV + fract(vMapUv) * 1/16).
    if (!isWater) {
        for (let fi = 0; fi < 6; fi++) {
            const info = FACE_AXIS_INFO[fi];
            const f = CUBE_FACES[fi];
            const uMax = (info.uAxis === 1) ? CHUNK_HEIGHT : CHUNK_SIZE;
            const vMax = (info.vAxis === 1) ? CHUNK_HEIGHT : CHUNK_SIZE;

            for (const [sliceIdx, mask] of greedyMasks[fi]) {
                for (let v = 0; v < vMax; v++) {
                    let u = 0;
                    while (u < uMax) {
                        const cell = mask[v * uMax + u];
                        if (cell === 0) { u++; continue; }

                        // Maximale Breite (entlang U) bei identischem Encoding
                        let w = 1;
                        while (u + w < uMax && mask[v * uMax + u + w] === cell) w++;

                        // Maximale Höhe (entlang V), alle Cells in der Reihe müssen matchen
                        let h = 1;
                        let canExpand = true;
                        while (canExpand && v + h < vMax) {
                            for (let i = 0; i < w; i++) {
                                if (mask[(v + h) * uMax + u + i] !== cell) { canExpand = false; break; }
                            }
                            if (canExpand) h++;
                        }

                        // Gemergte Cells löschen
                        for (let dv = 0; dv < h; dv++) {
                            for (let du = 0; du < w; du++) {
                                mask[(v + dv) * uMax + u + du] = 0;
                            }
                        }

                        // Decode (type, texIdx)
                        const encoded = cell - 1;
                        const type = Math.floor(encoded / 256);
                        const texIdx = encoded - type * 256;

                        // Atlas-Zelle
                        const cellU = (texIdx % 16) / 16;
                        const cellV = 1 - (Math.floor(texIdx / 16) + 1) / 16;

                        // Vertex-Positionen aus dem CUBE_FACES-Vertex-Layout interpolieren.
                        // f.v sind die 4 Eckpunkte des Standard-Würfels für diese Face. Wir
                        // skalieren U entlang der u-Achse um w und V entlang der v-Achse um h,
                        // basierend auf dem Cell-Origin (u, v) im Slice.
                        // Lokales Block-Origin im Chunk:
                        const bx = (info.axis === 0) ? sliceIdx : ((info.uAxis === 0) ? u : (info.vAxis === 0 ? v : 0));
                        const by = (info.axis === 1) ? sliceIdx : ((info.uAxis === 1) ? u : (info.vAxis === 1 ? v : 0));
                        const bz = (info.axis === 2) ? sliceIdx : ((info.uAxis === 2) ? u : (info.vAxis === 2 ? v : 0));

                        // Skalierungs-Faktoren pro Vertex-Komponente
                        const scaleU_x = (info.uAxis === 0) ? w : 1;
                        const scaleU_y = (info.uAxis === 1) ? w : 1;
                        const scaleU_z = (info.uAxis === 2) ? w : 1;
                        const scaleV_x = (info.vAxis === 0) ? h : 1;
                        const scaleV_y = (info.vAxis === 1) ? h : 1;
                        const scaleV_z = (info.vAxis === 2) ? h : 1;

                        const st = vc;
                        // Farbe: AO=3 → Multiplikator 1.0, also bcR/bcG/bcB unverändert.
                        // (Per-Cell-Color-Variation wurde verworfen — Greedy nutzt eine einheitliche Farbe pro Quad,
                        //  basiert auf dem ersten Cell. Visuell akzeptabel, da Atlas-Textur Variation liefert.)
                        // Wir berechnen die Farbe einmal aus type:
                        const bcHex2 = BLOCK_COLORS[type] || 0xffffff;
                        let qR = ((bcHex2 >> 16) & 0xff) / 255;
                        let qG = ((bcHex2 >> 8) & 0xff) / 255;
                        let qB = (bcHex2 & 0xff) / 255;
                        if (type === 1 || LOG_IDS.has(type)) { qR = qG = qB = 1; } // Gras/Holz: weiße Vertex-Color

                        for (let vi = 0; vi < 4; vi++) {
                            const fv = f.v[vi];
                            // fv ist {0|1, 0|1, 0|1}. Skalieren entlang u/v-Achsen, Achse-Achse bleibt 0|1.
                            const px = bx + fv[0] * (info.axis === 0 ? 1 : (info.uAxis === 0 ? scaleU_x : (info.vAxis === 0 ? scaleV_x : 1)));
                            const py = by + fv[1] * (info.axis === 1 ? 1 : (info.uAxis === 1 ? scaleU_y : (info.vAxis === 1 ? scaleV_y : 1)));
                            const pz = bz + fv[2] * (info.axis === 2 ? 1 : (info.uAxis === 2 ? scaleU_z : (info.vAxis === 2 ? scaleV_z : 1)));
                            pos.push(px, py, pz);
                            col.push(qR, qG, qB);
                            norm.push(f.d[0], f.d[1], f.d[2]);
                            const fvU = fv[info.uAxis];
                            const fvV = fv[info.vAxis];
                            uv.push(fvU * w, fvV * h);
                            sway.push(0);
                            atlasUV.push(cellU, cellV);
                        }
                        idx.push(st, st + 1, st + 2, st, st + 2, st + 3);
                        vc += 4;

                        u += w;
                    }
                }
            }
        }
    }

    if (vc === 0) return null;

    // Konvertiere zu typisierten Arrays für Transferable
    const posArr = new Float32Array(pos);
    const colArr = new Float32Array(col);
    const normArr = new Float32Array(norm);
    const uvArr = new Float32Array(uv);
    const swayArr = new Float32Array(sway);
    const atlasUVArr = new Float32Array(atlasUV);
    const idxArr = new Uint32Array(idx);

    return { pos: posArr, col: colArr, norm: normArr, uv: uvArr, sway: swayArr, atlasUV: atlasUVArr, idx: idxArr };
}

// ============================================================
// Message Handler
// ============================================================

self.onmessage = function (e) {
    if (e.data.type === 'init') {
        CHUNK_SIZE = e.data.config.CHUNK_SIZE;
        CHUNK_HEIGHT = e.data.config.CHUNK_HEIGHT;
        WATER_LEVEL = e.data.config.WATER_LEVEL;
        CLOUD_HEIGHT = e.data.config.CLOUD_HEIGHT;
        if (e.data.blockColors) BLOCK_COLORS = e.data.blockColors;
        if (e.data.blockTex) BLOCK_TEX = e.data.blockTex;
        WORLD_GENERATION_VERSION = Number(e.data.worldGenerationVersion) || 1;
        return;
    }

    if (e.data.type === 'worldGenerationVersion') {
        WORLD_GENERATION_VERSION = e.data.version === 1 ? 1 : 2;
        return;
    }

    if (e.data.type === 'generate') {
        const { cx, cz, epoch } = e.data;
        const buffer = e.data.buffer || new ArrayBuffer(CHUNK_SIZE * CHUNK_HEIGHT * CHUNK_SIZE);
        const generationStartedAt = performance.now();
        const result = generateTerrain(cx, cz, buffer);
        const workerGenerationMs = performance.now() - generationStartedAt;
        const data = result.data;
        const villageInfos = result.villageInfos || [];
        const minecartInfos = result.minecartInfos || [];
        const structureInfos = result.structureInfos || [];
        const chestInfos = result.chestInfos || [];
        const spawnerInfos = result.spawnerInfos || [];

        self.postMessage({
            type: 'terrain',
            cx,
            cz,
            epoch,
            data,
            villageInfos,
            minecartInfos,
            structureInfos,
            chestInfos,
            spawnerInfos,
            timings: { workerGenerationMs }
        }, [data.buffer]);
        return;
    }

    if (e.data.type === 'mesh') {
        const { cx, cz, centerData, neighbors, blockMeta, epoch } = e.data;

        // Nachbar-Daten in ein Lookup-Objekt umwandeln
        const neighborMap = {};
        if (neighbors) {
            for (const n of neighbors) {
                neighborMap[n.cx + ',' + n.cz] = new Uint8Array(n.data);
            }
        }

        const centerArr = new Uint8Array(centerData);
        const getBlock = makeGetBlock(centerArr, neighborMap, cx, cz);

        // Opaque Mesh
        const meshBuildStartedAt = performance.now();
        const opaque = buildMesh(cx, cz, getBlock, false, blockMeta || {});
        // Water Mesh
        const water = buildMesh(cx, cz, getBlock, true, blockMeta || {});
        const workerMeshBuildMs = performance.now() - meshBuildStartedAt;

        const transferables = [];
        const result = { type: 'meshResult', cx, cz, epoch, opaque: null, water: null, timings: { workerMeshBuildMs } };

        if (opaque) {
            result.opaque = { pos: opaque.pos, col: opaque.col, norm: opaque.norm, uv: opaque.uv, sway: opaque.sway, atlasUV: opaque.atlasUV, idx: opaque.idx };
            transferables.push(opaque.pos.buffer, opaque.col.buffer, opaque.norm.buffer, opaque.uv.buffer, opaque.sway.buffer, opaque.atlasUV.buffer, opaque.idx.buffer);
        }
        if (water) {
            result.water = { pos: water.pos, col: water.col, norm: water.norm, uv: water.uv, sway: water.sway, atlasUV: water.atlasUV, idx: water.idx };
            transferables.push(water.pos.buffer, water.col.buffer, water.norm.buffer, water.uv.buffer, water.sway.buffer, water.atlasUV.buffer, water.idx.buffer);
        }

        self.postMessage(result, transferables);
        return;
    }
};
