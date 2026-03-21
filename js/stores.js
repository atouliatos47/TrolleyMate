// ===================================================
// stores.js — Store selection, add/delete, clear
// ===================================================
Object.assign(App, {

    // ===== STORE SELECTION =====
    enterStore(storeId) {
        const store = API.stores.find(s => s.id === storeId);
        if (!store) return;
        API.currentStoreId = storeId;

        document.documentElement.style.setProperty('--store-color', store.color);
        document.documentElement.style.setProperty('--store-color-dark', App.darken(store.color));
        document.documentElement.style.setProperty('--accent', store.color);
        document.documentElement.style.setProperty('--accent-dim', store.color + '20');
        document.documentElement.style.setProperty('--home-btn-color', store.color);
        document.documentElement.style.setProperty('--home-btn-shadow', store.color + '80');

        const logoDomain = UI.getStoreLogo(store.name);
        const storeTitle = document.getElementById('storeTitle');
        if (logoDomain) {
            storeTitle.innerHTML = `<img src="https://www.google.com/s2/favicons?domain=${logoDomain}&sz=128"
                alt="${store.name}" onerror="this.style.display='none'"
                style="width:28px;height:28px;object-fit:contain;border-radius:6px;background:white;padding:2px;vertical-align:middle;margin-right:8px;">
                ${store.name}`;
        } else {
            storeTitle.textContent = store.name;
        }

        document.getElementById('homeScreen').classList.add('hidden');
        document.getElementById('storeScreen').classList.remove('hidden');
        document.getElementById('navHomeScreen').classList.add('hidden');
        document.getElementById('navStoreScreen').classList.remove('hidden');

        this.requestWakeLock();
        UI.renderAisles();
        UI.renderList();
        // Refresh aisles from server in case new store was just seeded
        API.fetchAisles(storeId).then(() => {
            UI.renderAisles();
        }).catch(() => {});
    },

    goHome() {
        API.currentStoreId = null;
        document.getElementById('storeScreen').classList.add('hidden');
        document.getElementById('homeScreen').classList.remove('hidden');
        document.getElementById('navStoreScreen').classList.add('hidden');
        document.getElementById('navAislePanel').classList.add('hidden');
        document.getElementById('navHomeScreen').classList.remove('hidden');
        document.getElementById('aislePanelOverlay').classList.remove('show');
        this.releaseWakeLock();
    },

    // ===== ADD STORE =====
    showAddStore() {
        // Free tier limit — max 3 stores
        if (!API.hasFullAccess && API.stores.length >= 3) {
            App.showUpgradePrompt(`You have reached the 3 store limit on the free plan. Upgrade to BasketMate Family to add unlimited stores.`);
            return;
        }
        // Store name → auto colour map
        const storeColours = {
            'co-op': '#00B1A9', 'coop': '#00B1A9', 'co op': '#00B1A9',
            'tesco': '#005EA5', 'iceland': '#D61F26',
            'lidl': '#0050AA', "sainsbury's": '#F47920', 'sainsburys': '#F47920',
            'b&m': '#6B2D8B', 'aldi': '#003082', 'morrisons': '#00AA4F',
            'asda': '#78BE20', 'waitrose': '#7A9A01', 'm&s': '#000000',
            'marks & spencer': '#000000',
        };
        const modal = document.getElementById('modal');
        const overlay = document.getElementById('modalOverlay');
        const colours = [
            { name: 'Tesco Blue',  hex: '#005EA5' },
            { name: 'Iceland Red', hex: '#D61F26' },
            { name: 'Lidl Blue',   hex: '#0050AA' },
            { name: 'Sainsburys',  hex: '#F47920' },
            { name: 'B&M Purple',  hex: '#6B2D8B' },
            { name: 'Green',       hex: '#16a34a' },
            { name: 'Dark',        hex: '#1a1a2e' },
            { name: 'Co-op Teal', hex: '#00B1A9' },
        ];
        modal.innerHTML = `
            <h3>🏪 Add New Store</h3>
            <p class="modal-sub">Add a supermarket or shop</p>
            <div style="display:flex;flex-direction:column;gap:12px;margin-top:14px;">
                <div>
                    <label style="font-size:12px;font-weight:600;color:#6b7280;text-transform:uppercase;">Store Name</label>
                    <input type="text" id="newStoreName" placeholder="e.g. Aldi, Asda, Co-op..."
                        style="width:100%;margin-top:6px;padding:12px 14px;border:1.5px solid #e5e7eb;border-radius:10px;font-size:16px;outline:none;"
                        onkeyup="const c=App._storeColours&&App._storeColours[this.value.trim().toLowerCase()];if(c)App.selectStoreColour(c);">
                </div>
                <div>
                    <label style="font-size:12px;font-weight:600;color:#6b7280;text-transform:uppercase;">Emoji</label>
                    <input type="text" id="newStoreEmoji" placeholder="🏪" maxlength="2"
                        style="width:100%;margin-top:6px;padding:12px 14px;border:1.5px solid #e5e7eb;border-radius:10px;font-size:20px;outline:none;">
                </div>
                <div>
                    <label style="font-size:12px;font-weight:600;color:#6b7280;text-transform:uppercase;">Colour</label>
                    <div style="display:flex;flex-wrap:wrap;gap:8px;margin-top:8px;">
                        ${colours.map(c => `<div class="colour-swatch" data-hex="${c.hex}" onclick="App.selectStoreColour('${c.hex}')"
                            style="width:36px;height:36px;border-radius:50%;background:${c.hex};cursor:pointer;border:3px solid transparent;" title="${c.name}"></div>`).join('')}
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
        // Disable button to prevent double submit
        const btn = document.querySelector('#modal .modal-btn.confirm');
        if (btn) { btn.disabled = true; btn.textContent = 'Adding...'; }
        try {
            await API.addStore({ name, emoji, color });
            Utils.closeModal();
            Utils.showToast(`${emoji} ${name} added! ✓`);
        } catch(e) {
            Utils.closeModal();
            Utils.showToast(`${emoji} ${name} added! ✓`);
        }
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
    }
});
