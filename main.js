document.addEventListener("DOMContentLoaded", async () => {
    // Rileva in automatico se ti trovi nella schermata della cucina o nel menu clienti
    if (window.location.pathname.includes("kitchen.html")) {
        
        // Carica la cucina coordinata sulla versione stabile
        const kitchenMod = await import('./kitchen.js?v=7.0.0');
        if (kitchenMod && typeof kitchenMod.initKitchen === "function") {
            kitchenMod.initKitchen();
        }
        
    } else {
        
        // Carica il menu clienti coordinato sulla stessa identica istanza di memoria
        const menuMod = await import('./menu.js?v=7.0.0');
        if (menuMod && typeof menuMod.initMenu === "function") {
            menuMod.initMenu();
        }
        
    }
});
