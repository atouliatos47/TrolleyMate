// ===================================================
// app.js — Core: init, splash, household, push
// ===================================================
const App = {
    wakeLock: null,

    async requestWakeLock() {
        try {
            if (screen.orientation && screen.orientation.lock) {
                await screen.orientation.lock('portrait').catch(() => { });
            }
            if ('wakeLock' in navigator) {
                this.wakeLock = await navigator.wakeLock.request('screen');
                console.log('Screen wake lock active');
                // Only add the listener once
                if (!this._wakeLockListenerAdded) {
                    this._wakeLockListenerAdded = true;
                    document.addEventListener('visibilitychange', async () => {
                        if (document.visibilityState === 'visible' && this.wakeLock === null) {
                            await this.requestWakeLock();
                        }
                    });
                }
            }
        } catch (e) { console.log('Wake lock not available:', e); }
    },

    async releaseWakeLock() {
        try {
            if (screen.orientation && screen.orientation.unlock) screen.orientation.unlock();
            if (this.wakeLock) {
                await this.wakeLock.release();
                this.wakeLock = null;
            }
        } catch (e) { console.log('Wake lock release error:', e); }
    },

    init() {
        console.log('BasketMate initializing...');
        this.setupEventListeners();
        this.showSplash();

        const hasHousehold = API.loadHousehold();
        const hasLanguage = !!localStorage.getItem('bm_language');

        if (hasHousehold) {
            API.memberName = localStorage.getItem('bm_member_name') || 'Someone';
            setTimeout(() => {
                const splash = document.getElementById('splashScreen');
                if (splash) { splash.classList.add('fade-out'); setTimeout(() => { splash.style.display = 'none'; }, 600); }
            }, 1800);
            if (!hasLanguage) {
                // Existing user but no language set — show picker first
                setTimeout(() => this.showLanguageFirst(), 2200);
            } else {
                this.applyTranslations(); // ← ADD THIS LINE
                API.connectSSE();
                API.startKeepAlive();
                setTimeout(() => this.setupPushNotifications(), 4000);
            }
        } else {
            setTimeout(() => this.showLanguageFirst(), 2200);
        }
    },

    applyTranslations() {
        const labels = {
            'navLabelMyCode': 'myCode',
            'navLabelAddStore': 'addStore',
            'navLabelMyList': 'myList',
            'navLabelMyList2': 'myList',
            'navLabelMyList3': 'myList',
            'navLabelAddProduct': 'addProduct',
            'aislesHeader': 'aisles',
            'aislesSubHeader': 'tapAisleToAdd',
            'tabListLabel': 'list',
            'tabFavsLabel': 'favourites',
        };
        Object.entries(labels).forEach(([id, key]) => {
            const el = document.getElementById(id);
            if (el) el.textContent = t(key);
        });
        // Fix aisles header emoji
        const aislesHeader = document.getElementById('aislesHeader');
        if (aislesHeader) aislesHeader.innerHTML = '🏪 ' + t('aisles');
        // Shopping mode label
        const shopLabel = document.getElementById('shoppingModeLabel');
        if (shopLabel) shopLabel.textContent = t('shoppingList');
        const homeSub = document.querySelector('.home-sub');
        if (homeSub) homeSub.textContent = t('whereShoppingToday');
        const settingsTitle = document.querySelector('.settings-title');
        if (settingsTitle) settingsTitle.textContent = t('settings');
    },

    showSplash() {
        const splash = document.getElementById('splashScreen');
        const storesContainer = document.getElementById('splashStores');
        if (!splash) return;
        const stores = [
            { name: 'Tesco', color: '#005EA5', domain: 'tesco.com' },
            { name: 'Iceland', color: '#D61F26', domain: 'iceland.co.uk' },
            { name: 'Lidl', color: '#0050AA', domain: 'lidl.co.uk' },
            { name: "Sainsbury's", color: '#F47920', domain: 'sainsburys.co.uk' },
            { name: 'B&M', color: '#6B2D8B', domain: 'bmstores.co.uk' },
            { name: 'Asda', color: '#78BE20', domain: 'asda.com' },
            { name: 'Morrisons', color: '#00AA4F', domain: 'morrisons.com' },
            { name: 'M&S', color: '#000000', domain: 'marksandspencer.com' },
            { name: 'Aldi', color: '#003082', domain: 'aldi.co.uk' },
            { name: 'Co-op', color: '#00B1A9', domain: 'coop.co.uk' },
        ];
        storesContainer.innerHTML = stores.map((store, i) => {
            const initials = store.name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
            return `<div class="splash-store" style="animation-delay:${0.4 + i * 0.12}s">
                <div class="splash-store-avatar" id="splash-avatar-${i}" style="background:white;">
                    <img src="https://www.google.com/s2/favicons?domain=${store.domain}&sz=128" alt="${store.name}"
                        data-idx="${i}" data-color="${store.color}" data-initials="${initials}"
                        onerror="var el=document.getElementById('splash-avatar-'+this.dataset.idx);el.style.background=this.dataset.color;el.innerHTML=this.dataset.initials;"
                        style="width:36px;height:36px;object-fit:contain;border-radius:4px;">
                </div>
                <span class="splash-store-name">${store.name}</span>
            </div>`;
        }).join('');
    },

    showLanguageFirst() {
        // If language already set, skip straight to household setup
        if (localStorage.getItem('bm_language')) {
            this.showHouseholdSetup();
            return;
        }
        const splash = document.getElementById('splashScreen');
        if (splash) { splash.classList.add('fade-out'); setTimeout(() => { splash.style.display = 'none'; }, 600); }
        const overlay = document.getElementById('modalOverlay');
        const modal = document.getElementById('modal');
        const langOptions = LANGUAGES.map(l =>
            `<button onclick="App.pickLanguage('${l.code}')" id="langpick-${l.code}"
                style="display:flex;align-items:center;gap:12px;padding:14px 16px;border:2px solid #e5e7eb;border-radius:12px;background:white;font-size:16px;cursor:pointer;text-align:left;width:100%;margin-bottom:8px;">
                <span style="font-size:28px;">${l.flag}</span>
                <span style="font-weight:600;color:#1a1a2e;">${l.name}</span>
            </button>`
        ).join('');
        modal.innerHTML = `
            <div style="text-align:center;padding:8px 0 16px;">
                <div style="font-size:48px;margin-bottom:12px;">🌍</div>
                <h2 style="margin:0 0 6px;font-size:22px;color:#1a1a2e;">Choose Your Language</h2>
                <p style="color:#6b7280;font-size:14px;margin:0 0 20px;">Select your preferred language to continue.</p>
                <div style="text-align:left;">
                    ${langOptions}
                </div>
            </div>`;
        overlay.classList.add('show');
        overlay.onclick = null;
    },

    pickLanguage(code) {
        localStorage.setItem('bm_language', code);
        window.dispatchEvent(new Event('languageChanged'));  // <-- ADDED
        document.body.dir = code === 'ur' ? 'rtl' : 'ltr';
        App.applyTranslations();
        const overlay = document.getElementById('modalOverlay');
        overlay.classList.remove('show');
        // If household already exists, connect SSE. Otherwise show household setup.
        if (API.householdId) {
            API.connectSSE();
            API.startKeepAlive();
            setTimeout(() => App.setupPushNotifications(), 3000);
        } else {
            setTimeout(() => App.showHouseholdSetup(), 200);
        }
    },

    showHouseholdSetup() {
        const splash = document.getElementById('splashScreen');
        if (splash) { splash.classList.add('fade-out'); setTimeout(() => { splash.style.display = 'none'; }, 600); }
        const overlay = document.getElementById('modalOverlay');
        const modal = document.getElementById('modal');
        modal.innerHTML = `
            <div style="text-align:center;padding:8px 0 16px;">
                <div style="font-size:48px;margin-bottom:12px;">🛒</div>
                <h2 style="margin:0 0 6px;font-size:22px;color:#1a1a2e;">${t('welcomeToBasketMate')}</h2>
                <p style="color:#6b7280;font-size:14px;margin:0 0 24px;">${t('createOrJoin').replace('\n', '<br>')}</p>
                <button onclick="App.createHousehold()" style="width:100%;padding:14px;background:#005EA5;color:white;border:none;border-radius:12px;font-size:16px;font-weight:700;cursor:pointer;margin-bottom:12px;">
                    ${t('createNewHousehold')}
                </button>
                <div style="position:relative;margin-bottom:12px;">
                    <div style="height:1px;background:#e5e7eb;"></div>
                    <span style="position:absolute;top:-10px;left:50%;transform:translateX(-50%);background:white;padding:0 12px;color:#9ca3af;font-size:13px;">${t('or')}</span>
                </div>
                <div style="display:flex;gap:8px;">
                    <input type="text" id="joinCodeInput" placeholder="${t('enterHouseholdCode')}" maxlength="6"
                        style="flex:1;padding:13px 14px;border:1.5px solid #e5e7eb;border-radius:12px;font-size:16px;text-transform:uppercase;letter-spacing:2px;outline:none;text-align:center;"
                        oninput="this.value=this.value.toUpperCase()">
                    <button onclick="App.joinHousehold()" style="padding:13px 18px;background:#16a34a;color:white;border:none;border-radius:12px;font-size:15px;font-weight:700;cursor:pointer;">${t('join')}</button>
                </div>
                <p id="householdError" style="color:#dc2626;font-size:13px;margin:8px 0 0;display:none;"></p>
            </div>`;
        overlay.classList.add('show');
        overlay.onclick = null;
    },

    async createHousehold() {
        try {
            const btn = document.querySelector('#modal button');
            if (btn) {
                btn.disabled = true;
                btn.textContent = t('creating') || 'Δημιουργία...';   // Force Greek fallback for testing
            }

            const data = await API.createHousehold();
            this.showHouseholdCode(data.code);
        } catch (e) {
            Utils.showToast('Failed to create household', true);
            const btn = document.querySelector('#modal button');
            if (btn) {
                btn.disabled = false;
                btn.textContent = t('createNewHousehold');
            }
        }
    },

    showHouseholdCode(code) {
        document.getElementById('modal').innerHTML = `
            <div style="text-align:center;padding:8px 0 16px;">
                <div style="font-size:48px;margin-bottom:12px;">🏠</div>
                <h2 style="margin:0 0 6px;font-size:22px;color:#1a1a2e;">${t('yourHouseholdCode')}</h2>
                <p style="color:#6b7280;font-size:14px;margin:0 0 20px;">${t('shareCode')}</p>
                <div style="background:#f0f9ff;border:2px solid #005EA5;border-radius:16px;padding:20px;margin-bottom:20px;">
                    <div style="font-size:36px;font-weight:900;letter-spacing:8px;color:#005EA5;font-family:monospace;">${code}</div>
                </div>
                <button onclick="App.showNameSetup()" style="width:100%;padding:14px;background:#005EA5;color:white;border:none;border-radius:12px;font-size:16px;font-weight:700;cursor:pointer;">${t('next')}</button>
            </div>`;
    },

    showNameSetup() {
        document.getElementById('modal').innerHTML = `
            <div style="text-align:center;padding:8px 0 16px;">
                <div style="font-size:48px;margin-bottom:12px;">👤</div>
                <h2 style="margin:0 0 6px;font-size:22px;color:#1a1a2e;">${t('whatsYourName')}</h2>
                <p style="color:#6b7280;font-size:14px;margin:0 0 20px;">${t('nameSoFamily')}</p>
                <input type="text" id="memberNameInput" placeholder="${t('namePlaceholder')}" maxlength="20"
                    style="width:100%;padding:14px;border:1.5px solid #e5e7eb;border-radius:12px;font-size:18px;outline:none;text-align:center;margin-bottom:16px;box-sizing:border-box;">
                <p id="nameError" style="color:#dc2626;font-size:13px;margin:0 0 12px;display:none;">Please enter your name.</p>
                <button onclick="App.saveMemberName()" style="width:100%;padding:14px;background:#005EA5;color:white;border:none;border-radius:12px;font-size:16px;font-weight:700;cursor:pointer;">${t('letsGo')}</button>
            </div>`;
        setTimeout(() => document.getElementById('memberNameInput')?.focus(), 100);
    },

    saveMemberName() {
        const input = document.getElementById('memberNameInput');
        const name = input.value.trim();
        if (!name) { document.getElementById('nameError').style.display = 'block'; input.style.borderColor = '#dc2626'; return; }
        localStorage.setItem('bm_member_name', name);
        API.memberName = name;
        this.startApp();
    },

    async joinHousehold() {
        const input = document.getElementById('joinCodeInput');
        const error = document.getElementById('householdError');
        const code = input.value.trim().toUpperCase();
        if (code.length < 6) { input.style.borderColor = '#dc2626'; error.textContent = 'Please enter a 6-character code.'; error.style.display = 'block'; return; }
        try {
            input.disabled = true;
            error.style.display = 'none';
            await API.joinHousehold(code);
            Utils.showToast('Joined household! 🏠');
            this.showNameSetup();
        } catch (e) {
            input.disabled = false;
            input.style.borderColor = '#dc2626';
            error.textContent = 'Household not found. Check the code and try again.';
            error.style.display = 'block';
        }
    },

    startApp() {
        const overlay = document.getElementById('modalOverlay');
        overlay.classList.remove('show');
        overlay.addEventListener('click', (e) => { if (e.target === overlay) Utils.closeModal(); });
        API.connectSSE();
        API.startKeepAlive();
        setTimeout(() => this.setupPushNotifications(), 3000);
    },

    async setupPushNotifications() {
        if (!('Notification' in window) || !('serviceWorker' in navigator)) return;
        if (Notification.permission === 'denied') return;
        try {
            const permission = await Notification.requestPermission();
            if (permission !== 'granted') return;
            const reg = await navigator.serviceWorker.ready;
            const r = await fetch('/push/vapid-key');
            const { publicKey } = await r.json();
            const subscription = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: this.urlBase64ToUint8Array(publicKey) });
            await fetch('/push/subscribe', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ subscription, householdId: API.householdId }) });
            console.log('Push notifications enabled!');
        } catch (e) { console.log('Push setup failed:', e); }
    },

    urlBase64ToUint8Array(base64String) {
        const padding = '='.repeat((4 - base64String.length % 4) % 4);
        const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
        const rawData = window.atob(base64);
        return new Uint8Array([...rawData].map(c => c.charCodeAt(0)));
    },

    setupEventListeners() {
        document.getElementById('modalOverlay').addEventListener('click', (e) => {
            if (e.target === document.getElementById('modalOverlay')) Utils.closeModal();
        });
    },

    smartHome() {
        const aislePanel = document.getElementById('aislePanelOverlay');
        if (aislePanel.classList.contains('show')) { UI.closeAislePanel(); return; }
        const shopMode = document.getElementById('shoppingModeOverlay');
        if (!shopMode.classList.contains('hidden')) {
            this.closeShoppingMode();
            if (UI.lastAislePanel) setTimeout(() => UI.openAislePanel(UI.lastAislePanel), 50);
            return;
        }
        if (API.currentStoreId) { this.goHome(); return; }
    },

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
                <button onclick="Utils.closeModal()" style="width:100%;padding:14px;background:#005EA5;color:white;border:none;border-radius:12px;font-size:16px;font-weight:700;cursor:pointer;">OK</button>
            </div>`;
        overlay.classList.add('show');
    },

    darken(hex) {
        const n = parseInt(hex.slice(1), 16);
        const r = Math.max(0, (n >> 16) - 30);
        const g = Math.max(0, ((n >> 8) & 0xff) - 30);
        const b = Math.max(0, (n & 0xff) - 30);
        return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
    }
};

document.addEventListener('DOMContentLoaded', () => App.init());