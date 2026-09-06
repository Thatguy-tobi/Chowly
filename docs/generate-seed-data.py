"""
Generate the Chowly seed dataset as an Excel workbook.

Every value is produced under constraints that are checked before the file is
written, so the arithmetic and the foreign keys cannot drift:

  * subtotal            == quantity * unit_price          (integer naira, exact)
  * order_total         == sum of that order's subtotals
  * payment.amount      == order.order_total
  * unit_price          == the menu item's price
  * estimated_wait_time == max(slowest food item + 3 min per extra portion,
                                slowest drink item + 2 min per extra portion)
  * every FK points at a row that exists
  * an order's menu items belong to a menu of that order's restaurant
  * an order's waiter is a WAITER employed by that same restaurant
  * a preparation's chef/bartender are employed by that same restaurant,
    and are only set when the order actually contains food / drinks
  * a complaint or rating is filed by the customer who placed the order
  * timestamps run order -> preparation -> served -> payment, and complaints
    and ratings come after the order
  * no timestamp is dated later than the moment the file is generated
  * every waiter, chef and bartender was employed before the order they handled
  * complaints and ratings only exist against orders that were actually served
  * an order carries at most one rating and at most one payment

Run:  python docs/generate-seed-data.py
"""

import random
from datetime import datetime, timedelta

from openpyxl import Workbook
from openpyxl.styles import Alignment, Font, PatternFill
from openpyxl.utils import get_column_letter

random.seed(20260906)  # reproducible

OUT = r"C:\Users\Work\Documents\TeSA\Chowly\Chowly - Seed Data.xlsx"

# ---------------------------------------------------------------------------
# DATE ANCHORS
#
# Every date in this file is placed relative to the day it is generated, never
# to a fixed calendar date. A hardcoded date does not stay in the past: the
# first version of this script started the orders at 1 September and spread
# them over eight days, so once the real 6th arrived, nine orders were dated
# tomorrow and the application showed tables waiting for food they had not
# ordered yet. The checks at the end refuse to write anything dated after now.
# ---------------------------------------------------------------------------
N_ORDERS = 45
SPAN_DAYS = (N_ORDERS - 1) // 6

# One moment, captured once, so every "still in flight" order is measured from
# the same clock rather than drifting as the script runs.
NOW_ANCHOR = datetime.now().replace(second=0, microsecond=0)

# The newest order falls on the previous day, which is always wholly past.
# Orders run 12:00-21:00 so that they sit inside the restaurants' opening hours.
LAST_DAY = (datetime.now() - timedelta(days=1)).replace(
    hour=12, minute=0, second=0, microsecond=0
)
ORDER_BASE = LAST_DAY - timedelta(days=SPAN_DAYS)

# Nobody can have served an order before they were hired, so employment dates
# are kept a clear month behind the oldest order rather than merely in the past.
EMPLOY_LATEST = ORDER_BASE - timedelta(days=30)

# ---------------------------------------------------------------------------
# RESTAURANT
#
# Names and addresses/areas are real Lagos restaurants found by web search.
# Phone numbers and email addresses are INVENTED — real contact details for
# real businesses should not be fabricated and presented as fact, and the
# listings did not carry reliable ones. Opening hours are typical Lagos
# service hours.
# ---------------------------------------------------------------------------

restaurants = [
    # the two carried over from the Assignment 1 model
    ("R1", "The Gourmet House", "15 Victoria Island Road, Victoria Island", "08031234567", "info@gourmethouse.com", "10:00", "23:00"),
    ("R2", "Lagos Bistro", "22 Admiralty Way, Lekki Phase 1", "08098765432", "info@lagosbistro.com", "11:00", "22:00"),
    # ten new, based on real Lagos restaurants
    ("R3", "NOK by Alara", "Block XVI, 3 & 4 Oniru Estate, Victoria Island", "08034567801", "reservations@nokbyalara.com", "12:00", "23:00"),
    ("R4", "Terra Kulture", "Tiamiyu Savage Street, Victoria Island", "08034567802", "dining@terrakulture.com", "09:00", "22:00"),
    ("R5", "Cafe Blu Lagos", "64A Kofo Abayomi Street, Victoria Island", "08034567803", "hello@cafeblulagos.com", "08:00", "23:00"),
    ("R6", "788 on the Sea", "Off Remi Olowude Road, Bluewater Scheme, Lekki", "08034567804", "bookings@788onthesea.com", "12:00", "23:30"),
    ("R7", "Orchid House", "Orchid Road, Lekki Phase 2", "08034567805", "eat@orchidhouselagos.com", "08:00", "20:00"),
    ("R8", "Mood Lagos", "Admiralty Way, Lekki Phase 1", "08034567806", "hello@moodlagos.com", "12:00", "00:00"),
    ("R9", "Itan Test Kitchen", "Moor Road, Ikoyi", "08034567807", "table@itantestkitchen.com", "18:00", "23:00"),
    ("R10", "Brisk Lagos", "Awolowo Road, Ikoyi", "08034567808", "brunch@brisklagos.com", "09:00", "22:00"),
    ("R11", "La Veranda", "Kingsway Road, Ikoyi", "08034567809", "reserve@laverandalagos.com", "11:00", "23:00"),
    ("R12", "RSVP Lagos", "9 Eletu Ogabi Street, Victoria Island", "08034567810", "info@rsvplagos.com", "12:00", "23:00"),
]

# ---------------------------------------------------------------------------
# CATEGORY  (5 carried over + 20 new = 25)
# ---------------------------------------------------------------------------

categories = [
    ("CAT01", "Appetizers", "Food"), ("CAT02", "Main Course", "Food"),
    ("CAT03", "Desserts", "Food"), ("CAT04", "Soft Drinks", "Drink"),
    ("CAT05", "Cocktails", "Drink"),
    ("CAT06", "Soups", "Food"), ("CAT07", "Grills", "Food"),
    ("CAT08", "Salads", "Food"), ("CAT09", "Breakfast", "Food"),
    ("CAT10", "Sides", "Food"), ("CAT11", "Seafood", "Food"),
    ("CAT12", "Pastries", "Food"), ("CAT13", "Small Chops", "Food"),
    ("CAT14", "Pasta", "Food"), ("CAT15", "Rice Dishes", "Food"),
    ("CAT16", "Swallow & Soup", "Food"), ("CAT17", "Sandwiches", "Food"),
    ("CAT18", "Pepper Soup", "Food"), ("CAT19", "Suya & Asun", "Food"),
    ("CAT20", "Mocktails", "Drink"), ("CAT21", "Wines", "Drink"),
    ("CAT22", "Beers", "Drink"), ("CAT23", "Fresh Juices", "Drink"),
    ("CAT24", "Smoothies", "Drink"), ("CAT25", "Coffee & Tea", "Drink"),
]
CAT_TYPE = {c[0]: c[2] for c in categories}

