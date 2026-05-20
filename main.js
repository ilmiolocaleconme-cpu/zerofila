document.addEventListener("DOMContentLoaded", async () => {
    if (window.location.pathname.includes("kitchen.html")) {
        const kitchenMod = await import('./kitchen.js?v=9.5.0');
        if (kitchenMod && typeof kitchenMod.initKitchen === "function") {
            kitchenMod.initKitchen();
        }
    } else {
        const menuMod = await import('./menu.js?v=9.6.0');
        if (menuMod && typeof menuMod.initMenu === "function") {
            menuMod.initMenu();
        }
    }
});
