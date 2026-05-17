// kitchen.js - Logica Dashboard Cucina Realtime & Sistema Stampa Hardware Pro
import { supabaseClient } from './supabase.js';

const kitchenContainer = document.getElementById("kitchen-orders");
const enableAudioBtn = document.getElementById("enable-audio");

let lastOrderCount = 0;
let currentRistorante = null;
let pollingInterval = null;
let isPollingActive = false;
let isRealtimeActive = false;

// ==================== CONFIGURAZIONE AUDIO BLINDATA ====================
const sounds = {
    default: "https://google.com",
    bell: "https://mixkit.co",
    chime: "https://mixkit.co"
};
let currentSoundKey = "default";

const audioPlayer = document.getElementById("new-order-sound") || new Audio();
audioPlayer.src = sounds[currentSoundKey];
audioPlayer.volume = 1.0;
audioPlayer.preload = "auto";

let lastSoundPlayedTime = 0;
const SOUND_COOLDOWN_MS = 4000; // Protezione: massimo un segnale acustico ogni 4 secondi

function playOrderSound() {
    const now = Date.now();
    if (now - lastSoundPlayedTime < SOUND_COOLDOWN_MS) {
        console.log("Suono saltato per evitare accavallamenti molesti in cucina.");
        return;
    }

    audioPlayer.pause();
    audioPlayer.currentTime = 0;

    audioPlayer.play()
        .then(() => { lastSoundPlayedTime = now; })
        .catch((err) => { console.warn("Audio inibito dal browser. Premere 'Attiva Audio'.", err); });
}

if (enableAudioBtn) {
    enableAudioBtn.addEventListener("click", () => {
        const keys = Object.keys(sounds);
        const currentIndex = keys.indexOf(currentSoundKey);
        currentSoundKey = keys[(currentIndex + 1) % keys.length];

        audioPlayer.src = sounds[currentSoundKey];
        audioPlayer.load();

        enableAudioBtn.textContent = `🔊 SUONO: ${currentSoundKey.toUpperCase()}`;
        enableAudioBtn.style.backgroundColor = "#2ec4b6";
        audioPlayer.play().catch(() => {});
    });
}

// ==================== GENERATORE BUFFER STAMPA TERMICA ESC/POS (80mm) ====================
export function generaBufferStampaTermica(ordine) {
    const CH_TAGLIO_CARTA = "\x1d\x56\x41\x03"; // Comando ghigliottina standard
    const CH_CENTNATO = "\x1b\x61\x01";
    const CH_SINISTRA = "\x1b\x61\x00";
    const CH_GRASSETTO_ON = "\x1b\x45\x01";
    const CH_GRASSETTO_OFF = "\x1b\x45\x00";
    const CH_DOPPIA_ALTEZZA = "\x1b\x21\x10";
    const CH_FONT_NORMALE = "\x1b\x21\x00";
    
    let ticket = "";
    
    ticket += `${CH_CENTNATO}${CH_GRASSETTO_ON}ZEROFILA RESOCONTO CUCINA${CH_GRASSETTO_OFF}\n`;
    ticket += `--------------------------------\n`;
    ticket += `${CH_DOPPIA_ALTEZZA}ORDINE #${ordine.id.toString().slice(-4)}\n${CH_FONT_NORMALE}`;
    ticket += `Servizio: ${ordine.tipo_ordine.toUpperCase()}\n`;
    
    const oraOrdine = new Date(ordine.created_at).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
    ticket += `Arrivo: ${oraOrdine} | ⚠️ CODA: ASAP / SUBITO\n`;
    ticket += `--------------------------------\n${CH_SINISTRA}`;

    if (ordine.tipo_ordine === "tavolo") {
        ticket += `${CH_GRASSETTO_ON}🪑 TAVOLO: ${ordine.tavolo} (${ordine.num_persone} Persone)${CH_GRASSETTO_OFF}\n`;
    }
    ticket += `Cliente: ${ordine.nome_cliente || "Anonimo"}\n`;
    if (ordine.telefono) ticket += `Tel: ${ordine.telefono}\n`;
    if (ordine.indirizzo) ticket += `Indirizzo: ${ordine.indirizzo}\n`;
    ticket += `--------------------------------\n`;

    ticket += `${CH_GRASSETTO_ON}QTA  PRODOTTO${CH_GRASSETTO_OFF}\n`;
    if (ordine.ordine_prodotti) {
        ordine.ordine_prodotti.forEach(p => {
            const qtaString = `${p.quantita}x`.padEnd(5, " ");
            ticket += `${qtaString}${p.nome_prodotto}\n`;
            if (p.modifiche) {
                ticket += `     ${CH_GRASSETTO_ON}>> VARIANTI: ${p.modifiche}${CH_GRASSETTO_OFF}\n`;
            }
        });
    }
    ticket += `--------------------------------\n`;
    
    if (ordine.note) {
        ticket += `${CH_GRASSETTO_ON}NOTE DI SALA:${CH_GRASSETTO_OFF} ${ordine.note}\n`;
        ticket += `--------------------------------\n`;
    }

    const modalitaPagamento = ordine.metodo_pagamento === "carta" ? "💳 CARTA / BANCOMAT" : "💵 CONTANTI ALLA CASSA";
    ticket += `PAGAMENTO: ${CH_GRASSETTO_ON}${modalitaPagamento}${CH_GRASSETTO_OFF}\n`;
    
    if (ordine.sconto_applicato > 0) {
        ticket += `Sconto (${ordine.codice_promo}): - EUR ${ordine.sconto_applicato.toFixed(2)}\n`;
    }
    
    ticket += `${CH_CENTNATO}${CH_GRASSETTO_ON}${CH_DOPPIA_ALTEZZA}TOTALE: EUR ${ordine.totale.toFixed(2)}${CH_FONT_NORMALE}${CH_GRASSETTO_OFF}\n\n\n\n`;
    ticket += CH_TAGLIO_CARTA;

    return ticket;
}

