const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// CORS: Nur API-Zugriffe aus lokaler Entwicklung erlauben (anpassbar via ALLOWED_ORIGINS env var, kommagetrennt).
// Nicht global auf statische Assets anwenden: Vite setzt im Production-Build `crossorigin`
// auf Script/CSS-Tags, und der Browser schickt dann einen Origin-Header. Ein globaler
// CORS-Reject wuerde JS/CSS auf Render als 500 blockieren.
const allowedOrigins = (process.env.ALLOWED_ORIGINS || `http://localhost:${PORT},http://127.0.0.1:${PORT}`).split(',').map(s => s.trim());
const corsOptions = {
    origin: (origin, cb) => {
        // Same-origin requests haben kein Origin-Header → erlauben
        if (!origin) return cb(null, true);
        if (allowedOrigins.includes(origin)) return cb(null, true);
        return cb(new Error('CORS: Origin nicht erlaubt'));
    }
};
app.use('/api', cors(corsOptions));
// Body-Limit: 5MB reicht für realistische Saves (Welt + Inventar + Mods).
// Vorher 50MB → DoS-Vektor (RAM-Exhaustion durch parallele große Requests).
app.use(bodyParser.json({ limit: '5mb' }));

const savesDir = path.join(__dirname, 'saves');
const savesDirResolved = path.resolve(savesDir);
if (!fs.existsSync(savesDir)) {
    fs.mkdirSync(savesDir);
}

