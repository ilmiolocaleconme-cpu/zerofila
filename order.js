import { supabaseClient } from './supabase.js';
import { escapeHtml, formatPrice, showToast } from './utils.js';

const cartContainer = document.getElementById("cart-items");
const cartTotalElement = document.getElementById("cart-total");
const TARGET_SLUG = "al-panetto";

// --- GESTIONE CORE STORAGE CARRELLO ---
export function getCartItems() {
    const saved = localStorage.getItem(`zf_cart_${TARGET_SLUG}`);
    return saved ? JSON.parse(saved) : [];
}

export function saveCart(cart) {
    localStorage.setItem(`zf_cart_${TARGET_SLUG}`, JSON.stringify(cart || []));
}

export function renderCart() {
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

// --- INIZIALIZZAZIONE LOGICA ORDINI E AGGANCIO PULSANTE ---
export function initOrderLogic(ristorante) {
    const btnProcedi = document.getElementById("send-order");
    if (btnProcedi) {
        // Previene la duplicazione dei listener durante i re-render del menu
        btnProcedi.replaceWith(btnProcedi.cloneNode(true));
        const newBtnProcedi = document.getElementById("send-order");
        
        newBtnProcedi.addEventListener("click", () => {
            if (getCartItems().length === 0) {
                showToast("Il carrello è vuoto!", "error");
                return;
            }
            showOrderModal(ristorante);
        });
    }
}

// --- RENDERING GRAFICO MODALE DI CASSA ---
function showOrderModal(ristorante) {
    const urlParams = new URLSearchParams(window.location.search);
    const tavoloDalQR = urlParams.get('tavolo');

    // Recupero dati anagrafici salvati localmente (Funzionalità Richiesta)
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

        <!-- Mostra o nasconde solo i campi che servono (Funzionalità Richiesta) -->
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
    
    // Funzione interna per mostrare solo i dati strettamente necessari (Ogni modalità vede solo i suoi campi)
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

// --- LOGICA INTERNA TRANSAZIONE DATABASE E WHATSAPP ---
async function elaboraInvioComanda(modal, ristorante) {
    const confirmBtn = modal.querySelector("#modal-confirm");
    confirmBtn.disabled = true;
    confirmBtn.textContent = "Invio in corso...";

    try {
        const cart = getCartItems();
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

        // Salvataggio permanente dei dati anagrafici del cliente sul suo smartphone (Funzionalità Richiesta)
        localStorage.setItem("zf_user_nome", nome);
        localStorage.setItem("zf_user_telefono", telefono);

        const subtotale = cart.reduce((sum, item) => sum + Number(item.prezzo) * item.quantita, 0);

        // 1. Scrittura record comanda su Supabase per i monitor cucina
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

        // Inserimento dettagli prodotti ordinati su Supabase
        const prodottiPayload = cart.map(item => ({
            ordine_id: nuovoOrdine.id,
            prodotto_id: item.id,
            quantita: item.quantita,
            nome_prodotto: item.nome,
            prezzo: item.prezzo
        }));
        await supabaseClient.from("ordine_prodotti").insert(prodottiPayload);

        // 2. Importazione dinamica del file dei messaggi con azzeramento cache chirurgico
        const moduloMessaggi = await import(`./messaggi.js?t=${Date.now()}`);
        const msg = moduloMessaggi.componiMessaggioWhatsApp(nome, telefono, tipo, tavolo, indirizzo, note, cart, subtotale, ristorante.nome);

        // Controllo di sicurezza e normalizzazione sul numero di telefono del ristorante
        const numeroLocale = (ristorante && ristorante.telefono) ? ristorante.telefono.toString().replace(/\s+/g, '') : "393896190004";
        const telefonoFinale = numeroLocale.startsWith("+") || numeroLocale.startsWith("39") ? numeroLocale : `39${numeroLocale}`;

        // Pulizia interfaccia prima del salto
        saveCart([]);
        modal.remove();
        renderCart();
        showToast("✅ Ordine registrato!");

        // 3. GENERAZIONE ED APERTURA LINK CON ANCORAGGIO VIRTUALE (Infallibile contro i blocchi pop-up)
        const linkWhatsApp = document.createElement("a");
        linkWhatsApp.href = `https://wa.me{telefonoFinale}?text=${encodeURIComponent(msg)}`;
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

// --- EVENTI CLICK QUANTITÀ NELLA SIDEBAR ---
document.addEventListener("click", (e) => {
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
