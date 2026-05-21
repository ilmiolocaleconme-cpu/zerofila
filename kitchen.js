import { supabaseClient } from './supabase.js';

const kitchenContainer = document.getElementById("kitchen-orders");
const enableAudioBtn = document.getElementById("enable-audio");

let currentRistorante = null;
const audioPlayer = new Audio();
audioPlayer.volume = 0.85;

function escapeHtmlInfallibile(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

function formatPriceInfallibile(price) {
    const num = Number(price);
    return isNaN(num) ? "0.00" : num.toFixed(2);
}

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
    
