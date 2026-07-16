import * as THREE from 'three';

export const BLOCK_TYPES = {
        AIR: 0, GRASS: 1, DIRT: 2, STONE: 3, WATER: 4, WOOD: 5, LEAVES: 6, SAND: 7, CLOUD: 8, FLOWER_RED: 9, FLOWER_YELLOW: 10, SNOW: 11, ICE: 12, JUNGLE_WOOD: 13, JUNGLE_LEAVES: 14, PALM_WOOD: 15, PALM_LEAVES: 16, EGG: 17, MILK: 18, WOOL: 19, BEDROCK: 20, FISH: 21, RAW_MEAT: 22, RAW_CHICKEN: 23, ROTTEN_FLESH: 24, MUTTON: 25, PLANKS: 26, STICK: 27, WORKBENCH: 28, STONE_BRICK: 29, SANDSTONE: 30, BONE: 31, WINDOW: 32, DOOR_BOTTOM: 33, DOOR_TOP: 34, WORKBENCH_SIDE: 36, BED_HEAD: 38, BED_FOOT: 39,
        BERRY_BUSH: 43, TALL_GRASS: 44, CACTUS: 45, DEAD_BUSH: 46, MUSHROOM_RED: 47, MUSHROOM_BROWN: 48, SUGARCANE: 49, FERN: 50, BERRIES: 51, BERRY_BUSH_EMPTY: 52, SEAGRASS: 54, TURTLE_MEAT: 55,
        COAL_ORE: 56, IRON_ORE: 57, GOLD_ORE: 58, FURNACE: 59,
        COAL: 60, IRON_INGOT: 61, GOLD_INGOT: 62,
        WOOD_PICKAXE: 63, STONE_PICKAXE: 64, IRON_PICKAXE: 65, GOLD_PICKAXE: 66,
        WOOD_AXE: 67, STONE_AXE: 68, IRON_AXE: 69, GOLD_AXE: 70,
        WOOD_SHOVEL: 71, STONE_SHOVEL: 72, IRON_SHOVEL: 73, GOLD_SHOVEL: 74,
        CHEST: 75,
        SNOW_BLOCK: 77, ICE_BLOCK: 78, PRESSURE_PLATE: 79, MINE_RAIL: 80, MINE_SUPPORT: 81, SANDSTONE_CARVED: 82,
        SPAWNER: 83, MOSSY_STONE: 84, COBBLESTONE: 85, FIRE: 86, VILLAGE_PATH: 87, HAY_BALE: 88,
        WOOD_SWORD: 89, STONE_SWORD: 90, IRON_SWORD: 91, GOLD_SWORD: 92
        };

        export const BLOCK_COLORS = {
            [BLOCK_TYPES.GRASS]: 0x3B8C1E, [BLOCK_TYPES.DIRT]: 0x5C3F28, [BLOCK_TYPES.STONE]: 0x808080, [BLOCK_TYPES.WATER]: 0x40a4df,
            [BLOCK_TYPES.WOOD]: 0x5D4037, [BLOCK_TYPES.LEAVES]: 0x2e5e22, [BLOCK_TYPES.SAND]: 0xEDC9AF, [BLOCK_TYPES.CLOUD]: 0xffffff,
            [BLOCK_TYPES.FLOWER_RED]: 0xff0000, [BLOCK_TYPES.FLOWER_YELLOW]: 0xffff00, [BLOCK_TYPES.SNOW]: 0xffffff,
            [BLOCK_TYPES.ICE]: 0xa5f2f3, [BLOCK_TYPES.JUNGLE_WOOD]: 0x3d2b1f, [BLOCK_TYPES.JUNGLE_LEAVES]: 0x1a4a15,
            [BLOCK_TYPES.PALM_WOOD]: 0xAC8E68, [BLOCK_TYPES.PALM_LEAVES]: 0x3A5F0B, [BLOCK_TYPES.WOOL]: 0xffffff, [BLOCK_TYPES.BEDROCK]: 0x222222, [BLOCK_TYPES.FISH]: 0xFF9800, [BLOCK_TYPES.RAW_MEAT]: 0xFF9999, [BLOCK_TYPES.RAW_CHICKEN]: 0xFFEEBB, [BLOCK_TYPES.ROTTEN_FLESH]: 0x3a5f0b, [BLOCK_TYPES.MUTTON]: 0xFFB6C1,
            [BLOCK_TYPES.PLANKS]: 0xCD853F, [BLOCK_TYPES.STICK]: 0x8B4513, [BLOCK_TYPES.WORKBENCH]: 0xA0522D, [BLOCK_TYPES.STONE_BRICK]: 0x696969, [BLOCK_TYPES.SANDSTONE]: 0xF4A460, [BLOCK_TYPES.BONE]: 0xFFFFFF,
            [BLOCK_TYPES.WINDOW]: 0x88CCEE, [BLOCK_TYPES.DOOR_BOTTOM]: 0xA0724A, [BLOCK_TYPES.DOOR_TOP]: 0xA0724A, [BLOCK_TYPES.BED_HEAD]: 0xCC3333, [BLOCK_TYPES.BED_FOOT]: 0xCC3333,
            [BLOCK_TYPES.WORKBENCH_SIDE]: 0xA0522D,
            [BLOCK_TYPES.BERRY_BUSH]: 0x2E7D32, [BLOCK_TYPES.TALL_GRASS]: 0x4CAF50, [BLOCK_TYPES.CACTUS]: 0x2E7D32, [BLOCK_TYPES.DEAD_BUSH]: 0x8D6E63, [BLOCK_TYPES.MUSHROOM_RED]: 0xE53935, [BLOCK_TYPES.MUSHROOM_BROWN]: 0x795548, [BLOCK_TYPES.SUGARCANE]: 0x81C784, [BLOCK_TYPES.FERN]: 0x388E3C, [BLOCK_TYPES.BERRIES]: 0xE53935, [BLOCK_TYPES.BERRY_BUSH_EMPTY]: 0x33691E, [BLOCK_TYPES.SEAGRASS]: 0x2E8B57, [BLOCK_TYPES.TURTLE_MEAT]: 0x4A7A3D,
            [BLOCK_TYPES.COAL_ORE]: 0x666666, [BLOCK_TYPES.IRON_ORE]: 0x8C7A6B, [BLOCK_TYPES.GOLD_ORE]: 0x9B8A00, [BLOCK_TYPES.FURNACE]: 0x5A5A5A,
            [BLOCK_TYPES.COAL]: 0x222222, [BLOCK_TYPES.IRON_INGOT]: 0xC0C0C0, [BLOCK_TYPES.GOLD_INGOT]: 0xFFD700,
            [BLOCK_TYPES.WOOD_PICKAXE]: 0xCD853F, [BLOCK_TYPES.STONE_PICKAXE]: 0x808080, [BLOCK_TYPES.IRON_PICKAXE]: 0xC0C0C0, [BLOCK_TYPES.GOLD_PICKAXE]: 0xFFD700,
            [BLOCK_TYPES.WOOD_AXE]: 0xCD853F, [BLOCK_TYPES.STONE_AXE]: 0x808080, [BLOCK_TYPES.IRON_AXE]: 0xC0C0C0, [BLOCK_TYPES.GOLD_AXE]: 0xFFD700,
            [BLOCK_TYPES.WOOD_SHOVEL]: 0xCD853F, [BLOCK_TYPES.STONE_SHOVEL]: 0x808080, [BLOCK_TYPES.IRON_SHOVEL]: 0xC0C0C0, [BLOCK_TYPES.GOLD_SHOVEL]: 0xFFD700,
            [BLOCK_TYPES.CHEST]: 0xA0724A,
            [BLOCK_TYPES.SNOW_BLOCK]: 0xF0F0F0, [BLOCK_TYPES.ICE_BLOCK]: 0x99DDEE, [BLOCK_TYPES.PRESSURE_PLATE]: 0x999999, [BLOCK_TYPES.MINE_RAIL]: 0x888888, [BLOCK_TYPES.MINE_SUPPORT]: 0x6B4226, [BLOCK_TYPES.SANDSTONE_CARVED]: 0xD2A85A,
            [BLOCK_TYPES.SPAWNER]: 0x1A1A2E, [BLOCK_TYPES.MOSSY_STONE]: 0x5A7A5A, [BLOCK_TYPES.COBBLESTONE]: 0x7A7A7A, [BLOCK_TYPES.FIRE]: 0xFF6600, [BLOCK_TYPES.VILLAGE_PATH]: 0x8B6B3D, [BLOCK_TYPES.HAY_BALE]: 0xD4A820,
            [BLOCK_TYPES.WOOD_SWORD]: 0xCD853F, [BLOCK_TYPES.STONE_SWORD]: 0x888888, [BLOCK_TYPES.IRON_SWORD]: 0xC0C0C0, [BLOCK_TYPES.GOLD_SWORD]: 0xFFD700
        };

        export const BLOCK_TEX = {
            [BLOCK_TYPES.GRASS]: 0, [BLOCK_TYPES.DIRT]: 1, [BLOCK_TYPES.STONE]: 2, [BLOCK_TYPES.WATER]: 3,
            [BLOCK_TYPES.WOOD]: 4, [BLOCK_TYPES.LEAVES]: 5, [BLOCK_TYPES.SAND]: 6, [BLOCK_TYPES.CLOUD]: 7,
            [BLOCK_TYPES.SNOW]: 8, [BLOCK_TYPES.ICE]: 9, [BLOCK_TYPES.JUNGLE_WOOD]: 10, [BLOCK_TYPES.JUNGLE_LEAVES]: 11,
            [BLOCK_TYPES.PALM_WOOD]: 12, [BLOCK_TYPES.PALM_LEAVES]: 13, [BLOCK_TYPES.BEDROCK]: 14,
            [BLOCK_TYPES.FLOWER_RED]: 15, [BLOCK_TYPES.FLOWER_YELLOW]: 16,
            [BLOCK_TYPES.PLANKS]: 27, [BLOCK_TYPES.STICK]: 28, [BLOCK_TYPES.WORKBENCH]: 29, [BLOCK_TYPES.STONE_BRICK]: 30, [BLOCK_TYPES.SANDSTONE]: 31, [BLOCK_TYPES.BONE]: 32, [BLOCK_TYPES.WORKBENCH_SIDE]: 36,
            [BLOCK_TYPES.WINDOW]: 38, [BLOCK_TYPES.DOOR_BOTTOM]: 39, [BLOCK_TYPES.DOOR_TOP]: 40, [BLOCK_TYPES.BED_HEAD]: 41, [BLOCK_TYPES.BED_FOOT]: 42,
            [BLOCK_TYPES.BERRY_BUSH]: 43, [BLOCK_TYPES.TALL_GRASS]: 44, [BLOCK_TYPES.CACTUS]: 45, [BLOCK_TYPES.DEAD_BUSH]: 46, [BLOCK_TYPES.MUSHROOM_RED]: 47, [BLOCK_TYPES.MUSHROOM_BROWN]: 48, [BLOCK_TYPES.SUGARCANE]: 49, [BLOCK_TYPES.FERN]: 50, [BLOCK_TYPES.BERRIES]: 51, [BLOCK_TYPES.BERRY_BUSH_EMPTY]: 52, [BLOCK_TYPES.SEAGRASS]: 54,
            [BLOCK_TYPES.COAL_ORE]: 56, [BLOCK_TYPES.IRON_ORE]: 57, [BLOCK_TYPES.GOLD_ORE]: 58, [BLOCK_TYPES.FURNACE]: 59,
            [BLOCK_TYPES.COAL]: 60, [BLOCK_TYPES.IRON_INGOT]: 61, [BLOCK_TYPES.GOLD_INGOT]: 62,
            [BLOCK_TYPES.WOOD_PICKAXE]: 63, [BLOCK_TYPES.STONE_PICKAXE]: 64, [BLOCK_TYPES.IRON_PICKAXE]: 65, [BLOCK_TYPES.GOLD_PICKAXE]: 66,
            [BLOCK_TYPES.WOOD_AXE]: 67, [BLOCK_TYPES.STONE_AXE]: 68, [BLOCK_TYPES.IRON_AXE]: 69, [BLOCK_TYPES.GOLD_AXE]: 70,
            [BLOCK_TYPES.WOOD_SHOVEL]: 71, [BLOCK_TYPES.STONE_SHOVEL]: 72, [BLOCK_TYPES.IRON_SHOVEL]: 73, [BLOCK_TYPES.GOLD_SHOVEL]: 74,
            [BLOCK_TYPES.CHEST]: 75,
            [BLOCK_TYPES.SNOW_BLOCK]: 8, [BLOCK_TYPES.ICE_BLOCK]: 9, [BLOCK_TYPES.PRESSURE_PLATE]: 79, [BLOCK_TYPES.MINE_RAIL]: 80, [BLOCK_TYPES.MINE_SUPPORT]: 81, [BLOCK_TYPES.SANDSTONE_CARVED]: 82,
            [BLOCK_TYPES.SPAWNER]: 83, [BLOCK_TYPES.MOSSY_STONE]: 84, [BLOCK_TYPES.COBBLESTONE]: 85, [BLOCK_TYPES.FIRE]: 86, [BLOCK_TYPES.VILLAGE_PATH]: 87, [BLOCK_TYPES.HAY_BALE]: 88,
            [BLOCK_TYPES.WOOD_SWORD]: 89, [BLOCK_TYPES.STONE_SWORD]: 90, [BLOCK_TYPES.IRON_SWORD]: 91, [BLOCK_TYPES.GOLD_SWORD]: 92
        };

