# POS Trainer

A practice register for learning to ring orders at the front counter or drive-thru. It runs entirely in your browser: no install, no server, no internet.

## Run it

**Easiest:** download `POS-Trainer.html` (everything in one file) and double-click it. It opens in Chrome, Edge, Safari or Firefox and works offline. On a phone or tablet, save the file and open it in the browser.

Or open `index.html` in a full copy of this folder. `POS-Trainer.html` is a bundled copy of `index.html`, `styles.css`, `menu.js` and `app.js`. If you edit those files, rebuild the bundle or edit `POS-Trainer.html` directly.

## Modes

**Practice:** ring anything you want, then pay with card, cash or a gift card. Cash shows the change due and prints a receipt.

**Training:** press **Next Guest** and a simulated guest places an order, for example:

> "Hi! Can I get a large number 1 meal with a sweet tea, no pickles, and two Polynesian sauces. For here, please. (hands you $20.00 cash)"

Ring it in, pick the destination, then tender the payment the guest gave you. You get a score out of 100:

| Check | Points |
| --- | --- |
| Items (meal, size, side, drink, modifiers and quantity must all match) | 70 |
| Destination (Dine In / Carry Out / Drive-Thru) | 10 |
| Payment method | 10 |
| Cash tendered matches what the guest handed you | 10 |
| Over the target time | up to −15 |
| Hint used | −20 |

The results screen lists exactly what you missed and anything extra you rang. Your stats (orders, perfect orders, accuracy, average time, streak) are saved in your browser.

Levels:
- **Easy:** one item, no modifications.
- **Normal:** one or two items, some modifications, side swaps and sauces.
- **Lunch Rush:** two to four items, more modifications and quantities.

About 20% of guests are breakfast orders.

## Register tips

- Combo items (#1–#10) open as a **Meal** by default. Switch to **Entrée Only** if the guest doesn't want the meal.
- A meal needs a drink before you can add it. The default meal size is **Medium** when the guest doesn't say.
- Tap a line on the ticket to select it, then use −/+ Qty, Modify or Void. Double-tap a line to modify it.
- Keyboard: **Enter** adds the item in the builder or goes to the next guest. **Esc** closes a popup.
- ⚙ Settings: set the tax rate, read guest orders out loud (good for drive-thru practice), or reset your stats.

## Customizing

Prices and combo numbers are approximate. Edit `menu.js` to match your store: items, prices, combo numbers, modifiers, meal sides and drinks, and meal upcharges.
