const http    = require('http');
const fs      = require('fs').promises;
const path    = require('path');
const url     = require('url');
const { Pool } = require('pg');
const webpush = require('web-push');

const PORT         = process.env.PORT || 3000;
const RAPIDAPI_KEY = process.env.RAPIDAPI_KEY || '';
const APP_DIR      = __dirname;

webpush.setVapidDetails(process.env.VAPID_EMAIL, process.env.VAPID_PUBLIC_KEY, process.env.VAPID_PRIVATE_KEY);

const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

const DEFAULT_AISLES = [
    { name: '🥖 Bakery',           sort_order: 1,  products: ['White Bread', 'Brown Bread', 'Sourdough', 'Croissants', 'Bagels', 'Crumpets', 'Pitta Bread', 'Wraps', 'Bread Rolls', 'Muffins'] },
    { name: '🥦 Fresh Food',        sort_order: 2,  products: ['Milk', 'Butter', 'Cheddar', 'Eggs', 'Yoghurt', 'Chicken Breast', 'Minced Beef', 'Bacon', 'Sausages', 'Salmon Fillet', 'Bananas', 'Apples', 'Potatoes', 'Carrots', 'Broccoli', 'Tomatoes', 'Onions', 'Peppers', 'Cucumber', 'Strawberries'] },
    { name: '🧊 Frozen Food',       sort_order: 3,  products: ['Frozen Peas', 'Chips', 'Fish Fingers', 'Pizza', 'Ice Cream', 'Waffles', 'Frozen Chicken', 'Frozen Veg Mix'] },
    { name: '🍫 Treats & Snacks',   sort_order: 4,  products: ['Chocolate', 'Crisps', 'Biscuits', 'Sweets', 'Nuts', 'Popcorn', 'Cereal Bars', 'Crackers'] },
    { name: '🥫 Food Cupboard',     sort_order: 5,  products: ['Pasta', 'Rice', 'Baked Beans', 'Chopped Tomatoes', 'Tuna', 'Soup', 'Porridge Oats', 'Cornflakes', 'Weetabix', 'Coffee', 'Tea', 'Squash', 'Ketchup', 'Mayo', 'Olive Oil'] },
    { name: '🧃 Drinks',            sort_order: 6,  products: ['Water', 'Coca Cola', 'Pepsi', 'Lemonade', 'Orange Juice', 'Energy Drink', 'Beer', 'Wine'] },
    { name: '👶 Baby & Toddler',    sort_order: 7,  products: ['Nappies', 'Baby Wipes', 'Baby Food', 'Formula Milk', 'Baby Shampoo', 'Nappy Bags'] },
    { name: '💊 Health & Beauty',   sort_order: 8,  products: ['Shampoo', 'Shower Gel', 'Toothpaste', 'Deodorant', 'Moisturiser', 'Razors', 'Paracetamol', 'Vitamins'] },
    { name: '🐾 Pets',              sort_order: 9,  products: ['Dog Food', 'Cat Food', 'Cat Litter', 'Dog Treats', 'Pet Shampoo', 'Bird Seed'] },
    { name: '🧹 Household',         sort_order: 10, products: ['Washing Up Liquid', 'Dishwasher Tablets', 'Laundry Tablets', 'Bin Bags', 'Kitchen Roll', 'Toilet Roll', 'Bleach', 'Surface Spray'] },
];

function generateCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    return Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

function mapStore(row) { return { id: row.id, name: row.name, color: row.color, emoji: row.emoji, sortOrder: row.sort_order }; }
function mapAisle(row) { return { id: row.id, householdId: row.household_id, storeId: row.store_id, name: row.name, sortOrder: row.sort_order, products: row.products || [] }; }
function mapItem(row)  { return { id: row.id, householdId: row.household_id, storeId: row.store_id, name: row.name, aisleId: row.aisle_id, quantity: row.quantity, isFavourite: row.is_favourite, isChecked: row.is_checked, addedAt: row.added_at, addedBy: row.added_by || null }; }

async function getBody(req) {
    return new Promise((resolve, reject) => {
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', () => { try { resolve(JSON.parse(body || '{}')); } catch { reject(new Error('Invalid JSON')); } });
    });
}

