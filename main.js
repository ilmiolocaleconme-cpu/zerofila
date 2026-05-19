import { initMenu } from './menu.js';

document.addEventListener("DOMContentLoaded", async () => {
    // Se siamo nella pagina della cucina, inizializza la dashboard del cuoco
    if (window.location.pathname.includes("kitchen.html")) {
        const kitchenMod = await import('./kitchen.js');
        kitchenMod.initKitchen();
    } else {
        // Altrimenti inizializza il menu clienti standard
        initMenu();
    }
});
