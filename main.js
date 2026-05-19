/**
 * ZeroFila - Coordinatore Generale SaaS (Sincronizzato Anti-Cache)
 */
async function avviaApplicazioneZeroFila() {
    try {
        // 1. Forza il browser a verificare la freschezza dei file di modulo sulla rete
        const moduloMenu = await import('./menu.js');
        const moduloOrdine = await import('./order.js');

        console.log("✅ ZeroFila: Moduli caricati correttamente.");

        // 2. Avvia l'inizializzazione del menu cliente
        if (moduloMenu && typeof moduloMenu.initMenu === "function") {
            moduloMenu.initMenu();
        } else {
            console.error("Errore: La funzione initMenu non è esportata correttamente.");
        }

    } catch (err) {
        console.error("Errore critico di iniezione moduli SaaS:", err);
        
        // Se il browser si blocca per colpa della vecchia cache, esegui un hard reset automatico una sola volta
        if (!sessionStorage.getItem("zf_forced_refresh")) {
            sessionStorage.setItem("zf_forced_refresh", "true");
            window.location.reload(true);
        }
    }
}

// Avvio immediato controllato
avviaApplicazioneZeroFila();