// ==================== DISPATCHER HARDWARE DI STAMPA PRO ====================
function eseguiStampaHardwarePro(ordine) {
    const bufferTesto = generaBufferStampaTermica(ordine);

    // MAPPATURA HARDWARE MULTIPLA PRO A PROVA DI BOMBA
    if (currentRistorante.stampante_ip) {
        // Opzione A: PC di cassa con print_server.py locale attivo
        fetch("http://localhost:8080/print", {
            method: "POST",
            headers: { "Content-Type": "text/plain; charset=utf-8" },
            body: bufferTesto
        }).catch(err => console.error("Server di stampa PC offline.", err));
    } else {
        // Opzione B: Solo Tablet Android/iPad (Reindirizzamento verso l'applicazione locale RawBT)
        const rawBtUrl = `intent:#Intent;scheme=rawbt;package=ru.a402d.rawbtprinter;S.text=${encodeURIComponent(bufferTesto)};end`;
        const linkInvisibile = document.createElement("a");
        linkInvisibile.href = rawBtUrl;
        linkInvisibile.click();
    }
}

// ==================== NOTIFICA WHATSAPP CLIENTE AUTOMATICA ====================
function inviaNotificaWhatsAppCliente(ordine, whatsappWindow) {
    if (!ordine.telefono) { if (whatsappWindow) whatsappWindow.close(); return; }

    let messaggio = "";
    const codiceOrdine = ordine.id.toString().slice(0, 6);

    if (ordine.tipo_ordine === "asporto" && ordine.stato === "preparazione") {
        messaggio = `👨‍🍳 *Ciao ${ordine.nome_cliente || ""}, la cucina ha preso in carico il tuo asporto!*%0A%0A`;
        messaggio += `📦 *Ordine:* #${codiceOrdine}%0A`;
        messaggio += `⏳ Piatti in lavorazione. Ti aspettiamo tra pochissimo per il ritiro!%0A%0A`;
        messaggio += `Grazie da *${currentRistorante.nome || "ZeroFila"}* 🍔`;
    } 
    else if (ordine.tipo_ordine === "delivery" && ordine.stato === "pronto") {
        messaggio = `🚀 *Ciao ${ordine.nome_cliente || ""}, il tuo ordine è pronto!*%0A%0A`;
        messaggio += `📦 *Ordine:* #${codiceOrdine}%0A`;
        messaggio += `📍 Affidato al fattorino e in viaggio verso: _${ordine.indirizzo || ""}_%0A%0A`;
        messaggio += `Buon appetito da *${currentRistorante.nome || "ZeroFila"}* 🍔`;
    }

    if (messaggio && whatsappWindow) {
        const numeroPulito = ordine.telefono.replace(/\s+/g, '');
        const telefonoFinale = numeroPulito.startsWith("+") || numeroPulito.startsWith("39") ? numeroPulito : `39${numeroPulito}`;
        whatsappWindow.location.href = `https://wa.me{telefonoFinale}?text=${messaggio}`;
    } else if (whatsappWindow) {
        whatsappWindow.close();
    }
}

