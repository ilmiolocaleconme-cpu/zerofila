import { supabaseClient } from './supabase.js';
import { getRistoranteSlug, escapeHtml, showToast } from './utils.js';

const menuContainer = document.getElementById("menu-container");
const restNameHeader = document.getElementById("restaurant-name");
const cartContainer = document.getElementById("cart-items");
const cartTotalElement = document.getElementById("cart-total");

let currentRistoranteObj = null;

// --- FUNZIONE DI FORMATTAZIONE PREZZO INTERNA ANTI-CRASH ---
function formatPrice(price) {
    const num = Number(price);
    return isNaN(num) ? "0.00" : num.toFixed(2);
}

// --- GESTIONE CORE CARRELLO UNIFICATA MULTI-TENANT ---
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
            bottoneModificaOBL = `<button class="btn-apri-varianti" data-cid="${item.carrelloId}" style="background:transparent; border:none; color:#38bdf8; font-size:0.8rem; padding:0; text-align:left; cursor:pointer; margin-top:4px; font-weight:bold;">✍️ Modifica ingredienti</button>`;
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
                    <button class="btn-cart-meno" data-cid="${item.carrelloId}">-</button>
                    <span class="item-quantita">${item.quantita}</span>
                    <button class="btn-cart-piu" data-cid="${item.carrelloId}">+</button>
                </div>
            </div>
        `;
        cartContainer.appendChild(div);
    });

    if (cartTotalElement) cartTotalElement.textContent = "€ " + formatPrice(totale);
}

// --- LOGICA DI CARICAMENTO PRODOTTI DA SUPABASE ---
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
        
        const nomeVisualizzato = ristorante.nome || ristorante.name || "ZeroFila";
        if (restNameHeader) restNameHeader.textContent = nomeVisualizzato;

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
                        <p>${escapeHtml(p.descrizione || 'Scegli le varianti al click')}</p>
                        <span class="prezzo">€ ${formatPrice(p.prezzo)}</span>
                    </div>
                    <button class="btn-add-to-cart" data-id="${p.id}" data-nome="${escapeHtml(p.nome)}" data-prezzo="${p.prezzo}" data-descrizione="${escapeHtml(p.descrizione || '')}" data-gruppo="${escapeHtml(p.gruppo_extra || '')}" data-forzafarcitura="${isNudo ? 'true' : 'false'}">${testoBottone}</button>
                `;
                grid.appendChild(card);
            });

            section.appendChild(grid);
            menuContainer.appendChild(section);
        });

        renderCart(ristorante.id);
        initOrderButtonLogic();

    } catch (err) {
        console.error(err);
        menuContainer.innerHTML = `<p class="error-msg" style="color:#ef4444; font-weight:bold;">❌ ERRORE: ${err.message}</p>`;
    }
}

// --- APERTURA DELLA FINESTRA DI PERSONALIZZAZIONE (MODALE) ---
async function apriModaleVarianti(carrelloId) {
    if (!currentRistoranteObj) return;
    let cart = getCartItems(currentRistoranteObj.id);
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
            .eq("ristorante_id", currentRistoranteObj.id)
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
            variazioniList.push("Pane: " + nomePane);
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

        saveCart(cart, currentRistoranteObj.id);
        renderCart(currentRistoranteObj.id);
        vModal.remove();
        showToast("Configurazione salvata!");
    };
}

function initOrderButtonLogic() {
    const btnProcedi = document.getElementById("send-order");
    if (btnProcedi) {
        btnProcedi.replaceWith(btnProcedi.cloneNode(true));
        const newBtnProcedi = document.getElementById("send-order");
        
        newBtnProcedi.addEventListener("click", () => {
            if (!currentRistoranteObj) return;
            const attualiProdotti = getCartItems(currentRistoranteObj.id);
            if (attualiProdotti.length === 0) {
                showToast("Il carrello è vuoto!", "error");
                return;
            }
            showOrderModal();
        });
    }
}

function showOrderModal() {
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
    modal.querySelector("#modal-confirm").onclick = () => elaboraInvioComanda(modal);
}

