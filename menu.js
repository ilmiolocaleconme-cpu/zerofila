import { supabaseClient } from './supabase.js';
import { getRistoranteSlug, escapeHtml, formatPrice } from './utils.js';

const menuContainer = document.getElementById("menu-container");
const restNameHeader = document.getElementById("restaurant-name");

let currentRistoranteObj = null;

/**
 * Inizializza l'applicazione caricando le categorie e i prodotti dal database
 */
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

        // Aggancio sincronizzato al carrello di order.js
        const orderMod = await import(`./order.js?v=7.0.0`);
        if (orderMod && typeof orderMod.renderCart === "function") {
            orderMod.renderCart(ristorante.id);
            orderMod.initOrderLogic(ristorante);
        }

    } catch (err) {
        console.error(err);
        menuContainer.innerHTML = `<p class="error-msg" style="color:#ef4444; font-weight:bold;">❌ ERRORE: ${err.message}</p>`;
    }
}

/**
 * INTERCETTATORE UNIFICATO CON FILTRO SELETTIVO EXTRA
 * Esclude la comparsa degli ingredienti di carne/formaggio all'interno delle bevande
 */
document.addEventListener("click", async (e) => {
    if (e.target.classList.contains("btn-add-to-cart") && currentRistoranteObj) {
        const id = e.target.getAttribute("data-id");
        const nome = e.target.getAttribute("data-nome");
        const prezzoBase = parseFloat(e.target.getAttribute("data-prezzo"));
        const descrizioneCibo = e.target.getAttribute("data-descrizione") || "";

        // Trova il blocco della sezione corrente per leggere il titolo della categoria a schermo
        const sezioneCategoria = e.target.closest(".menu-section");
        const nomeCategoria = sezioneCategoria ? (sezioneCategoria.querySelector(".categoria-titolo")?.textContent || "") : "";

        let ingredientiExtraDalDB = [];
        
        // CONTROLLO COMMERCIALE: Se il titolo contiene "Bevande" o l'emoji 🥤, salta la lettura degli extra!
        if (!nomeCategoria.includes("Bevande") && !nomeCategoria.includes("🥤")) {
            try {
                const { data: extras } = await supabaseClient
                    .from("ingredienti_extra")
                    .select("*")
                    .eq("ristorante_id", currentRistoranteObj.id);
                if (extras) ingredientiExtraDalDB = extras;
            } catch (err) {
                console.error("Errore lettura ingredienti extra:", err);
            }
        }

        const ingredientiBase = descrizioneCibo ? descrizioneCibo.split(',').map(i => i.trim()).filter(i => i.length > 0) : [];

        const modalHTML = `
        <div id="variant-modal" class="modal" style="position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.7); display:flex; justify-content:center; align-items:center; z-index:99999;">
          <div style="background:#1e293b; padding:25px; border-radius:12px; width:90%; max-width:450px; border:1px solid #334155; color:white;">
            <h3 style="margin-top:0; color:#38bdf8;">Personalizza: ${escapeHtml(nome)}</h3>
            <p style="font-size:0.85rem; color:#94a3b8;">Scegli cosa rimuovere o aggiungere al tuo piatto.</p>
            
            ${ingredientiBase.length > 0 ? '<h4 style="margin-bottom:5px; font-size:0.9rem; color:#ef4444;">❌ Rimuovi ingredienti:</h4>' : ''}
            <div style="margin-bottom:15px;">
                ${ingredientiBase.map((ing) => `
                    <label style="display:flex; align-items:center; margin-bottom:6px; font-size:0.9rem; cursor:pointer;">
                        <input type="checkbox" class="chk-rimozione" value="${escapeHtml(ing)}" style="margin-right:8px;"> NO ${escapeHtml(ing)}
                    </label>
                `).join('')}
            </div>

            ${ingredientiExtraDalDB.length > 0 ? '<h4 style="margin-bottom:5px; font-size:0.9rem; color:#10b981;">➕ Aggiungi Extra del locale:</h4>' : ''}
            <div style="margin-bottom:20px;">
                ${ingredientiExtraDalDB.map((extra) => `
                    <label style="display:flex; align-items:center; margin-bottom:6px; font-size:0.9rem; cursor:pointer;">
                        <input type="checkbox" class="chk-aggiunta" data-nome="${escapeHtml(extra.nome)}" data-prezzo="${extra.prezzo_extra}" style="margin-right:8px;">
                        + ${escapeHtml(extra.nome)} (+ € ${Number(extra.prezzo_extra).toFixed(2)})
                    </label>
                `).join('')}
            </div>

            <div style="text-align:right;">
                <button id="btn-annulla-variante" style="background:#475569; border:none; padding:8px 16px; border-radius:6px; color:white; margin-right:10px;">Annulla</button>
                <button id="btn-conferma-variante" style="background:#10b981; border:none; padding:8px 16px; border-radius:6px; color:#0f172a; font-weight:bold;">Aggiungi 🛒</button>
            </div>
          </div>
        </div>`;

        document.body.insertAdjacentHTML('beforeend', modalHTML);
        const vModal = document.getElementById("variant-modal");

        vModal.querySelector("#btn-annulla-variante").onclick = () => vModal.remove();

        vModal.querySelector("#btn-conferma-variante").onclick = () => {
            let variazioniList = [];
            let prezzoFinaleProdotto = parseFloat(prezzoBase);

            vModal.querySelectorAll(".chk-rimozione:checked").forEach(chk => {
                variazioniList.push("NO " + chk.value);
            });

            vModal.querySelectorAll(".chk-aggiunta:checked").forEach(chk => {
                const nomeExtra = chk.getAttribute("data-nome");
                const prezzoExtra = parseFloat(chk.getAttribute("data-prezzo"));
                variazioniList.push("+" + nomeExtra);
                prezzoFinaleProdotto += prezzoExtra;
            });

            const modificheStringaFinale = variazioniList.join(", ");

            // Trasferimento sicuro al modulo order.js per il rendering nel carrello laterale
            import(`./order.js?v=7.0.0`).then((orderMod) => {
                let cart = orderMod.getCartItems(currentRistoranteObj.id);
                cart.push({
                    carrelloId: crypto.randomUUID(),
                    id: id,
                    nome: nome,
                    prezzo: prezzoFinaleProdotto,
                    quantita: 1,
                    modificheStr: modificheStringaFinale || null
                });
                orderMod.saveCart(cart, currentRistoranteObj.id);
                orderMod.renderCart(currentRistoranteObj.id);
                vModal.remove();
            });
        };
    }
});

initMenu();
