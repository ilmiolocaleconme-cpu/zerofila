// cart.js
import { supabaseClient } from './supabase.js';

const cartContainer = document.getElementById("cart-items");
const cartTotalElement = document.getElementById("cart-total");

let piattoInPersonalizzazione = null;

function getStorageKey() {
    const ristorante = JSON.parse(sessionStorage.getItem("zf_current_ristorante"));
    return ristorante ? `zf_cart_${ristorante.id}` : "zf_cart_generic";
}

export function getCartItems() {
    const saved = localStorage.getItem(getStorageKey());
    return saved ? JSON.parse(saved) : [];
}

export function renderCart() {
    if (!cartContainer) return;
    const localCart = getCartItems();

    if (localCart.length === 0) {
        cartContainer.innerHTML = "<p class='cart-empty'>Il carrello è vuoto</p>";
        if (cartTotalElement) cartTotalElement.textContent = "€ 0.00";
        return;
    }

    cartContainer.innerHTML = "";
    let totale = 0;

    localCart.forEach(item => {
        totale += item.prezzo * item.quantita;
        const itemHTML = document.createElement("div");
        itemHTML.className = "cart-item";
        itemHTML.innerHTML = `
            <div class="cart-item-row">
                <span class="item-nome">${item.nome}</span>
                <div class="item-controlli">
                    <button class="btn-cart-meno" data-cid="${item.carrelloId}">-</button>
                    <span class="item-quantita">${item.quantita}</span>
                    <button class="btn-cart-piu" data-cid="${item.carrelloId}">+</button>
                </div>
                <span class="item-prezzo">€ ${(item.prezzo * item.quantita).toFixed(2)}</span>
            </div>
            ${item.modifiche ? `<div class="cart-item-modifiche">⚠️ Modifiche: ${item.modifiche}</div>` : ''}
        `;
        cartContainer.appendChild(itemHTML);
    });

    if (cartTotalElement) cartTotalElement.textContent = `€ ${totale.toFixed(2)}`;
    agganciaControlliCarrello();
}

function modificaQuantita(carrelloId, azione) {
    let localCart = getCartItems();
    const item = localCart.find(i => i.carrelloId === carrelloId);
    if (!item) return;

    if (azione === "piu") {
        item.quantita++;
    } else if (azione === "meno") {
        item.quantita--;
        if (item.quantita <= 0) {
            localCart = localCart.filter(i => i.carrelloId !== carrelloId);
        }
    }
    localStorage.setItem(getStorageKey(), JSON.stringify(localCart));
    renderCart();
}

function agganciaControlliCarrello() {
    cartContainer.querySelectorAll(".btn-cart-piu").forEach(b => b.onclick = (e) => modificaQuantita(e.target.dataset.cid, "piu"));
    cartContainer.querySelectorAll(".btn-cart-meno").forEach(b => b.onclick = (e) => modificaQuantita(e.target.dataset.cid, "meno"));
}

