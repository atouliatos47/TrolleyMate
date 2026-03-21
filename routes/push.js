// ===================================================
// routes/push.js — Push notifications
// ===================================================
module.exports = function(pool, getBody) {

    async function getVapidKey(req, res) {
        res.writeHead(200);
        res.end(JSON.stringify({ publicKey: process.env.VAPID_PUBLIC_KEY }));
    }

    async function subscribe(req, res) {
        try {
            const b = await getBody(req);
            const householdId = parseInt(b.householdId);
            if (!householdId) { res.writeHead(400); return res.end(JSON.stringify({ error: 'householdId required' })); }
            await pool.query(
                `INSERT INTO push_subscriptions (household_id, endpoint, subscription)
                 VALUES ($1,$2,$3)
                 ON CONFLICT (endpoint) DO UPDATE SET subscription=$3, household_id=$1`,
                [householdId, b.subscription.endpoint, JSON.stringify(b.subscription)]
            );
            res.writeHead(201);
            res.end(JSON.stringify({ success: true }));
        } catch (e) {
            console.error('Subscribe error:', e);
            res.writeHead(500);
            res.end(JSON.stringify({ error: 'Failed to subscribe' }));
        }
    }

    async function shoppingStatus(req, res) {
        try {
            const b = await getBody(req);
            if (!b.endpoint) { res.writeHead(400); return res.end(JSON.stringify({ error: 'endpoint required' })); }
            await pool.query(
                'UPDATE push_subscriptions SET shopping_active=$1 WHERE endpoint=$2',
                [b.active === true, b.endpoint]
            );
            res.end(JSON.stringify({ success: true }));
        } catch (e) {
            res.writeHead(500);
            res.end(JSON.stringify({ error: 'Failed to update status' }));
        }
    }

    return { getVapidKey, subscribe, shoppingStatus };
};
