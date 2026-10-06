// POS Trainer — all state lives in this file. No build step, no server.

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => Array.from(document.querySelectorAll(sel));
const money = (n) => "$" + (Math.round(n * 100) / 100).toFixed(2);
const round2 = (n) => Math.round(n * 100) / 100;
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const chance = (p) => Math.random() < p;
const itemById = Object.fromEntries(ITEMS.map((i) => [i.id, i]));
const DEST_LABELS = { dinein: "Dine In", carryout: "Carry Out", drivethru: "Drive-Thru" };

// ---------- persisted settings & stats ----------
function load(key, fallback) {
  try {
    const v = JSON.parse(localStorage.getItem(key));
    return v ?? fallback;
  } catch {
    return fallback;
  }
}
function save(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage unavailable — ignore */
  }
}

const settings = Object.assign(
  { taxRate: TAX_RATE_DEFAULT, speak: false, difficulty: "normal" },
  load("pos.settings", {})
);
const emptyStats = () => ({ orders: 0, perfect: 0, totalTime: 0, streak: 0, best: 0, itemsHit: 0, itemsTotal: 0 });
let stats = Object.assign(emptyStats(), load("pos.stats", {}));

// ---------- order state ----------
const state = {
  mode: "practice",
  orderNum: load("pos.orderNum", 1),
  lines: [],
  dest: null,
  selectedUid: null,
  category: CATEGORIES[0].id,
  scenario: null,
  timerStart: null,
  hintUsed: false,
};
let uidCounter = 1;

// ---------- pricing ----------
function modsFor(item) {
  return item.mods ? MOD_GROUPS[item.mods] : [];
}
function basePrice(item, size) {
  if (item.sizes) return item.sizes[size] ?? Object.values(item.sizes)[0];
  return item.price;
}
function unitPrice(line) {
  const item = itemById[line.itemId];
  let p;
  if (line.meal) {
    p = item.price + MEAL_UPCHARGE[line.size];
    const side = MEAL_SIDES[item.meal].find((s) => s.id === line.side);
    const drink = MEAL_DRINKS.find((d) => d.id === line.drink);
    p += (side?.upcharge || 0) + (drink?.upcharge || 0);
  } else {
    p = basePrice(item, line.size);
  }
  for (const m of line.mods) {
    const def = modsFor(item).find((x) => x.name === m);
    p += def?.price || 0;
  }
  return round2(p);
}
function totalsFor(lines) {
  const subtotal = round2(lines.reduce((s, l) => s + unitPrice(l) * l.qty, 0));
  const tax = round2(subtotal * settings.taxRate);
  return { subtotal, tax, total: round2(subtotal + tax) };
}

// Canonical key used both for merging identical lines and for grading.
function lineKey(l) {
  return [l.itemId, l.meal ? "meal" : "ala", l.size || "", l.side || "", l.drink || "", [...l.mods].sort().join("+")].join("|");
}

function describeLine(l) {
  const item = itemById[l.itemId];
  const parts = [];
  if (l.meal) {
    const side = MEAL_SIDES[item.meal].find((s) => s.id === l.side);
    const drink = MEAL_DRINKS.find((d) => d.id === l.drink);
    parts.push(`${item.combo ? "#" + item.combo + " " : ""}${item.name} Meal (${SIZE_LABELS[l.size]})`);
    parts.push(`${side.name}, ${drink.name}`);
  } else {
    parts.push((l.size && item.sizes ? SIZE_LABELS[l.size] + " " : "") + item.name);
  }
  if (l.mods.length) parts.push(l.mods.join(", "));
  return `${l.qty} × ${parts.join(" — ")}`;
}

// ---------- rendering: menu ----------
function renderCategories() {
  const nav = $("#cats");
  nav.innerHTML = "";
  for (const c of CATEGORIES) {
    const b = document.createElement("button");
    b.textContent = c.name;
    b.style.background = `var(--cat-${c.id})`;
    b.classList.toggle("active", c.id === state.category);
    b.onclick = () => {
      state.category = c.id;
      renderCategories();
      renderGrid();
    };
    nav.appendChild(b);
  }
}

