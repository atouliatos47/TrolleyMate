const Utils = {

    escapeHtml(str) {
        const div = document.createElement('div');
        div.appendChild(document.createTextNode(str || ''));
        return div.innerHTML;
    },

    showToast(msg, isError = false) {
        let toast = document.getElementById('toast');
        if (!toast) {
            toast = document.createElement('div');
            toast.id = 'toast';
            document.body.appendChild(toast);
        }
        toast.textContent = msg;
        toast.className = 'toast' + (isError ? ' toast-error' : '');
        toast.classList.add('show');
        setTimeout(() => toast.classList.remove('show'), 3000);
    },

    closeModal() {
        document.getElementById('modalOverlay').classList.remove('show');
        document.getElementById('modal').innerHTML = '';
    },

    shakeElement(el) {
        if (!el) return;
        el.classList.add('shake');
        setTimeout(() => el.classList.remove('shake'), 500);
    },

    formatTime(dateStr) {
        if (!dateStr) return '';
        const d = new Date(dateStr);
        return d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
    },

    formatDate(dateStr) {
        if (!dateStr) return '';
        const d = new Date(dateStr);
        return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
    }

};
