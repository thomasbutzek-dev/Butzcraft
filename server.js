const express = require('express');
const compression = require('compression');
const cors = require('cors');
const bodyParser = require('body-parser');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const sanitizeHtml = require('sanitize-html');
const nodemailer = require('nodemailer');
const http = require('http');
const { createStatisticsStore } = require('./serverStatistics');

function createApp({ env = process.env } = {}) {
const app = express();
const PORT = env.PORT || 3000;
const HOST = env.HOST || '127.0.0.1';
const isProduction = env.NODE_ENV === 'production';
const remoteSavesEnabled = env.ENABLE_REMOTE_SAVES === 'true' || !isProduction;
const websiteHosts = new Set(
    (env.WEBSITE_HOSTS || '')
        .split(',')
        .map(host => host.trim().toLowerCase())
        .filter(Boolean)
);
const gameOrigin = env.GAME_ORIGIN || '';
const gameHost = (() => {
    try {
        return new URL(gameOrigin).hostname.toLowerCase();
    } catch {
        return '';
    }
})();
function isWebsiteRequest(req) {
    const hostname = req.hostname.toLowerCase();
    return websiteHosts.has(hostname) || (!isProduction && ['localhost', '127.0.0.1', '::1'].includes(hostname));
}
app.use(compression());

app.get('/health', (req, res) => {
    res.json({ status: 'ok' });
});

// CORS: Nur API-Zugriffe aus lokaler Entwicklung erlauben (anpassbar via ALLOWED_ORIGINS env var, kommagetrennt).
// Nicht global auf statische Assets anwenden: Vite setzt im Production-Build `crossorigin`
// auf Script/CSS-Tags, und der Browser schickt dann einen Origin-Header. Ein globaler
// CORS-Reject wuerde JS/CSS auf Render als 500 blockieren.
const allowedOrigins = (env.ALLOWED_ORIGINS || `http://localhost:${PORT},http://127.0.0.1:${PORT}`).split(',').map(s => s.trim());
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

const siteContentDir = path.resolve(env.SITE_CONTENT_DIR || path.join(__dirname, 'site-content'));
const statisticsDir = path.resolve(env.STATISTICS_DIR || path.join(__dirname, 'statistics'));
const statisticsStore = createStatisticsStore({ directory: statisticsDir });
const siteMediaDir = path.join(siteContentDir, 'uploads');
const siteContentFile = path.join(siteContentDir, 'content.json');
const adminUsername = env.SITE_ADMIN_USER || 'admin';
const adminPassword = env.SITE_ADMIN_PASSWORD || '';
const adminSessions = new Map();
const loginAttempts = new Map();
const contactAttempts = new Map();
const ADMIN_COOKIE = 'butzcraft_admin';
const ADMIN_SESSION_MS = 8 * 60 * 60 * 1000;
const CONTENT_KEY = /^[a-z0-9.-]{1,80}$/;
const ATTEMPT_WINDOW_MS = 15 * 60 * 1000;
const CONTACT_LIMIT = 5;
const CONTACT_SUBJECTS = new Set(['Frage zum Spiel', 'Fehler melden', 'Idee und Feedback', 'Sonstiges']);
const contactToEmail = env.CONTACT_TO_EMAIL || '';
const contactFromEmail = env.CONTACT_FROM_EMAIL || env.SMTP_USER || '';
const smtpHost = env.SMTP_HOST || '';
const smtpPort = Number(env.SMTP_PORT || 587);
const smtpUser = env.SMTP_USER || '';
const smtpPassword = env.SMTP_PASSWORD || '';
const contactTransport = smtpHost && smtpUser && smtpPassword && contactToEmail && contactFromEmail
    ? nodemailer.createTransport({
        host: smtpHost,
        port: smtpPort,
        secure: env.SMTP_SECURE === 'true' || smtpPort === 465,
        auth: { user: smtpUser, pass: smtpPassword }
    })
    : null;

function setExpiringEntry(map, key, value, ttl = ATTEMPT_WINDOW_MS) {
    map.set(key, value);
    const timer = setTimeout(() => {
        if (map.get(key) === value) map.delete(key);
    }, ttl);
    timer.unref?.();
}

fs.mkdirSync(siteMediaDir, { recursive: true });

app.use((req, res, next) => {
    const tracked = isProduction
        && gameHost
        && req.hostname.toLowerCase() === gameHost
        && (req.method === 'GET' || req.method === 'HEAD');
    if (tracked) {
        const gamePage = req.path === '/' || req.path === '/index.html';
        res.once('finish', () => statisticsStore.recordResponse({
            statusCode: res.statusCode,
            gamePage: gamePage && res.statusCode >= 200 && res.statusCode < 300
        }));
    }
    next();
});

function emptySiteContent() {
    return { texts: {}, images: {}, updatedAt: null };
}

function sanitizeSiteMarkup(value) {
    return sanitizeHtml(String(value), {
        allowedTags: ['br', 'strong', 'em', 'u', 'a'],
        allowedAttributes: { a: ['href'] },
        allowedSchemes: ['http', 'https'],
        allowProtocolRelative: false
    });
}

function readSiteContent() {
    if (!fs.existsSync(siteContentFile)) return emptySiteContent();
    try {
        const content = JSON.parse(fs.readFileSync(siteContentFile, 'utf8'));
        return {
            texts: content.texts && typeof content.texts === 'object'
                ? Object.fromEntries(Object.entries(content.texts).map(([key, value]) => [key, sanitizeSiteMarkup(value)]))
                : {},
            images: content.images && typeof content.images === 'object' ? content.images : {},
            updatedAt: content.updatedAt || null
        };
    } catch (error) {
        console.error(`Site content could not be read: ${error.message}`);
        return emptySiteContent();
    }
}

function writeSiteContent(content) {
    fs.writeFileSync(siteContentFile, JSON.stringify(content, null, 2));
}

function parseCookies(req) {
    return Object.fromEntries((req.headers.cookie || '').split(';').map(part => part.trim()).filter(Boolean).map(part => {
        const separator = part.indexOf('=');
        return separator === -1 ? [part, ''] : [part.slice(0, separator), part.slice(separator + 1)];
    }));
}

function safeEqual(actual, expected) {
    const actualBuffer = crypto.createHash('sha256').update(String(actual)).digest();
    const expectedBuffer = crypto.createHash('sha256').update(String(expected)).digest();
    return crypto.timingSafeEqual(actualBuffer, expectedBuffer);
}

function getAdminSession(req) {
    const token = parseCookies(req)[ADMIN_COOKIE];
    const expiresAt = token && adminSessions.get(token);
    if (!expiresAt || expiresAt <= Date.now()) {
        if (token) adminSessions.delete(token);
        return null;
    }
    return token;
}

function requireSiteAdmin(req, res, next) {
    if (!adminPassword) return res.status(503).json({ error: 'Der Adminmodus ist auf dem Server noch nicht aktiviert.' });
    if (!getAdminSession(req)) return res.status(401).json({ error: 'Bitte zuerst anmelden.' });
    next();
}

function validateSiteContent(input) {
    const texts = input?.texts;
    const images = input?.images;
    if (!texts || typeof texts !== 'object' || Array.isArray(texts) || !images || typeof images !== 'object' || Array.isArray(images)) return null;
    const textEntries = Object.entries(texts);
    const imageEntries = Object.entries(images);
    if (textEntries.length > 100 || imageEntries.length > 30) return null;

    const sanitizedTexts = {};
    for (const [key, value] of textEntries) {
        if (!CONTENT_KEY.test(key) || typeof value !== 'string' || value.length > 4000) return null;
        sanitizedTexts[key] = sanitizeSiteMarkup(value);
    }
    for (const [key, value] of imageEntries) {
        if (!CONTENT_KEY.test(key) || typeof value !== 'string' || !/^\/site-media\/[a-z0-9-]+\.(webp|png|jpg)$/.test(value)) return null;
    }
    return { texts: sanitizedTexts, images, updatedAt: new Date().toISOString() };
}

function validImageSignature(buffer, mimeType) {
    if (mimeType === 'image/jpeg') return buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
    if (mimeType === 'image/png') return buffer.subarray(0, 4).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47]));
    if (mimeType === 'image/webp') return buffer.subarray(0, 4).toString() === 'RIFF' && buffer.subarray(8, 12).toString() === 'WEBP';
    return false;
}

