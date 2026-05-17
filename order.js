// order.js - Gestione Checkout Cliente, Convalida Coupon e Invio Ordini SaaS
import { supabaseClient } from './supabase.js';
import { getCartItems } from './cart.js';

const COPERTO_AMOUNT = 1.50; 
let scontoAttivo = { codice: null, valore: 0, tipo: "percentuale" };

export function showOrderModal() {
    const ristorante = JSON.parse(sessionStorage.getItem("zf_current_ristorante"));
    if (!ristorante) return alert("Errore SaaS: Locale non identificato.");

    const urlParams = new URLSearchParams(window.location.search);
    const tavoloDalQR = urlParams.get('tavolo');

    const savedNome = localStorage.getItem("zf_cliente_nome") || "";
    const savedTelefono = localStorage.getItem("zf_cliente_telefono") || "";
    const savedIndirizzo = localStorage.getItem("zf_cliente_indirizzo") || "";

    scontoAttivo = { codice: null, valore: 0, tipo: "percentuale" };

    const modalHTML = `
    <div id="order-modal" class="modal">
      <div class="modal-content">
        <h2>Completa il tuo Ordine</h2>
        
        <label>Il tuo Nome</label>
        <input type="text" id="cliente-nome" placeholder="es: Mario Rossi" value="${savedNome}">

        <label>Tipo di Ordine</label>
        <select id="tipo-ordine" ${tavoloDalQR ? 'disabled' : ''}>
          <option value="tavolo" ${tavoloDalQR ? 'selected' : ''}>🪑 Al Tavolo</option>
          <option value="asporto" ${!tavoloDalQR ? 'selected' : ''}>📦 Asporto (Subito)</option>
          <option value="delivery">🚀 Delivery (A Domicilio)</option>
        </select>

        <div id="tavolo-fields" style="display: ${tavoloDalQR ? 'block' : 'none'};">
          <label>N° Tavolo</label>
          <input type="text" id="tavolo" value="${tavoloDalQR || ''}" ${tavoloDalQR ? 'readonly' : ''}>
          <label>N° Persone</label>
          <input type="number" id="num-persone" value="2" min="1">
          <div class="coperto-box">Coperto di Sala: <strong id="coperto-amount">€ 0.00</strong></div>
        </div>

        <div id="delivery-fields" style="display:none;">
          <label>Indirizzo di consegna</label>
          <input type="text" id="indirizzo" placeholder="Via Roma 14" value="${savedIndirizzo}">
        </div>

        <div id="telefono-field">
          <label>Telefono</label>
          <input type="tel" id="telefono" placeholder="333 1234567" value="${savedTelefono}">
        </div>

        <label>Metodo di Pagamento</label>
        <select id="metodo-pagamento">
          <option value="contanti">💵 Contanti alla Consegna / Cassa</option>
          <option value="carta">💳 Carta di Credito / Bancomat</option>
        </select>

        <div class="promo-section">
          <label>Codice Promozionale</label>
          <div style="display: flex; gap: 8px;">
            <input type="text" id="promo-code" placeholder="es: BENVENUTO10" style="text-transform: uppercase; flex: 1; margin:0;">
            <button type="button" id="btn-apply-promo" style="background:#2ec4b6; border:none; padding:10px; border-radius:8px; cursor:pointer; color:black; font-weight:bold;">Applica</button>
          </div>
          <div id="promo-message" style="margin-top: 5px; font-size: 14px; font-weight: bold;"></div>
        </div>

        <label style="margin-top:15px;">Note ed Allergie</label>
        <textarea id="note" rows="2"></textarea>

        <div class="modal-buttons">
          <button id="modal-cancel">Annulla</button>
          <button id="modal-confirm">✅ Invia Ordine</button>
        </div>
      </div>
    </div>`;

    document.body.insertAdjacentHTML('beforeend', modalHTML);
    const modal = document.getElementById("order-modal");
    const tipoSelect = document.getElementById("tipo-ordine");
    const numPersoneInput = document.getElementById("num-persone");

    function ricalcolaCopertoVisivo() {
        const persone = parseInt(numPersoneInput.value) || 0;
        document.getElementById("coperto-amount").textContent = `€ ${(persone * COPERTO_AMOUNT).toFixed(2)}`;
    }

    if (tipoSelect.value === "tavolo") {
        document.getElementById("tavolo-fields").style.display = "block";
        ricalcolaCopertoVisivo();
    }

    numPersoneInput.addEventListener("input", ricalcolaCopertoVisivo);
    tipoSelect.addEventListener("change", () => {
        const t = tipoSelect.value;
        document.getElementById("tavolo-fields").style.display = t === "tavolo" ? "block" : "none";
        document.getElementById("delivery-fields").style.display = t === "delivery" ? "block" : "none";
    });

    document.getElementById("btn-apply-promo").onclick = async () => {
        const codiceInviato = document.getElementById("promo-code").value.trim().toUpperCase();
        const msgDiv = document.getElementById("promo-message");
        if (!codiceInviato) return;

        try {
            const { data: promo, error } = await supabaseClient
                .from("promozioni")
                .select("*")
                .eq("ristorante_id", ristorante.id)
                .eq("codice", codiceInviato)
                .eq("attiva", true)
                .lte("valida_da", new Date().toISOString())
                .single();

            if (error || !promo || (promo.valida_fino && new Date(promo.valida_fino) < new Date())) {
                msgDiv.style.color = "#e63946"; msgDiv.textContent = "❌ Scaduto o non valido.";
                scontoAttivo = { codice: null, valore: 0, tipo: "percentuale" }; return;
            }
            scontoAttivo = { codice: promo.codice, valore: parseFloat(promo.valore), tipo: promo.tipo };
            msgDiv.style.color = "#2ec4b6";
            msgDiv.textContent = `✅ Attivo: -${promo.tipo === 'percentuale' ? promo.valore + '%' : '€ ' + promo.valore.toFixed(2)}`;
        } catch (err) { console.error(err); }
    };

    document.getElementById("modal-cancel").onclick = () => modal.remove();
    document.getElementById("modal-confirm").onclick = () => inviaOrdineA_Supabase(modal, ristorante);
}

