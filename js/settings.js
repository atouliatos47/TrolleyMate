// ===================================================
// settings.js — Settings panel, name, help, code
// ===================================================
Object.assign(App, {

    // ===== SETTINGS PANEL =====
    showSettings() {
        const panel = document.getElementById('settingsPanel');
        const overlay = document.getElementById('settingsOverlay');
        const nameSub = document.getElementById('currentNameSub');
        if (nameSub) nameSub.textContent = `Signed in as ${API.memberName}`;
        // Update upgrade button based on premium status
        const upgradeTitle = document.getElementById('upgradeSettingsTitle');
        const upgradeSub = document.getElementById('upgradeSettingsSub');
        const upgradeItem = document.getElementById('upgradeSettingsItem');
        if (upgradeTitle && upgradeSub) {
            if (API.isPremium) {
                upgradeTitle.textContent = '✅ BasketMate Family';
                upgradeSub.textContent = 'You have full access — thank you!';
                if (upgradeItem) upgradeItem.onclick = null;
            } else if (API.isTrialActive) {
                upgradeTitle.textContent = '⏳ Free Trial Active';
                upgradeSub.textContent = `${API.trialDaysLeft} day${API.trialDaysLeft !== 1 ? 's' : ''} left — upgrade to keep full access`;
            } else {
                upgradeTitle.textContent = '⭐ Upgrade to Family';
                upgradeSub.textContent = '£2.99 one-time — unlimited everything';
            }
        }
        const isSilent = localStorage.getItem('bm_silent') === 'true';
        const toggle = document.getElementById('silentModeToggle');
        const thumb = document.getElementById('silentModeThumb');
        const sub = document.getElementById('silentModeSub');
        if (toggle) toggle.style.background = isSilent ? '#005EA5' : '#e5e7eb';
        if (thumb) thumb.style.left = isSilent ? '22px' : '2px';
        if (sub) sub.textContent = isSilent ? 'Sounds are muted' : 'Mute item ping sounds';
        panel.classList.add('open');
        overlay.classList.add('open');
    },

    closeSettings() {
        document.getElementById('settingsPanel').classList.remove('open');
        document.getElementById('settingsOverlay').classList.remove('open');
    },

    // ===== CHANGE NAME =====
    showChangeName() {
        this.closeSettings();
        const modal = document.getElementById('modal');
        const overlay = document.getElementById('modalOverlay');
        modal.innerHTML = `
            <div style="text-align:center;padding:8px 0 16px;">
                <div style="font-size:40px;margin-bottom:10px;">👤</div>
                <h3 style="margin:0 0 6px;">Change Your Name</h3>
                <p style="color:#6b7280;font-size:14px;margin:0 0 18px;">This is shown when you add items to the list.</p>
                <input type="text" id="changeNameInput" value="${Utils.escapeHtml(API.memberName)}" maxlength="20"
                    style="width:100%;padding:14px;border:1.5px solid #e5e7eb;border-radius:12px;font-size:18px;outline:none;text-align:center;margin-bottom:16px;box-sizing:border-box;">
                <div class="modal-actions">
                    <button class="modal-btn cancel" onclick="Utils.closeModal()">Cancel</button>
                    <button class="modal-btn confirm" onclick="App.saveChangedName()">Save</button>
                </div>
            </div>`;
        overlay.classList.add('show');
        setTimeout(() => document.getElementById('changeNameInput')?.select(), 100);
    },

    saveChangedName() {
        const input = document.getElementById('changeNameInput');
        const name = input?.value.trim();
        if (!name) return;
        localStorage.setItem('bm_member_name', name);
        API.memberName = name;
        Utils.closeModal();
        Utils.showToast(`Name updated to ${name} ✓`);
    },

    // ===== HOUSEHOLD CODE =====
    showMyCode() {
        this.closeSettings();
        if (!API.hasFullAccess) {
            App.showUpgradePrompt('Household sharing is a BasketMate Family feature. Upgrade to share your list with family in real time.');
            return;
        }
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

    // ===== SWITCH HOUSEHOLD =====
    showSwitchHousehold() {
        this.closeSettings();
        if (!API.hasFullAccess) {
            App.showUpgradePrompt('Household sharing is a BasketMate Family feature. Upgrade to join and share lists with your family.');
            return;
        }
        const modal = document.getElementById('modal');
        const overlay = document.getElementById('modalOverlay');
        modal.innerHTML = `
            <div style="text-align:center;padding:8px 0 16px;">
                <div style="font-size:40px;margin-bottom:10px;">🔄</div>
                <h3 style="margin:0 0 6px;">Switch Household</h3>
                <p style="color:#6b7280;font-size:14px;margin:0 0 18px;">Enter a household code to switch to a different shared list. Your current list will remain untouched.</p>
                <input type="text" id="switchCodeInput"
                    placeholder="Enter household code"
                    maxlength="6"
                    style="width:100%;padding:14px;border:1.5px solid #e5e7eb;border-radius:12px;font-size:18px;outline:none;text-align:center;letter-spacing:4px;text-transform:uppercase;margin-bottom:8px;box-sizing:border-box;"
                    oninput="this.value=this.value.toUpperCase()">
                <p id="switchError" style="color:#dc2626;font-size:13px;margin:0 0 12px;display:none;"></p>
                <div class="modal-actions">
                    <button class="modal-btn cancel" onclick="Utils.closeModal()">Cancel</button>
                    <button class="modal-btn confirm" onclick="App.confirmSwitchHousehold()">Switch</button>
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

        if (code === API.householdCode) {
            input.style.borderColor = '#dc2626';
            error.textContent = 'That\'s your current household code!';
            error.style.display = 'block';
            return;
        }

        const btn = document.querySelector('#modal .modal-btn.confirm');
        if (btn) { btn.disabled = true; btn.textContent = 'Switching...'; }

        try {
            await API.joinHousehold(code);
            Utils.closeModal();
            // Reconnect SSE with new household
            API.connectSSE();
            Utils.showToast('Switched household! 🏠');
        } catch(e) {
            if (btn) { btn.disabled = false; btn.textContent = 'Switch'; }
            input.style.borderColor = '#dc2626';
            error.textContent = 'Household not found. Check the code and try again.';
            error.style.display = 'block';
        }
    },

    toggleSilentMode() {
        // Update upgrade button based on premium status
        const upgradeTitle = document.getElementById('upgradeSettingsTitle');
        const upgradeSub = document.getElementById('upgradeSettingsSub');
        const upgradeItem = document.getElementById('upgradeSettingsItem');
        if (upgradeTitle && upgradeSub) {
            if (API.isPremium) {
                upgradeTitle.textContent = '✅ BasketMate Family';
                upgradeSub.textContent = 'You have full access — thank you!';
                if (upgradeItem) upgradeItem.onclick = null;
            } else if (API.isTrialActive) {
                upgradeTitle.textContent = '⏳ Free Trial Active';
                upgradeSub.textContent = `${API.trialDaysLeft} day${API.trialDaysLeft !== 1 ? 's' : ''} left — upgrade to keep full access`;
            } else {
                upgradeTitle.textContent = '⭐ Upgrade to Family';
                upgradeSub.textContent = '£2.99 one-time — unlimited everything';
            }
        }
        const isSilent = localStorage.getItem('bm_silent') === 'true';
        localStorage.setItem('bm_silent', String(!isSilent));
        const toggle = document.getElementById('silentModeToggle');
        const thumb = document.getElementById('silentModeThumb');
        const sub = document.getElementById('silentModeSub');
        if (toggle) toggle.style.background = !isSilent ? '#005EA5' : '#e5e7eb';
        if (thumb) thumb.style.left = !isSilent ? '22px' : '2px';
        if (sub) sub.textContent = !isSilent ? 'Sounds are muted' : 'Mute item ping sounds';
        Utils.showToast(!isSilent ? '🔇 Silent mode on' : '🔔 Silent mode off');
    },

    // ===== HELP GUIDE =====
    showHelp() {
        this.closeSettings();
        const modal = document.getElementById('modal');
        const overlay = document.getElementById('modalOverlay');
        modal.innerHTML = `
            <div style="padding:4px 0 8px;max-height:70vh;overflow-y:auto;">
                <h3 style="margin:0 0 16px;font-size:18px;color:#1a1a2e;">📖 How to Use BasketMate</h3>

                <div class="help-section">
                    <div class="help-icon">🏠</div>
                    <div>
                        <div class="help-title">Household Sharing</div>
                        <div class="help-text">Create a household and share your 6-letter code with family. Everyone with the same code shares the same shopping list in real time.</div>
                    </div>
                </div>

                <div class="help-section">
                    <div class="help-icon">🔗</div>
                    <div>
                        <div class="help-title">Join a Household</div>
                        <div class="help-text">If someone you live with already has BasketMate, go to Settings → Join a Household and enter their 6-letter code. You will instantly share the same list in real time.</div>
                    </div>
                </div>

                <div class="help-section">
                    <div class="help-icon">🏪</div>
                    <div>
                        <div class="help-title">Choose Your Store</div>
                        <div class="help-text">Tap any store on the home screen to open it. Each store has its own aisles and shopping list. Use the ➕ Add Store button at the bottom to add a new shop.</div>
                    </div>
                </div>

                <div class="help-section">
                    <div class="help-icon">📋</div>
                    <div>
                        <div class="help-title">Adding Items</div>
                        <div class="help-text">Tap an aisle to open it. Tap a product to add it to your list — tap again to add more than one. Hold for 2 seconds on a product already in your list to remove it instantly. On desktop, right-click to remove.</div>
                    </div>
                </div>

                <div class="help-section">
                    <div class="help-icon">➕</div>
                    <div>
                        <div class="help-title">Add New Products to an Aisle</div>
                        <div class="help-text">Open an aisle and tap Add Product at the bottom right. The new product will be saved to that aisle for future use. Tap the 🗑 icon next to any product to remove it from the aisle.</div>
                    </div>
                </div>

                <div class="help-section">
                    <div class="help-icon">↕️</div>
                    <div>
                        <div class="help-title">Reorder Aisles</div>
                        <div class="help-text">Press and hold any aisle row and drag it up or down to match the layout of your supermarket. Your order is saved automatically.</div>
                    </div>
                </div>

                <div class="help-section">
                    <div class="help-icon">⭐</div>
                    <div>
                        <div class="help-title">Favourites</div>
                        <div class="help-text">Tap the star ⭐ on any product to save it as a favourite. Access all your favourites from the Favourites tab inside a store for one-tap adding.</div>
                    </div>
                </div>

                <div class="help-section">
                    <div class="help-icon">🛒</div>
                    <div>
                        <div class="help-title">My List (Shopping Mode)</div>
                        <div class="help-text">Tap My List at the bottom to see a clean full-screen view of everything across all stores, sorted by aisle. Tap items to check them off as you shop. Use the ← back button to return.</div>
                    </div>
                </div>

                <div class="help-section">
                    <div class="help-icon">🔇</div>
                    <div>
                        <div class="help-title">Silent Mode</div>
                        <div class="help-text">Go to Settings and toggle Silent Mode on to mute the ping sound when checking off items. Useful if you're shopping somewhere quiet!</div>
                    </div>
                </div>

                <div class="help-section">
                    <div class="help-icon">🔔</div>
                    <div>
                        <div class="help-title">Notifications</div>
                        <div class="help-text">When a family member adds something to the list, you'll get a notification — even if the app is closed.</div>
                    </div>
                </div>

                <button class="modal-btn confirm" style="width:100%;margin-top:16px;" onclick="Utils.closeModal()">Got it! 👍</button>
            </div>`;
        overlay.classList.add('show');
    }
});
