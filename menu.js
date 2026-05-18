// menu.js
import { supabaseClient } from './supabase.js';
import { getRistoranteSlug, escapeHtml, formatPrice } from './utils.js';

const menuContainer = document.getElementById("menu-container");
const restNameHeader = document.getElementById("restaurant-name");

async function initMenu() {
    if (!menuContainer) return;
    const slug = getRistoranteSlug();
    if (!slug) {
        menuContainer.innerHTML = `<p class="error-msg">Nessun locale selezionato.</p>`;
        return;
    }

    menuContainer.innerHTML = `<div class="loading-container"><div class="loading-spinner"></div><p>Caricamento menu...</p></div>`;

    try {
        const { data: ristorante, error } = await supabaseClient
            .from("ristoranti")
            .select("*")
            .eq("slug", slug)
            .single();

        if (error || !ristorante) throw new Error("Ristorante non trovato");

        sessionStorage.setItem("zf_current_ristorante", JSON.stringify(ristorante));
        if (restNameHeader) restNameHeader.textContent = ristorante.nome;

        const [catRes, prodRes] = await Promise.all([
            supabaseClient.from("categorie").select("*").eq("ristorante_id", ristorante.id).order("ordine", { ascending: true }),
            supabaseClient.from("prodotti").select("*").eq("ristorante_id", ristorante.id).eq("disponibile", true).order("ordine", { ascending: true })
        ]);

        renderMenu(catRes.data || [], prodRes.data || []);
    } catch (err) {
        console.error(err);
        menuContainer.innerHTML = `<p class="error-msg">Impossibile caricare il menu.</p>`;
    }
}

function renderMenu(categorie, prodotti) {
    if (!menuContainer) return;
    menuContainer.innerHTML = "";

    if (!categorie.length) {
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
                <button class="btn-add-to-cart" data-id="\( {p.id}" data-nome=" \){escapeHtml(p.nome)}" data-prezzo="${p.prezzo}">➕ Aggiungi</button>
            `;
            grid.appendChild(card);
        });

        section.appendChild(grid);
        menuContainer.appendChild(section);
    });

    window.dispatchEvent(new Event("menuRendered"));
}

initMenu();
