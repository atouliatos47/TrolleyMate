// ===================================================
// shopping.js — Shopping mode, toggle items
// ===================================================
Object.assign(App, {

    async setShoppingStatus(active) {
        try {
            const reg = await navigator.serviceWorker.ready;
            const sub = await reg.pushManager.getSubscription();
            if (!sub) return;
            await fetch('/push/shopping-status', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ endpoint: sub.endpoint, active })
            });
        } catch(e) {}
    },

    openShoppingMode() { this.enterShoppingMode(); },

    enterShoppingMode() {
        const overlay = document.getElementById('shoppingModeOverlay');
        if (!overlay) return;
        overlay.classList.remove('hidden');
        const title = document.getElementById('shoppingModeTitle');
        const stats = document.getElementById('shoppingModeStats');
        if (title) title.textContent = 'All Shopping Lists';
        const totalItems = API.items.filter(i => !i.isChecked).length;
        if (stats) stats.textContent = `${totalItems} item${totalItems !== 1 ? 's' : ''}`;
        this.renderShoppingModeList();
        UI.closeAislePanel();
        UI.lastAislePanel = null;
        this.setShoppingStatus(true);
    },

    closeShoppingMode() {
        const overlay = document.getElementById('shoppingModeOverlay');
        if (overlay) overlay.classList.add('hidden');
        this.setShoppingStatus(false);
    },

    renderShoppingModeList() {
        const container = document.getElementById('shoppingModeList');
        if (!container) return;

        const allItems = API.items.filter(i => !i.isChecked);
        if (!allItems.length) {
            container.innerHTML = `<div style="text-align:center;padding:40px 20px;color:#9ca3af;">
                <div style="font-size:48px;margin-bottom:12px;">✅</div>
                <p>All done! Your list is empty.</p>
            </div>`;
            return;
        }

        const storeGroups = {};
        allItems.forEach(item => {
            if (!storeGroups[item.storeId]) storeGroups[item.storeId] = [];
            storeGroups[item.storeId].push(item);
        });

        let html = '';

        API.stores.forEach(store => {
            const storeItems = storeGroups[store.id];
            if (!storeItems || !storeItems.length) return;

            const logoDomain = UI.getStoreLogo(store.name);
            html += `<div class="shop-store-header" style="background:${store.color};">
                <div style="display:flex;align-items:center;gap:10px;">
                    ${logoDomain ? `<img src="https://www.google.com/s2/favicons?domain=${logoDomain}&sz=64"
                        onerror="this.style.display='none'"
                        style="width:24px;height:24px;border-radius:4px;background:white;padding:2px;object-fit:contain;">` : ''}
                    <span style="font-size:16px;font-weight:700;color:white;">${Utils.escapeHtml(store.name)}</span>
                    <span style="font-size:13px;color:rgba(255,255,255,0.75);margin-left:auto;">${storeItems.length} item${storeItems.length > 1 ? 's' : ''}</span>
                </div>
            </div>`;

            const grouped = {};
            const noAisle = [];
            storeItems.forEach(item => {
                if (item.aisleId) {
                    if (!grouped[item.aisleId]) grouped[item.aisleId] = [];
                    grouped[item.aisleId].push(item);
                } else {
                    noAisle.push(item);
                }
            });

            const storeAisles = API.aisles
                .filter(a => a.storeId === store.id && grouped[a.id])
                .sort((a, b) => a.sortOrder - b.sortOrder);

            storeAisles.forEach(aisle => {
                html += `<div class="shop-aisle-group">
                    <div class="shop-aisle-header">${Utils.escapeHtml(aisle.name)}</div>
                    ${grouped[aisle.id].sort((a,b) => a.name.localeCompare(b.name)).map(item => this.renderShopItem(item)).join('')}
                </div>`;
            });

            if (noAisle.length) {
                html += `<div class="shop-aisle-group">
                    <div class="shop-aisle-header">Other</div>
                    ${noAisle.sort((a,b) => a.name.localeCompare(b.name)).map(item => this.renderShopItem(item)).join('')}
                </div>`;
            }
        });

        container.innerHTML = html;
    },

    renderShopItem(item) {
        return `<div class="shop-item ${item.isChecked ? 'checked' : ''}" onclick="App.toggleShopItem(${item.id})">
            <span class="shop-item-name ${item.isChecked ? 'crossed' : ''}">${Utils.escapeHtml(item.name)}</span>
            ${item.quantity > 1 ? `<span class="shop-qty-badge">x${item.quantity}</span>` : ''}
            ${item.isChecked ? '<span class="shop-done-badge">✓</span>' : ''}
        </div>`;
    },

    playPing() {
        try {
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            if (!AudioContext) return;
            const ctx = new AudioContext();
            const play = () => {
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();
                osc.connect(gain);
                gain.connect(ctx.destination);
                osc.type = 'sine';
                osc.frequency.setValueAtTime(880, ctx.currentTime);
                osc.frequency.exponentialRampToValueAtTime(1200, ctx.currentTime + 0.1);
                gain.gain.setValueAtTime(0.4, ctx.currentTime);
                gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
                osc.start(ctx.currentTime);
                osc.stop(ctx.currentTime + 0.4);
            };
            if (ctx.state === 'suspended') { ctx.resume().then(play); } else { play(); }
        } catch(e) {}
    },

    async toggleShopItem(id) {
        try {
            const result = await API.toggleCheck(id);
            if (result && result.isChecked) {
                this.playPing();
                const idx = API.items.findIndex(i => i.id === id);
                if (idx !== -1) API.items[idx].isChecked = true;
                this.renderShoppingModeList();
                setTimeout(async () => {
                    try { await API.deleteItem(id); } catch(e) {}
                    API.items = API.items.filter(i => i.id !== id);
                    this.renderShoppingModeList();
                }, 700);
            } else {
                this.renderShoppingModeList();
            }
        } catch(e) { console.log('toggleShopItem error:', e); }
    }
});
