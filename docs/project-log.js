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
      ["Last updated", "6 September 2026"],
      ["Status", "In progress — stack and hosting decided, build starting"],
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
    "Sections 3, 6 and 7 are deliberately incomplete at this point. They are filled in as each part of the application is actually built, not before."
  )
);

// 2. Requirement tracker
children.push(H1("2. Requirement tracker"));
children.push(P("The eight functional requirements and three deliverables from the brief, and where each one stands."));
children.push(
  Tbl(
    [600, 5426, 3000],
    ["#", "Requirement", "Status"],
    [
      ["1", "The menu — food and drinks loaded into the database, each item carrying a name, a price and a preparation time", "Not started"],
      ["2", "Placing an order — customer selects items, submits, and is shown the order details and waiting time", "Not started"],
      ["3", "Assigning the order — waiter opens an order, records the chef and bartender, marks it served", "Not started"],
      ["4", "Complaint and rating — both stored against the order", "Not started"],
      ["5", "Payment — a button that records payment and marks the order paid, clearly labelled as pretend", "Not started"],
      ["6", "The two roles — a simple switch between customer and waiter, no login", "Not started"],
      ["7", "Real storage — everything survives a page refresh", "Not started"],
      ["8", "A live link — deployed and usable by anybody with the URL", "Not started"],
      ["D1", "Git repository, accessible to facilitators, commit history showing the work as it was done", "Not started"],
      ["D2", "URL of the deployed application", "Not started"],
      ["D3", "This document", "In progress"],
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
children.push(P("To be written once the stack is chosen and the project is scaffolded.", { italic: true, color: MUTED }));

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
children.push(Spacer(160));
children.push(
  Note(
    "The brief says: where the build forces a change to the model, make the change and say why. Every such change is recorded in Section 4, and the final implemented model will be restated here once the schema is settled."
  )
);

children.push(H2("3.4  Deployment"));
children.push(
  Runs([
    { t: "Target: ", b: true },
    { t: "Vercel for the application, Neon for the PostgreSQL database. ", b: true },
    { t: "The deployed URL and the finished procedure are recorded here once the application is live." },
  ])
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
    "Every change to the model or to the shape of the application, with the reason for it. Entries marked AWAITING REASON are decisions that have been made but whose rationale has not yet been recorded — they are not written up until the reason is confirmed rather than guessed."
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
  ["6.1  Menu browsing", "A customer opens the app at a table and views the food and drinks currently available."],
  ["6.2  Order placement", "A customer selects items and submits an order, and is shown the waiting time and the other details of that order."],
  ["6.3  Order assignment", "The order is assigned to a waiter, who records the chef and the bartender that prepared it and marks it served."],
  ["6.4  Complaint and rating", "Where an order is delayed, the customer submits a complaint and gives a low rating against that order."],
  ["6.5  Payment", "The customer pays for the order on the platform just before exiting the restaurant. The payment is pretend, but it is recorded and clearly labelled as such."],
].forEach(([h, intent]) => {
  children.push(H2(h));
  children.push(Runs([{ t: "Intended behaviour: ", b: true }, { t: intent }], { after: 80 }));
  children.push(P("Implemented behaviour — to be written once built.", { italic: true, color: MUTED }));
});

// 7. Walkthrough
children.push(H1("7. How to use it"));
children.push(
  P(
    "A walkthrough a stranger can follow on the deployed link, including how to switch between the customer and the waiter. To be written once the application is deployed."
  )
);

// 8. Open questions
children.push(H1("8. Open questions"));
children.push(P("Still outstanding. Resolved questions move into the change log in section 4 with the reason attached."));
children.push(Bullet("Should the repository be public, or private with the facilitators invited? A private repository they cannot open would fail deliverable 1."));

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
