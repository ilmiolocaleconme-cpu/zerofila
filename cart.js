let cart = [];

function addToCart(prodotto) {
  cart.push(prodotto);
  renderCart();
}

function renderCart() {
  const cartItems = document.getElementById("cart-items");
  const cartTotal = document.getElementById("cart-total");

  cartItems.innerHTML = "";

  let totale = 0;

  cart.forEach((item, index) => {
    totale += item.prezzo;

    cartItems.innerHTML += `
      <div class="cart-item">
        <p>${item.nome} - € ${item.prezzo}</p>

        <button onclick="removeFromCart(${index})">
          ❌
        </button>
      </div>
    `;
  });

  cartTotal.innerText = `Totale: € ${totale}`;
}

function removeFromCart(index) {
  cart.splice(index, 1);
  renderCart();
}

document
  .getElementById("send-order")
  .addEventListener("click", () => {

    if (cart.length === 0) {
      alert("Carrello vuoto");
      return;
    }

    let messaggio = "Nuovo Ordine:%0A%0A";

    cart.forEach(item => {
      messaggio += `• ${item.nome} - € ${item.prezzo}%0A`;
    });

    const totale = cart.reduce(
      (sum, item) => sum + item.prezzo,
      0
    );

    messaggio += `%0A Totale: € ${totale}`;

    window.open(
      `https://wa.me/393333333333?text=${messaggio}`,
      "_blank"
    );
});
