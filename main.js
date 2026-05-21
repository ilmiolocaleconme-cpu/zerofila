document.addEventListener("DOMContentLoaded", async () => {
    if (window.location.pathname.includes("kitchen.html")) {
        const kitchenMod = await import('./kitchen.js?v=60');
        if (kitchenMod && typeof kitchenMod.initKitchen === "function") {
            kitchenMod.initKitchen();
        }
    } else {
        const menuMod = await import('./menu.js?v=60');
        if (menuMod && typeof menuMod.initMenu === "function") {
            menuMod.initMenu();
        }
    }
});
