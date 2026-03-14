const App = {

    init() {
        console.log('TrolleyMate initializing...');
        this.setupEventListeners();
        API.connectSSE();
        API.startKeepAlive();
    },

    setupEventListeners() {
        // Close modal on overlay click
        document.getElementById('modalOverlay').addEventListener('click', (e) => {
            if (e.target === document.getElementById('modalOverlay')) {
                Utils.closeModal();
            }
        });

        // Add item on Enter key
        document.getElementById('itemInput').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') App.addItem();
        });

        // Tab switching
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const tab = btn.dataset.tab;
                UI.switchTab(tab);
            });
        });
    },

    async addItem() {
        const input = document.getElementById('itemInput');
        const aisleSelect = document.getElementById('aisleSelect');
        const name = input.value.trim();

        if (!name) {
            Utils.shakeElement(input);
            return;
        }

        try {
            await API.addItem({
                name,
                aisleId: aisleSelect.value || null,
                quantity: 1
            });
            input.value = '';
            aisleSelect.value = '';
            Utils.showToast(`${name} added! 🛒`);
        } catch (e) {
            Utils.showToast('Failed to add item', true);
        }
    },

    async clearChecked() {
        const checked = API.items.filter(i => i.isChecked);
        if (!checked.length) {
            Utils.showToast('No checked items to clear!', true);
            return;
        }

        const modal = document.getElementById('modal');
        const overlay = document.getElementById('modalOverlay');

        modal.innerHTML = `
            <h3>🗑 Clear Checked Items</h3>
            <p class="modal-sub">${checked.length} item${checked.length > 1 ? 's' : ''} will be removed from your list.</p>
            <div class="modal-actions">
                <button class="modal-btn cancel" onclick="Utils.closeModal()">Cancel</button>
                <button class="modal-btn danger" onclick="App.confirmClearChecked()">Clear All</button>
            </div>
        `;
        overlay.classList.add('show');
    },

    async confirmClearChecked() {
        try {
            await API.clearChecked();
            Utils.closeModal();
            Utils.showToast('Checked items cleared! ✓');
        } catch (e) {
            Utils.showToast('Failed to clear items', true);
        }
    }

};

document.addEventListener('DOMContentLoaded', () => App.init());