app.use('/site-media', express.static(siteMediaDir, { immutable: true, maxAge: '1y' }));

app.get('/api/site-content', (req, res) => {
    res.set('Cache-Control', 'no-store');
    res.json(readSiteContent());
});

app.get('/api/admin/session', (req, res) => {
    res.set('Cache-Control', 'no-store');
    if (!adminPassword) return res.status(503).json({ error: 'Der Adminmodus ist auf dem Server noch nicht aktiviert.' });
    res.json({ authenticated: Boolean(getAdminSession(req)) });
});

app.get('/api/admin/statistics', requireSiteAdmin, (req, res) => {
    res.set('Cache-Control', 'no-store');
    res.json(statisticsStore.snapshot());
});

app.post('/api/admin/login', (req, res) => {
    if (!adminPassword) return res.status(503).json({ error: 'Der Adminmodus ist auf dem Server noch nicht aktiviert.' });
    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    const attempt = loginAttempts.get(ip);
    if (attempt?.blockedUntil > Date.now()) return res.status(429).json({ error: 'Zu viele Versuche. Bitte in 15 Minuten erneut versuchen.' });

    const usernameMatches = safeEqual(req.body?.username || '', adminUsername);
    const passwordMatches = safeEqual(req.body?.password || '', adminPassword);
    if (!usernameMatches || !passwordMatches) {
        const count = (attempt?.count || 0) + 1;
        const nextAttempt = count >= 5
            ? { count: 0, blockedUntil: Date.now() + ATTEMPT_WINDOW_MS }
            : { count, blockedUntil: 0 };
        setExpiringEntry(loginAttempts, ip, nextAttempt);
        return res.status(401).json({ error: 'Benutzername oder Passwort ist falsch.' });
    }

    loginAttempts.delete(ip);
    const token = crypto.randomBytes(32).toString('hex');
    adminSessions.set(token, Date.now() + ADMIN_SESSION_MS);
    const secure = isProduction ? '; Secure' : '';
    res.setHeader('Set-Cookie', `${ADMIN_COOKIE}=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${ADMIN_SESSION_MS / 1000}${secure}`);
    res.json({ authenticated: true });
});

