// ===================================================
// routes/items.js — Items CRUD
// ===================================================
module.exports = function(pool, broadcast, mapItem, getBody, webpush) {

    async function getAll(req, res, p) {
        const householdId = parseInt(p.query.householdId);
        const storeId = p.query.storeId;
        if (!householdId) { res.writeHead(400); return res.end(JSON.stringify({ error: 'householdId required' })); }
        const r = storeId
            ? await pool.query('SELECT * FROM items WHERE household_id=$1 AND store_id=$2 ORDER BY added_at ASC', [householdId, storeId])
            : await pool.query('SELECT * FROM items WHERE household_id=$1 ORDER BY added_at ASC', [householdId]);
        res.writeHead(200);
        res.end(JSON.stringify(r.rows.map(mapItem)));
    }

    async function add(req, res) {
        try {
            const b = await getBody(req);
            const householdId = parseInt(b.householdId);
            if (!householdId) { res.writeHead(400); return res.end(JSON.stringify({ error: 'householdId required' })); }
            const addedBy = b.addedBy || 'Someone';
            const r = await pool.query(
                `INSERT INTO items (household_id, store_id, name, aisle_id, quantity, is_favourite, added_by)
                 VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
                [householdId, b.storeId, b.name, b.aisleId || null, b.quantity || 1, b.isFavourite || false, addedBy]
            );
            const item = mapItem(r.rows[0]);
            broadcast(householdId, 'newItem', item);

            // Push notification to active shoppers
            const store = (await pool.query('SELECT name FROM stores WHERE id=$1', [b.storeId])).rows[0];
            const storeName = store ? store.name : 'your list';
            const subs = await pool.query(
                'SELECT subscription FROM push_subscriptions WHERE household_id=$1 AND endpoint != $2 AND shopping_active=true',
                [householdId, b.senderEndpoint || '']
            );
            const payload = JSON.stringify({
                title: `${addedBy} added to ${storeName} 🛒`,
                body: `${addedBy} added ${b.name} to the shopping list`,
                icon: '/img/icon-192.png'
            });
            subs.rows.forEach(row => {
                webpush.sendNotification(row.subscription, payload).catch(err => {
                    if (err.statusCode === 410) {
                        pool.query('DELETE FROM push_subscriptions WHERE endpoint=$1', [row.subscription.endpoint]).catch(() => {});
                    }
                });
            });

            res.writeHead(201);
            res.end(JSON.stringify(item));
        } catch (e) { res.writeHead(400); res.end(JSON.stringify({ error: 'Invalid request' })); }
    }

    async function updateQuantity(req, res, id) {
        try {
            const b = await getBody(req);
            const householdId = parseInt(b.householdId);
            const r = await pool.query(
                'UPDATE items SET quantity=$1 WHERE id=$2 AND household_id=$3 RETURNING *',
                [b.quantity, id, householdId]
            );
            if (!r.rows.length) { res.writeHead(404); return res.end(JSON.stringify({ error: 'Not found' })); }
            const item = mapItem(r.rows[0]);
            broadcast(householdId, 'updateItem', item);
            res.end(JSON.stringify(item));
        } catch (e) { res.writeHead(400); res.end(JSON.stringify({ error: 'Invalid request' })); }
    }

    async function toggleCheck(req, res, id) {
        try {
            const b = await getBody(req);
            const householdId = parseInt(b.householdId);
            const r = await pool.query(
                'UPDATE items SET is_checked=NOT is_checked WHERE id=$1 AND household_id=$2 RETURNING *',
                [id, householdId]
            );
            if (!r.rows.length) { res.writeHead(404); return res.end(JSON.stringify({ error: 'Not found' })); }
            const item = mapItem(r.rows[0]);
            broadcast(householdId, 'updateItem', item);
            res.end(JSON.stringify(item));
        } catch (e) { res.writeHead(400); res.end(JSON.stringify({ error: 'Invalid request' })); }
    }

    async function toggleFavourite(req, res, id) {
        try {
            const b = await getBody(req);
            const householdId = parseInt(b.householdId);
            const r = await pool.query(
                'UPDATE items SET is_favourite=NOT is_favourite WHERE id=$1 AND household_id=$2 RETURNING *',
                [id, householdId]
            );
            if (!r.rows.length) { res.writeHead(404); return res.end(JSON.stringify({ error: 'Not found' })); }
            const item = mapItem(r.rows[0]);
            broadcast(householdId, 'updateItem', item);
            res.end(JSON.stringify(item));
        } catch (e) { res.writeHead(400); res.end(JSON.stringify({ error: 'Invalid request' })); }
    }

    async function remove(req, res, id) {
        try {
            const b = await getBody(req);
            const householdId = parseInt(b.householdId);
            await pool.query('DELETE FROM items WHERE id=$1 AND household_id=$2', [id, householdId]);
            broadcast(householdId, 'deleteItem', { id });
            res.end(JSON.stringify({ success: true }));
        } catch (e) { res.writeHead(400); res.end(JSON.stringify({ error: 'Invalid request' })); }
    }

    async function clearChecked(req, res) {
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
    }

    return { getAll, add, updateQuantity, toggleCheck, toggleFavourite, remove, clearChecked };
};
