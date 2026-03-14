const App = {
    wakeLock: null,

    async requestWakeLock() {
        try {
            if ('wakeLock' in navigator) {
                this.wakeLock = await navigator.wakeLock.request('screen');
                console.log('Screen wake lock active');
                // Re-acquire if tab becomes visible again
                document.addEventListener('visibilitychange', async () => {
                    if (document.visibilityState === 'visible' && this.wakeLock === null) {
                        await this.requestWakeLock();
                    }
                });
            }
        } catch(e) {
            console.log('Wake lock not available:', e);
        }
    },

    async releaseWakeLock() {
        try {
            if (this.wakeLock) {
                await this.wakeLock.release();
                this.wakeLock = null;
                console.log('Screen wake lock released');
            }
        } catch(e) {
            console.log('Wake lock release error:', e);
        }
    },

    init() {
        console.log('TrolleyMate initializing...');
        this.setupEventListeners();
        API.connectSSE();
        API.startKeepAlive();
    },

    setupEventListeners() {
        document.getElementById('modalOverlay').addEventListener('click', (e) => {
            if (e.target === document.getElementById('modalOverlay')) Utils.closeModal();
        });
    },

    // ===== SMART HOME BUTTON =====
    smartHome() {
        // If aisle panel is open -> close it, stay in store
        const aislePanel = document.getElementById('aislePanelOverlay');
        if (aislePanel.classList.contains('show')) {
            UI.closeAislePanel();
            return;
        }
        // If shopping mode is open -> close it, stay in store
        const shopMode = document.getElementById('shoppingModeOverlay');
        if (!shopMode.classList.contains('hidden')) {
            this.closeShoppingMode();
            return;
        }
        // If in a store -> go to home screen
        if (API.currentStoreId) {
            this.goHome();
            return;
        }
        // Already on home screen -> do nothing
    },

    // ===== STORE SELECTION =====
    enterStore(storeId) {
        const store = API.stores.find(s => s.id === storeId);
        if (!store) return;

        API.currentStoreId = storeId;

        // Apply store theme colour
        document.documentElement.style.setProperty('--store-color', store.color);
        document.documentElement.style.setProperty('--store-color-dark', App.darken(store.color));

        // Update header with logo
        const logoDomain = UI.getStoreLogo(store.name);
        const storeTitle = document.getElementById('storeTitle');
        if (logoDomain) {
            storeTitle.innerHTML = `
                <img src="https://www.google.com/s2/favicons?domain=${logoDomain}&sz=128"
                    alt="${store.name}"
                    onerror="this.style.display='none'"
                    style="width:28px;height:28px;object-fit:contain;border-radius:6px;background:white;padding:2px;vertical-align:middle;margin-right:8px;">
                ${store.name}`;
        } else {
            storeTitle.textContent = store.name;
        }

        // Show store view, hide home
        document.getElementById('homeScreen').classList.add('hidden');
        document.getElementById('storeScreen').classList.remove('hidden');

        // Switch nav
        document.getElementById('navHomeScreen').classList.add('hidden');
        document.getElementById('navStoreScreen').classList.remove('hidden');

        // Render store content
        UI.renderAisles();
        UI.renderList();
        UI.renderStats();
    },

    goHome() {
        API.currentStoreId = null;
        document.getElementById('aislePanelOverlay').classList.remove('show');
        document.getElementById('shoppingModeOverlay').classList.add('hidden');
        document.getElementById('storeScreen').classList.add('hidden');
        document.getElementById('homeScreen').classList.remove('hidden');
        // Switch nav back
        document.getElementById('navStoreScreen').classList.add('hidden');
        document.getElementById('navHomeScreen').classList.remove('hidden');
        UI.renderHome();
    },

    // ===== SHOPPING MODE =====
    openShoppingMode() {
        const store = API.stores.find(s => s.id === API.currentStoreId);
        if (!store) return;
        const logoDomain = UI.getStoreLogo(store.name);
        const titleEl = document.getElementById('shoppingModeTitle');
        if (logoDomain) {
            titleEl.innerHTML = `
                <img src="https://www.google.com/s2/favicons?domain=${logoDomain}&sz=128"
                    alt="${store.name}"
                    onerror="this.style.display='none'"
                    style="width:26px;height:26px;object-fit:contain;border-radius:6px;background:white;padding:2px;vertical-align:middle;margin-right:8px;">
                ${store.name}`;
        } else {
            titleEl.textContent = store.name;
        }
        document.getElementById('shoppingModeOverlay').classList.remove('hidden');
        // Hide My List button — home button handles going back
        document.getElementById('navBtnShop').classList.add('hidden');
        // Keep screen awake while shopping
        this.requestWakeLock();
        this.renderShoppingModeList();
    },

    closeShoppingMode() {
        document.getElementById('shoppingModeOverlay').classList.add('hidden');
        // Restore My List button
        document.getElementById('navBtnShop').classList.remove('hidden');
        // Release wake lock
        this.releaseWakeLock();
    },

    renderShoppingModeList() {
        const container = document.getElementById('shoppingModeList');
        const items = API.storeItems;
        const stats = document.getElementById('shoppingModeStats');

        const total = items.length;
        const checked = items.filter(i => i.isChecked).length;
        if (stats) stats.textContent = `${checked} of ${total} collected`;

        if (!items.length) {
            container.innerHTML = `<div class="empty-state"><div class="empty-icon">🛒</div><p>Your list is empty!</p><p class="empty-sub">Add products from the aisles first.</p></div>`;
            return;
        }

        // Group by aisle
        const grouped = {};
        const noAisle = [];
        items.forEach(item => {
            if (!item.aisleId) { noAisle.push(item); return; }
            if (!grouped[item.aisleId]) grouped[item.aisleId] = [];
            grouped[item.aisleId].push(item);
        });

        const sortedAisles = API.storeAisles.filter(a => grouped[a.id]).sort((a, b) => a.sortOrder - b.sortOrder);
        let html = '';

        sortedAisles.forEach(aisle => {
            html += `<div class="shop-aisle-group">
                <div class="shop-aisle-header">${Utils.escapeHtml(aisle.name)}</div>
                ${grouped[aisle.id].map(item => this.renderShopItem(item)).join('')}
            </div>`;
        });

        if (noAisle.length) {
            html += `<div class="shop-aisle-group">
                <div class="shop-aisle-header">Other</div>
                ${noAisle.map(item => this.renderShopItem(item)).join('')}
            </div>`;
        }

        container.innerHTML = html;
    },

    renderShopItem(item) {
        return `
            <div class="shop-item ${item.isChecked ? 'checked' : ''}" onclick="App.toggleShopItem(${item.id})">
                <span class="shop-item-name ${item.isChecked ? 'crossed' : ''}">${Utils.escapeHtml(item.name)}</span>
                ${item.quantity > 1 ? `<span class="shop-qty-badge">x${item.quantity}</span>` : ''}
                ${item.isChecked ? '<span class="shop-done-badge">✓</span>' : ''}
            </div>`;
    },

    async toggleShopItem(id) {
        try {
            await API.toggleCheck(id);
            const item = API.items.find(i => i.id === id);
            if (item && item.isChecked) {
                setTimeout(async () => {
                    try { await API.deleteItem(id); } catch(e) {}
                    this.renderShoppingModeList();
                }, 600);
            } else {
                this.renderShoppingModeList();
            }
        } catch(e) { Utils.showToast('Failed to update', true); }
    },

    // ===== ADD STORE =====
    showAddStore() {
        const modal = document.getElementById('modal');
        const overlay = document.getElementById('modalOverlay');

        const colours = [
            { name: 'Tesco Blue',    hex: '#005EA5' },
            { name: 'Iceland Red',   hex: '#D61F26' },
            { name: 'Lidl Blue',     hex: '#0050AA' },
            { name: 'Sainsburys',    hex: '#F47920' },
            { name: 'B&M Purple',    hex: '#6B2D8B' },
            { name: 'Green',         hex: '#16a34a' },
            { name: 'Dark',          hex: '#1a1a2e' },
        ];

        modal.innerHTML = `
            <h3>🏪 Add New Store</h3>
            <p class="modal-sub">Add a supermarket or shop</p>
            <div style="display:flex;flex-direction:column;gap:12px;margin-top:14px;">
                <div>
                    <label style="font-size:12px;font-weight:600;color:#6b7280;text-transform:uppercase;">Store Name</label>
                    <input type="text" id="newStoreName" placeholder="e.g. Aldi, Asda, Co-op..."
                        style="width:100%;margin-top:6px;padding:12px 14px;border:1.5px solid #e5e7eb;border-radius:10px;font-size:16px;outline:none;">
                </div>
                <div>
                    <label style="font-size:12px;font-weight:600;color:#6b7280;text-transform:uppercase;">Emoji</label>
                    <input type="text" id="newStoreEmoji" placeholder="🏪" maxlength="2"
                        style="width:100%;margin-top:6px;padding:12px 14px;border:1.5px solid #e5e7eb;border-radius:10px;font-size:20px;outline:none;">
                </div>
                <div>
                    <label style="font-size:12px;font-weight:600;color:#6b7280;text-transform:uppercase;">Colour</label>
                    <div style="display:flex;flex-wrap:wrap;gap:8px;margin-top:8px;">
                        ${colours.map(c => `
                            <div class="colour-swatch" data-hex="${c.hex}"
                                onclick="App.selectStoreColour('${c.hex}')"
                                style="width:36px;height:36px;border-radius:50%;background:${c.hex};cursor:pointer;border:3px solid transparent;"
                                title="${c.name}"></div>
                        `).join('')}
                    </div>
                    <input type="hidden" id="newStoreColour" value="#005EA5">
                </div>
            </div>
            <div class="modal-actions">
                <button class="modal-btn cancel" onclick="Utils.closeModal()">Cancel</button>
                <button class="modal-btn confirm" onclick="App.saveNewStore()">Add Store</button>
            </div>`;

        overlay.classList.add('show');
        setTimeout(() => document.getElementById('newStoreName').focus(), 100);
        // Pre-select first colour
        App.selectStoreColour('#005EA5');
    },

    selectStoreColour(hex) {
        document.getElementById('newStoreColour').value = hex;
        document.querySelectorAll('.colour-swatch').forEach(el => {
            el.style.border = el.dataset.hex === hex ? '3px solid #1a1a2e' : '3px solid transparent';
        });
    },

    async saveNewStore() {
        const name  = document.getElementById('newStoreName').value.trim();
        const emoji = document.getElementById('newStoreEmoji').value.trim() || '🏪';
        const color = document.getElementById('newStoreColour').value;
        if (!name) { Utils.shakeElement(document.getElementById('newStoreName')); return; }
        try {
            await API.addStore({ name, emoji, color });
            Utils.closeModal();
            Utils.showToast(`${emoji} ${name} added!`);
        } catch(e) { Utils.showToast('Failed to add store', true); }
    },

    // ===== DELETE STORE =====
    confirmDeleteStore(storeId) {
        const store = API.stores.find(s => s.id === storeId);
        if (!store) return;
        const modal = document.getElementById('modal');
        const overlay = document.getElementById('modalOverlay');
        modal.innerHTML = `
            <h3>🗑 Delete Store</h3>
            <p class="modal-sub">Delete <strong>${Utils.escapeHtml(store.name)}</strong>? All its aisles and shopping list will be lost.</p>
            <div class="modal-actions">
                <button class="modal-btn cancel" onclick="Utils.closeModal()">Cancel</button>
                <button class="modal-btn danger" onclick="App.deleteStore(${storeId})">Delete</button>
            </div>`;
        overlay.classList.add('show');
    },

    async deleteStore(storeId) {
        try {
            await API.deleteStore(storeId);
            Utils.closeModal();
            Utils.showToast('Store deleted');
        } catch(e) { Utils.showToast('Failed to delete store', true); }
    },

    // ===== CLEAR CHECKED =====
    async clearChecked() {
        const checked = API.storeItems.filter(i => i.isChecked);
        if (!checked.length) { Utils.showToast('No checked items!', true); return; }
        const modal = document.getElementById('modal');
        const overlay = document.getElementById('modalOverlay');
        modal.innerHTML = `
            <h3>🗑 Clear Checked Items</h3>
            <p class="modal-sub">${checked.length} item${checked.length > 1 ? 's' : ''} will be removed.</p>
            <div class="modal-actions">
                <button class="modal-btn cancel" onclick="Utils.closeModal()">Cancel</button>
                <button class="modal-btn danger" onclick="App.confirmClearChecked()">Clear All</button>
            </div>`;
        overlay.classList.add('show');
    },

    async confirmClearChecked() {
        try {
            await API.clearChecked();
            Utils.closeModal();
            Utils.showToast('Cleared! ✓');
        } catch(e) { Utils.showToast('Failed to clear', true); }
    },

    // ===== UTILITY =====
    darken(hex) {
        const n = parseInt(hex.slice(1), 16);
        const r = Math.max(0, (n >> 16) - 30);
        const g = Math.max(0, ((n >> 8) & 0xff) - 30);
        const b = Math.max(0, (n & 0xff) - 30);
        return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
    }
};

document.addEventListener('DOMContentLoaded', () => App.init());
