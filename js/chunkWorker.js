let CHUNK_SIZE = 16, CHUNK_HEIGHT = 64, WATER_LEVEL = 32, CLOUD_HEIGHT = 50;
const BIOMES = { OCEAN: 'Ozean', DESERT: 'Wüste', JUNGLE: 'Urwald', SNOW: 'Schneefeld', PLAINS: 'Grasland' };

function mulberry32(a) {
    return function () {
        var t = a += 0x6D2B79F5;
        t = Math.imul(t ^ t >>> 15, t | 1);
        t ^= t + Math.imul(t ^ t >>> 7, t | 61);
        return ((t ^ t >>> 14) >>> 0) / 4294967296;
    }
}

function noise2D(x, z, seed = 123) {
    const getComp = (f, a) => (Math.sin(x * f + seed) + Math.cos(z * f + seed)) * a;
    return getComp(0.1, 2) + getComp(0.05, 4) + getComp(0.02, 5); 
}

function getFloatingIslandAt(wx, wz) {
    const cellSize = 100;
    const cellX = Math.floor(wx / cellSize);
    const cellZ = Math.floor(wz / cellSize);
    
    // Deterministischer Seed für 100x100 Zelle
    const rng = mulberry32(cellX * 91827 + cellZ * 12345);
    
    // 30% Chance für eine Insel
    if (rng() > 0.3) return null;
    
    const centerX = cellX * cellSize + 20 + rng() * 60;
    const centerZ = cellZ * cellSize + 20 + rng() * 60;
    const islandRadius = 6 + rng() * 4; // 12-20 Blöcke gross
    const islandY = 48 + rng() * 5; 
    
    const dx = wx - centerX;
    const dz = wz - centerZ;
    const distSq = dx*dx + dz*dz;
    
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

self.onmessage = function(e) {
    if (e.data.type === 'init') {
        CHUNK_SIZE = e.data.config.CHUNK_SIZE;
        CHUNK_HEIGHT = e.data.config.CHUNK_HEIGHT;
        WATER_LEVEL = e.data.config.WATER_LEVEL;
        CLOUD_HEIGHT = e.data.config.CLOUD_HEIGHT;
        return;
    }
    
    if (e.data.type === 'generate') {
        const { cx, cz } = e.data;
        const buffer = e.data.buffer || new ArrayBuffer(CHUNK_SIZE * CHUNK_HEIGHT * CHUNK_SIZE);
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
                    
                    // SCHWEBENDE INSELN:
                    if (island) {
                        if (y >= island.y && y < island.y + island.thick) {
                            data[idx] = (y === island.y + island.thick - 1) ? 1 : 2; // Gras / Erde
                            continue;
                        } 
                        else if (y >= island.y - 7 && y < island.y) {
                            const hasVines = mulberry32(wx * 333 + wz * 444)() < 0.25;
                            if (hasVines) {
                                const dropLength = 3 + Math.floor(mulberry32(wx * 555 + wz * 666)() * 5);
                                if (island.y - y <= dropLength) {
                                    data[idx] = (biome === BIOMES.SNOW) ? 12 : 6; // ICE : LEAVES
                                    continue;
                                }
                            }
                        }
                    }
                    
                    if (y === 1 && rng() < 0.5) { data[idx] = 20; continue; }

                    if (y < h - 4) data[idx] = 3;
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
                
                // === SEAGRASS unter Wasser (nur ab 3 Blöcke Tiefe) ===
                if (h <= WATER_LEVEL - 3 && rng() < 0.15) {
                    const seagrassY = Math.floor(h) + 1;
                    if (seagrassY <= WATER_LEVEL) {
                        data[(seagrassY * CHUNK_SIZE * CHUNK_SIZE) + (z * CHUNK_SIZE) + x] = 54;
                    }
                }
                
                if (h > WATER_LEVEL + 1) {
                    const surfIdx = (h * CHUNK_SIZE * CHUNK_SIZE) + (z * CHUNK_SIZE) + x;
                    
                    // === GRASLAND ===
                    if (biome === BIOMES.PLAINS) {
                        const r = rng();
                        if (r < 0.03) {
                            // Blumen (wie bisher)
                            data[surfIdx] = rng() < 0.5 ? 9 : 10;
                        } else if (r < 0.28) {
                            // Hohes Gras (25% Chance)
                            data[surfIdx] = 44;
                        } else if (r < 0.30) {
                            // Beerenbusch (2% Chance)
                            data[surfIdx] = 43;
                        }
                    }
                    
                    // === WÜSTE ===
                    if (biome === BIOMES.DESERT) {
                        const r = rng();
                        if (r < 0.01) {
                            // Kaktus (1-3 Blöcke hoch)
                            const ch = 1 + Math.floor(rng() * 3);
                            for (let cy = 0; cy < ch; cy++) {
                                if (h + cy < CHUNK_HEIGHT) {
                                    data[((h + cy) * CHUNK_SIZE * CHUNK_SIZE) + (z * CHUNK_SIZE) + x] = 45;
                                }
                            }
                        } else if (r < 0.03) {
                            // Toter Strauch (2% Chance)
                            data[surfIdx] = 46;
                        }
                    }
                    
                    // === URWALD ===
                    if (biome === BIOMES.JUNGLE) {
                        const r = rng();
                        if (r < 0.15) {
                            // Farn (15% Chance)
                            data[surfIdx] = 50;
                        } else if (r < 0.19) {
                            // Beerenbusch (4% Chance im Urwald)
                            data[surfIdx] = 43;
                        } else if (r < 0.21) {
                            // Roter Pilz (2% Chance)
                            data[surfIdx] = 47;
                        } else if (r < 0.23) {
                            // Brauner Pilz (2% Chance)
                            data[surfIdx] = 48;
                        }
                    }
                    
                    // === SCHNEEFELD ===
                    if (biome === BIOMES.SNOW && rng() < 0.005) {
                        const rh = 1 + Math.floor(rng() * 3);
                        for (let ry = 0; ry < rh; ry++) {
                            if (h + ry < CHUNK_HEIGHT) data[((h + ry) * CHUNK_SIZE * CHUNK_SIZE) + (z * CHUNK_SIZE) + x] = 3;
                        }
                    }
                    
                    // === ZUCKERROHR AN UFERN ===
                    // Wenn neben dem Wasser (y == WATER_LEVEL + 1), Zuckerrohr spawnen
                    if (h === WATER_LEVEL + 1 && (biome === BIOMES.PLAINS || biome === BIOMES.JUNGLE)) {
                        // Prüfe ob Nachbar-Block Wasser ist (vereinfacht via Höhenvergleich)
                        const isShore = rng() < 0.08;
                        if (isShore) {
                            const sh = 1 + Math.floor(rng() * 3); // 1-3 hoch
                            for (let sy = 0; sy < sh; sy++) {
                                if (h + sy < CHUNK_HEIGHT) {
                                    data[((h + sy) * CHUNK_SIZE * CHUNK_SIZE) + (z * CHUNK_SIZE) + x] = 49;
                                }
                            }
                        }
                    }
                    
                    // === BÄUME (wie bisher) ===
                    const tc = (biome === BIOMES.JUNGLE) ? 0.08 : (biome === BIOMES.PLAINS) ? 0.015 : 0;
                    if (rng() < tc) spawnTree(data, x, h, z, biome, rng);
                    if (biome === BIOMES.DESERT && rng() < 0.008) spawnPalm(data, x, h, z, rng);
                }
            }
        }
        
        self.postMessage({ cx, cz, data }, [data.buffer]);
    }
};
