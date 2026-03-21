// ===================================================
// app.js — Core: init, splash, household, push
// ===================================================
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
        } catch(e) { console.log('Wake lock not available:', e); }
    },

    async releaseWakeLock() {
        try {
            if (screen.orientation && screen.orientation.unlock) screen.orientation.unlock();
            if (this.wakeLock) {
                await this.wakeLock.release();
                this.wakeLock = null;
            }
        } catch(e) { console.log('Wake lock release error:', e); }
    },

    init() {
        console.log('BasketMate initializing...');
        this.setupEventListeners();
        this.showSplash();

        const hasHousehold = API.loadHousehold();
        if (hasHousehold) {
            API.memberName = localStorage.getItem('bm_member_name') || 'Someone';
            setTimeout(() => {
                const splash = document.getElementById('splashScreen');
                if (splash) { splash.classList.add('fade-out'); setTimeout(() => { splash.style.display = 'none'; }, 600); }
            }, 1800);
            API.connectSSE();
            API.startKeepAlive();
            setTimeout(() => this.setupPushNotifications(), 4000);
        } else {
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
            { name: 'Co-op',        color: '#00B1A9', domain: 'coop.co.uk' },
        ];
        storesContainer.innerHTML = stores.map((store, i) => {
            const initials = store.name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0,2);
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

    showHouseholdSetup() {
        const splash = document.getElementById('splashScreen');
        if (splash) { splash.classList.add('fade-out'); setTimeout(() => { splash.style.display = 'none'; }, 600); }
        const overlay = document.getElementById('modalOverlay');
        const modal = document.getElementById('modal');
        modal.innerHTML = `
            <div style="text-align:center;padding:8px 0 16px;">
                <div style="font-size:48px;margin-bottom:12px;">🛒</div>
                <h2 style="margin:0 0 6px;font-size:22px;color:#1a1a2e;">Welcome to BasketMate</h2>
                <p style="color:#6b7280;font-size:14px;margin:0 0 24px;">Create a household to get started,<br>or join an existing one with a code.</p>
                <button onclick="App.createHousehold()" style="width:100%;padding:14px;background:#005EA5;color:white;border:none;border-radius:12px;font-size:16px;font-weight:700;cursor:pointer;margin-bottom:12px;">
                    ✨ Create New Household
                </button>
                <div style="position:relative;margin-bottom:12px;">
                    <div style="height:1px;background:#e5e7eb;"></div>
                    <span style="position:absolute;top:-10px;left:50%;transform:translateX(-50%);background:white;padding:0 12px;color:#9ca3af;font-size:13px;">or</span>
                </div>
                <div style="display:flex;gap:8px;">
                    <input type="text" id="joinCodeInput" placeholder="Enter household code" maxlength="6"
                        style="flex:1;padding:13px 14px;border:1.5px solid #e5e7eb;border-radius:12px;font-size:16px;text-transform:uppercase;letter-spacing:2px;outline:none;text-align:center;"
                        oninput="this.value=this.value.toUpperCase()">
                    <button onclick="App.joinHousehold()" style="padding:13px 18px;background:#16a34a;color:white;border:none;border-radius:12px;font-size:15px;font-weight:700;cursor:pointer;">Join</button>
                </div>
                <p id="householdError" style="color:#dc2626;font-size:13px;margin:8px 0 0;display:none;"></p>
            </div>`;
        overlay.classList.add('show');
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
        document.getElementById('modal').innerHTML = `
            <div style="text-align:center;padding:8px 0 16px;">
                <div style="font-size:48px;margin-bottom:12px;">🏠</div>
                <h2 style="margin:0 0 6px;font-size:22px;color:#1a1a2e;">Your Household Code</h2>
                <p style="color:#6b7280;font-size:14px;margin:0 0 20px;">Share this code with your family so they can join your list.</p>
                <div style="background:#f0f9ff;border:2px solid #005EA5;border-radius:16px;padding:20px;margin-bottom:20px;">
                    <div style="font-size:36px;font-weight:900;letter-spacing:8px;color:#005EA5;font-family:monospace;">${code}</div>
                </div>
                <p style="color:#9ca3af;font-size:12px;margin:0 0 20px;">You can find this code later in the app settings.</p>
                <button onclick="App.showNameSetup()" style="width:100%;padding:14px;background:#005EA5;color:white;border:none;border-radius:12px;font-size:16px;font-weight:700;cursor:pointer;">Next →</button>
            </div>`;
    },

    showNameSetup() {
        document.getElementById('modal').innerHTML = `
            <div style="text-align:center;padding:8px 0 16px;">
                <div style="font-size:48px;margin-bottom:12px;">👤</div>
                <h2 style="margin:0 0 6px;font-size:22px;color:#1a1a2e;">What's your name?</h2>
                <p style="color:#6b7280;font-size:14px;margin:0 0 20px;">So your family knows who added items to the list.</p>
                <input type="text" id="memberNameInput" placeholder="e.g. Andreas, Sharon..." maxlength="20"
                    style="width:100%;padding:14px;border:1.5px solid #e5e7eb;border-radius:12px;font-size:18px;outline:none;text-align:center;margin-bottom:16px;box-sizing:border-box;">
                <p id="nameError" style="color:#dc2626;font-size:13px;margin:0 0 12px;display:none;">Please enter your name.</p>
                <button onclick="App.saveMemberName()" style="width:100%;padding:14px;background:#005EA5;color:white;border:none;border-radius:12px;font-size:16px;font-weight:700;cursor:pointer;">Let's Go! 🛒</button>
            </div>`;
        setTimeout(() => document.getElementById('memberNameInput')?.focus(), 100);
    },

    saveMemberName() {
        const input = document.getElementById('memberNameInput');
        const name = input.value.trim();
        if (!name) { document.getElementById('nameError').style.display = 'block'; input.style.borderColor = '#dc2626'; return; }
        localStorage.setItem('bm_member_name', name);
        API.memberName = name;
        this.showWelcomeSplash(name);
    },

    showWelcomeSplash(name) {
        const overlay = document.getElementById('modalOverlay');
        const modal = document.getElementById('modal');
        modal.innerHTML = `
            <div style="text-align:center;padding:24px 0 20px;">
                <div style="font-size:64px;margin-bottom:16px;animation:bounceIn 0.6s ease;">🛒</div>
                <h2 style="margin:0 0 8px;font-size:26px;color:#005EA5;font-weight:900;">Welcome, ${Utils.escapeHtml(name)}!</h2>
                <p style="color:#6b7280;font-size:15px;margin:0 0 8px;">Your smart shopping companion is ready.</p>
                <p style="color:#9ca3af;font-size:13px;margin:0;">Taking you to your list...</p>
            </div>`;
        overlay.classList.add('show');
        overlay.onclick = null;
        setTimeout(() => {
            overlay.classList.remove('show');
            this.startApp();
        }, 4200);
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
        } catch(e) { console.log('Push setup failed:', e); }
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

    showUpgradePrompt(reason) {
        const daysLeft = API.trialDaysLeft;
        const trialExpired = !API.isTrialActive && !!API.trialStartedAt;
        const modal = document.getElementById('modal');
        const overlay = document.getElementById('modalOverlay');
        modal.innerHTML = `
            <div style="text-align:center;padding:8px 0 16px;">
                <div style="font-size:52px;margin-bottom:12px;">👨‍👩‍👧‍👦</div>
                <h2 style="margin:0 0 6px;font-size:22px;color:#1a1a2e;">BasketMate Family</h2>
                ${trialExpired
                    ? `<div style="background:#fee2e2;border-radius:10px;padding:10px;margin-bottom:14px;font-size:13px;color:#dc2626;font-weight:600;">⏰ Your 15-day free trial has ended</div>`
                    : daysLeft <= 5
                    ? `<div style="background:#fef3c7;border-radius:10px;padding:10px;margin-bottom:14px;font-size:13px;color:#d97706;font-weight:600;">⏳ ${daysLeft} day${daysLeft !== 1 ? 's' : ''} left in your trial</div>`
                    : ''
                }
                ${reason ? `<p style="color:#6b7280;font-size:13px;margin:0 0 16px;">${reason}</p>` : ''}
                <div style="background:#f0f9ff;border-radius:14px;padding:16px;margin-bottom:20px;text-align:left;">
                    <div style="font-weight:700;color:#1a1a2e;margin-bottom:10px;">Everything in Family:</div>
                    <div style="font-size:14px;color:#374151;line-height:2;">
                        ✅ Unlimited stores<br>
                        ✅ Unlimited aisles<br>
                        ✅ Unlimited products<br>
                        ✅ Household sharing<br>
                        ✅ Real-time sync<br>
                        ✅ Push notifications
                    </div>
                </div>
                <div style="background:#005EA5;color:white;border-radius:14px;padding:16px;margin-bottom:16px;">
                    <div style="font-size:28px;font-weight:900;">£2.99</div>
                    <div style="font-size:13px;opacity:0.85;">One-time payment — yours forever</div>
                </div>
                <button onclick="App.triggerPurchase()" style="width:100%;padding:14px;background:#16a34a;color:white;border:none;border-radius:12px;font-size:16px;font-weight:700;cursor:pointer;margin-bottom:10px;">
                    🛒 Upgrade to Family
                </button>
                <button onclick="Utils.closeModal()" style="width:100%;padding:12px;background:none;color:#9ca3af;border:none;font-size:14px;cursor:pointer;">
                    ${API.isTrialActive ? 'Continue with trial' : 'Maybe later'}
                </button>
            </div>`;
        overlay.classList.add('show');
    },

    triggerPurchase() {
        // This will be replaced with real Google Play billing
        // For now simulate a successful purchase for testing
        Utils.closeModal();
        Utils.showToast('Opening Google Play...');
        // TODO: integrate Android billing via TWA/Play Billing
        // For web testing, simulate purchase:
        if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
            setTimeout(() => {
                API.verifyPurchase('TEST_TOKEN_' + Date.now())
                    .then(() => Utils.showToast('🎉 Upgraded to BasketMate Family!'))
                    .catch(() => Utils.showToast('Purchase failed', true));
            }, 1000);
        }
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
