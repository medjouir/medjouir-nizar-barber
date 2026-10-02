import { ImageResponse } from "next/og";

export const alt = "Nizar — Barber";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/** WhatsApp / social preview: black, white wordmark, gold accent. */
export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "0 96px",
          background: "#000000",
          color: "#f5f5f2",
        }}
      >
        <div style={{ fontSize: 120, fontWeight: 700, letterSpacing: 24 }}>NIZAR</div>
        <div style={{ marginTop: 8, fontSize: 36, letterSpacing: 14, color: "#9a9a9a" }}>BARBER</div>
        <div style={{ marginTop: 56, width: 120, height: 6, background: "#ddb361", borderRadius: 3 }} />
        <div style={{ marginTop: 40, fontSize: 44, color: "#f5f5f2" }}>7jez rendez-vous dyalk 3end Nizar.</div>
      </div>
    ),
    size,
  );
}
