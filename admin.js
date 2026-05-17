// admin.js
import { supabaseClient } from './supabase.js';

export async function inviaRiepilogoWhatsAppTitolare() {
    const ristorante = JSON.parse(sessionStorage.getItem("zf_current_ristorante"));
    if (!ristorante) return alert("Errore: Locale non identificato.");

    const oggiInizio = new Date(); oggiInizio.setHours(0, 0, 0, 0);
    try {
        const { data: ordini, error } = await supabaseClient
            .from("ordini").select("*").eq("rist