async function elaboraInvioComanda(modal) {
    const confirmBtn = modal.querySelector("#modal-confirm");
    const cancelBtn = modal.querySelector("#modal-cancel");
    
    confirmBtn.disabled = true;
    confirmBtn.textContent = "⏳ Registrazione ordine...";

    try {
        const cart = getCartItems(currentRistoranteObj.id);
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

        // 1. Registrazione ordine nel database Supabase
        const { data: nuovoOrdine, error } = await supabaseClient
            .from("ordini")
            .insert([{
                ristorante_id: currentRistoranteObj.id,
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

        // 2. Inserimento prodotti correlati
        const prodottiPayload = cart.map(item => ({
            ordine_id: nuovoOrdine.id,
            prodotto_id: item.id,
            quantita: item.quantita,
            nome_prodotto: item.nome,
            prezzo: item.prezzo,
            modifiche: item.modificheStr
        }));
        await supabaseClient.from("ordine_prodotti").insert(prodottiPayload);

        // 3. Composizione del messaggio di testo per l'insegna
        const nomeInsegna = currentRistoranteObj.nome || currentRistoranteObj.name || "ZeroFila";
        
        let msg = `🛒 *NUOVO ORDINE DA ${nomeInsegna.toUpperCase()}*\n`;
        msg += `--------------------------------\n\n`;
        msg += `👤 *Cliente:* ${nome}\n`;
        msg += `📱 *Telefono:* ${telefono}\n`;
        msg += `📦 *Tipo:* ${tipo.toUpperCase()}\n`;
        if (tavolo) msg += `🪑 *Tavolo:* ${tavolo}\n`;
        if (indirizzo) msg += `📍 *Indirizzo:* ${indirizzo}\n`;
        if (note) msg += `📝 *Note:* ${note}\n`;
        msg += `\n📋 *PRODOTTI ORDINATI:*\n`;
        
        cart.forEach(item => {
            msg += `• ${item.quantita}x _${item.nome}_ - € ${formatPrice(item.prezzo * item.quantita)}\n`;
            if (item.modificheStr) msg += `  └ _Variazioni:_ ${item.modificheStr}\n`;
        });
        
        msg += `\n--------------------------------\n`;
        msg += `💰 *TOTALE DA PAGARE:* € ${formatPrice(subtotale)}\n\n`;
        msg += `✨ Ordinato con *ZeroFila*`;

        const numeroLocale = currentRistoranteObj.telefono ? currentRistoranteObj.telefono.toString().replace(/\s+/g, '') : "393896190004";
        const telefonoFinale = numeroLocale.startsWith("+") || numeroLocale.startsWith("39") ? numeroLocale : "39" + numeroLocale;

        // Azzera la grafica del carrello
        saveCart([], currentRistoranteObj.id);
        renderCart(currentRistoranteObj.id);

        if (cancelBtn) cancelBtn.style.display = "none";
        
        confirmBtn.disabled = false;
        confirmBtn.style.cssText = "width:100%; padding:15px; background:#25D366; color:white; font-weight:bold; font-size:1.1rem; border-radius:8px; border:none; cursor:pointer; box-shadow: 0 4px 12px rgba(37,211,102,0.3); margin-top:15px;";
        confirmBtn.innerHTML = "💬 Apri Chat e Conferma";

        // 🛠️ FUNZIONE DI REDIRECT DIRETTO INTEGRATO CON PROTOCOLLO /SEND/ CORRETTO
        confirmBtn.onclick = () => {
            confirmBtn.disabled = true;
            confirmBtn.textContent = "Apertura WhatsApp...";
            modal.remove();
            
            // Indirizzo ufficiale standard ://whatsapp.com con slash forzato anti-crash mobile
            const linkPrivatoSaaS = "https://://whatsapp.com/send/?phone=" + telefonoFinale + "&text=" + encodeURIComponent(msg);
            window.location.href = linkPrivatoSaaS;
        };

        showToast("✅ Registrato! Tocca il tasto verde per avviare WhatsApp.", "success");

    } catch (err) {
        console.error(err);
        showToast("❌ Errore procedura: " + err.message, "error");
        if (confirmBtn) {
            confirmBtn.disabled = false;
            confirmBtn.textContent = "✅ Invia Ordine";
        }
    }
}

// --- COORDINAMENTO DEI CLICK SULLO SCHERMO ---
document.addEventListener("click", (e) => {
    if (!currentRistoranteObj) return;

    if (e.target.classList.contains("btn-cart-piu")) {
        const cid = e.target.getAttribute("data-cid");
        let cart = getCartItems(currentRistoranteObj.id);
        const item = cart.find(i => i.carrelloId === cid);
        if (item) {
            item.quantita += 1;
            saveCart(cart, currentRistoranteObj.id);
            renderCart(currentRistoranteObj.id);
        }
    }

    if (e.target.classList.contains("btn-cart-meno")) {
        const cid = e.target.getAttribute("data-cid");
        let cart = getCartItems(currentRistoranteObj.id);
        const itemIndex = cart.findIndex(i => i.carrelloId === cid);
        if (itemIndex !== -1) {
            if (cart[itemIndex].quantita > 1) {
                cart[itemIndex].quantita -= 1;
            } else {
                cart.splice(itemIndex, 1);
            }
            saveCart(cart, currentRistoranteObj.id);
            renderCart(currentRistoranteObj.id);
        }
    }

    if (e.target.classList.contains("btn-apri-varianti")) {
        const cid = e.target.getAttribute("data-cid");
        apriModaleVarianti(cid);
    }

    if (e.target.classList.contains("btn-add-to-cart")) {
        const id = e.target.getAttribute("data-id");
        const nome = e.target.getAttribute("data-nome");
        const prezzoBase = parseFloat(e.target.getAttribute("data-prezzo"));
        const descrizione = e.target.getAttribute("data-descrizione") || "";
        const gruppoExtra = e.target.getAttribute("data-gruppo") || null;
        const forzaFarcitura = e.target.getAttribute("data-forzafarcitura") === "true";

        let cart = getCartItems(currentRistoranteObj.id);
        const nuovoCarrelloId = "id_" + Date.now() + "_" + Math.floor(Math.random() * 1000);
        
        cart.push({
            carrelloId: nuovoCarrelloId,
            id: id,
            nome: nome,
            prezzoOrig: prezzoBase,
            prezzo: prezzoBase,
            quantita: 1,
            descrizioneBase: descrizione,
            gruppoExtraAbbinato: gruppoExtra,
            modificheStr: null
        });
        
        saveCart(cart, currentRistoranteObj.id);
        renderCart(currentRistoranteObj.id);

        if (forzaFarcitura) {
            apriModaleVarianti(nuovoCarrelloId);
        } else {
            showToast(`Aggiunto: ${nome}`);
        }
    }
});

initMenu();
