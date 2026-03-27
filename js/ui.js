const UI = {
    currentAislePanel: null,

    // ===== HOME SCREEN =====
    logoFallback(storeId, initials, color) {
        const el = document.getElementById('avatar-' + storeId);
        if (el) {
            el.style.background = color;
            el.innerHTML = `<span class="store-card-initials">${initials}</span>`;
        }
    },

    // Known store logo domains
    getStoreLogo(name) {
        const logos = {
            'tesco':        'tesco.com',
            'iceland':      'iceland.co.uk',
            'lidl':         'lidl.co.uk',
            "sainsbury's":  'sainsburys.co.uk',
            'sainsburys':   'sainsburys.co.uk',
            'b&m':              'bmstores.co.uk',
            'aldi':             'aldi.co.uk',
            'morrisons':        'morrisons.com',
            'marks & spencer':  'marksandspencer.com',
            'm&s':              'marksandspencer.com',
            'asda':         'asda.com',
            'morrisons':    'morrisons.com',
            'waitrose':     'waitrose.com',
            'marks & spencer': 'marksandspencer.com',
            'm&s':          'marksandspencer.com',
            'boots':        'boots.com',
            'wilko':        'wilko.com',
            'home bargains': 'homebargains.co.uk',
            'poundland':    'poundland.co.uk',
            'co-op':        'co-operative.coop',
            'coop':         'co-operative.coop',
            'co op':        'co-operative.coop',
            'costco':       'costco.co.uk',
        };
        return logos[name.toLowerCase()] || null;
    },

    renderHome() {
        const container = document.getElementById('storeGrid');
        if (!container) return;

        const stores = API.stores.sort((a, b) => a.sortOrder - b.sortOrder);

        container.innerHTML = stores.map(store => {
            const itemCount = API.items.filter(i => i.storeId === store.id && !i.isChecked).length;
            const initials = store.name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0,2);
            const logoDomain = this.getStoreLogo(store.name);

            return `
                <div style="position:relative;background:white;border-radius:16px;overflow:hidden;box-shadow:var(--shadow-sm);border:1px solid rgba(0,0,0,0.04);cursor:pointer;-webkit-tap-highlight-color:transparent;"
                    onclick="App.enterStore(${store.id})">
                    <div style="position:absolute;left:0;top:0;bottom:0;width:4px;background:${store.color};border-radius:16px 0 0 16px;"></div>
                    <div style="display:flex;flex-direction:column;align-items:center;padding:18px 12px 14px;gap:10px;">
                        ${logoDomain
                            ? `<div style="width:48px;height:48px;border-radius:12px;background:white;border:1px solid var(--ink-100);display:flex;align-items:center;justify-content:center;box-shadow:var(--shadow-xs);">
                                <img src="https://www.google.com/s2/favicons?domain=${logoDomain}&sz=128"
                                    alt="${Utils.escapeHtml(store.name)}"
                                    onload="this.style.opacity=1"
                                    onerror="UI.logoFallback(${store.id},'${initials}','${store.color}')"
                                    style="width:32px;height:32px;object-fit:contain;opacity:0;transition:opacity 0.3s;border-radius:4px;"
                                    id="avatar-${store.id}">
                               </div>`
                            : `<div style="width:48px;height:48px;border-radius:12px;background:${store.color};display:flex;align-items:center;justify-content:center;">
                                <span style="font-size:16px;font-weight:800;color:white;letter-spacing:-0.5px;">${initials}</span>
                               </div>`
                        }
                        <div style="text-align:center;width:100%;">
                            <div style="font-size:13px;font-weight:700;color:var(--text-primary);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${Utils.escapeHtml(store.name)}</div>
                            <div style="font-size:11px;font-weight:500;margin-top:3px;color:${itemCount ? 'var(--green)' : 'var(--text-secondary)'};">
                                ${itemCount ? t('itemsInList', itemCount) : t('listIsEmpty')}
                            </div>
                        </div>
                    </div>
                    <button onclick="event.stopPropagation();App.confirmDeleteStore(${store.id})"
                        style="position:absolute;top:6px;right:6px;width:22px;height:22px;border-radius:50%;background:rgba(0,0,0,0.07);border:none;display:flex;align-items:center;justify-content:center;cursor:pointer;">
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none">
                            <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/>
                        </svg>
                    </button>
                </div>`;
        }).join('');
    },

    // ===== STATS =====
    switchListTab(tab) {
        const listContainer = document.getElementById('listContainer');
        const favsContainer = document.getElementById('favouritesContainer');
        const tabList = document.getElementById('tabList');
        const tabFavs = document.getElementById('tabFavs');
        if (!listContainer || !favsContainer) return;

        if (tab === 'list') {
            listContainer.classList.remove('hidden');
            favsContainer.classList.add('hidden');
            tabList.classList.add('active');
            tabFavs.classList.remove('active');
        } else {
            listContainer.classList.add('hidden');
            favsContainer.classList.remove('hidden');
            tabList.classList.remove('active');
            tabFavs.classList.add('active');
            this.renderFavourites();
        }
    },

    renderStats() {
        const total   = API.storeItems.length;
        const checked = API.storeItems.filter(i => i.isChecked).length;
        const el = document.getElementById('statsBar');
        if (!el) return;
        el.textContent = total === 0 ? 'List is empty' : `${checked} of ${total} collected`;
    },

    // ===== AISLES =====
    renderAisles() {
        const container = document.getElementById('aislesContainer');
        if (!container) return;
        const aisles = API.storeAisles;
        const aislesHtml = aisles.length
            ? aisles.sort((a, b) => a.sortOrder - b.sortOrder).map(a => this.renderAisleCard(a)).join('')
            : `<div class="empty-state"><div class="empty-icon">🏪</div><p>No aisles yet!</p><p class="empty-sub">Tap + Add Aisle below.</p></div>`;
        container.innerHTML = `${aislesHtml}<button class="add-aisle-btn" onclick="UI.showAddAisle()">＋ Add Aisle</button>`;
        this.initSortable(container);
    },

    initSortable(container) {
        if (typeof Sortable === 'undefined') return;
        if (container._sortable) container._sortable.destroy();
        container._sortable = new Sortable(container, {
            animation: 180,
            delay: 500,
            delayOnTouchOnly: true,
            handle: '.aisle-card',
            draggable: '.aisle-card',
            ghostClass: 'aisle-drag-ghost',
            chosenClass: 'aisle-drag-chosen',
            forceFallback: false,
            onEnd: async (evt) => {
                // Force cleanup of any lingering drag ghost (iOS fix)
                if (evt.item) {
                    evt.item.style.transform = '';
                    evt.item.style.opacity = '1';
                }
                document.querySelectorAll('.aisle-drag-ghost, .aisle-drag-chosen, .sortable-ghost, .sortable-chosen').forEach(el => {
                    el.classList.remove('aisle-drag-ghost', 'aisle-drag-chosen', 'sortable-ghost', 'sortable-chosen');
                    el.style.transform = '';
                    el.style.opacity = '1';
                });

                // Build new sort order from current DOM
                const cards = container.querySelectorAll('.aisle-card');
                const order = Array.from(cards).map((card, index) => ({
                    id: parseInt(card.dataset.aisleId),
                    sortOrder: index + 1
                }));
                // Update local state immediately
                order.forEach(({ id, sortOrder }) => {
                    const aisle = API.aisles.find(a => a.id === id);
                    if (aisle) aisle.sortOrder = sortOrder;
                });
                try {
                    await API.reorderAisles(order);
                } catch(e) {
                    Utils.showToast('Failed to save order', true);
                }
            }
        });
    },

    renderAisleCard(aisle) {
        const products = aisle.products || [];
        const inListCount = products.filter(name =>
            API.storeItems.some(i => i.name.toLowerCase() === name.toLowerCase() && !i.isChecked)
        ).length;
        return `
            <div class="aisle-card" data-aisle-id="${aisle.id}" onclick="UI.openAislePanel(${aisle.id})">
                <div class="aisle-card-header">
                    <div class="aisle-card-meta">
                        <span class="aisle-card-name">${Utils.escapeHtml(aisle.name)}</span>
                        <span class="aisle-card-count">${products.length ? products.length + ' products' : 'No products'}</span>
                        ${inListCount ? `<span class="aisle-in-list-count">✓ ${inListCount} in list</span>` : ''}
                    </div>
                    <button class="aisle-delete-btn" onclick="event.stopPropagation(); UI.confirmDeleteAisle(${aisle.id})">🗑</button>
                    <span class="aisle-card-arrow">›</span>
                </div>
            </div>`;
    },

    // ===== AISLE PANEL =====
    openAislePanel(aisleId) {
        const aisle = API.storeAisles.find(a => a.id === aisleId);
        if (!aisle) return;
        this.currentAislePanel = aisleId;
        this.lastAislePanel = aisleId;
        document.getElementById('aislePanelTitle').textContent = aisle.name;
        this.renderAislePanelProducts(aisleId);
        document.getElementById('aislePanelOverlay').classList.add('show');
        document.getElementById('navStoreScreen').classList.add('hidden');
        document.getElementById('navAislePanel').classList.remove('hidden');
    },

    closeAislePanel() {
        this.currentAislePanel = null;
        document.getElementById('aislePanelOverlay').classList.remove('show');
        document.getElementById('navAislePanel').classList.add('hidden');
        document.getElementById('navStoreScreen').classList.remove('hidden');
    },

    renderAislePanelProducts(aisleId) {
        const aisle = API.storeAisles.find(a => a.id === aisleId);
        const container = document.getElementById('aislePanelProducts');
        if (!aisle || !container) return;
        const products = aisle.products || [];
        const favNames = API.storeFavourites.map(f => f.name.toLowerCase());

        const chipsHtml = products.length ? products.map(name => {
            const listItem = API.storeItems.find(i => i.name.toLowerCase() === name.toLowerCase() && !i.isChecked);
            const inList = !!listItem;
            const qty = listItem ? listItem.quantity : 0;
            const itemId = listItem ? listItem.id : null;
            const isFav = favNames.includes(name.toLowerCase());
            return `
                <div class="panel-chip-wrapper">
                    <button class="chip-fav-btn ${isFav ? 'active' : ''}"
                        onclick="UI.toggleFavourite('${name.replace(/'/g, "\\'")}', ${aisleId}, this)">⭐</button>
                    <div class="panel-chip ${inList ? 'in-list' : ''}"
                        onclick="UI.handlePanelProductTap('${name.replace(/'/g, "\\'")}', ${aisleId}, this)"
                        data-item-id="${itemId}"
                        data-aisle-id="${aisleId}"
                        data-name="${name.replace(/"/g, '&quot;')}"
                        data-in-list="${inList}">
                        <span class="panel-chip-name">${Utils.escapeHtml(name)}</span>
                        <span class="panel-chip-badge ${inList ? 'in' : 'add'}">${inList ? '\u2713 In list' + (qty > 1 ? ' x' + qty : '') : '+ Add'}</span>
                    </div>
                    <button class="chip-delete-btn" onclick="UI.deleteProduct(${aisleId}, '${name.replace(/'/g, "\\'")}')">🗑</button>
                </div>`;
        }).join('') : `<div class="empty-state"><div class="empty-icon">📦</div><p>No products yet</p><p class="empty-sub">Use the box below to add your first product.</p></div>`;

        container.innerHTML = `
            ${chipsHtml}`;

        // Long press
        container.querySelectorAll('.panel-chip[data-in-list="true"]').forEach(chip => {
            let pressTimer;
            chip.addEventListener('touchstart', () => {
                pressTimer = setTimeout(() => {
                    const id = parseInt(chip.dataset.itemId);
                    const nm = chip.dataset.name;
                    const aid = parseInt(chip.dataset.aisleId);
                    if (id) UI.handlePanelProductLongPress(id, nm, aid);
                }, 2000);
            }, { passive: true });
            chip.addEventListener('touchend', () => clearTimeout(pressTimer), { passive: true });
            chip.addEventListener('touchmove', () => clearTimeout(pressTimer), { passive: true });
            chip.addEventListener('contextmenu', (e) => {
                e.preventDefault();
                const id = parseInt(chip.dataset.itemId);
                const nm = chip.dataset.name;
                const aid = parseInt(chip.dataset.aisleId);
                if (id) UI.handlePanelProductLongPress(id, nm, aid);
            });
        });
    },

    showAddProductInput() {
        const aisleId = this.currentAislePanel;
        if (!aisleId) return;
        const modal = document.getElementById('modal');
        const overlay = document.getElementById('modalOverlay');
        modal.innerHTML = `
            <div style="text-align:center;padding:8px 0 16px;">
                <div style="font-size:36px;margin-bottom:10px;">➕</div>
                <h3 style="margin:0 0 16px;">Add Product</h3>
                <input type="text" id="addProductInput" placeholder="e.g. White Bread..."
                    style="width:100%;padding:14px;border:1.5px solid #e5e7eb;border-radius:12px;font-size:16px;outline:none;text-align:center;box-sizing:border-box;margin-bottom:16px;"
                    onkeypress="if(event.key==='Enter') UI.addProductFromPanel(${aisleId})">
                <div class="modal-actions">
                    <button class="modal-btn cancel" onclick="Utils.closeModal()">Cancel</button>
                    <button class="modal-btn confirm" onclick="UI.addProductFromPanel(${aisleId})">Add</button>
                </div>
            </div>`;
        overlay.classList.add('show');
        setTimeout(() => document.getElementById('addProductInput')?.focus(), 100);
    },

    async addProductFromPanel(aisleId) {
        const input = document.getElementById('addProductInput') || document.getElementById('panelAddInput');
        if (!input) return;
        const name = input.value.trim();
        if (!name) { Utils.shakeElement(input); return; }

        input.value = '';
        Utils.closeModal();
        try {
            await API.addProduct(aisleId, name);
            this.renderAislePanelProducts(aisleId);
            Utils.showToast(`${name} added to aisle ✓`);
        } catch(e) { Utils.showToast('Failed to add product', true); }
    },

    async lookupPrice(name, aisleId) {
        const store = API.stores.find(s => s.id === API.currentStoreId);
        if (!store) return;

        const modal = document.getElementById('modal');
        const overlay = document.getElementById('modalOverlay');
        modal.innerHTML = `
            <h3>🔍 Price Lookup</h3>
            <p class="modal-sub">Searching <strong>${Utils.escapeHtml(store.name)}</strong> for <strong>${Utils.escapeHtml(name)}</strong>...</p>
            <div id="priceResults" style="margin-top:16px;">
                <div style="text-align:center;padding:20px;color:#9ca3af;">⏳ Loading prices...</div>
            </div>
            <div class="modal-actions">
                <button class="modal-btn cancel" onclick="Utils.closeModal()">Close</button>
            </div>`;
        overlay.classList.add('show');

        try {
            const storeName = store.name.toLowerCase()
                .replace(/'/g, '')
                .replace(/&/g, 'and')
                .replace(/\s+/g, '-');
            const r = await fetch(`/prices?q=${encodeURIComponent(name)}&store=${encodeURIComponent(storeName)}`);
            const raw = await r.json();

            // Handle multiple response formats
            let items = [];
            if (Array.isArray(raw)) items = raw;
            else if (raw.products && Array.isArray(raw.products)) items = raw.products;
            else if (raw.data && Array.isArray(raw.data)) items = raw.data;
            else if (raw.results && Array.isArray(raw.results)) items = raw.results;
            else if (raw.items && Array.isArray(raw.items)) items = raw.items;

            const results = document.getElementById('priceResults');
            if (!results) return;

            if (!items.length) {
                results.innerHTML = '<p style="color:#9ca3af;text-align:center;padding:16px;">No prices found.<br><small>Try a more specific search term.</small></p>';
                return;
            }

            results.innerHTML = items.slice(0, 5).map(item => {
                // Handle different field names
                const title = item.name || item.title || item.product_name || item.productName || name;
                const price = item.price || item.current_price || item.currentPrice || item.cost || '?';
                const image = item.image || item.image_url || item.imageUrl || item.img || null;
                const size = item.size || item.weight || item.quantity || item.volume || '';
                const priceNum = parseFloat(price);

                return `
                <div style="display:flex;align-items:center;gap:12px;padding:12px;background:#f4f4f8;border-radius:12px;margin-bottom:8px;">
                    ${image ? `<img src="${image}" style="width:48px;height:48px;object-fit:contain;border-radius:8px;background:white;" onerror="this.style.display='none'">` : ''}
                    <div style="flex:1;min-width:0;">
                        <div style="font-size:13px;font-weight:600;color:#1a1a2e;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${Utils.escapeHtml(title)}</div>
                        ${size ? `<div style="font-size:11px;color:#6b7280;margin-top:2px;">${Utils.escapeHtml(String(size))}</div>` : ''}
                    </div>
                    <div style="font-size:18px;font-weight:800;color:var(--accent);flex-shrink:0;">${isNaN(priceNum) ? price : '£' + priceNum.toFixed(2)}</div>
                </div>`;
            }).join('');

            // Debug: log raw response for troubleshooting
            console.log('Price API raw response:', JSON.stringify(raw).slice(0, 500));

        } catch(e) {
            const results = document.getElementById('priceResults');
            if (results) results.innerHTML = `<p style="color:#dc2626;text-align:center;padding:16px;">Failed to fetch prices.<br><small>${e.message}</small></p>`;
            console.error('Price lookup error:', e);
        }
    },

    handlePanelProductLongPress(itemId, name, aisleId) {
        if (!itemId) return;
        API.items = API.items.filter(i => i.id !== itemId);
        this.renderAislePanelProducts(aisleId);
        UI.renderList();
        Utils.showToast(`${name} removed ✓`);
        API.deleteItem(itemId).catch(() => {});
    },

    async removePanelItem(itemId, aisleId) {
        try {
            await API.deleteItem(itemId);
            Utils.closeModal();
            Utils.showToast('Removed from list ✓');
            this.renderAislePanelProducts(aisleId);
        } catch(e) { Utils.showToast('Failed to remove', true); }
    },

    async handlePanelProductTap(name, aisleId, chipEl) {
        // Global lock per item name — prevents ANY double fire
        const lockKey = `tap_${aisleId}_${name}`;
        if (UI._tapLocks && UI._tapLocks[lockKey]) return;
        if (!UI._tapLocks) UI._tapLocks = {};
        UI._tapLocks[lockKey] = true;

        chipEl.style.opacity = '0.5';
        chipEl.style.pointerEvents = 'none';

        try {
            const existing = API.storeItems.find(i => i.name.toLowerCase() === name.toLowerCase() && !i.isChecked);
            if (existing) {
                // Tap on existing item = increment quantity
                existing.quantity += 1;
                this.renderAislePanelProducts(aisleId);
                UI.renderList();
                Utils.showToast(`${name} x${existing.quantity} 🛒`);
                await fetch(`/items/${existing.id}/quantity`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ quantity: existing.quantity, householdId: API.householdId })
                });
            } else {
                // Optimistic update — push immediately so list updates before server responds
                const tempId = Date.now();
                API.items.push({ id: tempId, name, aisleId, storeId: API.currentStoreId, householdId: API.householdId, quantity: 1, isChecked: false, addedBy: API.memberName });
                this.renderAislePanelProducts(aisleId);
                UI.renderList();
                Utils.showToast(`${name} added! 🛒`);
                // Fire API in background — SSE will replace temp item
                API.addItem({ name, aisleId, quantity: 1 }).then(newItem => {
                    if (newItem && newItem.id) {
                        const idx = API.items.findIndex(i => i.id === tempId);
                        if (idx !== -1) API.items.splice(idx, 1); // remove temp, SSE will add real
                    }
                }).catch(() => {
                    API.items = API.items.filter(i => i.id !== tempId);
                    UI.renderList();
                    Utils.showToast('Failed to add item', true);
                });
            }
        } catch(e) {
            Utils.showToast('Failed to add item', true);
        } finally {
            // Release lock after 1 second
            setTimeout(() => {
                if (UI._tapLocks) delete UI._tapLocks[lockKey];
            }, 1000);
            chipEl.style.opacity = '1';
            chipEl.style.pointerEvents = '';
        }
    },

    async toggleFavourite(name, aisleId, btn) {
        const isFav = btn.classList.contains('active');
        try {
            if (isFav) {
                await API.removeFavourite(name);
                btn.classList.remove('active');
                Utils.showToast(`${name} removed from favourites`);
            } else {
                await API.addFavourite(name, aisleId);
                btn.classList.add('active');
                Utils.showToast(`${name} saved as favourite ⭐`);
            }
        } catch(e) { Utils.showToast('Failed to update favourite', true); }
    },

    renderFavourites() {
        const container = document.getElementById('favouritesContainer');
        if (!container) return;

        const favs = API.storeFavourites;

        if (!favs.length) {
            container.innerHTML = `
                <div class="empty-state">
                    <div class="empty-icon">⭐</div>
                    <p>No favourites yet!</p>
                    <p class="empty-sub">Tap ⭐ on any product in an aisle to save it.</p>
                </div>`;
            return;
        }

        // Group by aisle
        const grouped = {};
        favs.forEach(fav => {
            const aisle = API.storeAisles.find(a => a.id === fav.aisle_id);
            const key = aisle ? aisle.name : 'Other';
            if (!grouped[key]) grouped[key] = [];
            grouped[key].push(fav);
        });

        container.innerHTML = Object.entries(grouped).map(([aisleName, items]) => `
            <div class="fav-group">
                <div class="fav-group-header">${aisleName}</div>
                ${items.map(fav => `
                    <div class="fav-item" onclick="UI.addFavToList('${fav.name.replace(/'/g, "\'")}', ${fav.aisle_id})">
                        <span class="fav-item-name">${Utils.escapeHtml(fav.name)}</span>
                        <span class="fav-add-badge">+ Add</span>
                    </div>`).join('')}
            </div>`).join('');
    },

    async addFavToList(name, aisleId) {
        try {
            const existing = API.storeItems.find(i => i.name.toLowerCase() === name.toLowerCase() && !i.isChecked);
            if (existing) {
                existing.quantity += 1;
                UI.renderList();
                await fetch(`/items/${existing.id}/quantity`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ quantity: existing.quantity, householdId: API.householdId })
                });
                Utils.showToast(`${name} x${existing.quantity} 🛒`);
            } else {
                const tempItem = { id: Date.now(), name, aisleId, storeId: API.currentStoreId, householdId: API.householdId, quantity: 1, isChecked: false, addedBy: API.memberName };
                API.items.push(tempItem);
                UI.renderList();
                const newItem = await API.addItem({ name, aisleId, quantity: 1 });
                if (newItem && newItem.id) {
                    const idx = API.items.findIndex(i => i.id === tempItem.id);
                    if (idx !== -1) API.items[idx] = newItem;
                }
                Utils.showToast(`${name} added! 🛒`);
            }
        } catch(e) { Utils.showToast('Failed to add item', true); }
    },

    // ===== ADD / DELETE AISLE =====
    showAddAisle() {
        const modal = document.getElementById('modal');
        const overlay = document.getElementById('modalOverlay');
        modal.innerHTML = `
            <h3>🏪 Add New Aisle</h3>
            <p class="modal-sub">Enter a name for the aisle</p>
            <div style="margin-top:14px;">
                <input type="text" id="newAisleInput" placeholder="e.g. Dairy & Eggs, Bakery..."
                    style="width:100%;padding:12px 14px;border:1.5px solid #e5e7eb;border-radius:10px;font-size:16px;outline:none;"
                    onkeypress="if(event.key==='Enter') UI.saveNewAisle()">
            </div>
            <div class="modal-actions">
                <button class="modal-btn cancel" onclick="Utils.closeModal()">Cancel</button>
                <button class="modal-btn confirm" onclick="UI.saveNewAisle()">Add Aisle</button>
            </div>`;
        overlay.classList.add('show');
        setTimeout(() => document.getElementById('newAisleInput').focus(), 100);
    },

    async saveNewAisle() {
        const input = document.getElementById('newAisleInput');
        const name = input.value.trim();
        if (!name) { Utils.shakeElement(input); return; }
        try {
            await API.addAisle(name);
            Utils.closeModal();
            Utils.showToast(`${name} added!`);
        } catch(e) { Utils.showToast('Failed to add aisle', true); }
    },

    confirmDeleteAisle(aisleId) {
        const aisle = API.storeAisles.find(a => a.id === aisleId);
        if (!aisle) return;
        const modal = document.getElementById('modal');
        const overlay = document.getElementById('modalOverlay');
        modal.innerHTML = `
            <h3>🗑 Delete Aisle</h3>
            <p class="modal-sub">Delete <strong>${Utils.escapeHtml(aisle.name)}</strong>? Its list items will also be removed.</p>
            <div class="modal-actions">
                <button class="modal-btn cancel" onclick="Utils.closeModal()">Cancel</button>
                <button class="modal-btn danger" onclick="UI.deleteAisle(${aisleId})">Delete</button>
            </div>`;
        overlay.classList.add('show');
    },

    async deleteAisle(aisleId) {
        try {
            await API.deleteAisle(aisleId);
            Utils.closeModal();
            Utils.showToast('Aisle deleted');
        } catch(e) { Utils.showToast('Failed to delete aisle', true); }
    },

    // ===== SHOPPING LIST =====
    renderList() {
        const container = document.getElementById('listContainer');
        if (!container) return;
        const items = API.storeItems;
        if (!items.length) {
            container.innerHTML = `<div class="empty-state"><div class="empty-icon">🛒</div><p>List is empty!</p><p class="empty-sub">Tap an aisle to add products.</p></div>`;
            return;
        }
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
            html += `<div class="aisle-group">
                <div class="aisle-group-header"><span>🏪</span><span>${Utils.escapeHtml(aisle.name)}</span><span class="aisle-group-count">${grouped[aisle.id].length}</span></div>
                ${grouped[aisle.id].sort((a,b) => a.name.localeCompare(b.name)).map(item => this.renderItem(item)).join('')}
            </div>`;
        });
        if (noAisle.length) {
            html += `<div class="aisle-group">
                <div class="aisle-group-header"><span>📦</span><span>Other</span><span class="aisle-group-count">${noAisle.length}</span></div>
                ${noAisle.sort((a,b) => a.name.localeCompare(b.name)).map(item => this.renderItem(item)).join('')}
            </div>`;
        }
        container.innerHTML = html;
        this.renderStats();
    },

    renderItem(item) {
        return `<div class="item-card ${item.isChecked ? 'checked' : ''}">
            <div class="checkbox ${item.isChecked ? 'checked' : ''}" onclick="UI.handleCheck(${item.id})">${item.isChecked ? '✓' : ''}</div>
            <div class="item-name ${item.isChecked ? 'crossed' : ''}" onclick="UI.handleCheck(${item.id})">${Utils.escapeHtml(item.name)}</div>
            ${item.quantity > 1 ? `<span class="qty-badge">x${item.quantity}</span>` : ''}
            <button class="del-btn" onclick="UI.handleDelete(${item.id})">🗑</button>
        </div>`;
    },

    async handleCheck(id) {
        try {
            const result = await API.toggleCheck(id);
            if (result && result.isChecked) {
                // Update local state immediately
                const idx = API.items.findIndex(i => i.id === id);
                if (idx !== -1) API.items[idx].isChecked = true;
                this.renderList();
                setTimeout(async () => {
                    try {
                        await API.deleteItem(id);
                        // Remove from local state and re-render
                        API.items = API.items.filter(i => i.id !== id);
                        this.renderList();
                    } catch(e) {
                        API.items = API.items.filter(i => i.id !== id);
                        this.renderList();
                    }
                }, 700);
            }
        } catch(e) {
            console.log('handleCheck error:', e);
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
            </div>`;
        overlay.classList.add('show');
    },

    async confirmDelete(id) {
        try { await API.deleteItem(id); Utils.closeModal(); Utils.showToast('Removed ✓'); }
        catch(e) { Utils.showToast('Failed to remove item', true); }
    },

    // ===== PRODUCT LIBRARY =====
    showManageProducts(aisleId) {
        const aisle = API.storeAisles.find(a => a.id === aisleId);
        if (!aisle) return;
        const modal = document.getElementById('modal');
        const overlay = document.getElementById('modalOverlay');
        const renderList = () => {
            const list = document.getElementById('productLibraryList');
            if (!list) return;
            const a = API.aisles.find(x => x.id === aisleId);
            list.innerHTML = (!a || !a.products.length)
                ? '<p style="color:#9ca3af;font-size:13px;padding:8px 0;">No products yet.</p>'
                : a.products.map(name => `
                    <div class="product-lib-item">
                        <span>${Utils.escapeHtml(name)}</span>
                        <button class="del-btn" onclick="UI.deleteProduct(${aisleId}, '${name.replace(/'/g, "\\'")}')">🗑</button>
                    </div>`).join('');
        };
        modal.innerHTML = `
            <h3>⚙️ ${Utils.escapeHtml(aisle.name)}</h3>
            <p class="modal-sub">Manage products for this aisle</p>
            <div id="productLibraryList" style="margin:14px 0;max-height:240px;overflow-y:auto;"></div>
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
        setTimeout(() => document.getElementById('newProductInput').focus(), 100);
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

    renderTrialBanner() { /* Disabled in private instance */ },

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
            // Re-render aisle panel if open
            if (this.currentAislePanel === aisleId) this.renderAislePanelProducts(aisleId);
        } catch(e) { Utils.showToast('Failed to delete product', true); }
    }
};
