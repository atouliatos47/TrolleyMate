// ===================================================
// settings.js — Settings panel, name, household, language
// ===================================================
Object.assign(App, {

    showSettings() {
        const panel = document.getElementById('settingsPanel');
        const overlay = document.getElementById('settingsOverlay');
        // Update current name sub
        const nameSub = document.getElementById('currentNameSub');
        if (nameSub) nameSub.textContent = t('signedInAs', API.memberName);
        // Update silent mode toggle
        const silent = localStorage.getItem('bm_silent') === 'true';
        const toggle = document.getElementById('silentModeToggle');
        const thumb = document.getElementById('silentModeThumb');
        const silentSub = document.getElementById('silentModeSub');
        if (toggle) toggle.style.background = silent ? '#005EA5' : '#e5e7eb';
        if (thumb) thumb.style.left = silent ? '22px' : '2px';
        if (silentSub) silentSub.textContent = silent ? t('soundsMuted') : t('muteSounds');
        // Update language sub
        const langSub = document.getElementById('currentLanguageSub');
        if (langSub) {
            const lang = localStorage.getItem('bm_language') || 'en';
            const found = LANGUAGES.find(l => l.code === lang);
            if (found) langSub.textContent = `${found.name} ${found.flag}`;
        }
        // Update upgrade item
        this._updateUpgradeSettingsItem();
        panel.classList.add('open');
        overlay.classList.add('open');
    },

    closeSettings() {
        document.getElementById('settingsPanel').classList.remove('open');
        document.getElementById('settingsOverlay').classList.remove('open');
    },

    _updateUpgradeSettingsItem() {
        const title = document.getElementById('upgradeSettingsTitle');
        const sub = document.getElementById('upgradeSettingsSub');
        const item = document.getElementById('upgradeSettingsItem');
        if (!title || !sub) return;
        if (API.isPremium) {
            title.textContent = t('familyPlan');
            sub.textContent = t('familyPlanSub');
            if (item) item.onclick = null;
        } else if (API.trialDaysLeft > 0) {
            title.textContent = t('trialActive');
            sub.textContent = t('trialDaysLeft', API.trialDaysLeft);
        } else {
            title.textContent = t('upgradeToFamily');
            sub.textContent = t('upgradeSub');
        }
    },

    showMyCode() {
        this.closeSettings();
        const modal = document.getElementById('modal');
        const overlay = document.getElementById('modalOverlay');
        const code = API.householdCode || '------';
        modal.innerHTML = `
            <div style="text-align:center;padding:8px 0 16px;">
                <div style="font-size:48px;margin-bottom:12px;">🏠</div>
                <h3 style="margin:0 0 6px;">${t('myHouseholdCode')}</h3>
                <p class="modal-sub">${t('shareWithFamily')}</p>
                <div style="background:#f0f9ff;border:2px solid #005EA5;border-radius:16px;padding:20px;margin:20px 0;">
                    <div style="font-size:36px;font-weight:900;letter-spacing:8px;color:#005EA5;font-family:monospace;">${code}</div>
                </div>
                <button onclick="Utils.closeModal()" style="width:100%;padding:14px;background:#005EA5;color:white;border:none;border-radius:12px;font-size:16px;font-weight:700;cursor:pointer;">OK</button>
            </div>`;
        overlay.classList.add('show');
    },

    showChangeName() {
        this.closeSettings();
        const modal = document.getElementById('modal');
        const overlay = document.getElementById('modalOverlay');
        modal.innerHTML = `
            <div style="text-align:center;padding:8px 0 16px;">
                <div style="font-size:48px;margin-bottom:12px;">👤</div>
                <h3 style="margin:0 0 16px;">${t('changeMyName')}</h3>
                <input type="text" id="changeNameInput" value="${Utils.escapeHtml(API.memberName)}" maxlength="20"
                    style="width:100%;padding:14px;border:1.5px solid #e5e7eb;border-radius:12px;font-size:18px;outline:none;text-align:center;margin-bottom:16px;box-sizing:border-box;"
                    onkeypress="if(event.key==='Enter') App.saveChangedName()">
                <div class="modal-actions">
                    <button class="modal-btn cancel" onclick="Utils.closeModal()">${t('cancel')}</button>
                    <button class="modal-btn confirm" onclick="App.saveChangedName()">Save</button>
                </div>
            </div>`;
        overlay.classList.add('show');
        setTimeout(() => {
            const input = document.getElementById('changeNameInput');
            if (input) { input.focus(); input.select(); }
        }, 100);
    },

    saveChangedName() {
        const input = document.getElementById('changeNameInput');
        const name = input.value.trim();
        if (!name) { Utils.shakeElement(input); return; }
        localStorage.setItem('bm_member_name', name);
        API.memberName = name;
        Utils.closeModal();
        Utils.showToast(t('nameUpdated', name));
    },

    showSwitchHousehold() {
        this.closeSettings();
        const modal = document.getElementById('modal');
        const overlay = document.getElementById('modalOverlay');
        modal.innerHTML = `
            <div style="text-align:center;padding:8px 0 16px;">
                <div style="font-size:48px;margin-bottom:12px;">🏠</div>
                <h3 style="margin:0 0 6px;">${t('joinAHousehold')}</h3>
                <p class="modal-sub">${t('enterPartnerCode')}</p>
                <div style="display:flex;gap:8px;margin-top:16px;">
                    <input type="text" id="switchCodeInput" placeholder="${t('enterHouseholdCode')}" maxlength="6"
                        style="flex:1;padding:13px 14px;border:1.5px solid #e5e7eb;border-radius:12px;font-size:16px;text-transform:uppercase;letter-spacing:2px;outline:none;text-align:center;"
                        oninput="this.value=this.value.toUpperCase()">
                    <button onclick="App.confirmSwitchHousehold()" style="padding:13px 18px;background:#16a34a;color:white;border:none;border-radius:12px;font-size:15px;font-weight:700;cursor:pointer;">${t('join')}</button>
                </div>
                <p id="switchError" style="color:#dc2626;font-size:13px;margin:8px 0 0;display:none;"></p>
                <div class="modal-actions">
                    <button class="modal-btn cancel" onclick="Utils.closeModal()">${t('cancel')}</button>
                </div>
            </div>`;
        overlay.classList.add('show');
        setTimeout(() => document.getElementById('switchCodeInput')?.focus(), 100);
    },

    async confirmSwitchHousehold() {
        const input = document.getElementById('switchCodeInput');
        const error = document.getElementById('switchError');
        const code = input.value.trim().toUpperCase();
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
            Utils.closeModal();
            Utils.showToast(t('switchedHousehold'));
            if (API.eventSource) { API.eventSource.close(); API.eventSource = null; }
            API.connectSSE();
        } catch (e) {
            input.disabled = false;
            input.style.borderColor = '#dc2626';
            error.textContent = 'Household not found. Check the code and try again.';
            error.style.display = 'block';
        }
    },

    toggleSilentMode() {
        const current = localStorage.getItem('bm_silent') === 'true';
        const newVal = !current;
        localStorage.setItem('bm_silent', newVal);
        const toggle = document.getElementById('silentModeToggle');
        const thumb = document.getElementById('silentModeThumb');
        const silentSub = document.getElementById('silentModeSub');
        if (toggle) toggle.style.background = newVal ? '#005EA5' : '#e5e7eb';
        if (thumb) thumb.style.left = newVal ? '22px' : '2px';
        if (silentSub) silentSub.textContent = newVal ? t('soundsMuted') : t('muteSounds');
        Utils.showToast(newVal ? t('silentOn') : t('silentOff'));
    },

    showLanguageSelector() {
        this.closeSettings();
        const modal = document.getElementById('modal');
        const overlay = document.getElementById('modalOverlay');
        const currentLang = localStorage.getItem('bm_language') || 'en';
        const langOptions = LANGUAGES.map(l =>
            `<button onclick="App.changeLanguage('${l.code}')"
                style="display:flex;align-items:center;gap:12px;padding:14px 16px;border:2px solid ${l.code === currentLang ? '#005EA5' : '#e5e7eb'};border-radius:12px;background:${l.code === currentLang ? '#f0f9ff' : 'white'};font-size:16px;cursor:pointer;text-align:left;width:100%;margin-bottom:8px;">
                <span style="font-size:28px;">${l.flag}</span>
                <span style="font-weight:600;color:#1a1a2e;">${l.name}</span>
                ${l.code === currentLang ? '<span style="margin-left:auto;color:#005EA5;font-weight:700;">✓</span>' : ''}
            </button>`
        ).join('');
        modal.innerHTML = `
            <div style="padding:8px 0 16px;">
                <div style="text-align:center;font-size:48px;margin-bottom:12px;">🌍</div>
                <h3 style="text-align:center;margin:0 0 16px;">Language</h3>
                ${langOptions}
                <button class="modal-btn cancel" onclick="Utils.closeModal()" style="width:100%;margin-top:8px;">${t('cancel')}</button>
            </div>`;
        overlay.classList.add('show');
    },

    changeLanguage(code) {
        localStorage.setItem('bm_language', code);
        document.body.dir = code === 'ur' ? 'rtl' : 'ltr';
        App.applyTranslations();
        Utils.closeModal();
        UI.renderHome();
        if (API.currentStoreId) {
            UI.renderAisles();
            UI.renderList();
        }
        const langSub = document.getElementById('currentLanguageSub');
        if (langSub) {
            const found = LANGUAGES.find(l => l.code === code);
            if (found) langSub.textContent = `${found.name} ${found.flag}`;
        }
    },

    showHelp() {
        this.closeSettings();
        const modal = document.getElementById('modal');
        const overlay = document.getElementById('modalOverlay');
        modal.innerHTML = `
            <h3>📖 How to Use BasketMate</h3>
            <div style="margin-top:16px;">
                <div class="help-section">
                    <div class="help-icon">🏪</div>
                    <div><div class="help-title">Choose a Store</div><div class="help-text">Tap a store on the home screen to open its shopping list.</div></div>
                </div>
                <div class="help-section">
                    <div class="help-icon">🗂️</div>
                    <div><div class="help-title">Add Items via Aisles</div><div class="help-text">Tap an aisle on the left, then tap a product to add it to your list.</div></div>
                </div>
                <div class="help-section">
                    <div class="help-icon">⭐</div>
                    <div><div class="help-title">Save Favourites</div><div class="help-text">Tap the ⭐ next to any product to save it. Find all favourites in the Favourites tab.</div></div>
                </div>
                <div class="help-section">
                    <div class="help-icon">🛒</div>
                    <div><div class="help-title">Shopping Mode</div><div class="help-text">Tap the cart button at the bottom to enter shopping mode — tap items to check them off.</div></div>
                </div>
                <div class="help-section">
                    <div class="help-icon">🏠</div>
                    <div><div class="help-title">Share with Family</div><div class="help-text">Go to Settings → My Household Code and share the 6-letter code with family members.</div></div>
                </div>
            </div>
            <div class="modal-actions">
                <button class="modal-btn cancel" onclick="Utils.closeModal()">Close</button>
            </div>`;
        overlay.classList.add('show');
    },

    showUpgradePrompt(message) {
        this.closeSettings();
        const modal = document.getElementById('modal');
        const overlay = document.getElementById('modalOverlay');
        const msg = message || 'Upgrade to BasketMate Family for unlimited stores, aisles, and products.';
        modal.innerHTML = `
            <div style="text-align:center;padding:8px 0 16px;">
                <div style="font-size:48px;margin-bottom:12px;">⭐</div>
                <h3 style="margin:0 0 8px;">Upgrade to Family</h3>
                <p class="modal-sub">${msg}</p>
                <div style="background:#fef9c3;border-radius:12px;padding:16px;margin:20px 0;">
                    <div style="font-size:28px;font-weight:900;color:#d97706;">£2.99</div>
                    <div style="font-size:13px;color:#92400e;margin-top:4px;">One-time payment — yours forever</div>
                </div>
                <ul style="text-align:left;list-style:none;padding:0;margin:0 0 20px;">
                    <li style="padding:6px 0;font-size:14px;">✅ Unlimited stores</li>
                    <li style="padding:6px 0;font-size:14px;">✅ Unlimited aisles per store</li>
                    <li style="padding:6px 0;font-size:14px;">✅ Unlimited products per aisle</li>
                    <li style="padding:6px 0;font-size:14px;">✅ All family members included</li>
                </ul>
                <button onclick="App.processPurchase()" style="width:100%;padding:14px;background:#d97706;color:white;border:none;border-radius:12px;font-size:16px;font-weight:700;cursor:pointer;margin-bottom:10px;">Upgrade Now — £2.99</button>
                <button class="modal-btn cancel" onclick="Utils.closeModal()" style="width:100%;">${t('cancel')}</button>
            </div>`;
        overlay.classList.add('show');
    },

    async processPurchase() {
        // Placeholder — integrate with Google Play Billing when ready
        Utils.showToast('Purchase coming soon!', true);
    }
});
