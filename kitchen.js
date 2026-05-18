import { supabaseClient } from './supabase.js';
import { getRistoranteSlug, escapeHtml, showToast } from './utils.js';

const kitchenContainer = document.getElementById("kitchen-orders");
const enableAudioBtn = document.getElementById("enable-audio");

let currentRistorante = null;
let lastOrderCount = 0;

const audioPlayer = new Audio();
audioPlayer.volume = 0.85;

function playNewOrderSound() {
    audioPlayer.src = "https://mixkit.co";
    audioPlayer.play().catch(() => {});
}

if (enableAudioBtn) {
    enableAudioBtn.addEventListener("click", () => {
        playNewOrderSound();
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

    Object.entries(sections).forEach(([stato, lista]) => {
        if (lista.length === 0) return;

        const section = document.createElement("div");
        section.className = "kitchen-section";
        section.innerHTML = `<h2 class="section-title">${stato.toUpperCase()} (${lista.length})</h2>`;

        const grid = document.createElement("div");
        grid.className = "orders-grid";

        lista.forEach(o => {
            const card = document.createElement("div");
            card.className = `ordine-card stato-${o.stato}`;
            card.innerHTML = `
                <div class="card-header">
                    <h3>#${o.id.toString().slice(-4)}</h3>
                    <span class="badge">${o.tipo_ordine}</span>
                </div>
                <p><strong>Cliente:</strong> ${escapeHtml(o.nome_cliente || "Anonimo")}</p>
                <ul class="prodotti-list">
                    ${(o.ordine_prodotti || []).map(p => `
                        <li>${p.quantita}x ${escapeHtml(p.nome_prodotto)}</li>
                    `).join('')}
                </ul>
                <select onchange="window.updateOrderStatus('${o.id}', this.value, this)">
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

window.updateOrderStatus = async function(ordineId, nuovoStato, selectElement) {
    try {
        await supabaseClient
            .from("ordini")
            .update({ stato: nuovoStato })
            .eq("id", ordineId);
        
        loadOrders();
    } catch (err) {
        console.error(err);
        showToast("Errore aggiornamento stato", "error");
    }
};

async function initKitchen() {
    const slug = getRistoranteSlug();
    if (!slug) return;

    try {
        const { data: ristorante } = await supabaseClient
            .from("ristoranti")
            .select("*")
            .eq("slug", slug)
            .single();

        if (ristorante) currentRistorante = ristorante;

        await loadOrders();

        // Realtime
        supabaseClient.channel("kitchen-realtime")
            .on("postgres_changes", {
                event: "*",
                schema: "public",
                table: "ordini",
                filter: `ristorante_id=eq.${ristorante.id}`
            }, loadOrders)
            .subscribe();
    } catch (err) {
        console.error(err);
    }
}

initKitchen();
