// GENERATED — favicon route using Next.js ImageResponse
import { ImageResponse } from "next/og";

export const size = { width: 32, height: 32 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#0a0a0a",
          borderRadius: "6px",
        }}
      >
        <div
          style={{
            fontSize: "22px",
            fontWeight: 700,
            color: "#ededed",
            fontFamily: "system-ui, sans-serif",
            lineHeight: 1,
          }}
        >
          W
        </div>
      </div>
    ),
    { ...size },
  );
}
