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
/**
 * Genera il testo delle notifiche di stato automatiche e gratuite per i clienti
 */
export function componiNotificaStatoWhatsApp(nomeCliente, tipoOrdine, nuovoStato, tavolo, indirizzo, nomeRistorante) {
    let messaggio = "Ciao *" + nomeCliente + "*, aggiornamento da *" + nomeRistorante.toUpperCase() + "*! 🍔\n\n";

    if (nuovoStato === "preparazione") {
        if (tipoOrdine === "tavolo") {
            messaggio += "👨‍🍳 Il cuoco ha preso in carico la tua comanda! I tuoi piatti sono in preparazione e ti verranno serviti a breve al *Tavolo " + (tavolo || '') + "*.";
        } else if (tipoOrdine === "asporto") {
            messaggio += "📦 Stiamo preparando il tuo ordine da asporto! A breve sarà pronto per il ritiro in cassa.";
        } else if (tipoOrdine === "delivery") {
            messaggio += "🚀 I tuoi piatti sono in preparazione! Il nostro rider si sta già preparando per la consegna.";
        }
    } 
    else if (nuovoStato === "pronto") {
        if (tipoOrdine === "tavolo") {
            messaggio += "🟢 I tuoi piatti sono pronti! Il cameriere li sta portando al tuo tavolo. Buon appetito!";
        } else if (tipoOrdine === "asporto") {
            messaggio += "🟢 *ORDINE PRONTO!* Puoi avvicinarti alla cassa per ritirare i tuoi piatti caldi.";
        } else if (tipoOrdine === "delivery") {
            messaggio += "🛵 *SIAMO IN CONSEGNA!* Il tuo ordine è pronto ed è appena partito con il nostro rider verso: _" + (indirizzo || '') + "_. Arriverà a breve!";
        }
    }

    messaggio += "\n\nInviato tramite *ZeroFila* ✨";
    return messaggio;
}

