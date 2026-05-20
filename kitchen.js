import { supabaseClient } from './supabase.js';
import { getRistoranteSlug, escapeHtml, showToast } from './utils.js';

const kitchenContainer = document.getElementById("kitchen-orders");
const enableAudioBtn = document.getElementById("enable-audio");

let currentRistorante = null;
const audioPlayer = new Audio();
audioPlayer.volume = 0.85;

function playNewOrderSound() {
    audioPlayer.src = "https://mixkit.co";
    audioPlayer.play().catch((e) => console.log("Audio in attesa:", e));
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
            grid.innerHTML = `<p class="no-orders">Nessun ordine</p>`;
        }

        lista.forEach(o => {
            const card = document.createElement("div");
            card.className = `ordine-card`;
            card.innerHTML = `
                <div class="card-header">
                    <h3 style="margin:0;">#${o.id.toString().slice(-4)}</h3>
                    <span class="badge">${o.tipo_ordine}</span>
                </div>
                <p style="margin:4px 0;"><strong>Cliente:</strong> ${escapeHtml(o.nome_cliente || "Anonimo")}</p>
                ${o.tavolo ? `<p style="margin:4px 0;"><strong>🪑 Tavolo:</strong> ${escapeHtml(o.tavolo)}</p>` : ''}
                ${o.indirizzo ? `<p style="margin:4px 0;"><strong>📍 Dom:</strong> ${escapeHtml(o.indirizzo)}</p>` : ''}
                <ul class="prodotti-list">
                    ${(o.ordine_prodotti || []).map(p => `
                        <li>${p.quantita}x <strong>${escapeHtml(p.nome_prodotto)}</strong> ${p.modifiche ? `<br><small style="color:#eab308;">[${escapeHtml(p.modifiche)}]</small>` : ''}</li>
                    `).join('')}
                </ul>
                ${o.note ? `<p style="margin:6px 0; font-size:0.85rem; color:#94a3b8; border-top:1px dashed #334155; padding-top:4px;">📝 <strong>Note:</strong> ${escapeHtml(o.note)}</p>` : ''}
                <select onchange="window.gestisciCambioStatoCucina('${o.id}', this.value, this)" style="width:100%; padding:8px; background:#1e293b; color:#fff; border:1px solid #475569; border-radius:4px;">
                    <option value="ricevuto" ${o.stato === "ricevuto" ? "selected" : ""}>Ricevuto</option>
                    <option value="preparazione" ${o.stato === "preparazione" ? "selected" : ""}>In Preparazione</option>
                    <option value="pronto" ${o.stato === "pronto" ? "selected" : ""}>Pronto</option>
                    <option value="consegnato" ${o.stato === "consegnato" ? "selected" : ""}>Consegnato</option>
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
        
        if (nuovoStato === "preparazione" || nuovoStato === "pronto") {
            const moduloMessaggi = await import(`./messaggi.js`);
            const testoNotifica = moduloMessaggi.componiNotificaStatoWhatsApp(
                ordineAggiornato.nome_cliente,
                ordineAggiornato.tipo_ordine,
                nuovoStato,
                ordineAggiornato.tavolo,
                ordineAggiornato.indirizzo,
                currentRistorante.nome
            );

            const numeroCliente = ordineAggiornato.telefono.toString().replace(/\s+/g, '').replace('+', '');
            const telefonoFinaleCliente = numeroCliente.startsWith("39") ? numeroCliente : "39" + numeroCliente;

            // RIPARAZIONE RIGHE LOGICA REDIRECT NOTIFICHE A COSTO ZERO
            const linkWhatsApp = document.createElement("a");
            linkWhatsApp.href = "whatsapp://send?phone=" + telefonoFinaleCliente + "&text=" + encodeURIComponent(testoNotifica);
            linkWhatsApp.target = "_blank"; // Apre in secondo piano o scheda separata senza distruggere la griglia
            linkWhatsApp.rel = "noopener noreferrer";
            
            document.body.appendChild(linkWhatsApp);
            linkWhatsApp.click();
            document.body.removeChild(linkWhatsApp);
        }

        await loadOrders(false);
    } catch (err) {
        console.error(err);
        selectElement.disabled = false;
        showToast("Errore aggiornamento", "error");
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

        supabaseClient.channel("kitchen-realtime")
            .on("postgres_changes", { event: "INSERT", schema: "public", table: "ordini", filter: "ristorante_id=eq." + risto.id }, () => {
                loadOrders(true);
            })
            .subscribe();

    } catch (err) {
        console.error(err);
    }
}