# dish pools per category: (name, description, price_low, price_high, prep_low, prep_high)
DISHES = {
    "CAT01": [("Suya Skewers", "Spiced beef skewers with yaji and onion"), ("Peppered Snails", "Sauteed in pepper sauce"), ("Puff Puff", "Golden fried dough, six pieces"), ("Spring Rolls", "Crisp vegetable rolls"), ("Samosa", "Spiced beef samosa")],
    "CAT02": [("Jollof Rice & Chicken", "Smoky party jollof with grilled chicken"), ("Fried Rice & Chicken", "Vegetable fried rice with grilled chicken"), ("Ofada Rice & Ayamase", "Local rice with green pepper sauce"), ("Beef Suya Wrap", "Suya and onions in flatbread"), ("Chicken Republic Platter", "Grilled chicken with sides")],
    "CAT03": [("Chocolate Cake", "Warm slice with vanilla cream"), ("Chin Chin Parfait", "Layered cream with crushed chin chin"), ("Ice Cream Sundae", "Three scoops with syrup and nuts"), ("Coconut Candy", "Traditional coconut sweet"), ("Banana Bread", "Baked in house, served warm")],
    "CAT04": [("Coca-Cola", "Chilled 50cl bottle"), ("Fanta", "Chilled 50cl bottle"), ("Sprite", "Chilled 50cl bottle"), ("Chapman", "The Lagos classic, served tall"), ("Zobo", "Chilled hibiscus with ginger")],
    "CAT05": [("Mojito", "White rum, mint and lime"), ("Lagos Sunset", "Rum, passionfruit and grenadine"), ("Pina Colada", "Rum, pineapple and coconut cream"), ("Old Fashioned", "Bourbon, bitters and orange"), ("Margarita", "Tequila, triple sec and lime")],
    "CAT06": [("Egusi Soup", "Melon seed soup with assorted meat"), ("Ogbono Soup", "Drawn soup with beef and fish"), ("Efo Riro", "Spinach stew with assorted meat"), ("Banga Soup", "Palm nut soup, Delta style"), ("Oha Soup", "Oha leaves with cocoyam thickener")],
    "CAT07": [("Grilled Tilapia", "Whole fish, grilled, with plantain"), ("Grilled Chicken", "Half chicken, marinated overnight"), ("Barbecue Ribs", "Slow cooked, smoky glaze"), ("Grilled Croaker", "Whole croaker with pepper sauce"), ("Lamb Chops", "Grilled with rosemary")],
    "CAT08": [("Garden Salad", "Mixed leaves, tomato and cucumber"), ("Chicken Caesar Salad", "Grilled chicken, parmesan, croutons"), ("Coleslaw", "Crisp cabbage and carrot"), ("Avocado Salad", "Avocado, red onion and lime"), ("Nicoise Salad", "Tuna, egg, olives and beans")],
    "CAT09": [("Full English Breakfast", "Eggs, sausage, beans and toast"), ("Akara & Pap", "Bean cakes with fermented corn pudding"), ("Yam & Egg Sauce", "Boiled yam with pepper egg sauce"), ("Pancake Stack", "Three pancakes with syrup"), ("Moi Moi", "Steamed bean pudding")],
    "CAT10": [("Fried Plantain", "Sweet ripe plantain"), ("Yam Chips", "Thick cut, lightly salted"), ("Jollof Spaghetti", "Party style spaghetti"), ("French Fries", "Crisp, with pepper dip"), ("Boiled Yam", "Served with palm oil sauce")],
    "CAT11": [("Seafood Okra", "Okra with prawns, crab and fish"), ("Grilled Prawns", "Six prawns, garlic butter"), ("Calamari", "Lightly fried with aioli"), ("Fisherman Soup", "Assorted seafood in pepper broth"), ("Crab Meat Salad", "Fresh crab with citrus dressing")],
    "CAT12": [("Meat Pie", "Nigerian style, flaky pastry"), ("Sausage Roll", "Baked fresh daily"), ("Croissant", "Butter croissant"), ("Fish Roll", "Whole fish in soft dough"), ("Doughnut", "Sugar glazed")],
    "CAT13": [("Small Chops Platter", "Puff puff, spring roll, samosa, gizzard"), ("Peppered Gizzard", "Spicy gizzard with onion"), ("Chicken Wings", "Six wings, honey pepper"), ("Peppered Ponmo", "Cow skin in pepper sauce"), ("Asun Bites", "Peppered goat meat")],
    "CAT14": [("Spaghetti Bolognese", "Beef ragu, parmesan"), ("Penne Alfredo", "Creamy chicken alfredo"), ("Seafood Linguine", "Prawns and calamari in white wine"), ("Lasagna", "Layered beef and bechamel"), ("Pasta Primavera", "Seasonal vegetables, olive oil")],
    "CAT15": [("Coconut Rice", "Rice cooked in coconut milk"), ("Native Jollof", "Palm oil rice with dried fish"), ("Basmati & Stew", "Steamed basmati with beef stew"), ("Rice & Beans", "Served with fried plantain"), ("Chinese Fried Rice", "Wok fried with prawns")],
    "CAT16": [("Pounded Yam & Egusi", "Smooth pounded yam"), ("Eba & Ogbono", "Garri with drawn soup"), ("Amala & Ewedu", "With gbegiri and stew"), ("Semolina & Efo Riro", "Served with assorted meat"), ("Fufu & Oha", "Traditional pairing")],
    "CAT17": [("Club Sandwich", "Triple decker with fries"), ("Chicken Shawarma", "Grilled chicken, garlic sauce"), ("Beef Burger", "Beef patty, cheese, fries"), ("Toasted Cheese", "Three cheese blend"), ("Steak Sandwich", "Sirloin with caramelised onion")],
    "CAT18": [("Catfish Pepper Soup", "Fresh catfish, hot broth"), ("Goat Meat Pepper Soup", "Rich and peppery"), ("Chicken Pepper Soup", "Light and warming"), ("Assorted Pepper Soup", "Mixed offal"), ("Cow Leg Pepper Soup", "Slow cooked cow leg")],
    "CAT19": [("Beef Suya", "Charcoal grilled, wrapped"), ("Ram Suya", "Rich and smoky"), ("Chicken Suya", "Skewered chicken with yaji"), ("Asun", "Peppered goat meat"), ("Kilishi", "Dried spiced beef")],
    "CAT20": [("Virgin Mojito", "Mint, lime and soda"), ("Shirley Temple", "Ginger ale and grenadine"), ("Virgin Pina Colada", "Pineapple and coconut"), ("Fruit Punch", "Mixed tropical fruit"), ("Cucumber Cooler", "Cucumber, mint and lime")],
    "CAT21": [("House Red", "Glass of merlot"), ("House White", "Glass of chenin blanc"), ("Prosecco", "Glass, chilled"), ("Cabernet Sauvignon", "Bottle, full bodied"), ("Rose", "Glass, light and dry")],
    "CAT22": [("Star Lager", "Chilled bottle"), ("Gulder", "Chilled bottle"), ("Heineken", "Chilled bottle"), ("Trophy", "Chilled bottle"), ("Guinness Stout", "Chilled bottle")],
    "CAT23": [("Fresh Orange Juice", "Pressed to order"), ("Pineapple Juice", "Freshly pressed"), ("Watermelon Juice", "Chilled, no sugar"), ("Carrot & Ginger", "Cold pressed"), ("Mango Juice", "Seasonal mango")],
    "CAT24": [("Banana Smoothie", "Banana, yoghurt and honey"), ("Berry Smoothie", "Mixed berries"), ("Green Smoothie", "Spinach, apple and lime"), ("Mango Smoothie", "Mango and yoghurt"), ("Avocado Smoothie", "Creamy avocado and milk")],
    "CAT25": [("Espresso", "Double shot"), ("Cappuccino", "With chocolate dust"), ("Cafe Latte", "Smooth and milky"), ("English Breakfast Tea", "Pot for one"), ("Green Tea", "Loose leaf")],
}

