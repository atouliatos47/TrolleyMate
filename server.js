const http = require('http');
const fs = require('fs').promises;
const path = require('path');
const url = require('url');
const { Pool } = require('pg');

const PORT = process.env.PORT || 3000;
const RAPIDAPI_KEY = process.env.RAPIDAPI_KEY || '';
const APP_DIR = __dirname;

// ===== DATABASE =====
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

// Generate a random 6-character household code e.g. "XK9F2A"
function generateCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    return Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

// Default aisles seeded for every new household
const DEFAULT_AISLES = [
    { name: 'Bread',        sort_order: 1,  products: ['White Bread', 'Brown Bread', 'Bread Rolls', 'Bagels', 'Wraps', 'Pitta Bread', 'Crumpets', 'Croissants', 'Muffins', 'Sourdough'] },
    { name: 'Dairy',        sort_order: 2,  products: ['Milk', 'Butter', 'Cheddar', 'Mozzarella', 'Cream Cheese', 'Sour Cream', 'Double Cream', 'Yoghurt', 'Greek Yoghurt'] },
    { name: 'Veg / Fruit',  sort_order: 3,  products: ['Bananas', 'Apples', 'Oranges', 'Grapes', 'Strawberries', 'Potatoes', 'Carrots', 'Broccoli', 'Spinach', 'Tomatoes', 'Onions', 'Garlic', 'Mushrooms', 'Peppers', 'Cucumber', 'Lettuce', 'Courgette', 'Lemons'] },
    { name: 'Meat',         sort_order: 4,  products: ['Chicken Breast', 'Chicken Thighs', 'Minced Beef', 'Beef Steak', 'Pork Chops', 'Bacon', 'Sausages', 'Lamb Chops', 'Salmon Fillet', 'Cod Fillet', 'Tuna Steak', 'Prawns'] },
    { name: 'Dairy Fridge', sort_order: 5,  products: ['Eggs', 'Orange Juice', 'Apple Juice', 'Hummus', 'Coleslaw', 'Pasta Salad'] },
    { name: 'Herbs',        sort_order: 6,  products: ['Basil', 'Coriander', 'Parsley', 'Mint', 'Rosemary', 'Thyme', 'Chives', 'Dill', 'Oregano', 'Bay Leaves'] },
    { name: 'Cereal',       sort_order: 7,  products: ['Cornflakes', 'Weetabix', 'Porridge Oats', 'Granola', 'Muesli', 'Shreddies', 'Rice Krispies', 'Cheerios'] },
    { name: 'Canned Food',  sort_order: 8,  products: ['Baked Beans', 'Chopped Tomatoes', 'Chickpeas', 'Kidney Beans', 'Sweetcorn', 'Tuna', 'Sardines', 'Coconut Milk', 'Lentils', 'Soup', 'Olives', 'Tomato Paste'] },
    { name: 'Pasta / Rice', sort_order: 9,  products: ['Spaghetti', 'Penne', 'Fusilli', 'Lasagne Sheets', 'Basmati Rice', 'Brown Rice', 'Egg Noodles', 'Rice Noodles'] },
    { name: 'Toiletries',   sort_order: 10, products: ['Shampoo', 'Conditioner', 'Body Wash', 'Shower Gel', 'Toothpaste', 'Toothbrush', 'Deodorant', 'Face Wash', 'Moisturiser', 'Razors', 'Soap'] },
    { name: 'Drinks',       sort_order: 11, products: ['Water', 'Sparkling Water', 'Coca Cola', 'Pepsi', 'Lemonade', 'Tea', 'Coffee', 'Hot Chocolate', 'Squash', 'Energy Drink'] },
    { name: 'Household',    sort_order: 12, products: ['Washing Up Liquid', 'Dishwasher Tablets', 'Laundry Tablets', 'Fabric Softener', 'Bleach', 'Toilet Cleaner', 'Surface Spray', 'Bin Bags', 'Foil', 'Cling Film', 'Kitchen Roll', 'Toilet Roll'] },
];

