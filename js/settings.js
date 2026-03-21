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
                    <div class="help-icon">🏪</div>
                    <div>
                        <div class="help-title">Choose Your Store</div>
                        <div class="help-text">Tap any store on the home screen to start your list. Each store has its own aisles and shopping list.</div>
                    </div>
                </div>

                <div class="help-section">
                    <div class="help-icon">📋</div>
                    <div>
                        <div class="help-title">Adding Items</div>
                        <div class="help-text">Tap an aisle to open it, then tap any product to add it to your list. You can also search and add custom items.</div>
                    </div>
                </div>

                <div class="help-section">
                    <div class="help-icon">↕️</div>
                    <div>
                        <div class="help-title">Reorder Aisles</div>
                        <div class="help-text">Press and hold the drag handle (⠿) on any aisle row and drag it up or down to match the actual layout of your supermarket. Your order is saved automatically.</div>
                    </div>
                </div>

                <div class="help-section">
                    <div class="help-icon">⚙️</div>
                    <div>
                        <div class="help-title">Manage Aisle Products</div>
                        <div class="help-text">Tap the gear icon on any aisle to add or remove products from that aisle's quick-pick list.</div>
                    </div>
                </div>

                <div class="help-section">
                    <div class="help-icon">⭐</div>
                    <div>
                        <div class="help-title">Favourites</div>
                        <div class="help-text">Tap the star ⭐ on any product to save it as a favourite. Access all your favourites from the Favourites tab for one-tap adding.</div>
                    </div>
                </div>

                <div class="help-section">
                    <div class="help-icon">🔔</div>
                    <div>
                        <div class="help-title">Notifications</div>
                        <div class="help-text">Notifications only arrive when you have <strong>My List</strong> open. This way you won't be disturbed while building your list at home — only the shopper in the supermarket gets alerted when a family member adds something.</div>
                    </div>
                </div>

                <div class="help-section">
                    <div class="help-icon">🛒</div>
                    <div>
                        <div class="help-title">Shopping Mode</div>
                        <div class="help-text">Tap "My List" to enter shopping mode — a clean full-screen view sorted by aisle across all stores. Tap items to check them off as you go.</div>
                    </div>
                </div>

                <button class="modal-btn confirm" style="width:100%;margin-top:16px;" onclick="Utils.closeModal()">Got it! 👍</button>
            </div>`;
        overlay.classList.add('show');
    }
});
