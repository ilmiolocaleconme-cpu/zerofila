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
        div.style.cssText = "display:flex; flex-direction:column; padding:10px 0; border-bottom:1px solid #334155;";
        
        let infoModifiche = "";
        if (item.modificheStr) {
            infoModifiche = `<div style="font-size:0.75rem; color:#eab308; margin-top:2px;">Variazioni: ${escapeHtml(item.modificheStr)}</div>`;
        }

        let bottoneModificaOBL = "";
        if (item.gruppoExtraAbbinato && item.gruppoExtraAbbinato.trim() !== "") {
            bottoneModificaOBL = `<button class="btn-apri-varianti" data-cid="${item.carrelloId}" data-rid="${ristoranteId}" style="background:transparent; border:none; color:#38bdf8; font-size:0.8rem; padding:0; text-align:left; cursor:pointer; margin-top:4px; font-weight:bold;">✍️ Modifica ingredienti</button>`;
        }

        div.innerHTML = `
            <div style="display:flex; justify-content:space-between; align-items:center; width:100%;">
                <span class="item-nome" style="font-weight:bold;">${escapeHtml(item.nome)}</span>
                <span class="item-prezzo" style="font-weight:bold; color:#f1f5f9;">€ ${formatPrice(item.prezzo * item.quantita)}</span>
            </div>
            ${infoModifiche}
            <div style="display:flex; justify-content:space-between; align-items:center; width:100%; margin-top:6px;">
                ${bottoneModificaOBL}
                <div class="item-controlli" style="display:flex; align-items:center; gap:8px;">
                    <button class="btn-cart-meno" data-cid="${item.carrelloId}" data-rid="${ristoranteId}">-</button>
                    <span class="item-quantita">${item.quantita}</span>
                    <button class="btn-cart-piu" data-cid="${item.carrelloId}" data-rid="${ristoranteId}">+</button>
                </div>
            </div>
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

export async function apriModaleVarianti(carrelloId, ristoranteId) {
    let cart = getCartItems(ristoranteId);
    const item = cart.find(i => i.carrelloId === carrelloId);
    if (!item || !item.gruppoExtraAbbinato) return;

    showToast("Lettura banco condimenti...", "info");

    let opzioniSingole = [];
    let opzioniMultipleGratis = [];
    let opzioniMultipleExtra = [];

    try {
        const { data: extras, error } = await supabaseClient
            .from("ingredienti_extra")
            .select("*")
            .eq("ristorante_id", ristoranteId)
            .eq("gruppo_extra", item.gruppoExtraAbbinato)
            .order("nome", { ascending: true });
        
        if (!error && extras) {
            opzioniSingole = extras.filter(e => e.tipo_selezione === 'singola');
            const multiple = extras.filter(e => e.tipo_selezione !== 'singola');
            opzioniMultipleGratis = multiple.filter(e => Number(e.prezzo_extra) === 0);
            opzioniMultipleExtra = multiple.filter(e => Number(e.prezzo_extra) > 0);
        }
    } catch (e) {
        console.error(e);
    }

    const ingredientiBase = item.descrizioneBase ? item.descrizioneBase.split(',').map(i => i.trim()).filter(i => i.length > 0) : [];

    const modalHTML = `
    <div id="variant-modal" class="modal" style="position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.7); display:flex; justify-content:center; align-items:center; z-index:99999;">
      <div style="background:#1e293b; padding:25px; border-radius:12px; width:90%; max-width:450px; border:1px solid #334155; color:white; max-height:85vh; overflow-y:auto;">
        <h3 style="margin-top:0; color:#38bdf8;">Configura: ${escapeHtml(item.nome)}</h3>
        
        ${opzioniSingole.length > 0 ? `
            <h4 style="margin:15px 0 5px 0; font-size:0.9rem; color:#f59e0b;">🥖 Opzione obbligatoria (Seleziona una):</h4>
            <div style="margin-bottom:15px; background:#0f172a; padding:10px; border-radius:6px; border:1px solid #334155;">
                ${opzioniSingole.map((p, index) => `
                    <label style="display:flex; align-items:center; margin-bottom:8px; font-size:0.9rem; cursor:pointer;">
                        <input type="radio" name="radio-scelta-singola" class="rad-pane" data-nome="${escapeHtml(p.nome)}" data-prezzo="${p.prezzo_extra}" style="margin-right:8px;" ${index === 0 ? "checked" : ""}>
                        ${escapeHtml(p.nome)} ${Number(p.prezzo_extra) > 0 ? `(+ € ${Number(p.prezzo_extra).toFixed(2)})` : '(Incluso)'}
                    </label>
                `).join('')}
            </div>
        ` : ''}

        ${ingredientiBase.length > 0 ? `
            <h4 style="margin:15px 0 5px 0; font-size:0.9rem; color:#ef4444;">❌ Togli ingredienti ricetta base:</h4>
            <div style="margin-bottom:15px;">
                ${ingredientiBase.map((ing) => `
                    <label style="display:flex; align-items:center; margin-bottom:6px; font-size:0.9rem; cursor:pointer;">
                        <input type="checkbox" class="chk-rimozione" value="${escapeHtml(ing)}" ${item.modificheStr && item.modificheStr.includes("NO " + ing) ? "checked" : ""}> NO ${escapeHtml(ing)}
                    </label>
                `).join('')}
            </div>
        ` : ''}

        ${opzioniMultipleGratis.length > 0 ? `
            <h4 style="margin:15px 0 5px 0; font-size:0.9rem; color:#38bdf8;">🥤 Opzioni incluse (Gratis - Max 3):</h4>
            <div style="margin-bottom:15px; display:grid; grid-template-columns:1fr 1fr; gap:6px;">
                ${opzioniMultipleGratis.map((cond) => `
                    <label style="display:flex; align-items:center; font-size:0.85rem; cursor:pointer;">
                        <input type="checkbox" class="chk-gratis-salsa" data-nome="${escapeHtml(cond.nome)}" ${item.modificheStr && item.modificheStr.includes("+" + cond.nome) ? "checked" : ""}> + ${escapeHtml(cond.nome)}
                    </label>
                `).join('')}
            </div>
        ` : ''}

        ${opzioniMultipleExtra.length > 0 ? `
            <h4 style="margin:15px 0 5px 0; font-size:0.9rem; color:#10b981;">➕ Aggiungi condimenti / Varianti extra:</h4>
            <div style="margin-bottom:15px;">
                ${opzioniMultipleExtra.map((extra) => `
                    <label style="display:flex; align-items:center; margin-bottom:6px; font-size:0.9rem; cursor:pointer;">
                        <input type="checkbox" class="chk-pagamento-extra" data-nome="${escapeHtml(extra.nome)}" data-prezzo="${extra.prezzo_extra}" ${item.modificheStr && item.modificheStr.includes("+" + extra.nome) ? "checked" : ""}>
                        + ${escapeHtml(extra.nome)} (+ € ${Number(extra.prezzo_extra).toFixed(2)})
                    </label>
                `).join('')}
            </div>
        ` : ''}

        <div style="text-align:right; margin-top:20px; border-top:1px solid #334155; padding-top:15px;">
            <button id="btn-annulla-variante" style="background:#475569; border:none; padding:8px 16px; border-radius:6px; color:white; margin-right:10px;">Chiudi</button>
            <button id="btn-conferma-variante" style="background:#10b981; border:none; padding:8px 16px; border-radius:6px; color:#0f172a; font-weight:bold;">Salva ricetta ✨</button>
        </div>
      </div>
    </div>`;

    document.body.insertAdjacentHTML('beforeend', modalHTML);
    const vModal = document.getElementById("variant-modal");

    const chkSalse = vModal.querySelectorAll(".chk-gratis-salsa");
    chkSalse.forEach(chk => {
        chk.addEventListener("change", () => {
            if (vModal.querySelectorAll(".chk-gratis-salsa:checked").length > 3) {
                chk.checked = false;
                alert("Puoi scegliere un massimo di 3 opzioni gratuite!");
            }
        });
    });

    vModal.querySelector("#btn-annulla-variante").onclick = () => vModal.remove();

    vModal.querySelector("#btn-conferma-variante").onclick = () => {
        let variazioniList = [];
        let nuovoPrezzoCalcolato = parseFloat(item.prezzoOrig);

        const radPaneScelto = vModal.querySelector(".rad-pane:checked");
        if (radPaneScelto) {
            const nomePane = radPaneScelto.getAttribute("data-nome");
            const prezzoPane = parseFloat(radPaneScelto.getAttribute("data-prezzo"));
            variazioniList.push("Scelta: " + nomePane);
            nuovoPrezzoCalcolato += prezzoPane;
        }

        vModal.querySelectorAll(".chk-rimozione:checked").forEach(chk => {
            variazioniList.push("NO " + chk.value);
        });

        vModal.querySelectorAll(".chk-gratis-salsa:checked").forEach(chk => {
            variazioniList.push("+" + chk.getAttribute("data-nome"));
        });

        vModal.querySelectorAll(".chk-pagamento-extra:checked").forEach(chk => {
            variazioniList.push("+" + chk.getAttribute("data-nome"));
            nuovoPrezzoCalcolato += parseFloat(chk.getAttribute("data-prezzo"));
        });

        item.modificheStr = variazioniList.join(", ") || null;
        item.prezzo = nuovoPrezzoCalcolato;

        saveCart(cart, ristoranteId);
        renderCart(ristoranteId);
        vModal.remove();
        showToast("Configurazione salvata!");
    };
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

    if (e.target.classList.contains("btn-apri-varianti")) {
        const cid = e.target.getAttribute("data-cid");
        const rid = e.target.getAttribute("data-rid");
        apriModaleVarianti(cid, rid);
    }
});
