// order.js - VERSIONE COMPLETA
import { getCartItems, saveCart } from './cart.js';
import { supabaseClient } from './supabase.js';
import { escapeHtml, showToast } from './utils.js';

const COPERTO_AMOUNT = 1.50;

export function showOrderModal() {
    const dataRistorante = sessionStorage.getItem("zf_current_ristorante");
    if (!dataRistorante) return showToast("Errore: Locale non identificato", "error");

    const ristorante = JSON.parse(dataRistorante);
    const urlParams = new URLSearchParams(window.location.search);
    const tavoloDalQR = urlParams.get('tavolo');

    const modalHTML = `
    <div id="order-modal" class="modal">
      <div class="modal-content">
        <h2>Completa il tuo Ordine</h2>
        
        <label>Nome e Cognome <span class="required">*</span></label>
        <input type="text" id="cliente-nome" placeholder="Mario Rossi" required>

        <label>Tipo di Ordine</label>
        <select id="tipo-ordine" ${tavoloDalQR ? 'disabled' : ''}>
          <option value="tavolo" ${tavoloDalQR ? 'selected' : ''}>🪑 Al Tavolo</option>
          <option value="asporto">📦 Asporto</option>
          <option value="delivery">🚀 Delivery</option>
        </select>

        <div id="tavolo-fields" style="display: ${tavoloDalQR ? 'block' : 'none'};">
          <label>N° Tavolo <span class="required">*</span></label>
          <input type="text" id="tavolo" value="${tavoloDalQR || ''}" ${tavoloDalQR ? 'readonly' : ''}>
        </div>

        <div id="delivery-fields" style="display:none;">
          <label>Indirizzo di consegna <span class="required">*</span></label>
          <input type="text" id="indirizzo" placeholder="Via Roma 123">
        </div>

        <label>Telefono <span class="required">*</span></label>
        <input type="tel" id="telefono" placeholder="333 1234567" required>

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

    // Gestione campi dinamici
    const tipoSelect = modal.querySelector("#tipo-ordine");
    tipoSelect.addEventListener("change", () => {
        document.getElementById("tavolo-fields").style.display = tipoSelect.value === "tavolo" ? "block" : "none";
        document.getElementById("delivery-fields").style.display = tipoSelect.value === "delivery" ? "block" : "none";
    });

    modal.querySelector("#modal-cancel").onclick = () => modal.remove();
    modal.querySelector("#modal-confirm").onclick = () => inviaOrdine(modal, ristorante);
}

async function inviaOrdine(modal, ristorante) {
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
        const tavolo = modal.querySelector("#tavolo")?.value.trim() || null;
        const indirizzo = modal.querySelector("#indirizzo")?.value.trim() || null;

        if (!nome || !telefono) throw new Error("Nome e telefono sono obbligatori");
        if (tipo === "tavolo" && !tavolo) throw new Error("Inserisci il numero del tavolo");
        if (tipo === "delivery" && !indirizzo) throw new Error("Inserisci l'indirizzo");

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

        // Inserimento prodotti
        const prodottiPayload = cart.map(item => ({
            ordine_id: nuovoOrdine.id,
            prodotto_id: item.id,
            quantita: item.quantita,
            nome_prodotto: item.nome,
            prezzo: item.prezzo,
            modifiche: item.modifiche || null
        }));

        await supabaseClient.from("ordine_prodotti").insert(prodottiPayload);

        saveCart([]);
        modal.remove();
        showToast("✅ Ordine inviato con successo!", "success");
        window.dispatchEvent(new Event("menuRendered"));

    } catch (err) {
        console.error(err);
        showToast(err.message, "error");
    } finally {
        confirmBtn.disabled = false;
        confirmBtn.textContent = "✅ Invia Ordine";
    }
}

// Inizializzazione
window.addEventListener("menuRendered", () => {
    const btn = document.getElementById("send-order");
    if (btn) {
        btn.onclick = () => {
            if (getCartItems().length === 0) {
                showToast("Il carrello è vuoto!", "error");
                return;
            }
            showOrderModal();
        };
    }
});