async function serveFile(res, filePath, contentType) {
    try { const data = await fs.readFile(filePath); res.writeHead(200, { 'Content-Type': contentType }); res.end(data); }
    catch { res.writeHead(404); res.end('Not found'); }
}

const clients = new Map();
function broadcast(householdId, event, data) {
    const msg = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
    const houseClients = clients.get(householdId);
    if (houseClients) houseClients.forEach(r => r.write(msg));
}

async function seedAisles(householdId) {
    const stores = await pool.query('SELECT id FROM stores ORDER BY sort_order ASC');
    for (const store of stores.rows) {
        for (const aisle of DEFAULT_AISLES) {
            await pool.query('INSERT INTO aisles (household_id, store_id, name, sort_order, products) VALUES ($1,$2,$3,$4,$5)',
                [householdId, store.id, aisle.name, aisle.sort_order, JSON.stringify(aisle.products)]);
        }
    }
}

async function initDb() {
    await pool.query(`CREATE TABLE IF NOT EXISTS households (id SERIAL PRIMARY KEY, code TEXT NOT NULL UNIQUE, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`);
    await pool.query(`CREATE TABLE IF NOT EXISTS stores (id SERIAL PRIMARY KEY, name TEXT NOT NULL, color TEXT NOT NULL DEFAULT '#005EA5', emoji TEXT NOT NULL DEFAULT '🏪', sort_order INTEGER NOT NULL DEFAULT 0)`);
    await pool.query(`CREATE TABLE IF NOT EXISTS aisles (id SERIAL PRIMARY KEY, household_id INTEGER REFERENCES households(id) ON DELETE CASCADE, store_id INTEGER REFERENCES stores(id) ON DELETE CASCADE, name TEXT NOT NULL, sort_order INTEGER NOT NULL DEFAULT 0, products JSONB NOT NULL DEFAULT '[]')`);
    await pool.query(`CREATE TABLE IF NOT EXISTS items (id SERIAL PRIMARY KEY, household_id INTEGER REFERENCES households(id) ON DELETE CASCADE, store_id INTEGER REFERENCES stores(id) ON DELETE CASCADE, name TEXT NOT NULL, aisle_id INTEGER REFERENCES aisles(id) ON DELETE SET NULL, quantity INTEGER NOT NULL DEFAULT 1, is_favourite BOOLEAN NOT NULL DEFAULT false, is_checked BOOLEAN NOT NULL DEFAULT false, added_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`);
    await pool.query(`CREATE TABLE IF NOT EXISTS favourites (id SERIAL PRIMARY KEY, household_id INTEGER REFERENCES households(id) ON DELETE CASCADE, store_id INTEGER REFERENCES stores(id) ON DELETE CASCADE, aisle_id INTEGER REFERENCES aisles(id) ON DELETE CASCADE, name TEXT NOT NULL, UNIQUE(household_id, store_id, name))`);
    await pool.query(`CREATE TABLE IF NOT EXISTS push_subscriptions (id SERIAL PRIMARY KEY, household_id INTEGER REFERENCES households(id) ON DELETE CASCADE, endpoint TEXT NOT NULL UNIQUE, subscription JSONB NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`);
    await pool.query(`ALTER TABLE push_subscriptions ADD COLUMN IF NOT EXISTS shopping_active BOOLEAN NOT NULL DEFAULT false`);
    await pool.query(`ALTER TABLE push_subscriptions ADD COLUMN IF NOT EXISTS sender_endpoint TEXT`);
    await pool.query(`UPDATE push_subscriptions SET shopping_active=false`);
    await pool.query(`ALTER TABLE items ADD COLUMN IF NOT EXISTS household_id INTEGER REFERENCES households(id) ON DELETE CASCADE`);
    await pool.query(`ALTER TABLE items ADD COLUMN IF NOT EXISTS added_by TEXT`);
    await pool.query(`ALTER TABLE favourites ADD COLUMN IF NOT EXISTS household_id INTEGER REFERENCES households(id) ON DELETE CASCADE`);
    await pool.query(`ALTER TABLE households ADD COLUMN IF NOT EXISTS is_premium BOOLEAN NOT NULL DEFAULT false`);
    await pool.query(`ALTER TABLE households ADD COLUMN IF NOT EXISTS trial_started_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`);
    await pool.query(`ALTER TABLE households ADD COLUMN IF NOT EXISTS purchase_token TEXT`);
    await pool.query(`ALTER TABLE items ADD COLUMN IF NOT EXISTS added_by TEXT`);
    await pool.query(`ALTER TABLE favourites ALTER COLUMN aisle_id DROP NOT NULL`);

    const { rows } = await pool.query('SELECT COUNT(*) FROM stores');
    if (parseInt(rows[0].count) === 0) {
        const stores = [
            { name: 'Tesco', color: '#005EA5', emoji: '🔵', sort_order: 1 }, { name: 'Iceland', color: '#D61F26', emoji: '🔴', sort_order: 2 },
            { name: 'Lidl', color: '#0050AA', emoji: '🟡', sort_order: 3 }, { name: "Sainsbury's", color: '#F47920', emoji: '🟠', sort_order: 4 },
            { name: 'B&M', color: '#6B2D8B', emoji: '🟣', sort_order: 5 }, { name: 'Morrisons', color: '#00AA4F', emoji: '🟢', sort_order: 6 },
            { name: 'Marks & Spencer', color: '#000000', emoji: '⚫', sort_order: 7 }, { name: 'Aldi', color: '#003082', emoji: '🔷', sort_order: 8 },
        ];
        for (const s of stores) await pool.query('INSERT INTO stores (name, color, emoji, sort_order) VALUES ($1,$2,$3,$4)', [s.name, s.color, s.emoji, s.sort_order]);
        console.log('Stores seeded!');
    }
    // ===== MIGRATE AISLES TO NEW SUPERMARKET-FRIENDLY STRUCTURE =====
    // Runs once — checks if migration already done via emoji aisle name
    const checkMigration = await pool.query("SELECT COUNT(*) FROM aisles WHERE name LIKE '🥖%'");
    if (parseInt(checkMigration.rows[0].count) === 0) {
        console.log('Migrating to new aisle structure — wiping old data...');
        // Wipe everything clean
        await pool.query('DELETE FROM items');
        await pool.query('DELETE FROM favourites');
        await pool.query('DELETE FROM aisles');
        // Re-seed fresh aisles for every household + store combination
        const households = await pool.query('SELECT id FROM households');
        const stores = await pool.query('SELECT id FROM stores');
        for (const h of households.rows) {
            for (const s of stores.rows) {
                for (const aisle of DEFAULT_AISLES) {
                    await pool.query(
                        'INSERT INTO aisles (household_id, store_id, name, sort_order, products) VALUES ($1,$2,$3,$4,$5)',
                        [h.id, s.id, aisle.name, aisle.sort_order, JSON.stringify(aisle.products)]
                    );
                }
            }
        }
        console.log('Aisle migration complete — fresh start!');
    }

    console.log('Database ready');
}

