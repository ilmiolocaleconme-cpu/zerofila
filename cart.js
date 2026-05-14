let cart = [];

function addToCart(prodotto) {
  const esistente = cart.find(p => p.id === prodotto.id);

  if (esistente) {
    esistente.quantita += 1;
  } else {
    cart.push({
      ...prodotto,
      quantita: 1
    });
  }

  renderCart();
}

function renderCart() {
  const cartItems = document.getElementById("cart-items");
  const cartTotal = document.getElementById("cart-total");

  cartItems.innerHTML = "";

  let totale = 0;

  cart.forEach(prodotto => {
    totale += prodotto.prezzo * prodotto.quantita;

    cartItems.innerHTML += `
      <div class="cart-item">

        <h4>${prodotto.nome}</h4>

        <p>
          € ${prodotto.prezzo} x ${prodotto.quantita}
        </p>

        <div class="cart-controls">

          <button onclick="decreaseQuantity('${prodotto.id}')">
            -
          </button>

          <span>${prodotto.quantita}</span>

          <button onclick="increaseQuantity('${prodotto.id}')">
            +
          </button>

        </div>

      </div>
    `;
  });

  cartTotal.innerText = `Totale: €${totale}`;
}

function increaseQuantity(id) {
  const prodotto = cart.find(p => p.id == id);

  if (prodotto) {
    prodotto.quantita += 1;
  }

  renderCart();
}

function decreaseQuantity(id) {
  const prodotto = cart.find(p => p.id == id);

  if (prodotto) {
    prodotto.quantita -= 1;

    if (prodotto.quantita <= 0) {
      cart = cart.filter(p => p.id != id);
    }
  }

  renderCart();
}

document
  .getElementById("send-order")
  .addEventListener("click", async () => {

    if (cart.length === 0) {
      alert("Carrello vuoto");
      return;
    }

    const totale = cart.reduce((sum, p) => {
      return sum + (p.prezzo * p.quantita);
    }, 0);

    const { data: ordine, error } = await supabase
      .from("ordini")
      .insert([
        {
          totale: totale,
          stato: "ricevuto",
          tipo_ordine: "asporto"
        }
      ])
      .select()
      .single();

    if (error) {
      console.error(error);
      alert("Errore creazione ordine");
      return;
    }

    const prodottiOrdine = cart.map(p => ({
      ordine_id: ordine.id,
      prodotto_id: p.id,
      nome_prodotto: p.nome,
      prezzo: p.prezzo,
      quantita: p.quantita
    }));

    const { error: prodottiError } = await supabase
      .from("ordine_prodotti")
      .insert(prodottiOrdine);

    if (prodottiError) {
      console.error(prodottiError);
      alert("Errore salvataggio prodotti");
      return;
    }

    let messaggio = "🍔 NUOVO ORDINE ZeroFila%0A%0A";

    cart.forEach(p => {
      messaggio += `• ${p.nome} x${p.quantita}%0A`;
    });

    messaggio += `%0ATotale: €${totale}`;

    window.location.href =
      `https://wa.me/393896190004?text=${messaggio}`;

    cart = [];

    renderCart();
  });
