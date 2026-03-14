const http = require('http');
const fs = require('fs').promises;
const path = require('path');
const url = require('url');
const { Pool } = require('pg');

const PORT = process.env.PORT || 3000;
const APP_DIR = __dirname;

// ===== DATABASE =====
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function initDb() {
    await pool.query(`
        CREATE TABLE IF NOT EXISTS aisles (
            id SERIAL PRIMARY KEY,
            name TEXT NOT NULL,
            sort_order INTEGER NOT NULL
        )
    `);
    await pool.query(`
        CREATE TABLE IF NOT EXISTS items (
            id SERIAL PRIMARY KEY,
            name TEXT NOT NULL,
            aisle_id INTEGER REFERENCES aisles(id) ON DELETE SET NULL,
            quantity INTEGER NOT NULL DEFAULT 1,
            is_favourite BOOLEAN NOT NULL DEFAULT false,
            is_checked BOOLEAN NOT NULL DEFAULT false,
            added_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
    `);

    // Seed aisles if empty
    const { rows } = await pool.query('SELECT COUNT(*) FROM aisles');
    if (parseInt(rows[0].count) === 0) {
        const aisles = [
            'Fresh Fruit & Veg',
            'Bakery',
            'Meat & Poultry',
            'Fish & Seafood',
            'Dairy & Eggs',
            'Deli & Cheese',
            'Frozen Food',
            'Breakfast & Cereals',
            'Tins, Cans & Packets',
            'Pasta, Rice & Noodles',
            'Sauces, Oils & Condiments',
            'Biscuits & Snacks',
            'Confectionery & Sweets',
            'Soft Drinks & Juice',
            'Tea, Coffee & Hot Drinks',
            'Alcohol & Beer',
            'Toiletries & Personal Care',
            'Cleaning & Household',
            'Baby & Toddler',
            'World Foods',
            'Health & Beauty'
        ];
        for (let i = 0; i < aisles.length; i++) {
            await pool.query(
                'INSERT INTO aisles (name, sort_order) VALUES ($1, $2)',
                [aisles[i], i + 1]
            );
        }
        console.log('Aisles seeded!');
    }

    console.log('Database ready');
}

// ===== SSE =====
const clients = new Set();

function broadcast(event, data) {
    const msg = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
    clients.forEach(res => res.write(msg));
}

// ===== HELPERS =====
function mapItem(row) {
    return {
        id:          row.id,
        name:        row.name,
        aisleId:     row.aisle_id,
        quantity:    row.quantity,
        isFavourite: row.is_favourite,
        isChecked:   row.is_checked,
        addedAt:     row.added_at
    };
}

function mapAisle(row) {
    return { id: row.id, name: row.name, sortOrder: row.sort_order };
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
            'Content-Type':  'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection':    'keep-alive'
        });
        try {
            const [ir, ar] = await Promise.all([
                pool.query('SELECT * FROM items ORDER BY added_at ASC'),
                pool.query('SELECT * FROM aisles ORDER BY sort_order ASC')
            ]);
            res.write(`event: init\ndata: ${JSON.stringify({
                items:  ir.rows.map(mapItem),
                aisles: ar.rows.map(mapAisle)
            })}\n\n`);
        } catch (e) {
            console.error('SSE init error:', e);
        }
        clients.add(res);
        req.on('close', () => clients.delete(res));
        return;
    }

    // ===== GET AISLES =====
    if (p.pathname === '/aisles' && req.method === 'GET') {
        const r = await pool.query('SELECT * FROM aisles ORDER BY sort_order ASC');
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(r.rows.map(mapAisle)));
        return;
    }

    // ===== GET ITEMS =====
    if (p.pathname === '/items' && req.method === 'GET') {
        const r = await pool.query('SELECT * FROM items ORDER BY added_at ASC');
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(r.rows.map(mapItem)));
        return;
    }

    // ===== ADD ITEM =====
    if (p.pathname === '/items' && req.method === 'POST') {
        try {
            const b = await getBody(req);
            const r = await pool.query(
                `INSERT INTO items (name, aisle_id, quantity, is_favourite)
                 VALUES ($1, $2, $3, $4) RETURNING *`,
                [b.name, b.aisleId || null, b.quantity || 1, b.isFavourite || false]
            );
            const item = mapItem(r.rows[0]);
            broadcast('newItem', item);
            res.writeHead(201, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(item));
        } catch (e) { res.writeHead(400); res.end(JSON.stringify({ error: 'Invalid request' })); }
        return;
    }

    // ===== TOGGLE CHECKED =====
    const checkMatch = p.pathname.match(/^\/items\/(\d+)\/check$/);
    if (checkMatch && req.method === 'POST') {
        try {
            const r = await pool.query(
                `UPDATE items SET is_checked = NOT is_checked WHERE id=$1 RETURNING *`,
                [parseInt(checkMatch[1])]
            );
            if (!r.rows.length) { res.writeHead(404); return res.end(JSON.stringify({ error: 'Not found' })); }
            const item = mapItem(r.rows[0]);
            broadcast('updateItem', item);
            res.end(JSON.stringify(item));
        } catch (e) { res.writeHead(400); res.end(JSON.stringify({ error: 'Invalid request' })); }
        return;
    }

    // ===== TOGGLE FAVOURITE =====
    const favMatch = p.pathname.match(/^\/items\/(\d+)\/favourite$/);
    if (favMatch && req.method === 'POST') {
        try {
            const r = await pool.query(
                `UPDATE items SET is_favourite = NOT is_favourite WHERE id=$1 RETURNING *`,
                [parseInt(favMatch[1])]
            );
            if (!r.rows.length) { res.writeHead(404); return res.end(JSON.stringify({ error: 'Not found' })); }
            const item = mapItem(r.rows[0]);
            broadcast('updateItem', item);
            res.end(JSON.stringify(item));
        } catch (e) { res.writeHead(400); res.end(JSON.stringify({ error: 'Invalid request' })); }
        return;
    }

    // ===== DELETE ITEM =====
    const delMatch = p.pathname.match(/^\/items\/(\d+)\/delete$/);
    if (delMatch && req.method === 'POST') {
        try {
            await pool.query('DELETE FROM items WHERE id=$1', [parseInt(delMatch[1])]);
            broadcast('deleteItem', { id: parseInt(delMatch[1]) });
            res.end(JSON.stringify({ success: true }));
        } catch (e) { res.writeHead(400); res.end(JSON.stringify({ error: 'Invalid request' })); }
        return;
    }

    // ===== CLEAR CHECKED ITEMS =====
    if (p.pathname === '/items/clear-checked' && req.method === 'POST') {
        try {
            const r = await pool.query('DELETE FROM items WHERE is_checked=true RETURNING id');
            r.rows.forEach(row => broadcast('deleteItem', { id: row.id }));
            res.end(JSON.stringify({ deleted: r.rows.length }));
        } catch (e) { res.writeHead(400); res.end(JSON.stringify({ error: 'Invalid request' })); }
        return;
    }

    res.writeHead(404);
    res.end(JSON.stringify({ error: 'Not found' }));
});

initDb().then(() => {
    server.listen(PORT, () => console.log(`TrolleyMate running on port ${PORT}`));
}).catch(err => {
    console.error('DB init failed:', err);
    process.exit(1);
});
