const express = require('express');
const compression = require('compression');
const path = require('path');
const cors = require('cors');
const fs = require('fs');

const { initializeApp, cert } = require('firebase-admin/app');
const { getDatabase } = require('firebase-admin/database');

// Safe Firebase initialization
let dbRef = null;
const defaultFallbackDB = {
    siteData: {
        customerServiceNumber: "+8801712627344",
        complaintNumber: "+447520636263",
        customerServiceText: "আমাদের কাস্টমার সার্ভিসের সাথে সরাসরি যোগাযোগ করতে নিচের নাম্বারে হোয়াটসঅ্যাপ করুন।",
        facebookPage: "https://www.facebook.com/officialvelkilive/",
        facebookGroup: "https://www.facebook.com/share/g/1HuBm6L1xZ/",
        quickAgents: [
            { id: "25", whatsapp: "+8801712627344" },
            { id: "27", whatsapp: "+8801342449146" },
            { id: "29", whatsapp: "+8801342449142" }
        ],
        customerServiceList: [
            { name: "CS Officer 1", whatsapp: "+8801712627344" },
            { name: "CS Officer 2", whatsapp: "+8801342449146" }
        ],
        velkiAdminList: [
            { name: "Admin 1", whatsapp: "+8801712627344" },
            { name: "Admin 2", whatsapp: "+8801342449146" }
        ],
        rules: "১. ভেলকি এজেন্টদের সাথে শুধুমাত্র অফিসিয়াল হোয়াটসঅ্যাপ নাম্বারে যোগাযোগ করুন।\\n২. যে কোনো অনিয়মের জন্য অভিযোগ নাম্বারে দ্রুত অবহিত করুন।",
        proxyLinks: "অফিসিয়াল মিরর লিংক সমূহ শীঘ্রই আপডেট করা হবে।",
        aboutVelki: "ভেলকি বাংলাদেশের অন্যতম প্রধান ও জনপ্রিয় অনলাইন বিনোদন ও বেটিং প্ল্যাটফর্ম।"
    },
    agents: [],
    chat: [],
    admin: { username: "esanmalik", password: "admin123", secretPin: "205069" }
};

try {
    let serviceAccount = null;
    if (process.env.FIREBASE_SERVICE_ACCOUNT) {
        serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
        if (serviceAccount.private_key) {
            serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, '\n');
        }
    } else {
        const keyPath = path.join(__dirname, 'serviceAccountKey.json');
        if (fs.existsSync(keyPath)) {
            serviceAccount = require(keyPath);
        }
    }

    if (serviceAccount) {
        initializeApp({
            credential: cert(serviceAccount),
            databaseURL: 'https://velki-info-default-rtdb.firebaseio.com'
        });
        dbRef = getDatabase();
        console.log('Firebase RTDB connected successfully.');
    } else {
        console.warn('Firebase serviceAccount not found. Running with fallback data.');
    }
} catch (err) {
    console.error('Firebase init error:', err.message);
}

const app = express();
const port = process.env.PORT || 3000;

// High-performance gzip/deflate compression
app.use(compression());
app.use(cors());
app.use(express.json());

// Security & Caching headers
app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'SAMEORIGIN');
    next();
});

// Static assets with caching
app.use(express.static(path.join(__dirname, 'public'), {
    index: false,
    maxAge: '1d',
    setHeaders: (res, filePath) => {
        if (filePath.endsWith('.html')) {
            res.set('Cache-Control', 'no-cache, must-revalidate');
        }
    }
}));

// In-memory cache for ultra-fast response times (<2ms)
let cachedDB = null;
let lastCacheTime = 0;
const CACHE_TTL_MS = 15000; // 15 seconds

async function getDB() {
    const now = Date.now();
    if (cachedDB && (now - lastCacheTime < CACHE_TTL_MS)) {
        return cachedDB;
    }
    if (dbRef) {
        try {
            const snapshot = await dbRef.ref('/').once('value');
            const val = snapshot.val();
            if (val) {
                cachedDB = val;
                lastCacheTime = now;
                return cachedDB;
            }
        } catch (err) {
            console.error('Firebase read error:', err.message);
            if (cachedDB) return cachedDB;
        }
    }
    return cachedDB || defaultFallbackDB;
}

