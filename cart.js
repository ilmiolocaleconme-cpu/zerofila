// cart.js
import { getRistoranteSlug, escapeHtml, formatPrice } from './utils.js';

const cartContainer = document.getElementById("cart-items");
const cartTotalElement = document.getElementById("cart-total");

function getStorageKey() {
    try {
        const data = sessionStorage.getItem("zf_current_ristorante");
        if (!data) return "zf_cart_generic";
        const r = JSON.parse(data);
        return r?.id ? `zf_cart_${r.id}` : "zf_cart_generic";
    } catch (e) {
        return "zf_cart_generic";
    }
}

export function getCartItems() {
    const key = getStorageKey();
    const saved = localStorage.getItem(key);
    return saved ? JSON.parse(saved) : [];
}

export function saveCart(cart) {
    localStorage.setItem(getStorageKey(), JSON.stringify(cart || []));
}

export function renderCart() {
    if (!cartContainer) return;
    const cart = getCartItems();

    if (cart.length === 0) {
        cartContainer.innerHTML = "<p class='cart-empty'>Il carrello è vuoto</p>";
        if (cartTotalElement) cartTotalElement.textContent = "€ 0.00";
        return;
    }

    cartContainer.innerHTML = "";
    let totale = 0;

    cart.forEach(item => {
        totale += Number(item.prezzo) * item.quantita;
        const div = document.createElement("div");
        div.className = "cart-item";
        div.innerHTML = `
            <span class="item-nome">${escapeHtml(item.nome)}</span>
            <div class="item-controlli">
                <button class="btn-cart-meno" data-cid="${item.carrelloId}">-</button>
                <span class="item-quantita">${item.quantita}</span>
                <button class="btn-cart-piu" data-cid="${item.carrelloId}">+</button>
            </div>
            <span class="item-prezzo">€ ${formatPrice(item.prezzo * item.quantita)}</span>
        `;
        cartContainer.appendChild(div);
    });

    if (cartTotalElement) cartTotalElement.textContent = `€ ${formatPrice(totale)}`;
}

window.addEventListener("menuRendered", renderCart);
