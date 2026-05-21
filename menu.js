import { supabaseClient } from './supabase.js';
import { getRistoranteSlug, escapeHtml, formatPrice } from './utils.js';

const menuContainer = document.getElementById("menu-container");
const restNameHeader = document.getElementById("restaurant-name");

let currentRistoranteObj = null;

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
                
                const haGruppoOBL = p.gruppo_extra && p.gruppo_extra.trim() !== "";
                const isNudo = haGruppoOBL && (!p.descrizione || p.descrizione.trim() === "");
                const testoBottone = isNudo ? "🎨 Condisci" : "➕ Aggiungi";

                card.innerHTML = `
                    <div class="prodotto-info">
                        <h3>${escapeHtml(p.nome)}</h3>
                        <p>${escapeHtml(p.descrizione || 'Scegli le varianti e i condimenti al click')}</p>
                        <span class="prezzo">€ ${formatPrice(p.prezzo)}</span>
                    </div>
                    <button class="btn-add-to-cart" data-id="${p.id}" data-nome="${escapeHtml(p.nome)}" data-prezzo="${p.prezzo}" data-descrizione="${escapeHtml(p.descrizione || '')}" data-gruppo="${escapeHtml(p.gruppo_extra || '')}" data-forzafarcitura="${isNudo ? 'true' : 'false'}">${testoBottone}</button>
                `;
                grid.appendChild(card);
            });

            section.appendChild(grid);
            menuContainer.appendChild(section);
        });

        const orderMod = await import(`./order.js?v=12.0.0`);
        if (orderMod && typeof orderMod.renderCart === "function") {
            orderMod.renderCart(ristorante.id);
            orderMod.initOrderLogic(ristorante);
        }

    } catch (err) {
        console.error(err);
        menuContainer.innerHTML = `<p class="error-msg" style="color:#ef4444; font-weight:bold;">❌ ERRORE: ${err.message}</p>`;
    }
}

document.addEventListener("click", async (e) => {
    if (e.target.classList.contains("btn-add-to-cart") && currentRistoranteObj) {
        const id = e.target.getAttribute("data-id");
        const nome = e.target.getAttribute("data-nome");
        const prezzoBase = parseFloat(e.target.getAttribute("data-prezzo"));
        const descrizione = e.target.getAttribute("data-descrizione") || "";
        const grupoExtra = e.target.getAttribute("data-gruppo") || null;
        const forzaFarcitura = e.target.getAttribute("data-forzafarcitura") === "true";

        const orderMod = await import(`./order.js?v=10.0.0`);
        let cart = orderMod.getCartItems(currentRistoranteObj.id);
        
        // ID COMPATIBILE AL 100% SU TUTTI I TELEFONI CELLULARI (Sostituisce crypto.randomUUID)
        const nuovoCarrelloId = "id_" + Date.now() + "_" + Math.floor(Math.random() * 1000);
        
        cart.push({
            carrelloId: nuovoCarrelloId,
            id: id,
            nome: nome,
            prezzoOrig: prezzoBase,
            prezzo: prezzoBase,
            quantita: 1,
            descrizioneBase: descrizione,
            gruppoExtraAbbinato: grupoExtra,
            modificheStr: null
        });
        
        orderMod.saveCart(cart, currentRistoranteObj.id);
        orderMod.renderCart(currentRistoranteObj.id);

        if (forzaFarcitura) {
            orderMod.apriModaleVarianti(nuovoCarrelloId, currentRistoranteObj.id);
        } else {
            showToast(`Aggiunto: ${nome}`);
        }
    }
});

initMenu();
