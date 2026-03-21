// ===================================================
// routes/stores.js — Get, Add, Delete stores
// ===================================================
module.exports = function(pool, clients, mapStore, getBody, DEFAULT_AISLES) {

    function broadcastAll(event, data) {
        const msg = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
        clients.forEach((clientSet) => clientSet.forEach(r => r.write(msg)));
    }

    async function getAll(req, res) {
        const r = await pool.query('SELECT * FROM stores ORDER BY sort_order ASC');
        res.writeHead(200);
        res.end(JSON.stringify(r.rows.map(mapStore)));
    }

    async function add(req, res) {
        try {
            const b = await getBody(req);
            if (!b.name) { res.writeHead(400); return res.end(JSON.stringify({ error: 'Name required' })); }
            const countR = await pool.query('SELECT COUNT(*) FROM stores');
            const sortOrder = parseInt(countR.rows[0].count) + 1;
            const r = await pool.query(
                'INSERT INTO stores (name, color, emoji, sort_order) VALUES ($1,$2,$3,$4) RETURNING *',
                [b.name, b.color || '#005EA5', b.emoji || '🏪', sortOrder]
            );
            const store = mapStore(r.rows[0]);
            // Seed aisles for this new store for all existing households
            const households = await pool.query('SELECT id FROM households');
            for (const h of households.rows) {
                for (const aisle of DEFAULT_AISLES) {
                    await pool.query(
                        'INSERT INTO aisles (household_id, store_id, name, sort_order, products) VALUES ($1,$2,$3,$4,$5)',
                        [h.id, store.id, aisle.name, aisle.sort_order, JSON.stringify(aisle.products)]
                    );
                }
            }
            broadcastAll('newStore', store);
            res.writeHead(201);
            res.end(JSON.stringify(store));
        } catch (e) {
            console.error('Add store error:', e);
            res.writeHead(400);
            res.end(JSON.stringify({ error: 'Failed to add store' }));
        }
    }

    async function remove(req, res, id) {
        try {
            await pool.query('DELETE FROM stores WHERE id=$1', [id]);
            broadcastAll('deleteStore', { id });
            res.end(JSON.stringify({ success: true }));
        } catch (e) {
            res.writeHead(400);
            res.end(JSON.stringify({ error: 'Failed to delete store' }));
        }
    }

    return { getAll, add, remove };
};