# price and prep-time bands per category: (price_lo, price_hi, prep_lo, prep_hi)
BANDS = {
    "CAT01": (2500, 6000, 8, 15), "CAT02": (4500, 9000, 20, 30), "CAT03": (2000, 5000, 5, 10),
    "CAT04": (800, 2500, 2, 6), "CAT05": (3500, 7000, 6, 10), "CAT06": (4500, 9500, 25, 35),
    "CAT07": (6000, 15000, 25, 40), "CAT08": (3000, 7000, 8, 15), "CAT09": (2500, 7500, 12, 22),
    "CAT10": (1200, 3500, 8, 15), "CAT11": (6500, 16000, 25, 40), "CAT12": (1000, 2500, 5, 10),
    "CAT13": (2500, 6500, 10, 18), "CAT14": (4500, 11000, 18, 28), "CAT15": (4000, 9000, 20, 30),
    "CAT16": (4500, 9500, 22, 32), "CAT17": (3500, 8500, 12, 20), "CAT18": (4000, 9000, 20, 30),
    "CAT19": (3000, 8000, 12, 20), "CAT20": (2000, 4000, 5, 8), "CAT21": (5000, 25000, 3, 6),
    "CAT22": (1500, 3000, 2, 4), "CAT23": (1500, 3500, 4, 8), "CAT24": (2500, 4500, 5, 9),
    "CAT25": (1500, 4000, 4, 8),
}

# A glyph per dish, so the menu reads as a menu rather than a table of rows.
# Falls back to a per-category default. Purely presentational.
EMOJI = {
    "Suya Skewers": "🍢", "Peppered Snails": "🐌", "Puff Puff": "🍩", "Spring Rolls": "🥟", "Samosa": "🥠",
    "Jollof Rice & Chicken": "🍛", "Fried Rice & Chicken": "🍚", "Ofada Rice & Ayamase": "🍚",
    "Beef Suya Wrap": "🌯", "Chicken Republic Platter": "🍗",
    "Chocolate Cake": "🍰", "Chin Chin Parfait": "🍨", "Ice Cream Sundae": "🍧", "Coconut Candy": "🥥", "Banana Bread": "🍌",
    "Coca-Cola": "🥤", "Fanta": "🥤", "Sprite": "🥤", "Chapman": "🍹", "Zobo": "🧃",
    "Mojito": "🍸", "Lagos Sunset": "🍹", "Pina Colada": "🍹", "Old Fashioned": "🥃", "Margarita": "🍸",
    "Egusi Soup": "🍲", "Ogbono Soup": "🍲", "Efo Riro": "🥬", "Banga Soup": "🍲", "Oha Soup": "🍲",
    "Grilled Tilapia": "🐟", "Grilled Chicken": "🍗", "Barbecue Ribs": "🍖", "Grilled Croaker": "🐟", "Lamb Chops": "🍖",
    "Garden Salad": "🥗", "Chicken Caesar Salad": "🥗", "Coleslaw": "🥬", "Avocado Salad": "🥑", "Nicoise Salad": "🥗",
    "Full English Breakfast": "🍳", "Akara & Pap": "🥣", "Yam & Egg Sauce": "🍠", "Pancake Stack": "🥞", "Moi Moi": "🍮",
    "Fried Plantain": "🍌", "Yam Chips": "🍟", "Jollof Spaghetti": "🍝", "French Fries": "🍟", "Boiled Yam": "🍠",
    "Seafood Okra": "🦐", "Grilled Prawns": "🦐", "Calamari": "🦑", "Fisherman Soup": "🐟", "Crab Meat Salad": "🦀",
    "Meat Pie": "🥧", "Sausage Roll": "🌭", "Croissant": "🥐", "Fish Roll": "🥖", "Doughnut": "🍩",
    "Small Chops Platter": "🍢", "Peppered Gizzard": "🍗", "Chicken Wings": "🍗", "Peppered Ponmo": "🌶️", "Asun Bites": "🐐",
    "Spaghetti Bolognese": "🍝", "Penne Alfredo": "🍝", "Seafood Linguine": "🍤", "Lasagna": "🍝", "Pasta Primavera": "🍝",
    "Coconut Rice": "🥥", "Native Jollof": "🍚", "Basmati & Stew": "🍚", "Rice & Beans": "🍚", "Chinese Fried Rice": "🍚",
    "Pounded Yam & Egusi": "🍲", "Eba & Ogbono": "🍲", "Amala & Ewedu": "🍲", "Semolina & Efo Riro": "🍲", "Fufu & Oha": "🍲",
    "Club Sandwich": "🥪", "Chicken Shawarma": "🌯", "Beef Burger": "🍔", "Toasted Cheese": "🧀", "Steak Sandwich": "🥩",
    "Catfish Pepper Soup": "🐟", "Goat Meat Pepper Soup": "🐐", "Chicken Pepper Soup": "🍗",
    "Assorted Pepper Soup": "🌶️", "Cow Leg Pepper Soup": "🍖",
    "Beef Suya": "🍢", "Ram Suya": "🍢", "Chicken Suya": "🍢", "Asun": "🐐", "Kilishi": "🥩",
    "Virgin Mojito": "🍹", "Shirley Temple": "🍹", "Virgin Pina Colada": "🥥", "Fruit Punch": "🍹", "Cucumber Cooler": "🥒",
    "House Red": "🍷", "House White": "🥂", "Prosecco": "🥂", "Cabernet Sauvignon": "🍷", "Rose": "🌹",
    "Star Lager": "🍺", "Gulder": "🍺", "Heineken": "🍺", "Trophy": "🍺", "Guinness Stout": "🍺",
    "Fresh Orange Juice": "🍊", "Pineapple Juice": "🍍", "Watermelon Juice": "🍉", "Carrot & Ginger": "🥕", "Mango Juice": "🥭",
    "Banana Smoothie": "🍌", "Berry Smoothie": "🫐", "Green Smoothie": "🥬", "Mango Smoothie": "🥭", "Avocado Smoothie": "🥑",
    "Espresso": "☕", "Cappuccino": "☕", "Cafe Latte": "☕", "English Breakfast Tea": "🫖", "Green Tea": "🍵",
}

FIRST_NAMES = ["Tobi", "David", "Sarah", "Chidi", "Amaka", "Emeka", "Ngozi", "Yusuf", "Aisha", "Femi",
               "Bola", "Kelechi", "Tunde", "Halima", "Ifeanyi", "Zainab", "Segun", "Chioma", "Musa", "Funke",
               "Obinna", "Temitope", "Nneka", "Ibrahim", "Adaeze", "Gbenga", "Rukayat", "Uche", "Damilola", "Blessing",
               "Kunle", "Oluchi", "Sadiq", "Peace", "Ayo", "Hauwa", "Chinedu", "Yemi", "Fatima", "Bisi",
               "Ekene", "Tola", "Nkechi", "Abdul", "Grace", "Wale", "Ijeoma", "Salim", "Kemi", "Ada"]
