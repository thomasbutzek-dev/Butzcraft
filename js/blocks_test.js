
const THREE = {
    CanvasTexture: class {},
    NearestFilter: "nearest"
};
const document = {
    createElement: (tag) => {
        if (tag === 'canvas') {
            return {
                getContext: () => ({
                    save: () => {}, restore: () => {}, translate: () => {},
                    fillRect: () => {}, fillStyle: "", createLinearGradient: () => ({ addColorStop:()=>{} }),
                    beginPath: () => {}, ellipse: () => {}, fill: () => {},
                    arc: () => {}, moveTo: () => {}, lineTo: () => {}
                }),
                toDataURL: () => "data:image/png;base64,12345"
            };
        }
    }
};
const Math = global.Math;


export const BLOCK_TYPES = {
            AIR: 0, GRASS: 1, DIRT: 2, STONE: 3, WATER: 4, WOOD: 5, LEAVES: 6, SAND: 7, CLOUD: 8, FLOWER_RED: 9, FLOWER_YELLOW: 10, SNOW: 11, ICE: 12, JUNGLE_WOOD: 13, JUNGLE_LEAVES: 14, PALM_WOOD: 15, PALM_LEAVES: 16, EGG: 17, MILK: 18, WOOL: 19, BEDROCK: 20
        };

        export const BLOCK_COLORS = {
            [BLOCK_TYPES.GRASS]: 0x5d9943, [BLOCK_TYPES.DIRT]: 0x8B4513, [BLOCK_TYPES.STONE]: 0x808080, [BLOCK_TYPES.WATER]: 0x40a4df,
            [BLOCK_TYPES.WOOD]: 0x5D4037, [BLOCK_TYPES.LEAVES]: 0x2e5e22, [BLOCK_TYPES.SAND]: 0xEDC9AF, [BLOCK_TYPES.CLOUD]: 0xffffff,
            [BLOCK_TYPES.FLOWER_RED]: 0xff0000, [BLOCK_TYPES.FLOWER_YELLOW]: 0xffff00, [BLOCK_TYPES.SNOW]: 0xffffff,
            [BLOCK_TYPES.ICE]: 0xa5f2f3, [BLOCK_TYPES.JUNGLE_WOOD]: 0x3d2b1f, [BLOCK_TYPES.JUNGLE_LEAVES]: 0x1a4a15,
            [BLOCK_TYPES.PALM_WOOD]: 0xAC8E68, [BLOCK_TYPES.PALM_LEAVES]: 0x3A5F0B, [BLOCK_TYPES.WOOL]: 0xffffff, [BLOCK_TYPES.BEDROCK]: 0x222222
        };

        export const BLOCK_TEX = {
            [BLOCK_TYPES.GRASS]: 0, [BLOCK_TYPES.DIRT]: 1, [BLOCK_TYPES.STONE]: 2, [BLOCK_TYPES.WATER]: 3,
            [BLOCK_TYPES.WOOD]: 4, [BLOCK_TYPES.LEAVES]: 5, [BLOCK_TYPES.SAND]: 6, [BLOCK_TYPES.CLOUD]: 7,
            [BLOCK_TYPES.SNOW]: 8, [BLOCK_TYPES.ICE]: 9, [BLOCK_TYPES.JUNGLE_WOOD]: 10, [BLOCK_TYPES.JUNGLE_LEAVES]: 11,
            [BLOCK_TYPES.PALM_WOOD]: 12, [BLOCK_TYPES.PALM_LEAVES]: 13, [BLOCK_TYPES.BEDROCK]: 14,
            [BLOCK_TYPES.FLOWER_RED]: 15, [BLOCK_TYPES.FLOWER_YELLOW]: 16
        };

