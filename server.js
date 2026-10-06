const express = require('express');
const path = require('path');
const cors = require('cors');
const fs = require('fs');

const { initializeApp, cert } = require('firebase-admin/app');
const { getDatabase } = require('firebase-admin/database');

let serviceAccount;
if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
} else {
    serviceAccount = require('./serviceAccountKey.json');
}

initializeApp({
  credential: cert(serviceAccount),
  databaseURL: 'https://velki-info-default-rtdb.firebaseio.com'
});
const dbRef = getDatabase();


const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public'), {
    setHeaders: (res, path) => {
        res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
        res.set('Expires', '-1');
        res.set('Pragma', 'no-cache');
    }
}));

const dbPath = path.join(__dirname, 'db.json');

// Read DB
function getDB() {
    if (fs.existsSync(dbPath)) {
        return JSON.parse(fs.readFileSync(dbPath, 'utf8'));
    }
    return { siteData: {}, agents: [], chat: [] };
}

// Write DB
function saveDB(data) {
    fs.writeFileSync(dbPath, JSON.stringify(data, null, 2));
}

app.post('/api/login', async (req, res) => {
    const { username, password } = req.body;
    const db = await getDB();
    const admin = db.admin || { username: 'esanmalik', password: 'admin123' };
    
    if (username === admin.username && password === admin.password) {
        res.setHeader('Set-Cookie', 'admin_auth=secret123; Path=/; HttpOnly');
        res.json({ success: true });
    } else {
        res.json({ success: false, message: 'Invalid credentials' });
    }
});

app.post('/api/reset-password', async (req, res) => {
    const { pin, newUsername, newPassword } = req.body;
    const db = await getDB();
    const admin = db.admin || { username: 'esanmalik', secretPin: '205069' };
    
    if (pin === admin.secretPin) {
        db.admin.username = newUsername;
        db.admin.password = newPassword;
        await saveDB(db);
        res.json({ success: true });
    } else {
        res.json({ success: false, message: 'Invalid Secret PIN' });
    }
});

app.get('/api/data', async (req, res) => {
    res.json(await getDB());
});

app.post('/api/data', async (req, res) => {
    const cookies = req.headers.cookie || '';
    if (!cookies.includes('admin_auth=secret123')) {
        return res.status(401).json({ error: 'Unauthorized' });
    }
    const newData = req.body;
    await saveDB(newData);
    res.json({ success: true });
});

// Existing Verify API for backward compatibility, now using the DB
app.post('/api/verify', async (req, res) => {
    const { type, value } = req.body;
    const db = await getDB();
    let foundAgent = null;

    if (!value) {
         return res.json({ success: false, message: "ID or Phone missing" });
    }

    if (type === 'id') {
        foundAgent = db.agents.find(a => a.id === value.trim());
    } else if (type === 'phone') {
        const cleanValue = value.replace(/\s+/g, '');
        foundAgent = db.agents.find(a => a.phone.includes(cleanValue));
    }

    if (foundAgent) {
        // Adding a mock status field required by the frontend
        res.json({ success: true, agent: { ...foundAgent, status: "Verified" } });
    } else {
        res.json({ success: false, message: "Agent not found" });
    }
});

app.get('/admin', (req, res) => {
    const cookies = req.headers.cookie || '';
    if (cookies.includes('admin_auth=secret123')) {
        res.sendFile(path.join(__dirname, 'private', 'admin.html'));
    } else {
        res.redirect('/login.html');
    }
});

app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(port, () => {
    console.log('Backend server running at http://localhost:' + port);
});

module.exports = app;
