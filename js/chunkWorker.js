// ============================================================
// Butzcraft – chunkWorker.js
// Terrain-Generierung + Chunk-Meshing + Vertex Ambient Occlusion
// Läuft komplett off-main-thread für ruckelfreies Gameplay.
// ============================================================

let CHUNK_SIZE = 16, CHUNK_HEIGHT = 64, WATER_LEVEL = 32, CLOUD_HEIGHT = 50;
let BLOCK_COLORS = {};
let BLOCK_TEX = {};

const BIOMES = { OCEAN: 'Ozean', DESERT: 'Wüste', JUNGLE: 'Urwald', SNOW: 'Schneefeld', PLAINS: 'Grasland' };

// Transparente/Nicht-solide Block-IDs (Faces gegen diese werden gezeichnet)
// 79=Druckplatte, 80=Minengleis: dünn, Nachbarn sollen sichtbar sein
const TRANSPARENT_IDS = new Set([0, -1, 4, 9, 10, 27, 32, 33, 34, 36, 38, 39, 43, 44, 46, 47, 48, 49, 50, 52, 54, 79, 80, 86]);

// 2D-Pflanzen (Stern-Mesh statt Würfel)
const PLANT_2D_IDS = new Set([9, 10, 27, 43, 44, 46, 47, 48, 49, 50, 52, 54, 86]);
const LOG_IDS = new Set([5, 13, 15]);

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

function getFloatingIslandAt(wx, wz) {
    const cellSize = 100;
    const cellX = Math.floor(wx / cellSize);
    const cellZ = Math.floor(wz / cellSize);
    const rng = mulberry32(cellX * 91827 + cellZ * 12345);
    if (rng() > 0.3) return null;
    const centerX = cellX * cellSize + 20 + rng() * 60;
    const centerZ = cellZ * cellSize + 20 + rng() * 60;
    const islandRadius = 6 + rng() * 4;
    const islandY = 48 + rng() * 5;
    const dx = wx - centerX;
    const dz = wz - centerZ;
    const distSq = dx * dx + dz * dz;
    if (distSq < islandRadius * islandRadius) {
        const maxThick = 3 + rng() * 3;
        const thickness = maxThick * (1 - distSq / (islandRadius * islandRadius));
        return { y: Math.floor(islandY), thick: Math.floor(thickness) };
    }
    return null;
}

function getBiomeAt(x, z) {
    const temp = (Math.sin(x * 0.01) + Math.cos(z * 0.01)) * 0.5;
    const humidity = (Math.sin(x * 0.01 + 500) + Math.cos(z * 0.01 + 500)) * 0.5;
    if (temp < -0.4) return BIOMES.SNOW;
    if (temp > 0.2) return humidity < -0.15 ? BIOMES.DESERT : BIOMES.JUNGLE;
    return humidity < -0.25 ? BIOMES.OCEAN : BIOMES.PLAINS;
}