function renderGrid() {
  const grid = $("#grid");
  grid.innerHTML = "";
  for (const item of ITEMS.filter((i) => i.cat === state.category)) {
    const b = document.createElement("button");
    b.className = "item-btn";
    b.style.background = `var(--cat-${item.cat})`;
    const priceText = item.sizes
      ? Object.values(item.sizes).map(money).join(" / ")
      : item.price === 0
      ? "—"
      : money(item.price);
    b.innerHTML = `${item.combo ? `<span class="combo">#${item.combo}</span>` : ""}
      <span>${item.name}</span><span class="price">${priceText}</span>`;
    b.onclick = () => onItemTap(item);
    grid.appendChild(b);
  }
}

function onItemTap(item) {
  const simple = !item.sizes && !item.meal && !modsFor(item).length;
  if (simple) {
    addLine({ itemId: item.id, qty: 1, meal: false, size: null, side: null, drink: null, mods: [] });
  } else {
    openBuilder(item);
  }
}

// ---------- rendering: ticket ----------
function renderTicket() {
  $("#order-num").textContent = "#" + state.orderNum;
  const ol = $("#lines");
  ol.innerHTML = "";
  if (!state.lines.length) {
    ol.innerHTML = `<li class="empty">No items yet — tap the menu to ring in an order.</li>`;
  }
  for (const l of state.lines) {
    const item = itemById[l.itemId];
    const li = document.createElement("li");
    li.classList.toggle("selected", l.uid === state.selectedUid);
    const title = l.meal
      ? `${item.combo ? "#" + item.combo + " " : ""}${item.name} Meal – ${SIZE_LABELS[l.size]}`
      : (l.size && item.sizes ? SIZE_LABELS[l.size] + " " : "") + item.name;
    let html = `<div class="row"><span><span class="qty-badge">${l.qty}</span>${title}</span><span>${money(
      unitPrice(l) * l.qty
    )}</span></div>`;
    if (l.meal) {
      const side = MEAL_SIDES[item.meal].find((s) => s.id === l.side);
      const drink = MEAL_DRINKS.find((d) => d.id === l.drink);
      html += `<div class="sub">${item.name}</div>`;
      html += `<div class="sub">${SIZE_LABELS[l.size]} ${side.name}</div>`;
      html += `<div class="sub">${SIZE_LABELS[l.size]} ${drink.name}</div>`;
    }
    for (const m of l.mods) html += `<div class="sub mod">• ${m}</div>`;
    li.innerHTML = html;
    li.onclick = () => {
      state.selectedUid = state.selectedUid === l.uid ? null : l.uid;
      renderTicket();
    };
    li.ondblclick = () => openBuilder(item, l);
    ol.appendChild(li);
  }

  const t = totalsFor(state.lines);
  $("#subtotal").textContent = money(t.subtotal);
  $("#tax").textContent = money(t.tax);
  $("#total").textContent = money(t.total);

  const hasSel = !!state.lines.find((l) => l.uid === state.selectedUid);
  ["#qty-down", "#qty-up", "#modify-line", "#void-line"].forEach((id) => ($(id).disabled = !hasSel));
  $("#pay-btn").disabled = !state.lines.length;

  $$("#dest-buttons button").forEach((b) => b.classList.toggle("active", b.dataset.dest === state.dest));
}

function addLine(line) {
  const key = lineKey(line);
  const existing = state.lines.find((l) => lineKey(l) === key);
  if (existing) {
    existing.qty += line.qty;
    state.selectedUid = existing.uid;
  } else {
    line.uid = uidCounter++;
    state.lines.push(line);
    state.selectedUid = line.uid;
  }
  renderTicket();
  const ol = $("#lines");
  ol.scrollTop = ol.scrollHeight;
}

function selectedLine() {
  return state.lines.find((l) => l.uid === state.selectedUid);
}

// ---------- item builder ----------
let builder = null;

function openBuilder(item, editLine = null) {
  const defSize = item.sizes ? (item.sizes.M !== undefined ? "M" : Object.keys(item.sizes)[0]) : "M";
  builder = editLine
    ? { item, editUid: editLine.uid, line: { ...editLine, mods: [...editLine.mods] } }
    : {
        item,
        editUid: null,
        line: {
          itemId: item.id,
          qty: 1,
          meal: !!item.meal && item.combo !== undefined,
          size: item.sizes || item.meal ? defSize : null,
          side: item.meal ? MEAL_SIDES[item.meal][0].id : null,
          drink: item.meal ? null : null,
          mods: [],
        },
      };
  $("#b-title").textContent = (item.combo ? `#${item.combo} ` : "") + item.name;
  $("#b-add").textContent = editLine ? "Update" : "Add";
  renderBuilder();
  showModal("#builder");
}

function optButton(label, selected, onClick, extra = "") {
  const b = document.createElement("button");
  b.className = "btn" + (selected ? " selected" : "");
  b.innerHTML = label + (extra ? ` <small>${extra}</small>` : "");
  b.onclick = onClick;
  return b;
}

function group(title, buttons) {
  const g = document.createElement("div");
  g.className = "opt-group";
  g.innerHTML = `<h3>${title}</h3>`;
  const o = document.createElement("div");
  o.className = "opts";
  buttons.forEach((b) => o.appendChild(b));
  g.appendChild(o);
  return g;
}

function renderBuilder() {
  const { item, line } = builder;
  const body = $("#b-body");
  body.innerHTML = "";
  const rerender = () => renderBuilder();

  if (item.meal) {
    body.appendChild(
      group("Type", [
        optButton("Entrée Only", !line.meal, () => {
          line.meal = false;
          line.size = item.sizes ? line.size : null;
          rerender();
        }),
        optButton("Meal", line.meal, () => {
          line.meal = true;
          line.size = line.size || "M";
          line.side = line.side || MEAL_SIDES[item.meal][0].id;
          rerender();
        }),
      ])
    );
  }

  if (line.meal) {
    body.appendChild(
      group(
        "Size",
        ["S", "M", "L"].map((s) =>
          optButton(SIZE_LABELS[s], line.size === s, () => {
            line.size = s;
            rerender();
          })
        )
      )
    );
    body.appendChild(
      group(
        "Side",
        MEAL_SIDES[item.meal].map((s) =>
          optButton(
            s.name,
            line.side === s.id,
            () => {
              line.side = s.id;
              rerender();
            },
            s.upcharge ? "+" + money(s.upcharge) : ""
          )
        )
      )
    );
    body.appendChild(
      group(
        "Drink" + (line.drink ? "" : " — required"),
        MEAL_DRINKS.map((d) =>
          optButton(
            d.name,
            line.drink === d.id,
            () => {
              line.drink = d.id;
              rerender();
            },
            d.upcharge ? "+" + money(d.upcharge) : ""
          )
        )
      )
    );
  } else if (item.sizes) {
    body.appendChild(
      group(
        "Size",
        Object.keys(item.sizes).map((s) =>
          optButton(
            SIZE_LABELS[s],
            line.size === s,
            () => {
              line.size = s;
              rerender();
            },
            money(item.sizes[s])
          )
        )
      )
    );
  }

  const mods = modsFor(item);
  if (mods.length) {
    body.appendChild(
      group(
        "Modify",
        mods.map((m) =>
          optButton(
            m.name,
            line.mods.includes(m.name),
            () => {
              line.mods = line.mods.includes(m.name) ? line.mods.filter((x) => x !== m.name) : [...line.mods, m.name];
              rerender();
            },
            m.price ? "+" + money(m.price) : ""
          )
        )
      )
    );
  }

  $("#b-qty").textContent = line.qty;
  const ready = !line.meal || !!line.drink;
  $("#b-price").textContent = ready ? money(unitPrice(line) * line.qty) : "";
  $("#b-add").disabled = !ready;
}

function commitBuilder() {
  if (!builder || $("#b-add").disabled) return;
  const line = builder.line;
  if (!line.meal) {
    line.side = null;
    line.drink = null;
    if (!builder.item.sizes) line.size = null;
  }
  if (builder.editUid) {
    const idx = state.lines.findIndex((l) => l.uid === builder.editUid);
    state.lines[idx] = { ...line, uid: builder.editUid };
    state.selectedUid = builder.editUid;
    renderTicket();
  } else {
    addLine({ ...line });
  }
  hideModal("#builder");
  builder = null;
}

$("#b-qty-up").onclick = () => {
  builder.line.qty++;
  renderBuilder();
};
$("#b-qty-down").onclick = () => {
  builder.line.qty = Math.max(1, builder.line.qty - 1);
  renderBuilder();
};
$("#b-add").onclick = commitBuilder;

// ---------- ticket actions ----------
$("#qty-up").onclick = () => {
  const l = selectedLine();
  if (l) l.qty++;
  renderTicket();
};
$("#qty-down").onclick = () => {
  const l = selectedLine();
  if (!l) return;
  l.qty--;
  if (l.qty <= 0) {
    state.lines = state.lines.filter((x) => x !== l);
    state.selectedUid = null;
  }
  renderTicket();
};
$("#void-line").onclick = () => {
  state.lines = state.lines.filter((l) => l.uid !== state.selectedUid);
  state.selectedUid = null;
  renderTicket();
};
$("#modify-line").onclick = () => {
  const l = selectedLine();
  if (l) openBuilder(itemById[l.itemId], l);
};
$("#clear-order").onclick = () => {
  if (state.lines.length && !confirm("Void the entire order?")) return;
  resetOrder(false);
};
$$("#dest-buttons button").forEach(
  (b) =>
    (b.onclick = () => {
      state.dest = b.dataset.dest;
      $("#dest-buttons").classList.remove("needs");
      renderTicket();
    })
);

function resetOrder(advanceNumber) {
  state.lines = [];
  state.selectedUid = null;
  state.dest = null;
  if (advanceNumber) {
    state.orderNum++;
    save("pos.orderNum", state.orderNum);
  }
  renderTicket();
}

// ---------- payment ----------
const pay = { method: null, tendered: "" };

$("#pay-btn").onclick = () => {
  if (!state.dest) {
    const d = $("#dest-buttons");
    d.classList.remove("needs");
    void d.offsetWidth; // restart animation
    d.classList.add("needs");
    return;
  }
  pay.method = null;
  pay.tendered = "";
  $("#p-due").textContent = money(totalsFor(state.lines).total);
  renderPayment();
  showModal("#payment");
};

function tenderedAmount() {
  return pay.tendered ? Number(pay.tendered) / 100 : 0;
}

function renderPayment() {
  const due = totalsFor(state.lines).total;
  $$(".pay-methods .btn").forEach((b) => b.classList.toggle("selected", b.dataset.method === pay.method));
  $("#cash-panel").hidden = pay.method !== "cash";
  $("#p-tendered").textContent = money(tenderedAmount());

  const changeEl = $("#p-change");
  let ok = false;
  if (pay.method === "cash") {
    const t = tenderedAmount();
    ok = t >= due;
    changeEl.hidden = !ok;
    if (ok) changeEl.textContent = "Change due: " + money(t - due);
  } else {
    changeEl.hidden = true;
    ok = !!pay.method;
  }
  $("#p-complete").disabled = !ok;
}

$$(".pay-methods .btn").forEach(
  (b) =>
    (b.onclick = () => {
      pay.method = b.dataset.method;
      renderPayment();
    })
);

(function buildKeypad() {
  const keys = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "00", "0", "⌫"];
  const kp = $("#keypad");
  for (const k of keys) {
    const b = document.createElement("button");
    b.className = "btn";
    b.textContent = k;
    b.onclick = () => {
      if (k === "⌫") pay.tendered = pay.tendered.slice(0, -1);
      else if (pay.tendered.length < 7) pay.tendered = (pay.tendered + k).replace(/^0+/, "");
      renderPayment();
    };
    kp.appendChild(b);
  }
})();

