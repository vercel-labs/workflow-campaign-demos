// GENERATED — per-demo OG image route for social sharing
// Regenerate with: bun .scripts/generate-native-gallery.ts
import { ImageResponse } from "next/og";
import { getDemo } from "@/lib/demos";

export const runtime = "edge";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "Workflow API Explorer demo";

type Props = {
  params: Promise<{ slug: string }>;
};

export default async function Image({ params }: Props) {
  const { slug } = await params;
  const demo = getDemo(slug);
  const title = demo?.title ?? "Workflow API Explorer";
  const description =
    demo?.whenToUse ?? demo?.description ?? "Production workflow pattern demo";
  const tags = demo?.tags.slice(0, 3) ?? [];

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          backgroundColor: "#0a0a0a",
          color: "#ededed",
          padding: "56px",
          fontFamily: "system-ui, sans-serif",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "12px",
              fontSize: "20px",
              color: "#0070F3",
            }}
          >
            <div
              style={{
                border: "1px solid #292929",
                borderRadius: "9999px",
                padding: "6px 14px",
              }}
            >
              pattern
            </div>
            <div style={{ color: "#737373" }}>{`/demos/${slug}`}</div>
          </div>
          <div
            style={{
              fontSize: "64px",
              fontWeight: 700,
              lineHeight: 1.05,
              letterSpacing: "-0.03em",
              maxWidth: "980px",
            }}
          >
            {title}
          </div>
          <div
            style={{
              fontSize: "28px",
              lineHeight: 1.35,
              color: "#a1a1a1",
              maxWidth: "980px",
            }}
          >
            {description}
          </div>
        </div>
        <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
          {tags.map((tag) => (
            <div
              key={tag}
              style={{
                border: "1px solid #292929",
                borderRadius: "9999px",
                padding: "8px 16px",
                fontSize: "18px",
                color: "#a1a1a1",
              }}
            >
              {tag}
            </div>
          ))}
        </div>
      </div>
    ),
    { ...size },
  );
}
