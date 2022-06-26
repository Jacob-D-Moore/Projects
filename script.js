document.querySelector(".calculate").addEventListener("click", function () {
  let bill = Number(document.querySelector(".bill-total").value);
  let tipPercent = Number(document.querySelector(".tip-amount").value);
  let numPeople = Number(document.querySelector(".total-people").value);
  let total = (bill * (tipPercent / 100) + bill) / numPeople;

  document.querySelector(".tip").textContent = total;
});

// (billAmt * serviceQual) / numOfPeople;
