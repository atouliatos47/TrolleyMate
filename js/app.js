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
            Utils.showToast('Checked items cleared! ✓');
        } catch(e) {
            Utils.showToast('Failed to clear items', true);
        }
    }
};

document.addEventListener('DOMContentLoaded', () => App.init());
