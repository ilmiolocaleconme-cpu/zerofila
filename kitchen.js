const kitchenContainer =
  document.getElementById("kitchen-orders");



const newOrderSound =
  new Audio("notification.mp3");

newOrderSound.volume = 1;



let lastOrderCount = 0;



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



  // Suono nuovo ordine
  if (
    data.length > lastOrderCount &&
    lastOrderCount !== 0
  ) {

    newOrderSound.play()
      .catch(err => {
        console.log(
          "Audio bloccato dal browser",
          err
        );
      });

  }

  lastOrderCount = data.length;



  renderOrders(data);
}



function renderOrders(ordini) {

  kitchenContainer.innerHTML = "";



  const ricevuti =
    ordini.filter(
      o => o.stato === "ricevuto"
    );

  const preparazione =
    ordini.filter(
      o => o.stato === "preparazione"
    );

  const pronti =
    ordini.filter(
      o => o.stato === "pronto"
    );

  const consegnati =
    ordini.filter(
      o => o.stato === "consegnato"
    );



  renderSection(
    "🟡 Ricevuti",
    ricevuti
  );

  renderSection(
    "🟠 Preparazione",
    preparazione
  );

  renderSection(
    "🟢 Pronti",
    pronti
  );

  renderSection(
    "⚫ Consegnati",
    consegnati
  );
}



function renderSection(
  titolo,
  listaOrdini
) {

  kitchenContainer.innerHTML += `
    <h1 class="section-title">
      ${titolo}
    </h1>
  `;



  if (listaOrdini.length === 0) {

    kitchenContainer.innerHTML += `
      <p class="empty-orders">
        Nessun ordine
      </p>
    `;

    return;
  }



  listaOrdini.forEach(ordine => {

    let prodottiHTML = "";



    ordine.ordine_prodotti.forEach(
      prodotto => {

        prodottiHTML += `
          <li>
            ${prodotto.quantita}x
            ${prodotto.nome_prodotto}
          </li>
        `;

      }
    );



    kitchenContainer.innerHTML += `
      <div class="
        ordine-card
        stato-${ordine.stato}
      ">

        <h2>
          Ordine #${ordine.id.slice(0, 6)}
        </h2>

        <div class="ordine-status">

          <p>
            Stato:
            <strong>
              ${ordine.stato}
            </strong>
          </p>

          <select
            onchange="updateOrderStatus(
              '${ordine.id}',
              this.value
            )"
          >

            <option
              value="ricevuto"
              ${
                ordine.stato === "ricevuto"
                  ? "selected"
                  : ""
              }
            >
              Ricevuto
            </option>

            <option
              value="preparazione"
              ${
                ordine.stato === "preparazione"
                  ? "selected"
                  : ""
              }
            >
              Preparazione
            </option>

            <option
              value="pronto"
              ${
                ordine.stato === "pronto"
                  ? "selected"
                  : ""
              }
            >
              Pronto
            </option>

            <option
              value="consegnato"
              ${
                ordine.stato === "consegnato"
                  ? "selected"
                  : ""
              }
            >
              Consegnato
            </option>

          </select>

        </div>

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



async function updateOrderStatus(
  ordineId,
  nuovoStato
) {

  const { error } =
    await supabaseClient
      .from("ordini")
      .update({
        stato: nuovoStato
      })
      .eq("id", ordineId);



  if (error) {

    console.error(error);

    alert(
      "Errore aggiornamento stato"
    );

    return;
  }



  loadOrders();
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



// Refresh automatico
setInterval(loadOrders, 5000);
