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
const TRANSPARENT_IDS = new Set([0, -1, 4, 9, 10, 27, 32, 33, 34, 36, 38, 39, 43, 44, 46, 47, 48, 49, 50, 52, 54, 79, 80]);

// 2D-Pflanzen (Stern-Mesh statt Würfel)
const PLANT_2D_IDS = new Set([9, 10, 27, 43, 44, 46, 47, 48, 49, 50, 52, 54]);

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
    if (temp < -0.6) return BIOMES.SNOW;
    if (temp > 0.5) return humidity < -0.3 ? BIOMES.DESERT : BIOMES.JUNGLE;
    return humidity < -0.25 ? BIOMES.OCEAN : BIOMES.PLAINS;
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
    for (let ty = 0; ty < th; ty++) {
        let ox = 0, oz = 0;
        if (ty > 2) { ox = Math.floor(rng() * 2); oz = Math.floor(rng() * 2); }
        const wx = x + ox, wz = z + oz, wy = h + ty;
        if (wx >= 0 && wx < CHUNK_SIZE && wz >= 0 && wz < CHUNK_SIZE && wy < CHUNK_HEIGHT)
            data[(wy * CHUNK_SIZE * CHUNK_SIZE) + (wz * CHUNK_SIZE) + wx] = 15;
    }
    for (let i = 0; i < 5; i++) {
        const lx = Math.floor(Math.cos(i * 1.5) * 2), lz = Math.floor(Math.sin(i * 1.5) * 2);
        const wx = x + lx, wz = z + lz, wy = h + th;
        if (wx >= 0 && wx < CHUNK_SIZE && wz >= 0 && wz < CHUNK_SIZE && wy < CHUNK_HEIGHT)
            data[(wy * CHUNK_SIZE * CHUNK_SIZE) + (wz * CHUNK_SIZE) + wx] = 16;
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

// Wüstentempel: 11×11 Sandstein-Pyramide mit versteckter Kammer
function spawnDesertTemple(data, x, y, z) {
    const size = 11;
    // Pyramide Schicht für Schicht
    for (let level = 0; level < 6; level++) {
        const half = Math.floor(size / 2) - level;
        if (half < 0) break;
        for (let dx = -half; dx <= half; dx++) {
            for (let dz = -half; dz <= half; dz++) {
                const isEdge = (Math.abs(dx) === half || Math.abs(dz) === half);
                setBlockLocal(data, x + dx, y + level, z + dz, isEdge ? 82 : 30); // SANDSTONE_CARVED / SANDSTONE
            }
        }
    }
    // Versteckte Kammer im Innern (y-1 bis y+2)
    for (let dy = -2; dy < 3; dy++) {
        for (let dx = -2; dx <= 2; dx++) {
            for (let dz = -2; dz <= 2; dz++) {
                setBlockLocal(data, x + dx, y + dy, z + dz, 0); // Hohlraum
            }
        }
    }
    // Boden der Kammer aus Sandstein
    for (let dx = -2; dx <= 2; dx++) {
        for (let dz = -2; dz <= 2; dz++) {
            setBlockLocal(data, x + dx, y - 3, z + dz, 30);
        }
    }
    // Druckplatten-Falle (Eingang)
    setBlockLocal(data, x, y - 2, z + 3, 79);  // PRESSURE_PLATE Eingang
    // Truhe in der Kammer
    setBlockLocal(data, x, y - 2, z - 2, 75); // CHEST
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
    for (let dx = -(r - 1); dx <= r - 1; dx++) {
        for (let dz = -(r - 1); dz <= r - 1; dz++) {
            for (let dy = 1; dy <= r - 1; dy++) {
                if (Math.sqrt(dx * dx + dz * dz + dy * dy) < r - 0.5) {
                    setBlockLocal(data, x + dx, y + dy, z + dz, 0);
                }
            }
        }
    }
    // Eisboden
    for (let dx = -(r - 1); dx <= r - 1; dx++) {
        for (let dz = -(r - 1); dz <= r - 1; dz++) {
            setBlockLocal(data, x + dx, y, z + dz, 78); // ICE_BLOCK
        }
    }
    // Bett und Truhe innen
    setBlockLocal(data, x - 2, y + 1, z, 38);  // BED_HEAD
    setBlockLocal(data, x - 1, y + 1, z, 39);  // BED_FOOT
    setBlockLocal(data, x + 2, y + 1, z, 75);  // CHEST
}

function generateTerrain(cx, cz, buffer) {
    const data = new Uint8Array(buffer);
    data.fill(0);
    const rng = mulberry32(cx * 1000 + cz);

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
                    if (cloudLarge > 0.75 || cloudN > 0.7 || (cloudN > 0.4 && rng() < 0.1)) data[idx] = 8;
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
                    const r = rng();
                    if (r < 0.03) data[surfIdx] = rng() < 0.5 ? 9 : 10;
                    else if (r < 0.28) data[surfIdx] = 44;
                    else if (r < 0.30) data[surfIdx] = 43;
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
                    if (r < 0.15) data[surfIdx] = 50;
                    else if (r < 0.19) data[surfIdx] = 43;
                    else if (r < 0.21) data[surfIdx] = 47;
                    else if (r < 0.23) data[surfIdx] = 48;
                }
                if (biome === BIOMES.SNOW && rng() < 0.005) {
                    const rh = 1 + Math.floor(rng() * 3);
                    for (let ry = 0; ry < rh; ry++) {
                        if (h + ry < CHUNK_HEIGHT) data[((h + ry) * CHUNK_SIZE * CHUNK_SIZE) + (z * CHUNK_SIZE) + x] = 3;
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
                const tc = (biome === BIOMES.JUNGLE) ? 0.08 : (biome === BIOMES.PLAINS) ? 0.015 : 0;
                if (rng() < tc) spawnTree(data, x, h, z, biome, rng);
                if (biome === BIOMES.DESERT && rng() < 0.008) spawnPalm(data, x, h, z, rng);
            }
        }
    }

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
                if (getBiomeAt(tx, tz) === BIOMES.DESERT) {
                    const th = Math.floor(noise2D(tx, tz) + 38 + Math.sin(tx * 0.2) * 2);
                    if (th > WATER_LEVEL) {
                        const lx = tx - cx * CHUNK_SIZE;
                        const lz = tz - cz * CHUNK_SIZE;
                        spawnDesertTemple(data, lx, th, lz);
                    }
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
        }
    }

    return data;
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

                // Gras: Weiße Vertex-Color für unverfälschte HD-Textur
                if (blockType === 1) {
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

                    // Weiße Vertex-Color für Textur-Atlas
                    const pVar = 0.8 + rng2() * 0.4;
                    const pR = pVar, pG = pVar, pB = pVar;

                    const texIdx = BLOCK_TEX[blockType] || 15;
                    const u0 = (texIdx % 16) / 16, v0 = 1 - (Math.floor(texIdx / 16) + 1) / 16;
                    const u1 = u0 + 1 / 16, v1 = v0 + 1 / 16;

                    for (let i = 0; i < 3; i++) {
                        const angle = (i * Math.PI) / 3;
                        const c = Math.cos(angle) * 0.5;
                        const s = Math.sin(angle) * 0.5;
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
                        const allBright = !isWater &&
                            aoValues[0] === 3 && aoValues[1] === 3 &&
                            aoValues[2] === 3 && aoValues[3] === 3;

                        if (allBright) {
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
                        if (type === 1) { qR = qG = qB = 1; } // Gras: weiße Vertex-Color

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

// Cache für generierte Chunk-Daten (damit Mesh-Requests die Daten nicht nochmal brauchen)
const chunkCache = new Map();

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
        const { cx, cz } = e.data;
        const buffer = e.data.buffer || new ArrayBuffer(CHUNK_SIZE * CHUNK_HEIGHT * CHUNK_SIZE);
        const data = generateTerrain(cx, cz, buffer);

        // Cache für spätere Mesh-Requests — speichere eine KOPIE, da der Buffer transferiert wird
        chunkCache.set(cx + ',' + cz, new Uint8Array(data));

        self.postMessage({ type: 'terrain', cx, cz, data }, [data.buffer]);
        return;
    }

    if (e.data.type === 'mesh') {
        const { cx, cz, centerData, neighbors, blockMeta } = e.data;

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
        const result = { type: 'meshResult', cx, cz, opaque: null, water: null };

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
