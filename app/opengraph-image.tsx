// GENERATED — root-level OG image route for social sharing
import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "Workflow API Explorer";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OGImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#0a0a0a",
          fontFamily: "system-ui, sans-serif",
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: "24px",
          }}
        >
          <div
            style={{
              fontSize: "64px",
              fontWeight: 700,
              color: "#ededed",
              letterSpacing: "-0.02em",
              textAlign: "center",
              lineHeight: 1.1,
            }}
          >
            Workflow API Explorer
          </div>
          <div
            style={{
              fontSize: "28px",
              color: "#a1a1a1",
              textAlign: "center",
              maxWidth: "800px",
            }}
          >
            50 workflow API demos — find the right pattern, run it live, read
            the source
          </div>
          <div
            style={{
              display: "flex",
              gap: "12px",
              marginTop: "16px",
            }}
          >
            {["Fan-out", "Saga", "Circuit Breaker", "CQRS", "Dead Letter"].map(
              (tag) => (
                <div
                  key={tag}
                  style={{
                    fontSize: "18px",
                    color: "#a1a1a1",
                    border: "1px solid #333",
                    borderRadius: "9999px",
                    padding: "6px 16px",
                  }}
                >
                  {tag}
                </div>
              ),
            )}
          </div>
        </div>
      </div>
    ),
    { ...size },
  );
}