async function inviaOrdineA_Supabase(modal, ristorante) {
    const confirmBtn = document.getElementById("modal-confirm");
    const nomeCliente = document.getElementById("cliente-nome").value.trim();
    const tipo = document.getElementById("tipo-ordine").value;
    const telefono = document.getElementById("telefono").value.trim();
    const note = document.getElementById("note").value.trim();
    const tavolo = document.getElementById("tavolo").value.trim();
    const numPersone = parseInt(document.getElementById("num-persone").value) || 0;
    const indirizzo = document.getElementById("indirizzo").value.trim();
    const metodoPagamento = document.getElementById("metodo-pagamento").value;

    if (!nomeCliente) return alert("Inserisci il tuo nome.");
    if (!telefono) return alert("Inserisci il telefono.");
    if (tipo === "tavolo" && !tavolo) return alert("Inserisci il tavolo.");
    if (tipo === "delivery" && !indirizzo) return alert("Inserisci l'indirizzo.");

    localStorage.setItem("zf_cliente_nome", nomeCliente);
    localStorage.setItem("zf_cliente_telefono", telefono);
    if (tipo === "delivery") localStorage.setItem("zf_cliente_indirizzo", indirizzo);

    confirmBtn.disabled = true;
    confirmBtn.textContent = "Invio...";

    try {
        const localCart = getCartItems();
        let subtotale = localCart.reduce((sum, p) => sum + p.prezzo * p.quantita, 0);
        let valoreSconto = 0;

        if (scontoAttivo.codice) {
            valoreSconto = scontoAttivo.tipo === "percentuale" ? (subtotale * (scontoAttivo.valore / 100)) : scontoAttivo.valore;
            subtotale = Math.max(0, subtotale - valoreSconto);
        }

        let copertoTotale = 0;
        if (tipo === "tavolo") { 
            copertoTotale = numPersone * COPERTO_AMOUNT; 
            subtotale += copertoTotale; 
        }

        const ordinePayload = {
            ristorante_id: ristorante.id, 
            totale: parseFloat(subtotale.toFixed(2)), 
            stato: "ricevuto", 
            tipo_ordine: tipo,
            tavolo: tipo === "tavolo" ? tavolo : null, 
            num_persone: tipo === "tavolo" ? numPersone : null,
            indirizzo: tipo === "delivery" ? indirizzo : null, 
            telefono: telefono, 
            note: note || null, 
            nome_cliente: nomeCliente,
            codice_promo: scontoAttivo.codice, 
            sconto_applicato: parseFloat(valoreSconto.toFixed(2)),
            metodo_pagamento: metodoPagamento
        };

        const { data: nuovoOrdine, error: oError } = await supabaseClient
            .from("ordini")
            .insert([ordinePayload])
            .select()
            .single();

        if (oError) throw oError;

        const prodottiPayload = localCart.map(p => ({
            ordine_id: nuovoOrdine.id,
            prodotto_id: p.id,
            quantita: p.quantita,
            nome_prodotto: p.nome,
            prezzo: p.prezzo,
            modifiche: p.modifiche || null
        }));

        const { error: pError } = await supabaseClient.from("ordine_prodotti").insert(prodottiPayload);
        if (pError) throw pError;

        // === MESSAGGIO WHATSAPP UNIFICATO ED COMPLETO ===
        let msg = `🍔 *Nuovo Ordine inviato a ${ristorante.nome}* %0A`;
        msg += `👤 *Cliente:* ${nomeCliente}%0A`;
        msg += `📦 *Modalità:* ${tipo.toUpperCase()}%0A`;
        msg += `💳 *Pagamento:* ${metodoPagamento.toUpperCase()}%0A`;
        if (tipo === "tavolo") msg += `🪑 *Tavolo:* ${tavolo} (${numPersone} Persone)%0A`;
        if (tipo === "delivery") msg += `📍 *Indirizzo:* ${indirizzo}%0A`;
        if (note) msg += `📝 *Note:* ${note}%0A`;
        
        msg += `%0A*--- PRODOTTI ---*%0A`;
        localCart.forEach(p => {
            msg += `• *${p.nome}* x ${p.quantita} (€ ${(p.prezzo * p.quantita).toFixed(2)})%0A`;
            if (p.modifiche) msg += `  └ _Modifiche: ${p.modifiche}_%0A`;
        });
        
        if (copertoTotale > 0) msg += `• _Coperto Sala (${numPersone}x)_ = € ${copertoTotale.toFixed(2)}%0A`;
        if (valoreSconto > 0) msg += `🎁 *Sconto (${scontoAttivo.codice}):* - € ${valoreSconto.toFixed(2)}%0A`;
        msg += `%0A*TOTALE DA CORRISPONDERE: € ${subtotale.toFixed(2)}*%0A%0A`;
        
        // ISTRUZIONI DI RIORDINO AUTOMATIZZATO
        msg += `🔄 *Modo più semplice e veloce per ordinare di nuovo:*%0A`;
        msg += `Dopo aver salvato questo numero in rubrica:%0A`;
        msg += `1. Apri *WhatsApp*%0A`;
        msg += `2. Cerca il contatto del locale%0A`;
        msg += `3. Scrivi *menu* in questa chat%0A`;
        msg += `4. Il locale ti risponde in automatico con il link%0A%0A`;
        msg += `🔗 *Link diretto al menu:*%0A`;
        msg += `https://zerofila.it{ristorante.slug}`;

        const waNumber = ristorante.telefono || "393896190004";
        window.open(`https://wa.me{waNumber.replace(/\s+/g, '')}?text=${msg}`, "_blank");

        // Pulisce il carrello locale e chiude il modulo
        localStorage.removeItem(`zf_cart_${ristorante.id}`);
        modal.remove();
        window.dispatchEvent(new Event("menuRendered"));

    } catch (err) {
        console.error("Errore nell'invio:", err);
        alert("Errore nell'invio dell'ordine. Riprova.");
        confirmBtn.disabled = false;
        confirmBtn.textContent = "✅ Invia Ordine";
    }
}

// AGGANCIO EVENTI SUL PULSANTE DI CHECKOUT PRINCIPALE DELLA PAGINA CLIENTE
window.addEventListener("DOMContentLoaded", () => {
    const sendOrderBtn = document.getElementById("send-order");
    if (sendOrderBtn) {
        sendOrderBtn.addEventListener("click", () => {
            const currentCart = getCartItems();
            if (currentCart.length === 0) return alert("Carrello vuoto!");
            showOrderModal();
        });
    }
});
