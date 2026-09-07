const {
  Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType,
  Table, TableRow, TableCell, WidthType, ShadingType, BorderStyle,
  LevelFormat, PageBreak,
} = require("docx");
const fs = require("fs");

// ---------- palette ----------
const ACCENT = "C00000";
const INK = "1A1A1A";
const MUTED = "5F6368";
const RULE = "D9D9D9";
const HDR_BG = "1A1A1A";
const OPEN_BG = "FDECEA";
const DONE_BG = "E8F5E9";
const WIP_BG = "FFF4E5";
const ZEBRA = "F7F7F7";

const W = 9026; // usable A4 width at 1" margins, in DXA

// ---------- helpers ----------
const P = (text, opts = {}) =>
  new Paragraph({
    spacing: { after: opts.after ?? 120, line: 276 },
    alignment: opts.align,
    children: [
      new TextRun({
        text,
        bold: opts.bold,
        italics: opts.italic,
        color: opts.color ?? INK,
        size: opts.size ?? 21, // half-points → 10.5pt
        font: "Calibri",
      }),
    ],
  });

const Runs = (runs, opts = {}) =>
  new Paragraph({
    spacing: { after: opts.after ?? 120, line: 276 },
    children: runs.map(
      (r) =>
        new TextRun({
          text: r.t,
          bold: r.b,
          italics: r.i,
          color: r.c ?? INK,
          size: r.s ?? 21,
          font: "Calibri",
        })
    ),
  });

const H1 = (text) =>
  new Paragraph({
    heading: HeadingLevel.HEADING_1,
    spacing: { before: 360, after: 160 },
    border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: ACCENT, space: 6 } },
    children: [new TextRun({ text, bold: true, color: INK, size: 28, font: "Calibri" })],
  });

const H2 = (text) =>
  new Paragraph({
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 260, after: 120 },
    children: [new TextRun({ text, bold: true, color: ACCENT, size: 23, font: "Calibri" })],
  });

const Bullet = (text) =>
  new Paragraph({
    numbering: { reference: "bullets", level: 0 },
    spacing: { after: 80, line: 276 },
    children: [new TextRun({ text, size: 21, color: INK, font: "Calibri" })],
  });

/**
 * A numbered step, for the walkthrough in section 7. Each group of steps passes
 * its own instance so that the three lists number 1, 2, 3 independently rather
 * than running on from one another.
 */
const Step = (text, instance = 0) =>
  new Paragraph({
    numbering: { reference: "steps", level: 0, instance },
    spacing: { after: 80, line: 276 },
    children: [new TextRun({ text, size: 21, color: INK, font: "Calibri" })],
  });

const Note = (text) =>
  new Paragraph({
    spacing: { before: 100, after: 160, line: 276 },
    indent: { left: 200 },
    border: { left: { style: BorderStyle.SINGLE, size: 12, color: ACCENT, space: 8 } },
    children: [new TextRun({ text, italics: true, size: 20, color: MUTED, font: "Calibri" })],
  });

const Cell = (text, { widths, bold, bg, color, size, align } = {}) =>
  new TableCell({
    width: { size: widths, type: WidthType.DXA },
    shading: bg ? { type: ShadingType.CLEAR, fill: bg, color: "auto" } : undefined,
    margins: { top: 80, bottom: 80, left: 120, right: 120 },
    children: (Array.isArray(text) ? text : [text]).map(
      (t) =>
        new Paragraph({
          alignment: align,
          spacing: { after: 0, line: 260 },
          children: [
            new TextRun({
              text: String(t),
              bold,
              color: color ?? INK,
              size: size ?? 19,
              font: "Calibri",
            }),
          ],
        })
    ),
  });

/** rows: array of arrays. cols: array of DXA widths summing to W. */
const Tbl = (cols, header, rows, opts = {}) =>
  new Table({
    columnWidths: cols,
    width: { size: cols.reduce((a, b) => a + b, 0), type: WidthType.DXA },
    borders: {
      top: { style: BorderStyle.SINGLE, size: 2, color: RULE },
      bottom: { style: BorderStyle.SINGLE, size: 2, color: RULE },
      left: { style: BorderStyle.SINGLE, size: 2, color: RULE },
      right: { style: BorderStyle.SINGLE, size: 2, color: RULE },
      insideHorizontal: { style: BorderStyle.SINGLE, size: 2, color: RULE },
      insideVertical: { style: BorderStyle.SINGLE, size: 2, color: RULE },
    },
    rows: [
      new TableRow({
        tableHeader: true,
        children: header.map((h, i) =>
          Cell(h, { widths: cols[i], bold: true, bg: HDR_BG, color: "FFFFFF", size: 19 })
        ),
      }),
      ...rows.map((r, ri) =>
        new TableRow({
          children: r.map((c, i) => {
            const isStatus = opts.statusCol === i;
            let bg = ri % 2 === 1 ? ZEBRA : undefined;
            if (isStatus) {
              const v = String(c).toLowerCase();
              if (v.includes("done") || v.includes("complete")) bg = DONE_BG;
              else if (v.includes("progress")) bg = WIP_BG;
              else if (v.includes("open") || v.includes("await") || v.includes("not started")) bg = OPEN_BG;
            }
            return Cell(c, { widths: cols[i], bg, bold: opts.boldCol === i });
          }),
        })
      ),
    ],
  });

const Spacer = (h = 120) => new Paragraph({ spacing: { after: h }, children: [] });

// ---------- content ----------
const children = [];

// Title block
children.push(
  new Paragraph({
    spacing: { after: 40 },
    children: [new TextRun({ text: "CHOWLY", bold: true, size: 56, color: INK, font: "Calibri" })],
  }),
  new Paragraph({
    spacing: { after: 60 },
    children: [
      new TextRun({ text: "Project & Build Log", size: 32, color: ACCENT, font: "Calibri" }),
    ],
  }),
  new Paragraph({
    spacing: { after: 240 },
    border: { bottom: { style: BorderStyle.SINGLE, size: 12, color: ACCENT, space: 8 } },
    children: [],
  })
);

children.push(
  Tbl(
    [2200, 6826],
    ["Field", "Value"],
    [
      ["Assignment", "TeSA Africa — Assignment: Chowly (Build)"],
      ["Prepared by", "Tobi Akinola"],
      ["Builds on", "Assignment 1 — Chowly engineered data model (Software Architecture assignment.xlsx)"],
      ["Document started", "5 September 2026"],
      ["Last updated", "7 September 2026"],
      ["Live application", "https://chowly-red.vercel.app"],
      ["Repository", "https://github.com/Thatguy-tobi/Chowly"],
      ["Status", "Built, deployed and verified against the live database"],
    ]
  )
);

