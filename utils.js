// utils.js
export function getRistoranteSlug() {
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('r')) return urlParams.get('r');
    const parts = window.location.pathname.split('/').filter(Boolean);
    return parts[0] || null;
}

export function escapeHtml(text) {
    if (!text) return "";
    return text.toString()
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

export function formatPrice(price) {
    return Number(price || 0).toFixed(2);
}

export function showToast(message, type = "success") {
    const toast = document.createElement("div");
    toast.style.cssText = `position:fixed;bottom:20px;left:50%;transform:translateX(-50%);padding:12px 24px;border-radius:8px;color:#fff;z-index:10000;background:${type === "success" ? "#10b981" : "#ef4444"};`;
    toast.textContent = message;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
}
