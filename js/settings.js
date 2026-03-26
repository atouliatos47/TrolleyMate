// ===================================================
// settings.js — Settings panel, name, household, language
// ===================================================
Object.assign(App, {

    showSettings() {
        const panel = document.getElementById('settingsPanel');
        const overlay = document.getElementById('settingsOverlay');

        // Update dynamic content
        const nameSub = document.getElementById('currentNameSub');
        if (nameSub) nameSub.textContent = t('signedInAs', API.memberName);

        // Silent mode toggle
        const silent = localStorage.getItem('bm_silent') === 'true';
        const toggle = document.getElementById('silentModeToggle');
        const thumb = document.getElementById('silentModeThumb');
        const silentSub = document.getElementById('silentModeSub');
        if (toggle) toggle.style.background = silent ? '#005EA5' : '#e5e7eb';
        if (thumb) thumb.style.left = silent ? '22px' : '2px';
        if (silentSub) silentSub.textContent = silent ? t('soundsMuted') : t('muteSounds');

        // Language sub
        const langSub = document.getElementById('currentLanguageSub');
        if (langSub) {
            const lang = localStorage.getItem('bm_language') || 'en';
            const found = LANGUAGES.find(l => l.code === lang);
            if (found) langSub.textContent = `${found.name} ${found.flag}`;
        }

        // Upgrade / Trial item
        this._updateUpgradeSettingsItem();

        // IMPORTANT: Translate all static settings items
        this.translateSettingsPanel();

        panel.classList.add('open');
        overlay.classList.add('open');
    },

    // New function to translate the entire settings panel
    translateSettingsPanel() {
        const set = (id, key) => {
            const el = document.getElementById(id);
            if (el) el.textContent = t(key);
        };

        // Main settings items
        set('settingsMyHouseholdCode', 'myHouseholdCode');
        set('settingsMyHouseholdCodeSub', 'shareWithFamily');
        set('settingsChangeMyName', 'changeMyName');
        set('settingsChangeMyNameSub', 'yourNameOnSharedLists');
        set('settingsJoinHousehold', 'joinAHousehold');
        set('settingsJoinHouseholdSub', 'enterPartnerCode');
        set('settingsSilentMode', 'silentMode');
        set('settingsLanguage', 'settings'); // Not needed, but for consistency
        set('settingsHowToUse', 'howToUse');
        set('settingsHowToUseSub', 'tipsGuide');

        // Upgrade / Trial section
        const upgradeTitle = document.getElementById('upgradeSettingsTitle');
        const upgradeSub = document.getElementById('upgradeSettingsSub');
        if (upgradeTitle && upgradeSub) {
            this._updateUpgradeSettingsItem();
        }

        // Footer
        const footer = document.querySelector('.settings-footer');
        if (footer) {
            footer.innerHTML = `BasketMate v1.0 <span style="opacity:0.6">by AtStudios</span>`;
        }
    },

    _updateUpgradeSettingsItem() {
        const title = document.getElementById('upgradeSettingsTitle');
        const sub = document.getElementById('upgradeSettingsSub');
        if (!title || !sub) return;

        if (API.isPremium) {
            title.textContent = t('familyPlan');
            sub.textContent = t('familyPlanSub');
        } else if (API.trialDaysLeft > 0) {
            title.textContent = t('trialActive');
            sub.textContent = t('trialDaysLeft', API.trialDaysLeft);
        } else {
            title.textContent = t('upgradeToFamily');
            sub.textContent = t('upgradeSub');
        }
    },

    closeSettings() {
        const panel = document.getElementById('settingsPanel');
        const overlay = document.getElementById('settingsOverlay');
        if (panel) panel.classList.remove('open');
        if (overlay) overlay.classList.remove('open');
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
                    <button class="modal-btn confirm" onclick="App.saveChangedName()">${t('save')}</button>
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
        // Refresh settings if still open
        if (document.getElementById('settingsPanel').classList.contains('open')) {
            this.showSettings();
        }
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

    // ... rest of your functions (toggleSilentMode, showLanguageSelector, changeLanguage, showHelp, etc.) remain mostly the same
    // For now, the most important is showSettings() + translateSettingsPanel()

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
        // ... your existing code for language selector ...
        // (it already uses LANGUAGES and t('cancel'))
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
        // Re-open settings with new language
        setTimeout(() => this.showSettings(), 50);
    },

    showHelp() {
        this.closeSettings();
        const modal = document.getElementById('modal');
        const overlay = document.getElementById('modalOverlay');
        modal.innerHTML = `
            <h3>${t('howToUse')}</h3>
            <div style="margin-top:16px;">
                <!-- You can improve this later with full translations, but for now it's better than hardcoded English -->
                <div class="help-section">
                    <div class="help-icon">🏪</div>
                    <div><div class="help-title">Choose a Store</div><div class="help-text">Tap a store on the home screen to open its shopping list.</div></div>
                </div>
                <!-- ... other sections ... -->
            </div>
            <div class="modal-actions">
                <button class="modal-btn cancel" onclick="Utils.closeModal()">${t('cancel')}</button>
            </div>`;
        overlay.classList.add('show');
    },

    // Keep your other functions (showUpgradePrompt, processPurchase, etc.)
});