function renderQuickCash() {
  const due = totalsFor(state.lines).total;
  const opts = [
    ["Exact", due],
    ["Next $", Math.ceil(due)],
    ...[5, 10, 20, 50, 100].filter((v) => v >= due).map((v) => ["$" + v, v]),
  ];
  const q = $("#quick-cash");
  q.innerHTML = "";
  const seen = new Set();
  for (const [label, amt] of opts) {
    if (seen.has(amt) && label !== "Exact") continue;
    seen.add(amt);
    const b = document.createElement("button");
    b.className = "btn small";
    b.textContent = label === "Exact" || label === "Next $" ? `${label} ${money(amt)}` : label;
    b.onclick = () => {
      pay.tendered = String(Math.round(amt * 100));
      renderPayment();
    };
    q.appendChild(b);
  }
  const clr = document.createElement("button");
  clr.className = "btn small danger";
  clr.textContent = "Clear";
  clr.onclick = () => {
    pay.tendered = "";
    renderPayment();
  };
  q.appendChild(clr);
}
$$('.pay-methods .btn[data-method="cash"]').forEach((b) => b.addEventListener("click", renderQuickCash));

$("#p-complete").onclick = () => {
  const totals = totalsFor(state.lines);
  const tendered = pay.method === "cash" ? tenderedAmount() : totals.total;
  const record = {
    orderNum: state.orderNum,
    lines: state.lines.map((l) => ({ ...l, mods: [...l.mods] })),
    dest: state.dest,
    method: pay.method,
    tendered,
    change: round2(tendered - totals.total),
    ...totals,
  };
  hideModal("#payment");
  if (state.mode === "training" && state.scenario) {
    showGrade(gradeOrder(state.scenario, record), record);
  } else {
    showReceipt(record);
  }
  resetOrder(true);
};

