// ===================================================
// routes/households.js — Create & Join households
// ===================================================
module.exports = function(pool, generateCode, seedAisles, getBody) {

    async function create(req, res) {
        try {
            let code, exists = true;
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
    }

    async function join(req, res) {
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
    }

    return { create, join };
};