// --- TEXTURE GENERATOR ---
        export function createTextureAtlas() {
            const canvas = document.createElement('canvas');
            canvas.width = 1024; canvas.height = 1024; // 64x64 pro Tile (16x16 Grid)
            const ctx = canvas.getContext('2d');
            ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, 1024, 1024);
            
            const drawTile = (tx, ty, drawFunc) => {
                ctx.save(); ctx.translate(tx * 64, ty * 64);
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
            drawTile(0, 0, (c) => { 
                const greens = ['#64DD17', '#76FF03', '#4CAF50', '#43A047', '#558B2F'];
                pixelDraw(c, 64, 64, 2, (x, y) => greens[Math.floor(Math.random() * greens.length)]);
                const grad = c.createLinearGradient(0,0,0,64);
                grad.addColorStop(0, 'rgba(255, 255, 255, 0.15)');
                grad.addColorStop(1, 'rgba(0, 0, 0, 0.05)'); // Soft edge at bottom
                c.fillStyle = grad; c.fillRect(0,0,64,64);
            });
            // ERDE (Sauberes Braun mit kontrastreichen Krümeln)
            drawTile(1, 0, (c) => { 
                const browns = ['#6D4C41', '#5D4037', '#4E342E', '#3E2723'];
                pixelDraw(c, 64, 64, 4, (x, y) => browns[Math.floor(Math.random() * browns.length)]);
            });
            // STEIN (Scharfe Pixelfelsen, helles Grau)
            drawTile(2, 0, (c) => { 
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
            drawTile(4, 0, (c) => { 
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
            drawTile(6, 0, (c) => { 
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
                // Stem
                c.fillStyle = '#4CAF50'; c.fillRect(28, 16, 8, 48);
                // Leaves
                c.fillRect(16, 36, 12, 8); c.fillRect(36, 44, 12, 8);
                // Petals
                const reds = ['#E53935', '#F44336', '#EF5350'];
                pixelDraw(c, 64, 32, 4, (x, y) => {
                    const dist = Math.hypot(x-32, y-16);
                    if (dist < 8) return '#FDD835'; // Center
                    if (dist < 20) return reds[Math.floor(Math.random() * reds.length)];
                    return 'rgba(0,0,0,0)';
                });
            });
            // FLOWER YELLOW
            drawTile(16, 0, (c) => { 
                c.fillStyle = '#64DD17'; c.fillRect(28, 20, 8, 44);
                c.fillRect(12, 44, 16, 6); c.fillRect(36, 34, 16, 6);
                const yellows = ['#FFF176', '#FFEE58', '#FDD835'];
                pixelDraw(c, 64, 40, 4, (x, y) => {
                    const dist = Math.hypot(x-32, y-20);
                    if (dist < 6) return '#F57F17'; 
                    if (dist < 18) return yellows[Math.floor(Math.random() * yellows.length)];
                    return 'rgba(0,0,0,0)';
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
                c.fillStyle = "rgba(0,0,0,0)"; c.fillRect(0,0,64,64);
                c.fillStyle = "#FFECB3"; c.beginPath(); c.ellipse(32, 32, 16, 24, 0, 0, Math.PI*2); c.fill();
                c.fillStyle = "rgba(0,0,0,0.1)"; c.beginPath(); c.ellipse(36, 36, 12, 18, 0, 0, Math.PI*2); c.fill();
            });
            // ITEM: MEAT
            drawTile(22, 0, (c) => { 
                c.fillStyle = "rgba(0,0,0,0)"; c.fillRect(0,0,64,64);
                c.fillStyle = "#F44336"; c.fillRect(20,20, 24,24);
                c.fillStyle = "#FFCDD2"; c.fillRect(16,20, 4,8); c.fillRect(36,20, 8,4); // Bone/Fat
            });
            // ITEM: MILK
            drawTile(23, 0, (c) => { 
                c.fillStyle = "rgba(0,0,0,0)"; c.fillRect(0,0,64,64);
                c.fillStyle = "#B0BEC5"; c.fillRect(20, 20, 24, 30); // Bucket
                c.fillStyle = "#90A4AE"; c.fillRect(16, 16, 32, 4); // Handle
                c.fillStyle = "#FFFFFF"; c.fillRect(22, 20, 20, 4); // Milk
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

            
            atlasDataURL = canvas.toDataURL("image/png");


            const tex = new THREE.CanvasTexture(canvas);
            tex.magFilter = THREE.NearestFilter; tex.minFilter = THREE.NearestFilter;
            tex.generateMipmaps = false; 
            return tex;
        }
export let atlasDataURL = "";
        export const textureAtlas = createTextureAtlas();
console.log("atlasDataURL exports as:", atlasDataURL);
console.log("textureAtlas exports as:", typeof textureAtlas);
