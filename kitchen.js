// kitchen.js
import { supabaseClient } from './supabase.js';
import { getRistoranteSlug, escapeHtml } from './utils.js';

const kitchenContainer = document.getElementById("kitchen-orders");
const enableAudioBtn = document.getElementById("enable-audio");

let currentRistorante = null;
let lastOrderCount = 0;

const audioPlayer = new Audio();
audioPlayer.volume = 0.85;

function playNewOrderSound() {
    audioPlayer.src = "https://assets.mixkit.co/sfx/preview/2967/2967.wav";
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

    Object.entries(sections).forEach(([
