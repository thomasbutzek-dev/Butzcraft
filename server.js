const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(bodyParser.json({ limit: '50mb' })); // Hohes Limit für Spielstände

const savesDir = path.join(__dirname, 'saves');
if (!fs.existsSync(savesDir)) {
    fs.mkdirSync(savesDir);
}

// API: Liste der Spielstände
app.get('/api/saves', (req, res) => {
    fs.readdir(savesDir, (err, files) => {
        if (err) return res.status(500).json({ error: err.message });
        const names = files.filter(f => f.endsWith('.json')).map(f => f.replace('.json', ''));
        res.json(names);
    });
});

// API: Spielstand laden
app.get('/api/load', (req, res) => {
    const name = req.query.name;
    if (!name) return res.status(400).json({ error: 'Name missing' });
    
    const filePath = path.join(savesDir, `${name}.json`);
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
    
    const filePath = path.join(savesDir, `${data.name}.json`);
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

// Statisches Routing
app.use(express.static(__dirname));

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