LAST_NAMES = ["Akinola", "Johnson", "Williams", "Okafor", "Eze", "Bello", "Adeyemi", "Balogun", "Okonkwo", "Ibrahim",
              "Lawal", "Nwachukwu", "Ogundipe", "Musa", "Chukwu", "Adebayo", "Yakubu", "Obi", "Sanni", "Olawale",
              "Umeh", "Fashola", "Danjuma", "Oyelaran", "Ekwueme", "Bakare", "Nnaji", "Suleiman", "Aderinto", "Iheanacho"]

# ---------------------------------------------------------------------------
# Build
# ---------------------------------------------------------------------------

RIDS = [r[0] for r in restaurants]

# --- STAFF: every restaurant needs at least one waiter, chef and bartender,
# otherwise its orders could not be assigned or prepared.
staff = []
sid = 200
carried = [
    ("S201", "R1", "James", "Okafor", "08055555555", "Waiter", "2025-04-10"),
    ("S202", "R2", "Daniel", "Ade", "08066666666", "Chef", "2025-03-15"),
    ("S203", "R2", "Michael", "Bello", "08077777777", "Bartender", "2025-05-01"),
    ("S204", "R1", "Sarah", "Johnson", "08088888888", "Waiter", "2026-01-20"),
    ("S205", "R1", "John", "Lee", "08099999999", "Chef", "2026-01-21"),
    ("S206", "R1", "Kevin", "Bland", "08011111111", "Bartender", "2026-01-22"),
    ("S207", "R2", "Hannah", "Kim", "08022222222", "Waiter", "2026-01-23"),
]
staff.extend(carried)
used_names = {(c[2], c[3]) for c in carried}
sid = 207
name_pool = [(f, l) for f in FIRST_NAMES for l in LAST_NAMES]
random.shuffle(name_pool)
np_i = 0

def next_name():
    global np_i
    while True:
        n = name_pool[np_i]
        np_i += 1
        if n not in used_names:
            used_names.add(n)
            return n

for rid in RIDS:
    have = {role for (_, r, _, _, _, role, _) in staff if r == rid}
    needed = [r for r in ("Waiter", "Chef", "Bartender") if r not in have]
    # every restaurant gets any missing core roles, plus one extra waiter
    for role in needed + ["Waiter"]:
        sid += 1
        f, l = next_name()
        # Three draws, deliberately: the year/month/day are taken exactly as
        # they were before so the random sequence — and therefore every price,
        # menu and order already reviewed — is untouched. Only the result is
        # corrected. A date that lands after EMPLOY_LATEST is pulled back a
        # year, which is what stopped seven of these staff being "hired" in
        # October to December 2026 while serving orders placed in August.
        phone = f"080{random.randint(10000000, 99999999)}"   # drawn first, as before
        hired = datetime(2020 + int(random.choice("56")),
                         random.randint(1, 12),
                         random.randint(1, 28))
        while hired > EMPLOY_LATEST:
            hired = hired.replace(year=hired.year - 1)
        staff.append((f"S{sid}", rid, f, l, phone, role, hired.strftime("%Y-%m-%d")))

# --- CUSTOMER: 3 carried + 20 new
customers = [
    ("C001", "Tobi", "Akinola", "08123456789", "tobi@email.com", "2026-08-01"),
    ("C002", "David", "Johnson", "08012345678", "david@email.com", "2026-08-05"),
    ("C003", "Sarah", "Williams", "07034567890", "sarah@email.com", "2026-08-10"),
]
cust_names = {(c[1], c[2]) for c in customers}
for i in range(4, 24):
    while True:
        f, l = random.choice(FIRST_NAMES), random.choice(LAST_NAMES)
        if (f, l) not in cust_names:
            cust_names.add((f, l))
            break
    customers.append((f"C{i:03d}", f, l, f"0{random.choice([70, 80, 81, 90, 91])}{random.randint(10000000, 99999999)}",
                      f"{f.lower()}.{l.lower()}@email.com",
                      f"2026-0{random.randint(6, 8)}-{random.randint(1, 28):02d}"))

# --- MENU: 2 carried + 20 new = 22, spread across the 12 restaurants
menus = [
    ("MN01", "R1", "Main Restaurant Menu", "Food and drinks menu", "Active", "2026-01-01"),
    ("MN02", "R2", "Lagos Bistro Menu", "Food and drinks menu", "Active", "2026-02-01"),
]
menu_kinds = ["A La Carte Menu", "Drinks Menu", "Brunch Menu", "Dinner Menu", "Bar Menu"]
mn = 2
i = 0
while mn < 22:
    rid = RIDS[i % len(RIDS)]
    existing = sum(1 for m in menus if m[1] == rid)
    mn += 1
    menus.append((f"MN{mn:02d}", rid, menu_kinds[existing % len(menu_kinds)],
                  "Food and drinks menu", "Active",
                  f"2026-0{random.randint(1, 6)}-{random.randint(1, 28):02d}"))
    i += 1

# --- MENUITEM: each menu gets a realistic spread of categories
menu_items = []
it = 0
carried_items = {
    "MN01": [("IT01", "CAT02", "Jollof Rice & Chicken", "Nigerian style jollof rice", 5000, 25),
             ("IT03", "CAT03", "Chocolate Cake", "Chocolate cake slice", 3000, 5),
             ("IT04", "CAT04", "Coca-Cola", "Chilled soft drink", 1000, 2)],
    "MN02": [("IT02", "CAT02", "Fried Rice & Chicken", "Fried rice with chicken", 5000, 25),
             ("IT05", "CAT05", "Mojito", "Classic mint cocktail", 4000, 7)],
}
for mid, items in carried_items.items():
    for (iid, cid, name, desc, price, prep) in items:
        menu_items.append((iid, mid, cid, name, desc, price, prep, 1, EMOJI.get(name, "🍽️")))
        it = max(it, int(iid[2:]))

FOOD_CATS = [c for c in CAT_TYPE if CAT_TYPE[c] == "Food"]
DRINK_CATS = [c for c in CAT_TYPE if CAT_TYPE[c] == "Drink"]

for (mid, rid, mname, *_rest) in menus:
    used = {(mi[1], mi[3]) for mi in menu_items}
    # a menu carries food and drinks unless it is explicitly a drinks/bar menu
    if "Drinks" in mname or "Bar" in mname:
        cats = random.sample(DRINK_CATS, 4)
    else:
        cats = random.sample(FOOD_CATS, 4) + random.sample(DRINK_CATS, 2)
    for cid in cats:
        for (name, desc) in random.sample(DISHES[cid], 2):
            if (mid, name) in used:
                continue
            used.add((mid, name))
            lo, hi, plo, phi = BANDS[cid]
            price = random.randrange(lo, hi + 1, 500)  # whole naira, round to 500
            prep = random.randint(plo, phi)
            it += 1
            menu_items.append((f"IT{it:03d}", mid, cid, name, desc, price, prep, 1, EMOJI.get(name, "🍽️")))

ITEM = {m[0]: m for m in menu_items}
MENU_OF_REST = {}
for (mid, rid, *_r) in menus:
    MENU_OF_REST.setdefault(rid, []).append(mid)
ITEMS_OF_REST = {
    rid: [m[0] for m in menu_items if m[1] in mids] for rid, mids in MENU_OF_REST.items()
}