function receiptText(r) {
  const w = 36;
  const row = (l, rgt) => l + " ".repeat(Math.max(1, w - l.length - rgt.length)) + rgt;
  const out = [`ORDER #${r.orderNum}   ${DEST_LABELS[r.dest].toUpperCase()}`, "-".repeat(w)];
  for (const l of r.lines) {
    const item = itemById[l.itemId];
    const name = l.meal
      ? `${item.combo ? "#" + item.combo + " " : ""}${item.name} Meal ${l.size}`
      : (l.size && item.sizes ? l.size + " " : "") + item.name;
    out.push(row(`${l.qty} ${name}`.slice(0, w - 9), money(unitPrice(l) * l.qty)));
    if (l.meal) {
      out.push(`   ${MEAL_SIDES[item.meal].find((s) => s.id === l.side).name}`);
      out.push(`   ${MEAL_DRINKS.find((d) => d.id === l.drink).name}`);
    }
    l.mods.forEach((m) => out.push(`   * ${m}`));
  }
  out.push("-".repeat(w));
  out.push(row("Subtotal", money(r.subtotal)));
  out.push(row("Tax", money(r.tax)));
  out.push(row("TOTAL", money(r.total)));
  out.push(row(r.method === "cash" ? "Cash" : r.method === "gift" ? "Gift Card" : "Card", money(r.tendered)));
  if (r.method === "cash") out.push(row("Change", money(r.change)));
  return out.join("\n");
}

function showReceipt(r) {
  $("#r-title").textContent = r.method === "cash" ? `Change due ${money(r.change)}` : "Order complete";
  $("#r-body").innerHTML = `<div class="receipt"></div>`;
  $("#r-body .receipt").textContent = receiptText(r);
  $("#r-next").textContent = "New Order";
  $("#r-next").onclick = () => hideModal("#result");
  showModal("#result");
}

// ---------- training: scenario generation ----------
const SPOKEN_DRINK = {
  coke: "Coke",
  dietcoke: "Diet Coke",
  sprite: "Sprite",
  drpepper: "Dr Pepper",
  sweettea: "sweet tea",
  unsweettea: "unsweet tea",
  lemonade: "lemonade",
  dietlemonade: "diet lemonade",
  sunjoy: "Sunjoy",
  water: "water",
  frostedlemonade: "frosted lemonade",
};
const SPOKEN_SIDE = {
  fries: "fries",
  mac: "mac and cheese",
  fruit: "a fruit cup",
  sidesalad: "a side salad",
  kale: "kale crunch",
  soup: "chicken noodle soup",
  hashbrowns: "hash browns",
  greekyogurt: "a parfait",
};
const NUMBER_WORDS = ["zero", "one", "two", "three", "four"];

