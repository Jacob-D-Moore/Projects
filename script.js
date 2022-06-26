document.querySelector(".calculate").addEventListener("click", function () {
  let bill = document.querySelector(".bill-total").value;
  let tipPercent = document.querySelector(".tip-amount").value;
  let numPeople = document.querySelector(".total-people").value;
  let total = bill * (tipPercent / 100) + bill;

  document.querySelector(".tip").textContent = total;
});

// (billAmt * serviceQual) / numOfPeople;
