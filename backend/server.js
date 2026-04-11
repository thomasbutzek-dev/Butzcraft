const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 3003;
const CONFIG_PATH = path.join(__dirname, '..', 'config.js');

// Allowed config keys that are considered "Safe" to edit 
// We block world generation values like CHUNK_SIZE or CHUNK_HEIGHT for memory safety.
const SAFE_CONFIG_KEYS = {
    DAY_DURATION: true,
    MAX_HEALTH: true,
    MAX_HUNGER: true,
    HUNGER_LOSS_PASSIVE: true,
    HUNGER_LOSS_MOVE: true,
    HUNGER_GAIN_PIG: true,
    HUNGER_GAIN_EGG: true,
    HUNGER_GAIN_MILK: true,
    REGEN_RATE: true,
    REGEN_THRESHOLD: true,
    FALL_DAMAGE_MULT: true,

    MAX_COUNT: true,
    SPAWN_CHANCE: true,
    SPAWN_DIST_MIN: true,
    SPAWN_DIST_MAX: true,
    WEIGHT_COW: true,
    WEIGHT_PIG: true,
    WEIGHT_SHEEP: true,
    WEIGHT_CHICKEN: true,
    ZOMBIE_SPEED: true,
    ZOMBIE_DAMAGE: true,
    WANDER_SPEED: true,

    GRAVITY: true,
    GRAVITY_MULTIPLIER: true,
    WATER_DRAG: true,
    JUMP_FORCE: true,
    PLAYER_JUMP_FORCE: true,
    WALK_SPEED: true,
    FRICTION: true
};

const server = http.createServer((req, res) => {
    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'OPTIONS, GET, POST');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        res.writeHead(204);
        res.end();
        return;
    }

    // API Routing
    if (req.url === '/api/config') {
        if (req.method === 'GET') {
            fs.readFile(CONFIG_PATH, 'utf8', (err, data) => {
                if (err) {
                    res.writeHead(500, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: "Fehler beim Lesen der config.js" }));
                    return;
                }
                
                // Parse lines to safely extract key-value pairs
                const currentConfig = {};
                const lines = data.split('\n');
                lines.forEach(line => {
                    const match = line.match(/^\s*([A-Z_]+)\s*:\s*([^,]+)/);
                    if (match && SAFE_CONFIG_KEYS[match[1]]) {
                        currentConfig[match[1]] = parseFloat(match[2]);
                    }
                });

                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify(currentConfig));
            });
            return;
        }

        if (req.method === 'POST') {
            let body = '';
            req.on('data', chunk => body += chunk.toString());
            req.on('end', () => {
                try {
                    const newConfig = JSON.parse(body);
                    fs.readFile(CONFIG_PATH, 'utf8', (err, data) => {
                        if (err) throw err;
                        
                        let updatedData = data;
                        for (const key in newConfig) {
                            if (SAFE_CONFIG_KEYS[key] && !isNaN(newConfig[key])) {
                                // Match key: value exactly, replace value while keeping trailing comma/comments
                                const regex = new RegExp(`^(\\s*${key}\\s*:\\s*)[\\d\\.]+(.*)$`, "m");
                                updatedData = updatedData.replace(regex, `$1${newConfig[key]}$2`);
                            }
                        }

                        fs.writeFileSync(CONFIG_PATH, updatedData, 'utf8');
                        
                        res.writeHead(200, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ success: true, message: "Konfiguration gespeichert" }));
                    });
                } catch (e) {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: "Ungültiges Datenformat" }));
                }
            });
            return;
        }
    }

    // Static Server Logic for /backend/public
    let filePath = path.join(__dirname, 'public', req.url === '/' ? 'index.html' : req.url);
    const ext = path.extname(filePath);
    let contentType = 'text/html';
    
    switch (ext) {
        case '.js': contentType = 'text/javascript'; break;
        case '.css': contentType = 'text/css'; break;
        case '.json': contentType = 'application/json'; break;
        case '.png': contentType = 'image/png'; break;
    }

    fs.readFile(filePath, (err, content) => {
        if (err) {
            if (err.code === 'ENOENT') {
                res.writeHead(404);
                res.end('404 Not Found');
            } else {
                res.writeHead(500);
                res.end(`Serever Error: ${err.code}`);
            }
        } else {
            res.writeHead(200, { 'Content-Type': contentType });
            res.end(content, 'utf-8');
        }
    });
});

server.listen(PORT, () => {
    console.log(`Backend Dashboard erreichbar unter http://localhost:${PORT}`);
});
