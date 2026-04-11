import * as THREE from 'three';

export const BLOCK_TYPES = {
        AIR: 0, GRASS: 1, DIRT: 2, STONE: 3, WATER: 4, WOOD: 5, LEAVES: 6, SAND: 7, CLOUD: 8, FLOWER_RED: 9, FLOWER_YELLOW: 10, SNOW: 11, ICE: 12, JUNGLE_WOOD: 13, JUNGLE_LEAVES: 14, PALM_WOOD: 15, PALM_LEAVES: 16, EGG: 17, MILK: 18, WOOL: 19, BEDROCK: 20, FISH: 21, RAW_MEAT: 22, RAW_CHICKEN: 23, ROTTEN_FLESH: 24, MUTTON: 25, PLANKS: 26, STICK: 27, WORKBENCH: 28, STONE_BRICK: 29, SANDSTONE: 30, BONE: 31, WINDOW: 32, DOOR_BOTTOM: 33, DOOR_TOP: 34, WORKBENCH_SIDE: 36, BED_HEAD: 38, BED_FOOT: 39,
        BERRY_BUSH: 43, TALL_GRASS: 44, CACTUS: 45, DEAD_BUSH: 46, MUSHROOM_RED: 47, MUSHROOM_BROWN: 48, SUGARCANE: 49, FERN: 50, BERRIES: 51, BERRY_BUSH_EMPTY: 52
        };

        export const BLOCK_COLORS = {
            [BLOCK_TYPES.GRASS]: 0x5d9943, [BLOCK_TYPES.DIRT]: 0x8B4513, [BLOCK_TYPES.STONE]: 0x808080, [BLOCK_TYPES.WATER]: 0x40a4df,
            [BLOCK_TYPES.WOOD]: 0x5D4037, [BLOCK_TYPES.LEAVES]: 0x2e5e22, [BLOCK_TYPES.SAND]: 0xEDC9AF, [BLOCK_TYPES.CLOUD]: 0xffffff,
            [BLOCK_TYPES.FLOWER_RED]: 0xff0000, [BLOCK_TYPES.FLOWER_YELLOW]: 0xffff00, [BLOCK_TYPES.SNOW]: 0xffffff,
            [BLOCK_TYPES.ICE]: 0xa5f2f3, [BLOCK_TYPES.JUNGLE_WOOD]: 0x3d2b1f, [BLOCK_TYPES.JUNGLE_LEAVES]: 0x1a4a15,
            [BLOCK_TYPES.PALM_WOOD]: 0xAC8E68, [BLOCK_TYPES.PALM_LEAVES]: 0x3A5F0B, [BLOCK_TYPES.WOOL]: 0xffffff, [BLOCK_TYPES.BEDROCK]: 0x222222, [BLOCK_TYPES.FISH]: 0xFF9800, [BLOCK_TYPES.RAW_MEAT]: 0xFF9999, [BLOCK_TYPES.RAW_CHICKEN]: 0xFFEEBB, [BLOCK_TYPES.ROTTEN_FLESH]: 0x3a5f0b, [BLOCK_TYPES.MUTTON]: 0xFFB6C1,
            [BLOCK_TYPES.PLANKS]: 0xCD853F, [BLOCK_TYPES.STICK]: 0x8B4513, [BLOCK_TYPES.WORKBENCH]: 0xA0522D, [BLOCK_TYPES.STONE_BRICK]: 0x696969, [BLOCK_TYPES.SANDSTONE]: 0xF4A460, [BLOCK_TYPES.BONE]: 0xFFFFFF,
            [BLOCK_TYPES.WINDOW]: 0x88CCEE, [BLOCK_TYPES.DOOR_BOTTOM]: 0xA0724A, [BLOCK_TYPES.DOOR_TOP]: 0xA0724A, [BLOCK_TYPES.BED_HEAD]: 0xCC3333, [BLOCK_TYPES.BED_FOOT]: 0xCC3333,
            [BLOCK_TYPES.WORKBENCH_SIDE]: 0xA0522D,
            [BLOCK_TYPES.BERRY_BUSH]: 0x2E7D32, [BLOCK_TYPES.TALL_GRASS]: 0x4CAF50, [BLOCK_TYPES.CACTUS]: 0x2E7D32, [BLOCK_TYPES.DEAD_BUSH]: 0x8D6E63, [BLOCK_TYPES.MUSHROOM_RED]: 0xE53935, [BLOCK_TYPES.MUSHROOM_BROWN]: 0x795548, [BLOCK_TYPES.SUGARCANE]: 0x81C784, [BLOCK_TYPES.FERN]: 0x388E3C, [BLOCK_TYPES.BERRIES]: 0xE53935, [BLOCK_TYPES.BERRY_BUSH_EMPTY]: 0x33691E
        };

        export const BLOCK_TEX = {
            [BLOCK_TYPES.GRASS]: 0, [BLOCK_TYPES.DIRT]: 1, [BLOCK_TYPES.STONE]: 2, [BLOCK_TYPES.WATER]: 3,
            [BLOCK_TYPES.WOOD]: 4, [BLOCK_TYPES.LEAVES]: 5, [BLOCK_TYPES.SAND]: 6, [BLOCK_TYPES.CLOUD]: 7,
            [BLOCK_TYPES.SNOW]: 8, [BLOCK_TYPES.ICE]: 9, [BLOCK_TYPES.JUNGLE_WOOD]: 10, [BLOCK_TYPES.JUNGLE_LEAVES]: 11,
            [BLOCK_TYPES.PALM_WOOD]: 12, [BLOCK_TYPES.PALM_LEAVES]: 13, [BLOCK_TYPES.BEDROCK]: 14,
            [BLOCK_TYPES.FLOWER_RED]: 15, [BLOCK_TYPES.FLOWER_YELLOW]: 16,
            [BLOCK_TYPES.PLANKS]: 27, [BLOCK_TYPES.STICK]: 28, [BLOCK_TYPES.WORKBENCH]: 29, [BLOCK_TYPES.STONE_BRICK]: 30, [BLOCK_TYPES.SANDSTONE]: 31, [BLOCK_TYPES.BONE]: 32, [BLOCK_TYPES.WORKBENCH_SIDE]: 36,
            [BLOCK_TYPES.WINDOW]: 38, [BLOCK_TYPES.DOOR_BOTTOM]: 39, [BLOCK_TYPES.DOOR_TOP]: 40, [BLOCK_TYPES.BED_HEAD]: 41, [BLOCK_TYPES.BED_FOOT]: 42,
            [BLOCK_TYPES.BERRY_BUSH]: 43, [BLOCK_TYPES.TALL_GRASS]: 44, [BLOCK_TYPES.CACTUS]: 45, [BLOCK_TYPES.DEAD_BUSH]: 46, [BLOCK_TYPES.MUSHROOM_RED]: 47, [BLOCK_TYPES.MUSHROOM_BROWN]: 48, [BLOCK_TYPES.SUGARCANE]: 49, [BLOCK_TYPES.FERN]: 50, [BLOCK_TYPES.BERRIES]: 51, [BLOCK_TYPES.BERRY_BUSH_EMPTY]: 52
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

            // GRAS (Sattes, klares HD-Grün, top-reflektiv wie im Vorbild)
            drawTile(0, 0, (c) => { c.fillStyle='#fff'; c.fillRect(0,0,64,64); 
                const greens = ['#64DD17', '#76FF03', '#4CAF50', '#43A047', '#558B2F'];
                pixelDraw(c, 64, 64, 2, (x, y) => greens[Math.floor(Math.random() * greens.length)]);
                const grad = c.createLinearGradient(0,0,0,64);
                grad.addColorStop(0, 'rgba(255, 255, 255, 0.15)');
                grad.addColorStop(1, 'rgba(0, 0, 0, 0.05)'); // Soft edge at bottom
                c.fillStyle = grad; c.fillRect(0,0,64,64);
            });
            // ERDE (Sauberes Braun mit kontrastreichen Krümeln)
            drawTile(1, 0, (c) => { c.fillStyle='#fff'; c.fillRect(0,0,64,64); 
                const browns = ['#6D4C41', '#5D4037', '#4E342E', '#3E2723'];
                pixelDraw(c, 64, 64, 4, (x, y) => browns[Math.floor(Math.random() * browns.length)]);
            });
            // STEIN (Scharfe Pixelfelsen, helles Grau)
            drawTile(2, 0, (c) => { c.fillStyle='#fff'; c.fillRect(0,0,64,64); 
                const grays = ['#9E9E9E', '#A4A4A4', '#8E8E8E', '#757575'];
                pixelDraw(c, 64, 64, 4, (x, y) => grays[Math.floor(Math.random() * grays.length)]);
                c.fillStyle = 'rgba(0,0,0,0.1)'; c.fillRect(0,0,64,2); c.fillRect(0,0,2,64);
            });
            // WASSER (Extrem klares, tropisches Türkisblau)
            drawTile(3, 0, (c) => { 
                c.fillStyle = 'rgba(3, 169, 244, 0.5)'; c.fillRect(0,0,64,64);
                drawNoise(c, 64, 64, 4, ['rgba(255,255,255,0.0)', 'rgba(255,255,255,0.0)', 'rgba(255,255,255,0.1)', 'rgba(255,255,255,0.2)']);
                for(let i=0; i<15; i++) {
                    c.fillStyle = 'rgba(255,255,255,0.25)';
                    c.fillRect(Math.random()*64, Math.random()*64, 12+Math.random()*24, 2);
                }
            });
            // HOLZ (Crispe Rinden-Pixel-Struktur)
            drawTile(4, 0, (c) => { c.fillStyle='#fff'; c.fillRect(0,0,64,64); 
                const barkLine = ['#4E342E', '#3E2723', '#212121'];
                pixelDraw(c, 64, 64, 4, (x, y) => {
                    const line = Math.floor(x / 4);
                    return barkLine[(line + Math.floor(Math.random()*2)) % barkLine.length];
                });
            });
            // LAUB (Detailreiches Pixel-Muster mit Schatten)
            drawTile(5, 0, (c) => { 
                const lgs = ['#2E7D32', '#1B5E20', '#388E3C', '#1B5E20'];
                pixelDraw(c, 64, 64, 4, (x, y) => {
                    if (Math.random() > 0.8) return 'rgba(0,0,0,0)'; // WICHTIGER TRANSPARENZ CHECK IN THREEJS
                    return lgs[Math.floor(Math.random() * lgs.length)];
                });
            });
            // SAND (Strahlend, glatt und hell wie Minecraft Shader)
            drawTile(6, 0, (c) => { c.fillStyle='#fff'; c.fillRect(0,0,64,64); 
                const sands = ['#FFE082', '#FFCA28', '#FFD54F', '#FFF090'];
                pixelDraw(c, 64, 64, 4, (x, y) => sands[Math.floor(Math.random() * sands.length)]);
            });
            // NEUTRAL / CLOUD
            drawTile(7, 0, (c) => { 
               c.fillStyle = '#ffffff'; c.fillRect(0,0,64,64);
               drawNoise(c, 64, 64, 16, ['#ffffff', '#f5f5f5', '#eeeeee']);
            });
            // SCHNEE (Blendend weiß mit Mini-Glitzer)
            drawTile(8, 0, (c) => { 
                c.fillStyle = '#ffffff'; c.fillRect(0,0,64,64);
                drawNoise(c, 64, 64, 4, ['#ffffff', '#FAFAFA', '#F5F5F5', '#E0E0E0']);
            });
            // EIS (Leicht transparent)
            drawTile(9, 0, (c) => { 
                c.fillStyle = 'rgba(128, 222, 234, 0.5)'; c.fillRect(0,0,64,64);
                c.fillStyle = 'rgba(255,255,255,0.5)'; c.fillRect(0,0,64,2); c.fillRect(0,0,2,64);
            });
            // JUNGLE WOOD
            drawTile(10, 0, (c) => { 
                drawNoise(c, 64, 64, 4, ['#3E2723', '#212121', '#4E342E']);
                c.fillStyle = 'rgba(76, 175, 80, 0.3)'; c.fillRect(0,0,64,64); // Moos überzug
            });
            // JUNGLE LEAVES
            drawTile(11, 0, (c) => { 
                const lgs = ['#1B5E20', '#33691E'];
                pixelDraw(c, 64, 64, 4, (x, y) => {
                    if (Math.random() > 0.8) return 'rgba(0,0,0,0)';
                    return lgs[Math.floor(Math.random() * lgs.length)];
                });
            });
            // PALM WOOD (Helles Beige-Braun)
            drawTile(12, 0, (c) => { 
                drawNoise(c, 64, 64, 4, ['#D7CCC8', '#BCAAA4', '#A1887F']);
                for(let i=0; i<64; i+=12) { c.fillStyle='#5D4037'; c.fillRect(0, i, 64, 3); }
            });
            // PALM LEAVES (Lange, kräftige Bahnen)
            drawTile(13, 0, (c) => { 
                c.fillStyle = '#1B5E20'; c.fillRect(0,0,64,64);
                c.fillStyle = '#4CAF50';
                for(let i=0; i<64; i+=16) { c.fillRect(0, i, 64, 4); c.fillRect(i, 0, 4, 64); }
            });
            // BEDROCK
            drawTile(14, 0, (c) => { 
                drawNoise(c, 64, 64, 8, ['#000000', '#212121', '#111111']);
            });
            // FLOWER RED
            drawTile(15, 0, (c) => { 
                c.fillStyle = '#4CAF50'; c.fillRect(29, 24, 6, 40);
                c.beginPath(); c.ellipse(22, 44, 8, 4, -0.4, 0, Math.PI*2); c.fill();
                c.beginPath(); c.ellipse(42, 40, 8, 4, 0.4, 0, Math.PI*2); c.fill();
                const reds = ['#E53935', '#F44336', '#EF5350'];
                for(let i=0; i<8; i++) {
                    const a = i * Math.PI / 4;
                    c.fillStyle = reds[i % reds.length];
                    c.beginPath(); c.ellipse(32 + Math.cos(a)*10, 20 + Math.sin(a)*10, 8, 8, a, 0, Math.PI*2); c.fill();
                }
                c.fillStyle = '#FDD835'; c.beginPath(); c.arc(32, 20, 6, 0, Math.PI*2); c.fill();
            });
            // FLOWER YELLOW
            drawTile(16, 0, (c) => { 
                c.fillStyle = '#64DD17'; c.fillRect(30, 26, 4, 38);
                c.beginPath(); c.ellipse(24, 48, 6, 3, -0.4, 0, Math.PI*2); c.fill();
                c.beginPath(); c.ellipse(40, 42, 6, 3, 0.4, 0, Math.PI*2); c.fill();
                const yellows = ['#FFF176', '#FFEE58', '#FFEB3B'];
                for(let i=0; i<12; i++) {
                    const a = i * Math.PI / 6;
                    c.fillStyle = yellows[i % yellows.length];
                    c.beginPath(); c.ellipse(32 + Math.cos(a)*8, 22 + Math.sin(a)*8, 4, 10, a, 0, Math.PI*2); c.fill();
                }
                c.fillStyle = '#F57F17'; c.beginPath(); c.arc(32, 22, 5, 0, Math.PI*2); c.fill();
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

            // RECIPE ITEM: PLANKS
            drawTile(27, 0, (c) => { 
                c.fillStyle='#CD853F'; c.fillRect(0,0,64,64); 
                c.fillStyle='#8B4513';
                for(let i=15; i<64; i+=16) { c.fillRect(0, i, 64, 2); }
                pixelDraw(c, 64, 64, 4, (x, y) => Math.random()>0.8 ? 'rgba(0,0,0,0.1)' : '');
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
            // RECIPE ITEM: STONE_BRICK
            drawTile(30, 0, (c) => { 
                c.fillStyle='#757575'; c.fillRect(0,0,64,64); 
                c.fillStyle='#424242';
                for(let i=31; i<64; i+=32) { c.fillRect(0, i, 64, 2); }
                c.fillRect(31, 0, 2, 32); c.fillRect(15, 32, 2, 32); c.fillRect(47, 32, 2, 32);
                pixelDraw(c, 64, 64, 4, (x, y) => Math.random()>0.8 ? 'rgba(255,255,255,0.05)' : '');
            });
            // RECIPE ITEM: SANDSTONE
            drawTile(31, 0, (c) => { 
                c.fillStyle='#FFE082'; c.fillRect(0,0,64,64); 
                c.fillStyle='#FFCA28';
                for(let i=0; i<64; i+=8) { c.fillRect(0, i, 64, 2); }
                pixelDraw(c, 64, 64, 4, (x, y) => Math.random()>0.9 ? 'rgba(0,0,0,0.05)' : '');
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
                // Busch-Basis (dichtes Grün)
                const greens = ['#2E7D32', '#1B5E20', '#388E3C', '#33691E'];
                pixelDraw(c, 64, 64, 4, (x, y) => {
                    if (x < 8 || x > 56 || y < 12 || y > 60) { if (Math.random() > 0.3) return null; }
                    return greens[Math.floor(Math.random() * greens.length)];
                });
                // Beeren (rote Punkte)
                const berryPositions = [[16,24],[28,20],[44,28],[20,40],[36,36],[48,44],[24,52],[40,52],[32,44]];
                berryPositions.forEach(([bx,by]) => {
                    c.fillStyle = '#E53935'; c.beginPath(); c.arc(bx, by, 4, 0, Math.PI*2); c.fill();
                    c.fillStyle = 'rgba(255,255,255,0.3)'; c.beginPath(); c.arc(bx-1, by-1, 1.5, 0, Math.PI*2); c.fill();
                });
            });

            // 44: TALL_GRASS (Hohes Gras)
            drawTile(44, 0, (c) => {
                c.clearRect(0, 0, 64, 64);
                const grassColors = ['#4CAF50', '#66BB6A', '#43A047', '#388E3C'];
                // Mehrere Grashalme
                for (let i = 0; i < 10; i++) {
                    const bx = 8 + Math.random() * 48;
                    const h = 20 + Math.random() * 30;
                    c.strokeStyle = grassColors[Math.floor(Math.random() * grassColors.length)];
                    c.lineWidth = 3 + Math.random() * 3;
                    c.beginPath();
                    c.moveTo(bx, 64);
                    c.quadraticCurveTo(bx + (Math.random()-0.5)*16, 64 - h*0.6, bx + (Math.random()-0.5)*12, 64 - h);
                    c.stroke();
                }
            });

            // 45: CACTUS (Kaktus)
            drawTile(45, 0, (c) => {
                c.fillStyle = '#2E7D32'; c.fillRect(0, 0, 64, 64);
                // Dunklere Streifen
                c.fillStyle = '#1B5E20';
                for (let i = 7; i < 64; i += 8) { c.fillRect(i, 0, 2, 64); }
                // Stacheln
                c.fillStyle = '#FFF9C4';
                for (let i = 0; i < 20; i++) {
                    const sx = Math.random() * 60 + 2, sy = Math.random() * 60 + 2;
                    c.fillRect(sx, sy, 2, 2);
                }
                // Rahmen (leicht dunkler, Kaktus ist nicht ganz blockvoll)
                c.fillStyle = 'rgba(0,0,0,0.15)'; c.fillRect(0, 0, 4, 64); c.fillRect(60, 0, 4, 64);
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
                c.strokeStyle = '#2E7D32'; c.lineWidth = 2;
                // Zentraler Stiel
                c.beginPath(); c.moveTo(32, 62); c.lineTo(32, 10); c.stroke();
                // Wedel
                const fernColors = ['#388E3C', '#2E7D32', '#1B5E20'];
                for (let i = 0; i < 7; i++) {
                    const y = 56 - i * 7;
                    const spread = 8 + i * 2.5;
                    c.strokeStyle = fernColors[i % fernColors.length];
                    c.lineWidth = 2;
                    // Links
                    c.beginPath(); c.moveTo(32, y); c.quadraticCurveTo(32 - spread*0.6, y - 4, 32 - spread, y + 2); c.stroke();
                    // Rechts
                    c.beginPath(); c.moveTo(32, y); c.quadraticCurveTo(32 + spread*0.6, y - 4, 32 + spread, y + 2); c.stroke();
                }
                // Spitze
                c.fillStyle = '#4CAF50'; c.beginPath(); c.moveTo(32, 10); c.lineTo(28, 18); c.lineTo(36, 18); c.fill();
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
                // Busch-Basis (dunkles Grün, weniger dicht)
                const greens = ['#33691E', '#1B5E20', '#2E7D32'];
                pixelDraw(c, 64, 64, 4, (x, y) => {
                    if (x < 10 || x > 54 || y < 16 || y > 58) { if (Math.random() > 0.2) return null; }
                    if (Math.random() > 0.7) return null;
                    return greens[Math.floor(Math.random() * greens.length)];
                });
            });

            atlasDataURL = canvas.toDataURL("image/png");


            const tex = new THREE.CanvasTexture(canvas);
            tex.magFilter = THREE.NearestFilter; tex.minFilter = THREE.NearestFilter;
            tex.generateMipmaps = false; 
            return tex;
        }
export let atlasDataURL = "";
        export const textureAtlas = createTextureAtlas();