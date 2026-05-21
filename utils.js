// Funzioni di utilità globali per l'interfaccia ZeroFila

export function getRistoranteSlug() {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get('r') || "al-panetto";
}

export function escapeHtml(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

export function formatPrice(price) {
    const num = Number(price);
    return isNaN(num) ? "0.00" : num.toFixed(2);
}

export function showToast(message, type = "success") {
    // Rileva se esiste già un vecchio box di notifica e lo rimuove
    const vecchioBox = document.getElementById("status-error-box");
    if (vecchioBox) vecchioBox.remove();

    const toast = document.createElement("div");
    toast.id = "status-error-box";
    
    // Grafica elegante scura adattiva
    toast.style.cssText = `
        position: fixed;
        bottom: 20px;
        left: 50%;
        transform: translateX(-50%);
        background: ${type === 'error' ? '#ef4444' : '#10b981'};
        color: white;
        padding: 12px 24px;
        border-radius: 8px;
        font-weight: bold;
        z-index: 999999;
        font-size: 0.9rem;
        box-shadow: 0 10px 15px -3px rgba(0,0,0,0.3);
        text-align: center;
        max-width: 90%;
    `;
    
    toast.textContent = message;
    document.body.appendChild(toast);
    
    // Scompare in automatico dopo 3.5 secondi
    setTimeout(() => {
        if (toast) toast.remove();
    }, 3500);
}
