import { supabaseClient } from './supabase.js';
import { escapeHtml, formatPrice, showToast } from './utils.js';
import { componiMessaggioWhatsApp } from './messaggi.js';

const cartContainer = document.getElementById("cart-items");
const cartTotalElement = document.getElementById("cart-total");

export function getCartItems(ristoranteId) {
    const key = ristoranteId ? `zf_cart_${ristoranteId}` : "zf_cart_generic";
    const saved = localStorage.getItem(key);
    return saved ? JSON.parse(saved) : [];
}

export function saveCart(cart, ristoranteId) {
    const key = ristoranteId ? `zf_cart_${ristoranteId}` : "zf_cart_generic";
    localStorage.setItem(key, JSON.stringify(cart || []));
}

export function renderCart(ristoranteId) {
    if (!cartContainer) return;
    const cart = getCartItems(ristoranteId);

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
        
        let infoModifiche = "";
        if (item.modificheStr) {
            infoModifiche = `<div style="font-size:0.75rem; color:#eab308; margin-top:2px;">Variazioni: ${escapeHtml(item.modificheStr)}</div>`;
        }

        div.innerHTML = `
            <div style="flex:1;">
                <span class="item-nome">${escapeHtml(item.nome)}</span>
                ${infoModifiche}
            </div>
            <div class="item-controlli">
                <button class="btn-cart-meno" data-cid="${item.carrelloId}" data-rid="${ristoranteId}">-</button>
                <span class="item-quantita">${item.quantita}</span>
                <button class="btn-cart-piu" data-cid="${item.carrelloId}" data-rid="${ristoranteId}">+</button>
            </div>
            <span class="item-prezzo">€ ${formatPrice(item.prezzo * item.quantita)}</span>
        `;
        cartContainer.appendChild(div);
    });

    if (cartTotalElement) cartTotalElement.textContent = "€ " + formatPrice(totale);
}

export function initOrderLogic(ristorante) {
    const btnProcedi = document.getElementById("send-order");
    if (btnProcedi) {
        btnProcedi.replaceWith(btnProcedi.cloneNode(true));
        const newBtnProcedi = document.getElementById("send-order");
        
        newBtnProcedi.addEventListener("click", () => {
            if (getCartItems(ristorante.id).length === 0) {
                showToast("Il carrello è vuoto!", "error");
                return;
            }
            showOrderModal(ristorante);
        });
    }
}

// STRUTTURA AVANZATA: Estrae gli ingredienti extra in tempo reale da Supabase in base al ristorante
window.apriModaleVarianti = async function(prodottoId, nome, prezzoBase, descrizioneCibo, ristorante) {
    if (!ristorante) return;
    
    // Mostra un caricamento leggero mentre scarica gli extra dal DB
    showToast("Caricamento opzioni...", "info");

    let ingredientiExtraDalDB = [];
    try {
        const { data: extras, error } = await supabaseClient
            .from("ingredienti_extra")
            .select("*")
            .eq("ristorante_id", ristorante.id);
        
        if (!error && extras) {
            ingredientiExtraDalDB = extras;
        }
    } catch (e) {
        console.error("Errore recupero extra:", e);
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
                    <input type="checkbox" class="chk-aggiunta" data-nome="${escapeHtml(extra.nome)}" data-prezzo="${extra.prezzo}" style="margin-right:8px;">
                    + ${escapeHtml(extra.nome)} (+ € ${Number(extra.prezzo).toFixed(2)})
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

        let cart = getCartItems(ristorante.id);
        cart.push({
            carrelloId: crypto.randomUUID(),
            id: prodottoId,
            nome: nome,
            prezzo: prezzoFinaleProdotto,
            quantita: 1,
            modificheStr: modificheStringaFinale || null
        });

        saveCart(cart, ristorante.id);
        renderCart(ristorante.id);
        vModal.remove();
        showToast("Prodotto aggiunto!");
    };
};

function showOrderModal(ristorante) {
    const urlParams = new URLSearchParams(window.location.search);
    const tavoloDalQR = urlParams.get('tavolo');

    const salvatoNome = localStorage.getItem("zf_user_nome") || "";
    const salvatoTelefono = localStorage.getItem("zf_user_telefono") || "";

    const modalHTML = `
    <div id="order-modal" class="modal">
      <div class="modal-content">
        <h2>Completa il tuo Ordine</h2>
        
        <label>Nome e Cognome <span class="required">*</span></label>
        <input type="text" id="cliente-nome" value="${escapeHtml(salvatoNome)}" placeholder="Mario Rossi" required>

        <label>Tipo di Ordine</label>
        <select id="tipo-ordine" ${tavoloDalQR ? 'disabled' : ''}>
          <option value="tavolo" ${tavoloDalQR ? 'selected' : ''}>🪑 Al Tavolo</option>
          <option value="asporto" ${!tavoloDalQR ? 'selected' : ''}>📦 Asporto</option>
          <option value="delivery">🚀 Delivery</option>
        </select>

        <div id="tavolo-fields">
          <label>N° Tavolo <span class="required">*</span></label>
          <input type="text" id="tavolo" value="${tavoloDalQR || ''}" ${tavoloDalQR ? 'readonly' : ''} placeholder="Esempio: 5">
        </div>

        <div id="delivery-fields" style="display:none;">
          <label>Indirizzo di consegna <span class="required">*</span></label>
          <input type="text" id="indirizzo" placeholder="Via Roma 123">
        </div>

        <label>Telefono <span class="required">*</span></label>
        <input type="tel" id="telefono" value="${escapeHtml(salvatoTelefono)}" placeholder="333 1234567" required>

        <label>Note / Allergie</label>
        <textarea id="note" rows="3" placeholder="Allergie, preferenze..."></textarea>

        <div class="modal-buttons">
          <button id="modal-cancel">Annulla</button>
          <button id="modal-confirm">✅ Invia Ordine</button>
        </div>
      </div>
    </div>`;

    document.body.insertAdjacentHTML('beforeend', modalHTML);
    const modal = document.getElementById("order-modal");
    const tipoSelect = modal.querySelector("#tipo-ordine");
    
    const aggiornaCampiVisibili = () => {
        const val = tipoSelect.value;
        document.getElementById("tavolo-fields").style.display = val === "tavolo" ? "block" : "none";
        document.getElementById("delivery-fields").style.display = val === "delivery" ? "block" : "none";
    };

    aggiornaCampiVisibili();
    tipoSelect.addEventListener("change", aggiornaCampiVisibili);

    modal.querySelector("#modal-cancel").onclick = () => modal.remove();
    modal.querySelector("#modal-confirm").onclick = () => elaboraInvioComanda(modal, ristorante);
}