app.post('/api/admin/logout', requireSiteAdmin, (req, res) => {
    const token = getAdminSession(req);
    if (token) adminSessions.delete(token);
    const secure = isProduction ? '; Secure' : '';
    res.setHeader('Set-Cookie', `${ADMIN_COOKIE}=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0${secure}`);
    res.json({ success: true });
});

app.put('/api/site-content', requireSiteAdmin, (req, res) => {
    const content = validateSiteContent(req.body);
    if (!content) return res.status(400).json({ error: 'Die Inhaltsdaten sind ungültig.' });
    writeSiteContent(content);
    res.json(content);
});

app.post('/api/admin/image', requireSiteAdmin, (req, res) => {
    const match = typeof req.body?.dataUrl === 'string' && req.body.dataUrl.match(/^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/);
    if (!CONTENT_KEY.test(req.body?.key || '') || !match) return res.status(400).json({ error: 'Das Bild ist ungültig.' });
    const buffer = Buffer.from(match[2], 'base64');
    if (buffer.length === 0 || buffer.length > 3 * 1024 * 1024 || !validImageSignature(buffer, match[1])) {
        return res.status(400).json({ error: 'Das Bild ist ungültig oder größer als 3 MB.' });
    }

    const extension = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' }[match[1]];
    const filename = `${Date.now()}-${crypto.randomBytes(8).toString('hex')}.${extension}`;
    fs.writeFileSync(path.join(siteMediaDir, filename), buffer);
    res.status(201).json({ url: `/site-media/${filename}` });
});

app.post('/api/contact', async (req, res) => {
    if (req.body?.website) return res.json({ success: true });
    if (!contactTransport) {
        return res.status(503).json({ error: 'Der Nachrichtenversand ist noch nicht eingerichtet.' });
    }

    const name = typeof req.body?.name === 'string' ? req.body.name.trim() : '';
    const email = typeof req.body?.email === 'string' ? req.body.email.trim() : '';
    const subject = typeof req.body?.subject === 'string' ? req.body.subject.trim() : '';
    const message = typeof req.body?.message === 'string' ? req.body.message.trim() : '';
    const emailIsValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    if (name.length > 80 || /[\r\n]/.test(name) || !emailIsValid || email.length > 160 || !CONTACT_SUBJECTS.has(subject) || !message || message.length > 4000 || req.body?.privacy !== true) {
        return res.status(400).json({ error: 'Bitte prüfe deine Angaben und versuche es erneut.' });
    }

    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    const now = Date.now();
    const recentAttempts = (contactAttempts.get(ip) || []).filter(timestamp => timestamp > now - ATTEMPT_WINDOW_MS);
    if (recentAttempts.length >= CONTACT_LIMIT) {
        return res.status(429).json({ error: 'Zu viele Nachrichten. Bitte versuche es später erneut.' });
    }
    recentAttempts.push(now);
    setExpiringEntry(contactAttempts, ip, recentAttempts);

    try {
        await contactTransport.sendMail({
            from: contactFromEmail,
            to: contactToEmail,
            replyTo: name ? { name, address: email } : email,
            subject: `[Butzcraft] ${subject}`,
            text: `Name: ${name || 'Nicht angegeben'}\nE-Mail: ${email}\nThema: ${subject}\n\n${message}`
        });
        res.json({ success: true });
    } catch (error) {
        console.error(`Contact mail could not be sent: ${error.message}`);
        res.status(502).json({ error: 'Die Nachricht konnte gerade nicht versendet werden. Bitte versuche es später erneut.' });
    }
});

app.get('/admin', (req, res) => {
    res.redirect(302, '/?edit=1');
});

const savesDir = path.resolve(env.SAVES_DIR || path.join(__dirname, 'saves'));
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
function requireRemoteSaves(req, res, next) {
    if (!remoteSavesEnabled) {
        return res.status(503).json({ error: 'Remote saves are not enabled' });
    }
    next();
}

