const express = require('express');
const path = require('path');
const cors = require('cors');
const fs = require('fs');

const { initializeApp, cert } = require('firebase-admin/app');
const { getDatabase } = require('firebase-admin/database');

let serviceAccount;
if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
    if (serviceAccount.private_key) {
        serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, '\n');
    }
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
    index: false,
    setHeaders: (res, path) => {
        res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
        res.set('Expires', '-1');
        res.set('Pragma', 'no-cache');
    }
}));

// Read DB
async function getDB() {
    const snapshot = await dbRef.ref('/').once('value');
    return snapshot.val() || { siteData: {}, agents: [], chat: [] };
}

// Write DB
async function saveDB(data) {
    await dbRef.ref('/').set(data);
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
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    res.json(await getDB());
});

app.post('/api/data', async (req, res) => {
    const cookies = req.headers.cookie || '';
    if (!cookies.includes('admin_auth=secret123')) {
        return res.status(401).json({ error: 'Unauthorized' });
    }
    const newData = req.body;
    try {
        await saveDB(newData);
        res.json({ success: true });
    } catch (error) {
        console.error("SaveDB Error:", error);
        res.status(500).json({ success: false, error: error.message });
    }
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

app.get('/', async (req, res) => {
    try {
        const db = await getDB();
        let html = fs.readFileSync(path.join(__dirname, 'public', 'index.html'), 'utf8');
        
        const num = db.siteData.customerServiceNumber || '';
        const phoneDigits = num.replace(/\D/g, '');
        
        html = html.replace(/>&nbsp;</g, `>${num}<`);
        html = html.replace(/href="#"/g, `href="https://wa.me/${phoneDigits}"`);
        
        let quickAgentsHtml = '';
        if (db.siteData && db.siteData.quickAgents) {
            db.siteData.quickAgents.forEach(qa => {
                const agentsList = db.agents || [];
                const agent = agentsList.find(a => a && a.id === qa.id);
                const agentNameDisplay = (agent && agent.name) ? `Name : ${agent.name}` : `এজেন্ট আইডি: ${qa.id}`;
                const phone = qa.whatsapp.replace(/\D/g, '');
                quickAgentsHtml += `
                    <div class="flex justify-between items-center p-3 sm:p-4 bg-white rounded-lg border border-gray-200 shadow-sm relative overflow-hidden">
                        <div class="absolute left-0 top-0 bottom-0 w-1 bg-accent-gold"></div>
                        <div class="flex items-center gap-3 sm:gap-4">
                            <div class="bg-gray-50 p-2 sm:p-2.5 rounded-full border border-gray-100 shadow-sm relative">
                                <i class="fa-solid fa-user-tie text-gray-500 text-lg sm:text-xl"></i>
                                <div class="absolute bottom-1 right-1 w-2.5 h-2.5 bg-green-500 border-2 border-white rounded-full"></div>
                            </div>
                            <div class="flex flex-col">
                                <span class="font-bold text-gray-800 text-[11px] sm:text-sm tracking-wide">${agentNameDisplay}</span>
                                <span class="text-green-600 font-bold text-[10px] sm:text-xs">এজেন্ট রিয়েল</span>
                            </div>
                        </div>
                        <a href="https://wa.me/${phone}" target="_blank" class="bg-[#25D366] text-white p-2 sm:p-2.5 rounded-full shadow-sm hover:scale-110 transition hover:shadow-md flex items-center justify-center">
                            <i class="fa-brands fa-whatsapp text-lg sm:text-xl"></i>
                        </a>
                    </div>`;
            });
        }
        
        // Replace the skeleton loaders with the actual HTML!
        html = html.replace(/<!-- Skeleton Loader -->[\s\S]*?(?=<\/div>\s*<\/div>\s*<!-- Chat with us online -->)/, quickAgentsHtml);
        
        html = html.replace('let dbData = null;', `let dbData = ${JSON.stringify(db)};`);
        
        res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
        res.send(html);
    } catch(e) {
        console.error('SSR Error:', e);
        res.sendFile(path.join(__dirname, 'public', 'index.html'));
    }
});

app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(port, () => {
    console.log('Backend server running at http://localhost:' + port);
});

module.exports = app;