async function initDb() {
    // Households table
    await pool.query(`
        CREATE TABLE IF NOT EXISTS households (
            id SERIAL PRIMARY KEY,
            code TEXT NOT NULL UNIQUE,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
    `);

    // Stores table (global — shared across all households)
    await pool.query(`
        CREATE TABLE IF NOT EXISTS stores (
            id SERIAL PRIMARY KEY,
            name TEXT NOT NULL,
            color TEXT NOT NULL DEFAULT '#005EA5',
            emoji TEXT NOT NULL DEFAULT '🏪',
            sort_order INTEGER NOT NULL DEFAULT 0
        )
    `);

    // Aisles table (per household)
    await pool.query(`
        CREATE TABLE IF NOT EXISTS aisles (
            id SERIAL PRIMARY KEY,
            household_id INTEGER REFERENCES households(id) ON DELETE CASCADE,
            store_id INTEGER REFERENCES stores(id) ON DELETE CASCADE,
            name TEXT NOT NULL,
            sort_order INTEGER NOT NULL DEFAULT 0,
            products JSONB NOT NULL DEFAULT '[]'
        )
    `);

    // Items table (per household)
    await pool.query(`
        CREATE TABLE IF NOT EXISTS items (
            id SERIAL PRIMARY KEY,
            household_id INTEGER REFERENCES households(id) ON DELETE CASCADE,
            store_id INTEGER REFERENCES stores(id) ON DELETE CASCADE,
            name TEXT NOT NULL,
            aisle_id INTEGER REFERENCES aisles(id) ON DELETE SET NULL,
            quantity INTEGER NOT NULL DEFAULT 1,
            is_favourite BOOLEAN NOT NULL DEFAULT false,
            is_checked BOOLEAN NOT NULL DEFAULT false,
            added_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
    `);

    // Favourites table (per household)
    await pool.query(`
        CREATE TABLE IF NOT EXISTS favourites (
            id SERIAL PRIMARY KEY,
            household_id INTEGER REFERENCES households(id) ON DELETE CASCADE,
            store_id INTEGER REFERENCES stores(id) ON DELETE CASCADE,
            aisle_id INTEGER REFERENCES aisles(id) ON DELETE CASCADE,
            name TEXT NOT NULL,
            UNIQUE(household_id, store_id, name)
        )
    `);

    // ===== MIGRATIONS — add columns to existing tables if upgrading =====
    await pool.query(`ALTER TABLE aisles ADD COLUMN IF NOT EXISTS household_id INTEGER REFERENCES households(id) ON DELETE CASCADE`);
    await pool.query(`ALTER TABLE items ADD COLUMN IF NOT EXISTS household_id INTEGER REFERENCES households(id) ON DELETE CASCADE`);
    await pool.query(`ALTER TABLE favourites ADD COLUMN IF NOT EXISTS household_id INTEGER REFERENCES households(id) ON DELETE CASCADE`);

    // Seed global stores if empty
    const { rows } = await pool.query('SELECT COUNT(*) FROM stores');
    if (parseInt(rows[0].count) === 0) {
        const stores = [
            { name: 'Tesco',           color: '#005EA5', emoji: '🔵', sort_order: 1 },
            { name: 'Iceland',         color: '#D61F26', emoji: '🔴', sort_order: 2 },
            { name: 'Lidl',            color: '#0050AA', emoji: '🟡', sort_order: 3 },
            { name: "Sainsbury's",     color: '#F47920', emoji: '🟠', sort_order: 4 },
            { name: 'B&M',             color: '#6B2D8B', emoji: '🟣', sort_order: 5 },
            { name: 'Morrisons',       color: '#00AA4F', emoji: '🟢', sort_order: 6 },
            { name: 'Marks & Spencer', color: '#000000', emoji: '⚫', sort_order: 7 },
            { name: 'Aldi',            color: '#003082', emoji: '🔷', sort_order: 8 },
        ];
        for (const s of stores) {
            await pool.query(
                'INSERT INTO stores (name, color, emoji, sort_order) VALUES ($1,$2,$3,$4)',
                [s.name, s.color, s.emoji, s.sort_order]
            );
        }
        console.log('Stores seeded!');
    }

    console.log('Database ready');
}