// 1. About
children.push(H1("1. About this document"));
children.push(
  P(
    "This is a living log of the Chowly build. It is written as the work happens rather than reconstructed afterwards, so that every decision is recorded next to the reason it was made and the date it was made on."
  )
);
children.push(
  P("The assignment requires a document covering four things. This is where each of them lives:")
);
children.push(
  Tbl(
    [4200, 4826],
    ["Required by the brief", "Covered in"],
    [
      ["How you built it — stack, structure, final data model, deployment", "Section 3, with every change justified in Section 4"],
      ["How you used AI — tools, what you asked, accepted, rejected, corrected", "Section 5"],
      ["Specific behaviour of the application, from menu to payment", "Section 6"],
      ["How to use it — a walkthrough a stranger can follow", "Section 7"],
    ]
  )
);
children.push(
  Note(
    "Sections 3, 6 and 7 were written as each part was actually built rather than in advance, which is why section 4 records faults found along the way as well as decisions taken. Everything described here has been exercised on the deployed site."
  )
);

// 2. Requirement tracker
children.push(H1("2. Requirement tracker"));
children.push(
  P(
    "The eight functional requirements and three deliverables from the brief, and where each one stands. Every requirement below was checked by carrying it out on the deployed site — not on a development machine — and the resulting record was then read back out of the database and compared field by field with what the screens had shown."
  )
);
children.push(
  Tbl(
    [600, 5026, 3400],
    ["#", "Requirement", "Status"],
    [
      ["1", "The menu — food and drinks loaded into the database, each item carrying a name, a price and a preparation time", "Done — 236 items across 12 restaurants"],
      ["2", "Placing an order — customer selects items, submits, and is shown the order details and waiting time", "Done — ORD048, ₦16,300, quoted 33 min"],
      ["3", "Assigning the order — waiter opens an order, records the chef and bartender, marks it served", "Done — chef and bartender recorded, then served"],
      ["4", "Complaint and rating — both stored against the order", "Done — 4★ with comment, plus a complaint"],
      ["5", "Payment — a button that records payment and marks the order paid, clearly labelled as pretend", "Done — recorded with is_pretend set"],
      ["6", "The two roles — a simple switch between customer and waiter, no login", "Done — switched both ways mid-order"],
      ["7", "Real storage — everything survives a page refresh", "Done — survived a full page reload"],
      ["8", "A live link — deployed and usable by anybody with the URL", "Done — chowly-red.vercel.app"],
      ["D1", "Git repository, accessible to facilitators, commit history showing the work as it was done", "Done — public, github.com/Thatguy-tobi/Chowly"],
      ["D2", "URL of the deployed application", "Done — recorded in section 3.4"],
      ["D3", "This document", "Done — sections 6 and 7 completed after deployment"],
    ],
    { statusCol: 2, boldCol: 0 }
  )
);

// 3. How it was built
children.push(H1("3. How it was built"));

children.push(H2("3.1  The stack"));
children.push(
  Runs([
    { t: "Chosen: ", b: true },
    {
      t: "Next.js (React) with TypeScript, Prisma as the ORM, and PostgreSQL — deployed on Vercel with the database hosted on Neon.",
      b: true,
    },
  ], { after: 100 })
);
children.push(
  P(
    "The brief awards no marks for the stack itself, only for the solution it produces, so the candidates below were compared on how much friction each one puts between the code and a working live link. Three reasons decided it."
  )
);
children.push(
  P(
    "First, the deliverables require a live link that opens and works for anybody who has it. A single Next.js application carries both the user interface and the API in one codebase, so there is one thing to deploy and one thing that can fail, rather than a frontend and a backend that must both be alive and correctly pointed at each other."
  )
);
children.push(
  P(
    "Second, Render was considered as the alternative and rejected on its free tier. Free Render services are suspended when idle and take close to a minute to wake, and its free Postgres instance is time-limited. Both of those put the marked link at risk of being slow or dead at exactly the moment a facilitator opens it, which is the one failure this project cannot afford. Vercel does not sleep, and while Neon suspends database compute when idle it resumes in about a second — a materially different risk."
  )
);
children.push(
  P(
    "Third, and deliberately, I had not worked with Prisma before and wanted to learn how a schema-first ORM handles migrations and relationships in practice. Its schema file is close to a direct transcription of the model submitted for Assignment 1, which means the database the application actually runs on can be shown to correspond to the model that was designed for it — so the choice serves the assignment as well as the curiosity."
  )
);
children.push(
  Tbl(
    [2400, 3313, 3313],
    ["Candidate", "Benefit", "Cost"],
    [
      ["Next.js (React) + Prisma + Postgres", "One codebase, one deploy. Prisma schema maps almost 1:1 onto the Assignment 1 model. No CORS. Most time left over for design polish.", "TypeScript throughout; React server/client component rules take some getting used to."],
      ["React (Vite) + Flask + Postgres", "Clean frontend/backend separation. Python backend with SQLAlchemy models that read like the submitted entities. API is inspectable as raw JSON.", "Two deployments to set up and keep alive, CORS configuration, two dependency sets. Free Python hosts sleep when idle."],
      ["Flask alone with Jinja templates", "Simplest thing that satisfies every requirement. One deploy, one language, no build step.", "Cart and live countdown need hand-written JavaScript. Lower ceiling on the design bonus."],
      ["Django + Postgres", "The admin panel gives staff and menu management for free, which reads as work beyond the requirements.", "Heavier to configure. Same template polish ceiling unless React is added on top."],
    ]
  )
);

children.push(H2("3.2  Project structure"));
children.push(
  P(
    "One Next.js application holds both the interface and the API, so there is a single thing to deploy and a single thing that can fail. Pages are React components that run in the browser; the API routes beside them run on the server and are the only code that touches the database."
  )
);
children.push(
  Tbl(
    [2600, 6426],
    ["Folder", "What is in it"],
    [
      ["prisma/", "The schema, the migration, the seed data and seed script, and verify.ts — which reads the database back and checks every rule independently of the code that wrote it"],
      ["src/app/", "One folder per page (menu, cart, orders, waiter) and src/app/api for the endpoints"],
      ["src/components/", "The header carrying the customer / waiter switch, the order progress display, and the small shared pieces every screen is built from"],
      ["src/lib/", "The database client, the browser-held session and basket, the waiting-time calculation, and the validation applied to every request body"],
      ["docs/", "The generator that produces the seed spreadsheet and seed data together, and the source of this document"],
    ],
    { boldCol: 0 }
  )
);
children.push(
  P(
    "Two rules shape where code lives. Anything that decides money or time — prices, totals, the estimated wait — is computed on the server from the database, never accepted from the browser. And the waiting-time calculation exists in exactly two places that are kept deliberately identical: src/lib/wait-time.ts for live orders and docs/generate-seed-data.py for seeded ones, so that both are quoted on the same rules and the sample data cannot contradict the application."
  )
);