// ==================== AGGIORNAMENTO STATO E TRANSAZIONE REGISTRO ====================
window.updateOrderStatus = async function(ordineId, nuovoStato, selectElement) {
    if (!supabaseClient) return;
    
    let whatsappWindow = null;
    const currentCard = selectElement.closest(".ordine-card");
    
    if (currentCard) {
        const statoPrecedente = currentCard.dataset.stato;
        if ((statoPrecedente === "ricevuto" && nuovoStato === "preparazione") || 
            (statoPrecedente === "preparazione" && nuovoStato === "pronto")) {
            // Sblocco Pop-up: creiamo la finestra un millisecondo esatto prima dell'operazione asincrona
            whatsappWindow = window.open("", "_blank");
        }
        currentCard.style.opacity = "0.5";
        currentCard.style.pointerEvents = "none";
    }
    selectElement.disabled = true;

    const updateData = { stato: nuovoStato };
    const ISO_NOW = new Date().toISOString();
    if (nuovoStato === "preparazione") updateData.accettato_at = ISO_NOW;
    if (nuovoStato === "pronto") updateData.pronto_at = ISO_NOW;

    try {
        // 1. Recupero dati comprensivo delle relazioni interne dei piatti ordinati
        const { data: ordineCorrente, error: fetchError } = await supabaseClient
            .from("ordini")
            .select("*, ordine_prodotti(*)")
            .eq("id", ordineId)
            .single();

        if (fetchError) throw fetchError;

        // 2. Scrittura del nuovo stato logistico
        const { error: updateError } = await supabaseClient
            .from("ordini")
            .update(updateData)
            .eq("id", ordineId);

        if (updateError) throw updateError;

        // === CONTROLLO RESTRITTIVO LICENZA PRO DI SUPERADMIN ===
        if (nuovoStato === "preparazione" && currentRistorante.piano === "pro" && currentRistorante.licenza_attiva === true) {
            eseguiStampaHardwarePro(ordineCorrente);
        }

        const ordineAggiornato = { ...ordineCorrente, stato: nuovoStato };
        inviaNotificaWhatsAppCliente(ordineAggiornato, whatsappWindow);

        await loadOrders(); 
    } catch (err) {
        console.error(err);
        if (whatsappWindow) whatsappWindow.close();
        alert("Errore cambio stato comanda.");
        if (currentCard) { currentCard.style.opacity = "1"; currentCard.style.pointerEvents = "auto"; }
        selectElement.disabled = false;
    }
};

// ==================== MONITORAGGIO RETE E GENERAZIONE INDICATORI ====================
function createStatusIndicator() {
    let indicator = document.getElementById("connection-status");
    if (!indicator) {
        indicator = document.createElement("div");
        indicator.id = "connection-status";
        indicator.innerHTML = `<span class="status-dot green"></span><span id="status-text">Realtime attivo</span>`;
        const header = document.querySelector("header");
        if (header) header.appendChild(indicator);
    }
}

function updateConnectionStatus(isRealtime) {
    const indicator = document.getElementById("connection-status");
    if (!indicator) return;
    const dot = indicator.querySelector(".status-dot");
    const text = document.getElementById("status-text");
    dot.className = isRealtime ? "status-dot green" : "status-dot orange";
    text.textContent = isRealtime ? "Realtime attivo" : "Polling attivo (Fallback)";
}

function getRistoranteSlug() {
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('r')) return urlParams.get('r');
    const path = window.location.pathname;
    const parts = path.split('/').filter(p => p);
    return parts[0] || null; 
}

// ==================== CARICAMENTO DATI CON ISOLAMENTO SAAS ====================
async function loadOrders() {
    if (!supabaseClient || !currentRistorante) return;
    try {
        const { data: ordini, error } = await supabaseClient
            .from("ordini")
            .select("*, ordine_prodotti(nome_prodotto, quantita, modifiche)")
            .eq("ristorante_id", currentRistorante.id)
            .order("created_at", { ascending: false });

        if (error) throw error;
        if (ordini.length > lastOrderCount && lastOrderCount !== 0) playOrderSound();
        lastOrderCount = ordini.length;
        renderOrders(ordini);
    } catch (err) { console.error("Errore sincro:", err); }
}

function renderOrders(ordini) {
    if (!kitchenContainer) return;
    kitchenContainer.innerHTML = "";
    
    const ric = ordini.filter(o => o.stato === "ricevuto");
    const prep = ordini.filter(o => o.stato === "preparazione");
    const pro = ordini.filter(o => o.stato === "pronto");
    const con = ordini.filter(o => o.stato === "consegnato");

    renderSection("🟡 Ricevuti", ric);
    renderSection("🟠 In Cucina", prep);
    renderSection("🟢 Pronti", pro);
    renderSection("⚫ Consegnati", con);
}