const BRAND_WORDS = ["Coca-Cola", "Diet Coke", "Sprite", "Dr Pepper", "Sunjoy", "Chick-fil-A", "Chick-n-Mini", "Cool Wrap", "Icedream"];
function spokenName(item) {
  let name = item.name
    .replace(/(\d+)ct /, "$1-count ")
    .replace(/Nuggets$/, "nugget")
    .replace(/Strips$/, "strip")
    .replace("Chick-n-Minis", "Chick-n-Mini")
    .toLowerCase();
  for (const w of BRAND_WORDS) name = name.replace(w.toLowerCase(), w);
  return name;
}
function article(word) {
  return /^(8|11|18|[aeiou])/i.test(word) ? "an" : "a";
}
function withArticle(qty, phrase, plural = /(s|cheese|crunch|milk|water)$/i.test(phrase) ? phrase : phrase + "s") {
  return qty > 1 ? `${NUMBER_WORDS[qty] || qty} ${plural}` : `${article(phrase)} ${phrase}`;
}

const DIFFICULTY = {
  easy: { lines: [1, 1], modChance: 0, sideSwapChance: 0, maxQty: 1, sauceChance: 0.2, target: 45 },
  normal: { lines: [1, 2], modChance: 0.35, sideSwapChance: 0.25, maxQty: 2, sauceChance: 0.5, target: 60 },
  rush: { lines: [2, 4], modChance: 0.5, sideSwapChance: 0.35, maxQty: 3, sauceChance: 0.7, target: 75 },
};

function randInt(a, b) {
  return a + Math.floor(Math.random() * (b - a + 1));
}

function genMealLine(item, cfg) {
  const sides = MEAL_SIDES[item.meal];
  const line = {
    itemId: item.id,
    qty: chance(0.15) ? randInt(1, cfg.maxQty) : 1,
    meal: true,
    size: pick(["S", "M", "M", "M", "L", "L"]),
    side: chance(cfg.sideSwapChance) ? pick(sides.slice(1)).id : sides[0].id,
    drink: pick(MEAL_DRINKS.filter((d) => d.id !== "frostedlemonade" || cfg.modChance > 0.4)).id,
    mods: [],
  };
  maybeMods(line, item, cfg);
  const name = item.combo && chance(0.5) ? `number ${item.combo}` : spokenName(item);
  const sizeWord = line.size === "M" && chance(0.6) ? "" : SIZE_LABELS[line.size].toLowerCase() + " ";
  let text = withArticle(line.qty, `${sizeWord}${name} meal`);
  if (line.side !== sides[0].id) text += ` with ${SPOKEN_SIDE[line.side]} instead of ${SPOKEN_SIDE[sides[0].id]}`;
  else if (chance(0.3)) text += ` with ${SPOKEN_SIDE[line.side]}`;
  text += `, ${line.qty === 2 ? "both with" : line.qty > 2 ? "all with" : "with"} ${article(SPOKEN_DRINK[line.drink])} ${SPOKEN_DRINK[line.drink]}`;
  text += modsPhrase(line);
  return { line, text };
}

function genAlaLine(item, cfg) {
  const line = { itemId: item.id, qty: randInt(1, cfg.maxQty), meal: false, size: null, side: null, drink: null, mods: [] };
  let sizeWord = "";
  if (item.sizes) {
    line.size = pick(Object.keys(item.sizes));
    sizeWord = SIZE_LABELS[line.size].toLowerCase() + " ";
  }
  maybeMods(line, item, cfg);
  let name = spokenName(item);
  if (item.cat === "entrees" && item.meal) {
    name = item.combo && chance(0.4) ? `number ${item.combo}` : name;
  }
  let text = withArticle(line.qty, sizeWord + name);
  if (item.meal && item.cat !== "breakfast") text += pick([line.qty > 1 ? ", just the entrées" : ", just the entrée", line.qty > 1 ? " by themselves" : " by itself", ", no meal"]);
  text += modsPhrase(line);
  return { line, text };
}

function maybeMods(line, item, cfg) {
  const mods = modsFor(item).filter((m) => !/Gluten|No Chicken/.test(m.name));
  if (!mods.length || !chance(cfg.modChance)) return;
  const n = cfg.modChance > 0.4 && chance(0.4) ? 2 : 1;
  const chosen = new Set();
  for (let tries = 0; chosen.size < n && tries < 20; tries++) {
    const m = pick(mods).name;
    // don't pick contradictory pairs
    if (m.includes("Pickles") && [...chosen].some((c) => c.includes("Pickles"))) continue;
    if (m.includes("Ice") && [...chosen].some((c) => c.includes("Ice"))) continue;
    if (/Filet|Nuggets/.test(m) && [...chosen].some((c) => /Filet|Nuggets/.test(c))) continue;
    if (/Pepper Jack|Colby Jack|No Cheese/.test(m) && [...chosen].some((c) => /Jack|No Cheese/.test(c))) continue;
    chosen.add(m);
  }
  line.mods = [...chosen];
}

function modsPhrase(line) {
  if (!line.mods.length) return "";
  const words = line.mods.map((m) => {
    const lower = m.toLowerCase();
    if (lower.startsWith("no ") || lower.startsWith("add ") || lower.startsWith("extra ") || lower.startsWith("light "))
      return lower;
    if (/filet|nuggets/.test(lower)) return `with ${lower} on it`;
    return `with ${lower}`;
  });
  return ` — ${words.join(" and ")}`;
}