async function elaboraInvioComanda(modal, ristorante) {
    const confirmBtn = modal.querySelector("#modal-confirm");
    confirmBtn.disabled = true;
    confirmBtn.textContent = "Invio in corso...";

    try {
        const cart = getCartItems(ristorante.id);
        if (cart.length === 0) throw new Error("Carrello vuoto");

        const nome = modal.querySelector("#cliente-nome").value.trim();
        const tipo = modal.querySelector("#tipo-ordine").value;
        const telefono = modal.querySelector("#telefono").value.trim();
        const note = modal.querySelector("#note").value.trim();
        const tavolo = tipo === "tavolo" ? modal.querySelector("#tavolo")?.value.trim() : null;
        const indirizzo = tipo === "delivery" ? modal.querySelector("#indirizzo")?.value.trim() : null;

        if (!nome || !telefono) throw new Error("Nome e telefono sono obbligatori");
        if (tipo === "tavolo" && !tavolo) throw new Error("Inserisci il numero del tavolo");
        if (tipo === "delivery" && !indirizzo) throw new Error("Inserisci l'indirizzo");

        localStorage.setItem("zf_user_nome", nome);
        localStorage.setItem("zf_user_telefono", telefono);

        const subtotale = cart.reduce((sum, item) => sum + Number(item.prezzo) * item.quantita, 0);

        const { data: nuovoOrdine, error } = await supabaseClient
            .from("ordini")
            .insert([{
                ristorante_id: ristorante.id,
                totale: subtotale,
                stato: "ricevuto",
                tipo_ordine: tipo,
                nome_cliente: nome,
                telefono: telefono,
                tavolo: tavolo,
                indirizzo: indirizzo,
                note: note || null
            }])
            .select()
            .single();

        if (error) throw error;

        const prodottiPayload = cart.map(item => ({
            ordine_id: nuovoOrdine.id,
            prodotto_id: item.id,
            quantita: item.quantita,
            nome_prodotto: item.nome,
            prezzo: item.prezzo,
            modifiche: item.modificheStr
        }));
        await supabaseClient.from("ordine_prodotti").insert(prodottiPayload);

        const msg = componiMessaggioWhatsApp(nome, telefono, tipo, tavolo, indirizzo, note, cart, subtotale, ristorante.nome);

        const numeroLocale = (ristorante && ristorante.telefono) ? ristorante.telefono.toString().replace(/\s+/g, '') : "393896190004";
        const telefonoFinale = numeroLocale.startsWith("+") || numeroLocale.startsWith("39") ? numeroLocale : "39" + numeroLocale;

        saveCart([], ristorante.id);
        modal.remove();
        renderCart(ristorante.id);
        showToast("✅ Ordine registrato!");

        const endpointWhatsApp = new URL("https://whatsapp.com");
        endpointWhatsApp.searchParams.set("phone", telefonoFinale);
        endpointWhatsApp.searchParams.set("text", msg);

        const linkWhatsApp = document.createElement("a");
        linkWhatsApp.href = endpointWhatsApp.toString();
        linkWhatsApp.target = "_top";
        linkWhatsApp.rel = "noopener noreferrer";
        
        document.body.appendChild(linkWhatsApp);
        linkWhatsApp.click();
        document.body.removeChild(linkWhatsApp);

    } catch (err) {
        console.error(err);
        showToast(err.message, "error");
    } finally {
        if (confirmBtn) {
            confirmBtn.disabled = false;
            confirmBtn.textContent = "✅ Invia Ordine";
        }
    }
}

document.addEventListener("click", (e) => {
    if (e.target.classList.contains("btn-cart-piu")) {
        const cid = e.target.getAttribute("data-cid");
        const rid = e.target.getAttribute("data-rid");
        let cart = getCartItems(rid);
        const item = cart.find(i => i.carrelloId === cid);
        if (item) {
            item.quantita += 1;
            saveCart(cart, rid);
            renderCart(rid);
        }
    }

    if (e.target.classList.contains("btn-cart-meno")) {
        const cid = e.target.getAttribute("data-cid");
        const rid = e.target.getAttribute("data-rid");
        let cart = getCartItems(rid);
        const itemIndex = cart.findIndex(i => i.carrelloId === cid);
        if (itemIndex !== -1) {
            if (cart[itemIndex].quantita > 1) {
                cart[itemIndex].quantita -= 1;
            } else {
                cart.splice(itemIndex, 1);
            }
            saveCart(cart, rid);
            renderCart(rid);
        }
    }
});
