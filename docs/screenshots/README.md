# Screenshots for the project log

Save PNGs here under these exact names. `docs/project-log.js` picks them up when
it builds `Chowly - Project Log.docx`, scales them to the page width and puts
the caption underneath.

A missing file does not break the build — the document prints a red
`[ screenshot not found: … ]` line in its place, so a gap is visible rather
than silent.

| File | What it should show |
|---|---|
| `01-landing.png` | The restaurant list on the landing page |
| `02-entry.png` | Name and table number, the staff option, and the footer |
| `03-menu.png` | A menu with the search box and the food/drinks tabs |
| `04-cart.png` | The basket with the total and the estimated wait |
| `05-order-placed.png` | A placed order with the countdown and the four stages |
| `06-waiter-order.png` | The waiter's view of an order, split kitchen and bar |
| `07-rating.png` | The rating stars on a served order |
| `08-payment.png` | The payment methods before the order has been served |
| `09-paid.png` | The receipt, with the pretend-payment notice |
| `10-admin.png` | A restaurant, its menu and its staff under Manage restaurants |
| `11-dashboard.png` | How service is going |

Rebuild the document with:

```
node docs/project-log.js "Chowly - Project Log.docx"
```