function genSauceLine(cfg, forItems) {
  const pool = ITEMS.filter((i) => i.cat === "sauces" && (forItems === "salad") === i.id.startsWith("d_"));
  const item = pick(pool);
  const qty = chance(0.6) ? 1 : randInt(2, 3);
  const line = { itemId: item.id, qty, meal: false, size: null, side: null, drink: null, mods: [] };
  const n = item.name.replace(/ (Dressing|Sauce)$/, "");
  const what = forItems === "salad" ? "dressing" : "sauce";
  const text =
    qty > 1 ? `${NUMBER_WORDS[qty]} ${n} ${what}s` : `${article(n)} ${n} ${what}`;
  return { line, text };
}

function generateScenario(difficulty) {
  const cfg = DIFFICULTY[difficulty];
  const breakfast = chance(0.2);
  const count = randInt(cfg.lines[0], cfg.lines[1]);
  const parts = [];

  const entreePool = breakfast
    ? ITEMS.filter((i) => i.cat === "breakfast" && i.meal)
    : ITEMS.filter((i) => (i.cat === "entrees" || i.id === "coolwrap") && i.meal);

  for (let i = 0; i < count; i++) {
    const r = Math.random();
    if (i === 0 || r < 0.5) {
      const item = pick(entreePool);
      parts.push(chance(difficulty === "easy" ? 0.65 : 0.7) ? genMealLine(item, cfg) : genAlaLine(item, cfg));
    } else if (r < 0.65 && !breakfast) {
      parts.push(genAlaLine(pick(ITEMS.filter((x) => x.cat === "salads" && x.id !== "coolwrap")), cfg));
    } else if (r < 0.8) {
      const pool = breakfast
        ? ITEMS.filter((x) => ["hashbrowns", "coffee", "icedcoffee", "fruit"].includes(x.id))
        : ITEMS.filter((x) => x.cat === "sides" || x.cat === "drinks");
      parts.push(genAlaLine(pick(pool), cfg));
    } else {
      parts.push(genAlaLine(pick(ITEMS.filter((x) => x.cat === "treats")), cfg));
    }
  }

  // Sauces for nuggets/strips or dressing for salads
  const hasDippable = parts.some((p) => /nug|strips|minis/.test(p.line.itemId));
  const hasSalad = parts.some((p) => ["cobb", "market", "southwest"].includes(p.line.itemId));
  if (hasDippable && chance(cfg.sauceChance)) parts.push(genSauceLine(cfg, "dip"));
  if (hasSalad && chance(0.8)) parts.push(genSauceLine(cfg, "salad"));

  // Merge identical lines so grading compares like-for-like
  const merged = [];
  for (const p of parts) {
    const k = lineKey(p.line);
    const ex = merged.find((m) => lineKey(m) === k);
    if (ex) ex.qty += p.line.qty;
    else merged.push({ ...p.line });
  }

  const dest = pick(["dinein", "carryout", "drivethru", "drivethru"]);
  const total = totalsFor(merged).total;
  let payment;
  if (dest === "drivethru" ? chance(0.25) : chance(0.35)) {
    const bills = [5, 10, 20, 50, 100].filter((b) => b >= total);
    const given = chance(0.15) ? round2(Math.ceil(total)) : bills[0] ?? Math.ceil(total / 20) * 20;
    payment = { method: "cash", given };
  } else {
    payment = { method: chance(0.1) ? "gift" : "card" };
  }

  const opener = pick(["Hi! Can I get", "Hey, I'd like", "Can I please have", "Yeah, let me get", "Good afternoon — I'll do"]);
  const breakfastOpener = pick(["Good morning! Can I get", "Morning — I'd like"]);
  const sentences = parts.map((p, i) => (i === 0 ? p.text : (i === parts.length - 1 ? "and " : "") + p.text));
  let text = `${breakfast ? breakfastOpener : opener} ${sentences.join(", ")}.`;
  if (dest === "dinein") text += " " + pick(["That'll be for here.", "We're dining in.", "For here, please."]);
  if (dest === "carryout") text += " " + pick(["To go, please.", "That's carry out.", "I'll take it to go."]);
  if (payment.method === "cash") text += ` (hands you ${money(payment.given)} cash)`;
  if (payment.method === "card") text += " (taps a card)";
  if (payment.method === "gift") text += " (hands you a gift card)";

  return { lines: merged, dest, payment, text, difficulty, breakfast };
}

