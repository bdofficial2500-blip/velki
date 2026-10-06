const fs = require('fs');

let server = fs.readFileSync('server.js', 'utf8');

const getHandler = 
app.get('/', async (req, res) => {
    try {
        const db = await getDB();
        let html = fs.readFileSync(path.join(__dirname, 'public', 'index.html'), 'utf8');
        
        // Inject customer service number directly into the HTML
        const num = db.siteData.customerServiceNumber || '';
        const phoneDigits = num.replace(/\\D/g, '');
        
        html = html.replace(/>&nbsp;</g, \>\<\);
        html = html.replace(/href="#"/g, \href="https://wa.me/\"\);
        
        // Inject initial data
        html = html.replace('let dbData = null;', \let dbData = \;\);
        
        res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
        res.send(html);
    } catch(e) {
        res.sendFile(path.join(__dirname, 'public', 'index.html'));
    }
});

app.get('*', (req, res) => {
;

server = server.replace("app.get('*', (req, res) => {", getHandler);
fs.writeFileSync('server.js', server);
console.log('Added SSR to server.js');