// Whitelist-Validierung fuer Spielstand-Namen: ASCII-Buchstaben, Ziffern,
// Leerzeichen, _ und -, max 64 Zeichen. Leerzeichen sind erlaubt, weil alte
// lokale Saves wie "Emy Test" sonst nicht mehr ladbar waeren.
// Verhindert Path Traversal (../), Null-Byte-Injection und reservierte Windows-Namen.
const SAFE_SAVE_NAME = /^[A-Za-z0-9 _-]{1,64}$/;
const RESERVED_WIN_NAMES = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i;
function resolveSavePath(name) {
    if (
        typeof name !== 'string' ||
        name.trim() !== name ||
        !SAFE_SAVE_NAME.test(name) ||
        RESERVED_WIN_NAMES.test(name)
    ) {
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
//
// Sicherheits-Härtung (Sprint 5):
//   - Nur lokale Requests (127.0.0.1 / ::1) — verhindert DoS via Disk-Fill von außen.
//   - Newlines in user-controlled Feldern werden gestrippt → keine Log-Injection
//     (Angreifer kann sich keine fake-Log-Zeilen unterjubeln).
//   - Type-Whitelist + Längen-Cap auf Message → kein 1-MB-Spam-Log.
//   - Fail-soft: Unbekannte/invalide Inputs werden ignoriert (200 OK), aber NICHT geloggt.
const ALLOWED_LOG_TYPES = new Set(['info', 'warn', 'error', 'debug', 'test']);
const MAX_LOG_MSG_LEN = 1000;
function isLocalRequest(req) {
    const ip = req.ip || req.connection.remoteAddress || '';
    return ip === '127.0.0.1' || ip === '::1' || ip === '::ffff:127.0.0.1';
}
app.post('/api/tester/log', (req, res) => {
    if (!isLocalRequest(req)) return res.status(403).json({ error: 'forbidden' });

    const data = req.body || {};
    const type = typeof data.type === 'string' ? data.type.toLowerCase() : '';
    let message = typeof data.message === 'string' ? data.message : '';

    if (!ALLOWED_LOG_TYPES.has(type)) return res.json({ success: true }); // soft-ignore
    if (message.length === 0) return res.json({ success: true });

    // Newlines + Carriage Returns durch Spaces ersetzen → keine Log-Injection
    message = message.replace(/[\r\n]+/g, ' ').slice(0, MAX_LOG_MSG_LEN);

    const logDir = path.join(__dirname, 'js', 'tester');
    if (!fs.existsSync(logDir)) {
        fs.mkdirSync(logDir, { recursive: true });
    }

    const logFile = path.join(logDir, 'protokoll.log');
    const timestamp = new Date().toISOString().replace('T', ' ').substring(0, 19);
    const logLine = `[${timestamp}] [${type}] ${message}\n`;

    fs.appendFile(logFile, logLine, (err) => {
        if (err) console.error(err);
        res.json({ success: true });
    });
});

const distDir = path.join(__dirname, 'dist');
const distAssetsDir = path.join(distDir, 'assets');
const soundsDir = path.join(__dirname, 'sounds');
const isProduction = process.env.NODE_ENV === 'production';
const hasDistIndex = fs.existsSync(path.join(distDir, 'index.html'));
const hasSoundsDir = fs.existsSync(soundsDir);
const staticRoots = [];
if (isProduction) {
    if (hasDistIndex) staticRoots.push(distDir);
} else {
    // Development serves the repo root so source files and node_modules imports work.
    if (hasDistIndex) staticRoots.push(distDir);
    staticRoots.push(__dirname);
}
if (staticRoots.length === 0) {
    console.warn('Production build missing: dist/index.html not found. Run npm run build before starting with NODE_ENV=production.');
}

// Statisches Routing: Einstiegspunkte nicht cachen, damit neue Deploys sofort sichtbar sind.
const staticOptions = {
    setHeaders: (res, filePath) => {
        const resolvedPath = path.resolve(filePath);
        const isFingerprintedAsset = isProduction && resolvedPath.startsWith(path.resolve(distAssetsDir) + path.sep);
        if (isFingerprintedAsset) {
            res.set('Cache-Control', 'public, max-age=31536000, immutable');
            return;
        }
        if (filePath.endsWith('.html') || filePath.endsWith('.css') || filePath.endsWith('.js')) {
            res.set('Cache-Control', 'no-store, no-cache, must-revalidate');
            res.set('Pragma', 'no-cache');
            res.set('Expires', '0');
        }
    }
};

staticRoots.forEach(root => {
    app.use(express.static(root, staticOptions));
});

if (hasSoundsDir) {
    app.use('/sounds', express.static(soundsDir, staticOptions));
}

// Weiterleitung von Root auf index.html falls nicht automatisch gefunden
app.get('/', (req, res) => {
    if (isProduction && !hasDistIndex) {
        return res.status(503).send('Production build missing. Run npm run build.');
    }
    const indexPath = hasDistIndex
        ? path.join(distDir, 'index.html')
        : path.join(__dirname, 'index.html');
    res.sendFile(indexPath);
});

// Bind-Default: Localhost-only. Wer LAN-Zugriff (z.B. zum Testen vom Handy) braucht,
// setzt explizit `HOST=0.0.0.0` als env-Var. Vorher band der Server immer an alle Interfaces
// → im WLAN/Hotel konnte jeder Spielstände lesen/überschreiben/löschen.
//
// WICHTIG (Bugfix): Windows-Browser resolven `localhost` häufig erst zu `::1` (IPv6),
// und nur bei IPv6-Failure fallback auf `127.0.0.1`. Wenn der Server nur IPv4 bindet,
// schlägt der erste Verbindungsversuch fehl → für den User "Seite nicht erreichbar".
// Lösung: Im Default-Modus ZWEI Listener — IPv4 (127.0.0.1) + IPv6 (::1). Beide Stacks
// werden bedient, LAN bleibt ausgeschlossen (keine Wildcard-Bindung).
const http = require('http');
const HOST = process.env.HOST || '127.0.0.1';

if (HOST === '127.0.0.1') {
    // Dual-Stack-Localhost
    http.createServer(app).listen(PORT, '127.0.0.1', () => {
        console.log(`=======================================`);
        console.log(` Butzcraft Server (Node.js) läuft!`);
        console.log(` Bind: 127.0.0.1:${PORT} (IPv4 localhost)`);
    });
    // IPv6 ist auf manchen Systemen deaktiviert → try/catch verhindert harten Crash.
    try {
        http.createServer(app).listen(PORT, '::1', () => {
            console.log(` Bind: [::1]:${PORT} (IPv6 localhost)`);
            console.log(` Aufrufen unter: http://localhost:${PORT}`);
            console.log(`=======================================`);
        });
    } catch (e) {
        console.warn(` (IPv6-Bind fehlgeschlagen — IPv4-only. Falls localhost nicht geht: http://127.0.0.1:${PORT})`);
        console.log(`=======================================`);
    }
} else {
    // Explizit konfigurierter Host (z.B. 0.0.0.0 für LAN-Test). Single-Listener.
    app.listen(PORT, HOST, () => {
        console.log(`=======================================`);
        console.log(` Butzcraft Server (Node.js) läuft!`);
        console.log(` Bind: ${HOST}:${PORT}`);
        console.log(` Aufrufen unter: http://localhost:${PORT}`);
        console.log(` ⚠ Server ist netzwerk-erreichbar (HOST=${HOST}). Nur in vertrauten Netzen!`);
        console.log(`=======================================`);
    });
}