// --- TEXTURE GENERATOR ---
        export function createTextureAtlas() {
            const canvas = document.createElement('canvas');
            canvas.width = 1024; canvas.height = 1024; // 64x64 pro Tile (16x16 Grid)
            const ctx = canvas.getContext('2d');
            
            
            const drawTile = (tx, ty, drawFunc) => {
                const actualX = (tx % 16) * 64;
                const actualY = Math.floor(tx / 16) * 64;
                ctx.save(); ctx.translate(actualX, actualY);
                drawFunc(ctx);
                ctx.restore();
            };

            const drawNoise = (c, w, h, size, colors) => {
                for(let x=0; x<w; x+=size) {
                    for(let y=0; y<h; y+=size) {
                        c.fillStyle = colors[Math.floor(Math.random() * colors.length)];
                        c.fillRect(x, y, size, size);
                    }
                }
            };
            
            const pixelDraw = (c, w, h, pixelSize, fn) => {
                 for(let y=0; y<h; y+=pixelSize) {
                     for(let x=0; x<w; x+=pixelSize) {
                         const color = fn(x, y);
                         if (color) { c.fillStyle = color; c.fillRect(x, y, pixelSize, pixelSize); }
                     }
                 }
            };

            // Hilfsfunktion: Zeichnet eine 16x16 Pixel-Map auf ein 64x64 Tile
            const pixelMapDraw = (c, map, palette) => {
                const pw = 64 / 16; // = 4 Pixel pro Map-Pixel
                for (let row = 0; row < map.length; row++) {
                    for (let col = 0; col < map[row].length; col++) {
                        const ch = map[row][col];
                        if (palette[ch]) {
                            c.fillStyle = palette[ch];
                            c.fillRect(col * pw, row * pw, pw, pw);
                        }
                    }
                }
            };

            // GRAS OBEN (Tile 0) – Komplett grüne Pixeltextur wie Minecraft
            drawTile(0, 0, (c) => {
                const grassPalette = {
                    '1': '#3B8C1E', // Satt-Grün
                    '2': '#2E7A18', // Mittel-Grün
                    '3': '#4A9928', // Leucht-Grün
                    '4': '#266B12', // Dunkel-Grün
                    '5': '#389020', // Kräftig-Grün
                    '6': '#2F7A16'  // Schatten-Grün
                };
                const grassMap = [
                    "1234512345123451",
                    "3516234156234152",
                    "2143651234516234",
                    "5631243561243516",
                    "4215634215634215",
                    "1346521346521346",
                    "6524136252413652",
                    "3261456321456321",
                    "1453261453261453",
                    "5316425316425316",
                    "2641532641532641",
                    "4123654123654123",
                    "6352146352146352",
                    "1246531246531246",
                    "3514263514263514",
                    "2631425263142526"
                ];
                pixelMapDraw(c, grassMap, grassPalette);
            });
            // ERDE (Dunkles Braun mit Steinkrümeln und Wurzel-Details)
            drawTile(1, 0, (c) => {
                const browns = ['#6B4F35', '#5C3F28', '#4F3320', '#604030', '#3E2618'];
                pixelDraw(c, 64, 64, 2, (x, y) => browns[Math.floor(Math.random() * browns.length)]);
                // Kleine Steinchen
                for (let i = 0; i < 8; i++) {
                    c.fillStyle = ['#9E9E9E', '#8D8D8D'][Math.floor(Math.random() * 2)];
                    c.fillRect(Math.random()*60+2, Math.random()*60+2, 4, 2);
                }
                // Tiefe durch leichten Schatten
                const grad = c.createLinearGradient(0, 0, 0, 64);
                grad.addColorStop(0, 'rgba(255,255,255,0.05)'); grad.addColorStop(1, 'rgba(0,0,0,0.1)');
                c.fillStyle = grad; c.fillRect(0, 0, 64, 64);
            });
            // STEIN (Realistisch mit Rissen und Mineralien)
            drawTile(2, 0, (c) => {
                // Basis-Grau mit feiner Körnung
                const grays = ['#8A8A8A', '#959595', '#7E7E7E', '#888888', '#929292'];
                pixelDraw(c, 64, 64, 2, (x, y) => grays[Math.floor(Math.random() * grays.length)]);
                // Dunklere Adern/Risse
                c.strokeStyle = 'rgba(0,0,0,0.2)'; c.lineWidth = 1;
                for (let i = 0; i < 5; i++) {
                    c.beginPath();
                    let rx = Math.random()*64, ry = Math.random()*64;
                    c.moveTo(rx, ry);
                    for (let j = 0; j < 3; j++) { rx += (Math.random()-0.5)*20; ry += (Math.random()-0.5)*20; c.lineTo(rx, ry); }
                    c.stroke();
                }
                // Helle Mineralien-Flecken
                for (let i = 0; i < 4; i++) {
                    c.fillStyle = 'rgba(180,180,180,0.4)';
                    c.fillRect(Math.random()*56+4, Math.random()*56+4, 6, 4);
                }
                // Kanten-Tiefe
                c.fillStyle = 'rgba(0,0,0,0.08)'; c.fillRect(0, 0, 64, 2); c.fillRect(0, 0, 2, 64);
                c.fillStyle = 'rgba(255,255,255,0.06)'; c.fillRect(0, 62, 64, 2); c.fillRect(62, 0, 2, 64);
            });
            // WASSER (Tiefes Ozeanblau mit Kaustik-Effekt)
            drawTile(3, 0, (c) => {
                c.fillStyle = 'rgba(20, 120, 200, 0.55)'; c.fillRect(0, 0, 64, 64);
                // Sanfte Wellen-Farbvariation
                pixelDraw(c, 64, 64, 4, (x, y) => {
                    const wave = Math.sin(x*0.15 + y*0.1) * 0.5 + 0.5;
                    return wave > 0.6 ? 'rgba(80,180,255,0.15)' : (wave < 0.3 ? 'rgba(0,40,80,0.1)' : null);
                });
                // Kaustik-Lichtmuster
                for (let i = 0; i < 12; i++) {
                    c.fillStyle = 'rgba(255,255,255,0.15)';
                    const wx = Math.random()*54, wy = Math.random()*54;
                    c.beginPath(); c.moveTo(wx, wy); c.lineTo(wx+10+Math.random()*14, wy+2); c.lineTo(wx+8, wy+4); c.fill();
                }
                // Oberflächen-Schimmer
                c.fillStyle = 'rgba(255,255,255,0.08)';
                for (let i = 0; i < 8; i++) { c.fillRect(Math.random()*40, Math.random()*10, 16+Math.random()*20, 1); }
            });
            // HOLZ (Detaillierte Rinde mit vertikaler Maserung)
            drawTile(4, 0, (c) => {
                // Basis-Braun
                c.fillStyle = '#5D4037'; c.fillRect(0, 0, 64, 64);
                // Vertikale Rindenstreifen
                for (let x = 0; x < 64; x += 4) {
                    const shade = Math.random() * 0.3;
                    c.fillStyle = `rgba(${30+shade*40},${20+shade*30},${10+shade*20},1)`;
                    c.fillRect(x, 0, 4, 64);
                }
                // Horizontale Ringe/Kerben
                for (let y = 0; y < 64; y += (8 + Math.floor(Math.random()*8))) {
                    c.fillStyle = 'rgba(0,0,0,0.15)'; c.fillRect(0, y, 64, 2);
                }
                // Rinden-Detail
                pixelDraw(c, 64, 64, 4, (x, y) => Math.random() > 0.8 ? 'rgba(0,0,0,0.12)' : (Math.random() > 0.9 ? 'rgba(255,255,255,0.06)' : null));
                // Seitliche Schattierung
                c.fillStyle = 'rgba(0,0,0,0.1)'; c.fillRect(0, 0, 3, 64);
                c.fillStyle = 'rgba(255,255,255,0.05)'; c.fillRect(61, 0, 3, 64);
            });
            // LAUB (Dichte Blatt-Cluster mit Tiefe und Lichtpunkten)
            drawTile(5, 0, (c) => {
                // Dunklere Basis-Schicht
                const darkLeaves = ['#1B5E20', '#2E7D32', '#256029'];
                pixelDraw(c, 64, 64, 4, (x, y) => {
                    if (Math.random() > 0.82) return 'rgba(0,0,0,0)';
                    return darkLeaves[Math.floor(Math.random() * darkLeaves.length)];
                });
                // Hellere Blatt-Cluster oben drauf
                for (let i = 0; i < 18; i++) {
                    c.fillStyle = ['#388E3C', '#43A047', '#4CAF50', '#66BB6A'][Math.floor(Math.random()*4)];
                    const lx = Math.random()*56+4, ly = Math.random()*56+4;
                    c.beginPath(); c.arc(lx, ly, 4+Math.random()*4, 0, Math.PI*2); c.fill();
                }
                // Sonnenflecken
                for (let i = 0; i < 6; i++) {
                    c.fillStyle = 'rgba(150,220,80,0.25)';
                    c.beginPath(); c.arc(Math.random()*64, Math.random()*64, 2+Math.random()*3, 0, Math.PI*2); c.fill();
                }
            });
            // SAND (Warmer Wüstensand mit feiner Körnung)
            drawTile(6, 0, (c) => {
                const sands = ['#E8D5A3', '#DECA91', '#F0DFB0', '#D4C487', '#EBD9A8'];
                pixelDraw(c, 64, 64, 2, (x, y) => sands[Math.floor(Math.random() * sands.length)]);
                // Winzige dunkle Sandkörner
                for (let i = 0; i < 12; i++) {
                    c.fillStyle = 'rgba(160,130,80,0.3)';
                    c.fillRect(Math.random()*62, Math.random()*62, 2, 2);
                }
                // Sanfter Lichtgradient
                const grad = c.createLinearGradient(0, 0, 64, 64);
                grad.addColorStop(0, 'rgba(255,255,255,0.08)'); grad.addColorStop(1, 'rgba(0,0,0,0.05)');
                c.fillStyle = grad; c.fillRect(0, 0, 64, 64);
            });
            // WOLKE (helle, blockige Wolkenstruktur)
            drawTile(7, 0, (c) => {
                c.fillStyle = '#fbfdff'; c.fillRect(0, 0, 64, 64);
                drawNoise(c, 64, 64, 8, ['#ffffff', '#f7fbff', '#edf5fb']);
                for (let i = 0; i < 10; i++) {
                    c.fillStyle = 'rgba(190,210,225,0.18)';
                    c.fillRect(Math.random()*56, Math.random()*56, 8, 8);
                }
                c.fillStyle = 'rgba(255,255,255,0.36)'; c.fillRect(0, 0, 64, 28);
            });
            // SCHNEE (Kristallweiß mit Glitzer und Schatten)
            drawTile(8, 0, (c) => {
                c.fillStyle = '#F8FBFF'; c.fillRect(0, 0, 64, 64);
                drawNoise(c, 64, 64, 2, ['#FFFFFF', '#F5F8FF', '#EDF2FA', '#FFFFFF', '#F0F4FC']);
                // Glitzer-Punkte
                for (let i = 0; i < 10; i++) {
                    c.fillStyle = 'rgba(200,230,255,0.4)';
                    c.fillRect(Math.random()*62, Math.random()*62, 2, 2);
                }
                // Sanfte Schatten-Mulden
                for (let i = 0; i < 4; i++) {
                    c.fillStyle = 'rgba(180,200,220,0.1)';
                    c.beginPath(); c.ellipse(Math.random()*56+4, Math.random()*56+4, 8, 4, Math.random()*Math.PI, 0, Math.PI*2); c.fill();
                }
            });
            // EIS (Transparent mit Riss-Muster)
            drawTile(9, 0, (c) => {
                c.fillStyle = 'rgba(160, 220, 240, 0.5)'; c.fillRect(0, 0, 64, 64);
                // Eis-Kristallstruktur
                pixelDraw(c, 64, 64, 4, (x, y) => Math.random() > 0.7 ? 'rgba(200,240,255,0.3)' : null);
                // Risse
                c.strokeStyle = 'rgba(255,255,255,0.6)'; c.lineWidth = 1;
                for (let i = 0; i < 4; i++) {
                    c.beginPath();
                    let rx = Math.random()*64, ry = Math.random()*64;
                    c.moveTo(rx, ry);
                    for (let j = 0; j < 4; j++) { rx += (Math.random()-0.5)*24; ry += (Math.random()-0.5)*24; c.lineTo(rx, ry); }
                    c.stroke();
                }
                // Reflexion oben
                c.fillStyle = 'rgba(255,255,255,0.2)'; c.fillRect(4, 4, 24, 12);
            });
            // JUNGLE WOOD (Dunkles Tropenholz mit Moos)
            drawTile(10, 0, (c) => {
                c.fillStyle = '#3E2723'; c.fillRect(0, 0, 64, 64);
                // Vertikale Maserung
                for (let x = 0; x < 64; x += 4) {
                    c.fillStyle = `rgba(${20+Math.random()*30},${10+Math.random()*20},${5+Math.random()*15},1)`;
                    c.fillRect(x, 0, 4, 64);
                }
                // Moos-Flecken
                for (let i = 0; i < 10; i++) {
                    c.fillStyle = ['rgba(76,175,80,0.3)', 'rgba(56,142,60,0.25)', 'rgba(46,125,50,0.2)'][Math.floor(Math.random()*3)];
                    c.beginPath(); c.arc(Math.random()*64, Math.random()*64, 3+Math.random()*5, 0, Math.PI*2); c.fill();
                }
                // Horizontale Ringe
                for (let y = 0; y < 64; y += (10+Math.floor(Math.random()*6))) { c.fillStyle = 'rgba(0,0,0,0.12)'; c.fillRect(0, y, 64, 2); }
            });
            // JUNGLE LEAVES (Dichtes tropisches Blattwerk)
            drawTile(11, 0, (c) => {
                const lgs = ['#1B5E20', '#33691E', '#2E7D32', '#1A4F1A'];
                pixelDraw(c, 64, 64, 4, (x, y) => {
                    if (Math.random() > 0.82) return 'rgba(0,0,0,0)';
                    return lgs[Math.floor(Math.random() * lgs.length)];
                });
                // Helle Blattspitzen
                for (let i = 0; i < 12; i++) {
                    c.fillStyle = ['#4CAF50', '#388E3C'][Math.floor(Math.random()*2)];
                    c.beginPath(); c.arc(Math.random()*56+4, Math.random()*56+4, 3+Math.random()*3, 0, Math.PI*2); c.fill();
                }
                // Lianen-Akzente
                c.strokeStyle = 'rgba(76,175,80,0.3)'; c.lineWidth = 2;
                for (let i = 0; i < 3; i++) {
                    const sx = Math.random()*60+2;
                    c.beginPath(); c.moveTo(sx, 0); c.quadraticCurveTo(sx+(Math.random()-0.5)*10, 32, sx+(Math.random()-0.5)*8, 64); c.stroke();
                }
            });
            // PALM WOOD (Helle Faser-Rinde mit Ringen)
            drawTile(12, 0, (c) => {
                c.fillStyle = '#C4A882'; c.fillRect(0, 0, 64, 64);
                drawNoise(c, 64, 64, 2, ['#D7CCC8', '#C4A882', '#BCAAA4', '#B09878']);
                // Markante horizontale Ringe
                for (let i = 0; i < 64; i += (8+Math.floor(Math.random()*4))) {
                    c.fillStyle = 'rgba(93,64,55,0.35)'; c.fillRect(0, i, 64, 3);
                    c.fillStyle = 'rgba(255,255,255,0.1)'; c.fillRect(0, i+3, 64, 1);
                }
                // Fasern
                pixelDraw(c, 64, 64, 2, (x, y) => Math.random() > 0.9 ? 'rgba(160,130,90,0.2)' : null);
            });
            // PALM LEAVES (Kräftige Wedel mit Blattadern)
            drawTile(13, 0, (c) => {
                c.fillStyle = '#2E7D32'; c.fillRect(0, 0, 64, 64);
                // Blattadern-Muster
                const veins = ['#4CAF50', '#43A047', '#66BB6A'];
                for (let i = 0; i < 64; i += 8) {
                    c.fillStyle = veins[Math.floor(Math.random()*veins.length)]; c.fillRect(0, i, 64, 3);
                    c.fillStyle = veins[Math.floor(Math.random()*veins.length)]; c.fillRect(i, 0, 3, 64);
                }
                // Licht-Reflexe
                pixelDraw(c, 64, 64, 4, (x, y) => Math.random() > 0.85 ? 'rgba(120,220,80,0.2)' : null);
                // Rand-Schatten
                c.fillStyle = 'rgba(0,0,0,0.1)'; c.fillRect(0, 0, 64, 2); c.fillRect(0, 0, 2, 64);
            });
            // BEDROCK (Unzerstörbarer Urgestein)
            drawTile(14, 0, (c) => {
                const darks = ['#1A1A1A', '#252525', '#0F0F0F', '#1F1F1F', '#141414'];
                pixelDraw(c, 64, 64, 4, (x, y) => darks[Math.floor(Math.random() * darks.length)]);
                // Lava-Adern
                for (let i = 0; i < 3; i++) {
                    c.strokeStyle = 'rgba(120,50,20,0.15)'; c.lineWidth = 2;
                    c.beginPath();
                    let rx = Math.random()*64, ry = Math.random()*64;
                    c.moveTo(rx, ry);
                    for (let j = 0; j < 3; j++) { rx += (Math.random()-0.5)*30; ry += (Math.random()-0.5)*30; c.lineTo(rx, ry); }
                    c.stroke();
                }
            });
            // FLOWER RED
            drawTile(15, 0, (c) => { 
                c.clearRect(0, 0, 64, 64);
                const stems = ['#2F7D32', '#3E8E41', '#5A9B36'];
                const clusters = [
                    { x: 20, y: 26, r: 8, colors: ['#D83A56', '#EF6A8A', '#F6A6B8'], petals: 6 },
                    { x: 35, y: 18, r: 7, colors: ['#C73566', '#E55E92', '#F39AC0'], petals: 7 },
                    { x: 45, y: 34, r: 6, colors: ['#FFFFFF', '#F8DDE5', '#E85A72'], petals: 5 }
                ];
                clusters.forEach((flower, fi) => {
                    c.strokeStyle = stems[fi % stems.length];
                    c.lineWidth = 3;
                    c.beginPath();
                    c.moveTo(32, 63);
                    c.quadraticCurveTo(30 + fi * 3, 48, flower.x, flower.y + 7);
                    c.stroke();
                    c.fillStyle = stems[(fi + 1) % stems.length];
                    c.beginPath(); c.ellipse(28 + fi * 7, 47 - fi * 3, 7, 3, fi * 0.4 - 0.5, 0, Math.PI * 2); c.fill();
                    for (let i = 0; i < flower.petals; i++) {
                        const a = i * Math.PI * 2 / flower.petals;
                        c.fillStyle = flower.colors[i % flower.colors.length];
                        c.beginPath();
                        c.ellipse(flower.x + Math.cos(a) * flower.r, flower.y + Math.sin(a) * flower.r, 4.5, 7, a, 0, Math.PI * 2);
                        c.fill();
                    }
                    c.fillStyle = '#F5C542';
                    c.beginPath(); c.arc(flower.x, flower.y, 3.5, 0, Math.PI * 2); c.fill();
                });
            });
            // FLOWER YELLOW
            drawTile(16, 0, (c) => { 
                c.clearRect(0, 0, 64, 64);
                const greens = ['#4E9B3C', '#6FAE3E', '#2F7D46'];
                const flowers = [
                    { x: 17, y: 33, r: 6, colors: ['#FFE45C', '#F8C63A', '#FFF2A6'], petals: 8 },
                    { x: 31, y: 20, r: 7, colors: ['#FFFFFF', '#FFF9C7', '#FFE169'], petals: 9 },
                    { x: 46, y: 29, r: 6, colors: ['#7AA7FF', '#A9C7FF', '#FFFFFF'], petals: 6 }
                ];
                flowers.forEach((flower, fi) => {
                    c.strokeStyle = greens[fi % greens.length];
                    c.lineWidth = 2 + fi % 2;
                    c.beginPath();
                    c.moveTo(30 + fi * 2, 63);
                    c.quadraticCurveTo(28 + fi * 5, 47, flower.x, flower.y + 8);
                    c.stroke();
                    c.fillStyle = greens[(fi + 2) % greens.length];
                    c.beginPath(); c.ellipse(23 + fi * 8, 48 - fi * 4, 6, 3, fi * 0.45 - 0.35, 0, Math.PI * 2); c.fill();
                    for (let i = 0; i < flower.petals; i++) {
                        const a = i * Math.PI * 2 / flower.petals;
                        c.fillStyle = flower.colors[i % flower.colors.length];
                        c.beginPath();
                        c.ellipse(flower.x + Math.cos(a) * flower.r, flower.y + Math.sin(a) * flower.r, 3.5, 7.5, a, 0, Math.PI * 2);
                        c.fill();
                    }
                    c.fillStyle = fi === 2 ? '#F2B63D' : '#A86B24';
                    c.beginPath(); c.arc(flower.x, flower.y, 3, 0, Math.PI * 2); c.fill();
                });
            });
            // PIG SKIN
            drawTile(17, 0, (c) => { 
                const pinks = ['#F8BBD0', '#F48FB1', '#Fce4ec', '#f06292'];
                pixelDraw(c, 64, 64, 4, (x, y) => pinks[Math.floor(Math.random() * pinks.length)]);
                // Small darker spots
                c.fillStyle = 'rgba(0,0,0,0.05)';
                for(let i=0; i<10; i++) c.fillRect(Math.random()*64, Math.random()*64, 8, 8);
            });
            // SHEEP WOOL
            drawTile(18, 0, (c) => { 
                drawNoise(c, 64, 64, 4, ['#FFFFFF', '#FAFAFA', '#F5F5F5', '#E0E0E0', '#EEEEEE']);
                // Fluffy shadows
                c.fillStyle = 'rgba(0,0,0,0.04)';
                for(let i=0; i<20; i++) c.fillRect(Math.random()*64, Math.random()*64, 16, 16);
                for(let i=0; i<20; i++) c.beginPath(), c.arc(Math.random()*64, Math.random()*64, 6, 0, Math.PI*2), c.fill();
            });
            // SHEEP FACE / SKIN
            drawTile(19, 0, (c) => { 
                drawNoise(c, 64, 64, 4, ['#ECAAA4', '#D7CCC8', '#BCAAA4', '#A1887F']);
            });
            // ZOMBIE SKIN / SHIRT
            drawTile(20, 0, (c) => { 
                // Green upper half, blue lower half
                c.fillStyle = '#4CAF50'; c.fillRect(0,0,64,32);
                c.fillStyle = '#0288D1'; c.fillRect(0,32,64,32);
                drawNoise(c, 64, 64, 4, ['rgba(0,0,0,0.1)', 'rgba(0,0,0,0.2)', 'rgba(255,255,255,0.1)']);
                // Rips
                c.fillStyle = '#388E3C';
                c.fillRect(10, 28, 8, 12); c.fillRect(30, 28, 4, 16);
            });
            // ITEM: EGG
            drawTile(21, 0, (c) => { 
                c.fillStyle = "#F5E6C8"; c.beginPath(); c.ellipse(32, 34, 14, 20, 0, 0, Math.PI*2); c.fill();
                c.fillStyle = "rgba(255,255,255,0.4)"; c.beginPath(); c.ellipse(28, 28, 4, 10, -0.4, 0, Math.PI*2); c.fill();
                c.strokeStyle = "#D7CCC8"; c.lineWidth = 2; c.beginPath(); c.ellipse(32, 34, 14, 20, 0, 0, Math.PI*2); c.stroke();
            });
            // ITEM: MEAT
            drawTile(22, 0, (c) => { 
                c.fillStyle = "#FFECB3";
                c.fillRect(14, 28, 12, 8); c.beginPath(); c.arc(14, 28, 6, 0, Math.PI*2); c.fill(); c.beginPath(); c.arc(14, 36, 6, 0, Math.PI*2); c.fill();
                c.fillStyle = "#E53935"; c.beginPath(); c.ellipse(38, 32, 20, 16, 0, 0, Math.PI*2); c.fill();
                c.fillStyle = "#FFCDD2"; c.beginPath(); c.ellipse(38, 22, 12, 4, -0.2, 0, Math.PI*2); c.fill();
            });
            // ITEM: MILK
            drawTile(23, 0, (c) => { 
                c.strokeStyle = "#78909C"; c.lineWidth = 4; c.beginPath(); c.arc(32, 20, 16, Math.PI, 0); c.stroke();
                c.fillStyle = "#B0BEC5"; c.beginPath(); c.moveTo(18, 20); c.lineTo(46, 20); c.lineTo(40, 52); c.lineTo(24, 52); c.fill();
                c.fillStyle = "#ECEFF1"; c.fillRect(16, 18, 32, 6);
                c.fillStyle = "rgba(255,255,255,0.3)"; c.beginPath(); c.moveTo(22, 24); c.lineTo(26, 50); c.lineTo(32, 50); c.lineTo(32, 24); c.fill();
                c.fillStyle = "#FFFFFF"; c.fillRect(20, 15, 24, 4);
                c.beginPath(); c.ellipse(32, 17, 12, 3, 0, 0, Math.PI*2); c.fill();
            });
            // ITEM: WOOL BALL
            drawTile(26, 0, (c) => { 
                c.fillStyle = "#FAFAFA"; c.beginPath(); c.arc(32, 32, 16, 0, Math.PI*2); c.fill();
                c.strokeStyle = "#E0E0E0"; c.lineWidth = 3; c.beginPath(); c.arc(32, 32, 16, 0, Math.PI*2); c.stroke();
                c.beginPath(); c.arc(36, 28, 6, 0, Math.PI); c.stroke();
                c.beginPath(); c.arc(26, 36, 4, 0, Math.PI); c.stroke();
            });
            // COW SKIN
            drawTile(24, 0, (c) => { 
                drawNoise(c, 64, 64, 4, ['#FFFFFF', '#FAFAFA', '#F5F5F5']);
                // Black cow patches
                c.fillStyle = '#212121';
                c.beginPath(); c.ellipse(16, 16, 20, 15, 0.4, 0, Math.PI*2); c.fill();
                c.beginPath(); c.ellipse(48, 50, 18, 22, -0.2, 0, Math.PI*2); c.fill();
                c.beginPath(); c.ellipse(50, 10, 10, 10, 0, 0, Math.PI*2); c.fill();
            });
            // CHICKEN FEATHERS
            drawTile(25, 0, (c) => { 
                drawNoise(c, 64, 64, 2, ['#FFFFFF', '#FAFAFA', '#F0F0F0']);
                c.fillStyle = 'rgba(0,0,0,0.03)';
                for(let i=0; i<30; i++) {
                    const x = Math.random()*64, y = Math.random()*64;
                    c.beginPath(); c.moveTo(x, y); c.lineTo(x-4, y+6); c.lineTo(x+4, y+6); c.fill();
                }
            });

            // RECIPE ITEM: PLANKS (Detaillierte Holzbretter mit Maserung)
            drawTile(27, 0, (c) => {
                c.fillStyle = '#C8944A'; c.fillRect(0, 0, 64, 64);
                // Planken-Maserung
                const plankColors = ['#C8944A', '#BA8640', '#D4A254', '#BF8E46'];
                pixelDraw(c, 64, 64, 2, (x, y) => {
                    const plank = Math.floor(y / 16);
                    return plankColors[(plank + Math.floor(x*0.05)) % plankColors.length];
                });
                // Trennlinien zwischen Brettern
                c.fillStyle = '#7D5A3C';
                for (let i = 15; i < 64; i += 16) { c.fillRect(0, i, 64, 2); }
                // Schatten unter jeder Planke
                c.fillStyle = 'rgba(0,0,0,0.06)';
                for (let i = 0; i < 64; i += 16) { c.fillRect(0, i+12, 64, 3); }
                // Nagel-Akzente
                c.fillStyle = 'rgba(80,60,40,0.3)';
                c.fillRect(6, 6, 2, 2); c.fillRect(56, 6, 2, 2); c.fillRect(6, 22, 2, 2); c.fillRect(56, 22, 2, 2);
            });
            // RECIPE ITEM: STICK (Optimiert für 2D-Mesh)
            drawTile(28, 0, (c) => { 
                c.clearRect(0, 0, 64, 64);
                c.strokeStyle = '#8B4513';
                c.lineWidth = 10; c.lineCap = 'round';
                // Fast vertikaler, natürlicher Stock
                c.beginPath(); c.moveTo(32, 60); c.lineTo(38, 4); c.stroke();
                // Maserung/Kontrast
                c.strokeStyle = '#5D4037'; c.lineWidth = 4;
                c.beginPath(); c.moveTo(32, 60); c.lineTo(35, 30); c.stroke();
            });
            // RECIPE ITEM: WORKBENCH (LINKS)
            drawTile(29, 0, (c) => { 
                c.fillStyle='#A0522D'; c.fillRect(0,0,64,64); 
                // Dunkler Rahmen (nur Oben, Unten, Links für nahtlosen Übergang Rechts)
                c.fillStyle='#8B4513'; c.fillRect(0,0,64,8); c.fillRect(0,0,8,64); c.fillRect(0,56,64,8);
                // Workbench Tools / Schubladen (Links)
                c.fillStyle='#5D4037'; c.fillRect(16, 16, 32, 4); c.fillRect(16, 32, 32, 4);
                c.fillStyle='#3E2723'; c.fillRect(28, 14, 8, 2); c.fillRect(28, 30, 8, 2);
                // Oberseiten-Struktur (Arbeitsplatte)
                c.fillStyle='rgba(255,255,255,0.05)'; c.fillRect(8,8,64,48); // Geht bis zum rechten Rand
            });
            // RECIPE ITEM: STONE_BRICK (Detailliertes Ziegelmauerwerk)
            drawTile(30, 0, (c) => {
                c.fillStyle = '#808080'; c.fillRect(0, 0, 64, 64);
                // Ziegel-Flächen mit Variation
                const brickColors = ['#7A7A7A', '#858585', '#727272', '#8A8A8A'];
                for (let row = 0; row < 2; row++) {
                    const yOff = row * 32;
                    const xShift = row * 16;
                    for (let col = 0; col < 2; col++) {
                        c.fillStyle = brickColors[row*2+col];
                        c.fillRect((col * 32 + xShift) % 64, yOff, 30, 30);
                    }
                }
                // Fugen
                c.fillStyle = '#555555';
                c.fillRect(0, 30, 64, 2); c.fillRect(0, 62, 64, 2);
                c.fillRect(30, 0, 2, 32); c.fillRect(14, 32, 2, 32); c.fillRect(46, 32, 2, 32);
                // Stein-Körnung
                pixelDraw(c, 64, 64, 2, (x, y) => Math.random() > 0.85 ? 'rgba(255,255,255,0.06)' : (Math.random() > 0.92 ? 'rgba(0,0,0,0.08)' : null));
            });
            // RECIPE ITEM: SANDSTONE (Geschichteter Sandstein)
            drawTile(31, 0, (c) => {
                // Warme Basis
                const sandStone = ['#E8CFA0', '#DEC494', '#F0D8AB', '#D4B888'];
                pixelDraw(c, 64, 64, 2, (x, y) => sandStone[Math.floor(Math.random() * sandStone.length)]);
                // Horizontale Schichten
                c.fillStyle = 'rgba(180,150,100,0.2)';
                for (let i = 0; i < 64; i += (6+Math.floor(Math.random()*4))) { c.fillRect(0, i, 64, 2); }
                // Obere Zierleiste
                c.fillStyle = '#C4A870'; c.fillRect(0, 0, 64, 8);
                c.fillStyle = '#B89860'; c.fillRect(4, 2, 56, 4);
                // Unterer Rahmen
                c.fillStyle = '#C4A870'; c.fillRect(0, 56, 64, 8);
                // Subtile Körnung
                pixelDraw(c, 64, 64, 4, (x, y) => Math.random() > 0.9 ? 'rgba(0,0,0,0.06)' : null);
            });
            
            // 36: WORKBENCH_SIDE (RECHTS)
            drawTile(36, 0, (c) => {
                c.fillStyle='#A0522D'; c.fillRect(0,0,64,64);
                // Dunkler Rahmen (nur Oben, Unten, Rechts für nahtlosen Übergang Links)
                c.fillStyle='#8B4513'; c.fillRect(0,0,64,8); c.fillRect(56,0,8,64); c.fillRect(0,56,64,8);
                // Grid / Arbeitsbereich (Rechts)
                c.fillStyle='#D2691E'; c.fillRect(12, 12, 16, 16); c.fillRect(36, 12, 16, 16); c.fillRect(12, 36, 16, 16); c.fillRect(36, 36, 16, 16);
                // Oberseiten-Struktur
                c.fillStyle='rgba(255,255,255,0.05)'; c.fillRect(0,8,56,48); // Beginnt am linken Rand
            });
            
            // DROP ITEM: BONE
            drawTile(32, 0, (c) => {
                c.fillStyle="#E0E0E0"; 
                c.beginPath(); c.moveTo(16, 28); c.lineTo(48, 28); c.lineTo(48, 36); c.lineTo(16, 36); c.fill();
                c.beginPath(); c.arc(16, 24, 6, 0, Math.PI*2); c.fill(); c.beginPath(); c.arc(16, 40, 6, 0, Math.PI*2); c.fill();
                c.beginPath(); c.arc(48, 24, 6, 0, Math.PI*2); c.fill(); c.beginPath(); c.arc(48, 40, 6, 0, Math.PI*2); c.fill();
                c.strokeStyle = "#BDBDBD"; c.lineWidth = 2; // subtle shadow
                c.beginPath(); c.moveTo(16, 36); c.lineTo(48, 36); c.stroke();
            });

            // 33: SKELETON FACE
            drawTile(33, 0, (c) => { 
                c.clearRect(0,0,64,64);
                // Cut off the corners and some edges to make it a round skull!
                c.fillStyle = '#EBEBEB'; 
                c.fillRect(4,4,56,56);
                drawNoise(c, 64, 64, 4, ['rgba(0,0,0,0.05)', 'rgba(0,0,0,0.1)']); 
                c.fillStyle = 'rgba(0,0,0,0)'; // transparent hole inside the head
                // Eyes Hollows (actually holes through the head!)
                c.clearRect(12, 24, 12, 12);
                c.clearRect(40, 24, 12, 12);
                c.clearRect(28, 40, 8, 4); // nose hole
                
                c.fillStyle = '#000000'; // black teeth lines
                for(let i=14; i<50; i+=8) { c.fillRect(i, 52, 2, 8); } 
                c.fillRect(14, 56, 36, 2); 
            });

            // 34: SKELETON RIBCAGE
            drawTile(34, 0, (c) => {
                c.clearRect(0,0,64,64); // pure transparency
                c.fillStyle = '#F0F0F0';
                
                // Wirbelsäule (Spine)
                c.fillRect(28, 0, 8, 64);
                
                // Rippen (Ribs horizontally) with gaps
                for(let y=12; y<52; y+=10) {
                    c.fillRect(8, y, 48, 4); // Rippenknochen
                }
                drawNoise(c, 64, 64, 4, ['rgba(0,0,0,0.08)']);
            });

            // 35: SKELETON LIMBS
            drawTile(35, 0, (c) => {
                c.clearRect(0,0,64,64);
                c.fillStyle = '#E8E8E8';
                
                // Knochen mit durchsichtigen Spalten (in der Mitte) -> wie zwei dünne Unterarmknochen
                c.fillRect(16, 0, 8, 64);
                c.fillRect(40, 0, 8, 64);
                
                // Gelenke oben und unten
                c.fillRect(12, 0, 40, 8);
                c.fillRect(12, 56, 40, 8);
                
                drawNoise(c, 64, 64, 4, ['rgba(0,0,0,0.05)']);
            });

            // --- MÖBEL-TEXTUREN ---

            // 38: WINDOW (Glasblock mit Holzrahmen)
            drawTile(38, 0, (c) => {
                // Holzrahmen
                c.fillStyle = '#8B6914'; c.fillRect(0,0,64,64);
                // Glasfläche (teil-transparent, cyan)
                c.fillStyle = 'rgba(135, 206, 235, 0.45)'; c.fillRect(6,6,52,52);
                // Kreuz-Sprosse
                c.fillStyle = '#8B6914'; c.fillRect(30,0,4,64); c.fillRect(0,30,64,4);
                // Glas-Reflektion
                c.fillStyle = 'rgba(255,255,255,0.25)';
                c.fillRect(8,8,20,20);
                c.fillStyle = 'rgba(255,255,255,0.12)';
                c.fillRect(36,36,18,18);
            });

            // 39: DOOR_BOTTOM (Unterer Türteil - Holzplanken mit Griff)
            drawTile(39, 0, (c) => {
                c.fillStyle = '#A0724A'; c.fillRect(0,0,64,64);
                // Planken-Linien
                c.fillStyle = '#7D5A3C';
                for(let i=15; i<64; i+=16) { c.fillRect(0, i, 64, 2); }
                c.fillRect(31, 0, 2, 64); // Mittelstrebe
                // Rahmen links/rechts
                c.fillStyle = '#6D4C41'; c.fillRect(0,0,4,64); c.fillRect(60,0,4,64);
                // Türgriff (rechts)
                c.fillStyle = '#FFD700'; c.fillRect(48, 28, 6, 8);
                c.fillStyle = '#DAA520'; c.fillRect(48, 30, 6, 4);
                // Maserung
                pixelDraw(c, 64, 64, 4, (x, y) => Math.random()>0.85 ? 'rgba(0,0,0,0.08)' : '');
            });

            // 40: DOOR_TOP (Oberer Türteil - mit kleinem Fenster)
            drawTile(40, 0, (c) => {
                c.fillStyle = '#A0724A'; c.fillRect(0,0,64,64);
                // Planken-Linien
                c.fillStyle = '#7D5A3C';
                for(let i=15; i<64; i+=16) { c.fillRect(0, i, 64, 2); }
                c.fillRect(31, 0, 2, 64);
                // Rahmen links/rechts
                c.fillStyle = '#6D4C41'; c.fillRect(0,0,4,64); c.fillRect(60,0,4,64);
                // Kleines Fenster oben
                c.fillStyle = 'rgba(135, 206, 235, 0.5)'; c.fillRect(14, 10, 36, 24);
                c.fillStyle = '#6D4C41'; c.fillRect(30, 10, 4, 24); c.fillRect(14, 20, 36, 4);
                // Glas-Reflektion
                c.fillStyle = 'rgba(255,255,255,0.2)'; c.fillRect(16, 12, 12, 6);
                pixelDraw(c, 64, 64, 4, (x, y) => Math.random()>0.85 ? 'rgba(0,0,0,0.08)' : '');
            });

            // 41: BED_HEAD (Kopfteil - rotes Kissen auf Holzbasis)
            drawTile(41, 0, (c) => {
                // Holzbasis (untere Hälfte)
                c.fillStyle = '#A0724A'; c.fillRect(0,32,64,32);
                c.fillStyle = '#7D5A3C';
                for(let i=39; i<64; i+=8) { c.fillRect(0, i, 64, 2); }
                // Kopfbrett (linke Kante)
                c.fillStyle = '#6D4C41'; c.fillRect(0, 0, 8, 64);
                // Kissen (obere Hälfte)
                c.fillStyle = '#CC3333'; c.fillRect(8, 4, 52, 28);
                // Kissen-Schattierung
                c.fillStyle = '#B71C1C'; c.fillRect(8, 28, 52, 4);
                c.fillStyle = 'rgba(255,255,255,0.15)'; c.fillRect(12, 8, 44, 12);
                // Kissenfalte
                c.fillStyle = '#A52828'; c.fillRect(32, 4, 2, 28);
            });

            // 42: BED_FOOT (Fußteil - rote Decke auf Holzbasis)
            drawTile(42, 0, (c) => {
                // Holzbasis (untere Hälfte)
                c.fillStyle = '#A0724A'; c.fillRect(0,32,64,32);
                c.fillStyle = '#7D5A3C';
                for(let i=39; i<64; i+=8) { c.fillRect(0, i, 64, 2); }
                // Fußbrett (rechte Kante)
                c.fillStyle = '#6D4C41'; c.fillRect(56, 0, 8, 64);
                // Decke (obere Hälfte)
                c.fillStyle = '#CC3333'; c.fillRect(0, 4, 56, 28);
                // Decken-Muster (Streifen)
                c.fillStyle = '#B71C1C';
                for(let i=10; i<32; i+=10) { c.fillRect(0, i, 56, 3); }
                c.fillStyle = 'rgba(255,255,255,0.1)'; c.fillRect(4, 6, 48, 8);
            });

            // --- VEGETATIONS-TEXTUREN ---

            // 43: BERRY_BUSH (Beerenbusch voll mit Beeren)
            drawTile(43, 0, (c) => {
                c.clearRect(0, 0, 64, 64);
                const greens = ['#1E5F2A', '#2E7D32', '#3D8C3F', '#517D2D', '#244F21'];
                const leafBlobs = [[16,42,14,12],[30,34,18,16],[46,42,14,13],[24,52,18,10],[40,54,16,9],[33,22,12,10]];
                leafBlobs.forEach(([x, y, rx, ry], i) => {
                    c.fillStyle = greens[i % greens.length];
                    c.beginPath(); c.ellipse(x, y, rx, ry, (i - 2) * 0.25, 0, Math.PI * 2); c.fill();
                });
                pixelDraw(c, 64, 64, 3, (x, y) => Math.random() > 0.82 ? 'rgba(255,255,255,0.08)' : null);
                const berryPositions = [[14,31],[26,24],[43,30],[21,43],[36,39],[49,47],[28,54],[42,53],[33,45],[52,36]];
                berryPositions.forEach(([bx,by]) => {
                    c.fillStyle = Math.random() > 0.35 ? '#D93245' : '#8E2442'; c.beginPath(); c.arc(bx, by, 3.5, 0, Math.PI*2); c.fill();
                    c.fillStyle = 'rgba(255,255,255,0.3)'; c.beginPath(); c.arc(bx-1, by-1, 1.5, 0, Math.PI*2); c.fill();
                });
            });

            // 44: TALL_GRASS (Hohes Gras)
            drawTile(44, 0, (c) => {
                c.clearRect(0, 0, 64, 64);
                const grassColors = ['#2F7D32', '#4B9B3E', '#6DAD3A', '#8AA64A', '#B2A65A', '#3A6F2D'];
                for (let i = 0; i < 18; i++) {
                    const bx = 6 + Math.random() * 52;
                    const h = 14 + Math.random() * 42;
                    c.strokeStyle = grassColors[Math.floor(Math.random() * grassColors.length)];
                    c.lineWidth = 1.5 + Math.random() * 3.5;
                    c.lineCap = 'round';
                    c.beginPath();
                    c.moveTo(bx, 64);
                    c.quadraticCurveTo(bx + (Math.random()-0.5)*22, 64 - h*0.55, bx + (Math.random()-0.5)*16, 64 - h);
                    c.stroke();
                }
                c.fillStyle = 'rgba(238, 205, 95, 0.45)';
                for (let i = 0; i < 4; i++) {
                    const x = 12 + Math.random() * 40, y = 34 + Math.random() * 18;
                    c.fillRect(x, y, 2, 8 + Math.random() * 8);
                }
            });

            // 45: CACTUS (Detaillierter Kaktus mit Rippen und Stacheln)
            drawTile(45, 0, (c) => {
                // Basis
                c.fillStyle = '#3A8B3E'; c.fillRect(0, 0, 64, 64);
                // Vertikale Rippen mit 3D-Effekt
                for (let i = 0; i < 64; i += 8) {
                    c.fillStyle = '#2E7D32'; c.fillRect(i, 0, 4, 64);
                    c.fillStyle = 'rgba(255,255,255,0.1)'; c.fillRect(i+1, 0, 2, 64);
                    c.fillStyle = 'rgba(0,0,0,0.12)'; c.fillRect(i+5, 0, 2, 64);
                }
                // Stachel-Cluster
                c.fillStyle = '#FFF9C4';
                for (let y = 4; y < 64; y += 12) {
                    for (let x = 4; x < 64; x += 10) {
                        const ox = x + (Math.random()-0.5)*4, oy = y + (Math.random()-0.5)*4;
                        c.fillRect(ox, oy, 2, 2);
                        c.fillStyle = 'rgba(200,200,150,0.5)'; c.fillRect(ox+1, oy-1, 1, 1); c.fillStyle = '#FFF9C4';
                    }
                }
                // Kanten (Kaktus ist schmaler als Block)
                c.fillStyle = 'rgba(0,0,0,0.2)'; c.fillRect(0, 0, 4, 64); c.fillRect(60, 0, 4, 64);
                c.fillStyle = 'rgba(30,80,30,0.5)'; c.fillRect(0, 0, 2, 64); c.fillRect(62, 0, 2, 64);
            });

            // 46: DEAD_BUSH (Toter Strauch)
            drawTile(46, 0, (c) => {
                c.clearRect(0, 0, 64, 64);
                c.strokeStyle = '#6D4C41'; c.lineWidth = 3; c.lineCap = 'round';
                // Hauptstamm
                c.beginPath(); c.moveTo(32, 62); c.lineTo(32, 30); c.stroke();
                // Äste
                c.lineWidth = 2.5;
                c.beginPath(); c.moveTo(32, 40); c.lineTo(14, 20); c.stroke();
                c.beginPath(); c.moveTo(32, 40); c.lineTo(50, 18); c.stroke();
                c.beginPath(); c.moveTo(32, 34); c.lineTo(20, 10); c.stroke();
                c.beginPath(); c.moveTo(32, 30); c.lineTo(46, 8); c.stroke();
                // Zweiglein
                c.lineWidth = 1.5;
                c.beginPath(); c.moveTo(14, 20); c.lineTo(8, 12); c.stroke();
                c.beginPath(); c.moveTo(50, 18); c.lineTo(56, 10); c.stroke();
                c.beginPath(); c.moveTo(20, 10); c.lineTo(14, 4); c.stroke();
            });

            // 47: MUSHROOM_RED (Roter Pilz)
            drawTile(47, 0, (c) => {
                c.clearRect(0, 0, 64, 64);
                // Stiel
                c.fillStyle = '#F5F5DC'; c.fillRect(26, 36, 12, 28);
                // Kappe
                c.fillStyle = '#E53935'; c.beginPath(); c.ellipse(32, 32, 22, 16, 0, Math.PI, 0); c.fill();
                // Weiße Punkte
                c.fillStyle = '#FFFFFF';
                c.beginPath(); c.arc(24, 26, 4, 0, Math.PI*2); c.fill();
                c.beginPath(); c.arc(40, 24, 3, 0, Math.PI*2); c.fill();
                c.beginPath(); c.arc(32, 20, 3.5, 0, Math.PI*2); c.fill();
            });

            // 48: MUSHROOM_BROWN (Brauner Pilz)
            drawTile(48, 0, (c) => {
                c.clearRect(0, 0, 64, 64);
                // Stiel
                c.fillStyle = '#D7CCC8'; c.fillRect(27, 38, 10, 26);
                // Kappe (breit und flach)
                c.fillStyle = '#795548'; c.beginPath(); c.ellipse(32, 36, 24, 10, 0, Math.PI, 0); c.fill();
                // Schattierung
                c.fillStyle = 'rgba(0,0,0,0.15)'; c.beginPath(); c.ellipse(32, 36, 24, 10, 0, Math.PI, 0); c.fill();
                c.fillStyle = '#8D6E63'; c.beginPath(); c.ellipse(32, 34, 20, 7, 0, Math.PI, 0); c.fill();
            });

            // 49: SUGARCANE (Zuckerrohr)
            drawTile(49, 0, (c) => {
                c.clearRect(0, 0, 64, 64);
                // Mehrere Stangen
                const caneColors = ['#81C784', '#66BB6A', '#A5D6A7'];
                for (let i = 0; i < 3; i++) {
                    const cx = 14 + i * 18;
                    c.fillStyle = caneColors[i];
                    c.fillRect(cx, 4, 8, 60);
                    // Knoten
                    c.fillStyle = '#4CAF50';
                    c.fillRect(cx - 1, 20, 10, 3);
                    c.fillRect(cx - 1, 40, 10, 3);
                    // Blatt oben
                    c.fillStyle = '#43A047';
                    c.beginPath(); c.moveTo(cx + 4, 4); c.lineTo(cx + 16, 0); c.lineTo(cx + 4, 8); c.fill();
                }
            });

            // 50: FERN (Farn)
            drawTile(50, 0, (c) => {
                c.clearRect(0, 0, 64, 64);
                const fernColors = ['#1B5E20', '#2E7D32', '#3F8F3A', '#5C8F36'];
                const stems = [24, 33, 42];
                stems.forEach((sx, si) => {
                    c.strokeStyle = fernColors[si];
                    c.lineWidth = 2;
                    c.beginPath(); c.moveTo(sx, 63); c.quadraticCurveTo(sx - 5 + si * 4, 37, sx + (si - 1) * 4, 12 + si * 5); c.stroke();
                    for (let i = 0; i < 7 - si; i++) {
                        const y = 55 - i * 7;
                        const spread = 7 + i * 2.2;
                        c.strokeStyle = fernColors[(i + si) % fernColors.length];
                        c.lineWidth = 1.5 + (i % 2) * 0.5;
                        c.beginPath(); c.moveTo(sx, y); c.quadraticCurveTo(sx - spread * 0.7, y - 4, sx - spread, y + 2); c.stroke();
                        c.beginPath(); c.moveTo(sx, y - 1); c.quadraticCurveTo(sx + spread * 0.7, y - 5, sx + spread, y + 1); c.stroke();
                    }
                });
            });

            // 51: BERRIES (Beeren-Item)
            drawTile(51, 0, (c) => {
                c.clearRect(0, 0, 64, 64);
                // Beeren-Cluster
                const berryColors = ['#E53935', '#D32F2F', '#C62828'];
                const positions = [[24,28],[32,24],[40,28],[20,36],[32,34],[44,36],[28,42],[36,42]];
                positions.forEach(([bx,by], i) => {
                    c.fillStyle = berryColors[i % berryColors.length];
                    c.beginPath(); c.arc(bx, by, 6, 0, Math.PI*2); c.fill();
                    // Glanzpunkt
                    c.fillStyle = 'rgba(255,255,255,0.35)'; c.beginPath(); c.arc(bx-2, by-2, 2, 0, Math.PI*2); c.fill();
                });
                // Kleiner grüner Stiel oben
                c.fillStyle = '#4CAF50'; c.fillRect(30, 16, 4, 10);
                c.beginPath(); c.moveTo(32, 16); c.lineTo(26, 12); c.lineTo(32, 14); c.fill();
                c.beginPath(); c.moveTo(32, 16); c.lineTo(38, 12); c.lineTo(32, 14); c.fill();
            });

            // 52: BERRY_BUSH_EMPTY (Leerer Beerenbusch)
            drawTile(52, 0, (c) => {
                c.clearRect(0, 0, 64, 64);
                const greens = ['#254F20', '#33691E', '#2E7D32', '#58722E'];
                [[18,44,14,11],[34,36,17,14],[48,47,12,10],[28,55,18,8],[42,56,14,8]].forEach(([x, y, rx, ry], i) => {
                    c.fillStyle = greens[i % greens.length];
                    c.beginPath(); c.ellipse(x, y, rx, ry, (i - 2) * 0.35, 0, Math.PI * 2); c.fill();
                });
                c.strokeStyle = '#4A3A24';
                c.lineWidth = 1.5;
                for (let i = 0; i < 7; i++) {
                    const x = 15 + Math.random() * 35;
                    c.beginPath(); c.moveTo(x, 61); c.lineTo(x + (Math.random() - 0.5) * 14, 34 + Math.random() * 16); c.stroke();
                }
            });

            // 54: SEAGRASS (Wassergras)
            drawTile(54, 0, (c) => {
                c.clearRect(0, 0, 64, 64);
                const greens = ['#2E8B57', '#3CB371', '#20B2AA'];
                for (let i = 0; i < 5; i++) {
                    const x = 16 + i * 8;
                    const y = 64;
                    const h = 24 + Math.random() * 32;
                    c.strokeStyle = greens[i % greens.length];
                    c.lineWidth = 3 + Math.random() * 2;
                    c.beginPath();
                    c.moveTo(x, y);
                    c.quadraticCurveTo(x + (Math.random()*10 - 5), y - h/2, x + (Math.random()*20 - 10), y - h);
                    c.stroke();
                }
            });

            // GRAS SEITE (Tile 53) – Oben Grasüberhang, unten visuell an den gerenderten DIRT-Block angepasst.
            drawTile(53, 0, (c) => {
                // Grass-Block-Seiten werden im Mesh weiß getintet; normale Dirt-Blöcke bekommen
                // zusätzlich den DIRT-Vertex-Tint. Diese Palette kompensiert das, damit die
                // Grass-Unterkante nicht heller/grauer als der darunterliegende Erdblock wirkt.
                const browns = ['#4B3524', '#3F2A1C', '#362216', '#452D20', '#2B1A11'];
                pixelDraw(c, 64, 64, 2, (x, y) => browns[Math.floor(Math.random() * browns.length)]);
                // Gedämpfte Steinkrümel passend zur dunkleren Grass-Side-Erde
                for (let i = 0; i < 8; i++) {
                    c.fillStyle = ['#6F6A62', '#5F5A53'][Math.floor(Math.random() * 2)];
                    c.fillRect(Math.random()*60+2, Math.random()*60+2, 4, 2);
                }

                // 2) Grasüberhang oben mit gezacktem Rand (~oberes Viertel)
                const grassPalette = ['#3B8C1E', '#2E7A18', '#266B12', '#4A9928', '#389020'];
                const px = 4; // 16x16 Pixel-Raster
                // Vollflächiges Gras in den obersten 3 Reihen
                for (let row = 0; row < 3; row++) {
                    for (let col = 0; col < 16; col++) {
                        c.fillStyle = grassPalette[Math.floor(Math.random() * grassPalette.length)];
                        c.fillRect(col * px, row * px, px, px);
                    }
                }
                // Gezackter Übergang in Reihe 3 und 4 (zufällig auslaufend)
                for (let col = 0; col < 16; col++) {
                    const limit = 3 + Math.floor(Math.random() * 2); // 3 oder 4
                    for (let row = 3; row <= limit; row++) {
                        if (Math.random() > 0.35) {
                            c.fillStyle = grassPalette[Math.floor(Math.random() * grassPalette.length)];
                            c.fillRect(col * px, row * px, px, px);
                        }
                    }
                }

                // 3) Tiefenschatten wie im DIRT-Block
                const grad = c.createLinearGradient(0, 0, 0, 64);
                grad.addColorStop(0, 'rgba(255,255,255,0.05)'); grad.addColorStop(1, 'rgba(0,0,0,0.1)');
                c.fillStyle = grad; c.fillRect(0, 0, 64, 64);
            });

            // === NEUE BLÖCKE (IDs 56-82) ===

            // KOHLE-ERZ (Tile 56) – Stein mit schwarzen Kohle-Einschlüssen
            drawTile(56, 0, (c) => {
                const grays = ['#808080','#767676','#8A8A8A','#6F6F6F'];
                pixelDraw(c, 64, 64, 4, () => grays[Math.floor(Math.random()*grays.length)]);
                for (let i = 0; i < 14; i++) {
                    c.fillStyle = ['#111','#000','#222'][Math.floor(Math.random()*3)];
                    const ox = Math.floor(Math.random()*14)*4, oy = Math.floor(Math.random()*14)*4;
                    const sz = (Math.floor(Math.random()*2)+1)*4;
                    c.fillRect(ox, oy, sz, sz);
                }
            });

            // EISEN-ERZ (Tile 57) – Stein mit orangebeigen Eisen-Punkten
            drawTile(57, 0, (c) => {
                const grays = ['#808080','#767676','#8A8A8A'];
                pixelDraw(c, 64, 64, 4, () => grays[Math.floor(Math.random()*grays.length)]);
                for (let i = 0; i < 12; i++) {
                    c.fillStyle = ['#C0896B','#B07050','#D09A7A'][Math.floor(Math.random()*3)];
                    const ox = Math.floor(Math.random()*14)*4, oy = Math.floor(Math.random()*14)*4;
                    const sz = (Math.floor(Math.random()*2)+1)*4;
                    c.fillRect(ox, oy, sz, sz);
                }
            });

            // GOLD-ERZ (Tile 58) – Stein mit gelben Gold-Punkten
            drawTile(58, 0, (c) => {
                const grays = ['#808080','#767676','#8A8A8A'];
                pixelDraw(c, 64, 64, 4, () => grays[Math.floor(Math.random()*grays.length)]);
                for (let i = 0; i < 10; i++) {
                    c.fillStyle = ['#FFD700','#DAA520','#FFC200'][Math.floor(Math.random()*3)];
                    const ox = Math.floor(Math.random()*14)*4, oy = Math.floor(Math.random()*14)*4;
                    const sz = (Math.floor(Math.random()*2)+1)*4;
                    c.fillRect(ox, oy, sz, sz);
                }
            });

            // OFEN (Tile 59) – Dunkler Stein mit Ofenöffnung
            drawTile(59, 0, (c) => {
                const stones = ['#606060','#585858','#686868','#505050'];
                pixelDraw(c, 64, 64, 4, () => stones[Math.floor(Math.random()*stones.length)]);
                c.fillStyle = '#1A1A1A';
                c.fillRect(16, 20, 32, 28); // Ofenöffnung
                c.fillStyle = '#FF6600';
                c.fillRect(20, 28, 24, 16); // Glut innen
                c.fillStyle = '#FF4400';
                for (let i=0; i<4; i++) { c.fillRect(20+i*6, 34, 4, 8); } // Flammen
                c.fillStyle = '#444';
                c.fillRect(16, 48, 32, 4); // Ascheboden
            });

            // KOHLE (Tile 60) – Schwarzes glänzendes Mineral
            drawTile(60, 0, (c) => {
                c.fillStyle = '#1A1A1A'; c.fillRect(0,0,64,64);
                for (let i=0; i<20; i++) {
                    c.fillStyle = ['#2A2A2A','#111','#333','#0A0A0A'][Math.floor(Math.random()*4)];
                    c.fillRect(Math.random()*56, Math.random()*56, 4+Math.random()*8, 4+Math.random()*8);
                }
                c.fillStyle = 'rgba(255,255,255,0.15)';
                c.fillRect(12,8,6,6); c.fillRect(40,20,4,4); // Glanzpunkte
            });

            // EISENBARREN (Tile 61) – Silbrig metallisch
            drawTile(61, 0, (c) => {
                c.fillStyle = '#888'; c.fillRect(0,0,64,64);
                const grad = c.createLinearGradient(0,0,64,64);
                grad.addColorStop(0,'#D0D0D0'); grad.addColorStop(0.4,'#A8A8A8'); grad.addColorStop(1,'#686868');
                c.fillStyle = grad; c.fillRect(8,16,48,32);
                c.strokeStyle='#555'; c.lineWidth=2; c.strokeRect(8,16,48,32);
                c.fillStyle='rgba(255,255,255,0.4)'; c.fillRect(10,18,12,4);
            });

            // GOLDBARREN (Tile 62) – Golden glänzend
            drawTile(62, 0, (c) => {
                c.fillStyle = '#A07800'; c.fillRect(0,0,64,64);
                const grad = c.createLinearGradient(0,0,64,64);
                grad.addColorStop(0,'#FFE566'); grad.addColorStop(0.4,'#FFD700'); grad.addColorStop(1,'#B8960A');
                c.fillStyle = grad; c.fillRect(8,16,48,32);
                c.strokeStyle='#8B6914'; c.lineWidth=2; c.strokeRect(8,16,48,32);
                c.fillStyle='rgba(255,255,255,0.5)'; c.fillRect(10,18,12,4);
            });

            // HOLZ-SPITZHACKE (Tile 63)
            drawTile(63, 0, (c) => {
                c.fillStyle = '#8B6914'; c.fillRect(24,40,8,24); // Stiel
                c.fillStyle = '#CD853F';
                c.fillRect(8,20,48,16); // Kopf
                c.fillRect(8,20,12,24); // linke Spitze
                c.fillRect(44,20,12,24); // rechte Spitze
                c.fillStyle='#A06020'; c.fillRect(10,22,8,4); c.fillRect(46,22,8,4);
            });

            // STEIN-SPITZHACKE (Tile 64)
            drawTile(64, 0, (c) => {
                c.fillStyle = '#8B6914'; c.fillRect(24,40,8,24);
                c.fillStyle = '#888';
                c.fillRect(8,20,48,16);
                c.fillRect(8,20,12,24);
                c.fillRect(44,20,12,24);
                c.fillStyle='#666'; c.fillRect(10,22,8,4); c.fillRect(46,22,8,4);
            });

            // EISEN-SPITZHACKE (Tile 65)
            drawTile(65, 0, (c) => {
                c.fillStyle = '#8B6914'; c.fillRect(24,40,8,24);
                c.fillStyle = '#B8B8B8';
                c.fillRect(8,20,48,16);
                c.fillRect(8,20,12,24);
                c.fillRect(44,20,12,24);
                c.fillStyle='rgba(255,255,255,0.4)'; c.fillRect(10,22,8,4); c.fillRect(46,22,8,4);
            });

            // GOLD-SPITZHACKE (Tile 66)
            drawTile(66, 0, (c) => {
                c.fillStyle = '#8B6914'; c.fillRect(24,40,8,24);
                c.fillStyle = '#FFD700';
                c.fillRect(8,20,48,16);
                c.fillRect(8,20,12,24);
                c.fillRect(44,20,12,24);
                c.fillStyle='rgba(255,255,255,0.5)'; c.fillRect(10,22,8,4); c.fillRect(46,22,8,4);
            });

            // HOLZ-AXT (Tile 67)
            drawTile(67, 0, (c) => {
                c.fillStyle = '#8B6914'; c.fillRect(28,36,8,28);
                c.fillStyle = '#CD853F';
                c.fillRect(12,12,28,24); // Axtkopf
                c.fillRect(12,12,8,36);  // Schneide unten
            });

            // STEIN-AXT (Tile 68)
            drawTile(68, 0, (c) => {
                c.fillStyle = '#8B6914'; c.fillRect(28,36,8,28);
                c.fillStyle = '#888'; c.fillRect(12,12,28,24); c.fillRect(12,12,8,36);
            });

            // EISEN-AXT (Tile 69)
            drawTile(69, 0, (c) => {
                c.fillStyle = '#8B6914'; c.fillRect(28,36,8,28);
                c.fillStyle = '#B8B8B8'; c.fillRect(12,12,28,24); c.fillRect(12,12,8,36);
            });

            // GOLD-AXT (Tile 70)
            drawTile(70, 0, (c) => {
                c.fillStyle = '#8B6914'; c.fillRect(28,36,8,28);
                c.fillStyle = '#FFD700'; c.fillRect(12,12,28,24); c.fillRect(12,12,8,36);
            });

            // HOLZ-SCHAUFEL (Tile 71)
            drawTile(71, 0, (c) => {
                c.fillStyle = '#8B6914'; c.fillRect(28,28,8,36);
                c.fillStyle = '#CD853F'; c.fillRect(16,8,32,24);
                c.fillStyle = '#A06020'; c.fillRect(18,10,28,4);
            });

            // STEIN-SCHAUFEL (Tile 72)
            drawTile(72, 0, (c) => {
                c.fillStyle = '#8B6914'; c.fillRect(28,28,8,36);
                c.fillStyle = '#888'; c.fillRect(16,8,32,24);
            });

            // EISEN-SCHAUFEL (Tile 73)
            drawTile(73, 0, (c) => {
                c.fillStyle = '#8B6914'; c.fillRect(28,28,8,36);
                c.fillStyle = '#B8B8B8'; c.fillRect(16,8,32,24);
                c.fillStyle='rgba(255,255,255,0.4)'; c.fillRect(18,10,12,4);
            });

            // GOLD-SCHAUFEL (Tile 74)
            drawTile(74, 0, (c) => {
                c.fillStyle = '#8B6914'; c.fillRect(28,28,8,36);
                c.fillStyle = '#FFD700'; c.fillRect(16,8,32,24);
                c.fillStyle='rgba(255,255,255,0.5)'; c.fillRect(18,10,12,4);
            });

            // TRUHE (Tile 75) – Holztruhe mit Eisenbeschlägen
            drawTile(75, 0, (c) => {
                const woods = ['#A0724A','#8A6238','#B07E50'];
                pixelDraw(c, 64, 64, 4, () => woods[Math.floor(Math.random()*woods.length)]);
                c.fillStyle = '#7A4A1A'; c.fillRect(0,28,64,8); // Trennlinie
                c.fillStyle = '#888'; // Beschläge
                c.fillRect(4,4,8,24); c.fillRect(52,4,8,24);
                c.fillRect(4,36,8,24); c.fillRect(52,36,8,24);
                c.fillStyle = '#BBB'; c.fillRect(28,24,8,16); // Schloss
                c.fillStyle = '#888'; c.fillRect(30,28,4,8);
            });

            // DRUCKPLATTE (Tile 79) – Flache Steinplatte
            drawTile(79, 0, (c) => {
                const grays = ['#999','#888','#AAA'];
                pixelDraw(c, 64, 64, 4, () => grays[Math.floor(Math.random()*grays.length)]);
                c.strokeStyle = '#555'; c.lineWidth = 3;
                c.strokeRect(6, 6, 52, 52);
            });

            // MINENGLEIS (Tile 80) – Metallschiene
            drawTile(80, 0, (c) => {
                c.fillStyle = '#5A4A3A'; c.fillRect(0,0,64,64); // Holzuntergrund
                c.fillStyle = '#888'; // Schienen
                c.fillRect(8,0,10,64); c.fillRect(46,0,10,64);
                c.fillStyle = '#666'; // Schwellen
                for (let y=4; y<64; y+=16) { c.fillRect(0,y,64,8); }
            });

            // MINENBALKEN (Tile 81) – Holzstützbalken
            drawTile(81, 0, (c) => {
                const woods = ['#6B4226','#5C3A1E','#7A4C2C'];
                pixelDraw(c, 64, 64, 4, () => woods[Math.floor(Math.random()*woods.length)]);
                c.fillStyle = '#3A2010'; // Holzmaserung
                for (let i=0; i<3; i++) {
                    c.fillRect(0, 20+i*8, 64, 2);
                }
            });

            // GRAVIERTER SANDSTEIN (Tile 82) – Sandstein mit Reliefmuster
            drawTile(82, 0, (c) => {
                const sands = ['#D2A85A','#C9A050','#DEB06A'];
                pixelDraw(c, 64, 64, 4, () => sands[Math.floor(Math.random()*sands.length)]);
                c.fillStyle = '#A07030'; // Gravurlinien
                c.fillRect(8,8,48,4); c.fillRect(8,52,48,4);
                c.fillRect(8,8,4,48); c.fillRect(52,8,4,48);
                c.fillRect(24,20,16,24);
                c.fillStyle = '#F0D090';
                c.fillRect(26,22,12,20);
            });

            // === TIER 3: DUNGEON / WETTER / DORF BLÖCKE (IDs 83–88) ===

            // SPAWNER (Tile 83) – Dunkler Käfig-Block mit Gitterstruktur
            drawTile(83, 0, (c) => {
                const darks = ['#1A1A2E', '#16213E', '#0F3460', '#1A1A30'];
                pixelDraw(c, 64, 64, 4, () => darks[Math.floor(Math.random()*darks.length)]);
                // Gitter-Muster (vertikale und horizontale Stäbe)
                c.fillStyle = '#333355';
                for (let i = 8; i < 64; i += 12) { c.fillRect(i, 0, 2, 64); c.fillRect(0, i, 64, 2); }
                // Inneres dunkles Glühen
                c.fillStyle = 'rgba(100,0,0,0.2)';
                c.beginPath(); c.arc(32, 32, 16, 0, Math.PI*2); c.fill();
                // Kanten
                c.fillStyle = '#0A0A1A'; c.fillRect(0,0,64,3); c.fillRect(0,61,64,3); c.fillRect(0,0,3,64); c.fillRect(61,0,3,64);
            });

            // MOSSY STONE (Tile 84) – Steinziegel mit Moos-Flecken
            drawTile(84, 0, (c) => {
                // Basis: Steinziegel (wie Tile 30)
                c.fillStyle = '#808080'; c.fillRect(0, 0, 64, 64);
                const brickColors = ['#7A7A7A', '#858585', '#727272', '#8A8A8A'];
                for (let row = 0; row < 2; row++) {
                    const yOff = row * 32;
                    const xShift = row * 16;
                    for (let col = 0; col < 2; col++) {
                        c.fillStyle = brickColors[row*2+col];
                        c.fillRect((col * 32 + xShift) % 64, yOff, 30, 30);
                    }
                }
                c.fillStyle = '#555555';
                c.fillRect(0, 30, 64, 2); c.fillRect(0, 62, 64, 2);
                c.fillRect(30, 0, 2, 32); c.fillRect(14, 32, 2, 32); c.fillRect(46, 32, 2, 32);
                // Moos-Flecken drüber
                for (let i = 0; i < 16; i++) {
                    c.fillStyle = ['rgba(76,175,80,0.45)', 'rgba(56,142,60,0.4)', 'rgba(46,125,50,0.35)'][Math.floor(Math.random()*3)];
                    c.beginPath(); c.arc(Math.random()*60+2, Math.random()*60+2, 3+Math.random()*5, 0, Math.PI*2); c.fill();
                }
                // Moos am unteren Rand dichter
                c.fillStyle = 'rgba(46,125,50,0.5)';
                for (let x = 0; x < 64; x += 4) {
                    if (Math.random() > 0.4) c.fillRect(x, 56 + Math.floor(Math.random()*6), 4, 8);
                }
            });

            // COBBLESTONE (Tile 85) – Unregelmäßige Pflastersteine
            drawTile(85, 0, (c) => {
                c.fillStyle = '#6E6E6E'; c.fillRect(0, 0, 64, 64);
                const cobbleColors = ['#7A7A7A', '#6A6A6A', '#858585', '#606060', '#909090'];
                // Unregelmäßige Steine
                const stones = [
                    [2,2,18,14], [22,2,20,12], [44,2,18,16], [4,18,16,14], [22,16,18,16],
                    [42,20,20,12], [2,34,20,14], [24,34,16,14], [42,34,20,14],
                    [4,50,18,12], [24,50,16,12], [42,50,20,12]
                ];
                stones.forEach(([sx,sy,sw,sh]) => {
                    c.fillStyle = cobbleColors[Math.floor(Math.random()*cobbleColors.length)];
                    c.fillRect(sx, sy, sw, sh);
                });
                // Fugen
                c.fillStyle = '#444444';
                for (const [sx,sy,sw,sh] of stones) {
                    c.strokeStyle = '#444444'; c.lineWidth = 1;
                    c.strokeRect(sx, sy, sw, sh);
                }
                // Körnungseffekt
                pixelDraw(c, 64, 64, 4, () => Math.random() > 0.85 ? 'rgba(255,255,255,0.06)' : (Math.random() > 0.92 ? 'rgba(0,0,0,0.08)' : null));
            });

            // FIRE (Tile 86) – Flammen (semi-transparent, für Stern-Mesh)
            drawTile(86, 0, (c) => {
                c.clearRect(0, 0, 64, 64);
                // Flammen von unten nach oben
                const flameColors = ['#FF2200', '#FF6600', '#FF9900', '#FFCC00', '#FFEE44'];
                for (let i = 0; i < 8; i++) {
                    const bx = 8 + Math.random() * 40;
                    const h = 20 + Math.random() * 35;
                    const w = 6 + Math.random() * 10;
                    const grad = c.createLinearGradient(bx, 64, bx, 64 - h);
                    grad.addColorStop(0, flameColors[0]);
                    grad.addColorStop(0.3, flameColors[1]);
                    grad.addColorStop(0.5, flameColors[2]);
                    grad.addColorStop(0.7, flameColors[3]);
                    grad.addColorStop(1, flameColors[4]);
                    c.fillStyle = grad;
                    c.beginPath();
                    c.moveTo(bx, 64);
                    c.quadraticCurveTo(bx - w/2, 64 - h*0.6, bx + (Math.random()-0.5)*8, 64 - h);
                    c.quadraticCurveTo(bx + w/2, 64 - h*0.6, bx + w*0.3, 64);
                    c.fill();
                }
                // Glühende Basis
                c.fillStyle = 'rgba(255,100,0,0.4)';
                c.fillRect(6, 56, 52, 8);
            });

            // VILLAGE_PATH (Tile 87) – Kompakter brauner Dorfweg
            drawTile(87, 0, (c) => {
                const pathColors = ['#8B6B3D', '#7D5F35', '#9A7A4A', '#705530', '#8C7040'];
                pixelDraw(c, 64, 64, 2, () => pathColors[Math.floor(Math.random()*pathColors.length)]);
                // Verdichtungs-Effekt (dunkler in der Mitte)
                const grad = c.createRadialGradient(32, 32, 0, 32, 32, 40);
                grad.addColorStop(0, 'rgba(0,0,0,0.08)'); grad.addColorStop(1, 'rgba(0,0,0,0)');
                c.fillStyle = grad; c.fillRect(0, 0, 64, 64);
                // Kleine Kiesel
                for (let i = 0; i < 10; i++) {
                    c.fillStyle = ['#999', '#888', '#777'][Math.floor(Math.random()*3)];
                    c.fillRect(Math.random()*60+2, Math.random()*60+2, 3, 2);
                }
                // Leichte Oberflächen-Glätte
                c.fillStyle = 'rgba(255,255,255,0.04)'; c.fillRect(0, 0, 64, 64);
            });

            // HAY_BALE (Tile 88) – Gelber Strohballen mit Bindung
            drawTile(88, 0, (c) => {
                c.fillStyle = '#D4A820'; c.fillRect(0, 0, 64, 64);
                // Stroh-Fasern (vertikale Linien)
                const strawColors = ['#D4A820', '#C89A18', '#E0B830', '#BA8E10', '#CCAA28'];
                for (let x = 0; x < 64; x += 2) {
                    c.fillStyle = strawColors[Math.floor(Math.random()*strawColors.length)];
                    c.fillRect(x, 0, 2, 64);
                }
                // Horizontale Bindungen (Seil)
                c.fillStyle = '#8B5E14';
                c.fillRect(0, 14, 64, 4); c.fillRect(0, 46, 64, 4);
                c.fillStyle = '#6B4A0E';
                c.fillRect(0, 16, 64, 2); c.fillRect(0, 48, 64, 2);
                // Knoten
                c.fillStyle = '#7A520C';
                c.fillRect(28, 12, 8, 8); c.fillRect(28, 44, 8, 8);
                // Stroh-Textur über die Bindungen hinaus
                pixelDraw(c, 64, 64, 4, () => Math.random() > 0.88 ? 'rgba(0,0,0,0.08)' : null);
            });

            const drawSwordTile = (tile, bladeColor, highlightColor) => drawTile(tile, 0, (c) => {
                c.clearRect(0, 0, 64, 64);
                c.fillStyle = '#6B4226';
                c.fillRect(28, 43, 8, 15);
                c.fillStyle = '#3D2A1F';
                c.fillRect(24, 56, 16, 6);
                c.fillStyle = '#4A382A';
                c.fillRect(18, 39, 28, 6);
                c.fillStyle = bladeColor;
                c.fillRect(25, 10, 14, 31);
                c.fillRect(28, 5, 8, 5);
                c.fillStyle = highlightColor;
                c.fillRect(28, 11, 4, 27);
                c.fillStyle = 'rgba(0,0,0,0.22)';
                c.fillRect(35, 12, 4, 27);
            });
            drawSwordTile(89, '#B8793F', '#E0AD72');
            drawSwordTile(90, '#777777', '#B0B0B0');
            drawSwordTile(91, '#BFC7CF', '#F1F5F8');
            drawSwordTile(92, '#E2B814', '#FFF176');

            atlasDataURL = canvas.toDataURL("image/png");


            const tex = new THREE.CanvasTexture(canvas);
            tex.magFilter = THREE.NearestFilter; tex.minFilter = THREE.NearestFilter;
            tex.generateMipmaps = false; 
            return tex;
        }
export let atlasDataURL = "";
        export const textureAtlas = createTextureAtlas();