children.push(H2("3.3  The data model"));
children.push(
  P(
    "The build sits on top of the model produced for Assignment 1. That model has twelve entities, reproduced below with the purpose recorded for each."
  )
);
children.push(
  Tbl(
    [1900, 3400, 3726],
    ["Entity", "Purpose", "Key attributes"],
    [
      ["Restaurant", "Keeps records of restaurants using Chowly", "restaurant_id (PK), name, address, phone, email, opening_time, closing_time"],
      ["Customer", "Keeps records of customers who visit and use Chowly", "customer_id (PK), first_name, last_name, phone, email, registration_date"],
      ["Staff", "Keeps records of employees — waiters, chefs, bartenders", "staff_id (PK), restaurant_id (FK), first_name, last_name, phone, role, employment_date"],
      ["Category", "Classifies menu items as food or drink", "category_id (PK), category_name, category_type"],
      ["Menu", "Keeps records of restaurant menus", "menu_id (PK), restaurant_id (FK), menu_name, description, status, created_date"],
      ["MenuItem", "Keeps records of individual food and drink items", "item_id (PK), menu_id (FK), category_id (FK), item_name, description, price, availability"],
      ["CustomerOrder", "Keeps records of orders placed by customers", "order_id (PK), customer_id (FK), restaurant_id (FK), waiter_id (FK), order_date, status, estimated_wait_time, order_total"],
      ["OrderItem", "Bridge entity resolving the M-M between orders and menu items", "order_id (PK+FK), item_id (PK+FK), quantity, unit_price, subtotal"],
      ["OrderPreparation", "Records the chef and bartender who prepared an order", "preparation_id (PK), order_id (FK), chef_id (FK), bartender_id (FK), preparation_start, preparation_end"],
      ["Complaint", "Keeps records of complaints submitted about orders", "complaint_id (PK), order_id (FK), customer_id (FK), complaint_text, complaint_date, status"],
      ["Rating", "Keeps records of customer ratings and comments for orders", "rating_id (PK), order_id (FK), customer_id (FK), rating_value, comment, rating_date"],
      ["Payment", "Keeps records of payments made for orders", "payment_id (PK), order_id (FK), amount, payment_method, payment_status, transaction_reference (UNIQUE), payment_date"],
    ],
    { boldCol: 0 }
  )
);
children.push(Spacer(120));
children.push(
  Tbl(
    [1100, 3200, 4726],
    ["#", "Entity", "How the implemented model differs"],
    [
      ["001", "MenuItem", "preparation_time_minutes added — the brief requires it and the quoted wait is derived from it"],
      ["006", "CustomerOrder", "table_number added — without a login it is the only thing that says where to take the food"],
      ["007", "CustomerOrder", "status became a fixed set of four values instead of free text"],
      ["008", "OrderPreparation", "chef and bartender are each optional, but at least one is required"],
      ["009", "OrderPreparation, Rating, Payment", "order_id made unique, enforcing the 1:1 and 1:0..1 the model declares"],
      ["010", "Payment", "is_pretend added, so the simulation is recorded in the data and not only on screen"],
      ["011", "Restaurant", "opening and closing times stored as times of day, not timestamps"],
      ["012", "Customer", "surname, phone and email made optional — nobody logs in to supply them"],
      ["013", "Menu", "status became a boolean, is_active"],
      ["014", "MenuItem", "emoji added, presentation only"],
      ["015", "CustomerOrder", "reference added — a short readable code such as ORD048"],
      ["022", "CustomerOrder", "served_at added — the moment the order reached the table, which everything about punctuality is measured from"],
    ],
    { boldCol: 0 }
  )
);
children.push(Spacer(160));
children.push(
  Note(
    "The brief says: where the build forces a change to the model, make the change and say why. All twelve entities above were implemented as designed; the differences are listed below and each one is justified in section 4. Every deviation is also marked in prisma/schema.prisma with the same change number, so the schema and this document can be read against each other."
  )
);

children.push(H2("3.4  Deployment"));
children.push(
  Runs([
    { t: "Target: ", b: true },
    { t: "Vercel for the application, Neon for the PostgreSQL database. ", b: true },
    { t: "Live at https://chowly-red.vercel.app, from https://github.com/Thatguy-tobi/Chowly." },
  ])
);
children.push(
  P(
    "The procedure, as actually carried out: the repository was pushed to GitHub and imported into Vercel, which detected Next.js without any configuration. The two Neon connection strings were entered as environment variables before the first build rather than after — a missing DIRECT_URL fails the build outright, because migrations cannot run through the pooler. Vercel offers to provision a database during import; that was declined, since doing so would have created an empty one and overwritten the connection strings pointing at the database already holding the data. The build runs prisma migrate deploy before next build, so the schema is brought up to date on every deployment, and prisma generate is bound to the install step so the generated client cannot go stale against Vercel's dependency cache."
  )
);
children.push(
  P(
    "The deployment was then verified by walking the whole assignment on the live site rather than by trusting that the build succeeded: an order was placed as a customer (ORD048, ₦16,300, quoted 33 minutes), prepared and served as the waiter, then rated, complained about and paid for as the customer again. The stored record was read back from the database and checked field by field against what the screens had shown."
  )
);
children.push(
  P(
    "The repository is pushed to GitHub and imported into Vercel, which redeploys automatically on every push — so the commit history and the live link stay in step with each other. Two connection strings are held as environment variables: a pooled one used by the running application, and a direct one used for migrations."
  )
);
children.push(
  P(
    "That split is not decoration. Vercel runs the API routes as serverless functions, and each invocation can open its own database connection, which exhausts the connection limit quickly. Neon's pooled endpoint sits in front of the database to absorb that, while schema migrations need the direct endpoint because they cannot run through the pooler. Prisma is configured with both, and 'prisma generate' is bound to the install step so that the generated client cannot go stale against Vercel's dependency cache."
  )
);

