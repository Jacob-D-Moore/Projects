// Menu configuration for the POS trainer.
// Prices and combo numbers are approximate and vary by store/market —
// edit them here to match your restaurant's register.

const TAX_RATE_DEFAULT = 0.08;

const CATEGORIES = [
  { id: "entrees", name: "Entrées" },
  { id: "salads", name: "Salads & Wraps" },
  { id: "breakfast", name: "Breakfast" },
  { id: "sides", name: "Sides" },
  { id: "drinks", name: "Drinks" },
  { id: "treats", name: "Treats" },
  { id: "sauces", name: "Sauces & Dressings" },
];

// Modifiers: price is the upcharge (0 = free).
const MOD_GROUPS = {
  sandwich: [
    { name: "No Pickles", price: 0 },
    { name: "Extra Pickles", price: 0 },
    { name: "Add Cheese", price: 0.6 },
    { name: "Multigrain Bun", price: 0.5 },
    { name: "No Butter", price: 0 },
    { name: "Gluten-Free Bun", price: 1.25 },
  ],
  deluxe: [
    { name: "No Pickles", price: 0 },
    { name: "Extra Pickles", price: 0 },
    { name: "No Lettuce", price: 0 },
    { name: "No Tomato", price: 0 },
    { name: "No Cheese", price: 0 },
    { name: "Pepper Jack", price: 0 },
    { name: "Colby Jack", price: 0 },
    { name: "Multigrain Bun", price: 0.5 },
  ],
  grilled: [
    { name: "No Lettuce", price: 0 },
    { name: "No Tomato", price: 0 },
    { name: "Add Cheese", price: 0.6 },
    { name: "No Bun", price: 0 },
  ],
  salad: [
    { name: "No Cheese", price: 0 },
    { name: "No Tomato", price: 0 },
    { name: "Grilled Filet", price: 0 },
    { name: "Spicy Filet", price: 0 },
    { name: "Nuggets", price: 0 },
    { name: "No Chicken", price: 0 },
  ],
  biscuit: [
    { name: "Add Egg", price: 0.9 },
    { name: "Add Cheese", price: 0.6 },
    { name: "Spicy Filet", price: 0.3 },
    { name: "No Butter", price: 0 },
  ],
  drink: [
    { name: "No Ice", price: 0 },
    { name: "Light Ice", price: 0 },
    { name: "Extra Ice", price: 0 },
  ],
  shake: [
    { name: "No Whipped Cream", price: 0 },
    { name: "No Cherry", price: 0 },
  ],
};

const SIZE_LABELS = { S: "Small", M: "Medium", L: "Large" };

// Meal upcharge added on top of the entrée price, by size.
const MEAL_UPCHARGE = { S: 3.29, M: 3.69, L: 4.09 };

// Meal side options. upcharge is relative to the default side.
const MEAL_SIDES = {
  lunch: [
    { id: "fries", name: "Waffle Fries", upcharge: 0 },
    { id: "mac", name: "Mac & Cheese", upcharge: 1.15 },
    { id: "fruit", name: "Fruit Cup", upcharge: 0.79 },
    { id: "sidesalad", name: "Side Salad", upcharge: 1.79 },
    { id: "kale", name: "Kale Crunch", upcharge: 0.35 },
    { id: "soup", name: "Chicken Noodle Soup", upcharge: 1.59 },
  ],
  breakfast: [
    { id: "hashbrowns", name: "Hash Browns", upcharge: 0 },
    { id: "fruit", name: "Fruit Cup", upcharge: 0.79 },
    { id: "greekyogurt", name: "Greek Yogurt Parfait", upcharge: 1.69 },
  ],
};

const MEAL_DRINKS = [
  { id: "coke", name: "Coca-Cola", upcharge: 0 },
  { id: "dietcoke", name: "Diet Coke", upcharge: 0 },
  { id: "sprite", name: "Sprite", upcharge: 0 },
  { id: "drpepper", name: "Dr Pepper", upcharge: 0 },
  { id: "sweettea", name: "Sweet Tea", upcharge: 0 },
  { id: "unsweettea", name: "Unsweet Tea", upcharge: 0 },
  { id: "lemonade", name: "Lemonade", upcharge: 0 },
  { id: "dietlemonade", name: "Diet Lemonade", upcharge: 0 },
  { id: "sunjoy", name: "Sunjoy", upcharge: 0 },
  { id: "water", name: "Water Cup", upcharge: 0 },
  { id: "frostedlemonade", name: "Frosted Lemonade", upcharge: 2.25 },
];

