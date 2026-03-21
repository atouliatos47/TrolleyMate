// ===================================================
// routes/aisles.js — Aisles & Products
// ===================================================
module.exports = function(pool, broadcast, mapAisle, getBody) {

    async function getAll(req, res, p) {
        const householdId = parseInt(p.query.householdId);
        const storeId = p.query.storeId;
        if (!householdId) { res.writeHead(400); return res.end(JSON.stringify({ error: 'householdId required' })); }
        const r = storeId
            ? await pool.query('SELECT * FROM aisles WHERE household_id=$1 AND store_id=$2 ORDER BY sort_order ASC', [householdId, storeId])
            : await pool.query('SELECT * FROM aisles WHERE household_id=$1 ORDER BY sort_order ASC', [householdId]);
        res.writeHead(200);
        res.end(JSON.stringify(r.rows.map(mapAisle)));
    }

    async function add(req, res) {
        try {
            const b = await getBody(req);
            const householdId = parseInt(b.householdId);
            if (!householdId) { res.writeHead(400); return res.end(JSON.stringify({ error: 'householdId required' })); }
            const r = await pool.query(
                'INSERT INTO aisles (household_id, store_id, name, sort_order, products) VALUES ($1,$2,$3,$4,$5) RETURNING *',
                [householdId, b.storeId, b.name, b.sortOrder || 0, JSON.stringify([])]
            );
            const aisle = mapAisle(r.rows[0]);
            broadcast(householdId, 'newAisle', aisle);
            res.writeHead(201);
            res.end(JSON.stringify(aisle));
        } catch (e) { res.writeHead(400); res.end(JSON.stringify({ error: 'Invalid request' })); }
    }

    async function reorder(req, res) {
        try {
            const b = await getBody(req);
            const householdId = parseInt(b.householdId);
            if (!householdId) { res.writeHead(400); return res.end(JSON.stringify({ error: 'householdId required' })); }
            for (const item of b.order) {
                const id = item.id || item;
                const sortOrder = item.sortOrder !== undefined ? item.sortOrder : b.order.indexOf(item);
                await pool.query('UPDATE aisles SET sort_order=$1 WHERE id=$2 AND household_id=$3', [sortOrder, id, householdId]);
            }
            res.end(JSON.stringify({ success: true }));
        } catch (e) { res.writeHead(400); res.end(JSON.stringify({ error: 'Invalid request' })); }
    }

    async function remove(req, res, id) {
        try {
            const b = await getBody(req);
            const householdId = parseInt(b.householdId);
            await pool.query('DELETE FROM aisles WHERE id=$1 AND household_id=$2', [id, householdId]);
            broadcast(householdId, 'deleteAisle', { id });
            res.end(JSON.stringify({ success: true }));
        } catch (e) { res.writeHead(400); res.end(JSON.stringify({ error: 'Invalid request' })); }
    }

    async function addProduct(req, res, id) {
        try {
            const b = await getBody(req);
            const householdId = parseInt(b.householdId);
            const r = await pool.query('SELECT products FROM aisles WHERE id=$1 AND household_id=$2', [id, householdId]);
            if (!r.rows.length) { res.writeHead(404); return res.end(JSON.stringify({ error: 'Not found' })); }
            const products = r.rows[0].products || [];
            if (!products.includes(b.name)) { products.push(b.name); products.sort((a, z) => a.localeCompare(z)); }
            const updated = await pool.query('UPDATE aisles SET products=$1 WHERE id=$2 RETURNING *', [JSON.stringify(products), id]);
            const aisle = mapAisle(updated.rows[0]);
            broadcast(householdId, 'updateAisle', aisle);
            res.end(JSON.stringify(aisle));
        } catch (e) { res.writeHead(400); res.end(JSON.stringify({ error: 'Invalid request' })); }
    }

    async function deleteProduct(req, res, id) {
        try {
            const b = await getBody(req);
            const householdId = parseInt(b.householdId);
            const r = await pool.query('SELECT products FROM aisles WHERE id=$1 AND household_id=$2', [id, householdId]);
            if (!r.rows.length) { res.writeHead(404); return res.end(JSON.stringify({ error: 'Not found' })); }
            const products = (r.rows[0].products || []).filter(pr => pr !== b.name);
            const updated = await pool.query('UPDATE aisles SET products=$1 WHERE id=$2 RETURNING *', [JSON.stringify(products), id]);
            const aisle = mapAisle(updated.rows[0]);
            broadcast(householdId, 'updateAisle', aisle);
            res.end(JSON.stringify(aisle));
        } catch (e) { res.writeHead(400); res.end(JSON.stringify({ error: 'Invalid request' })); }
    }

    return { getAll, add, reorder, remove, addProduct, deleteProduct };
};