// 4. Decision & change log
children.push(H1("4. Decision and change log"));
children.push(
  P(
    "Every change to the model or to the shape of the application, with the reason for it. Nothing was written up until the reason for it was confirmed rather than guessed, which is why several entries were left open for days before being completed. Entries 018, 019 and 021 record faults rather than decisions: the brief asks for an honest history, and a log showing only good choices would not be one."
  )
);
children.push(
  Tbl(
    [700, 1100, 2400, 3626, 1200],
    ["#", "Date", "Change", "Reason", "Status"],
    [
      [
        "001",
        "5 Sep 2026",
        "Add preparation_time to MenuItem",
        "The brief states that each menu item carries a name, a price and a preparation time. The submitted model gives MenuItem a name, description, price, category and availability, but no preparation time. Without it the estimated waiting time shown to the customer — requirement 2 — cannot be derived from the order, so the column is required rather than optional.",
        "Confirmed",
      ],
      [
        "002",
        "6 Sep 2026",
        "Stack: Next.js (React) + Prisma + PostgreSQL",
        "One codebase carries both the interface and the API, so there is a single thing to deploy and a single thing that can fail — and the deliverables stand or fall on a live link that opens and works. Prisma was chosen partly because its schema is close to a direct transcription of the Assignment 1 model, and partly as a deliberate decision to learn how a schema-first ORM handles migrations and relationships. Set out in full in section 3.1.",
        "Confirmed",
      ],
      [
        "003",
        "6 Sep 2026",
        "Hosting: Vercel for the application, Neon for the database",
        "Render was considered and rejected: its free services are suspended when idle and take close to a minute to wake, and its free Postgres is time-limited, which risks the marked link being slow or dead when a facilitator opens it. Vercel does not sleep; Neon suspends database compute when idle but resumes in about a second. Both are free and neither requires a card.",
        "Confirmed",
      ],
      [
        "004",
        "6 Sep 2026",
        "Customer identified by name and table number typed on entry; table_number added to CustomerOrder",
        "The brief requires no login, but an order must still belong to a Customer, and a waiter must know which table to carry the food to — the submitted model records who ordered but not where they are sitting. On entry the customer gives a name and a table number, a Customer record is found or created, and the identity is held in the browser so that a refresh keeps the same customer and their orders, which is what requirement 7 asks for.",
        "Confirmed",
      ],
      [
        "005",
        "6 Sep 2026",
        "The application serves all twelve seeded restaurants, not one",
        "The submitted model supports many restaurants, and restricting the interface to one would have left the Restaurant–Menu–MenuItem and Restaurant–Staff relationships in the database but unreachable — decorative rather than exercised. Serving all twelve proves those relationships work against real data rather than against one hardcoded case, and gives anyone marking the work twelve menus to open instead of one. The cost is the restaurant switcher in the header, which is additional surface area to get right; change 019 records a defect it caused.",
        "Confirmed",
      ],
      [
        "006",
        "6 Sep 2026",
        "Add table_number to CustomerOrder",
        "The schema half of decision 004. The submitted model records who ordered but not where they are sitting, and without a login the table number is the only thing that tells a waiter where to carry the food. Required rather than optional: an order that cannot be delivered is not an order.",
        "Confirmed",
      ],
      [
        "007",
        "6 Sep 2026",
        "Order status becomes a fixed enum: PLACED, PREPARING, SERVED, PAID",
        "The submitted model held a free-text status showing values such as “Preparing” and “Completed”. Free text allows two spellings of the same state and gives the application nothing to check against. The lifecycle the brief describes is fixed — an order is placed, a waiter records who prepared it, it is served, and it is paid for on the way out — so the database rejects anything outside that list, and the API can refuse illegal jumps such as serving an order nobody has prepared.",
        "Confirmed",
      ],
      [
        "008",
        "6 Sep 2026",
        "chef_id and bartender_id on OrderPreparation are both optional",
        "An order of drinks only has no chef, and an order of food only has no bartender. Requiring both would force the waiter to name someone who did no work, which puts false data in the table to satisfy a constraint. Requirement 4 is still met: the API refuses a preparation record naming neither, so at least one real person is always recorded.",
        "Confirmed",
      ],
      [
        "009",
        "6 Sep 2026",
        "Unique constraint on order_id in OrderPreparation, Rating and Payment",
        "The Relationships sheet of the submitted model declares these as 1:1, 1:0..1 and 1:1. Without a unique constraint the database would happily accept two preparation records for one order, several ratings of the same meal, or a second payment against an order already settled. The declared cardinality is enforced by the database rather than trusted to the application, so a bug in the API cannot corrupt the data behind it.",
        "Confirmed",
      ],
      [
        "010",
        "6 Sep 2026",
        "is_pretend flag added to Payment",
        "Requirement 5 allows the payment to be pretend but requires it to be recorded and clearly labelled as such. Holding the flag on the record rather than only wording it in the interface means the label survives in the data: anyone reading the payments table later can see that no money moved, without having to know how the screen was worded.",
        "Confirmed",
      ],
      [
        "011",
        "6 Sep 2026",
        "opening_time and closing_time stored as “HH:mm” text, not timestamps",
        "They describe a time of day that repeats every day, not a moment in time. Storing them as timestamps would attach a date and a timezone to something that has neither, which invites timezone bugs — a restaurant appearing to close at 22:00 in one place and 23:00 in another — for no benefit.",
        "Confirmed",
      ],
      [
        "012",
        "6 Sep 2026",
        "Surname, phone and email on Customer made optional",
        "There is no login, by requirement 6. A customer sitting at a table gives a first name and a table number and nothing else, so requiring the remaining fields would mean inventing data nobody entered. The columns are kept because the submitted model has them and a restaurant may later collect them.",
        "Confirmed",
      ],
      [
        "013",
        "6 Sep 2026",
        "Menu status becomes a boolean is_active",
        "The submitted model held a text status whose only observed value was “Active”. A menu is either in use or it is not, and a boolean says that exactly while making a third value impossible to enter by mistake.",
        "Confirmed",
      ],
      [
        "014",
        "6 Sep 2026",
        "emoji added to MenuItem",
        "Presentation only — a small glyph beside each dish so the menu reads as a menu rather than a table of rows. Nothing in the application depends on it, and an item without one falls back to a generic symbol. Recorded here because it is a column that does not appear in the submitted model, not because it carries any logic.",
        "Confirmed",
      ],
      [
        "015",
        "6 Sep 2026",
        "reference added to CustomerOrder, e.g. “ORD047”",
        "The primary key is a cuid — a long random string nobody can read back across a noisy dining room. A short unique reference is what the customer sees on screen and what the waiter uses to identify the order out loud, and it can be looked up directly, so the customer's own order page has a shareable address.",
        "Confirmed",
      ],
      [
        "016",
        "6 Sep 2026",
        "Connection URLs moved out of schema.prisma into prisma.config.ts; the application connects through a driver adapter",
        "Forced by the tool, not chosen. Prisma 7 no longer accepts url and directUrl inside the datasource block, no longer loads .env automatically, and requires a driver adapter at runtime — here @prisma/adapter-neon over Neon's serverless driver. The migration URL now lives in prisma.config.ts and the running application builds its own connection. Section 5 records that this was reached by correcting advice that described the previous major version.",
        "Confirmed",
      ],
      [
        "017",
        "6 Sep 2026",
        "The session remembers a restaurant per role, not one restaurant overall",
        "My own requirement, from a case the first design could not answer: I might be a customer with a table at Mood Lagos and also work as a waiter at Terra Kulture, and switching roles should not throw away either. The session therefore holds the customer's restaurant and table alongside the waiter's restaurant independently, so moving the waiter somewhere else leaves my table where it is.",
        "Confirmed",
      ],
      [
        "018",
        "6 Sep 2026",
        "Waiting time is the slowest item plus a small allowance per extra portion, not the sum of every item",
        "The first version added every preparation time together and quoted 116 minutes for an ordinary table's order, which is wrong in a way arithmetic checks could not catch — the sums were correct, the model of the kitchen was not. A kitchen cooks several dishes at once, and the kitchen and the bar work in parallel. The estimate is now the slowest food item plus three minutes for each additional food portion, against the slowest drink plus two minutes for each additional drink, whichever of the two is longer. The same order now quotes 42 minutes, and across the seeded data the range is 6 to 55 minutes with an average of 25.",
        "Confirmed",
      ],
      [
        "019",
        "6 Sep 2026",
        "Changing restaurant returns the customer to the entry screen and empties the basket",
        "A defect found in testing, recorded because the brief asks for an honest history. Switching restaurant cleared the table number but left the customer inside a menu they could no longer order from, and the failure surfaced as a raw validation message — “expected number, received null”. A customer at a new restaurant is at a new table, so they now return to the entry screen to be seated, with that restaurant already selected. The basket goes with them: it held another kitchen's dishes, which this one cannot cook. Any basket whose restaurant no longer matches the session is treated as empty.",
        "Confirmed",
      ],
      [
        "020",
        "7 Sep 2026",
        "The repository is public",
        "Deliverable 1 is the repository itself, so it has to open for whoever is marking it. A private repository depends on every facilitator having been invited individually and having accepted, and if that fails the deliverable simply cannot be read. Public removes that dependency. Nothing in the repository is secret: the connection strings live in an untracked .env file, and .env.example carries only the shape of them.",
        "Confirmed",
      ],
      [
        "021",
        "7 Sep 2026",
        "Seeded dates are anchored to the day the data is generated, and orders still in flight are pulled to the present",
        "Nine orders were dated up to two days in the future, because the generator counted forward from a hardcoded 1 September that the calendar had since overtaken. Every arithmetic check passed over it: the rows were consistent with each other, just not with today. Two further faults surfaced from the same investigation — seven staff were employed months after orders they had already served, and four orders still in the kitchen carried customer ratings, one a two-star complaint about food that had not arrived. Orders that are still being prepared are now dated within the last hour, so the waiter's queue shows live work rather than tables that have supposedly waited a week. The generator and the verification script both refuse to accept any of these three faults again.",
        "Confirmed",
      ],
      [
        "022",
        "7 Sep 2026",
        "served_at added to CustomerOrder",
        "The submitted model has no field for the moment an order reached the table, and almost everything the brief asks to be judged depends on it: whether the wait beat the quote, and therefore whether a complaint is justified. Worse, the field existed in the schema but the seeded data never filled it, so the application measured the wait from the order to the present moment instead — a meal served days earlier was reported on screen as having taken 3832 minutes. It is null until the order is served and equal to the preparation end time afterwards, and both the generator and the verification script now reject a served order that lacks it.",
        "Confirmed",
      ],
      [
        "023",
        "7 Sep 2026",
        "The waiter can resolve a complaint, and reopen one",
        "Complaint.status existed in the model and was displayed to both the customer and the waiter as Open or Resolved, but nothing in the application could ever change it — every complaint raised on the live site would have stayed open forever. Requirement 4 is only half met by storing a complaint; somebody has to be able to act on it. Resolving is reversible, so one marked resolved in error can be put back.",
        "Confirmed",
      ],
      [
        "024",
        "7 Sep 2026",
        "A rating requires the order to have been served; a complaint does not",
        "The two had been governed by the same rule, and it was the wrong rule for both. A rating is a verdict on a meal, so it now needs the meal to have arrived — previously an order still in the kitchen could be scored. A complaint is the opposite: the delay the brief describes is felt while the customer is still waiting, so requiring the food to arrive first would refuse the complaint at the moment it is most justified. The mismatch was found because the verification script and the API disagreed, which would have made an ordinary customer action look like a data fault.",
        "Confirmed",
      ],
      [
        "025",
        "7 Sep 2026",
        "Muted text darkened to meet the contrast standard",
        "Measured rather than judged by eye. The muted colour used for timestamps, preparation times and hints scored 2.76:1 against the sunken background where the accessibility standard asks for 4.5:1, and failed on three of four backgrounds in light mode and two in dark. It appears on nearly every screen, so being decorative was no reason for it to be unreadable. Now 4.56:1 at worst. The success colour was also a fraction under and was darkened.",
        "Confirmed",
      ],
      [
        "026",
        "7 Sep 2026",
        "Menu search, and loading placeholders shaped like the content",
        "A restaurant here can carry thirty-four items and the platform holds two hundred and thirty-six, which is more than is reasonable to scroll. Searching spans food and drinks together, because somebody typing the name of a drink should find it without first knowing which tab it lives under. Separately, the spinners were replaced with outlines of the content that is coming: on the deployed site every query crosses to Frankfurt and back, which is long enough for a blank screen to look like a broken one.",
        "Confirmed",
      ],
      [
        "027",
        "7 Sep 2026",
        "A dashboard reporting how service is going",
        "Beyond the brief. Twelve entities are worth little if nothing ever reads across them, so this joins orders, items, staff, ratings, complaints and payments into figures a manager would actually ask for: takings against money still owed, actual waits against quoted ones, how many orders beat their quote, the spread of ratings, and the same broken down per restaurant. It is deliberately group-wide — around fifty orders across twelve restaurants means any single one is four rows and a lot of white space. It also earned its place immediately by exposing change 022.",
        "Confirmed",
      ],
      [
        "028",
        "7 Sep 2026",
        "An admin surface for registering restaurants, menus, items and staff",
        "Beyond the brief, which only requires a menu loaded by me — the seeded data already satisfies that. This is the only part of the application that creates Restaurant, Menu, MenuItem and Staff rather than reading what the seed produced, so it exercises the half of the model nothing else touches. It has no login, because the application has none by design; that is stated plainly on the page rather than hidden, and a real deployment would put it behind a staff sign-in.",
        "Confirmed",
      ],
      [
        "029",
        "7 Sep 2026",
        "A restaurant that cannot complete an order is not offered to customers",
        "Found by using the admin pages. The first restaurant registered through them had no staff, and placing an order assigns a waiter — so a customer could choose it, browse the menu, add dishes and only be refused at the checkout. The restaurant list now reports whether each one can actually trade, using the same test the order endpoint applies: at least one waiter, and at least one item available on an active menu. Those that cannot are shown as not taking orders yet, and the admin page says exactly what is missing.",
        "Confirmed",
      ],
      [
        "030",
        "7 Sep 2026",
        "Seeded orders are rebuilt rather than upserted",
        "The most serious fault found in the build, and it was in the seeding rather than the application. The script upserted everything and its own comment claimed that running it twice was harmless. It was not: regenerating the dataset changes which items belong to which order, and upserting wrote the new lines while leaving the previous ones in place, so nine orders ended up carrying both sets and their line items no longer added up to their totals. It reached the live database. It had survived four regenerations because the generated data was checked and the database after seeding was not. Seeded orders are now deleted and written again, which cascades to their items, preparation, complaints, ratings and payments; orders placed through the application have generated identifiers and are left alone.",
        "Confirmed",
      ],
      [
        "031",
        "7 Sep 2026",
        "Sample orders meant to be on time are actually on time, and 3-star ratings exist",
        "Two artefacts of the generator that the dashboard made visible. Orders not deliberately delayed were given a margin of minus four to plus three minutes, so about half of them drifted a minute or two past the quote and the group reported 14% served on time — a figure that reads as a broken application rather than as pessimistic sample data. Ratings were scored one to two after a complaint and four to five otherwise, which left a permanent gap in the middle of the chart that looked like a fault in the rating feature. Now 39% on time, and three stars occur. The remaining severity is genuine: at least twenty complaints across forty-five orders was the requirement, so roughly half of them go wrong by design, and the average rating follows from that rather than from a defect.",
        "Confirmed",
      ],
    ],
    { statusCol: 4, boldCol: 0 }
  )
);