const householdsRoute = require('./routes/households')(pool, generateCode, seedAisles, getBody);
const storesRoute     = require('./routes/stores')(pool, clients, mapStore, getBody, DEFAULT_AISLES);
const aislesRoute     = require('./routes/aisles')(pool, broadcast, mapAisle, getBody);
const itemsRoute      = require('./routes/items')(pool, broadcast, mapItem, getBody, webpush);
const favouritesRoute = require('./routes/favourites')(pool, broadcast, getBody);
const pushRoute       = require('./routes/push')(pool, getBody);

const server = http.createServer(async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Content-Type', 'application/json');
    const p = url.parse(req.url, true);
    const pathname = p.pathname;
    const method = req.method;

    if (pathname === '/' || pathname === '/index.html') return serveFile(res, path.join(APP_DIR, 'index.html'), 'text/html');
    if (pathname.startsWith('/css/'))  return serveFile(res, path.join(APP_DIR, pathname), 'text/css');
    if (pathname.startsWith('/js/') && pathname.endsWith('.js')) return serveFile(res, path.join(APP_DIR, pathname), 'application/javascript');
    if (pathname.startsWith('/img/'))  return serveFile(res, path.join(APP_DIR, pathname), 'image/png');
    if (pathname === '/manifest.json') return serveFile(res, path.join(APP_DIR, 'manifest.json'), 'application/manifest+json');
    if (pathname === '/sw.js') {
        try {
            const data = await fs.readFile(path.join(APP_DIR, 'sw.js'));
            res.writeHead(200, { 'Content-Type': 'application/javascript', 'Cache-Control': 'no-store' });
            return res.end(data);
        } catch { res.writeHead(404); return res.end('Not found'); }
    }
    if (pathname === '/privacy.html' || pathname === '/privacy') return serveFile(res, path.join(APP_DIR, 'privacy.html'), 'text/html');

    if (pathname === '/households/create' && method === 'POST') return householdsRoute.create(req, res);
    if (pathname === '/households/join'   && method === 'POST') return householdsRoute.join(req, res);

    if (pathname === '/events' && method === 'GET') {
        const householdId = parseInt(p.query.householdId);
        if (!householdId) { res.writeHead(400); return res.end(JSON.stringify({ error: 'householdId required' })); }
        res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', 'Connection': 'keep-alive' });
        try {
            const [sr, ar, ir, fr, hr] = await Promise.all([
                pool.query('SELECT * FROM stores ORDER BY sort_order ASC'),
                pool.query('SELECT * FROM aisles WHERE household_id=$1 ORDER BY sort_order ASC', [householdId]),
                pool.query('SELECT * FROM items WHERE household_id=$1 ORDER BY added_at ASC', [householdId]),
                pool.query('SELECT * FROM favourites WHERE household_id=$1 ORDER BY name ASC', [householdId]),
                pool.query('SELECT is_premium FROM households WHERE id=$1', [householdId])
            ]);
            const isPremium = hr.rows[0]?.is_premium || false;
            const trialStartedAt = hr.rows[0]?.trial_started_at || null;
            res.write(`event: init\ndata: ${JSON.stringify({ stores: sr.rows.map(mapStore), aisles: ar.rows.map(mapAisle), items: ir.rows.map(mapItem), favourites: fr.rows, isPremium, trialStartedAt })}\n\n`);
        } catch (e) { console.error('SSE init error:', e); }
        if (!clients.has(householdId)) clients.set(householdId, new Set());
        clients.get(householdId).add(res);
        req.on('close', () => clients.get(householdId)?.delete(res));
        return;
    }

    // ===== PREMIUM UPGRADE =====
    if (pathname === '/purchase/verify' && method === 'POST') {
        try {
            const b = await getBody(req);
            const { householdId, purchaseToken } = b;
            if (!householdId || !purchaseToken) { res.writeHead(400); return res.end(JSON.stringify({ error: 'Missing fields' })); }

            // TODO: Add Google Play server-side verification here once service account is set up
            // For now trust the token (add proper verification before production launch)
            // Example verification would use googleapis npm package:
            // const { google } = require('googleapis');
            // const androidpublisher = google.androidpublisher('v3');
            // await androidpublisher.purchases.products.get({ packageName, productId, token: purchaseToken });

            // Mark household as premium
            await pool.query('UPDATE households SET is_premium=true, purchase_token=$1 WHERE id=$2', [purchaseToken, householdId]);

            // Broadcast premium upgrade to all connected clients in this household
            const msg = `event: premiumUpgraded\ndata: ${JSON.stringify({ householdId: parseInt(householdId) })}\n\n`;
            clients.get(parseInt(householdId))?.forEach(r => r.write(msg));

            res.writeHead(200);
            return res.end(JSON.stringify({ success: true, isPremium: true }));
        } catch(e) {
            console.error('Purchase verify error:', e);
            res.writeHead(500);
            return res.end(JSON.stringify({ error: 'Upgrade failed' }));
        }
    }

    if (pathname === '/stores' && method === 'GET')  return storesRoute.getAll(req, res);
    if (pathname === '/stores' && method === 'POST') return storesRoute.add(req, res);
    const delStoreMatch = pathname.match(/^\/stores\/(\d+)\/delete$/);
    if (delStoreMatch && method === 'POST') return storesRoute.remove(req, res, parseInt(delStoreMatch[1]));

    if (pathname === '/push/vapid-key'      && method === 'GET')  return pushRoute.getVapidKey(req, res);
    if (pathname === '/push/subscribe'       && method === 'POST') return pushRoute.subscribe(req, res);
    if (pathname === '/push/shopping-status' && method === 'POST') return pushRoute.shoppingStatus(req, res);

    if (pathname === '/aisles'         && method === 'GET')  return aislesRoute.getAll(req, res, p);
    if (pathname === '/aisles'         && method === 'POST') return aislesRoute.add(req, res);
    if (pathname === '/aisles/reorder' && method === 'POST') return aislesRoute.reorder(req, res);
    const addProductMatch = pathname.match(/^\/aisles\/(\d+)\/products$/);
    if (addProductMatch && method === 'POST') return aislesRoute.addProduct(req, res, parseInt(addProductMatch[1]));
    const delProductMatch = pathname.match(/^\/aisles\/(\d+)\/products\/delete$/);
    if (delProductMatch && method === 'POST') return aislesRoute.deleteProduct(req, res, parseInt(delProductMatch[1]));
    const delAisleMatch = pathname.match(/^\/aisles\/(\d+)\/delete$/);
    if (delAisleMatch && method === 'POST') return aislesRoute.remove(req, res, parseInt(delAisleMatch[1]));

    if (pathname === '/items'               && method === 'GET')  return itemsRoute.getAll(req, res, p);
    if (pathname === '/items'               && method === 'POST') return itemsRoute.add(req, res);
    if (pathname === '/items/clear-checked' && method === 'POST') return itemsRoute.clearChecked(req, res);
    const qtyMatch   = pathname.match(/^\/items\/(\d+)\/quantity$/);
    if (qtyMatch   && method === 'POST') return itemsRoute.updateQuantity(req, res, parseInt(qtyMatch[1]));
    const checkMatch = pathname.match(/^\/items\/(\d+)\/check$/);
    if (checkMatch && method === 'POST') return itemsRoute.toggleCheck(req, res, parseInt(checkMatch[1]));
    const favMatch   = pathname.match(/^\/items\/(\d+)\/favourite$/);
    if (favMatch   && method === 'POST') return itemsRoute.toggleFavourite(req, res, parseInt(favMatch[1]));
    const delMatch   = pathname.match(/^\/items\/(\d+)\/delete$/);
    if (delMatch   && method === 'POST') return itemsRoute.remove(req, res, parseInt(delMatch[1]));

    if (pathname === '/favourites'        && method === 'GET')  return favouritesRoute.getAll(req, res, p);
    if (pathname === '/favourites'        && method === 'POST') return favouritesRoute.add(req, res);
    if (pathname === '/favourites/delete' && method === 'POST') return favouritesRoute.remove(req, res);

    if (pathname === '/.well-known/assetlinks.json') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify([{ relation: ['delegate_permission/common.handle_all_urls'], target: { namespace: 'android_app', package_name: 'com.onrender.trolleymate.twa', sha256_cert_fingerprints: ['C6:09:97:89:D8:23:E0:B3:67:17:02:2D:30:C4:C6:1D:CB:3F:1C:42:0D:AD:32:ED:3F:1A:49:25:39:D1:54:8C'] } }]));
        return;
    }

    if (pathname === '/prices' && method === 'GET') {
        const query = p.query.q; const store = p.query.store || 'tesco';
        if (!query) { res.writeHead(400); return res.end(JSON.stringify({ error: 'No query' })); }
        try {
            const https = require('https');
            const options = { hostname: 'uk-supermarkets-product-pricing.p.rapidapi.com', path: `/search?query=${encodeURIComponent(query)}&retailer=${encodeURIComponent(store)}`, method: 'GET', headers: { 'x-rapidapi-host': 'uk-supermarkets-product-pricing.p.rapidapi.com', 'x-rapidapi-key': RAPIDAPI_KEY } };
            const apiReq = https.request(options, (apiRes) => { let data = ''; apiRes.on('data', chunk => data += chunk); apiRes.on('end', () => { res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(data); }); });
            apiReq.on('error', (e) => { res.writeHead(500); res.end(JSON.stringify({ error: e.message })); });
            apiReq.end();
        } catch (e) { res.writeHead(500); res.end(JSON.stringify({ error: e.message })); }
        return;
    }

    res.writeHead(404);
    res.end(JSON.stringify({ error: 'Not found' }));
});

initDb().then(() => {
    server.listen(PORT, () => console.log(`BasketMate running on port ${PORT}`));
}).catch(err => { console.error('DB init failed:', err); process.exit(1); });
