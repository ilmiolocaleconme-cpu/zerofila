import { supabaseClient } from './supabase.js';

const kitchenContainer = document.getElementById("kitchen-orders");
const enableAudioBtn = document.getElementById("enable-audio");

let currentRistorante = null;
const audioPlayer = new Audio();
audioPlayer.volume = 0.85;

// Funzione interna per ripulire l'HTML in modo sicuro e senza crash
function escapeHtmlInfallibile(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

// Formatta il prezzo in euro senza dipendere da utils esterni
function formatPriceInfallibile(price) {
    const num = Number(price);
    return isNaN(num) ? "0.00" : num.toFixed(2);
}

function playNewOrderSound() {
    audioPlayer.src = "https://mixkit.co";
    audioPlayer.play().catch((e) => console.log("Audio in attesa di sblocco utente:", e));
}

if (enableAudioBtn) {
    enableAudioBtn.addEventListener("click", () => {
        playNewOrderSound();
        enableAudioBtn.textContent = "✅ AUDIO ATTIVO";
    });
}

function getRistoranteSlug() {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get('r') || "al-panetto";
}

async function loadOrders(triggerSound = false) {
    if (!currentRistorante) return;

    try {
        const { data: ordini, error } = await supabaseClient
            .from("ordini")
            .select("*, ordine_prodotti(*)")
            .eq("ristorante_id", currentRistorante.id)
            .order("created_at", { ascending: false });

        if (error) throw error;

        if (triggerSound) {
            playNewOrderSound();
        }

        renderKitchenOrders(ordini || []);
    } catch (err) {
        console.error("Errore caricamento ordini:", err);
    }
}

function renderKitchenOrders(ordini) {
    if (!kitchenContainer) return;
    kitchenContainer.innerHTML = "";

    const sections = {
        ricevuto: ordini.filter(o => o.stato === "ricevuto"),
        preparazione: ordini.filter(o => o.stato === "preparazione"),
        pronto: ordini.filter(o => o.stato === "pronto"),
        consegnato: ordini.filter(o => o.stato === "consegnato")
    };

    Object.entries(sections).forEach(([stato, lista]) => {
        const section = document.createElement("div");
        section.className = "kitchen-section";
        section.innerHTML = `<h2 class="section-title">${stato.toUpperCase()} (${lista.length})</h2>`;

        const grid = document.createElement("div");
        grid.className = "orders-grid";

        if (lista.length === 0) {
            grid.innerHTML = `<p class="no-orders" style="color:#64748b; font-style:italic; padding:10px;">Nessun ordine</p>`;
        }

        lista.forEach(o => {
            const card = document.createElement("div");
            card.className = `ordine-card`;
            card.style.cssText = "background:#1e293b; padding:15px; border-radius:10px; margin-bottom:12px; border:1px solid #334155; color:white;";
            
            card.innerHTML = `
                <div class="card-header" style="display:flex; justify-content:between; align-items:center; border-bottom:1px solid #334155; padding-bottom:8px; margin-bottom:8px;">
                    <h3 style="margin:0; color:#38bdf8;">#${o.id.toString().slice(-4)}</h3>
                    <span class="badge" style="background:#475569; padding:4px 8px; border-radius:4px; font-size:0.75rem; font-weight:bold; margin-left:auto;">${o.tipo_ordine.toUpperCase()}</span>
                </div>
                <p style="margin:4px 0; font-size:0.9rem;"><strong>Cliente:</strong> ${escapeHtmlInfallibile(o.nome_cliente || "Anonimo")}</p>
                ${o.tavolo ? `<p style="margin:4px 0; font-size:0.9rem;"><strong>🪑 Tavolo:</strong> ${escapeHtmlInfallibile(o.tavolo)}</p>` : ''}
                ${o.indirizzo ? `<p style="margin:4px 0; font-size:0.9rem;"><strong>📍 Indirizzo:</strong> ${escapeHtmlInfallibile(o.indirizzo)}</p>` : ''}
                
                <ul class="prodotti-list" style="margin:10px 0; padding-left:15px; font-size:0.95rem; color:#f1f5f9;">
                    ${(o.ordine_prodotti || []).map(p => `
                        <li style="margin-bottom:6px;">${p.quantita}x <strong>${escapeHtmlInfallibile(p.nome_prodotto)}</strong> - <small>€ ${formatPriceInfallibile(p.prezzo)}</small> ${p.modifiche ? `<br><small style="color:#eab308; font-weight:bold;">↳ [${escapeHtmlInfallibile(p.modifiche)}]</small>` : ''}</li>
                    `).join('')}
                </ul>
                
                ${o.note ? `<p style="margin:6px 0; font-size:0.85rem; color:#94a3b8; border-top:1px solid #334155; padding-top:6px;">📝 <strong>Note:</strong> ${escapeHtmlInfallibile(o.note)}</p>` : ''}
                
                <div style="margin-top:12px; border-top:1px solid #334155; padding-top:8px; display:flex; justify-content:space-between; align-items:center;">
                    <span style="font-weight:bold; color:#10b981;">Tot: € ${formatPriceInfallibile(o.totale)}</span>
                </div>
                
                <select onchange="window.gestisciCambioStatoCucina('${o.id}', this.value, this)" style="width:100%; padding:10px; margin-top:10px; background:#0f172a; color:#fff; border:1px solid #475569; border-radius:6px; font-size:0.9rem; cursor:pointer;">
                    <option value="ricevuto" ${o.stato === "ricevuto" ? "selected" : ""}>Ricevuto</option>
                    <option value="preparazione" ${o.stato === "preparazione" ? "selected" : ""}>In Preparazione</option>
                    <option value="pronto" ${o.stato === "pronto" ? "selected" : ""}>Pronto / Ritiro</option>
                    <option value="consegnato" ${o.stato === "consegnato" ? "selected" : ""}>Consegnato / Chiuso</option>
                </select>
            `;
            grid.appendChild(card);
        });

        section.appendChild(grid);
        kitchenContainer.appendChild(section);
    });
}

window.gestisciCambioStatoCucina = async function(ordineId, nuovoStato, selectElement) {
    try {
        selectElement.disabled = true;

        const { data: ordineAggiornato, error } = await supabaseClient
            .from("ordini")
            .update({ stato: nuovoStato })
            .eq("id", ordineId)
            .select()
            .single();
        
        if (error) throw error;
        
        // --- LOGICA NOTIFICA WHATSAPP CLIENTE AUTOMATICA INTEGRATA ---
        if (nuovoStato === "preparazione" || nuovoStato === "pronto") {
            const nomeInsegna = currentRistorante.nome || "ZeroFila";
            let testoNotifica = `Ciao *${ordineAggiornato.nome_cliente}*, aggiornamento da *${nomeInsegna.toUpperCase()}*! 🍔\n\n`;

            if (nuovoStato === "preparazione") {
                if (ordineAggiornato.tipo_ordine === "tavolo") {
                    testoNotifica += `👨‍🍳 I tuoi piatti sono in preparazione e ti verranno serviti a breve al *Tavolo ${ordineAggiornato.tavolo || ''}*.`;
                } else if (ordineAggiornato.tipo_ordine === "asporto") {
                    testoNotifica += `📦 Stiamo preparando il tuo ordine da asporto! A breve sarà pronto per il ritiro.`;
                } else if (ordineAggiornato.tipo_ordine === "delivery") {
                    testoNotifica += `🚀 I tuoi piatti sono in preparazione! Il rider si sta preparando per la consegna.`;
                }
            } else if (nuovoStato === "pronto") {
                if (ordineAggiornato.tipo_ordine === "tavolo") {
                    testoNotifica += `🟢 I tuoi piatti sono pronti! Il cameriere li sta portando al tuo tavolo. Buon appetito!`;
                } else if (ordineAggiornato.tipo_ordine === "asporto") {
                    testoNotifica += `🟢 *ORDINE PRONTO!* Puoi avvicinarti al banco per il ritiro della tua comanda.`;
                } else if (ordineAggiornato.tipo_ordine === "delivery") {
                    testoNotifica += `🛵 *SIAMO IN CONSEGNA!* Il tuo ordine è partito verso l'indirizzo: _${ordineAggiornato.indirizzo || ''}_.`;
                }
            }
            testoNotifica += `\n\nInviato tramite *ZeroFila* ✨`;

            const numeroCliente = ordineAggiornato.telefono.toString().replace(/\s+/g, '').replace('+', '');
            const telefonoFinaleCliente = numeroCliente.startsWith("39") ? numeroCliente : "39" + numeroCliente;

            // Spinge l'apertura del redirect immediato del browser
            window.location.href = "https://whatsapp.com" + telefonoFinaleCliente + "&text=" + encodeURIComponent(testoNotifica);
        }

        await loadOrders(false);
    } catch (err) {
        console.error("Errore aggiornamento stato:", err);
        selectElement.disabled = false;
    }
};

export async function initKitchen() {
    const slug = getRistoranteSlug();

    try {
        const { data: risto, error } = await supabaseClient
            .from("ristoranti")
            .select("*")
            .eq("slug", slug)
            .single();

        if (error || !risto) throw new Error("Ristorante non trovato");
        currentRistorante = risto;
        
        await loadOrders(false);

        // Ascolto Realtime su canale Postgres per l'ingresso istantaneo delle comande
        supabaseClient.channel("kitchen-realtime")
            .on("postgres_changes", { event: "INSERT", schema: "public", table: "ordini", filter: "ristorante_id=eq." + risto.id }, () => {
                loadOrders(true);
            })
            .subscribe();

    } catch (err) {
        console.error(err);
        if (kitchenContainer) {
            kitchenContainer.innerHTML = `<p style="color:#ef4444; font-weight:bold; padding:20px; text-align:center;">❌ ERRORE: Connessione fallita. Controlla lo slug nell'URL.</p>`;
        }
    }
}
