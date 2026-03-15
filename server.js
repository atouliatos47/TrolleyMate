const http = require('http');
const fs = require('fs').promises;
const path = require('path');
const url = require('url');
const { Pool } = require('pg');

const PORT = process.env.PORT || 3000;
const RAPIDAPI_KEY = process.env.RAPIDAPI_KEY || '8c10d16df5mshbd8d3d0cb4a58cap1da428jsn8828d2895de4';
const APP_DIR = __dirname;

// ===== DATABASE =====
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function initDb() {
    // Stores table
    await pool.query(`
        CREATE TABLE IF NOT EXISTS stores (
            id SERIAL PRIMARY KEY,
            name TEXT NOT NULL,
            color TEXT NOT NULL DEFAULT '#005EA5',
            emoji TEXT NOT NULL DEFAULT '🏪',
            sort_order INTEGER NOT NULL DEFAULT 0
        )
    `);

    // Aisles table
    await pool.query(`
        CREATE TABLE IF NOT EXISTS aisles (
            id SERIAL PRIMARY KEY,
            store_id INTEGER REFERENCES stores(id) ON DELETE CASCADE,
            name TEXT NOT NULL,
            sort_order INTEGER NOT NULL DEFAULT 0,
            products JSONB NOT NULL DEFAULT '[]'
        )
    `);

    // Items table
    await pool.query(`
        CREATE TABLE IF NOT EXISTS items (
            id SERIAL PRIMARY KEY,
            store_id INTEGER REFERENCES stores(id) ON DELETE CASCADE,
            name TEXT NOT NULL,
            aisle_id INTEGER REFERENCES aisles(id) ON DELETE SET NULL,
            quantity INTEGER NOT NULL DEFAULT 1,
            is_favourite BOOLEAN NOT NULL DEFAULT false,
            is_checked BOOLEAN NOT NULL DEFAULT false,
            added_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
    `);

    // Add store_id to existing tables if upgrading
    await pool.query(`ALTER TABLE aisles ADD COLUMN IF NOT EXISTS store_id INTEGER REFERENCES stores(id) ON DELETE CASCADE`);
    await pool.query(`ALTER TABLE items ADD COLUMN IF NOT EXISTS store_id INTEGER REFERENCES stores(id) ON DELETE CASCADE`);

    // Seed stores if empty
    const { rows } = await pool.query('SELECT COUNT(*) FROM stores');
    if (parseInt(rows[0].count) === 0) {
        const stores = [
            { name: 'Tesco',             color: '#005EA5', emoji: '🔵', sort_order: 1 },
            { name: 'Iceland',           color: '#D61F26', emoji: '🔴', sort_order: 2 },
            { name: 'Lidl',              color: '#0050AA', emoji: '🟡', sort_order: 3 },
            { name: "Sainsbury's",       color: '#F47920', emoji: '🟠', sort_order: 4 },
            { name: 'B&M',               color: '#6B2D8B', emoji: '🟣', sort_order: 5 },
            { name: "Morrisons",         color: '#00AA4F', emoji: '🟢', sort_order: 6 },
            { name: "Marks & Spencer",   color: '#000000', emoji: '⚫', sort_order: 7 },
            { name: 'Aldi',              color: '#003082', emoji: '🔷', sort_order: 8 },
        ];
        for (const s of stores) {
            await pool.query(
                'INSERT INTO stores (name, color, emoji, sort_order) VALUES ($1,$2,$3,$4)',
                [s.name, s.color, s.emoji, s.sort_order]
            );
        }
        console.log('Stores seeded!');
    }

    // Favourites table
    await pool.query(`
        CREATE TABLE IF NOT EXISTS favourites (
            id SERIAL PRIMARY KEY,
            store_id INTEGER REFERENCES stores(id) ON DELETE CASCADE,
            aisle_id INTEGER REFERENCES aisles(id) ON DELETE CASCADE,
            name TEXT NOT NULL,
            UNIQUE(store_id, name)
        )
    `);

    console.log('Database ready');
}

// ===== SSE =====
const clients = new Set();

function broadcast(event, data) {
    const msg = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
    clients.forEach(res => res.write(msg));
}

// ===== HELPERS =====
function mapStore(row) {
    return { id: row.id, name: row.name, color: row.color, emoji: row.emoji, sortOrder: row.sort_order };
}

function mapAisle(row) {
    return { id: row.id, storeId: row.store_id, name: row.name, sortOrder: row.sort_order, products: row.products || [] };
}

