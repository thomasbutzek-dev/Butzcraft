const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// CORS: Nur lokale Entwicklung erlauben (anpassbar via ALLOWED_ORIGINS env var, kommagetrennt)
const allowedOrigins = (process.env.ALLOWED_ORIGINS || `http://localhost:${PORT},http://127.0.0.1:${PORT}`).split(',').map(s => s.trim());
app.use(cors({
    origin: (origin, cb) => {
        // Same-origin requests haben kein Origin-Header → erlauben
        if (!origin) return cb(null, true);
        if (allowedOrigins.includes(origin)) return cb(null, true);
        return cb(new Error('CORS: Origin nicht erlaubt'));
    }
}));
app.use(bodyParser.json({ limit: '50mb' })); // Hohes Limit für Spielstände

const savesDir = path.join(__dirname, 'saves');
const savesDirResolved = path.resolve(savesDir);
if (!fs.existsSync(savesDir)) {
    fs.mkdirSync(savesDir);
}

// Whitelist-Validierung für Spielstand-Namen: nur ASCII-Buchstaben, Ziffern, _ und -, max 64 Zeichen.
// Verhindert Path Traversal (../), Null-Byte-Injection und Reservierte Windows-Namen (CON, PRN, …).
const SAFE_SAVE_NAME = /^[A-Za-z0-9_\-]{1,64}$/;
const RESERVED_WIN_NAMES = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i;
function resolveSavePath(name) {
    if (typeof name !== 'string' || !SAFE_SAVE_NAME.test(name) || RESERVED_WIN_NAMES.test(name)) {
        return null;
    }
    const filePath = path.join(savesDir, `${name}.json`);
    // Defense-in-depth: resolved path muss unter savesDir liegen
    const resolved = path.resolve(filePath);
    if (!resolved.startsWith(savesDirResolved + path.sep) && resolved !== savesDirResolved) {
        return null;
    }
    return resolved;
}

// API: Liste der Spielstände
app.get('/api/saves', (req, res) => {
    fs.readdir(savesDir, (err, files) => {
        if (err) return res.status(500).json({ error: err.message });
        const names = files
            .filter(f => f.endsWith('.json'))
            .map(f => f.replace('.json', ''))
            .filter(n => SAFE_SAVE_NAME.test(n)); // Nur valide Namen ausliefern (defensive)
        res.json(names);
    });
});

// API: Spielstand laden
app.get('/api/load', (req, res) => {
    const name = req.query.name;
    if (!name) return res.status(400).json({ error: 'Name missing' });

    const filePath = resolveSavePath(name);
    if (!filePath) return res.status(400).json({ error: 'Invalid name' });

    if (fs.existsSync(filePath)) {
        res.sendFile(filePath);
    } else {
        res.status(404).json({ error: 'Nicht gefunden' });
    }
});

// API: Spielstand speichern
app.post('/api/save', (req, res) => {
    const data = req.body;
    if (!data || !data.name || !data.gameData) {
        return res.status(400).json({ error: 'Invalid data' });
    }

    const filePath = resolveSavePath(data.name);
    if (!filePath) return res.status(400).json({ error: 'Invalid name' });

    fs.writeFile(filePath, JSON.stringify(data.gameData, null, 2), (err) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ success: true });
    });
});

// API: Logging
app.post('/api/tester/log', (req, res) => {
    const data = req.body;
    const logDir = path.join(__dirname, 'js', 'tester');
    if (!fs.existsSync(logDir)) {
        fs.mkdirSync(logDir, { recursive: true });
    }
    
    const logFile = path.join(logDir, 'protokoll.log');
    const timestamp = new Date().toISOString().replace('T', ' ').substring(0, 19);
    const logLine = `[${timestamp}] [${data.type}] ${data.message}\n`;
    
    fs.appendFile(logFile, logLine, (err) => {
        if (err) console.error(err);
        res.json({ success: true });
    });
});

// Statisches Routing – Kein Cache für JS-Dateien!
app.use(express.static(__dirname, {
    setHeaders: (res, filePath) => {
        if (filePath.endsWith('.js')) {
            res.set('Cache-Control', 'no-store, no-cache, must-revalidate');
            res.set('Pragma', 'no-cache');
            res.set('Expires', '0');
        }
    }
}));

// Weiterleitung von Root auf index.html falls nicht automatisch gefunden
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`=======================================`);
    console.log(` Butzcraft Server (Node.js) läuft!`);
    console.log(` Port: ${PORT}`);
    console.log(` Aufrufen unter: http://localhost:${PORT}`);
    console.log(`=======================================`);
});
