import { supabaseClient } from './supabase.js';
import { getRistoranteSlug, escapeHtml, formatPrice } from './utils.js';

const menuContainer = document.getElementById("menu-container");
const restNameHeader = document.getElementById("restaurant-name");

// Variabili di modulo globali condivise per mantenere la stabilità della memoria
let currentRistoranteObj = null;
let orderModuleInstance = null;

export async function initMenu() {
    if (!menuContainer) return;
    menuContainer.innerHTML = `<div class="loading-state">Caricamento prodotti da Supabase...</div>`;

    const slug = getRistoranteSlug() || "al-panetto";

    try {
        const { data: ristorante, error: restError } = await supabaseClient
            .from("ristoranti")
            .select("*")
            .eq("slug", slug)
            .single();

        if (restError || !ristorante) throw new Error("Locale non trovato nel database.");

        currentRistoranteObj = ristorante;
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
                    <button class="btn-add-to-cart" data-id="${p.id}" data-nome="${escapeHtml(p.nome)}" data-prezzo="${p.prezzo}" data-descrizione="${escapeHtml(p.descrizione || '')}">➕ Aggiungi</button>
                `;
                grid.appendChild(card);
            });

            section.appendChild(grid);
            menuContainer.appendChild(section);
        });

        // IMPORTAZIONE UNICA SINCRONIZZATA ALL'AVVIO
        orderModuleInstance = await import(`./order.js?v=6.0.0`);
        if (orderModuleInstance && typeof orderModuleInstance.renderCart === "function") {
            orderModuleInstance.renderCart(ristorante.id);
            orderModuleInstance.initOrderLogic(ristorante);
        }

    } catch (err) {
        console.error(err);
        menuContainer.innerHTML = `<p class="error-msg" style="color:#ef4444; font-weight:bold;">❌ ERRORE: ${err.message}</p>`;
    }
}

// Intercettatore dei click sincronizzato: esclude leak di moduli asincroni rincorrenti
document.addEventListener("click", (e) => {
    if (e.target.classList.contains("btn-add-to-cart") && orderModuleInstance && currentRistoranteObj) {
        const id = e.target.getAttribute("data-id");
        const nome = e.target.getAttribute("data-nome");
        const prezzo = parseFloat(e.target.getAttribute("data-prezzo"));
        const descrizione = e.target.getAttribute("data-descrizione") || "";

        orderModuleInstance.apriModaleVarianti(id, nome, prezzo, descrizione, currentRistoranteObj);
    }
});

initMenu();