function mapItem(row) {
    return {
        id: row.id, storeId: row.store_id, name: row.name,
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

    // ===== SSE =====
    if (p.pathname === '/events' && req.method === 'GET') {
        res.writeHead(200, {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive'
        });
        try {
            const [sr, ar, ir, fr] = await Promise.all([
                pool.query('SELECT * FROM stores ORDER BY sort_order ASC'),
                pool.query('SELECT * FROM aisles ORDER BY sort_order ASC'),
                pool.query('SELECT * FROM items ORDER BY added_at ASC'),
                pool.query('SELECT * FROM favourites ORDER BY name ASC')
            ]);
            res.write(`event: init\ndata: ${JSON.stringify({
                stores:     sr.rows.map(mapStore),
                aisles:     ar.rows.map(mapAisle),
                items:      ir.rows.map(mapItem),
                favourites: fr.rows
            })}\n\n`);
        } catch(e) { console.error('SSE init error:', e); }
        clients.add(res);
        req.on('close', () => clients.delete(res));
        return;
    }

    // ===== GET STORES =====
    if (p.pathname === '/stores' && req.method === 'GET') {
        const r = await pool.query('SELECT * FROM stores ORDER BY sort_order ASC');
        res.writeHead(200); res.end(JSON.stringify(r.rows.map(mapStore)));
        return;
    }

    // ===== ADD STORE =====
    if (p.pathname === '/stores' && req.method === 'POST') {
        try {
            const b = await getBody(req);
            const r = await pool.query(
                `INSERT INTO stores (name, color, emoji, sort_order)
                 VALUES ($1,$2,$3,(SELECT COALESCE(MAX(sort_order),0)+1 FROM stores)) RETURNING *`,
                [b.name, b.color || '#005EA5', b.emoji || '🏪']
            );
            const store = mapStore(r.rows[0]);
            broadcast('newStore', store);
            res.writeHead(201); res.end(JSON.stringify(store));
        } catch(e) { res.writeHead(400); res.end(JSON.stringify({ error: 'Invalid request' })); }
        return;
    }

    // ===== DELETE STORE =====
    const delStoreMatch = p.pathname.match(/^\/stores\/(\d+)\/delete$/);
    if (delStoreMatch && req.method === 'POST') {
        try {
            const id = parseInt(delStoreMatch[1]);
            await pool.query('DELETE FROM stores WHERE id=$1', [id]);
            broadcast('deleteStore', { id });
            res.end(JSON.stringify({ success: true }));
        } catch(e) { res.writeHead(400); res.end(JSON.stringify({ error: 'Invalid request' })); }
        return;
    }

    // ===== GET AISLES =====
    if (p.pathname === '/aisles' && req.method === 'GET') {
        const storeId = p.query.storeId;
        const r = storeId
            ? await pool.query('SELECT * FROM aisles WHERE store_id=$1 ORDER BY sort_order ASC', [storeId])
            : await pool.query('SELECT * FROM aisles ORDER BY sort_order ASC');
        res.writeHead(200); res.end(JSON.stringify(r.rows.map(mapAisle)));
        return;
    }

    // ===== ADD AISLE =====
    if (p.pathname === '/aisles' && req.method === 'POST') {
        try {
            const b = await getBody(req);
            const r = await pool.query(
                `INSERT INTO aisles (store_id, name, sort_order, products)
                 VALUES ($1,$2,(SELECT COALESCE(MAX(sort_order),0)+1 FROM aisles WHERE store_id=$1),'[]') RETURNING *`,
                [b.storeId, b.name]
            );
            const aisle = mapAisle(r.rows[0]);
            broadcast('newAisle', aisle);
            res.writeHead(201); res.end(JSON.stringify(aisle));
        } catch(e) { res.writeHead(400); res.end(JSON.stringify({ error: 'Invalid request' })); }
        return;
    }

    // ===== GET FAVOURITES =====
    if (p.pathname === '/favourites' && req.method === 'GET') {
        const storeId = p.query.storeId;
        const r = storeId
            ? await pool.query('SELECT * FROM favourites WHERE store_id=$1 ORDER BY name ASC', [storeId])
            : await pool.query('SELECT * FROM favourites ORDER BY name ASC');
        res.writeHead(200); res.end(JSON.stringify(r.rows));
        return;
    }

    // ===== ADD FAVOURITE =====
    if (p.pathname === '/favourites' && req.method === 'POST') {
        try {
            const b = await getBody(req);
            const r = await pool.query(
                `INSERT INTO favourites (store_id, aisle_id, name)
                 VALUES ($1,$2,$3) ON CONFLICT (store_id, name) DO NOTHING RETURNING *`,
                [b.storeId, b.aisleId, b.name]
            );
            broadcast('newFavourite', r.rows[0] || { storeId: b.storeId, name: b.name });
            res.writeHead(201); res.end(JSON.stringify({ success: true }));
        } catch(e) { res.writeHead(400); res.end(JSON.stringify({ error: 'Invalid request' })); }
        return;
    }

    // ===== DELETE FAVOURITE =====
    const delFavMatch = p.pathname.match(/^\/favourites\/delete$/);
    if (delFavMatch && req.method === 'POST') {
        try {
            const b = await getBody(req);
            await pool.query('DELETE FROM favourites WHERE store_id=$1 AND name=$2', [b.storeId, b.name]);
            broadcast('deleteFavourite', { storeId: b.storeId, name: b.name });
            res.end(JSON.stringify({ success: true }));
        } catch(e) { res.writeHead(400); res.end(JSON.stringify({ error: 'Invalid request' })); }
        return;
    }

    // ===== REORDER AISLES =====
    if (p.pathname === '/aisles/reorder' && req.method === 'POST') {
        try {
            const b = await getBody(req);
            // b.order is array of { id, sortOrder }
            for (const item of b.order) {
                await pool.query('UPDATE aisles SET sort_order=$1 WHERE id=$2', [item.sortOrder, item.id]);
            }
            // Broadcast updated aisles
            const r = await pool.query('SELECT * FROM aisles ORDER BY sort_order ASC');
            r.rows.map(mapAisle).forEach(a => broadcast('updateAisle', a));
            res.end(JSON.stringify({ success: true }));
        } catch(e) { res.writeHead(400); res.end(JSON.stringify({ error: 'Invalid request' })); }
        return;
    }

    // ===== DELETE AISLE =====
    const delAisleMatch = p.pathname.match(/^\/aisles\/(\d+)\/delete$/);
    if (delAisleMatch && req.method === 'POST') {
        try {
            const id = parseInt(delAisleMatch[1]);
            await pool.query('DELETE FROM items WHERE aisle_id=$1', [id]);
            await pool.query('DELETE FROM aisles WHERE id=$1', [id]);
            broadcast('deleteAisle', { id });
            res.end(JSON.stringify({ success: true }));
        } catch(e) { res.writeHead(400); res.end(JSON.stringify({ error: 'Invalid request' })); }
        return;
    }

    // ===== RENAME AISLE =====
    const renameAisleMatch = p.pathname.match(/^\/aisles\/(\d+)\/rename$/);
    if (renameAisleMatch && req.method === 'POST') {
        try {
            const b = await getBody(req);
            const r = await pool.query('UPDATE aisles SET name=$1 WHERE id=$2 RETURNING *', [b.name, parseInt(renameAisleMatch[1])]);
            const aisle = mapAisle(r.rows[0]);
            broadcast('updateAisle', aisle);
            res.end(JSON.stringify(aisle));
        } catch(e) { res.writeHead(400); res.end(JSON.stringify({ error: 'Invalid request' })); }
        return;
    }

    // ===== ADD PRODUCT TO AISLE =====
    const addProductMatch = p.pathname.match(/^\/aisles\/(\d+)\/products$/);
    if (addProductMatch && req.method === 'POST') {
        try {
            const b = await getBody(req);
            const id = parseInt(addProductMatch[1]);
            const r = await pool.query('SELECT products FROM aisles WHERE id=$1', [id]);
            if (!r.rows.length) { res.writeHead(404); return res.end(JSON.stringify({ error: 'Not found' })); }
            const products = r.rows[0].products || [];
            if (!products.includes(b.name)) { products.push(b.name); products.sort((a, z) => a.localeCompare(z)); }
            const updated = await pool.query('UPDATE aisles SET products=$1 WHERE id=$2 RETURNING *', [JSON.stringify(products), id]);
            const aisle = mapAisle(updated.rows[0]);
            broadcast('updateAisle', aisle);
            res.end(JSON.stringify(aisle));
        } catch(e) { res.writeHead(400); res.end(JSON.stringify({ error: 'Invalid request' })); }
        return;
    }

    // ===== DELETE PRODUCT FROM AISLE =====
    const delProductMatch = p.pathname.match(/^\/aisles\/(\d+)\/products\/delete$/);
    if (delProductMatch && req.method === 'POST') {
        try {
            const b = await getBody(req);
            const id = parseInt(delProductMatch[1]);
            const r = await pool.query('SELECT products FROM aisles WHERE id=$1', [id]);
            if (!r.rows.length) { res.writeHead(404); return res.end(JSON.stringify({ error: 'Not found' })); }
            const products = (r.rows[0].products || []).filter(p => p !== b.name);
            const updated = await pool.query('UPDATE aisles SET products=$1 WHERE id=$2 RETURNING *', [JSON.stringify(products), id]);
            const aisle = mapAisle(updated.rows[0]);
            broadcast('updateAisle', aisle);
            res.end(JSON.stringify(aisle));
        } catch(e) { res.writeHead(400); res.end(JSON.stringify({ error: 'Invalid request' })); }
        return;
    }

    // ===== GET ITEMS =====
    if (p.pathname === '/items' && req.method === 'GET') {
        const storeId = p.query.storeId;
        const r = storeId
            ? await pool.query('SELECT * FROM items WHERE store_id=$1 ORDER BY added_at ASC', [storeId])
            : await pool.query('SELECT * FROM items ORDER BY added_at ASC');
        res.writeHead(200); res.end(JSON.stringify(r.rows.map(mapItem)));
        return;
    }

    // ===== ADD ITEM =====
    if (p.pathname === '/items' && req.method === 'POST') {
        try {
            const b = await getBody(req);
            const r = await pool.query(
                `INSERT INTO items (store_id, name, aisle_id, quantity, is_favourite)
                 VALUES ($1,$2,$3,$4,$5) RETURNING *`,
                [b.storeId, b.name, b.aisleId || null, b.quantity || 1, b.isFavourite || false]
            );
            const item = mapItem(r.rows[0]);
            broadcast('newItem', item);
            res.writeHead(201); res.end(JSON.stringify(item));
        } catch(e) { res.writeHead(400); res.end(JSON.stringify({ error: 'Invalid request' })); }
        return;
    }

    // ===== UPDATE QUANTITY =====
    const qtyMatch = p.pathname.match(/^\/items\/(\d+)\/quantity$/);
    if (qtyMatch && req.method === 'POST') {
        try {
            const b = await getBody(req);
            const r = await pool.query(
                'UPDATE items SET quantity=$1 WHERE id=$2 RETURNING *',
                [b.quantity, parseInt(qtyMatch[1])]
            );
            if (!r.rows.length) { res.writeHead(404); return res.end(JSON.stringify({ error: 'Not found' })); }
            const item = mapItem(r.rows[0]);
            broadcast('updateItem', item);
            res.end(JSON.stringify(item));
        } catch(e) { res.writeHead(400); res.end(JSON.stringify({ error: 'Invalid request' })); }
        return;
    }

    // ===== TOGGLE CHECKED =====
    const checkMatch = p.pathname.match(/^\/items\/(\d+)\/check$/);
    if (checkMatch && req.method === 'POST') {
        try {
            const r = await pool.query('UPDATE items SET is_checked=NOT is_checked WHERE id=$1 RETURNING *', [parseInt(checkMatch[1])]);
            if (!r.rows.length) { res.writeHead(404); return res.end(JSON.stringify({ error: 'Not found' })); }
            const item = mapItem(r.rows[0]);
            broadcast('updateItem', item);
            res.end(JSON.stringify(item));
        } catch(e) { res.writeHead(400); res.end(JSON.stringify({ error: 'Invalid request' })); }
        return;
    }

    // ===== TOGGLE FAVOURITE =====
    const favMatch = p.pathname.match(/^\/items\/(\d+)\/favourite$/);
    if (favMatch && req.method === 'POST') {
        try {
            const r = await pool.query('UPDATE items SET is_favourite=NOT is_favourite WHERE id=$1 RETURNING *', [parseInt(favMatch[1])]);
            if (!r.rows.length) { res.writeHead(404); return res.end(JSON.stringify({ error: 'Not found' })); }
            const item = mapItem(r.rows[0]);
            broadcast('updateItem', item);
            res.end(JSON.stringify(item));
        } catch(e) { res.writeHead(400); res.end(JSON.stringify({ error: 'Invalid request' })); }
        return;
    }

    // ===== DELETE ITEM =====
    const delMatch = p.pathname.match(/^\/items\/(\d+)\/delete$/);
    if (delMatch && req.method === 'POST') {
        try {
            await pool.query('DELETE FROM items WHERE id=$1', [parseInt(delMatch[1])]);
            broadcast('deleteItem', { id: parseInt(delMatch[1]) });
            res.end(JSON.stringify({ success: true }));
        } catch(e) { res.writeHead(400); res.end(JSON.stringify({ error: 'Invalid request' })); }
        return;
    }

    // ===== CLEAR CHECKED =====
    if (p.pathname === '/items/clear-checked' && req.method === 'POST') {
        try {
            const b = await getBody(req);
            const r = await pool.query('DELETE FROM items WHERE is_checked=true AND store_id=$1 RETURNING id', [b.storeId]);
            r.rows.forEach(row => broadcast('deleteItem', { id: row.id }));
            res.end(JSON.stringify({ deleted: r.rows.length }));
        } catch(e) { res.writeHead(400); res.end(JSON.stringify({ error: 'Invalid request' })); }
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
                path: `/products/search?query=${encodeURIComponent(query)}&store=${encodeURIComponent(store)}&limit=5`,
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
        } catch(e) { res.writeHead(500); res.end(JSON.stringify({ error: e.message })); }
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
