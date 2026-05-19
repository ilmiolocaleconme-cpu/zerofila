import { supabaseClient } from './supabase.js';
import { getRistoranteSlug, escapeHtml, showToast } from './utils.js';

const kitchenContainer = document.getElementById("kitchen-orders");
const enableAudioBtn = document.getElementById("enable-audio");

let currentRistorante = null;
let lastOrderCount = 0;

const audioPlayer = new Audio();
audioPlayer.volume = 0.85;

function playNewOrderSound() {
    // URL diretto al file audio reale per attivare la notifica sonora
    audioPlayer.src = "https://mixkit.co";
    audioPlayer.play().catch((e) => console.log("Riproduzione audio bloccata dai permessi del browser:", e));
}

if (enableAudioBtn) {
    enableAudioBtn.addEventListener("click", () => {
        playNewOrderSound();
        showToast("🔊 Audio cucina attivato correttamente!");
    });
}

async function loadOrders() {
    if (!currentRistorante) return;

    try {
        const { data: ordini, error } = await supabaseClient
            .from("ordini")
            .select("*, ordine_prodotti(*)")
            .eq("ristorante_id", currentRistorante.id)
            .order("created_at", { ascending: false });

        if (error) throw error;

        // Se arrivano nuove comande rispetto all'ultimo controllo, suona il Bip
        if (ordini && ordini.length > lastOrderCount && lastOrderCount > 0) {
            playNewOrderSound();
        }

        lastOrderCount = ordini ? ordini.length : 0;
        renderKitchenOrders(ordini || []);
    } catch (err) {
        console.error("Errore caricamento ordini cucina:", err);
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

    // Genera visivamente le 4 colonne a schermo
    Object.entries(sections).forEach(([stato, lista]) => {
        const section = document.createElement("div");
        section.className = "kitchen-section";
        section.innerHTML = `<h2 class="section-title">${stato.toUpperCase()} (${lista.length})</h2>`;

        const grid = document.createElement("div");
        grid.className = "orders-grid";

        if (lista.length === 0) {
            grid.innerHTML = `<p class="no-orders" style="color:var(--text-muted); font-size:0.85rem; padding:10px;">Nessun ordine</p>`;
        }

        lista.forEach(o => {
            const card = document.createElement("div");
            card.className = `ordine-card stato-${o.stato}`;
            card.innerHTML = `
                <div class="card-header" style="display:flex; justify-content:between; align-items:center; border-bottom:1px solid #334155; padding-bottom:8px; margin-bottom:8px;">
                    <h3 style="margin:0; font-size:1.1rem;">#${o.id.toString().slice(-4)}</h3>
                    <span class="badge" style="background:#334155; padding:2px 8px; border-radius:4px; font-size:0.75rem; text-transform:uppercase;">${o.tipo_ordine}</span>
                </div>
                <p style="margin:4px 0; font-size:0.9rem;"><strong>Cliente:</strong> ${escapeHtml(o.nome_cliente || "Anonimo")}</p>
                ${o.tavolo ? `<p style="margin:4px 0; font-size:0.9rem;"><strong>🪑 Tavolo:</strong> ${escapeHtml(o.tavolo)}</p>` : ''}
                ${o.indirizzo ? `<p style="margin:4px 0; font-size:0.9rem;"><strong>📍 Dom:</strong> ${escapeHtml(o.indirizzo)}</p>` : ''}
                <ul class="prodotti-list" style="margin:10px 0; padding-left:15px; font-size:0.95rem; color:#f1f5f9;">
                    ${(o.ordine_prodotti || []).map(p => `
                        <li>${p.quantita}x <strong>${escapeHtml(p.nome_prodotto)}</strong></li>
                    `).join('')}
                </ul>
                <select onchange="window.updateOrderStatus('${o.id}', this.value)" style="width:100%; padding:6px; background:#0f172a; color:#fff; border:1px solid #334155; border-radius:4px;">
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

window.updateOrderStatus = async function(ordineId, nuovoStato) {
    try {
        const { error } = await supabaseClient
            .from("ordini")
            .update({ stato: nuovoStato })
            .eq("id", ordineId);
        
        if (error) throw error;
        loadOrders();
        showToast("Stato ordine aggiornato!");
    } catch (err) {
        console.error(err);
        showToast("Errore aggiornamento stato", "error");
    }
};

export async function initKitchen() {
    const slug = getRistoranteSlug() || "al-panetto";

    try {
        const { data: ristorante, error: restError } = await supabaseClient
            .from("ristoranti")
            .select("*")
            .eq("slug", slug)
            .single();

        if (restError || !ristorante) throw new Error("Locale non agganciato.");
        
        currentRistorante = ristorante;
        await loadOrders();

        // Attivazione canale Realtime ufficiale per i cuochi
        supabaseClient.channel("kitchen-realtime")
            .on("postgres_changes", {
                event: "*",
                schema: "public",
                table: "ordini",
                filter: `ristorante_id=eq.${ristorante.id}`
            }, () => {
                loadOrders();
            })
            .subscribe();

    } catch (err) {
        console.error(err);
        if (kitchenContainer) kitchenContainer.innerHTML = `<p style="color:#ef4444; padding:20px;">❌ Errore Connessione: ${err.message}</p>`;
    }
}

// Inizializzazione automatica
initKitchen();
