const UI = {
    currentTab: 'list',

    switchTab(tab) {
        this.currentTab = tab;
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.tab === tab);
        });
        document.querySelectorAll('.tab-content').forEach(el => {
            el.classList.toggle('hidden', el.dataset.tab !== tab);
        });
        this.render();
    },

    render() {
        if (this.currentTab === 'list') this.renderList();
        if (this.currentTab === 'favourites') this.renderFavourites();
        if (this.currentTab === 'add') this.renderAisleSelect();
        this.renderStats();
    },

    // ===== STATS BAR =====
    renderStats() {
        const total = API.items.length;
        const checked = API.items.filter(i => i.isChecked).length;
        const el = document.getElementById('statsBar');
        if (!el) return;
        el.textContent = total === 0
            ? 'Your list is empty'
            : `${checked} of ${total} items collected`;
    },

    // ===== SHOPPING LIST (sorted by aisle) =====
    renderList() {
        const container = document.getElementById('listContainer');
        if (!container) return;

        const items = API.items;

        if (items.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <div class="empty-icon">🛒</div>
                    <p>Your list is empty!</p>
                    <p class="empty-sub">Add items using the Add tab below.</p>
                </div>
            `;
            return;
        }

        // Group by aisle
        const grouped = {};
        const noAisle = [];

        items.forEach(item => {
            if (!item.aisleId) {
                noAisle.push(item);
            } else {
                if (!grouped[item.aisleId]) grouped[item.aisleId] = [];
                grouped[item.aisleId].push(item);
            }
        });

        // Sort aisles by sort order
        const sortedAisles = API.aisles
            .filter(a => grouped[a.id])
            .sort((a, b) => a.sortOrder - b.sortOrder);

        let html = '';

        sortedAisles.forEach(aisle => {
            const aisleItems = grouped[aisle.id];
            html += `<div class="aisle-group">
                <div class="aisle-header">
                    <span class="aisle-icon">🏪</span>
                    <span class="aisle-name">${Utils.escapeHtml(aisle.name)}</span>
                    <span class="aisle-count">${aisleItems.length}</span>
                </div>
                ${aisleItems.map(item => this.renderItem(item)).join('')}
            </div>`;
        });

        if (noAisle.length) {
            html += `<div class="aisle-group">
                <div class="aisle-header">
                    <span class="aisle-icon">📦</span>
                    <span class="aisle-name">Other</span>
                    <span class="aisle-count">${noAisle.length}</span>
                </div>
                ${noAisle.map(item => this.renderItem(item)).join('')}
            </div>`;
        }

        container.innerHTML = html;
    },

    renderItem(item) {
        const aisle = API.aisles.find(a => a.id === item.aisleId);
        return `
            <div class="item-card ${item.isChecked ? 'checked' : ''}">
                <div class="item-check" onclick="UI.handleCheck(${item.id})">
                    <div class="checkbox ${item.isChecked ? 'checked' : ''}">
                        ${item.isChecked ? '✓' : ''}
                    </div>
                </div>
                <div class="item-info" onclick="UI.handleCheck(${item.id})">
                    <div class="item-name ${item.isChecked ? 'crossed' : ''}">${Utils.escapeHtml(item.name)}</div>
                    ${item.quantity > 1 ? `<div class="item-qty">Qty: ${item.quantity}</div>` : ''}
                </div>
                <div class="item-actions">
                    <button class="icon-btn fav-btn ${item.isFavourite ? 'active' : ''}" onclick="UI.handleFavourite(${item.id})" title="Favourite">⭐</button>
                    <button class="icon-btn del-btn" onclick="UI.handleDelete(${item.id})" title="Delete">🗑</button>
                </div>
            </div>
        `;
    },

    // ===== FAVOURITES TAB =====
    renderFavourites() {
        const container = document.getElementById('favouritesContainer');
        if (!container) return;

        const favs = API.items.filter(i => i.isFavourite);
        const allFavs = favs.length > 0 ? favs : this.getDefaultFavourites();

        if (allFavs.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <div class="empty-icon">⭐</div>
                    <p>No favourites yet!</p>
                    <p class="empty-sub">Tap ⭐ on any item to save it as a favourite.</p>
                </div>
            `;
            return;
        }

        container.innerHTML = allFavs.map(item => `
            <div class="fav-card">
                <div class="fav-name">${Utils.escapeHtml(item.name)}</div>
                <div class="fav-aisle">${API.aisles.find(a => a.id === item.aisleId)?.name || 'No aisle'}</div>
                <button class="fav-add-btn" onclick="UI.addFavouriteToList(${item.id})">+ Add</button>
            </div>
        `).join('');
    },

    getDefaultFavourites() {
        return [];
    },

    async addFavouriteToList(id) {
        const item = API.items.find(i => i.id === id);
        if (!item) return;
        try {
            await API.addItem({
                name: item.name,
                aisleId: item.aisleId,
                quantity: 1,
                isFavourite: false
            });
            UI.switchTab('list');
            Utils.showToast(`${item.name} added to list! 🛒`);
        } catch (e) {
            Utils.showToast('Failed to add item', true);
        }
    },

    // ===== AISLE SELECT (Add tab) =====
    renderAisleSelect() {
        const select = document.getElementById('aisleSelect');
        if (!select || select.children.length > 1) return;
        select.innerHTML = '<option value="">— Select Aisle —</option>' +
            API.aisles
                .sort((a, b) => a.sortOrder - b.sortOrder)
                .map(a => `<option value="${a.id}">${Utils.escapeHtml(a.name)}</option>`)
                .join('');
    },

    // ===== HANDLERS =====
    async handleCheck(id) {
        try {
            await API.toggleCheck(id);
        } catch (e) {
            Utils.showToast('Failed to update item', true);
        }
    },

    async handleFavourite(id) {
        try {
            await API.toggleFavourite(id);
            Utils.showToast('Favourite updated ⭐');
        } catch (e) {
            Utils.showToast('Failed to update favourite', true);
        }
    },

    async handleDelete(id) {
        const item = API.items.find(i => i.id === id);
        if (!item) return;

        const modal = document.getElementById('modal');
        const overlay = document.getElementById('modalOverlay');

        modal.innerHTML = `
            <h3>🗑 Remove Item</h3>
            <p class="modal-sub">Remove <strong>${Utils.escapeHtml(item.name)}</strong> from your list?</p>
            <div class="modal-actions">
                <button class="modal-btn cancel" onclick="Utils.closeModal()">Cancel</button>
                <button class="modal-btn danger" onclick="UI.confirmDelete(${id})">Remove</button>
            </div>
        `;
        overlay.classList.add('show');
    },

    async confirmDelete(id) {
        try {
            await API.deleteItem(id);
            Utils.closeModal();
            Utils.showToast('Item removed ✓');
        } catch (e) {
            Utils.showToast('Failed to remove item', true);
        }
    }

};