async function saveDB(data) {
    cachedDB = data;
    lastCacheTime = Date.now();
    if (dbRef) {
        await dbRef.ref('/').set(data);
    }
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
    res.set('Cache-Control', 'no-cache, must-revalidate');
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

app.post('/api/verify', async (req, res) => {
    const { type, value } = req.body;
    const db = await getDB();
    let foundAgent = null;

    if (!value) {
         return res.json({ success: false, message: "ID or Phone missing" });
    }

    const agentsList = db.agents || [];
    if (type === 'id') {
        foundAgent = agentsList.find(a => a && String(a.id).trim() === value.trim());
    } else if (type === 'phone') {
        const cleanValue = value.replace(/\s+/g, '');
        foundAgent = agentsList.find(a => a && a.phone && a.phone.includes(cleanValue));
    }

    if (foundAgent) {
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

app.get('/index.html', (req, res) => {
    res.redirect(301, '/');
});

app.get('/', async (req, res) => {
    try {
        const db = await getDB();
        let html = fs.readFileSync(path.join(__dirname, 'public', 'index.html'), 'utf8');
        
        const num = (db.siteData && db.siteData.customerServiceNumber) || '+8801712627344';
        const phoneDigits = num.replace(/\D/g, '');
        
        const fbPage = (db.siteData && db.siteData.facebookPage) || 'https://www.facebook.com/officialvelkilive/';
        const fbGroup = (db.siteData && db.siteData.facebookGroup) || 'https://www.facebook.com/share/g/1HuBm6L1xZ/';
        
        html = html.replace(/<span class="support-number[^"]*">[^<]*<\/span>/gi, `<span class="support-number font-mono">${num}</span>`);
        html = html.replace(/href="https:\/\/wa\.me\/8801712627344"/g, `href="https://wa.me/${phoneDigits}"`);
        html = html.replace(/>&nbsp;</g, `>${num}<`);
        html = html.replace(/{{FACEBOOK_PAGE}}/g, fbPage);
        html = html.replace(/{{FACEBOOK_GROUP}}/g, fbGroup);
        html = html.replace(/href="https:\/\/www\.facebook\.com\/officialvelkilive\/"/g, `href="${fbPage}"`);
        html = html.replace(/href="https:\/\/www\.facebook\.com\/share\/g\/1HuBm6L1xZ\/"/g, `href="${fbGroup}"`);
        
        let quickAgentsHtml = '';
        if (db.siteData && db.siteData.quickAgents) {
            db.siteData.quickAgents.forEach(qa => {
                if (!qa || !qa.id) return;
                const agentsList = db.agents || [];
                const agent = agentsList.find(a => a && String(a.id).trim() === String(qa.id).trim());
                const agentNameDisplay = (agent && agent.name) ? `${agent.name} (আইডি: ${qa.id})` : `এজেন্ট আইডি: ${qa.id}`;
                const rawPhone = qa.whatsapp || (agent && agent.phone) || '';
                const phone = rawPhone.replace(/\D/g, '');
                quickAgentsHtml += `
                    <a href="https://wa.me/${phone}" target="_blank" rel="noopener noreferrer" class="flex justify-between items-center p-3 sm:p-4 bg-white hover:bg-emerald-50/50 rounded-lg border border-gray-200 hover:border-emerald-300 shadow-sm relative overflow-hidden transition group block">
                        <div class="absolute left-0 top-0 bottom-0 w-1.5 bg-accent-gold"></div>
                        <div class="flex items-center gap-3 sm:gap-4">
                            <div class="bg-gray-50 group-hover:bg-emerald-100/50 p-2 sm:p-2.5 rounded-full border border-gray-100 shadow-sm relative transition">
                                <i class="fa-solid fa-user-tie text-gray-600 text-lg sm:text-xl"></i>
                                <div class="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-white rounded-full"></div>
                            </div>
                            <div class="flex flex-col">
                                <span class="font-bold text-gray-800 text-[12px] sm:text-sm tracking-wide">${agentNameDisplay}</span>
                                <span class="text-green-600 font-bold text-[10px] sm:text-xs flex items-center gap-1">
                                    <i class="fa-solid fa-circle-check text-[10px]"></i> মাস্টার এজেন্ট (রিয়েল)
                                </span>
                            </div>
                        </div>
                        <div class="bg-[#25D366] text-white w-9 h-9 sm:w-10 sm:h-10 rounded-full shadow-sm group-hover:scale-110 transition flex items-center justify-center shrink-0">
                            <i class="fa-brands fa-whatsapp text-lg sm:text-xl"></i>
                        </div>
                    </a>`;
            });
        }
        
        // Replace Quick Agents in HTML body
        if (quickAgentsHtml) {
            if (html.includes('<!-- SSR_QUICK_AGENTS_START -->')) {
                html = html.replace(/<!-- SSR_QUICK_AGENTS_START -->[\s\S]*?<!-- SSR_QUICK_AGENTS_END -->/, '<!-- SSR_QUICK_AGENTS_START -->\n' + quickAgentsHtml + '\n                    <!-- SSR_QUICK_AGENTS_END -->');
            } else if (html.includes('<!-- QUICK_AGENTS_CONTAINER_START -->')) {
                html = html.replace(/<!-- QUICK_AGENTS_CONTAINER_START -->[\s\S]*?<!-- QUICK_AGENTS_CONTAINER_END -->/, '<!-- QUICK_AGENTS_CONTAINER_START -->\n' + quickAgentsHtml + '\n                    <!-- QUICK_AGENTS_CONTAINER_END -->');
            } else if (html.includes('<!-- Skeleton Loader -->')) {
                html = html.replace(/<!-- Skeleton Loader -->[\s\S]*?(?=<\/div>\s*<\/div>\s*<!-- Chat with us online -->)/, quickAgentsHtml);
            }
        }
        
        html = html.replace('let dbData = null;', `let dbData = ${JSON.stringify(db)};`);
        
        res.set('Cache-Control', 'no-cache, must-revalidate');
        res.send(html);
    } catch(e) {
        console.error('SSR Error:', e);
        res.sendFile(path.join(__dirname, 'public', 'index.html'));
    }
});

app.get('*', (req, res) => {
    const cleanUrl = req.path.replace(/^\//, '').replace(/\/$/, '');
    if (cleanUrl) {
        const candidate = path.join(__dirname, 'public', cleanUrl + '.html');
        if (fs.existsSync(candidate)) {
            res.set('Cache-Control', 'no-cache, must-revalidate');
            return res.sendFile(candidate);
        }
    }
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(port, () => {
    console.log('Backend server running at http://localhost:' + port);
});
