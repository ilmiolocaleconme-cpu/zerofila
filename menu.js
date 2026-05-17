// menu.js
import { supabaseClient } from './supabase.js';

const menuContainer = document.getElementById("menu-container");
const restNameHeader = document.getElementById("restaurant-name");

function getRistoranteSlug() {
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('r')) return urlParams.get('r');
    const path = window.location.pathname;
    const parts = path.split('/').filter(p => p);
    return parts[0] || null; 
}

async function initMenu() {
    const slug = getRistoranteSlug();
    if (!slug) {
        menuContainer.innerHTML = "<p class='error-msg'>Nessun locale selezionato. Specifica uno slug nell'URL.</p>";
        return;
    }

    try {
        const { data: ristorante, error: rError } = await supabaseClient
            .from("ristoranti")
            .select("*")
            .eq("slug", slug)
            .single();

        if (rError || !ristorante) throw new Error("Ristorante non trovato");
        
        if (restNameHeader) restNameHeader.textContent = ristorante.nome;
        sessionStorage.setItem("zf_current_ristorante", JSON.stringify(ristorante));

        const [catResponse, prodResponse] = await Promise.all([
            supabaseClient.from("categorie").select("*").eq("ristorante_id", ristorante.id).order("ordine", { ascending: true }),
            supabaseClient.from("prodotti").select("*").eq("ristorante_id", ristorante.id).eq("disponibile", true).order("ordine", { ascending: true })
        ]);

        if (catResponse.error) throw catResponse.error;
        if (prodResponse.error) throw prodResponse.error;

        renderMenu(catResponse.data, prodResponse.data);
    } catch (err) {
        console.error(err);
        menuContainer.innerHTML = "<p class='error-msg'>Impossibile caricare il menu del locale.</p>";
    }
}

function renderMenu(categorie, prodotti) {
    if (categorie.length === 0) {
        menuContainer.innerHTML = "<p class='empty-msg'>Il menu è vuoto.</p>";
        return;
    }
    menuContainer.innerHTML = "";

    categorie.forEach(categoria => {
        const prodottiDellaCategoria = prodotti.filter(p => p.categoria_id === categoria.id);
        if (prodottiDellaCategoria.length === 0) return;

        const sezioneHTML = document.createElement("section");
        sezioneHTML.className = "menu-section";
        
        let prodottiHTML = "";
        prodottiDellaCategoria.forEach(prodotto => {
            prodottiHTML += `
                <div class="prodotto-card">
                    <div class="prodotto-info">
                        <h3>${prodotto.nome}</h3>
                        <p>${prodotto.descrizione || ""}</p>
                        <span class="prezzo">€ ${prodotto.prezzo.toFixed(2)}</span>
                    </div>
                    <button class="btn-add-to-cart" data-id="${prodotto.id}">➕ Aggiungi</button>
                </div>
            `;
        });

        sezioneHTML.innerHTML = `
            <h2 class="categoria-titolo">${categoria.nome}</h2>
            <div class="prodotti-grid">${prodottiHTML}</div>
        `;
        menuContainer.appendChild(sezioneHTML);
    });

    window.dispatchEvent(new Event("menuRendered"));
}

initMenu();
