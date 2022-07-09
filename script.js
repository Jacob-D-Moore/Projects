// document.querySelector(".calculate").addEventListener("click", calcTip());

let calcTip = function () {
  let bill = Number(document.querySelector(".bill-total").value);
  let tipPercent = Number(document.querySelector(".tip-amount").value);
  let numPeople = Number(document.querySelector(".total-people").value);

  if (bill === "" && tipPercent === "") {
    alert("Please enter valid values");
    return;
  }

  let total = (bill * (tipPercent / 100) + bill) / numPeople;
  document.querySelector(".tip").textContent = total;
};
document.querySelector(".calculate").onclick = calcTip;