// Seed default aisles for a new household
async function seedAisles(householdId) {
    const stores = await pool.query('SELECT id FROM stores ORDER BY sort_order ASC');
    for (const store of stores.rows) {
        for (const aisle of DEFAULT_AISLES) {
            await pool.query(
                'INSERT INTO aisles (household_id, store_id, name, sort_order, products) VALUES ($1,$2,$3,$4,$5)',
                [householdId, store.id, aisle.name, aisle.sort_order, JSON.stringify(aisle.products)]
            );
        }
    }
}

// ===== SSE — scoped per household =====
const clients = new Map(); // householdId -> Set of res

function broadcast(householdId, event, data) {
    const msg = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
    const houseClients = clients.get(householdId);
    if (houseClients) houseClients.forEach(res => res.write(msg));
}

// ===== HELPERS =====
function mapStore(row) {
    return { id: row.id, name: row.name, color: row.color, emoji: row.emoji, sortOrder: row.sort_order };
}

function mapAisle(row) {
    return { id: row.id, householdId: row.household_id, storeId: row.store_id, name: row.name, sortOrder: row.sort_order, products: row.products || [] };
}

function mapItem(row) {
    return {
        id: row.id, householdId: row.household_id, storeId: row.store_id, name: row.name,
        aisleId: row.aisle_id, quantity: row.quantity,
        isFavourite: row.is_favourite, isChecked: row.is_checked, addedAt: row.added_at
    };
}

async function getBody(req) {
    return new Promise((resolve, reject) => {
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', () => {
            try { resolve(JSON.parse(body || '{}')); }
            catch { reject(new Error('Invalid JSON')); }
        });
    });
}

async function serveFile(res, filePath, contentType) {
    try {
        const data = await fs.readFile(filePath);
        res.writeHead(200, { 'Content-Type': contentType });
        res.end(data);
    } catch {
        res.writeHead(404);
        res.end('Not found');
    }
}

