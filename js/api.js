const API = {
    items: [],
    aisles: [],
    eventSource: null,

    connectSSE() {
        console.log('Connecting SSE...');
        this.eventSource = new EventSource('/events');

        this.eventSource.addEventListener('init', (e) => {
            const data = JSON.parse(e.data);
            this.items = data.items;
            this.aisles = data.aisles;
            console.log('Received init event:', this.items.length, 'items,', this.aisles.length, 'aisles');
            UI.render();
            Utils.updateConnectionBadge(true);
        });

        this.eventSource.addEventListener('newItem', (e) => {
            const item = JSON.parse(e.data);
            this.items.push(item);
            UI.render();
        });

        this.eventSource.addEventListener('updateItem', (e) => {
            const item = JSON.parse(e.data);
            const idx = this.items.findIndex(i => i.id === item.id);
            if (idx !== -1) this.items[idx] = item;
            UI.render();
        });

        this.eventSource.addEventListener('deleteItem', (e) => {
            const { id } = JSON.parse(e.data);
            this.items = this.items.filter(i => i.id !== id);
            UI.render();
        });

        this.eventSource.addEventListener('updateAisle', (e) => {
            const aisle = JSON.parse(e.data);
            const idx = this.aisles.findIndex(a => a.id === aisle.id);
            if (idx !== -1) this.aisles[idx] = aisle;
            UI.render();
        });

        this.eventSource.onerror = () => {
            Utils.updateConnectionBadge(false);
            setTimeout(() => this.connectSSE(), 5000);
        };
    },

    async addItem(data) {
        const response = await fetch('/items', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        if (!response.ok) throw new Error('Failed to add item');
        return await response.json();
    },

    async toggleCheck(id) {
        const response = await fetch(`/items/${id}/check`, { method: 'POST' });
        if (!response.ok) throw new Error('Failed to toggle check');
        return await response.json();
    },

    async toggleFavourite(id) {
        const response = await fetch(`/items/${id}/favourite`, { method: 'POST' });
        if (!response.ok) throw new Error('Failed to toggle favourite');
        return await response.json();
    },

    async deleteItem(id) {
        const response = await fetch(`/items/${id}/delete`, { method: 'POST' });
        if (!response.ok) throw new Error('Failed to delete item');
        return await response.json();
    },

    async clearChecked() {
        const response = await fetch('/items/clear-checked', { method: 'POST' });
        if (!response.ok) throw new Error('Failed to clear checked items');
        return await response.json();
    },

    async addProduct(aisleId, name) {
        const response = await fetch(`/aisles/${aisleId}/products`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name })
        });
        if (!response.ok) throw new Error('Failed to add product');
        return await response.json();
    },

    async deleteProduct(aisleId, name) {
        const response = await fetch(`/aisles/${aisleId}/products/delete`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name })
        });
        if (!response.ok) throw new Error('Failed to delete product');
        return await response.json();
    },

    startKeepAlive() {
        setInterval(() => {
            fetch('/items').catch(() => {});
        }, 10 * 60 * 1000);
    }
};
