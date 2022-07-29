// document.querySelector(".calculate").addEventListener("click", calcTip());

let calcTip = function () {
  let bill = Number(document.querySelector(".bill-total").value);
  let tipPercent = Number(document.querySelector(".tip-amount").value);
  let numPeople = Number(document.querySelector(".total-people").value);

  if (bill == "" && tipPercent == "") {
    alert("Please enter valid values.");
    return;
  }

  if (numPeople === "" || numPeople <= 1) {
    numPeople = 1;
    document.querySelector(".each").style.display = "none";
  } else {
    document.querySelector(".each").style.display = "block";
  }

  let total = (bill * (tipPercent / 100) + bill) / numPeople;
  total = total.toFixed(2);
  document.querySelector(".tip").textContent = total;
};
document.querySelector(".calculate").onclick = calcTip;
