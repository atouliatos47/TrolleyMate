const UI = {

    render() {
        this.renderAisles();
        this.renderList();
        this.renderStats();
    },

    // ===== STATS =====
    renderStats() {
        const total = API.items.length;
        const checked = API.items.filter(i => i.isChecked).length;
        const el = document.getElementById('statsBar');
        if (!el) return;
        el.textContent = total === 0
            ? 'Your list is empty'
            : `${checked} of ${total} items collected`;
    },

    // ===== AISLES PANEL =====
    renderAisles() {
        const container = document.getElementById('aislesContainer');
        if (!container) return;

        if (!API.aisles.length) {
            container.innerHTML = `<div class="empty-state"><div class="empty-icon">🏪</div><p>No aisles yet</p></div>`;
            return;
        }

        // Preserve open states
        const openIds = new Set();
        container.querySelectorAll('.aisle-card.open').forEach(el => {
            openIds.add(parseInt(el.dataset.aisleId));
        });

        container.innerHTML = API.aisles
            .sort((a, b) => a.sortOrder - b.sortOrder)
            .map(aisle => this.renderAisleCard(aisle, openIds.has(aisle.id)))
            .join('');
    },

    renderAisleCard(aisle, isOpen) {
        const products = aisle.products || [];
        const itemNames = API.items.map(i => i.name.toLowerCase());

        const chipsHtml = products.length
            ? products.map(name => {
                const inList = itemNames.includes(name.toLowerCase());
                return `<div class="product-chip ${inList ? 'in-list' : ''}"
                    onclick="UI.handleProductTap(event, '${name.replace(/'/g, "\\'")}', ${aisle.id}, this)">
                    ${Utils.escapeHtml(name)}${inList ? ' ✓' : ''}
                </div>`;
            }).join('')
            : `<span class="no-products">No products yet</span>`;

        return `
            <div class="aisle-card ${isOpen ? 'open' : ''}" data-aisle-id="${aisle.id}">
                <div class="aisle-card-header" onclick="UI.toggleAisle(${aisle.id})">
                    <span class="aisle-card-icon">🏪</span>
                    <span class="aisle-card-name">${Utils.escapeHtml(aisle.name)}</span>
                    ${products.length ? `<span class="aisle-card-count">${products.length}</span>` : ''}
                    <button class="aisle-manage-btn" onclick="event.stopPropagation(); UI.showManageProducts(${aisle.id})">⚙️</button>
                    <span class="aisle-card-toggle">▼</span>
                </div>
                <div class="aisle-products">
                    ${chipsHtml}
                </div>
            </div>
        `;
    },

    toggleAisle(aisleId) {
        const card = document.querySelector(`.aisle-card[data-aisle-id="${aisleId}"]`);
        if (card) card.classList.toggle('open');
    },

    // ===== FLY ANIMATION =====
    async handleProductTap(event, name, aisleId, chipEl) {
        // Check if already in list
        const alreadyIn = API.items.some(i =>
            i.name.toLowerCase() === name.toLowerCase() && !i.isChecked
        );
        if (alreadyIn) {
            Utils.showToast(`${name} is already in your list!`, true);
            return;
        }

        // Get chip position for animation
        const chipRect = chipEl.getBoundingClientRect();

        // Get list panel position as target
        const listPanel = document.getElementById('listContainer');
        const listRect = listPanel.getBoundingClientRect();
        const targetX = listRect.left + listRect.width / 2;
        const targetY = listRect.top + 60;

        // Create flying element
        const flyer = document.createElement('div');
        flyer.className = 'flying-chip';
        flyer.textContent = name;
        flyer.style.left = chipRect.left + 'px';
        flyer.style.top = chipRect.top + 'px';
        flyer.style.width = chipRect.width + 'px';
        document.body.appendChild(flyer);

        // Trigger animation on next frame
        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                flyer.style.left = targetX + 'px';
                flyer.style.top = targetY + 'px';
                flyer.style.width = '80px';
                flyer.style.opacity = '0';
                flyer.style.transform = 'scale(0.5)';
            });
        });

        // Add item to list
        try {
            await API.addItem({ name, aisleId, quantity: 1 });
        } catch(e) {
            Utils.showToast('Failed to add item', true);
        }

        // Remove flyer after animation
        setTimeout(() => {
            if (flyer.parentNode) flyer.parentNode.removeChild(flyer);
        }, 500);
    },

    // ===== SHOPPING LIST =====
    renderList() {
        const container = document.getElementById('listContainer');
        if (!container) return;

        const items = API.items;

        if (!items.length) {
            container.innerHTML = `
                <div class="empty-state">
                    <div class="empty-icon">🛒</div>
                    <p>Your list is empty!</p>
                    <p class="empty-sub">Tap any product on the left to add it.</p>
                </div>`;
            return;
        }

        // Group by aisle, sorted by aisle order
        const grouped = {};
        const noAisle = [];

        items.forEach(item => {
            if (!item.aisleId) { noAisle.push(item); return; }
            if (!grouped[item.aisleId]) grouped[item.aisleId] = [];
            grouped[item.aisleId].push(item);
        });

        const sortedAisles = API.aisles
            .filter(a => grouped[a.id])
            .sort((a, b) => a.sortOrder - b.sortOrder);

        let html = '';

        sortedAisles.forEach(aisle => {
            const aisleItems = grouped[aisle.id];
            html += `
                <div class="aisle-group">
                    <div class="aisle-group-header">
                        <span>🏪</span>
                        <span>${Utils.escapeHtml(aisle.name)}</span>
                        <span class="aisle-group-count">${aisleItems.length}</span>
                    </div>
                    ${aisleItems.map(item => this.renderItem(item)).join('')}
                </div>`;
        });

        if (noAisle.length) {
            html += `
                <div class="aisle-group">
                    <div class="aisle-group-header">
                        <span>📦</span>
                        <span>Other</span>
                        <span class="aisle-group-count">${noAisle.length}</span>
                    </div>
                    ${noAisle.map(item => this.renderItem(item)).join('')}
                </div>`;
        }

        container.innerHTML = html;
    },

    renderItem(item) {
        return `
            <div class="item-card ${item.isChecked ? 'checked' : ''}">
                <div class="checkbox ${item.isChecked ? 'checked' : ''}"
                    onclick="UI.handleCheck(${item.id})">
                    ${item.isChecked ? '✓' : ''}
                </div>
                <div class="item-name ${item.isChecked ? 'crossed' : ''}"
                    onclick="UI.handleCheck(${item.id})">
                    ${Utils.escapeHtml(item.name)}
                </div>
                ${item.quantity > 1 ? `<span class="qty-badge">x${item.quantity}</span>` : ''}
                <button class="del-btn" onclick="UI.handleDelete(${item.id})">🗑</button>
            </div>`;
    },

    // ===== HANDLERS =====
    async handleCheck(id) {
        try {
            await API.toggleCheck(id);
            const item = API.items.find(i => i.id === id);
            if (item && item.isChecked) {
                setTimeout(async () => {
                    try { await API.deleteItem(id); } catch(e) {}
                }, 800);
            }
        } catch(e) { Utils.showToast('Failed to update item', true); }
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
            </div>`;
        overlay.classList.add('show');
    },

    async confirmDelete(id) {
        try {
            await API.deleteItem(id);
            Utils.closeModal();
            Utils.showToast('Item removed ✓');
        } catch(e) { Utils.showToast('Failed to remove item', true); }
    },

    // ===== PRODUCT LIBRARY =====
    showManageProducts(aisleId) {
        const aisle = API.aisles.find(a => a.id === aisleId);
        if (!aisle) return;
        const modal = document.getElementById('modal');
        const overlay = document.getElementById('modalOverlay');

        const renderList = () => {
            const list = document.getElementById('productLibraryList');
            if (!list) return;
            const a = API.aisles.find(x => x.id === aisleId);
            if (!a || !a.products.length) {
                list.innerHTML = '<p style="color:#9ca3af;font-size:13px;padding:8px 0;">No products yet. Add some below!</p>';
                return;
            }
            list.innerHTML = a.products.map(name => `
                <div class="product-lib-item">
                    <span>${Utils.escapeHtml(name)}</span>
                    <button class="del-btn" onclick="UI.deleteProduct(${aisleId}, '${name.replace(/'/g, "\\'")}')">🗑</button>
                </div>`).join('');
        };

        modal.innerHTML = `
            <h3>⚙️ ${Utils.escapeHtml(aisle.name)}</h3>
            <p class="modal-sub">Manage products for this aisle</p>
            <div id="productLibraryList" style="margin:14px 0;max-height:220px;overflow-y:auto;"></div>
            <div style="display:flex;gap:8px;margin-top:8px;">
                <input type="text" id="newProductInput" placeholder="Add product name..."
                    style="flex:1;padding:10px 12px;border:1.5px solid #e5e7eb;border-radius:10px;font-size:16px;outline:none;"
                    onkeypress="if(event.key==='Enter') UI.addProduct(${aisleId})">
                <button class="modal-btn confirm" style="flex:0;padding:10px 16px;min-height:auto;" onclick="UI.addProduct(${aisleId})">Add</button>
            </div>
            <div class="modal-actions">
                <button class="modal-btn cancel" onclick="Utils.closeModal()">Close</button>
            </div>`;
        overlay.classList.add('show');
        renderList();
    },

    async addProduct(aisleId) {
        const input = document.getElementById('newProductInput');
        const name = input.value.trim();
        if (!name) { Utils.shakeElement(input); return; }
        try {
            await API.addProduct(aisleId, name);
            input.value = '';
            input.focus();
            const list = document.getElementById('productLibraryList');
            const aisle = API.aisles.find(a => a.id === aisleId);
            if (list && aisle) {
                list.innerHTML = aisle.products.map(n => `
                    <div class="product-lib-item">
                        <span>${Utils.escapeHtml(n)}</span>
                        <button class="del-btn" onclick="UI.deleteProduct(${aisleId}, '${n.replace(/'/g, "\\'")}')">🗑</button>
                    </div>`).join('');
            }
        } catch(e) { Utils.showToast('Failed to add product', true); }
    },

    async deleteProduct(aisleId, name) {
        try {
            await API.deleteProduct(aisleId, name);
            const list = document.getElementById('productLibraryList');
            const aisle = API.aisles.find(a => a.id === aisleId);
            if (list && aisle) {
                list.innerHTML = aisle.products.map(n => `
                    <div class="product-lib-item">
                        <span>${Utils.escapeHtml(n)}</span>
                        <button class="del-btn" onclick="UI.deleteProduct(${aisleId}, '${n.replace(/'/g, "\\'")}')">🗑</button>
                    </div>`).join('');
            }
        } catch(e) { Utils.showToast('Failed to delete product', true); }
    }
};