async function apriModalPersonalizzazione(prodottoId) {
    const ristorante = JSON.parse(sessionStorage.getItem("zf_current_ristorante"));
    try {
        const [prodRes, extraRes] = await Promise.all([
            supabaseClient.from("prodotti").select("*").eq("id", prodottoId).single(),
            supabaseClient.from("ingredienti_extra").select("*").eq("ristorante_id", ristorante.id)
        ]);

        if (prodRes.error) throw prodRes.error;
        const prodotto = prodRes.data;
        const tuttiExtra = extraRes.data || [];

        piattoInPersonalizzazione = {
            id: prodotto.id, nome: prodotto.nome, prezzoBase: prodotto.prezzo, prezzoFinale: prodotto.prezzo, rimossi: [], aggiunti: []
        };

        let ingredientiBaseHTML = "";
        if (prodotto.ingredienti_base && prodotto.ingredienti_base.length > 0) {
            prodotto.ingredienti_base.forEach(ing => {
                ingredientiBaseHTML += `
                    <label class="custom-chk-label" style="display:flex; align-items:center; gap:10px; margin-bottom:8px;">
                        <input type="checkbox" class="chk-ingrediente-base" data-ingrediente="${ing}" checked style="width:auto; margin:0;">
                        <span>${ing}</span>
                    </label>
                `;
            });
        } else { ingredientiBaseHTML = "<p style='color:var(--text-muted); font-style:italic;'>Nessun ingrediente base.</p>"; }

        let ingredientiExtraHTML = "";
        if (tuttiExtra.length > 0) {
            tuttiExtra.forEach(ext => {
                ingredientiExtraHTML += `
                    <label class="custom-chk-label" style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
                        <div style="display:flex; align-items:center; gap:10px;">
                            <input type="checkbox" class="chk-ingrediente-extra" data-nome="${ext.nome}" data-prezzo="${ext.prezzo_supplemento}" style="width:auto; margin:0;">
                            <span>+ ${ext.nome}</span>
                        </div>
                        <span style="color:var(--color-pronto); font-weight:bold;">+ € ${ext.prezzo_supplemento.toFixed(2)}</span>
                    </label>
                `;
            });
        } else { ingredientiExtraHTML = "<p style='color:var(--text-muted); font-style:italic;'>Nessun ingrediente extra.</p>"; }

        const modalHTML = `
        <div id="custom-pizza-modal" class="modal" style="z-index:10000;">
          <div class="modal-content" style="max-width:400px;">
            <h3 style="color:var(--color-pronto); margin-bottom:15px; text-align:center;">${prodotto.nome}</h3>
            <div style="margin-bottom:15px; max-height:180px; overflow-y:auto;">
                <h4>Rimuovi Ingredienti</h4>
                ${ingredientiBaseHTML}
            </div>
            <div style="margin-bottom:20px; max-height:180px; overflow-y:auto; border-top:1px dashed #334155; padding-top:15px;">
                <h4>Aggiungi Extra</h4>
                ${ingredientiExtraHTML}
            </div>
            <div style="background:rgba(0,0,0,0.2); padding:12px; border-radius:8px; display:flex; justify-content:space-between; font-weight:bold; margin-bottom:15px;">
                <span>Totale Piatto:</span><span id="custom-plate-price">€ ${prodotto.prezzo.toFixed(2)}</span>
            </div>
            <div class="modal-buttons">
                <button type="button" id="btn-custom-cancel">Annulla</button>
                <button type="button" id="btn-custom-confirm">🛒 Inserisci</button>
            </div>
          </div>
        </div>`;

        document.body.insertAdjacentHTML('beforeend', modalHTML);
        const modal = document.getElementById("custom-pizza-modal");
        const baseCheckboxes = modal.querySelectorAll(".chk-ingrediente-base");
        const extraCheckboxes = modal.querySelectorAll(".chk-ingrediente-extra");

        function ricalcolaPrezzoPiatto() {
            let extraTotale = 0;
            piattoInPersonalizzazione.rimossi = [];
            piattoInPersonalizzazione.aggiunti = [];

            baseCheckboxes.forEach(cb => { if (!cb.checked) piattoInPersonalizzazione.rimossi.push(cb.dataset.ingrediente); });
            extraCheckboxes.forEach(cb => {
                if (cb.checked) {
                    const pr = parseFloat(cb.dataset.prezzo);
                    extraTotale += pr;
                    piattoInPersonalizzazione.aggiunti.push({ nome: cb.dataset.nome, prezzo: pr });
                }
            });

            piattoInPersonalizzazione.prezzoFinale = piattoInPersonalizzazione.prezzoBase + extraTotale;
            document.getElementById("custom-plate-price").textContent = `€ ${piattoInPersonalizzazione.prezzoFinale.toFixed(2)}`;
        }

        baseCheckboxes.forEach(cb => cb.onchange = ricalcolaPrezzoPiatto);
        extraCheckboxes.forEach(cb => cb.onchange = ricalcolaPrezzoPiatto);
        document.getElementById("btn-custom-cancel").onclick = () => modal.remove();
        document.getElementById("btn-custom-confirm").onclick = () => {
            let rimozioni = piattoInPersonalizzazione.rimossi.map(ing => `-${ing}`);
            let aggiunte = piattoInPersonalizzazione.aggiunti.map(ext => `+${ext.nome}`);
            let stringaModifiche = [...rimozioni, ...aggiunte].join(", ");

            const carrelloId = `${piattoInPersonalizzazione.id}_${btoa(unescape(encodeURIComponent(stringaModifiche)))}`;
            let currentCart = getCartItems();
            const itemEsistente = currentCart.find(i => i.carrelloId === carrelloId);

            if (itemEsistente) { itemEsistente.quantita++; } 
            else {
                currentCart.push({
                    carrelloId, id: piattoInPersonalizzazione.id, nome: piattoInPersonalizzazione.nome,
                    prezzo: piattoInPersonalizzazione.prezzoFinale, quantita: 1, modifiche: stringaModifiche || null
                });
            }
            localStorage.setItem(getStorageKey(), JSON.stringify(currentCart));
            modal.remove();
            renderCart();
        };
    } catch (err) { console.error(err); }
}

window.addEventListener("menuRendered", () => {
    renderCart();
    document.querySelectorAll(".btn-add-to-cart").forEach(button => {
        button.onclick = (e) => apriModalPersonalizzazione(e.target.dataset.id);
    });
});
