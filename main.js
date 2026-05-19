// Importazione simultanea e sincronizzata dei moduli per distruggere la cache di rete
const t = Date.now();

Promise.all([
    import(`./supabase.js?t=${t}`),
    import(`./utils.js?t=${t}`),
    import(`./menu.js?t=${t}`),
    import(`./order.js?t=${t}`)
]).then(([supabaseMod, utilsMod, menuMod, orderMod]) => {
    console.log("🚀 ZeroFila Modules inizializzati in sincrono!");
    
    // Avvia il caricamento del menu
    menuMod.initMenu();
}).catch(err => {
    console.error("Errore critico nel caricamento dei moduli SaaS:", err);
});