// ---------- training: grading ----------
function gradeOrder(sc, rec) {
  const expected = {};
  const actual = {};
  for (const l of sc.lines) expected[lineKey(l)] = (expected[lineKey(l)] || 0) + l.qty;
  for (const l of rec.lines) actual[lineKey(l)] = (actual[lineKey(l)] || 0) + l.qty;

  let hit = 0;
  const missing = [];
  const extra = [];
  const keys = new Set([...Object.keys(expected), ...Object.keys(actual)]);
  for (const k of keys) {
    const e = expected[k] || 0;
    const a = actual[k] || 0;
    hit += Math.min(e, a);
    if (e > a) missing.push({ ...lineFromKey(k), qty: e - a });
    if (a > e) extra.push({ ...lineFromKey(k), qty: a - e });
  }
  const expTotal = Object.values(expected).reduce((a, b) => a + b, 0);
  const actTotal = Object.values(actual).reduce((a, b) => a + b, 0);
  const itemAcc = hit / Math.max(expTotal, actTotal, 1);

  const destOk = rec.dest === sc.dest;
  const payOk = rec.method === sc.payment.method;
  const cashOk = sc.payment.method !== "cash" || (rec.method === "cash" && Math.abs(rec.tendered - sc.payment.given) < 0.005);
  const seconds = Math.round((Date.now() - state.timerStart) / 1000);
  const target = DIFFICULTY[sc.difficulty].target;

  let score = Math.round(itemAcc * 70) + (destOk ? 10 : 0) + (payOk ? 10 : 0) + (cashOk ? 10 : 0);
  if (seconds > target) score = Math.max(0, score - Math.min(15, Math.ceil((seconds - target) / 5)));
  if (state.hintUsed) score = Math.max(0, score - 20);
  const perfect = missing.length === 0 && extra.length === 0 && destOk && payOk && cashOk;

  return { missing, extra, itemAcc, destOk, payOk, cashOk, seconds, target, score, perfect, hit, expTotal, sc };
}

function lineFromKey(k) {
  const [itemId, kind, size, side, drink, mods] = k.split("|");
  return {
    itemId,
    meal: kind === "meal",
    size: size || null,
    side: side || null,
    drink: drink || null,
    mods: mods ? mods.split("+") : [],
  };
}

function showGrade(g, rec) {
  stopTimer();
  stats.orders++;
  stats.totalTime += g.seconds;
  stats.itemsHit += g.hit;
  stats.itemsTotal += g.expTotal;
  if (g.perfect && !state.hintUsed) {
    stats.perfect++;
    stats.streak++;
    stats.best = Math.max(stats.best, stats.streak);
  } else {
    stats.streak = 0;
  }
  save("pos.stats", stats);
  renderStats();

  const check = (ok, text) => `<li class="${ok ? "ok" : "bad"}">${ok ? "✔" : "✘"} ${text}</li>`;
  const mins = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
  let html = `<div class="score">${g.score}<span class="muted"> / 100</span></div><ul class="checks">`;
  html += check(g.missing.length === 0 && g.extra.length === 0, `Items: ${g.hit} of ${g.expTotal} correct`);
  html += check(g.destOk, `Destination: ${DEST_LABELS[rec.dest]}${g.destOk ? "" : ` (guest wanted ${DEST_LABELS[g.sc.dest]})`}`);
  html += check(
    g.payOk,
    `Payment: ${rec.method}${g.payOk ? "" : ` (guest paid with ${g.sc.payment.method})`}`
  );
  if (g.sc.payment.method === "cash") {
    html += check(
      g.cashOk,
      `Cash tendered: ${money(rec.method === "cash" ? rec.tendered : 0)}${
        g.cashOk ? ` — change ${money(rec.change)}` : ` (guest handed you ${money(g.sc.payment.given)})`
      }`
    );
  }
  html += check(g.seconds <= g.target, `Time: ${mins(g.seconds)} (target ${mins(g.target)})`);
  if (state.hintUsed) html += check(false, "Hint used (−20)");
  html += `</ul>`;

  if (g.missing.length || g.extra.length) {
    html += `<div class="diff">`;
    if (g.missing.length) html += `<h4>Missed (guest asked for, not rung)</h4><ul>${g.missing.map((l) => `<li>${describeLine(l)}</li>`).join("")}</ul>`;
    if (g.extra.length) html += `<h4>Extra (rung, guest didn't ask)</h4><ul>${g.extra.map((l) => `<li>${describeLine(l)}</li>`).join("")}</ul>`;
    html += `</div>`;
  }
  html += `<h4>Guest said</h4><p>${g.sc.text}</p>`;

  $("#r-title").textContent = g.perfect ? (state.hintUsed ? "Correct (with hint)" : "Perfect order! 🎉") : "Order check";
  $("#r-body").innerHTML = html;
  $("#r-next").textContent = "Next Guest";
  $("#r-next").onclick = () => {
    hideModal("#result");
    nextGuest();
  };
  state.scenario = null;
  showModal("#result");
}

