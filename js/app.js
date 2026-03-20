const App = {
    wakeLock: null,

    async requestWakeLock() {
        try {
            if (screen.orientation && screen.orientation.lock) {
                await screen.orientation.lock('portrait').catch(() => {});
            }
            if ('wakeLock' in navigator) {
                this.wakeLock = await navigator.wakeLock.request('screen');
                console.log('Screen wake lock active');
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
            if (screen.orientation && screen.orientation.unlock) {
                screen.orientation.unlock();
            }
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
        console.log('BasketMate initializing...');
        this.setupEventListeners();
        this.showSplash();

        // Check if household already saved
        const hasHousehold = API.loadHousehold();
        if (hasHousehold) {
            // Load member name
            API.memberName = localStorage.getItem('bm_member_name') || 'Someone';
            // Returning user — dismiss splash then connect
            setTimeout(() => {
                const splash = document.getElementById('splashScreen');
                if (splash) { splash.classList.add('fade-out'); setTimeout(() => { splash.style.display = 'none'; }, 600); }
            }, 1800);
            API.connectSSE();
            API.startKeepAlive();
            setTimeout(() => this.setupPushNotifications(), 4000);
        } else {
            // New user — show household setup after splash
            setTimeout(() => this.showHouseholdSetup(), 2200);
        }
    },

    showSplash() {
        const splash = document.getElementById('splashScreen');
        const storesContainer = document.getElementById('splashStores');
        if (!splash) return;

        const stores = [
            { name: 'Tesco',        color: '#005EA5', domain: 'tesco.com' },
            { name: 'Iceland',      color: '#D61F26', domain: 'iceland.co.uk' },
            { name: 'Lidl',         color: '#0050AA', domain: 'lidl.co.uk' },
            { name: "Sainsbury's",  color: '#F47920', domain: 'sainsburys.co.uk' },
            { name: 'B&M',          color: '#6B2D8B', domain: 'bmstores.co.uk' },
            { name: 'Asda',         color: '#78BE20', domain: 'asda.com' },
            { name: 'Morrisons',    color: '#00AA4F', domain: 'morrisons.com' },
            { name: 'M&S',          color: '#000000', domain: 'marksandspencer.com' },
            { name: 'Aldi',         color: '#003082', domain: 'aldi.co.uk' },
        ];

        storesContainer.innerHTML = stores.map((store, i) => {
            const initials = store.name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0,2);
            return `
                <div class="splash-store" style="animation-delay:${0.4 + i * 0.12}s">
                    <div class="splash-store-avatar" id="splash-avatar-${i}" style="background:white;">
                        <img src="https://www.google.com/s2/favicons?domain=${store.domain}&sz=128"
                            alt="${store.name}"
                            data-idx="${i}" data-color="${store.color}" data-initials="${initials}"
                            onerror="var el=document.getElementById('splash-avatar-'+this.dataset.idx);el.style.background=this.dataset.color;el.innerHTML=this.dataset.initials;"
                            style="width:36px;height:36px;object-fit:contain;border-radius:4px;">
                    </div>
                    <span class="splash-store-name">${store.name}</span>
                </div>`;
        }).join('');
    },

    // ===== HOUSEHOLD SETUP SCREEN =====
    showHouseholdSetup() {
        const splash = document.getElementById('splashScreen');
        if (splash) {
            splash.classList.add('fade-out');
            setTimeout(() => { splash.style.display = 'none'; }, 600);
        }

        const overlay = document.getElementById('modalOverlay');
        const modal   = document.getElementById('modal');

        modal.innerHTML = `
            <div style="text-align:center;padding:8px 0 16px;">
                <div style="font-size:48px;margin-bottom:12px;">🛒</div>
                <h2 style="margin:0 0 6px;font-size:22px;color:#1a1a2e;">Welcome to BasketMate</h2>
                <p style="color:#6b7280;font-size:14px;margin:0 0 24px;">Create a household to get started,<br>or join an existing one with a code.</p>

                <button onclick="App.createHousehold()"
                    style="width:100%;padding:14px;background:#005EA5;color:white;border:none;border-radius:12px;font-size:16px;font-weight:700;cursor:pointer;margin-bottom:12px;">
                    ✨ Create New Household
                </button>

                <div style="position:relative;margin-bottom:12px;">
                    <div style="height:1px;background:#e5e7eb;"></div>
                    <span style="position:absolute;top:-10px;left:50%;transform:translateX(-50%);background:white;padding:0 12px;color:#9ca3af;font-size:13px;">or</span>
                </div>

                <div style="display:flex;gap:8px;">
                    <input type="text" id="joinCodeInput"
                        placeholder="Enter household code"
                        maxlength="6"
                        style="flex:1;padding:13px 14px;border:1.5px solid #e5e7eb;border-radius:12px;font-size:16px;text-transform:uppercase;letter-spacing:2px;outline:none;text-align:center;"
                        oninput="this.value=this.value.toUpperCase()">
                    <button onclick="App.joinHousehold()"
                        style="padding:13px 18px;background:#16a34a;color:white;border:none;border-radius:12px;font-size:15px;font-weight:700;cursor:pointer;">
                        Join
                    </button>
                </div>
                <p id="householdError" style="color:#dc2626;font-size:13px;margin:8px 0 0;display:none;"></p>
            </div>`;

        overlay.classList.add('show');
        // Prevent closing by clicking outside
        overlay.onclick = null;
    },

    async createHousehold() {
        try {
            const btn = document.querySelector('#modal button');
            if (btn) { btn.disabled = true; btn.textContent = 'Creating...'; }
            const data = await API.createHousehold();
            this.showHouseholdCode(data.code);
        } catch(e) {
            Utils.showToast('Failed to create household', true);
            const btn = document.querySelector('#modal button');
            if (btn) { btn.disabled = false; btn.textContent = '✨ Create New Household'; }
        }
    },

    showHouseholdCode(code) {
        const modal = document.getElementById('modal');
        modal.innerHTML = `
            <div style="text-align:center;padding:8px 0 16px;">
                <div style="font-size:48px;margin-bottom:12px;">🏠</div>
                <h2 style="margin:0 0 6px;font-size:22px;color:#1a1a2e;">Your Household Code</h2>
                <p style="color:#6b7280;font-size:14px;margin:0 0 20px;">Share this code with your family so they can join your list.</p>

                <div style="background:#f0f9ff;border:2px solid #005EA5;border-radius:16px;padding:20px;margin-bottom:20px;">
                    <div style="font-size:36px;font-weight:900;letter-spacing:8px;color:#005EA5;font-family:monospace;">${code}</div>
                </div>

                <p style="color:#9ca3af;font-size:12px;margin:0 0 20px;">You can find this code later in the app settings.</p>

                <button onclick="App.showNameSetup()"
                    style="width:100%;padding:14px;background:#005EA5;color:white;border:none;border-radius:12px;font-size:16px;font-weight:700;cursor:pointer;">
                    Next →
                </button>
            </div>`;
    },

    showNameSetup() {
        const modal = document.getElementById('modal');
        modal.innerHTML = `
            <div style="text-align:center;padding:8px 0 16px;">
                <div style="font-size:48px;margin-bottom:12px;">👤</div>
                <h2 style="margin:0 0 6px;font-size:22px;color:#1a1a2e;">What's your name?</h2>
                <p style="color:#6b7280;font-size:14px;margin:0 0 20px;">So your family knows who added items to the list.</p>
                <input type="text" id="memberNameInput"
                    placeholder="e.g. Andreas, Sharon..."
                    maxlength="20"
                    style="width:100%;padding:14px;border:1.5px solid #e5e7eb;border-radius:12px;font-size:18px;outline:none;text-align:center;margin-bottom:16px;box-sizing:border-box;">
                <p id="nameError" style="color:#dc2626;font-size:13px;margin:0 0 12px;display:none;">Please enter your name.</p>
                <button onclick="App.saveMemberName()"
                    style="width:100%;padding:14px;background:#005EA5;color:white;border:none;border-radius:12px;font-size:16px;font-weight:700;cursor:pointer;">
                    Let's Go! 🛒
                </button>
            </div>`;
        setTimeout(() => document.getElementById('memberNameInput')?.focus(), 100);
    },

    saveMemberName() {
        const input = document.getElementById('memberNameInput');
        const name = input.value.trim();
        if (!name) {
            document.getElementById('nameError').style.display = 'block';
            input.style.borderColor = '#dc2626';
            return;
        }
        localStorage.setItem('bm_member_name', name);
        API.memberName = name;
        this.startApp();
    },

    async joinHousehold() {
        const input = document.getElementById('joinCodeInput');
        const error = document.getElementById('householdError');
        const code  = input.value.trim().toUpperCase();

        if (code.length < 6) {
            input.style.borderColor = '#dc2626';
            error.textContent = 'Please enter a 6-character code.';
            error.style.display = 'block';
            return;
        }

        try {
            input.disabled = true;
            error.style.display = 'none';
            await API.joinHousehold(code);
            Utils.showToast('Joined household! 🏠');
            this.showNameSetup();
        } catch(e) {
            input.disabled = false;
            input.style.borderColor = '#dc2626';
            error.textContent = 'Household not found. Check the code and try again.';
            error.style.display = 'block';
        }
    },

    startApp() {
        const overlay = document.getElementById('modalOverlay');
        overlay.classList.remove('show');
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) Utils.closeModal();
        });
        API.connectSSE();
        API.startKeepAlive();
        // Request push notification permission after a short delay
        setTimeout(() => this.setupPushNotifications(), 3000);
    },

    async setupPushNotifications() {
        if (!('Notification' in window) || !('serviceWorker' in navigator)) return;
        if (Notification.permission === 'denied') return;

        try {
            const permission = await Notification.requestPermission();
            if (permission !== 'granted') return;

            const reg = await navigator.serviceWorker.ready;

            // Get VAPID public key from server
            const r = await fetch('/push/vapid-key');
            const { publicKey } = await r.json();

            // Subscribe
            const subscription = await reg.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: this.urlBase64ToUint8Array(publicKey)
            });

            // Save subscription to server
            await fetch('/push/subscribe', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ subscription, householdId: API.householdId })
            });

            console.log('Push notifications enabled!');
        } catch(e) {
            console.log('Push setup failed:', e);
        }
    },

    urlBase64ToUint8Array(base64String) {
        const padding = '='.repeat((4 - base64String.length % 4) % 4);
        const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
        const rawData = window.atob(base64);
        return new Uint8Array([...rawData].map(c => c.charCodeAt(0)));
    },

    showOnboarding() {
        const splash = document.getElementById('splashScreen');
        const ob = document.getElementById('onboardingScreen');
        ob.style.display = 'flex';
        splash.classList.add('fade-out');
        setTimeout(() => { splash.style.display = 'none'; }, 600);
    },

    nextSlide() {
        const slides = document.querySelectorAll('.ob-slide');
        const dots   = document.querySelectorAll('.ob-dot');
        const btn    = document.getElementById('obNextBtn');
        let current  = [...slides].findIndex(s => s.classList.contains('active'));
        const next   = current + 1;

        if (next >= slides.length) {
            this.dismissSplash();
            return;
        }

        slides[current].classList.remove('active');
        slides[next].classList.add('active');
        dots[current].classList.remove('active');
        dots[next].classList.add('active');

        btn.textContent = next === slides.length - 1 ? 'Get Started →' : 'Next →';
    },

    dismissSplash() {
        const ob = document.getElementById('onboardingScreen');
        if (!ob) return;
        ob.classList.add('fade-out');
        setTimeout(() => { ob.style.display = 'none'; }, 600);
    },

    setupEventListeners() {
        document.getElementById('modalOverlay').addEventListener('click', (e) => {
            if (e.target === document.getElementById('modalOverlay')) Utils.closeModal();
        });
    },

    // ===== SMART HOME BUTTON =====
    smartHome() {
        const aislePanel = document.getElementById('aislePanelOverlay');
        if (aislePanel.classList.contains('show')) {
            UI.closeAislePanel();
            return;
        }
        const shopMode = document.getElementById('shoppingModeOverlay');
        if (!shopMode.classList.contains('hidden')) {
            this.closeShoppingMode();
            if (UI.lastAislePanel) {
                setTimeout(() => UI.openAislePanel(UI.lastAislePanel), 50);
            }
            return;
        }
        if (API.currentStoreId) {
            this.goHome();
            return;
        }
    },

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
            storeTitle.innerHTML = `
                <img src="https://www.google.com/s2/favicons?domain=${logoDomain}&sz=128"
                    alt="${store.name}"
                    onerror="this.style.display='none'"
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
    },

    goHome() {
        API.currentStoreId = null;
        document.getElementById('storeScreen').classList.add('hidden');
        document.getElementById('homeScreen').classList.remove('hidden');
        document.getElementById('navStoreScreen').classList.add('hidden');
        document.getElementById('navHomeScreen').classList.remove('hidden');
        this.releaseWakeLock();
    },

    // ===== SHOPPING MODE =====
    openShoppingMode() { this.enterShoppingMode(); },

    enterShoppingMode() {
        const overlay = document.getElementById('shoppingModeOverlay');
        if (!overlay) return;
        overlay.classList.remove('hidden');
        // Update header title
        const title = document.getElementById('shoppingModeTitle');
        const stats = document.getElementById('shoppingModeStats');
        if (title) title.textContent = 'All Shopping Lists';
        const totalItems = API.items.filter(i => !i.isChecked).length;
        if (stats) stats.textContent = `${totalItems} item${totalItems !== 1 ? 's' : ''}`;
        this.renderShoppingModeList();
        UI.closeAislePanel();
        UI.lastAislePanel = null;
    },

    closeShoppingMode() {
        const overlay = document.getElementById('shoppingModeOverlay');
        if (overlay) overlay.classList.add('hidden');
    },

    renderShoppingModeList() {
        const container = document.getElementById('shoppingModeList');
        if (!container) return;

        // Get all unchecked items across ALL stores
        const allItems = API.items.filter(i => !i.isChecked);

        if (!allItems.length) {
            container.innerHTML = `<div style="text-align:center;padding:40px 20px;color:#9ca3af;">
                <div style="font-size:48px;margin-bottom:12px;">✅</div>
                <p>All done! Your list is empty.</p>
            </div>`;
            return;
        }

        // Group items by store
        const storeGroups = {};
        allItems.forEach(item => {
            if (!storeGroups[item.storeId]) storeGroups[item.storeId] = [];
            storeGroups[item.storeId].push(item);
        });

        let html = '';

        // Render each store that has items
        API.stores.forEach(store => {
            const storeItems = storeGroups[store.id];
            if (!storeItems || !storeItems.length) return;

            const logoDomain = UI.getStoreLogo(store.name);

            // Store header
            html += `<div class="shop-store-header" style="background:${store.color};">
                <div style="display:flex;align-items:center;gap:10px;">
                    ${logoDomain ? `<img src="https://www.google.com/s2/favicons?domain=${logoDomain}&sz=64"
                        onerror="this.style.display='none'"
                        style="width:24px;height:24px;border-radius:4px;background:white;padding:2px;object-fit:contain;">` : ''}
                    <span style="font-size:16px;font-weight:700;color:white;">${Utils.escapeHtml(store.name)}</span>
                    <span style="font-size:13px;color:rgba(255,255,255,0.75);margin-left:auto;">${storeItems.length} item${storeItems.length > 1 ? 's' : ''}</span>
                </div>
            </div>`;

            // Group by aisle within this store
            const grouped = {};
            const noAisle = [];
            storeItems.forEach(item => {
                if (item.aisleId) {
                    if (!grouped[item.aisleId]) grouped[item.aisleId] = [];
                    grouped[item.aisleId].push(item);
                } else {
                    noAisle.push(item);
                }
            });

            const storeAisles = API.aisles
                .filter(a => a.storeId === store.id && grouped[a.id])
                .sort((a, b) => a.sortOrder - b.sortOrder);

            storeAisles.forEach(aisle => {
                html += `<div class="shop-aisle-group">
                    <div class="shop-aisle-header">${Utils.escapeHtml(aisle.name)}</div>
                    ${grouped[aisle.id].sort((a,b) => a.name.localeCompare(b.name)).map(item => this.renderShopItem(item)).join('')}
                </div>`;
            });

            if (noAisle.length) {
                html += `<div class="shop-aisle-group">
                    <div class="shop-aisle-header">Other</div>
                    ${noAisle.sort((a,b) => a.name.localeCompare(b.name)).map(item => this.renderShopItem(item)).join('')}
                </div>`;
            }
        });

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
            const result = await API.toggleCheck(id);
            if (result && result.isChecked) {
                const idx = API.items.findIndex(i => i.id === id);
                if (idx !== -1) API.items[idx].isChecked = true;
                this.renderShoppingModeList();
                setTimeout(async () => {
                    try { await API.deleteItem(id); } catch(e) {}
                    API.items = API.items.filter(i => i.id !== id);
                    this.renderShoppingModeList();
                }, 700);
            } else {
                this.renderShoppingModeList();
            }
        } catch(e) { console.log('toggleShopItem error:', e); }
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

    // ===== IN-APP ITEM ALERT =====
    showItemAlert(addedBy, itemName, storeName) {
        const modal = document.getElementById('modal');
        const overlay = document.getElementById('modalOverlay');
        modal.innerHTML = `
            <div style="text-align:center;padding:8px 0 16px;">
                <div style="font-size:48px;margin-bottom:12px;">🛒</div>
                <h3 style="margin:0 0 8px;font-size:20px;color:#1a1a2e;">${Utils.escapeHtml(addedBy)} added something!</h3>
                <p style="color:#6b7280;font-size:16px;margin:0 0 20px;">
                    <strong style="color:#005EA5;">${Utils.escapeHtml(itemName)}</strong> was added to <strong>${Utils.escapeHtml(storeName)}</strong>
                </p>
                <button onclick="Utils.closeModal()"
                    style="width:100%;padding:14px;background:#005EA5;color:white;border:none;border-radius:12px;font-size:16px;font-weight:700;cursor:pointer;">
                    OK
                </button>
            </div>`;
        overlay.classList.add('show');
    },

    // ===== HOUSEHOLD CODE — VIEW =====
    showMyCode() {
        const modal = document.getElementById('modal');
        const overlay = document.getElementById('modalOverlay');
        modal.innerHTML = `
            <div style="text-align:center;padding:8px 0 16px;">
                <div style="font-size:40px;margin-bottom:10px;">🏠</div>
                <h3 style="margin:0 0 6px;">Your Household Code</h3>
                <p style="color:#6b7280;font-size:14px;margin:0 0 18px;">Share this with family to join your list.</p>
                <div style="background:#f0f9ff;border:2px solid #005EA5;border-radius:16px;padding:18px;margin-bottom:16px;">
                    <div style="font-size:32px;font-weight:900;letter-spacing:8px;color:#005EA5;font-family:monospace;">${API.householdCode}</div>
                </div>
                <button class="modal-btn cancel" onclick="Utils.closeModal()">Close</button>
            </div>`;
        overlay.classList.add('show');
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