// 5. AI usage
children.push(H1("5. How AI was used"));
children.push(
  P(
    "The brief requires AI to be used and requires that use to be demonstrable. This log records what was asked, what came back, and what was accepted, rejected or corrected. It is appended to as the work proceeds."
  )
);
children.push(
  Tbl(
    [1100, 1500, 3126, 1400, 1900],
    ["Date", "Tool", "What was asked", "Outcome", "Notes"],
    [
      [
        "5 Sep 2026",
        "Claude Code (Opus)",
        "Read both assignment briefs and the submitted Excel model, and extract the requirements, entities, attributes and relationships",
        "Accepted",
        "All twelve entities, their purposes and the eighteen relationships were extracted correctly and matched the spreadsheet.",
      ],
      [
        "5 Sep 2026",
        "Claude Code (Opus)",
        "Compare the submitted data model against the build requirements and identify anything missing",
        "Accepted",
        "Correctly identified that MenuItem has no preparation time despite the brief requiring one. Became change 001.",
      ],
      [
        "5 Sep 2026",
        "Claude Code (Opus)",
        "Compare candidate tech stacks against what the assignment actually rewards",
        "Accepted as analysis; decision deferred",
        "Useful framing, but the choice is mine to make and justify, so nothing was committed to on its recommendation alone.",
      ],
      [
        "5 Sep 2026",
        "Claude Code (Opus)",
        "Create and maintain this project log",
        "Accepted, with a constraint",
        "Instructed to record my reasons as I give them and to ask rather than invent a rationale it cannot verify — so that nothing in this document is a justification I cannot defend.",
      ],
      [
        "6 Sep 2026",
        "Claude Code (Opus)",
        "Recommend a cloud platform for the chosen stack, and explain what would go wrong on each option",
        "Accepted",
        "The warning about free tiers that sleep, and the two Prisma-on-serverless failure modes (connection pooling and a stale generated client), were specific enough to design around rather than debug later.",
      ],
      [
        "6 Sep 2026",
        "Claude Code (Opus)",
        "Propose reasons for choosing the stack, to be recorded in this document",
        "Rejected as offered; rewritten",
        "The suggested reasons were reasonable but were not mine. I supplied my own — the Render comparison and wanting to learn Prisma — and only those were written up.",
      ],
      [
        "6 Sep 2026",
        "Claude Code (Opus)",
        "Set up Prisma against the Neon database",
        "Incorrect; corrected against the documentation",
        "The setup steps given described Prisma 6. Prisma 7 rejected the schema outright (error P1012) because connection URLs are no longer allowed in the datasource block, and it no longer reads .env by itself. The error was the first sign that the guidance was out of date; the installed package's own documentation settled it. Became change 016.",
      ],
      [
        "6 Sep 2026",
        "Claude Code (Opus)",
        "Generate a consistent seed dataset from real Lagos restaurants and check its arithmetic",
        "Accepted after a fault was found by inspection",
        "Every total, subtotal and line price was arithmetically correct and the automated checks passed, but a sample order quoted a 116-minute wait because the formula added every preparation time together. Correct arithmetic on a wrong formula: the checks could not see it, and reading one order did. Became change 018.",
      ],
      [
        "6 Sep 2026",
        "Claude Code (Opus)",
        "Build the customer flow, then fix the error it produced when switching restaurant",
        "Accepted, after the fix was tested for the case that broke it",
        "The defect existed because the flow had only ever been walked straight through at a single restaurant. Testing the switch also exposed a second fault nobody had reported — the basket survived the move and still held the previous restaurant's dishes. Became change 019.",
      ],
      [
        "7 Sep 2026",
        "Claude Code (Opus)",
        "Check the interface against the accessibility standard",
        "Partly wrong, then measured",
        "It first reported that reduced-motion support and keyboard focus rings were missing. Both were already implemented — it had inferred their absence from one line of styling without opening the stylesheet. The contrast figures that followed were computed rather than judged, and those found four genuine failures.",
      ],
      [
        "7 Sep 2026",
        "Claude Code (Opus)",
        "Build a dashboard reporting waits, ratings and takings",
        "Accepted, and it exposed a fault",
        "The first figures it produced were an average wait of 231 minutes against 26 quoted, which was obviously wrong and turned out to be the application's fault rather than the dashboard's: served orders had never recorded when they were served. Became change 022.",
      ],
      [
        "7 Sep 2026",
        "Claude Code (Opus)",
        "Add an admin surface for restaurants, menus and items",
        "Accepted after a dead end was found by using it",
        "The first restaurant registered through it could not take an order, because placing one assigns a waiter and it had no staff — a customer could have browsed and chosen dishes only to be refused at the checkout. Fixed by making the restaurant list report whether each one can actually trade. Became changes 028 and 029.",
      ],
      [
        "7 Sep 2026",
        "Claude Code (Opus)",
        "Regenerate the sample data so the figures read sensibly",
        "Corrected after the database contradicted the file",
        "Nine orders came out with line items that did not add up to their totals. The generated data was correct; the seeding was not, because it upserted and left the previous version's rows in place. It had survived four regenerations because the file was being checked and the database after seeding was not. Became change 030 — the most serious fault in the build.",
      ],
    ]
  )
);

