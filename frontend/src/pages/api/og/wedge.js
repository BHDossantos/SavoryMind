/**
 * Dynamic Open Graph image for the consumer wedge.
 *
 * When someone shares a SavoryMind link (WhatsApp, iMessage, Instagram,
 * Twitter, Slack), the recipient's client scrapes the page's og:image and
 * unfurls a card. A bare link gets ignored; a branded card with the North
 * Star promise gets tapped. This route renders that card as a PNG.
 *
 * It accepts an optional `?title=` so a shared *result* can carry its own
 * headline ("Tonight you are: cacio e pepe…"); with no param it renders the
 * default North Star card. Kept to the system font + solid brand gradient —
 * no external font fetch, so there's no network failure mode at render time.
 *
 * Edge runtime is required by next/og's ImageResponse. Next's standalone
 * output bundles edge routes, so this ships in the existing Docker image.
 */
import { ImageResponse } from "next/og";

export const config = { runtime: "edge" };

const DEFAULT_TITLE = "Tell us how you feel.\nWe'll tell you what to eat.";

export default function handler(req) {
  const { searchParams } = new URL(req.url);
  const raw = (searchParams.get("title") || "").slice(0, 140).trim();
  const title = raw || DEFAULT_TITLE;
  const subtitle = raw
    ? "SavoryMind · AI food intelligence"
    : "30 seconds, no signup · SavoryMind";

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "72px",
          background: "linear-gradient(135deg, #7c3aed 0%, #4c1d95 55%, #ea580c 100%)",
          color: "#ffffff",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", fontSize: 34, fontWeight: 700 }}>
          <span style={{ fontSize: 44, marginRight: 16 }}>🧠</span>
          SavoryMind
        </div>

        <div
          style={{
            display: "flex",
            fontSize: title.length > 60 ? 60 : 76,
            fontWeight: 800,
            lineHeight: 1.1,
            letterSpacing: "-1.5px",
            whiteSpace: "pre-wrap",
          }}
        >
          {title}
        </div>

        <div style={{ display: "flex", fontSize: 30, color: "rgba(255,255,255,0.85)" }}>
          {subtitle}
        </div>
      </div>
    ),
    { width: 1200, height: 630 },
  );
}
