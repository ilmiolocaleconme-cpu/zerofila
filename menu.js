import { supabaseClient } from './supabase.js';
import { escapeHtml, formatPrice, showToast } from './utils.js';

const menuContainer = document.getElementById("menu-container");
const restNameHeader = document.getElementById("restaurant-name");
const cartContainer = document.getElementById("cart-items");
const cartTotalElement = document.getElementById("cart-total");

// Costanti fisse per sbloccare il sistema
const TARGET_SLUG = "al-panetto";
const COPERTO_AMOUNT = 1.50;

// --- GESTIONE CARRELLO (INTEGRATA) ---
function getCartItems() {
    const saved = localStorage.getItem(`zf_cart_${TARGET_SLUG}`);
    return saved ? JSON.parse(saved) : [];
}

function saveCart(cart) {
    localStorage.setItem(`zf_cart_${TARGET_SLUG}`, JSON.stringify(cart || []));
}

function renderCart() {
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

// --- LOGICA REALE DI INIZIALIZZAZIONE ---
async function initMenu() {
    if (!menuContainer) return;
    menuContainer.innerHTML = `<div class="loading-state">Caricamento prodotti da Supabase...</div>`;

    try {
        // Estrazione record ristorante
        const { data: ristorante, error: restError } = await supabaseClient
            .from("ristoranti")
            .select("*")
            .eq("slug", TARGET_SLUG)
            .single();

        if (restError || !ristorante) throw new Error("Locale non trovato nel database. Controlla la tabella 'ristoranti'.");

        sessionStorage.setItem("zf_current_ristorante", JSON.stringify(ristorante));
        if (restNameHeader) restNameHeader.textContent = ristorante.nome;

        // Recupero simultaneo categorie e prodotti
        const [catRes, prodRes] = await Promise.all([
            supabaseClient.from("categorie").select("*").eq("ristorante_id", ristorante.id).order("ordine", { ascending: true }),
            supabaseClient.from("prodotti").select("*").eq("ristorante_id", ristorante.id).eq("disponibile", true).order("ordine", { ascending: true })
        ]);

        if (catRes.error) throw catRes.error;
        if (prodRes.error) throw prodRes.error;

        // Rendering Interfaccia Menu
        menuContainer.innerHTML = "";
        const categorie = catRes.data || [];
        const prodotti = prodRes.data || [];

        if (!categorie.length || !prodotti.length) {
            menuContainer.innerHTML = `<p class="empty-msg">Il menu di '${ristorante.nome}' è attualmente vuoto su Supabase.</p>`;
            renderCart();
            return;
        }

        categorie.forEach(cat => {
            const prods = prodotti.filter(p => p.categoria_id === cat.id);
            if (!prods.length) return;

            const section = document.createElement("section");
            section.className = "menu-section";
            section.innerHTML = `<h2 class="categoria-titolo">${escapeHtml(cat.nome)}</h2>`;

            const grid = document.createElement("div");
            grid.className = "prodotti-grid";

            prods.forEach(p => {
                const card = document.createElement("div");
                card.className = "prodotto-card";
                card.innerHTML = `
                    <div class="prodotto-info">
                        <h3>${escapeHtml(p.nome)}</h3>
                        <p>${escapeHtml(p.descrizione || '')}</p>
                        <span class="prezzo">€ ${formatPrice(p.prezzo)}</span>
                    </div>
                    <button class="btn-add-to-cart" data-id="${p.id}" data-nome="${escapeHtml(p.nome)}" data-prezzo="${p.prezzo}">➕ Aggiungi</button>
                `;
                grid.appendChild(card);
            });

            section.appendChild(grid);
            menuContainer.appendChild(section);
        });

        // Forza il rendering del carrello subito dopo i prodotti
        renderCart();

    } catch (err) {
        console.error(err);
        menuContainer.innerHTML = `<p class="error-msg" style="color:#ef4444; font-weight:bold;">❌ ERRORE: ${err.message}</p>`;
    }
}

// --- CAPTURING EVENTI CLICK (INTERVALLO UNIFICATO) ---
document.addEventListener("click", (e) => {
    // 1. Aggiungi prodotto
    if (e.target.classList.contains("btn-add-to-cart")) {
        const id = e.target.getAttribute("data-id");
        const nome = e.target.getAttribute("data-nome");
        const prezzo = parseFloat(e.target.getAttribute("data-prezzo"));
        
        let cart = getCartItems();
        const esistente = cart.find(item => item.id === id);

        if (esistente) {
            esistente.quantita += 1;
        } else {
            cart.push({
                carrelloId: crypto.randomUUID(),
                id: id,
                nome: nome,
                prezzo: prezzo,
                quantita: 1
            });
        }
        saveCart(cart);
        renderCart();
        showToast(`Aggiunto: ${nome}`);
    }

    // 2. Tasto Più (+)
    if (e.target.classList.contains("btn-cart-piu")) {
        const cid = e.target.getAttribute("data-cid");
        let cart = getCartItems();
        const item = cart.find(i => i.carrelloId === cid);
        if (item) {
            item.quantita += 1;
            saveCart(cart);
            renderCart();
        }
    }

    // 3. Tasto Meno (-)
    if (e.target.classList.contains("btn-cart-meno")) {
        const cid = e.target.getAttribute("data-cid");
        let cart = getCartItems();
        const itemIndex = cart.findIndex(i => i.carrelloId === cid);
        if (itemIndex !== -1) {
            if (cart[itemIndex].quantita > 1) {
                cart[itemIndex].quantita -= 1;
            } else {
                cart.splice(itemIndex, 1);
            }
            saveCart(cart);
            renderCart();
        }
    }
});

// Avvio istantaneo controllato
initMenu();
