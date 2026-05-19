import { supabaseClient } from './supabase.js';
import { getRistoranteSlug, escapeHtml, formatPrice } from './utils.js';
import { APP_VERSION } from './version.js';

const menuContainer = document.getElementById("menu-container");
const restNameHeader = document.getElementById("restaurant-name");

let orderModInstance = null;

export async function initMenu() {
    if (!menuContainer) return;
    menuContainer.innerHTML = `<div class="loading-state">Caricamento prodotti da Supabase...</div>`;

    // Rilevamento SaaS automatico: legge dall'URL, se vuoto usa al-panetto come fallback di sicurezza
    const slug = getRistoranteSlug() || "al-panetto";

    try {
        const { data: ristorante, error: restError } = await supabaseClient
            .from("ristoranti")
            .select("*")
            .eq("slug", slug)
            .single();

        if (restError || !ristorante) throw new Error("Locale non trovato nel database.");

        sessionStorage.setItem("zf_current_ristorante", JSON.stringify(ristorante));
        if (restNameHeader) restNameHeader.textContent = ristorante.nome;

        const [catRes, prodRes] = await Promise.all([
            supabaseClient.from("categorie").select("*").eq("ristorante_id", ristorante.id).order("ordine", { ascending: true }),
            supabaseClient.from("prodotti").select("*").eq("ristorante_id", ristorante.id).eq("disponibile", true).order("ordine", { ascending: true })
        ]);

        if (catRes.error) throw catRes.error;
        if (prodRes.error) throw prodRes.error;

        menuContainer.innerHTML = "";
        const categorie = catRes.data || [];
        const prodotti = prodRes.data || [];

        if (!categorie.length || !prodotti.length) {
            menuContainer.innerHTML = `<p class="empty-msg">Il menu è attualmente vuoto.</p>`;
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

        // Carica il modulo d'ordine usando la versione controllata fissa
        orderModInstance = await import(`./order.js?v=${APP_VERSION}`);
        orderModInstance.renderCart(ristorante.id);
        orderModInstance.initOrderLogic(ristorante);

    } catch (err) {
        console.error(err);
        menuContainer.innerHTML = `<p class="error-msg" style="color:#ef4444; font-weight:bold;">❌ ERRORE: ${err.message}</p>`;
    }
}

document.addEventListener("click", (e) => {
    if (e.target.classList.contains("btn-add-to-cart") && orderModInstance) {
        const dataRest = sessionStorage.getItem("zf_current_ristorante");
        if (!dataRest) return;
        const ristorante = JSON.parse(dataRest);

        const id = e.target.getAttribute("data-id");
        const nome = e.target.getAttribute("data-nome");
        const prezzo = parseFloat(e.target.getAttribute("data-prezzo"));
        
        let cart = orderModInstance.getCartItems(ristorante.id);
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
        orderModInstance.saveCart(cart, ristorante.id);
        orderModInstance.renderCart(ristorante.id);
    }
});

initMenu();
