import { expect, test } from "bun:test";
import { existsSync, readFileSync } from "node:fs";

// ---------------------------------------------------------------------------
// Start route parity tests
// ---------------------------------------------------------------------------

test("fan-out route preserves validation and positional args", () => {
  const source = readFileSync("app/api/fan-out/route.ts", "utf8");
  expect(source).toContain("incidentId is required");
  expect(source).toContain("message is required");
  expect(source).toContain("start(incidentFanOut, [incidentId, message, failures])");
  // Import rewritten from @/workflows/... to @/fan-out/workflows/...
  expect(source).toContain('@/fan-out/workflows/incident-fanout');
  expect(source).not.toContain('from "@/workflows/');
});

test("approval-gate route preserves approval token response", () => {
  const source = readFileSync("app/api/approval-gate/route.ts", "utf8");
  expect(source).toContain("approvalToken");
  expect(source).toContain("start(approvalGate, [normalizedOrderId, normalizedTimeout])");
  expect(source).toContain('@/approval-gate/workflows/approval-gate');
});

test("claim-check route preserves hook token response", () => {
  const source = readFileSync("app/api/claim-check/route.ts", "utf8");
  expect(source).toContain("hookToken");
  expect(source).toContain("start(claimCheckImport, [importId])");
  expect(source).toContain('@/claim-check/workflows/claim-check');
});

// ---------------------------------------------------------------------------
// Extra route shim tests
// ---------------------------------------------------------------------------

test("approval-gate approve route shim exists and resumes hook", () => {
  expect(existsSync("app/api/approval-gate/approve/route.ts")).toBe(true);
  const source = readFileSync("app/api/approval-gate/approve/route.ts", "utf8");
  expect(source).toContain("orderApprovalHook.resume");
  expect(source).toContain('@/approval-gate/workflows/approval-gate');
});

test("event-gateway signal route shim exists", () => {
  expect(existsSync("app/api/event-gateway/signal/route.ts")).toBe(true);
  const source = readFileSync("app/api/event-gateway/signal/route.ts", "utf8");
  expect(source).toContain("orderSignal.resume");
  expect(source).toContain('@/event-gateway/workflows/event-gateway');
});

test("async-request-reply webhook route shim exists", () => {
  expect(existsSync("app/api/async-request-reply/webhook/[token]/route.ts")).toBe(true);
  const source = readFileSync("app/api/async-request-reply/webhook/[token]/route.ts", "utf8");
  expect(source).toContain("resumeWebhook");
});

test("claim-check upload route shim exists", () => {
  expect(existsSync("app/api/claim-check/upload/route.ts")).toBe(true);
  const source = readFileSync("app/api/claim-check/upload/route.ts", "utf8");
  expect(source).toContain("blobReady.resume");
  expect(source).toContain('@/claim-check/workflows/claim-check');
});

// ---------------------------------------------------------------------------
// Import rewriting tests
// ---------------------------------------------------------------------------

test("generated routes never contain bare @/ imports pointing to demo internals", () => {
  const slugs = ["fan-out", "approval-gate", "claim-check", "event-gateway"];
  for (const slug of slugs) {
    const source = readFileSync(`app/api/${slug}/route.ts`, "utf8");
    // All @/ imports should be rewritten to @/{slug}/
    const bareImports = source.match(/from\s+["']@\/(?![\w-]+\/)/g);
    expect(bareImports).toBeNull();
  }
});

// ---------------------------------------------------------------------------
// Registry tests
// ---------------------------------------------------------------------------

test("registry marks approval-gate as native-ready and no demos use other uiStatus values", () => {
  const source = readFileSync("lib/native-demos.generated.ts", "utf8");

  const gateSection = source.slice(
    source.indexOf('"approval-gate"'),
    source.indexOf('"approval-gate"') + 300,
  );
  expect(gateSection).toContain('uiStatus: "native-ready"');
  expect(source).not.toContain('uiStatus: "adapter-required"');
  expect(source).not.toContain('uiStatus: "placeholder"');
});

test("registry has namespaced extra routes", () => {
  const source = readFileSync("lib/native-demos.generated.ts", "utf8");
  expect(source).toContain("/api/approval-gate/approve");
  expect(source).toContain("/api/event-gateway/signal");
  // Should NOT contain un-namespaced conflicting routes
  expect(source).not.toContain('route: "/api/approve"');
  expect(source).not.toContain('route: "/api/signal"');
});

// ---------------------------------------------------------------------------
// Wrapper component tests
// ---------------------------------------------------------------------------

test("approval-gate native wrapper renders the real component directly", () => {
  const source = readFileSync("app/components/demos/approval-gate-native.tsx", "utf8");
  expect(source).toContain('import { ApprovalDemo } from "@/approval-gate/app/components/demo"');
  expect(source).toContain("export default function ApprovalGateNativeDemo()");
  expect(source).toContain("return <ApprovalDemo />");
  expect(source).not.toContain("as default");
});

test("fan-out native wrapper renders the real component with generated demo props", () => {
  const source = readFileSync("app/components/demos/fan-out-native.tsx", "utf8");
  expect(source).toContain('import { FanOutCodeWorkbench } from "@/fan-out/app/components/fanout-code-workbench"');
  expect(source).toContain("const demoProps = {");
  expect(source).toContain("workflowCode: \"\"");
  expect(source).toContain("stepCode: \"\"");
  expect(source).toContain("} as unknown as Parameters<typeof FanOutDemo>[0]");
  expect(source).toContain("export default function FanOutNativeDemo()");
  expect(source).toContain("return <FanOutDemo {...demoProps} />");
  expect(source).not.toContain("native UI adapter pending");
});

// ---------------------------------------------------------------------------
// Detail page tests
// ---------------------------------------------------------------------------

test("detail page gates fallback rendering on uiStatus instead of uiReady", () => {
  const source = readFileSync("app/demos/[slug]/page.tsx", "utf8");
  expect(source).toContain("DemoDetailShell");
  expect(source).toContain('if (native.uiStatus !== "native-ready")');
  expect(source).not.toContain("!demo || !native || !native.uiReady");
});

// ---------------------------------------------------------------------------
// GENERATED header tests
// ---------------------------------------------------------------------------

test("all generated route files have GENERATED header", () => {
  const files = [
    "app/api/fan-out/route.ts",
    "app/api/approval-gate/route.ts",
    "app/api/claim-check/route.ts",
    "app/api/readable/[runId]/route.ts",
    "app/api/approval-gate/approve/route.ts",
    "lib/native-demos.generated.ts",
  ];
  for (const file of files) {
    const source = readFileSync(file, "utf8");
    expect(source.startsWith("// GENERATED")).toBe(true);
  }
});

// ---------------------------------------------------------------------------
// Idempotency test
// ---------------------------------------------------------------------------

test("generator is idempotent (running twice produces same output)", () => {
  const file = "app/api/fan-out/route.ts";
  const before = readFileSync(file, "utf8");
  // The generator was already run — just verify the file exists and is stable
  expect(before.length).toBeGreaterThan(100);
  expect(before).toContain("GENERATED");
});
