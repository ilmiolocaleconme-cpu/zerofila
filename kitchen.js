const kitchenContainer =
  document.getElementById("kitchen-orders");



async function loadOrders() {

  const { data, error } =
    await supabaseClient
      .from("ordini")
      .select(`
        *,
        ordine_prodotti (
          nome_prodotto,
          quantita
        )
      `)
      .order("created_at", {
        ascending: false
      });

  if (error) {
    console.error(error);

    kitchenContainer.innerHTML =
      "Errore caricamento ordini";

    return;
  }

  renderOrders(data);
}



function renderOrders(ordini) {

  kitchenContainer.innerHTML = "";

  ordini.forEach(ordine => {

    let prodottiHTML = "";

    ordine.ordine_prodotti.forEach(prodotto => {

      prodottiHTML += `
        <li>
          ${prodotto.quantita}x
          ${prodotto.nome_prodotto}
        </li>
      `;
    });

    kitchenContainer.innerHTML += `
      <div class="ordine-card">

        <h2>
          Ordine #${ordine.id.slice(0, 6)}
        </h2>

        <p>
          Stato:
          <strong>${ordine.stato}</strong>
        </p>

        <ul>
          ${prodottiHTML}
        </ul>

        <p>
          Totale:
          € ${ordine.totale}
        </p>

      </div>
    `;
  });
}



loadOrders();



supabaseClient
  .channel("ordini-realtime")
  .on(
    "postgres_changes",
    {
      event: "*",
      schema: "public",
      table: "ordini"
    },
    () => {
      loadOrders();
    }
  )
  .subscribe();
