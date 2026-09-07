import { ImageResponse } from "next/og";

/**
 * The card shown when the link is pasted into Slack, WhatsApp or Teams.
 *
 * Generated here rather than shipped as a file, so there is no binary asset to
 * keep in step with the palette and nothing is fetched from anywhere else.
 */
export const alt = "Chowly — order from your table";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "80px",
          background: "#fbf7f2",
          color: "#201b16",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "20px" }}>
          <div
            style={{
              width: 64,
              height: 64,
              borderRadius: 16,
              background: "#c2410c",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#ffffff",
              fontSize: 36,
              fontWeight: 700,
            }}
          >
            {/* A plain letter on purpose: a decorative glyph such as ◎ is not in
                the bundled font, and @vercel/og then tries to fetch one over the
                network at build time and fails. */}
            C
          </div>
          <div style={{ fontSize: 44, fontWeight: 700, letterSpacing: "-0.02em" }}>Chowly</div>
        </div>

        <div style={{ fontSize: 76, fontWeight: 700, marginTop: 40, letterSpacing: "-0.03em" }}>
          Order from your table.
        </div>

        <div style={{ fontSize: 34, color: "#6b5f54", marginTop: 24, maxWidth: 900 }}>
          Browse the menu, watch your order being prepared, and settle up before
          you leave.
        </div>

        <div style={{ display: "flex", gap: 14, marginTop: 48 }}>
          {["12 restaurants", "236 dishes", "No login"].map((t) => (
            <div
              key={t}
              style={{
                fontSize: 26,
                color: "#c2410c",
                background: "#fff1e9",
                padding: "10px 22px",
                borderRadius: 999,
              }}
            >
              {t}
            </div>
          ))}
        </div>
      </div>
    ),
    size
  );
}