// ===== SERVER =====
const server = http.createServer(async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Content-Type', 'application/json');

    const p = url.parse(req.url, true);

    // ===== STATIC FILES =====
    if (p.pathname === '/' || p.pathname === '/index.html')
        return serveFile(res, path.join(APP_DIR, 'index.html'), 'text/html');
    if (p.pathname.startsWith('/css/'))
        return serveFile(res, path.join(APP_DIR, p.pathname), 'text/css');
    if (p.pathname.startsWith('/js/') && p.pathname.endsWith('.js'))
        return serveFile(res, path.join(APP_DIR, p.pathname), 'application/javascript');
    if (p.pathname.startsWith('/img/'))
        return serveFile(res, path.join(APP_DIR, p.pathname), 'image/png');
    if (p.pathname === '/manifest.json')
        return serveFile(res, path.join(APP_DIR, 'manifest.json'), 'application/manifest+json');
    if (p.pathname === '/sw.js')
        return serveFile(res, path.join(APP_DIR, 'sw.js'), 'application/javascript');

    // ===== HOUSEHOLD — CREATE =====
    if (p.pathname === '/households/create' && req.method === 'POST') {
        try {
            let code, exists = true;
            // Keep generating until unique
            while (exists) {
                code = generateCode();
                const r = await pool.query('SELECT id FROM households WHERE code=$1', [code]);
                exists = r.rows.length > 0;
            }
            const r = await pool.query('INSERT INTO households (code) VALUES ($1) RETURNING *', [code]);
            const household = r.rows[0];
            await seedAisles(household.id);
            res.writeHead(201);
            res.end(JSON.stringify({ id: household.id, code: household.code }));
        } catch (e) {
            console.error('Create household error:', e);
            res.writeHead(500);
            res.end(JSON.stringify({ error: 'Failed to create household' }));
        }
        return;
    }

    // ===== HOUSEHOLD — JOIN =====
    if (p.pathname === '/households/join' && req.method === 'POST') {
        try {
            const b = await getBody(req);
            const code = (b.code || '').trim().toUpperCase();
            if (!code) { res.writeHead(400); return res.end(JSON.stringify({ error: 'Code required' })); }
            const r = await pool.query('SELECT * FROM households WHERE code=$1', [code]);
            if (!r.rows.length) { res.writeHead(404); return res.end(JSON.stringify({ error: 'Household not found' })); }
            const household = r.rows[0];
            res.end(JSON.stringify({ id: household.id, code: household.code }));
        } catch (e) {
            res.writeHead(500);
            res.end(JSON.stringify({ error: 'Failed to join household' }));
        }
        return;
    }

    // ===== SSE — scoped per household =====
    if (p.pathname === '/events' && req.method === 'GET') {
        const householdId = parseInt(p.query.householdId);
        if (!householdId) { res.writeHead(400); return res.end(JSON.stringify({ error: 'householdId required' })); }

        res.writeHead(200, {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive'
        });

        try {
            const [sr, ar, ir, fr] = await Promise.all([
                pool.query('SELECT * FROM stores ORDER BY sort_order ASC'),
                pool.query('SELECT * FROM aisles WHERE household_id=$1 ORDER BY sort_order ASC', [householdId]),
                pool.query('SELECT * FROM items WHERE household_id=$1 ORDER BY added_at ASC', [householdId]),
                pool.query('SELECT * FROM favourites WHERE household_id=$1 ORDER BY name ASC', [householdId])
            ]);
            res.write(`event: init\ndata: ${JSON.stringify({
                stores:     sr.rows.map(mapStore),
                aisles:     ar.rows.map(mapAisle),
                items:      ir.rows.map(mapItem),
                favourites: fr.rows
            })}\n\n`);
        } catch (e) { console.error('SSE init error:', e); }

        if (!clients.has(householdId)) clients.set(householdId, new Set());
        clients.get(householdId).add(res);
        req.on('close', () => {
            clients.get(householdId)?.delete(res);
        });
        return;
    }

    // ===== GET STORES (global) =====
    if (p.pathname === '/stores' && req.method === 'GET') {
        const r = await pool.query('SELECT * FROM stores ORDER BY sort_order ASC');
        res.writeHead(200);
        res.end(JSON.stringify(r.rows.map(mapStore)));
        return;
    }

    // ===== GET AISLES =====
    if (p.pathname === '/aisles' && req.method === 'GET') {
        const householdId = parseInt(p.query.householdId);
        const storeId = p.query.storeId;
        if (!householdId) { res.writeHead(400); return res.end(JSON.stringify({ error: 'householdId required' })); }
        const r = storeId
            ? await pool.query('SELECT * FROM aisles WHERE household_id=$1 AND store_id=$2 ORDER BY sort_order ASC', [householdId, storeId])
            : await pool.query('SELECT * FROM aisles WHERE household_id=$1 ORDER BY sort_order ASC', [householdId]);
        res.writeHead(200);
        res.end(JSON.stringify(r.rows.map(mapAisle)));
        return;
    }

    // ===== ADD PRODUCT TO AISLE =====
    const addProductMatch = p.pathname.match(/^\/aisles\/(\d+)\/products$/);
    if (addProductMatch && req.method === 'POST') {
        try {
            const b = await getBody(req);
            const householdId = parseInt(b.householdId);
            const id = parseInt(addProductMatch[1]);
            const r = await pool.query('SELECT products FROM aisles WHERE id=$1 AND household_id=$2', [id, householdId]);
            if (!r.rows.length) { res.writeHead(404); return res.end(JSON.stringify({ error: 'Not found' })); }
            const products = r.rows[0].products || [];
            if (!products.includes(b.name)) { products.push(b.name); products.sort((a, z) => a.localeCompare(z)); }
            const updated = await pool.query('UPDATE aisles SET products=$1 WHERE id=$2 RETURNING *', [JSON.stringify(products), id]);
            const aisle = mapAisle(updated.rows[0]);
            broadcast(householdId, 'updateAisle', aisle);
            res.end(JSON.stringify(aisle));
        } catch (e) { res.writeHead(400); res.end(JSON.stringify({ error: 'Invalid request' })); }
        return;
    }

    // ===== DELETE AISLE =====
    const delAisleMatch = p.pathname.match(/^\/aisles\/(\d+)\/delete$/);
    if (delAisleMatch && req.method === 'POST') {
        try {
            const b = await getBody(req);
            const householdId = parseInt(b.householdId);
            const id = parseInt(delAisleMatch[1]);
            await pool.query('DELETE FROM aisles WHERE id=$1 AND household_id=$2', [id, householdId]);
            broadcast(householdId, 'deleteAisle', { id });
            res.end(JSON.stringify({ success: true }));
        } catch (e) { res.writeHead(400); res.end(JSON.stringify({ error: 'Invalid request' })); }
        return;
    }

    // ===== DELETE PRODUCT FROM AISLE =====
    const delProductMatch = p.pathname.match(/^\/aisles\/(\d+)\/products\/delete$/);
    if (delProductMatch && req.method === 'POST') {
        try {
            const b = await getBody(req);
            const householdId = parseInt(b.householdId);
            const id = parseInt(delProductMatch[1]);
            const r = await pool.query('SELECT products FROM aisles WHERE id=$1 AND household_id=$2', [id, householdId]);
            if (!r.rows.length) { res.writeHead(404); return res.end(JSON.stringify({ error: 'Not found' })); }
            const products = (r.rows[0].products || []).filter(pr => pr !== b.name);
            const updated = await pool.query('UPDATE aisles SET products=$1 WHERE id=$2 RETURNING *', [JSON.stringify(products), id]);
            const aisle = mapAisle(updated.rows[0]);
            broadcast(householdId, 'updateAisle', aisle);
            res.end(JSON.stringify(aisle));
        } catch (e) { res.writeHead(400); res.end(JSON.stringify({ error: 'Invalid request' })); }
        return;
    }

    // ===== GET ITEMS =====
    if (p.pathname === '/items' && req.method === 'GET') {
        const householdId = parseInt(p.query.householdId);
        const storeId = p.query.storeId;
        if (!householdId) { res.writeHead(400); return res.end(JSON.stringify({ error: 'householdId required' })); }
        const r = storeId
            ? await pool.query('SELECT * FROM items WHERE household_id=$1 AND store_id=$2 ORDER BY added_at ASC', [householdId, storeId])
            : await pool.query('SELECT * FROM items WHERE household_id=$1 ORDER BY added_at ASC', [householdId]);
        res.writeHead(200);
        res.end(JSON.stringify(r.rows.map(mapItem)));
        return;
    }

    // ===== ADD ITEM =====
    if (p.pathname === '/items' && req.method === 'POST') {
        try {
            const b = await getBody(req);
            const householdId = parseInt(b.householdId);
            if (!householdId) { res.writeHead(400); return res.end(JSON.stringify({ error: 'householdId required' })); }
            const r = await pool.query(
                `INSERT INTO items (household_id, store_id, name, aisle_id, quantity, is_favourite)
                 VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
                [householdId, b.storeId, b.name, b.aisleId || null, b.quantity || 1, b.isFavourite || false]
            );
            const item = mapItem(r.rows[0]);
            broadcast(householdId, 'newItem', item);
            res.writeHead(201);
            res.end(JSON.stringify(item));
        } catch (e) { res.writeHead(400); res.end(JSON.stringify({ error: 'Invalid request' })); }
        return;
    }

    // ===== UPDATE QUANTITY =====
    const qtyMatch = p.pathname.match(/^\/items\/(\d+)\/quantity$/);
    if (qtyMatch && req.method === 'POST') {
        try {
            const b = await getBody(req);
            const householdId = parseInt(b.householdId);
            const r = await pool.query(
                'UPDATE items SET quantity=$1 WHERE id=$2 AND household_id=$3 RETURNING *',
                [b.quantity, parseInt(qtyMatch[1]), householdId]
            );
            if (!r.rows.length) { res.writeHead(404); return res.end(JSON.stringify({ error: 'Not found' })); }
            const item = mapItem(r.rows[0]);
            broadcast(householdId, 'updateItem', item);
            res.end(JSON.stringify(item));
        } catch (e) { res.writeHead(400); res.end(JSON.stringify({ error: 'Invalid request' })); }
        return;
    }

    // ===== TOGGLE CHECKED =====
    const checkMatch = p.pathname.match(/^\/items\/(\d+)\/check$/);
    if (checkMatch && req.method === 'POST') {
        try {
            const b = await getBody(req);
            const householdId = parseInt(b.householdId);
            const r = await pool.query(
                'UPDATE items SET is_checked=NOT is_checked WHERE id=$1 AND household_id=$2 RETURNING *',
                [parseInt(checkMatch[1]), householdId]
            );
            if (!r.rows.length) { res.writeHead(404); return res.end(JSON.stringify({ error: 'Not found' })); }
            const item = mapItem(r.rows[0]);
            broadcast(householdId, 'updateItem', item);
            res.end(JSON.stringify(item));
        } catch (e) { res.writeHead(400); res.end(JSON.stringify({ error: 'Invalid request' })); }
        return;
    }

    // ===== TOGGLE FAVOURITE =====
    const favMatch = p.pathname.match(/^\/items\/(\d+)\/favourite$/);
    if (favMatch && req.method === 'POST') {
        try {
            const b = await getBody(req);
            const householdId = parseInt(b.householdId);
            const r = await pool.query(
                'UPDATE items SET is_favourite=NOT is_favourite WHERE id=$1 AND household_id=$2 RETURNING *',
                [parseInt(favMatch[1]), householdId]
            );
            if (!r.rows.length) { res.writeHead(404); return res.end(JSON.stringify({ error: 'Not found' })); }
            const item = mapItem(r.rows[0]);
            broadcast(householdId, 'updateItem', item);
            res.end(JSON.stringify(item));
        } catch (e) { res.writeHead(400); res.end(JSON.stringify({ error: 'Invalid request' })); }
        return;
    }

    // ===== DELETE ITEM =====
    const delMatch = p.pathname.match(/^\/items\/(\d+)\/delete$/);
    if (delMatch && req.method === 'POST') {
        try {
            const b = await getBody(req);
            const householdId = parseInt(b.householdId);
            await pool.query('DELETE FROM items WHERE id=$1 AND household_id=$2', [parseInt(delMatch[1]), householdId]);
            broadcast(householdId, 'deleteItem', { id: parseInt(delMatch[1]) });
            res.end(JSON.stringify({ success: true }));
        } catch (e) { res.writeHead(400); res.end(JSON.stringify({ error: 'Invalid request' })); }
        return;
    }

    // ===== CLEAR CHECKED =====
    if (p.pathname === '/items/clear-checked' && req.method === 'POST') {
        try {
            const b = await getBody(req);
            const householdId = parseInt(b.householdId);
            const r = await pool.query(
                'DELETE FROM items WHERE is_checked=true AND store_id=$1 AND household_id=$2 RETURNING id',
                [b.storeId, householdId]
            );
            r.rows.forEach(row => broadcast(householdId, 'deleteItem', { id: row.id }));
            res.end(JSON.stringify({ deleted: r.rows.length }));
        } catch (e) { res.writeHead(400); res.end(JSON.stringify({ error: 'Invalid request' })); }
        return;
    }

    // ===== FAVOURITES — GET =====
    if (p.pathname === '/favourites' && req.method === 'GET') {
        const householdId = parseInt(p.query.householdId);
        if (!householdId) { res.writeHead(400); return res.end(JSON.stringify({ error: 'householdId required' })); }
        const r = await pool.query('SELECT * FROM favourites WHERE household_id=$1 ORDER BY name ASC', [householdId]);
        res.writeHead(200);
        res.end(JSON.stringify(r.rows));
        return;
    }

    // ===== FAVOURITES — ADD =====
    if (p.pathname === '/favourites' && req.method === 'POST') {
        try {
            const b = await getBody(req);
            const householdId = parseInt(b.householdId);
            if (!householdId) { res.writeHead(400); return res.end(JSON.stringify({ error: 'householdId required' })); }
            const r = await pool.query(
                `INSERT INTO favourites (household_id, store_id, aisle_id, name)
                 VALUES ($1,$2,$3,$4)
                 ON CONFLICT (household_id, store_id, name) DO NOTHING RETURNING *`,
                [householdId, b.storeId, b.aisleId, b.name]
            );
            res.writeHead(201);
            res.end(JSON.stringify(r.rows[0] || {}));
        } catch (e) { res.writeHead(400); res.end(JSON.stringify({ error: 'Invalid request' })); }
        return;
    }

    // ===== FAVOURITES — DELETE =====
    if (p.pathname === '/favourites/delete' && req.method === 'POST') {
        try {
            const b = await getBody(req);
            const householdId = parseInt(b.householdId);
            if (!householdId) { res.writeHead(400); return res.end(JSON.stringify({ error: 'householdId required' })); }
            await pool.query(
                'DELETE FROM favourites WHERE household_id=$1 AND store_id=$2 AND name=$3',
                [householdId, b.storeId, b.name]
            );
            broadcast(householdId, 'deleteFavourite', { storeId: b.storeId, name: b.name });
            res.end(JSON.stringify({ success: true }));
        } catch (e) { res.writeHead(400); res.end(JSON.stringify({ error: 'Invalid request' })); }
        return;
    }

    // ===== ASSET LINKS (for TWA / Play Store verification) =====
    if (p.pathname === '/.well-known/assetlinks.json') {
        const assetLinks = [{
            relation: ['delegate_permission/common.handle_all_urls'],
            target: {
                namespace: 'android_app',
                package_name: 'com.onrender.trolleymate.twa',
                sha256_cert_fingerprints: ['C6:09:97:89:D8:23:E0:B3:67:17:02:2D:30:C4:C6:1D:CB:3F:1C:42:0D:AD:32:ED:3F:1A:49:25:39:D1:54:8C']
            }
        }];
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(assetLinks));
        return;
    }

    // ===== PRICE LOOKUP =====
    if (p.pathname === '/prices' && req.method === 'GET') {
        const query = p.query.q;
        const store = p.query.store || 'tesco';
        if (!query) { res.writeHead(400); return res.end(JSON.stringify({ error: 'No query' })); }
        try {
            const https = require('https');
            const options = {
                hostname: 'uk-supermarkets-product-pricing.p.rapidapi.com',
                path: `/search?query=${encodeURIComponent(query)}&retailer=${encodeURIComponent(store)}`,
                method: 'GET',
                headers: {
                    'x-rapidapi-host': 'uk-supermarkets-product-pricing.p.rapidapi.com',
                    'x-rapidapi-key': RAPIDAPI_KEY
                }
            };
            const apiReq = https.request(options, (apiRes) => {
                let data = '';
                apiRes.on('data', chunk => data += chunk);
                apiRes.on('end', () => {
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(data);
                });
            });
            apiReq.on('error', (e) => {
                res.writeHead(500);
                res.end(JSON.stringify({ error: e.message }));
            });
            apiReq.end();
        } catch (e) { res.writeHead(500); res.end(JSON.stringify({ error: e.message })); }
        return;
    }

    res.writeHead(404);
    res.end(JSON.stringify({ error: 'Not found' }));
});

initDb().then(() => {
    server.listen(PORT, () => console.log(`BasketMate running on port ${PORT}`));
}).catch(err => {
    console.error('DB init failed:', err);
    process.exit(1);
});