// 6. Behaviour
children.push(H1("6. What the application does, step by step"));
children.push(
  P(
    "The behaviour of every feature, following the story from a customer sitting down to a customer paying and leaving. Each subsection is written as that feature is built."
  )
);
[
  [
    "6.1  Menu browsing",
    "A customer opens the app at a table and views the food and drinks currently available.",
    [
      "The customer picks their restaurant, gives a first name and a table number, and is taken to that restaurant's menu. A Customer row is found or created at that point, so every order has a real customer behind it even though nobody logged in.",
      "The menu is fetched for that restaurant alone. Items that are unavailable, and menus that are not active, are excluded in the database query rather than fetched and then hidden, so an unavailable dish is never sent to the browser at all. Food and drinks are separated into two tabs, because somebody who wants a drink should not have to scroll past thirty dishes to find one.",
      "Every item shows its name, description, price in naira and preparation time. The preparation time is shown on each row deliberately rather than hidden away: it is what the quoted wait is built from, and it lets someone in a hurry see that a grilled croaker is 33 minutes and a Sprite is 3 before they commit to either.",
    ],
  ],
  [
    "6.2  Order placement",
    "A customer selects items and submits an order, and is shown the waiting time and the other details of that order.",
    [
      "Chosen items are held in the browser while the customer is still deciding, but nothing the browser says about them is trusted. When the order is submitted, the server re-reads every item from the database, confirms it is available on an active menu belonging to that restaurant, and prices it from that row. A browser claiming its own price is ignored; an item from another restaurant is refused outright.",
      "The total and the estimated wait are both computed on the server, so the figure the customer agreed to is the figure that is stored. The wait is not the sum of the preparation times — the kitchen and the bar work at the same time, and a kitchen does not cook two fish one after the other — so it is the slower of the two streams: the slowest food item plus three minutes for each extra food portion, against the slowest drink plus two minutes for each extra drink.",
      "A waiter is assigned immediately, the order is given a short readable reference such as ORD048, and the customer lands on the order page. That page shows the reference, the table, the four stages of the order, and a countdown against the quoted time which ticks every second and turns red once the quoted time has passed. It refreshes itself, so the waiter's actions appear without the customer touching anything.",
    ],
  ],
  [
    "6.3  Order assignment",
    "The order is assigned to a waiter, who records the chef and the bartender that prepared it and marks it served.",
    [
      "The waiter view lists that restaurant's orders with the work still outstanding at the top, oldest first — the table that has waited longest is the one most likely to complain. Orders that have been served but not paid sit below, and paid ones are folded away behind a toggle. Anything running past its quoted time is marked, and the queue refreshes on its own.",
      "Opening an order splits it into what the kitchen owes and what the bar owes, so the waiter knows who to chase, and states plainly how far past the quoted time it is running. The chef and the bartender are chosen from that restaurant's own staff, and only the roles the order actually needs are offered: a drinks-only order shows no chef, because there is no food for a chef to have cooked.",
      "Recording the pair writes the preparation record and moves the order to Preparing, which is what the customer sees change on their own screen. Marking it served is refused until that has happened — the button is disabled, and the server refuses it independently as well, so the step cannot be skipped from either direction. Serving stamps the finish time, which is what the order was ultimately judged against.",
    ],
  ],
  [
    "6.4  Complaint and rating",
    "Where an order is delayed, the customer submits a complaint and gives a low rating against that order.",
    [
      "Both are stored against the order itself rather than against the restaurant, so a complaint can always be traced to the meal, the table and the staff who handled it. Both are refused if they claim to come from a customer other than the one who placed the order.",
      "The two are deliberately governed by different rules. A rating is a verdict on a meal, so it is only accepted once the order has been served; the schema allows one rating per order, and rating again replaces the score rather than adding a second, because a customer changing their mind is reasonable while two ratings on one meal is not. A complaint is accepted at any stage, because the delay the brief describes is felt while the customer is still waiting — insisting the food arrive first would refuse the complaint at exactly the moment it is most justified.",
      "Complaints appear on the waiter's copy of the order, and the waiter can mark one resolved or reopen it. Without that the status stored against every complaint would read Open for ever, which would make it a label rather than a record of anything.",
    ],
  ],
  [
    "6.5  Payment",
    "The customer pays for the order on the platform just before exiting the restaurant. The payment is pretend, but it is recorded and clearly labelled as such.",
    [
      "No money moves and no card details are ever requested. The screen says so before the customer pays and again on the receipt afterwards.",
      "The amount is taken from the order total held in the database, never from the request, so the sum paid cannot disagree with the sum owed. The payment carries a method, a unique transaction reference and an isPretend flag stored on the row itself — not merely wording on a screen — so anyone reading the payments table later can see that the transaction was simulated without needing to know how the interface was phrased.",
      "Paying is only offered once the order has been served, a second payment against the same order is refused, and Paid cannot be reached any other way: the endpoint that changes an order's status will not set it. An order is therefore only ever marked paid when there is a payment record to account for it.",
    ],
  ],
  [
    "6.6  Registering a restaurant (beyond the brief)",
    "Somebody running the platform adds a restaurant, gives it a menu, puts items on that menu and hires staff — without editing the seed data.",
    [
      "This is the only part of the application that creates rather than reads. Everywhere else works with what the seed produced; here a Restaurant, a Menu, its MenuItems and its Staff are all written, which exercises the half of the model nothing else touches. An item added this way is immediately orderable by a customer, because it goes into the same tables the rest of the application reads from.",
      "Every item requires a name, a price in whole naira and a preparation time, exactly as requirement 1 describes. The preparation time is not optional or decorative: it is what the wait quoted to a customer is computed from, and an item lacking one would make that estimate wrong for every order containing it. The category matters for the same reason — whether something is food or drink decides which of the two parallel streams it counts towards, and whether a chef or a bartender is recorded against the order.",
      "A restaurant is not offered to customers until it can actually complete an order, meaning it has at least one waiter and at least one item available on an active menu. The admin page states which of those is missing. There is no login, because the application has none anywhere; the page says so rather than implying otherwise.",
    ],
  ],
  [
    "6.7  How service is going (beyond the brief)",
    "The twelve restaurants read together — takings, waits against what was quoted, ratings, and complaints.",
    [
      "Every figure is computed from the database rather than assembled from whatever the browser had loaded. Takings are the sum of payments actually recorded, not of order totals, because an unpaid order is money owed rather than money taken — the two are reported separately.",
      "It is deliberately group-wide with a per-restaurant table underneath. Around fifty orders spread across twelve restaurants means any single restaurant is four rows and a lot of white space; read together they say something. The same view breaks down to a single restaurant in the table below.",
      "This screen earned its place immediately by making change 022 visible: a reported average wait of 231 minutes against 26 quoted was what exposed that served orders had never recorded when they were served.",
    ],
  ],
].forEach(([h, intent, points]) => {
  children.push(H2(h));
  children.push(Runs([{ t: "Intended behaviour: ", b: true }, { t: intent }], { after: 100 }));
  children.push(Runs([{ t: "Implemented behaviour", b: true }], { after: 60 }));
  points.forEach((t) => children.push(Bullet(t)));
});

