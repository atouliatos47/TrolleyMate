// ===================================================
// routes/favourites.js — Favourites
// ===================================================
module.exports = function(pool, broadcast, getBody) {

    async function getAll(req, res, p) {
        const householdId = parseInt(p.query.householdId);
        if (!householdId) { res.writeHead(400); return res.end(JSON.stringify({ error: 'householdId required' })); }
        const r = await pool.query('SELECT * FROM favourites WHERE household_id=$1 ORDER BY name ASC', [householdId]);
        res.writeHead(200);
        res.end(JSON.stringify(r.rows));
    }

    async function add(req, res) {
        try {
            const b = await getBody(req);
            const householdId = parseInt(b.householdId);
            if (!householdId) { res.writeHead(400); return res.end(JSON.stringify({ error: 'householdId required' })); }
            const existing = await pool.query(
                'SELECT id FROM favourites WHERE household_id=$1 AND store_id=$2 AND name=$3',
                [householdId, b.storeId, b.name]
            );
            if (existing.rows.length > 0) {
                res.writeHead(201);
                return res.end(JSON.stringify(existing.rows[0]));
            }
            const r = await pool.query(
                'INSERT INTO favourites (household_id, store_id, aisle_id, name) VALUES ($1,$2,$3,$4) RETURNING *',
                [householdId, b.storeId, b.aisleId || null, b.name]
            );
            const fav = r.rows[0] || {};
            broadcast(householdId, 'newFavourite', fav);
            res.writeHead(201);
            res.end(JSON.stringify(fav));
        } catch (e) {
            console.error('Add favourite error:', e);
            res.writeHead(400);
            res.end(JSON.stringify({ error: e.message }));
        }
    }

    async function remove(req, res) {
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
    }

    return { getAll, add, remove };
};