function renderSection(titolo, listaOrdini) {
    const sezioneContainer = document.createElement("div");
    sezioneContainer.className = "kitchen-section";
    let cardsHTML = listaOrdini.length === 0 ? "<p class='empty-orders'>Nessuna comanda</p>" : "";

    listaOrdini.forEach(o => {
        let listHTML = "";
        if (o.ordine_prodotti) {
            o.ordine_prodotti.forEach(p => {
                listHTML += `<li><strong>${p.quantita}x</strong> ${p.nome_prodotto}${p.modifiche ? `<br><span class="item-modifica">⚠️ Varianti: ${p.modifiche}</span>` : ''}</li>`;
            });
        }

        let timeHTML = "";
        const f = (iso) => new Date(iso).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
        if (o.stato === "ricevuto") timeHTML = `Arrivato: ${f(o.created_at)}`;
        else if (o.stato === "preparazione" && o.accettato_at) timeHTML = `In forno da: ${f(o.accettato_at)}`;
        else if (o.stato === "pronto" && o.pronto_at) timeHTML = `Pronto da: ${f(o.pronto_at)}`;

        const badge = { tavolo: "🪑 Tav. " + (o.tavolo || ""), asporto: "📦 Asporto", delivery: "🚀 Delivery" }[o.tipo_ordine] || "";

        cardsHTML += `
            <div class="ordine-card stato-${o.stato}" data-stato="${o.stato}">
                <div class="card-top"><h2>#${o.id.toString().slice(-4)}</h2><span class="badge-tipo">${badge}</span></div>
                <div class="ordine-status">
                    <p class="time-log"><strong>${timeHTML}</strong></p>
                    <p class="cliente-info">Anagrafica: <strong>${o.nome_cliente || "Anonimo"}</strong></p>
                    <select onchange="window.updateOrderStatus('${o.id}', this.value, this)">
                        <option value="ricevuto" ${o.stato === "ricevuto" ? "selected" : ""}>Ricevuto</option>
                        <option value="preparazione" ${o.stato === "preparazione" ? "selected" : ""}>Preparazione</option>
                        <option value="pronto" ${o.stato === "pronto" ? "selected" : ""}>Pronto</option>
                        <option value="consegnato" ${o.stato === "consegnato" ? "selected" : ""}>Consegnato</option>
                    </select>
                </div>
                <ul>${listHTML}</ul>
                ${o.note ? `<p class="card-note">📝 Note: ${o.note}</p>` : ''}
                <p class="totale-ordine">Tot: € ${o.totale.toFixed(2)} (${o.metodo_pagamento.toUpperCase()})</p>
            </div>`;
    });

    sezioneContainer.innerHTML = `<h1 class="section-title">${titolo}</h1><div class="orders-grid">${cardsHTML}</div>`;
    kitchenContainer.appendChild(sezioneContainer);
}

// ==================== TIMERS POLLING FALLBACK ====================
function startPolling() { if (isPollingActive) return; isPollingActive = true; isRealtimeActive = false; updateConnectionStatus(false); pollingInterval = setInterval(loadOrders, 8000); }
function stopPolling() { if (pollingInterval) { clearInterval(pollingInterval); pollingInterval = null; } isPollingActive = false; }

// ==================== INIZIALIZZAZIONE COMPLETA ====================
async function initKitchen() {
    const slug = getRistoranteSlug();
    if (!slug) { kitchenContainer.innerHTML = "<p class='error-msg'>SaaS URL mancante.</p>"; return; }

    try {
        const { data: ristorante, error } = await supabaseClient.from("ristoranti").select("*").eq("slug", slug).single();
        if (error || !ristorante) throw new Error();
        currentRistorante = ristorante;

        const titleEl = document.getElementById("kitchen-title");
        if (titleEl) titleEl.textContent = `🍔 Dashboard Cucina - ${ristorante.nome}`;

        createStatusIndicator();   
        await loadOrders();

        supabaseClient
            .channel("ordini-realtime-cucina-SaaS")
            .on("postgres_changes", { event: "*", schema: "public", table: "ordini", filter: `ristorante_id=eq.${currentRistorante.id}` }, () => loadOrders())
            .subscribe((status) => {
                if (status === 'SUBSCRIBED') { isRealtimeActive = true; stopPolling(); updateConnectionStatus(true); }
                else if (['CHANNEL_ERROR', 'TIMED_OUT', 'CLOSED'].includes(status)) { isRealtimeActive = false; startPolling(); }
            });

        setTimeout(() => { if (!isRealtimeActive && !isPollingActive) startPolling(); }, 12000);
    } catch (err) { kitchenContainer.innerHTML = "<p class='error-msg'>Impossibile identificare il locale.</p>"; }
}

initKitchen();
