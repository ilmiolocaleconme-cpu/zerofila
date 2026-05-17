// ==========================================================================
// 6. ADMIN.JS - REPORTISTICA AVANZATA SAAS E INVIO CHIUSURA WHATSAPP
// ==========================================================================
import { supabaseClient } from './supabase.js';

/**
 * Genera un report analitico delle vendite per un determinato intervallo di giorni
 * @param {number} days - Numero di giorni da analizzare (1 per oggi, 7 per la settimana)
 * @returns {Object|null} Metriche calcolate o null in caso di errore
 */
export async function generaReportVendite(days = 1) {
    const ristorante = JSON.parse(sessionStorage.getItem("zf_current_ristorante"));
    if (!ristorante) {
        console.error("Errore SaaS: Ristorante non identificato per il report.");
        return null;
    }

    // Calcola la finestra temporale corretta
    const dataInizio = new Date();
    dataInizio.setDate(dataInizio.getDate() - days);
    if (days === 1) dataInizio.setHours(0, 0, 0, 0); // Se analizza oggi, parte da mezzanotte

    try {
        // Recupera solo gli ordini chiusi con successo per questo specifico ristorante (Isolamento SaaS)
        const { data: ordini, error } = await supabaseClient
            .from("ordini")
            .select("*")
            .eq("ristorante_id", ristorante.id)
            .eq("stato", "consegnato") 
            .gte("created_at", dataInizio.toISOString());

        if (error) throw error;

        const numeroOrdini = ordini.length;
        const incassoTotale = ordini.reduce((sum, o) => sum + o.totale, 0);
        const scontrinoMedio = numeroOrdini > 0 ? (incassoTotale / numeroOrdini) : 0;

        // Suddivisione analitica per canali di vendita
        const ripartizione = ordini.reduce((acc, o) => {
            if (acc[o.tipo_ordine] !== undefined) {
                acc[o.tipo_ordine] += o.totale;
            }
            return acc;
        }, { tavolo: 0, asporto: 0, delivery: 0 });

        return {
            intervallo: days === 1 ? "Giornaliero" : (days === 7 ? "Settimanale" : "Mensile"),
            conteggio: numeroOrdini,
            totaleIncassato: parseFloat(incassoTotale.toFixed(2)),
            scontrinoMedio: parseFloat(scontrinoMedio.toFixed(2)),
            dettaglioCanali: ripartizione
        };

    } catch (err) {
        console.error("Errore generazione report interno:", err);
        return null;
    }
}

/**
 * Genera il riepilogo giornaliero delle vendite reali e apre WhatsApp con il testo pronto per il titolare
 */
export async function inviaRiepilogoWhatsAppTitolare() {
    const ristorante = JSON.parse(sessionStorage.getItem("zf_current_ristorante"));
    if (!ristorante) return alert("Errore SaaS: Impossibile identificare il locale corrente.");

    const oggiInizio = new Date();
    oggiInizio.setHours(0, 0, 0, 0);

    try {
        // Estrae i dati finanziari reali aggiornati da Supabase
        const { data: ordini, error } = await supabaseClient
            .from("ordini")
            .select("*")
            .eq("ristorante_id", ristorante.id)
            .eq("stato", "consegnato")
            .gte("created_at", oggiInizio.toISOString());

        if (error) throw error;

        const totaleOrdini = ordini.length;
        const incassoTotale = ordini.reduce((sum, o) => sum + o.totale, 0);
        const scontrinoMedio = totaleOrdini > 0 ? (incassoTotale / totaleOrdini) : 0;

        const canali = ordini.reduce((acc, o) => {
            if (acc[o.tipo_ordine] !== undefined) {
                acc[o.tipo_ordine] += o.totale;
            }
            return acc;
        }, { tavolo: 0, asporto: 0, delivery: 0 });

        // === COSTRUZIONE MESSAGGIO CHIUSURA CON BACKTICK ED URL ENCODING ===
        let msg = `📊 *RIEPILOGO FINE SERATA — ${ristorante.nome.toUpperCase()}* %0A`;
        msg += `📅 *Data:* ${new Date().toLocaleDateString('it-IT')}%0A`;
        msg += `----------------------------------------%0A%0A`;
        msg += `💰 *Incasso Totale:* € ${incassoTotale.toFixed(2)}%0A`;
        msg += `📦 *Ordini Gestiti:* ${totaleOrdini}%0A`;
        msg += `💳 *Scontrino Medio:* € ${scontrinoMedio.toFixed(2)}%0A%0A`;
        
        msg += `*--- DETTAGLIO CANALI ---*%0A`;
        msg += `🪑 *Al Tavolo (QR):* € ${canali.tavolo.toFixed(2)}%0A`;
        msg += `📦 *Asporto:* € ${canali.asporto.toFixed(2)}%0A`;
        msg += `🚀 *Delivery:* € ${canali.delivery.toFixed(2)}%0A%0A`;
        
        msg += `----------------------------------------%0A`;
        msg += `🎉 Servizio concluso con successo su *ZeroFila* Anti-Caos! 🍔`;

        // Pulisce il numero salvato e inserisce il prefisso internazionale
        const numeroTitolare = (ristorante.telefono || "393896190004").replace(/\s+/g, '');
        const telefonoFinale = numeroTitolare.startsWith("+") || numeroTitolare.startsWith("39") ? numeroTitolare : `39${numeroTitolare}`;

        // Apre in sicurezza la scheda WhatsApp Web o App
        window.open(`https://wa.me{telefonoFinale}?text=${msg}`, "_blank");

    } catch (err) {
        console.error("Errore invio riepilogo:", err);
        alert("Impossibile generare il riepilogo WhatsApp in questo momento.");
    }
}