app.get('/api/saves', requireRemoteSaves, (req, res) => {
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
app.get('/api/load', requireRemoteSaves, (req, res) => {
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
app.post('/api/save', requireRemoteSaves, (req, res) => {
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

app.get('/index.html', (req, res, next) => {
    if (isProduction && gameOrigin && isWebsiteRequest(req)) {
        return res.redirect(302, gameOrigin);
    }
    next();
});

function sendSitePage(res, filename) {
    const root = staticRoots.find(candidate => fs.existsSync(path.join(candidate, filename)));
    if (!root) return res.status(503).send('Production build missing. Run npm run build.');
    res.sendFile(path.join(root, filename));
}

const cleanSiteRoutes = new Map([
    ['/guide', 'guide.html'],
    ['/faq', 'faq.html'],
    ['/impressum', 'impressum.html'],
    ['/datenschutz', 'datenschutz.html']
]);

app.get('/butzcraft-preview.html', (req, res) => {
    const query = req.originalUrl.includes('?') ? req.originalUrl.slice(req.originalUrl.indexOf('?')) : '';
    res.redirect(301, `/${query}`);
});
for (const [route, filename] of cleanSiteRoutes) {
    app.get(`${route}.html`, (req, res) => res.redirect(301, route));
    app.get(route, (req, res) => sendSitePage(res, filename));
}

staticRoots.forEach(root => {
    app.use(express.static(root, { ...staticOptions, index: false }));
});

if (hasSoundsDir) {
    app.use('/sounds', express.static(soundsDir, staticOptions));
}

// Weiterleitung von Root auf index.html falls nicht automatisch gefunden
app.get('/', (req, res) => {
    if (isProduction && !hasDistIndex) {
        return res.status(503).send('Production build missing. Run npm run build.');
    }
    const entryFile = isWebsiteRequest(req)
        ? 'butzcraft-preview.html'
        : 'index.html';
    sendSitePage(res, entryFile);
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
function flushStatistics() {
    try {
        statisticsStore.close();
    } catch (error) {
        console.error(`Statistics could not be written: ${error.message}`);
    }
}

return { app, port: PORT, host: HOST, close: flushStatistics };
}

function startServer(runtime = createApp()) {
const { app, port: PORT, host: HOST, close: flushStatistics } = runtime;
process.once('SIGTERM', () => {
    flushStatistics();
    process.exit(0);
});
process.once('SIGINT', () => {
    flushStatistics();
    process.exit(0);
});

const bindings = HOST === '127.0.0.1' ? ['127.0.0.1', '::1'] : [HOST];
const servers = [];
let pendingBindings = bindings.length;
let successfulBindings = 0;

function completeBinding(success) {
    pendingBindings--;
    if (success) successfulBindings++;
    if (pendingBindings === 0 && successfulBindings === 0) {
        console.error(` Butzcraft Server konnte an keine Adresse auf Port ${PORT} gebunden werden.`);
        flushStatistics();
        process.exitCode = 1;
    }
}

for (const address of bindings) {
    const server = http.createServer(app);
    let bindingSettled = false;
    const settleBinding = success => {
        if (bindingSettled) return;
        bindingSettled = true;
        completeBinding(success);
    };
    servers.push(server);
    server.once('listening', () => {
        if (address === '127.0.0.1') {
            console.log(`=======================================`);
            console.log(` Butzcraft Server (Node.js) läuft!`);
            console.log(` Bind: 127.0.0.1:${PORT} (IPv4 localhost)`);
        } else if (address === '::1') {
            console.log(` Bind: [::1]:${PORT} (IPv6 localhost)`);
            console.log(` Aufrufen unter: http://localhost:${PORT}`);
            console.log(`=======================================`);
        } else {
            console.log(`=======================================`);
            console.log(` Butzcraft Server (Node.js) läuft!`);
            console.log(` Bind: ${address}:${PORT}`);
            console.log(` Aufrufen unter: http://localhost:${PORT}`);
            console.log(` ⚠ Server ist netzwerk-erreichbar (HOST=${address}). Nur in vertrauten Netzen!`);
            console.log(`=======================================`);
        }
        settleBinding(true);
    });
    server.on('error', error => {
        if (bindingSettled) {
            console.error(` Serverfehler auf ${address}:${PORT} (${error.code || error.message}).`);
            return;
        }
        console.warn(` Bind ${address}:${PORT} fehlgeschlagen (${error.code || error.message}).`);
        if (address === '::1') {
            console.warn(` IPv4 bleibt verfügbar. Falls localhost nicht geht: http://127.0.0.1:${PORT}`);
        }
        settleBinding(false);
    });
    server.listen(PORT, address);
}

runtime.servers = servers;

return runtime;
}

if (require.main === module) startServer();

module.exports = { createApp, startServer };