function getTerrainHeightAt(wx, wz) {
    const biome = getBiomeAt(wx, wz);
    const humidity = (Math.sin(wx * 0.01 + 500) + Math.cos(wz * 0.01 + 500)) * 0.5;
    const oceanFactor = Math.max(0, Math.min(1, (-0.15 - humidity) / 0.4));
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

function spawnTree(data, x, h, z, biome, rng) {
    const isJ = biome === BIOMES.JUNGLE, th = (isJ ? 8 : 4) + Math.floor(rng() * 3);
    const wt = isJ ? 13 : 5, lt = isJ ? 14 : 6;
    for (let ty = 0; ty < th; ty++) {
        const iy = h + ty; if (iy < CHUNK_HEIGHT) data[(iy * CHUNK_SIZE * CHUNK_SIZE) + (z * CHUNK_SIZE) + x] = wt;
    }
    const lr = isJ ? 3 : 2.2;
    for (let lx = -3; lx <= 3; lx++) {
        for (let lz = -3; lz <= 3; lz++) {
            for (let ly = 0; ly <= 4; ly++) {
                const wx = x + lx, wz = z + lz, wy = h + th - 2 + ly;
                if (wx < 0 || wx >= CHUNK_SIZE || wz < 0 || wz >= CHUNK_SIZE || wy >= CHUNK_HEIGHT) continue;
                if (Math.sqrt(lx * lx + lz * lz + (ly - 1.5) * (ly - 1.5)) > lr) continue;
                const idx = (wy * CHUNK_SIZE * CHUNK_SIZE) + (wz * CHUNK_SIZE) + wx;
                if (data[idx] === 0) data[idx] = lt;
            }
        }
    }
}

function spawnPalm(data, x, h, z, rng) {
    const th = 4 + Math.floor(rng() * 2);
    let topX = x, topZ = z;
    const leanX = Math.floor(rng() * 3) - 1;
    const leanZ = leanX === 0 ? Math.floor(rng() * 3) - 1 : 0;
    for (let ty = 0; ty < th; ty++) {
        const leanStep = ty >= th - 2 ? 1 : 0;
        const wx = x + leanX * leanStep, wz = z + leanZ * leanStep, wy = h + ty;
        topX = wx; topZ = wz;
        if (wx >= 0 && wx < CHUNK_SIZE && wz >= 0 && wz < CHUNK_SIZE && wy < CHUNK_HEIGHT)
            data[(wy * CHUNK_SIZE * CHUNK_SIZE) + (wz * CHUNK_SIZE) + wx] = 15;
    }

    const crownY = h + th;
    setBlockLocal(data, topX, crownY - 1, topZ, 15);
    setBlockLocal(data, topX, crownY, topZ, 16);
    const fronds = [
        [1, 0], [-1, 0], [0, 1], [0, -1],
        [1, 1], [1, -1], [-1, 1], [-1, -1]
    ];
    for (const [dx, dz] of fronds) {
        setBlockLocal(data, topX + dx, crownY, topZ + dz, 16);
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

// Verlassene Mine: 3×3-Korridor der Länge 20 Blöcke, mit Truhe am Ende + sichtbarer Eingang
function spawnMine(data, x, y, z, surfaceY) {
    for (let i = 0; i < 20; i++) {
        for (let dy = 0; dy < 3; dy++) {
            for (let dx = -1; dx <= 1; dx++) {
                setBlockLocal(data, x + dx, y + dy, z + i, 0); // Korridor aushöhlen
            }
        }
        // Balken alle 4 Blöcke
        if (i % 4 === 0) {
            setBlockLocal(data, x - 1, y + 2, z + i, 81); // MINE_SUPPORT links oben
            setBlockLocal(data, x + 1, y + 2, z + i, 81); // MINE_SUPPORT rechts oben
            setBlockLocal(data, x,     y + 2, z + i, 81); // MINE_SUPPORT Mitte oben
        }
        // Gleise auf dem Boden
        setBlockLocal(data, x, y, z + i, 80); // MINE_RAIL
    }
    // Truhe am Ende
    setBlockLocal(data, x, y + 1, z + 20, 75); // CHEST
    // Senkschacht zur Oberfläche (1×1, mit Holzrahmen oben als Marker)
    if (surfaceY !== undefined) {
        for (let sy = y + 3; sy < surfaceY; sy++) {
            setBlockLocal(data, x, sy, z, 0);
        }
        setBlockLocal(data, x - 1, surfaceY,     z,     26); // PLANKS Eingangsrahmen
        setBlockLocal(data, x + 1, surfaceY,     z,     26);
        setBlockLocal(data, x,     surfaceY,     z - 1, 26);
        setBlockLocal(data, x,     surfaceY,     z + 1, 26);
        setBlockLocal(data, x - 1, surfaceY - 1, z,     26);
        setBlockLocal(data, x + 1, surfaceY - 1, z,     26);
        setBlockLocal(data, x,     surfaceY - 1, z - 1, 26);
        setBlockLocal(data, x,     surfaceY - 1, z + 1, 26);
    }
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

// Dungeon: Unterirdischer Raum mit Spawner + Loot-Truhe (Tier 3)
// Layout-Varianten: einfacher Raum, Korridor+Raum, L-Form
function spawnDungeon(data, x, y, z, rng) {
    const variant = Math.floor(rng() * 3); // 0=einfach, 1=korridor+raum, 2=L-form
    
    // 83=SPAWNER, 84=MOSSY_STONE, 85=COBBLESTONE, 75=CHEST
    
    if (variant === 0) {
        // Einfacher Raum: 9×5×9, zentraler Spawner, 1 Truhe
        for (let dx = -5; dx <= 5; dx++) {
            for (let dz = -5; dz <= 5; dz++) {
                for (let dy = 0; dy <= 5; dy++) {
                    const isWall = (Math.abs(dx) === 5 || Math.abs(dz) === 5 || dy === 0 || dy === 5);
                    if (isWall) {
                        // Mischung aus Cobblestone und Mossy Stone für Atmosphäre
                        const wallType = rng() < 0.3 ? 84 : 85;
                        setBlockLocal(data, x + dx, y + dy, z + dz, wallType);
                    } else {
                        setBlockLocal(data, x + dx, y + dy, z + dz, 0); // Hohlraum
                    }
                }
            }
        }
        // Spawner zentral
        setBlockLocal(data, x, y + 1, z, 83);
        // Truhe an der Wand
        setBlockLocal(data, x + 4, y + 1, z + 3, 75);
        
    } else if (variant === 1) {
        // Korridor (3×3, Länge 10) → Hauptraum (7×5×7)
        // Gang
        for (let i = 0; i < 8; i++) {
            for (let dy = 0; dy <= 3; dy++) {
                for (let dx = -2; dx <= 2; dx++) {
                    setBlockLocal(data, x + dx, y + dy, z + i, 0);
                }
            }
            // Boden und Decke
            for (let dx = -2; dx <= 2; dx++) {
                setBlockLocal(data, x + dx, y - 1, z + i, 85); // Cobblestone Boden
                setBlockLocal(data, x + dx, y + 4, z + i, 85); // Cobblestone Decke
            }
        }
        // Hauptraum am Ende
        for (let dx = -5; dx <= 5; dx++) {
            for (let dz = 0; dz <= 8; dz++) {
                for (let dy = 0; dy <= 5; dy++) {
                    const isWall = (Math.abs(dx) === 5 || dz === 8 || dy === 0 || dy === 5);
                    if (isWall) {
                        setBlockLocal(data, x + dx, y + dy, z + 8 + dz, rng() < 0.35 ? 84 : 85);
                    } else {
                        setBlockLocal(data, x + dx, y + dy, z + 8 + dz, 0);
                    }
                }
            }
        }
        // Spawner und 2 Truhen
        setBlockLocal(data, x, y + 1, z + 12, 83);
        setBlockLocal(data, x - 4, y + 1, z + 14, 75);
        setBlockLocal(data, x + 4, y + 1, z + 14, 75);
        
    } else {
        // L-Form: Hauptraum (7×5×7) + Seitengang + kleiner Raum
        // Hauptraum
        for (let dx = -4; dx <= 4; dx++) {
            for (let dz = -4; dz <= 4; dz++) {
                for (let dy = 0; dy <= 5; dy++) {
                    const isWall = (Math.abs(dx) === 4 || Math.abs(dz) === 4 || dy === 0 || dy === 5);
                    if (isWall) {
                        setBlockLocal(data, x + dx, y + dy, z + dz, rng() < 0.4 ? 84 : 85);
                    } else {
                        setBlockLocal(data, x + dx, y + dy, z + dz, 0);
                    }
                }
            }
        }
        // Seitengang nach rechts
        for (let i = 5; i < 10; i++) {
            for (let dy = 0; dy <= 3; dy++) {
                for (let dz = -1; dz <= 1; dz++) {
                    setBlockLocal(data, x + i, y + dy, z + dz, 0);
                }
            }
            for (let dz = -1; dz <= 1; dz++) {
                setBlockLocal(data, x + i, y - 1, z + dz, 85);
                setBlockLocal(data, x + i, y + 4, z + dz, 85);
            }
        }
        // Kleiner Raum am Ende des Seitengangs
        for (let dx = 0; dx <= 6; dx++) {
            for (let dz = -3; dz <= 3; dz++) {
                for (let dy = 0; dy <= 4; dy++) {
                    const isWall = (dx === 6 || Math.abs(dz) === 3 || dy === 0 || dy === 4);
                    if (isWall) {
                        setBlockLocal(data, x + 10 + dx, y + dy, z + dz, rng() < 0.5 ? 84 : 85);
                    } else {
                        setBlockLocal(data, x + 10 + dx, y + dy, z + dz, 0);
                    }
                }
            }
        }
        // Spawner im Hauptraum
        setBlockLocal(data, x, y + 1, z, 83);
        // Truhe im kleinen Raum
        setBlockLocal(data, x + 14, y + 1, z, 75);
    }

    // Gemeinsamer Hub: garantiert genug Platz fuer Kampf und Orientierung,
    // auch wenn eine Variante an Chunk-Grenzen abgeschnitten wird.
    for (let dx = -5; dx <= 5; dx++) {
        for (let dz = -5; dz <= 5; dz++) {
            for (let dy = 0; dy <= 5; dy++) {
                const isWall = Math.abs(dx) === 5 || Math.abs(dz) === 5 || dy === 0 || dy === 5;
                setBlockLocal(data, x + dx, y + dy, z + dz, isWall ? (rng() < 0.35 ? 84 : 85) : 0);
            }
        }
    }
    setBlockLocal(data, x, y + 1, z, 83);
    setBlockLocal(data, x + 4, y + 1, z + 3, 75);
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
}

// NPC-Dorf: Generiert ein kleines Dorf mit Häusern, Brunnen, Wegen
// Gibt villageData zurück (für NPC-Spawning im Main-Thread)
function getVillagePlacement(wx, wz, biome) {
    let minH = Infinity, maxH = -Infinity;
    for (let dx = -12; dx <= 12; dx += 4) {
        for (let dz = -12; dz <= 12; dz += 4) {
            const sx = wx + dx;
            const sz = wz + dz;
            if (getBiomeAt(sx, sz) !== biome) return null;
            const h = getTerrainHeightAt(sx, sz);
            if (h <= WATER_LEVEL + 1) return null;
            minH = Math.min(minH, h);
            maxH = Math.max(maxH, h);
        }
    }
    if (maxH - minH > 6) return null;
    return { baseY: maxH };
}

const VILLAGE_ROAD_MAX_DISTANCE = 180;
const VILLAGE_ROAD_SEARCH_RADIUS_CHUNKS = Math.ceil(VILLAGE_ROAD_MAX_DISTANCE / CHUNK_SIZE) + 1;
const VILLAGE_ROAD_TRIM = 6;

function getVillagePathBlockForBiome(biome) {
    if (biome === BIOMES.DESERT) return 30;
    if (biome === BIOMES.SNOW) return 78;
    return 87;
}

function getVillageCandidate(scx, scz) {
    const rng = mulberry32(scx * 55103 + scz * 97127 + 424242);
    if (rng() >= 0.04) return null;

    const wx0 = scx * CHUNK_SIZE;
    const wz0 = scz * CHUNK_SIZE;
    const villageRange = Math.max(0, CHUNK_SIZE - 16);
    const x = wx0 + 8 + Math.floor(rng() * villageRange);
    const z = wz0 + 8 + Math.floor(rng() * villageRange);
    const biome = getBiomeAt(x, z);
    if (biome !== BIOMES.PLAINS && biome !== BIOMES.DESERT && biome !== BIOMES.SNOW) return null;

    const placement = getVillagePlacement(x, z, biome);
    if (!placement) return null;

    return {
        scx,
        scz,
        x,
        z,
        baseY: placement.baseY,
        biome,
        variant: biome === BIOMES.PLAINS ? Math.floor(rng() * 2) : 0
    };
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

function spawnVillage(data, x, y, z, rng, worldX, worldZ, biome = BIOMES.PLAINS, variant = 0) {
    const villageInfo = { cx: 0, cz: 0, houses: [] };
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
    const getFootprintBaseY = (startWorldX, startWorldZ, width, depth) => {
        let baseY = y - 1;
        for (let dx = 0; dx < width; dx++) {
            for (let dz = 0; dz < depth; dz++) {
                baseY = Math.max(baseY, getTerrainHeightAt(startWorldX + dx, startWorldZ + dz) - 1);
            }
        }
        return baseY;
    };

    const drawWell = () => {
        for (let dx = -3; dx <= 3; dx++) {
            for (let dz = -3; dz <= 3; dz++) {
                setBlockLocal(data, x + dx, y - 1, z + dz, style.path);
                setBlockLocal(data, x + dx, y, z + dz, 0);
                setBlockLocal(data, x + dx, y + 1, z + dz, 0);
            }
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
        if (style.market) {
            for (const [mx, mz] of [[-5, 0], [5, 0], [0, -5], [0, 5]]) {
                setBlockLocal(data, x + mx, y - 1, z + mz, style.path);
                setBlockLocal(data, x + mx, y, z + mz, biome === BIOMES.DESERT ? 82 : 88);
            }
        }
    };
    
    // Brunnen im Zentrum (5×5 Cobblestone-Ring + Wasser)
    for (let dx = -2; dx <= 2; dx++) {
        for (let dz = -2; dz <= 2; dz++) {
            // Boden: Village Path
            setBlockLocal(data, x + dx, y - 1, z + dz, style.path); // VILLAGE_PATH
            if (Math.abs(dx) === 2 || Math.abs(dz) === 2) {
                // Rand: Cobblestone
                setBlockLocal(data, x + dx, y, z + dz, style.wellRim); // COBBLESTONE
                setBlockLocal(data, x + dx, y + 1, z + dz, 0); // Luft darüber
            } else {
                // Innen: Wasser
                setBlockLocal(data, x + dx, y, z + dz, 4); // WATER
                setBlockLocal(data, x + dx, y + 1, z + dz, 0);
            }
        }
    }

    // Häuser um den Brunnen (3-5 Stück)
    const buildIglooHouse = (hx, hz, houseW, houseD, ho, houseWorldX, houseWorldZ, h) => {
        const r = 4;
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

        for (let dx = -3; dx <= 3; dx++) {
            for (let dz = -3; dz <= 3; dz++) {
                for (let dy = 1; dy <= 3; dy++) {
                    const roomRadius = dy >= 4 ? 2 : 3;
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
        setBlockLocal(data, cx0, floorY + 1, doorZ, 0);
        setBlockLocal(data, cx0, floorY + 2, doorZ, 0);
        setBlockLocal(data, cx0, floorY, porchZ, style.path);
        setBlockLocal(data, cx0, floorY + 1, porchZ, 0);
        setBlockLocal(data, cx0, floorY + 2, porchZ, 0);
        setBlockLocal(data, cx0 - 1, floorY + 1, cz0, 38);
        setBlockLocal(data, cx0, floorY + 1, cz0, 39);
        setBlockLocal(data, cx0 + 2, floorY + 1, cz0, 75);

        villageInfo.houses.push({
            x: cx0,
            y: floorY + 1,
            z: cz0,
            professionIdx: h
        });
        return { pathStartX: cx0, pathStartZ: porchZ, floorY };
    };

    drawWell();
    const houseCount = 3 + Math.floor(rng() * 3);
    const houseOffsets = [
        { dx: -8, dz: -8 }, { dx: 8, dz: -8 },
        { dx: -8, dz: 8 },  { dx: 8, dz: 8 },
        { dx: 0, dz: -10 }
    ];

    for (let h = 0; h < Math.min(houseCount, houseOffsets.length); h++) {
        const ho = houseOffsets[h];
        const hx = x + ho.dx, hz = z + ho.dz;
        const houseW = style.igloo ? 7 : 5 + Math.floor(rng() * 2); // 5 oder 6 breit
        const houseD = style.igloo ? 7 : 5 + Math.floor(rng() * 2);
        const houseH = 4;
        const houseWorldX = worldX + ho.dx;
        const houseWorldZ = worldZ + ho.dz;

        if (style.igloo) {
            const igloo = buildIglooHouse(hx, hz, houseW, houseD, ho, houseWorldX, houseWorldZ, h);
            const pathStartX = igloo.pathStartX;
            const pathStartZ = igloo.pathStartZ;
            const toCenterX = x - pathStartX;
            const toCenterZ = z - pathStartZ;
            const pathEndX = Math.abs(toCenterX) >= Math.abs(toCenterZ) ? x - Math.sign(toCenterX || 1) * 3 : x;
            const pathEndZ = Math.abs(toCenterX) >= Math.abs(toCenterZ) ? z : z - Math.sign(toCenterZ || 1) * 3;
            const steps = Math.max(Math.abs(pathStartX - pathEndX), Math.abs(pathStartZ - pathEndZ));
            for (let s = 0; s <= steps; s++) {
                const t = steps > 0 ? s / steps : 0;
                const px = Math.round(pathStartX + (pathEndX - pathStartX) * t);
                const pz = Math.round(pathStartZ + (pathEndZ - pathStartZ) * t);
                const pathWorldX = px + (worldX - x);
                const pathWorldZ = pz + (worldZ - z);
                const pathY = Math.max(y, Math.min(igloo.floorY, getTerrainHeightAt(pathWorldX, pathWorldZ)));
                setBlockLocal(data, px, pathY - 1, pz, style.path);
                setBlockLocal(data, px, pathY, pz, 0);
                setBlockLocal(data, px, pathY + 1, pz, 0);
            }
            continue;
        }

        const floorY = getFootprintBaseY(houseWorldX, houseWorldZ, houseW, houseD);
        const wallY = floorY + 1;
        const roofY = wallY + houseH - 1;

        // Boden: Planken auf eigener Haus-Hoehe, damit Hang-Haeuser nicht im Terrain versinken.
        for (let dx = 0; dx < houseW; dx++) {
            for (let dz = 0; dz < houseD; dz++) {
                const terrainY = getTerrainHeightAt(houseWorldX + dx, houseWorldZ + dz);
                for (let fy = terrainY; fy < floorY; fy++) {
                    setBlockLocal(data, hx + dx, fy, hz + dz, style.foundation); // COBBLESTONE Fundament
                }
                setBlockLocal(data, hx + dx, floorY - 1, hz + dz, style.foundation); // COBBLESTONE Fundament
                setBlockLocal(data, hx + dx, floorY, hz + dz, style.floor); // PLANKS Boden
            }
        }

        // Wände: Holz-Planken mit Fenstern
        for (let dy = 0; dy < houseH; dy++) {
            for (let dx = 0; dx < houseW; dx++) {
                for (let dz = 0; dz < houseD; dz++) {
                    const isEdge = (dx === 0 || dx === houseW - 1 || dz === 0 || dz === houseD - 1);
                    if (dy === houseH - 1) {
                        // Dach: Cobblestone
                        setBlockLocal(data, hx + dx, wallY + dy, hz + dz, style.roof);
                    } else if (isEdge) {
                        // Fenster in der Mitte der Wände (y=1)
                        const isMidX = dx > 1 && dx < houseW - 2;
                        const isMidZ = dz > 1 && dz < houseD - 2;
                        if (dy === 1 && ((dx === 0 || dx === houseW - 1) && isMidZ || (dz === 0 || dz === houseD - 1) && isMidX)) {
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

        // Eckpfeiler und Dachüberstand geben den Häusern eine klarere Silhouette.
        const corners = [[0, 0], [houseW - 1, 0], [0, houseD - 1], [houseW - 1, houseD - 1]];
        for (const [cx0, cz0] of corners) {
            for (let py = wallY; py < roofY; py++) {
                setBlockLocal(data, hx + cx0, py, hz + cz0, style.post); // WOOD
            }
        }
        for (let dx = -1; dx <= houseW; dx++) {
            for (let dz = -1; dz <= houseD; dz++) {
                const isOverhang = dx === -1 || dx === houseW || dz === -1 || dz === houseD;
                if (isOverhang) setBlockLocal(data, hx + dx, roofY, hz + dz, style.roofEdge); // COBBLESTONE Dachkante
            }
        }

        // Tür (Lücke in der Wand richtung Brunnen)
        const doorDz = ho.dz < 0 ? houseD - 1 : 0;
        const doorDx = Math.floor(houseW / 2);
        setBlockLocal(data, hx + doorDx, wallY, hz + doorDz, 0);
        setBlockLocal(data, hx + doorDx, wallY + 1, hz + doorDz, 0);
        setBlockLocal(data, hx + doorDx, wallY + 2, hz + doorDz, style.doorHeader); // PLANKS Tuersturz
        const porchZ = doorDz === 0 ? hz - 1 : hz + houseD;
        setBlockLocal(data, hx + doorDx, floorY - 1, porchZ, style.path); // VILLAGE_PATH
        setBlockLocal(data, hx + doorDx, floorY, porchZ, style.threshold); // PLANKS Schwelle
        setBlockLocal(data, hx + doorDx, floorY + 1, porchZ, 0);

        // Weg vom Haus zum Brunnen
        const pathStartX = hx + doorDx;
        const pathStartZ = porchZ;
        const toCenterX = x - pathStartX;
        const toCenterZ = z - pathStartZ;
        const pathEndX = Math.abs(toCenterX) >= Math.abs(toCenterZ) ? x - Math.sign(toCenterX || 1) * 3 : x;
        const pathEndZ = Math.abs(toCenterX) >= Math.abs(toCenterZ) ? z : z - Math.sign(toCenterZ || 1) * 3;
        const steps = Math.max(Math.abs(pathStartX - pathEndX), Math.abs(pathStartZ - pathEndZ));
        for (let s = 0; s <= steps; s++) {
            const t = steps > 0 ? s / steps : 0;
            const px = Math.round(pathStartX + (pathEndX - pathStartX) * t);
            const pz = Math.round(pathStartZ + (pathEndZ - pathStartZ) * t);
            const pathWorldX = px + (worldX - x);
            const pathWorldZ = pz + (worldZ - z);
            const pathY = Math.max(y, Math.min(floorY, getTerrainHeightAt(pathWorldX, pathWorldZ)));
            setBlockLocal(data, px, pathY - 1, pz, style.path); // VILLAGE_PATH
            // Luft über dem Weg
            setBlockLocal(data, px, pathY, pz, 0);
            setBlockLocal(data, px, pathY + 1, pz, 0);
        }
        setBlockLocal(data, hx + doorDx, floorY, porchZ, style.threshold); // PLANKS Schwelle nach Weg-Clear wiederherstellen
        setBlockLocal(data, hx + doorDx, floorY + 1, porchZ, 0);

        // Truhe im Haus
        setBlockLocal(data, hx + 1, floorY + 1, hz + 1, 75); // CHEST

        // NPC-Spawn-Position (Mitte des Hauses)
        villageInfo.houses.push({
            x: hx + Math.floor(houseW / 2),
            y: floorY + 1,
            z: hz + Math.floor(houseD / 2),
            professionIdx: h
        });
    }

    drawWell();
    return villageInfo;
}

function generateTerrain(cx, cz, buffer) {
    const data = new Uint8Array(buffer);
    data.fill(0);
    const rng = mulberry32(cx * 1000 + cz);
    const villageInfos = []; // Tier 3: gesammelte Dorf-Infos für NPC-Spawning

    for (let x = 0; x < CHUNK_SIZE; x++) {
        for (let z = 0; z < CHUNK_SIZE; z++) {
            const wx = cx * CHUNK_SIZE + x, wz = cz * CHUNK_SIZE + z;
            const biome = getBiomeAt(wx, wz);
            const humidity = (Math.sin(wx * 0.01 + 500) + Math.cos(wz * 0.01 + 500)) * 0.5;
            const oceanFactor = Math.max(0, Math.min(1, (-0.15 - humidity) / 0.4));
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
                    if (biome === BIOMES.SNOW) data[idx] = 11;
                    else if (biome === BIOMES.DESERT || biome === BIOMES.OCEAN) data[idx] = 7;
                    else data[idx] = 1;
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
                if (biome === BIOMES.PLAINS) {
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
                if (biome === BIOMES.SNOW && rng() < 0.012) {
                    data[surfIdx] = rng() < 0.7 ? 46 : 44;
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
                const tc = (biome === BIOMES.JUNGLE) ? 0.08 : (biome === BIOMES.PLAINS) ? 0.015 : 0;
                if (rng() < tc) spawnTree(data, x, h, z, biome, rng);
                if (biome === BIOMES.DESERT && rng() < 0.008 && canSpawnPalmAt(wx, wz, h)) {
                    spawnPalm(data, x, h, z, rng);
                }
            }
        }
    }

    drawVillageRoads(data, cx, cz);

    // Prozedurale Strukturen: Im 3×3-Nachbar-Chunk-Bereich prüfen, ob eine Struktur startet,
    // die in diesen Chunk hineinragt. Jede Struktur wird deterministisch am Quell-Chunk platziert.
    for (let scx = cx - 1; scx <= cx + 1; scx++) {
        for (let scz = cz - 1; scz <= cz + 1; scz++) {
            const srng = mulberry32(scx * 88317 + scz * 23497);
            const wx0 = scx * CHUNK_SIZE, wz0 = scz * CHUNK_SIZE;

            // Verlassene Mine (Spawn-Chance 10%, nur in Plains/Jungle/Snow)
            if (srng() < 0.10) {
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
                        spawnMine(data, lx, my, lz, mh - 1);
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
                    spawnDungeon(data, lx, dungeonY, lz, srng);

                    if (surfaceY > WATER_LEVEL + 1) {
                        spawnDungeonMarker(data, lx, surfaceY, lz);
                        spawnDungeonEntrance(data, lx, dungeonY, lz, surfaceY);
                    }
                }
            }

            // NPC-Dorf (Tier 3): biome-specific villages in plains, desert and snow.
            // Dörfer sind größer als ein Chunk, deshalb werden auch Nachbar-Quellchunks geprüft,
            // damit Häuser/Fundamente/Dächer an Chunkgrenzen nicht abgeschnitten schweben.
            const village = getVillageCandidate(scx, scz);
            if (village) {
                const lx = village.x - cx * CHUNK_SIZE;
                const lz = village.z - cz * CHUNK_SIZE;
                const vInfo = spawnVillage(data, lx, village.baseY, lz, srng, village.x, village.z, village.biome, village.variant);
                // Welt-Koordinaten für NPC-Spawn
                if (scx === cx && scz === cz) {
                    vInfo.cx = cx;
                    vInfo.cz = cz;
                    vInfo.houses.forEach(h => {
                        h.x = h.x + cx * CHUNK_SIZE;
                        h.z = h.z + cz * CHUNK_SIZE;
                    });
                    villageInfos.push(vInfo);
                }
            }
        }
    }

    return { data, villageInfos };
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

                // Helper: push atlasUV-Sentinel (-1,-1) für N Vertices (Special-Blocks ohne Tiling)
                const pushAtlasSentinel = (n) => { for (let i = 0; i < n; i++) atlasUV.push(-1, -1); };

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

                    const texIdx = BLOCK_TEX[blockType] || 15;
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
                    const rotation = blockMeta[wx + ',' + y + ',' + wz] || 0;
                    const dR = 1, dG = 1, dB = 1;
                    const texIdx = BLOCK_TEX[blockType] || 0;
                    const u0 = (texIdx % 16) / 16, v0 = 1 - (Math.floor(texIdx / 16) + 1) / 16;
                    const u1 = u0 + 1 / 16, v1 = v0 + 1 / 16;
                    const thick = 0.15;

                    let front_x0, front_x1, front_z0, front_z1, back_x0, back_x1, back_z0, back_z1;
                    let front_nx, front_nz, back_nx, back_nz;

                    if (rotation === 1) {
                      front_x0 = x + 0.5 - thick / 2; front_x1 = x + 0.5 + thick / 2;
                      front_z0 = z; front_z1 = z + 1;
                      back_x0 = x + 0.5 + thick / 2; back_x1 = x + 0.5 - thick / 2;
                      back_z0 = z + 1; back_z1 = z;
                      front_nx = -1; front_nz = 0;
                      back_nx = 1; back_nz = 0;
                    } else {
                      front_x0 = x; front_x1 = x + 1;
                      front_z0 = z + 0.5 - thick / 2; front_z1 = z + 0.5 + thick / 2;
                      back_x0 = x + 1; back_x1 = x;
                      back_z0 = z + 0.5 + thick / 2; back_z1 = z + 0.5 - thick / 2;
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
                    const pR = 0.6, pG = 0.6, pB = 0.6;
                    const texIdx = BLOCK_TEX[79] || 2;
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
                    const texIdx = BLOCK_TEX[blockType] || 0;
                    const u0 = (texIdx % 16) / 16, v0 = 1 - (Math.floor(texIdx / 16) + 1) / 16;
                    const u1 = u0 + 1 / 16, v1 = v0 + 1 / 16;
                    const bh = 0.5;
                    // Oberseite
                    let st = vc;
                    pos.push(x, y + bh, z + 1, x + 1, y + bh, z + 1, x + 1, y + bh, z, x, y + bh, z);
                    col.push(bR, bG, bB, bR, bG, bB, bR, bG, bB, bR, bG, bB);
                    norm.push(0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0);
                    uv.push(u0, v0, u1, v0, u1, v1, u0, v1);
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

                        // Gras: Unterschiedliche Texturen pro Seite
                        if (blockType === 1) {
                            if (f.d[1] === 1) texIdx = 0;
                            else if (f.d[1] === -1) texIdx = 1;
                            else texIdx = 53;
                        }

                        const eps = 0.5 / 1024;
                        const u0 = (texIdx % 16) / 16 + eps;
                        const v0 = 1 - (Math.floor(texIdx / 16) + 1) / 16 + eps;
                        const u1 = u0 + 1 / 16 - 2 * eps;
                        const v1 = v0 + 1 / 16 - 2 * eps;
                        const uvs = [u0, v0, u1, v0, u1, v1, u0, v1];

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
                        const canGreedyMerge = !isWater &&
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
        return;
    }

    if (e.data.type === 'generate') {
        const { cx, cz, epoch } = e.data;
        const buffer = e.data.buffer || new ArrayBuffer(CHUNK_SIZE * CHUNK_HEIGHT * CHUNK_SIZE);
        const result = generateTerrain(cx, cz, buffer);
        const data = result.data;
        const villageInfos = result.villageInfos || [];

        self.postMessage({ type: 'terrain', cx, cz, epoch, data, villageInfos }, [data.buffer]);
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
        const opaque = buildMesh(cx, cz, getBlock, false, blockMeta || {});
        // Water Mesh
        const water = buildMesh(cx, cz, getBlock, true, blockMeta || {});

        const transferables = [];
        const result = { type: 'meshResult', cx, cz, epoch, opaque: null, water: null };

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
