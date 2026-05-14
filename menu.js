async function caricaMenu() {

  const container = document.getElementById("menu-container");

  try {

    const { data: categorie, error } = await supabaseClient
      .from("categorie")
      .select(`
        id,
        nome,
        ordine,
        prodotti (
          id,
          nome,
          descrizione,
          prezzo,
          disponibile
        )
      `)
      .eq("attiva", true)
      .order("ordine", { ascending: true });

    if (error) {
      console.error(error);
      container.innerHTML = "Errore caricamento menu";
      return;
    }

    container.innerHTML = "";

    categorie.forEach(categoria => {

      const section = document.createElement("div");
      section.className = "categoria";

      section.innerHTML += `
        <h2>${categoria.nome}</h2>
      `;

      categoria.prodotti.forEach(prodotto => {

        if (!prodotto.disponibile) return;

        section.innerHTML += `
          <div class="prodotto">
            <h3>${prodotto.nome}</h3>

            <p>${prodotto.descrizione || ""}</p>

            <div class="prezzo">
              € ${prodotto.prezzo}
            </div>
            <button onclick='addToCart(${JSON.stringify(prodotto)})'>
            + Aggiungi
          </button>
            
          </div>
        `;
      });

      container.appendChild(section);

    });

  } catch (err) {

    console.error(err);

    container.innerHTML = "Errore sistema";

  }

}

caricaMenu();