// 7. Walkthrough
children.push(H1("7. How to use it"));
children.push(
  Runs([
    { t: "Open " },
    { t: "https://chowly-red.vercel.app", b: true },
    {
      t: " in any browser, on a phone or a computer. There is nothing to install, no account to create and no password. The steps below walk the whole story — ordering a meal, preparing it, serving it, complaining about it and paying for it — and take about three minutes.",
    },
  ])
);
children.push(
  Note(
    "Nothing on this site takes money. The payment step is simulated, no card details are asked for at any point, and every payment is stored flagged as pretend."
  )
);

children.push(H2("As the customer"));
[
  "Pick a restaurant from the twelve listed. Terra Kulture is a good one to try.",
  "Type any first name and any table number, then press “Start ordering”. That is the whole sign-in — the name and table are what let a waiter bring food to the right person.",
  "Add a dish from the Food tab and a drink from the Drinks tab. Each item shows its price and how long it takes to prepare.",
  "Press “Review order”. The total and the estimated wait are shown. The wait is not the two preparation times added together, because the kitchen and the bar work at the same time — it is whichever of them takes longer.",
  "Press “Place order”. You are given an order reference such as ORD048 and a countdown against the quoted time. Leave this page open, or come back to it later from “My orders”.",
].forEach((t) => children.push(Step(t, 0)));

