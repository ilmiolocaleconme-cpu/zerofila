// Forza il browser a ignorare la vecchia cache per tutti i moduli collegati
const timestampSaaS = Date.now();

Promise.all([
    import(`./supabase.js?t=${timestampSaaS}`),
    import(`./utils.js?t=${timestampSaaS}`),
    import(`./menu.js?t=${timestampSaaS}`),
    import(`./order.js?t=${timestampSaaS}`)
]).then(([supabaseMod, utilsMod, menuMod, orderMod]) => {
    console.log("✅ ZeroFila: moduli caricati in sincrono senza cache.");
    
    // Avvia l'inizializzazione del menu corretta
    menuMod.initMenu();
}).catch(err => {
    console.error("Errore critico di iniezione moduli:", err);
});
