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

            // Respond immediately — don't wait for aisle seeding
            broadcastAll('newStore', store);
            res.writeHead(201);
            res.end(JSON.stringify(store));

            // Seed aisles for the requesting household
            const householdId = b.householdId;
            if (householdId) {
                setImmediate(async () => {
                    try {
                        for (const aisle of DEFAULT_AISLES) {
                            const ar = await pool.query(
                                'INSERT INTO aisles (household_id, store_id, name, sort_order, products) VALUES ($1,$2,$3,$4,$5) RETURNING *',
                                [householdId, store.id, aisle.name, aisle.sort_order, JSON.stringify(aisle.products)]
                            );
                            const row = ar.rows[0];
                            broadcastAll('newAisle', { id: row.id, householdId: row.household_id, storeId: row.store_id, name: row.name, sortOrder: row.sort_order, products: row.products || [] });
                        }
                        console.log(`Aisles seeded for store ${store.name} (household ${householdId})`);
                    } catch(e) { console.error('Background aisle seeding error:', e); }
                });
            }

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