// Items.
//  combo: combo number shown on the button (optional)
//  price: base price for unsized items
//  sizes: { S, M, L } prices for sized items
//  meal: "lunch" | "breakfast" if it can be made a meal
//  mods: key into MOD_GROUPS
const ITEMS = [
  // Entrées
  { id: "sandwich", name: "Chicken Sandwich", combo: 1, cat: "entrees", price: 5.29, meal: "lunch", mods: "sandwich" },
  { id: "deluxe", name: "Deluxe Sandwich", combo: 2, cat: "entrees", price: 5.99, meal: "lunch", mods: "deluxe" },
  { id: "spicy", name: "Spicy Sandwich", combo: 3, cat: "entrees", price: 5.59, meal: "lunch", mods: "sandwich" },
  { id: "spicydeluxe", name: "Spicy Deluxe", combo: 4, cat: "entrees", price: 6.29, meal: "lunch", mods: "deluxe" },
  { id: "nug8", name: "8ct Nuggets", combo: 5, cat: "entrees", price: 5.19, meal: "lunch" },
  { id: "strips3", name: "3ct Strips", combo: 6, cat: "entrees", price: 5.09, meal: "lunch" },
  { id: "grilledsandwich", name: "Grilled Sandwich", combo: 7, cat: "entrees", price: 6.79, meal: "lunch", mods: "grilled" },
  { id: "grillednug8", name: "8ct Grilled Nuggets", combo: 8, cat: "entrees", price: 6.19, meal: "lunch" },
  { id: "grilledclub", name: "Grilled Club", combo: 10, cat: "entrees", price: 8.59, meal: "lunch", mods: "grilled" },
  { id: "nug12", name: "12ct Nuggets", cat: "entrees", price: 7.39, meal: "lunch" },
  { id: "strips4", name: "4ct Strips", cat: "entrees", price: 6.69, meal: "lunch" },
  { id: "grillednug12", name: "12ct Grilled Nuggets", cat: "entrees", price: 8.99, meal: "lunch" },

  // Salads & wraps
  { id: "coolwrap", name: "Cool Wrap", combo: 9, cat: "salads", price: 8.39, meal: "lunch", mods: "salad" },
  { id: "cobb", name: "Cobb Salad", cat: "salads", price: 10.19, mods: "salad" },
  { id: "market", name: "Market Salad", cat: "salads", price: 10.19, mods: "salad" },
  { id: "southwest", name: "Spicy Southwest Salad", cat: "salads", price: 10.19, mods: "salad" },

  // Breakfast
  { id: "biscuit", name: "Chicken Biscuit", cat: "breakfast", price: 2.99, meal: "breakfast", mods: "biscuit" },
  { id: "minis4", name: "4ct Chick-n-Minis", cat: "breakfast", price: 4.79, meal: "breakfast" },
  { id: "eggwhite", name: "Egg White Grill", cat: "breakfast", price: 5.29, meal: "breakfast", mods: "grilled" },
  { id: "hbscramble", name: "Hash Brown Scramble Bowl", cat: "breakfast", price: 5.59, meal: "breakfast" },
  { id: "hashbrowns", name: "Hash Browns", cat: "breakfast", price: 1.29 },

  // Sides
  { id: "fries", name: "Waffle Fries", cat: "sides", sizes: { S: 2.29, M: 2.59, L: 2.89 } },
  { id: "mac", name: "Mac & Cheese", cat: "sides", sizes: { M: 3.69, L: 4.69 } },
  { id: "fruit", name: "Fruit Cup", cat: "sides", sizes: { M: 3.69, L: 5.29 } },
  { id: "sidesalad", name: "Side Salad", cat: "sides", price: 4.59 },
  { id: "kale", name: "Kale Crunch", cat: "sides", price: 3.29 },
  { id: "soup", name: "Chicken Noodle Soup", cat: "sides", sizes: { M: 4.19, L: 7.99 } },

  // Drinks
  { id: "coke", name: "Coca-Cola", cat: "drinks", sizes: { S: 1.89, M: 2.09, L: 2.39 }, mods: "drink" },
  { id: "dietcoke", name: "Diet Coke", cat: "drinks", sizes: { S: 1.89, M: 2.09, L: 2.39 }, mods: "drink" },
  { id: "sprite", name: "Sprite", cat: "drinks", sizes: { S: 1.89, M: 2.09, L: 2.39 }, mods: "drink" },
  { id: "drpepper", name: "Dr Pepper", cat: "drinks", sizes: { S: 1.89, M: 2.09, L: 2.39 }, mods: "drink" },
  { id: "sweettea", name: "Sweet Tea", cat: "drinks", sizes: { S: 1.89, M: 2.09, L: 2.39 }, mods: "drink" },
  { id: "unsweettea", name: "Unsweet Tea", cat: "drinks", sizes: { S: 1.89, M: 2.09, L: 2.39 }, mods: "drink" },
  { id: "lemonade", name: "Lemonade", cat: "drinks", sizes: { S: 2.29, M: 2.59, L: 2.99 }, mods: "drink" },
  { id: "dietlemonade", name: "Diet Lemonade", cat: "drinks", sizes: { S: 2.29, M: 2.59, L: 2.99 }, mods: "drink" },
  { id: "sunjoy", name: "Sunjoy", cat: "drinks", sizes: { S: 2.29, M: 2.59, L: 2.99 }, mods: "drink" },
  { id: "water", name: "Water Cup", cat: "drinks", price: 0, mods: "drink" },
  { id: "bottledwater", name: "Bottled Water", cat: "drinks", price: 1.99 },
  { id: "milk", name: "1% Milk", cat: "drinks", price: 1.59 },
  { id: "coffee", name: "Coffee", cat: "drinks", sizes: { S: 1.79, L: 2.29 } },
  { id: "icedcoffee", name: "Iced Coffee", cat: "drinks", sizes: { S: 3.39, L: 3.89 }, mods: "drink" },

  // Treats
  { id: "shakecc", name: "Cookies & Cream Shake", cat: "treats", price: 4.59, mods: "shake" },
  { id: "shakechoc", name: "Chocolate Shake", cat: "treats", price: 4.59, mods: "shake" },
  { id: "shakestraw", name: "Strawberry Shake", cat: "treats", price: 4.59, mods: "shake" },
  { id: "shakevan", name: "Vanilla Shake", cat: "treats", price: 4.59, mods: "shake" },
  { id: "frostedlemonade", name: "Frosted Lemonade", cat: "treats", price: 4.59 },
  { id: "frostedcoffee", name: "Frosted Coffee", cat: "treats", price: 4.59 },
  { id: "icedream", name: "Icedream Cone", cat: "treats", price: 1.69 },
  { id: "cookie", name: "Chocolate Chunk Cookie", cat: "treats", price: 1.59 },

  // Sauces (free packets)
  { id: "s_cfa", name: "Chick-fil-A Sauce", cat: "sauces", price: 0 },
  { id: "s_poly", name: "Polynesian", cat: "sauces", price: 0 },
  { id: "s_honeymustard", name: "Honey Mustard", cat: "sauces", price: 0 },
  { id: "s_ranch", name: "Garden Herb Ranch", cat: "sauces", price: 0 },
  { id: "s_bbq", name: "Barbeque", cat: "sauces", price: 0 },
  { id: "s_buffalo", name: "Zesty Buffalo", cat: "sauces", price: 0 },
  { id: "s_sriracha", name: "Sweet & Spicy Sriracha", cat: "sauces", price: 0 },
  { id: "s_honeyroasted", name: "Honey Roasted BBQ", cat: "sauces", price: 0 },
  { id: "d_avocadolime", name: "Avocado Lime Ranch Dressing", cat: "sauces", price: 0 },
  { id: "d_balsamic", name: "Light Balsamic Vinaigrette", cat: "sauces", price: 0 },
  { id: "d_chililime", name: "Creamy Salsa Dressing", cat: "sauces", price: 0 },
];