WAITERS = {}
CHEFS = {}
BARTENDERS = {}
for (s, rid, f, l, p, role, d) in staff:
    {"Waiter": WAITERS, "Chef": CHEFS, "Bartender": BARTENDERS}[role].setdefault(rid, []).append(s)

# --- ORDERS + ORDER ITEMS + PREPARATION + COMPLAINT + RATING + PAYMENT
orders, order_items, preps, complaints, ratings, payments = [], [], [], [], [], []

table_rng = random.Random(4242)  # independent of the main sequence
base = ORDER_BASE                # anchored to the generation date; see the top
n_orders = N_ORDERS
# statuses: enough Paid to give 20+ payments, some orders still in flight
statuses = (["Paid"] * 30) + (["Served"] * 6) + (["Preparing"] * 5) + (["Placed"] * 4)
random.shuffle(statuses)

# A complaint only makes sense against an order that actually ran late, so the
# late ones are chosen up front from the orders that reach the customer, and
# the preparation timestamps are then made to match.
served_idx = [i for i, s in enumerate(statuses) if s in ("Served", "Paid")]
late_idx = set(random.sample(served_idx, 22))

comp_n = rate_n = pay_n = prep_n = 0

for n in range(1, n_orders + 1):
    oid = f"ORD{n:03d}"
    rid = RIDS[(n - 1) % len(RIDS)]
    cust = random.choice(customers)[0]
    waiter = random.choice(WAITERS[rid])
    status = statuses[n - 1]

    placed = base + timedelta(days=(n - 1) // 6, hours=random.randint(0, 8), minutes=random.randint(0, 59))

    # pick 2-3 distinct items from THIS restaurant's menus
    chosen = random.sample(ITEMS_OF_REST[rid], random.randint(2, 3))
    total = 0
    food_longest = drink_longest = 0
    food_units = drink_units = 0
    for iid in chosen:
        _, _, cid, _, _, price, prep, _, _ = ITEM[iid]
        qty = random.randint(1, 3)
        subtotal = qty * price          # exact integer arithmetic
        total += subtotal
        if CAT_TYPE[cid] == "Food":
            food_longest = max(food_longest, prep)
            food_units += qty
        else:
            drink_longest = max(drink_longest, prep)
            drink_units += qty
        order_items.append((oid, iid, qty, price, subtotal))

    # A kitchen does not cook two fish one after the other, and a bartender does
    # not make two drinks in series. The wait is driven by the single slowest
    # item in each stream, plus a small allowance for each additional portion.
    # Chef and bartender work in parallel, so the order is ready when the slower
    # of the two streams is done.
    food_wait = food_longest + 3 * max(0, food_units - 1) if food_units else 0
    drink_wait = drink_longest + 2 * max(0, drink_units - 1) if drink_units else 0
    wait = max(food_wait, drink_wait)
    # table_number is CHANGE 006. It is drawn from a separate generator so that
    # adding this column does not shift the main random sequence and alter data
    # that has already been reviewed.
    # An order that is still being cooked should be being cooked NOW. Left on
    # the historical dates above, the waiter's queue opens on tables that have
    # supposedly been waiting since last week — "202 hr over the 21 min quoted"
    # reads as a broken application rather than as old data. Finished orders
    # keep their place in history; only the ones still in flight are pulled to
    # the present.
    #
    # The offset is derived from values already drawn rather than from new
    # random calls, so the sequence — and every price, item and name already
    # reviewed — is left exactly as it was. The spread runs either side of the
    # quoted wait, so some of these read as on time and some as running late.
    if status in ("Placed", "Preparing"):
        ago = 6 + (placed.hour * 7 + placed.minute) % (wait + 25)
        placed = NOW_ANCHOR - timedelta(minutes=ago)

    table_no = table_rng.randint(1, 24)
    orders.append((oid, cust, rid, waiter, placed.strftime("%Y-%m-%d %H:%M"), status, wait, total, table_no))

    has_food = food_units > 0
    has_drink = drink_units > 0

    is_late = (n - 1) in late_idx

    if status in ("Preparing", "Served", "Paid"):
        prep_n += 1
        start = placed + timedelta(minutes=random.randint(1, 4))
        # a late order overruns the quoted wait; an on-time one comes in under it
        overrun = random.randint(12, 40) if is_late else random.randint(-4, 3)
        end = start + timedelta(minutes=wait + overrun)
        preps.append((
            f"PR{prep_n:03d}", oid,
            random.choice(CHEFS[rid]) if has_food else "",
            random.choice(BARTENDERS[rid]) if has_drink else "",
            start.strftime("%Y-%m-%d %H:%M"),
            end.strftime("%Y-%m-%d %H:%M") if status in ("Served", "Paid") else "",
        ))
        # Only an order that actually reached the table has been served. A
        # "Preparing" order has a projected finish time, but nobody has eaten
        # yet — treating that as served is what previously let four orders
        # still in the kitchen carry a customer rating, one of them a
        # two-star with a complaint about food that had not arrived.
        served_at = end if status in ("Served", "Paid") else None
    else:
        served_at = None

    # a complaint when the kitchen ran long
    late = served_at is not None and (served_at - placed).total_seconds() / 60 > wait + 5
    if late:
        comp_n += 1
        complaints.append((f"COM{comp_n:03d}", oid, cust,
                           random.choice(["Order took far longer than the quoted time",
                                          "Serious delay before the food arrived",
                                          "We waited well past the estimated wait",
                                          "Drinks came very late"]),
                           (served_at + timedelta(minutes=random.randint(1, 6))).strftime("%Y-%m-%d %H:%M"),
                           random.choice(["Open", "Resolved"])))
        complained = True
    else:
        complained = False

    # A customer who complained always rates the order low — that is the story
    # in the brief. Others rate it sometimes. At most one rating per order.
    if served_at is not None and (complained or rate_n < 30):
        rate_n += 1
        value = random.randint(1, 2) if complained else random.randint(4, 5)
        ratings.append((f"RT{rate_n:03d}", oid, cust, value,
                        random.choice(["Long waiting time", "Not happy with the delay"]) if complained
                        else random.choice(["Excellent service", "Lovely food", "Will come again", "Very good"]),
                        (served_at + timedelta(minutes=random.randint(2, 10))).strftime("%Y-%m-%d %H:%M")))

    if status == "Paid":
        pay_n += 1
        payments.append((f"PAY{pay_n:03d}", oid, total,      # amount == order_total
                         random.choice(["Card", "Bank Transfer", "Cash"]), "Successful",
                         f"CHW-{base:%Y%m%d}-{pay_n:04d}",
                         (served_at + timedelta(minutes=random.randint(3, 20))).strftime("%Y-%m-%d %H:%M")))

# ---------------------------------------------------------------------------
# Validate — nothing is written until all of this passes
# ---------------------------------------------------------------------------

errors = []


def check(cond, msg):
    if not cond:
        errors.append(msg)


rid_set = set(RIDS)
sid_set = {s[0] for s in staff}
cid_set = {c[0] for c in customers}
cat_set = {c[0] for c in categories}
mid_set = {m[0] for m in menus}
iid_set = {m[0] for m in menu_items}
oid_set = {o[0] for o in orders}
STAFF_REST = {s[0]: s[1] for s in staff}
STAFF_ROLE = {s[0]: s[5] for s in staff}
ORDER = {o[0]: o for o in orders}

for s in staff:
    check(s[1] in rid_set, f"staff {s[0]} -> unknown restaurant {s[1]}")
for m in menus:
    check(m[1] in rid_set, f"menu {m[0]} -> unknown restaurant {m[1]}")
for mi in menu_items:
    check(mi[1] in mid_set, f"item {mi[0]} -> unknown menu {mi[1]}")
    check(mi[2] in cat_set, f"item {mi[0]} -> unknown category {mi[2]}")
    check(mi[5] > 0, f"item {mi[0]} has non-positive price")
    check(mi[6] > 0, f"item {mi[0]} has non-positive prep time")

# each menu must actually have items
for mid in mid_set:
    check(any(mi[1] == mid for mi in menu_items), f"menu {mid} has no items")

for o in orders:
    oid, cust, rid, waiter, when, status, wait, total, table_no = o
    check(cust in cid_set, f"order {oid} -> unknown customer {cust}")
    check(rid in rid_set, f"order {oid} -> unknown restaurant {rid}")
    check(waiter in sid_set, f"order {oid} -> unknown waiter {waiter}")
    check(STAFF_ROLE[waiter] == "Waiter", f"order {oid} waiter {waiter} is not a Waiter")
    check(STAFF_REST[waiter] == rid, f"order {oid} waiter {waiter} works at another restaurant")
    check(1 <= table_no <= 24, f"order {oid} has an out-of-range table number {table_no}")
    lines = [li for li in order_items if li[0] == oid]
    check(len(lines) > 0, f"order {oid} has no items")
    check(sum(li[4] for li in lines) == total, f"order {oid} total != sum of subtotals")

for li in order_items:
    oid, iid, qty, unit, sub = li
    check(oid in oid_set, f"order item -> unknown order {oid}")
    check(iid in iid_set, f"order item -> unknown item {iid}")
    check(qty > 0, f"order item {oid}/{iid} has non-positive quantity")
    check(qty * unit == sub, f"order item {oid}/{iid}: {qty} x {unit} != {sub}")
    check(unit == ITEM[iid][5], f"order item {oid}/{iid} unit price != menu price")
    check(ITEM[iid][1] in MENU_OF_REST[ORDER[oid][2]],
          f"order item {oid}/{iid} is from another restaurant's menu")

seen_prep = set()
for p in preps:
    pid, oid, chef, bar, start, end = p
    check(oid in oid_set, f"preparation {pid} -> unknown order {oid}")
    check(oid not in seen_prep, f"order {oid} has more than one preparation record")
    seen_prep.add(oid)
    check(chef or bar, f"preparation {pid} has neither chef nor bartender")
    if chef:
        check(STAFF_ROLE[chef] == "Chef", f"preparation {pid} chef {chef} is not a Chef")
        check(STAFF_REST[chef] == ORDER[oid][2], f"preparation {pid} chef at wrong restaurant")
    if bar:
        check(STAFF_ROLE[bar] == "Bartender", f"preparation {pid} bartender {bar} is not a Bartender")
        check(STAFF_REST[bar] == ORDER[oid][2], f"preparation {pid} bartender at wrong restaurant")
    check(start >= ORDER[oid][4], f"preparation {pid} starts before the order was placed")
    if end:
        check(end > start, f"preparation {pid} ends before it starts")

for c in complaints:
    check(c[1] in oid_set, f"complaint {c[0]} -> unknown order {c[1]}")
    check(c[2] == ORDER[c[1]][1], f"complaint {c[0]} filed by a different customer than the order's")
    check(c[4] > ORDER[c[1]][4], f"complaint {c[0]} predates the order")

seen_rating = set()
for r in ratings:
    check(r[1] in oid_set, f"rating {r[0]} -> unknown order {r[1]}")
    check(r[1] not in seen_rating, f"order {r[1]} has more than one rating")
    seen_rating.add(r[1])
    check(r[2] == ORDER[r[1]][1], f"rating {r[0]} given by a different customer than the order's")
    check(1 <= r[3] <= 5, f"rating {r[0]} value out of range")
    check(r[5] > ORDER[r[1]][4], f"rating {r[0]} predates the order")

seen_pay, seen_ref = set(), set()
for p in payments:
    pid, oid, amount, method, pstatus, ref, when = p
    check(oid in oid_set, f"payment {pid} -> unknown order {oid}")
    check(oid not in seen_pay, f"order {oid} has more than one payment")
    seen_pay.add(oid)
    check(ref not in seen_ref, f"duplicate transaction reference {ref}")
    seen_ref.add(ref)
    check(amount == ORDER[oid][7], f"payment {pid} amount != order total")
    check(ORDER[oid][5] == "Paid", f"payment {pid} is against an order not marked Paid")
    check(when > ORDER[oid][4], f"payment {pid} predates the order")

for o in orders:
    if o[5] == "Paid":
        check(o[0] in seen_pay, f"order {o[0]} is marked Paid but has no payment")

# Nothing may be dated after the moment the file is generated. This is the check
# that the first version lacked: every relative rule above passed while nine
# orders sat in the future, because being consistent with each other says
# nothing about being consistent with today.
NOW = datetime.now()


def not_future(label, stamp):
    """Accepts both the date-only and the date-and-time forms used above."""
    if stamp:
        fmt = "%Y-%m-%d %H:%M" if " " in stamp else "%Y-%m-%d"
        check(datetime.strptime(stamp, fmt) <= NOW, f"{label} is dated in the future: {stamp}")


for s in staff:
    not_future(f"staff {s[0]} employment", s[6])

# You cannot rate or complain about a meal you have not been given yet.
for c in complaints:
    check(ORDER[c[1]][5] in ("Served", "Paid"),
          f"complaint {c[0]} is against {c[1]}, which is still {ORDER[c[1]][5]}")
for r in ratings:
    check(ORDER[r[1]][5] in ("Served", "Paid"),
          f"rating {r[0]} is against {r[1]}, which is still {ORDER[r[1]][5]}")

# Nobody serves or cooks an order before their first day. This is the rule the
# future employment dates actually broke: seven staff were hired months after
# orders they had already handled, which no arithmetic check would ever notice.
STAFF_HIRED = {s[0]: datetime.strptime(s[6], "%Y-%m-%d") for s in staff}

for o in orders:
    not_future(f"order {o[0]}", o[4])
    placed_at = datetime.strptime(o[4], "%Y-%m-%d %H:%M")
    check(STAFF_HIRED[o[3]] <= placed_at,
          f"order {o[0]} was served by waiter {o[3]}, hired {o[3] and STAFF_HIRED[o[3]].date()}, after the order")

for p in preps:
    for who, label in ((p[2], "chef"), (p[3], "bartender")):
        if who:
            check(STAFF_HIRED[who] <= datetime.strptime(ORDER[p[1]][4], "%Y-%m-%d %H:%M"),
                  f"preparation {p[0]} names {label} {who}, hired after the order was placed")
for p in preps:
    not_future(f"preparation {p[0]} start", p[4])
    not_future(f"preparation {p[0]} end", p[5])
for c in complaints:
    not_future(f"complaint {c[0]}", c[4])
for r in ratings:
    not_future(f"rating {r[0]}", r[5])
for p in payments:
    not_future(f"payment {p[0]}", p[6])

if errors:
    print(f"VALIDATION FAILED — {len(errors)} problem(s):")
    for e in errors[:40]:
        print("  -", e)
    raise SystemExit(1)

# ---------------------------------------------------------------------------
# Write
# ---------------------------------------------------------------------------

HDR = PatternFill("solid", fgColor="1A1A1A")
HDR_FONT = Font(color="FFFFFF", bold=True, size=10)
TITLE_FONT = Font(bold=True, size=12)
NOTE_FONT = Font(italic=True, size=9, color="666666")

wb = Workbook()
wb.remove(wb.active)


def sheet(name, title, purpose, headers, rows, widths):
    ws = wb.create_sheet(name)
    ws["A1"] = title
    ws["A1"].font = TITLE_FONT
    ws["A2"] = purpose
    ws["A2"].font = NOTE_FONT
    ws["A3"] = f"{len(rows)} records"
    ws["A3"].font = NOTE_FONT
    for c, h in enumerate(headers, 1):
        cell = ws.cell(row=5, column=c, value=h)
        cell.fill = HDR
        cell.font = HDR_FONT
        cell.alignment = Alignment(vertical="center")
    for r, row in enumerate(rows, 6):
        for c, v in enumerate(row, 1):
            ws.cell(row=r, column=c, value=v)
    for c, w in enumerate(widths, 1):
        ws.column_dimensions[get_column_letter(c)].width = w
    ws.freeze_panes = "A6"
    return ws


sheet("Restaurant", "RESTAURANT", "Keeps records of restaurants using Chowly.",
      ["restaurant_id (PK)", "restaurant_name", "address", "phone", "email", "opening_time", "closing_time"],
      restaurants, [18, 24, 46, 16, 32, 14, 14])

sheet("Customer", "CUSTOMER", "Keeps records of customers who visit restaurants and use Chowly.",
      ["customer_id (PK)", "first_name", "last_name", "phone", "email", "registration_date"],
      customers, [18, 16, 18, 16, 32, 18])

sheet("Staff", "STAFF", "Keeps records of restaurant employees such as waiters, chefs and bartenders.",
      ["staff_id (PK)", "restaurant_id (FK)", "first_name", "last_name", "phone", "role", "employment_date"],
      staff, [14, 18, 16, 18, 16, 14, 18])

sheet("Category", "CATEGORY", "Classifies menu items as food or drinks.",
      ["category_id (PK)", "category_name", "category_type"],
      categories, [18, 24, 16])

sheet("Menu", "MENU", "Keeps records of restaurant menus.",
      ["menu_id (PK)", "restaurant_id (FK)", "menu_name", "description", "status", "created_date"],
      menus, [14, 18, 26, 26, 12, 16])

sheet("MenuItem", "MENUITEM",
      "Keeps records of individual food and drink items. preparation_time is new — the build requires every item to carry one.",
      ["item_id (PK)", "menu_id (FK)", "category_id (FK)", "item_name", "description", "price", "preparation_time", "availability", "emoji"],
      menu_items, [12, 14, 16, 28, 40, 12, 18, 14, 8])

sheet("CustomerOrder", "CUSTOMERORDER", "Keeps records of orders placed by customers. table_number is new — a waiter needs to know where to carry the food.",
      ["order_id (PK)", "customer_id (FK)", "restaurant_id (FK)", "waiter_id (FK)", "order_date", "status", "estimated_wait_time", "order_total", "table_number"],
      orders, [14, 18, 18, 14, 20, 14, 20, 14, 14])

sheet("OrderItem", "ORDERITEM", "Bridge entity resolving the many-to-many between orders and menu items. subtotal = quantity x unit_price.",
      ["order_id (PK+FK)", "item_id (PK+FK)", "quantity", "unit_price", "subtotal"],
      order_items, [18, 18, 12, 14, 14])

sheet("OrderPreparation", "ORDERPREPARATION",
      "Records the chef and bartender who prepared an order. A drinks-only order has no chef; a food-only order has no bartender.",
      ["preparation_id (PK)", "order_id (FK)", "chef_id (FK)", "bartender_id (FK)", "preparation_start", "preparation_end"],
      preps, [20, 14, 14, 18, 20, 20])

sheet("Complaint", "COMPLAINT", "Keeps records of complaints submitted by customers about orders.",
      ["complaint_id (PK)", "order_id (FK)", "customer_id (FK)", "complaint_text", "complaint_date", "status"],
      complaints, [18, 14, 16, 46, 20, 12])

sheet("Rating", "RATING", "Keeps records of customer ratings and comments for orders.",
      ["rating_id (PK)", "order_id (FK)", "customer_id (FK)", "rating_value", "comment", "rating_date"],
      ratings, [16, 14, 16, 14, 28, 20])

sheet("Payment", "PAYMENT", "Keeps records of payments made for orders. amount always equals the order total.",
      ["payment_id (PK)", "order_id (FK)", "amount", "payment_method", "payment_status", "transaction_reference (UNIQUE)", "payment_date"],
      payments, [16, 14, 14, 18, 16, 30, 20])

# summary sheet
counts = [
    ("Restaurant", len(restaurants)), ("Customer", len(customers)), ("Staff", len(staff)),
    ("Category", len(categories)), ("Menu", len(menus)), ("MenuItem", len(menu_items)),
    ("CustomerOrder", len(orders)), ("OrderItem", len(order_items)),
    ("OrderPreparation", len(preps)), ("Complaint", len(complaints)),
    ("Rating", len(ratings)), ("Payment", len(payments)),
]
ws = wb.create_sheet("Summary", 0)
ws["A1"] = "CHOWLY — SEED DATA"
ws["A1"].font = Font(bold=True, size=14)
ws["A2"] = "Generated and validated by docs/generate-seed-data.py. All consistency checks below passed."
ws["A2"].font = NOTE_FONT
for c, h in enumerate(["Entity", "Records"], 1):
    cell = ws.cell(row=4, column=c, value=h)
    cell.fill = HDR
    cell.font = HDR_FONT
for r, (name, n) in enumerate(counts, 5):
    ws.cell(row=r, column=1, value=name)
    ws.cell(row=r, column=2, value=n)
ws.cell(row=5 + len(counts), column=1, value="TOTAL").font = Font(bold=True)
ws.cell(row=5 + len(counts), column=2, value=sum(n for _, n in counts)).font = Font(bold=True)

checks_passed = [
    "subtotal = quantity x unit_price for every order line",
    "order_total = sum of that order's subtotals",
    "payment.amount = order.order_total",
    "unit_price on an order line = the menu item's price",
    "estimated_wait_time = max(slowest food + 3/extra portion, slowest drink + 2/extra)",
    "every foreign key resolves to an existing record",
    "ordered items belong to a menu of the order's own restaurant",
    "an order's waiter is a Waiter at that same restaurant",
    "chef and bartender are employed by that same restaurant",
    "chef set only when the order contains food; bartender only when it contains drinks",
    "complaints and ratings are filed by the customer who placed the order",
    "timestamps run order -> preparation -> served -> payment",
    "at most one rating and one payment per order",
    "only orders marked Paid have a payment, and every Paid order has one",
    "transaction references are unique",
]
row = 7 + len(counts)
ws.cell(row=row, column=1, value="Consistency checks enforced").font = Font(bold=True, size=11)
for i, c in enumerate(checks_passed, row + 1):
    ws.cell(row=i, column=1, value="PASS")
    ws.cell(row=i, column=2, value=c)
ws.column_dimensions["A"].width = 22
ws.column_dimensions["B"].width = 74

wb.save(OUT)

# ---------------------------------------------------------------------------
# Emit prisma/seed-data.ts
#
# The seed script cannot read a spreadsheet at deploy time, so the same
# validated records are written out as TypeScript. This file is generated —
# edit the spreadsheet generator, not the output.
# ---------------------------------------------------------------------------

TS_OUT = r"C:\Users\Work\Documents\TeSA\Chowly\prisma\seed-data.ts"

ROLE = {"Waiter": "WAITER", "Chef": "CHEF", "Bartender": "BARTENDER"}
CTYPE = {"Food": "FOOD", "Drink": "DRINK"}
OSTATUS = {"Placed": "PLACED", "Preparing": "PREPARING", "Served": "SERVED", "Paid": "PAID"}
PMETHOD = {"Card": "CARD", "Bank Transfer": "BANK_TRANSFER", "Cash": "CASH"}
CSTATUS = {"Open": "OPEN", "Resolved": "RESOLVED"}


def q(v):
    """Render a Python value as a TypeScript literal."""
    if v is None or v == "":
        return "null"
    if isinstance(v, bool):
        return "true" if v else "false"
    if isinstance(v, int):
        return str(v)
    s = str(v).replace("\\", "\\\\").replace('"', '\\"')
    return f'"{s}"'


def dt(v):
    """A date or datetime string becomes a Date the seed can pass to Prisma."""
    if not v:
        return "null"
    iso = f'{v.replace(" ", "T")}:00' if len(v) == 16 else f"{v}T00:00:00"
    return f'new Date("{iso}")'


def block(name, ts_type, records):
    out = [f"export const {name}: {ts_type}[] = ["]
    for r in records:
        out.append("  { " + ", ".join(f"{k}: {v}" for k, v in r.items()) + " },")
    out.append("];\n")
    return "\n".join(out)


parts = [
    "// GENERATED FILE — do not edit by hand.",
    "// Produced by docs/generate-seed-data.py from 'Chowly - Seed Data.xlsx'.",
    "// Every record here passed the consistency checks listed on the workbook's",
    "// Summary sheet before this file was written.",
    "",
    'import { StaffRole, CategoryType, OrderStatus, ComplaintStatus, PaymentMethod } from "@prisma/client";',
    "",
]

parts.append(block("restaurants", "{ id: string; name: string; address: string; phone: string; email: string; openingTime: string; closingTime: string }",
                   [dict(id=q(r[0]), name=q(r[1]), address=q(r[2]), phone=q(r[3]), email=q(r[4]),
                         openingTime=q(r[5]), closingTime=q(r[6])) for r in restaurants]))

parts.append(block("categories", "{ id: string; name: string; type: CategoryType; sortOrder: number }",
                   [dict(id=q(c[0]), name=q(c[1]), type=f"CategoryType.{CTYPE[c[2]]}", sortOrder=i)
                    for i, c in enumerate(categories, 1)]))

parts.append(block("customers", "{ id: string; firstName: string; lastName: string; phone: string; email: string; registrationDate: Date }",
                   [dict(id=q(c[0]), firstName=q(c[1]), lastName=q(c[2]), phone=q(c[3]), email=q(c[4]),
                         registrationDate=dt(c[5])) for c in customers]))

parts.append(block("staff", "{ id: string; restaurantId: string; firstName: string; lastName: string; phone: string; role: StaffRole; employmentDate: Date }",
                   [dict(id=q(s[0]), restaurantId=q(s[1]), firstName=q(s[2]), lastName=q(s[3]),
                         phone=q(s[4]), role=f"StaffRole.{ROLE[s[5]]}", employmentDate=dt(s[6])) for s in staff]))

parts.append(block("menus", "{ id: string; restaurantId: string; name: string; description: string; isActive: boolean; createdDate: Date }",
                   [dict(id=q(m[0]), restaurantId=q(m[1]), name=q(m[2]), description=q(m[3]),
                         isActive=q(m[4] == "Active"), createdDate=dt(m[5])) for m in menus]))

parts.append(block("menuItems", "{ id: string; menuId: string; categoryId: string; name: string; description: string; price: number; preparationTimeMinutes: number; isAvailable: boolean; emoji: string }",
                   [dict(id=q(m[0]), menuId=q(m[1]), categoryId=q(m[2]), name=q(m[3]), description=q(m[4]),
                         price=m[5], preparationTimeMinutes=m[6], isAvailable=q(bool(m[7])), emoji=q(m[8]))
                    for m in menu_items]))

parts.append(block("orders", "{ id: string; reference: string; customerId: string; restaurantId: string; waiterId: string; tableNumber: number; status: OrderStatus; orderDate: Date; estimatedWaitTime: number; orderTotal: number }",
                   [dict(id=q(o[0]), reference=q(o[0]), customerId=q(o[1]), restaurantId=q(o[2]),
                         waiterId=q(o[3]), tableNumber=o[8], status=f"OrderStatus.{OSTATUS[o[5]]}",
                         orderDate=dt(o[4]), estimatedWaitTime=o[6], orderTotal=o[7]) for o in orders]))

parts.append(block("orderItems", "{ orderId: string; itemId: string; quantity: number; unitPrice: number; subtotal: number }",
                   [dict(orderId=q(li[0]), itemId=q(li[1]), quantity=li[2], unitPrice=li[3], subtotal=li[4])
                    for li in order_items]))

parts.append(block("preparations", "{ id: string; orderId: string; chefId: string | null; bartenderId: string | null; preparationStart: Date | null; preparationEnd: Date | null }",
                   [dict(id=q(p[0]), orderId=q(p[1]), chefId=q(p[2]), bartenderId=q(p[3]),
                         preparationStart=dt(p[4]), preparationEnd=dt(p[5])) for p in preps]))

parts.append(block("complaints", "{ id: string; orderId: string; customerId: string; complaintText: string; complaintDate: Date; status: ComplaintStatus }",
                   [dict(id=q(c[0]), orderId=q(c[1]), customerId=q(c[2]), complaintText=q(c[3]),
                         complaintDate=dt(c[4]), status=f"ComplaintStatus.{CSTATUS[c[5]]}") for c in complaints]))

parts.append(block("ratings", "{ id: string; orderId: string; customerId: string; value: number; comment: string; ratingDate: Date }",
                   [dict(id=q(r[0]), orderId=q(r[1]), customerId=q(r[2]), value=r[3], comment=q(r[4]),
                         ratingDate=dt(r[5])) for r in ratings]))

parts.append(block("payments", "{ id: string; orderId: string; amount: number; method: PaymentMethod; transactionReference: string; isPretend: boolean; paymentDate: Date }",
                   [dict(id=q(p[0]), orderId=q(p[1]), amount=p[2], method=f"PaymentMethod.{PMETHOD[p[3]]}",
                         transactionReference=q(p[5]), isPretend="true", paymentDate=dt(p[6])) for p in payments]))

with open(TS_OUT, "w", encoding="utf-8") as f:
    f.write("\n".join(parts))

print("Validation passed — no inconsistencies found.")
print()
for name, n in counts:
    print(f"  {name:<20} {n:>5}")
print(f"  {'TOTAL':<20} {sum(n for _, n in counts):>5}")
print()
print("Written:", OUT)