children.push(H2("As the waiter"));
[
  "At the top of the screen there is a switch reading customer / waiter. Press “waiter”. There is no login: the same person can be both, which is what the brief asks for.",
  "You are now looking at the kitchen queue for that restaurant. The order you just placed is in it, along with the orders already in the system. Anything running past its quoted time is flagged.",
  "Open your order. It is split into what the kitchen owes and what the bar owes.",
  "Choose a chef and a bartender from the restaurant's staff, then press “Record preparation”. The order moves to Preparing.",
  "Press “Mark as served”. Note that this button is disabled until a chef and bartender have been recorded — the order cannot be served by someone unnamed.",
].forEach((t) => children.push(Step(t, 1)));

children.push(H2("Back as the customer"));
[
  "Switch back to customer at the top of the screen and open the order again. The chef and bartender the waiter recorded are now shown, and the order reads as served.",
  "Give it a rating out of five and add a comment. Ratings only appear once the meal has arrived.",
  "Press “Something wrong with this order?” to leave a complaint. A complaint can be made at any point, including while you are still waiting, because that is when a delay is actually felt. The waiter sees it on their copy of the order.",
  "Press “Pay”. The receipt shows the amount, the method and a transaction reference, and states plainly that the payment was simulated.",
  "Refresh the page, or close the browser and open the link again. The order, the rating, the complaint and the payment are all still there — they live in the database, not in the browser.",
].forEach((t) => children.push(Step(t, 2)));

children.push(H2("Beyond the brief, if you want to see it"));
children.push(
  P(
    "Two screens exist that the assignment does not ask for. Neither is needed to walk the story above."
  )
);
[
  "Open /dashboard, or follow “How service is going” from the waiter's queue. It reports the twelve restaurants together: takings against money still owed, how long orders actually took against what was quoted, the spread of ratings, and the same broken down per restaurant.",
  "Open /admin. Add a restaurant, give it a menu, put an item on it with a price and a preparation time, and hire a waiter. Then switch to the customer view — the restaurant now appears in the list and you can order the dish you just created. Until it has both a waiter and an item it is shown as not taking orders yet, because without either the order would be refused.",
].forEach((t) => children.push(Step(t, 3)));

children.push(H2("Things worth trying"));
[
  "Switch to the waiter and change restaurant from the menu at the top. Your own table at the first restaurant is remembered separately, so switching back as a customer returns you to it — one person can be a customer in one place and a waiter in another.",
  "Try to mark an order served without recording who prepared it. The interface will not let you, and neither will the server if asked directly.",
  "Try to pay twice. The second attempt is refused.",
].forEach((t) => children.push(Bullet(t)));

// 8. Open questions
children.push(H1("8. Open questions"));
children.push(P("Still outstanding. Resolved questions move into the change log in section 4 with the reason attached."));
children.push(Bullet("None outstanding. Every question raised so far has been resolved and recorded in section 4."));

// ---------- document ----------
const doc = new Document({
  creator: "Tobi Akinola",
  title: "Chowly — Project & Build Log",
  description: "Living build log for the TeSA Africa Chowly build assignment",
  numbering: {
    config: [
      {
        reference: "bullets",
        levels: [
          {
            level: 0,
            format: LevelFormat.BULLET,
            text: "•",
            alignment: AlignmentType.LEFT,
            style: { paragraph: { indent: { left: 460, hanging: 260 } } },
          },
        ],
      },
      {
        reference: "steps",
        levels: [
          {
            level: 0,
            format: LevelFormat.DECIMAL,
            text: "%1.",
            alignment: AlignmentType.START,
            style: { paragraph: { indent: { left: 460, hanging: 260 } } },
          },
        ],
      },
    ],
  },
  styles: {
    default: {
      document: { run: { font: "Calibri", size: 21, color: INK } },
    },
  },
  sections: [
    {
      properties: {
        page: { margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 } },
      },
      children,
    },
  ],
});

const out = process.argv[2];
Packer.toBuffer(doc).then((buf) => {
  fs.writeFileSync(out, buf);
  console.log("written:", out, buf.length, "bytes");
});
