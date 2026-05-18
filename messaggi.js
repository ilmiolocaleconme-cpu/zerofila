/**
 * Compone il testo per WhatsApp differenziandolo in base alla modalità di consegna
 */
export function componiMessaggioWhatsApp(nome, telefono, tipo, tavolo, indirizzo, note, cart, totale, nomeRistorante) {
    let intestazione = "";
    let dettagliLogistica = "";

    // Cambia la struttura del messaggio in base alla modalità selezionata
    if (tipo === "tavolo") {
        intestazione = `🪑 *ORDINAZIONE AL TAVOLO ${tavolo || ''}*`;
        dettagliLogistica = `🪑 *Postazione:* Tavolo Numero ${tavolo}\n`;
    } else if (tipo === "asporto") {
        intestazione = `📦 *NUOVO ORDINE DA ASPORTO*`;
        dettagliLogistica = `📦 *Ritiro:* Il cliente ritirerà l'ordine di persona in locale\n`;
    } else if (tipo === "delivery") {
        intestazione = `🚀 *RICHIESTA DI CONSEGNA A DOMICILIO*`;
        dettagliLogistica = `📍 *Indirizzo Consegna:* ${indirizzo}\n`;
    }

    // Composizione unificata della comanda
    let testo = `${intestazione} — ${nomeRistorante.toUpperCase()}\n\n`;
    testo += `👤 *Cliente:* ${nome}\n`;
    testo += `📞 *Telefono:* ${telefono}\n`;
    testo += dettagliLogistica;
    
    if (note) {
        testo += `📝 *Note del Cliente:* ${note}\n`;
    }
    
    testo += `----------------------------------\n`;
    
    cart.forEach(item => {
        testo += `• ${item.quantita}x ${item.nome} (€ ${(item.prezzo * item.quantita).toFixed(2)})\n`;
    });
    
    testo += `----------------------------------\n`;
    testo += `💰 *TOTALE CONTO:* € ${totale.toFixed(2)}\n\n`;
    testo += `Inviato automaticamente tramite *ZeroFila* 🍔`;

    return testo;
}