// ---------- training: flow ----------
let timerHandle = null;
function startTimer() {
  state.timerStart = Date.now();
  stopTimer();
  timerHandle = setInterval(updateTimer, 250);
  updateTimer();
}
function stopTimer() {
  clearInterval(timerHandle);
  timerHandle = null;
}
function updateTimer() {
  if (!state.timerStart) return;
  const s = Math.floor((Date.now() - state.timerStart) / 1000);
  const el = $("#timer");
  el.textContent = `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
  el.classList.toggle("late", state.scenario && s > DIFFICULTY[state.scenario.difficulty].target);
}

const AVATARS = ["🙂", "😀", "🧑", "👩", "👨", "👵", "👴", "🧔", "👩‍🦱", "🧑‍🦰", "👨‍👩‍👧", "🤠"];

function nextGuest() {
  resetOrder(false);
  state.hintUsed = false;
  state.scenario = generateScenario(settings.difficulty);
  $("#customer-avatar").textContent = state.scenario.dest === "drivethru" ? "🚗" : pick(AVATARS);
  $("#customer-meta").textContent =
    (state.scenario.dest === "drivethru" ? "Drive-thru guest" : "Front counter guest") +
    (state.scenario.breakfast ? " · Breakfast" : "");
  $("#customer-text").textContent = state.scenario.text;
  if (settings.speak) speak(state.scenario.text);
  startTimer();
}

function speak(text) {
  if (!("speechSynthesis" in window)) return;
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text.replace(/\(.*?\)/g, "").replace(/#/g, "number "));
  u.rate = 1.05;
  speechSynthesis.speak(u);
}

$("#next-guest").onclick = () => {
  if (state.scenario && state.lines.length && !confirm("Skip this guest? It won't be scored.")) return;
  nextGuest();
};

$("#hint-btn").onclick = () => {
  if (!state.scenario) return;
  state.hintUsed = true;
  const sc = state.scenario;
  let html = `<ul class="hint-list">${sc.lines.map((l) => `<li>${describeLine(l)}</li>`).join("")}</ul>`;
  html += `<p><b>Destination:</b> ${DEST_LABELS[sc.dest]}<br><b>Payment:</b> ${sc.payment.method}${
    sc.payment.method === "cash" ? ` — tender ${money(sc.payment.given)}` : ""
  }<br><b>Expected total:</b> ${money(totalsFor(sc.lines).total)}</p>`;
  html += `<p class="muted">Using a hint costs 20 points and breaks your streak.</p>`;
  $("#r-title").textContent = "Hint";
  $("#r-body").innerHTML = html;
  $("#r-next").textContent = "Got it";
  $("#r-next").onclick = () => hideModal("#result");
  showModal("#result");
};

function renderStats() {
  const avg = stats.orders ? Math.round(stats.totalTime / stats.orders) : 0;
  const acc = stats.itemsTotal ? Math.round((stats.itemsHit / stats.itemsTotal) * 100) : 0;
  $("#stats").innerHTML = `
    <span class="stat">Orders <b>${stats.orders}</b></span>
    <span class="stat">Perfect <b>${stats.perfect}</b></span>
    <span class="stat">Item acc. <b>${acc}%</b></span>
    <span class="stat">Avg <b>${avg}s</b></span>
    <span class="stat">Streak <b>${stats.streak}</b> (best ${stats.best})</span>`;
}

// ---------- mode / settings ----------
$$(".mode-btn").forEach(
  (b) =>
    (b.onclick = () => {
      state.mode = b.dataset.mode;
      $$(".mode-btn").forEach((x) => x.classList.toggle("active", x === b));
      document.body.classList.toggle("training", state.mode === "training");
      if (state.mode === "practice") {
        stopTimer();
        state.scenario = null;
        $("#timer").textContent = "0:00";
        $("#customer-text").innerHTML = "Press <b>Next Guest</b> to start.";
        $("#customer-meta").textContent = "";
      }
    })
);

$("#difficulty").value = settings.difficulty;
$("#difficulty").onchange = (e) => {
  settings.difficulty = e.target.value;
  save("pos.settings", settings);
};

$("#settings-btn").onclick = () => {
  $("#tax-input").value = round2(settings.taxRate * 100);
  $("#speak-toggle").checked = settings.speak;
  showModal("#settings");
};
$("#tax-input").onchange = (e) => {
  const v = Number(e.target.value);
  if (!isNaN(v) && v >= 0 && v <= 20) {
    settings.taxRate = v / 100;
    save("pos.settings", settings);
    renderTicket();
  }
};
$("#speak-toggle").onchange = (e) => {
  settings.speak = e.target.checked;
  save("pos.settings", settings);
};
$("#reset-stats").onclick = () => {
  if (!confirm("Reset all training stats?")) return;
  stats = emptyStats();
  save("pos.stats", stats);
  renderStats();
};

// ---------- modal helpers ----------
function showModal(sel) {
  $(sel).hidden = false;
}
function hideModal(sel) {
  $(sel).hidden = true;
}
$$("[data-close]").forEach((b) => (b.onclick = () => hideModal("#" + b.closest(".modal").id)));
$$(".modal").forEach((m) =>
  m.addEventListener("click", (e) => {
    if (e.target === m && m.id !== "result") hideModal("#" + m.id);
  })
);

document.addEventListener("keydown", (e) => {
  const open = $$(".modal").find((m) => !m.hidden);
  if (e.key === "Escape" && open && open.id !== "result") hideModal("#" + open.id);
  if (e.key === "Enter" && open?.id === "builder") {
    e.preventDefault();
    commitBuilder();
  }
  if (e.key === "Enter" && open?.id === "result") {
    e.preventDefault();
    $("#r-next").click();
  }
});

// ---------- clock ----------
function tickClock() {
  $("#clock").textContent = new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}
setInterval(tickClock, 10000);
tickClock();

// ---------- boot ----------
renderCategories();
renderGrid();
renderTicket();
renderStats();
