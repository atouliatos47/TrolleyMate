const API = {
    stores: [],
    aisles: [],
    items: [],
    currentStoreId: null,
    eventSource: null,

    get storeAisles() {
        return this.aisles.filter(a => a.storeId === this.currentStoreId);
    },

    get storeItems() {
        return this.items.filter(i => i.storeId === this.currentStoreId);
    },

    connectSSE() {
        // Close existing connection first
        if (this.eventSource) {
            this.eventSource.close();
            this.eventSource = null;
        }
        console.log('Connecting SSE...');
        this.eventSource = new EventSource('/events');

        this.eventSource.addEventListener('init', (e) => {
            const data = JSON.parse(e.data);
            this.stores = data.stores;
            this.aisles = data.aisles;
            this.items  = data.items;
            console.log('Init:', this.stores.length, 'stores,', this.aisles.length, 'aisles,', this.items.length, 'items');
            UI.renderHome();
            const badge = document.getElementById('connectionBadge');
            if (badge) { badge.textContent = '● Live'; }
        });

        this.eventSource.addEventListener('newStore', (e) => {
            this.stores.push(JSON.parse(e.data));
            UI.renderHome();
        });

        this.eventSource.addEventListener('deleteStore', (e) => {
            const { id } = JSON.parse(e.data);
            this.stores = this.stores.filter(s => s.id !== id);
            this.aisles = this.aisles.filter(a => a.storeId !== id);
            this.items  = this.items.filter(i => i.storeId !== id);
            UI.renderHome();
        });

        this.eventSource.addEventListener('newAisle', (e) => {
            const aisle = JSON.parse(e.data);
            this.aisles.push(aisle);
            if (aisle.storeId === this.currentStoreId) UI.renderAisles();
        });

        this.eventSource.addEventListener('updateAisle', (e) => {
            const aisle = JSON.parse(e.data);
            const idx = this.aisles.findIndex(a => a.id === aisle.id);
            if (idx !== -1) this.aisles[idx] = aisle;
            if (aisle.storeId === this.currentStoreId) UI.renderAisles();
        });

        this.eventSource.addEventListener('deleteAisle', (e) => {
            const { id } = JSON.parse(e.data);
            this.aisles = this.aisles.filter(a => a.id !== id);
            UI.renderAisles();
        });

        this.eventSource.addEventListener('newItem', (e) => {
            const item = JSON.parse(e.data);
            this.items.push(item);
            if (item.storeId === this.currentStoreId) UI.renderList();
            UI.renderHome();
        });

        this.eventSource.addEventListener('updateItem', (e) => {
            const item = JSON.parse(e.data);
            const idx = this.items.findIndex(i => i.id === item.id);
            if (idx !== -1) this.items[idx] = item;
            if (item.storeId === this.currentStoreId) UI.renderList();
        });

        this.eventSource.addEventListener('deleteItem', (e) => {
            const { id } = JSON.parse(e.data);
            this.items = this.items.filter(i => i.id !== id);
            UI.renderList();
            UI.renderHome();
        });

        this.eventSource.onerror = () => {
            const badge = document.getElementById('connectionBadge');
            if (badge) { badge.textContent = '○ Offline'; badge.style.color = 'rgba(255,255,255,0.5)'; }
            this.eventSource.close();
            this.eventSource = null;
            // Reconnect after 3 seconds
            setTimeout(() => this.connectSSE(), 3000);
        };

        this.eventSource.onopen = () => {
            const badge = document.getElementById('connectionBadge');
            if (badge) { badge.textContent = '● Live'; badge.style.color = ''; }
        };
    },

    // ===== STORE METHODS =====
    async addStore(data) {
        const r = await fetch('/stores', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        if (!r.ok) throw new Error('Failed to add store');
        return await r.json();
    },

    async deleteStore(id) {
        const r = await fetch(`/stores/${id}/delete`, { method: 'POST' });
        if (!r.ok) throw new Error('Failed to delete store');
        return await r.json();
    },

    // ===== AISLE METHODS =====
    async addAisle(name) {
        const r = await fetch('/aisles', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, storeId: this.currentStoreId })
        });
        if (!r.ok) throw new Error('Failed to add aisle');
        return await r.json();
    },

    async reorderAisles(order) {
        const r = await fetch('/aisles/reorder', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ order })
        });
        if (!r.ok) throw new Error('Failed to reorder aisles');
        return await r.json();
    },

    async deleteAisle(id) {
        const r = await fetch(`/aisles/${id}/delete`, { method: 'POST' });
        if (!r.ok) throw new Error('Failed to delete aisle');
        return await r.json();
    },

    async addProduct(aisleId, name) {
        const r = await fetch(`/aisles/${aisleId}/products`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name })
        });
        if (!r.ok) throw new Error('Failed to add product');
        return await r.json();
    },

    async deleteProduct(aisleId, name) {
        const r = await fetch(`/aisles/${aisleId}/products/delete`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name })
        });
        if (!r.ok) throw new Error('Failed to delete product');
        return await r.json();
    },

    // ===== ITEM METHODS =====
    async addItem(data) {
        const r = await fetch('/items', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ...data, storeId: this.currentStoreId })
        });
        if (!r.ok) throw new Error('Failed to add item');
        return await r.json();
    },

    async toggleCheck(id) {
        const r = await fetch(`/items/${id}/check`, { method: 'POST' });
        if (!r.ok && r.status !== 404) throw new Error('Failed to toggle check');
        return r.status === 404 ? null : await r.json();
    },

    async deleteItem(id) {
        const r = await fetch(`/items/${id}/delete`, { method: 'POST' });
        // Ignore 404 — item may have already been deleted
        if (!r.ok && r.status !== 404) throw new Error('Failed to delete item');
        return r.status === 404 ? { success: true } : await r.json();
    },

    async clearChecked() {
        const r = await fetch('/items/clear-checked', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ storeId: this.currentStoreId })
        });
        if (!r.ok) throw new Error('Failed to clear checked');
        return await r.json();
    },

    startKeepAlive() {
        setInterval(() => fetch('/items').catch(() => {}), 10 * 60 * 1000);
    }
};
