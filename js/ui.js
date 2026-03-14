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
                    <button class="aisle-manage-btn" onclick="event.stopPropagation();UI.showSelectProducts(${aisle.id})">+ Add</button>
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
        return `
            <div class="item-card ${item.isChecked ? 'checked' : ''}">
                <div class="item-check" onclick="UI.handleCheck(${item.id})">
                    <div class="checkbox ${item.isChecked ? 'checked' : ''}">
                        ${item.isChecked ? '✓' : ''}
                    </div>
                </div>
                <div class="item-info" onclick="UI.handleCheck(${item.id})">
                    <div class="item-name ${item.isChecked ? 'crossed' : ''}">${Utils.escapeHtml(item.name)}</div>
                </div>
                ${item.quantity > 1 ? `<span class="qty-badge">x${item.quantity}</span>` : ''}
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

    // ===== PRODUCT LIBRARY =====

    showManageProducts(aisleId) {
        const aisle = API.aisles.find(a => a.id === aisleId);
        if (!aisle) return;

        const modal = document.getElementById('modal');
        const overlay = document.getElementById('modalOverlay');

        const renderProducts = () => {
            const list = document.getElementById('productLibraryList');
            if (!list) return;
            const aisle = API.aisles.find(a => a.id === aisleId);
            if (!aisle || !aisle.products.length) {
                list.innerHTML = '<p style="color:#9ca3af;font-size:13px;padding:8px 0;">No products yet. Add some below!</p>';
                return;
            }
            list.innerHTML = aisle.products.map(name => `
                <div class="product-lib-item">
                    <span>${Utils.escapeHtml(name)}</span>
                    <button class="icon-btn del-btn" onclick="UI.deleteProduct(${aisleId}, '${name.replace(/'/g, "\'")}', ${aisleId})">🗑</button>
                </div>
            `).join('');
        };

        modal.innerHTML = `
            <h3>📦 ${Utils.escapeHtml(aisle.name)}</h3>
            <p class="modal-sub">Manage your regular products for this aisle</p>
            <div id="productLibraryList" style="margin:14px 0;max-height:220px;overflow-y:auto;"></div>
            <div style="display:flex;gap:8px;margin-top:8px;">
                <input type="text" id="newProductInput" placeholder="Add product name..." 
                    style="flex:1;padding:10px 12px;border:1.5px solid #e5e7eb;border-radius:10px;font-size:14px;outline:none;"
                    onkeypress="if(event.key==='Enter') UI.addProduct(${aisleId})">
                <button class="modal-btn confirm" style="flex:0;padding:10px 16px;" onclick="UI.addProduct(${aisleId})">Add</button>
            </div>
            <div class="modal-actions" style="margin-top:12px;">
                <button class="modal-btn cancel" onclick="Utils.closeModal()">Close</button>
                <button class="modal-btn confirm" onclick="UI.showSelectProducts(${aisleId})">🛒 Add to List</button>
            </div>
        `;
        overlay.classList.add('show');
        renderProducts();
    },

    async addProduct(aisleId) {
        const input = document.getElementById('newProductInput');
        const name = input.value.trim();
        if (!name) { Utils.shakeElement(input); return; }
        try {
            await API.addProduct(aisleId, name);
            input.value = '';
            input.focus();
            // Re-render product list inside modal
            const aisle = API.aisles.find(a => a.id === aisleId);
            const list = document.getElementById('productLibraryList');
            if (list && aisle) {
                list.innerHTML = aisle.products.map(n => `
                    <div class="product-lib-item">
                        <span>${Utils.escapeHtml(n)}</span>
                        <button class="icon-btn del-btn" onclick="UI.deleteProduct(${aisleId}, '${n.replace(/'/g, "\'")}')">🗑</button>
                    </div>
                `).join('');
            }
        } catch(e) { Utils.showToast('Failed to add product', true); }
    },

    async deleteProduct(aisleId, name) {
        try {
            await API.deleteProduct(aisleId, name);
            const aisle = API.aisles.find(a => a.id === aisleId);
            const list = document.getElementById('productLibraryList');
            if (list && aisle) {
                list.innerHTML = aisle.products.map(n => `
                    <div class="product-lib-item">
                        <span>${Utils.escapeHtml(n)}</span>
                        <button class="icon-btn del-btn" onclick="UI.deleteProduct(${aisleId}, '${n.replace(/'/g, "\'")}')">🗑</button>
                    </div>
                `).join('');
            }
        } catch(e) { Utils.showToast('Failed to delete product', true); }
    },

    showSelectProducts(aisleId) {
        const aisle = API.aisles.find(a => a.id === aisleId);
        if (!aisle) return;

        const modal = document.getElementById('modal');
        const overlay = document.getElementById('modalOverlay');

        if (!aisle.products || !aisle.products.length) {
            Utils.showToast('No products in library yet! Add some first.', true);
            return;
        }

        modal.innerHTML = `
            <h3>🛒 Add from ${Utils.escapeHtml(aisle.name)}</h3>
            <p class="modal-sub">Tap a product to add it to your list</p>
            <div style="margin-top:14px;display:flex;flex-direction:column;gap:8px;max-height:350px;overflow-y:auto;">
                ${aisle.products.map(name => {
                    const inList = API.items.some(i => i.name === name && i.aisleId === aisleId && !i.isChecked);
                    return `
                        <div class="product-select-row ${inList ? 'in-list' : ''}" onclick="UI.quickAddProduct('${name.replace(/'/g, "\'")}', ${aisleId})">
                            <span>${Utils.escapeHtml(name)}</span>
                            ${inList ? '<span class="in-list-badge">✓ In list</span>' : '<span class="add-badge">+ Add</span>'}
                        </div>
                    `;
                }).join('')}
            </div>
            <div class="modal-actions">
                <button class="modal-btn cancel" onclick="Utils.closeModal()">Done</button>
            </div>
        `;
        overlay.classList.add('show');
    },

    async quickAddProduct(name, aisleId) {
        try {
            await API.addItem({ name, aisleId, quantity: 1 });
            // Refresh the modal to show updated in-list status
            this.showSelectProducts(aisleId);
            Utils.showToast(`${name} added! 🛒`);
        } catch(e) { Utils.showToast('Failed to add item', true); }
    },

    // ===== HANDLERS =====
    async handleCheck(id) {
        try {
            await API.toggleCheck(id);
            const item = API.items.find(i => i.id === id);
            if (item && item.isChecked) {
                setTimeout(async () => {
                    try {
                        await API.deleteItem(id);
                    } catch (e) {}
                }, 800);
            }
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
