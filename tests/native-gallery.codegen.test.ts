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

test("fan-out native wrapper accepts server props instead of embedding dummy code props", () => {
  const source = readFileSync("app/components/demos/fan-out-native.tsx", "utf8");
  expect(source).toContain(
    "export type FanOutNativeDemoProps = Parameters<typeof FanOutDemo>[0]",
  );
  expect(source).toContain(
    "export default function FanOutNativeDemo(props: FanOutNativeDemoProps)",
  );
  expect(source).toContain("return <FanOutDemo {...props} />");
  expect(source).not.toContain('workflowCode: ""');
  expect(source).not.toContain('stepCode: ""');
});

// ---------------------------------------------------------------------------
// Code-props generation tests
// ---------------------------------------------------------------------------

test("fan-out generated code props read monorepo-root workflow source and build real line maps", () => {
  const source = readFileSync("lib/generated/demo-code-props/fan-out.ts", "utf8");
  expect(source).toContain(
    'join(process.cwd(), "fan-out/workflows/incident-fanout.ts")',
  );
  expect(source).toContain("highlightCodeToHtmlLines(workflowCode)");
  expect(source).toContain("buildWorkflowLineMap(workflowCode)");
  expect(source).toContain("buildStepSuccessLineMap(stepCode)");
});

test("detail page loads code props before rendering the native component", () => {
  const source = readFileSync("app/demos/[slug]/page.tsx", "utf8");
  expect(source).toContain("getNativeDemoCodeProps(slug)");
  expect(source).toContain("<DemoComponent {...codeProps} />");
});

test("generated code-props dispatcher routes representative demos to real props", () => {
  const source = readFileSync("lib/native-demo-code.generated.ts", "utf8");
  expect(source).toContain('case "fan-out"');
  expect(source).toContain("return getFanOutCodeProps()");
  expect(source).toContain('case "saga"');
  expect(source).toContain("return getSagaCodeProps()");
  expect(source).toContain('case "circuit-breaker"');
  expect(source).toContain("return getCircuitBreakerCodeProps()");
  expect(source).toContain('case "splitter"');
  expect(source).toContain("return getSplitterCodeProps()");
  expect(source).toContain('case "dead-letter-queue"');
  expect(source).toContain("return getDeadLetterQueueCodeProps()");
});

test("representative generated code-props modules contain real server-side workbench logic", () => {
  expect(readFileSync("lib/generated/demo-code-props/saga.ts", "utf8"))
    .toContain("highlightCodeToHtmlLines(orchestratorCode)");
  expect(readFileSync("lib/generated/demo-code-props/circuit-breaker.ts", "utf8"))
    .toContain("buildWorkflowLineMap(workflowCode)");
  expect(readFileSync("lib/generated/demo-code-props/splitter.ts", "utf8"))
    .toContain('join(process.cwd(), "splitter/workflows/order-splitter.ts")');
  expect(readFileSync("lib/generated/demo-code-props/dead-letter-queue.ts", "utf8"))
    .toContain('join(process.cwd(), "dead-letter-queue/workflows/dead-letter-queue.ts")');
  expect(readFileSync("lib/generated/demo-code-props/async-request-reply.ts", "utf8"))
    .toContain("buildOrchestratorLineMap(orchestratorCode)");
  expect(readFileSync("lib/generated/demo-code-props/idempotent-receiver.ts", "utf8"))
    .toContain("buildOrchestratorLineMap(orchestratorCode)");
  expect(readFileSync("lib/generated/demo-code-props/choreography.ts", "utf8"))
    .toContain("buildParticipantLineMap(participantCode)");
  expect(readFileSync("lib/generated/demo-code-props/cancellable-export.ts", "utf8"))
    .toContain("buildHighlightLineMap(workflowCode)");
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
// Real regeneration verification
// ---------------------------------------------------------------------------

import { execSync } from "node:child_process";
import { rmSync as fsRmSync, writeFileSync } from "node:fs";

const REPRESENTATIVE_SLUGS = [
  "fan-out",
  "saga",
  "circuit-breaker",
  "splitter",
  "dead-letter-queue",
  "async-request-reply",
  "idempotent-receiver",
  "choreography",
  "cancellable-export",
] as const;

const SLUG_TO_FN: Record<string, string> = {
  "fan-out": "getFanOutCodeProps",
  saga: "getSagaCodeProps",
  "circuit-breaker": "getCircuitBreakerCodeProps",
  splitter: "getSplitterCodeProps",
  "dead-letter-queue": "getDeadLetterQueueCodeProps",
  "async-request-reply": "getAsyncRequestReplyCodeProps",
  "idempotent-receiver": "getIdempotentReceiverCodeProps",
  choreography: "getChoreographyCodeProps",
  "cancellable-export": "getCancellableExportCodeProps",
};

function runGenerator() {
  execSync("bun .scripts/generate-native-gallery.ts", { stdio: "inherit" });
}

test("generator is idempotent: two consecutive runs produce identical output", () => {
  // Run 1
  runGenerator();
  const afterFirst = new Map<string, string>();
  for (const slug of REPRESENTATIVE_SLUGS) {
    afterFirst.set(slug, readFileSync(`lib/generated/demo-code-props/${slug}.ts`, "utf8"));
  }
  const dispatcherFirst = readFileSync("lib/native-demo-code.generated.ts", "utf8");
  const registryFirst = readFileSync("lib/native-demos.generated.ts", "utf8");
  const routeFirst = readFileSync("app/api/fan-out/route.ts", "utf8");

  // Run 2
  runGenerator();

  // Assert all representative code-props modules still exist with identical content
  for (const slug of REPRESENTATIVE_SLUGS) {
    const content = readFileSync(`lib/generated/demo-code-props/${slug}.ts`, "utf8");
    expect(content).toBe(afterFirst.get(slug)!);
  }
  expect(readFileSync("lib/native-demo-code.generated.ts", "utf8")).toBe(dispatcherFirst);
  expect(readFileSync("lib/native-demos.generated.ts", "utf8")).toBe(registryFirst);
  expect(readFileSync("app/api/fan-out/route.ts", "utf8")).toBe(routeFirst);
});

test("all five representative code-props modules exist after clean+regen cycle", () => {
  // Run the generator (which internally cleans then regenerates)
  runGenerator();

  for (const slug of REPRESENTATIVE_SLUGS) {
    const path = `lib/generated/demo-code-props/${slug}.ts`;
    expect(existsSync(path)).toBe(true);
    const content = readFileSync(path, "utf8");
    expect(content.length).toBeGreaterThan(50);
  }
});

test("dispatcher contains dispatch branches for all five representative demos after regen", () => {
  // Run twice to exercise the clean+regen cycle
  runGenerator();
  runGenerator();

  const dispatcher = readFileSync("lib/native-demo-code.generated.ts", "utf8");
  for (const slug of REPRESENTATIVE_SLUGS) {
    expect(dispatcher).toContain(`case "${slug}"`);
    expect(dispatcher).toContain(`return ${SLUG_TO_FN[slug]}()`);
  }
});

test("non-representative demos use real workflow source fallback instead of blank props", () => {
  const dispatcher = readFileSync("lib/native-demo-code.generated.ts", "utf8");

  // The dispatcher should import readFileSync and highlightCodeToHtmlLines for generic fallback
  expect(dispatcher).toContain('import { readFileSync } from "node:fs"');
  expect(dispatcher).toContain('highlightCodeToHtmlLines,');
  expect(dispatcher).toContain('from "@/lib/code-workbench.server"');
  expect(dispatcher).toContain("function readWorkflowSource(");

  // Non-representative demos with code props should use readWorkflowSource, not blank strings
  // Check a sample of demos that previously returned workflowCode: ""
  for (const slug of ["aggregator", "bulkhead", "competing-consumers", "throttle"]) {
    const caseStart = dispatcher.indexOf(`case "${slug}"`);
    expect(caseStart).toBeGreaterThan(-1);
    // Find the next case or default to delimit this case block
    const caseBlock = dispatcher.slice(caseStart, caseStart + 500);
    expect(caseBlock).toContain("readWorkflowSource(");
    expect(caseBlock).toContain("highlightCodeToHtmlLines(workflowCode)");
    // Should NOT contain blank workflowCode
    expect(caseBlock).not.toContain('workflowCode: ""');
  }

  // Demos with no code props (approval-gate) should still return {}
  const gateCase = dispatcher.slice(
    dispatcher.indexOf('case "approval-gate"'),
    dispatcher.indexOf('case "approval-gate"') + 100,
  );
  expect(gateCase).toContain("return {}");
});

// ---------------------------------------------------------------------------
// Multi-pane fallback tests
// ---------------------------------------------------------------------------

test("html-only demos receive workflow and secondary HTML fallbacks", () => {
  const dispatcher = readFileSync("lib/native-demo-code.generated.ts", "utf8");
  expect(dispatcher).toContain("extractExportedWorkflowBlock");
  expect(dispatcher).toContain("extractSecondaryFunctionBlocks");

  // async-request-reply and idempotent-receiver now use real preserved modules
  const asyncCase = dispatcher.slice(
    dispatcher.indexOf('case "async-request-reply"'),
    dispatcher.indexOf('case "batch-processor"'),
  );
  expect(asyncCase).toContain("return getAsyncRequestReplyCodeProps()");

  const idempotentCase = dispatcher.slice(
    dispatcher.indexOf('case "idempotent-receiver"'),
    dispatcher.indexOf('case "map-reduce"'),
  );
  expect(idempotentCase).toContain("return getIdempotentReceiverCodeProps()");

  // Verify that other non-representative demos still use the generic fallback
  const bulkheadCase = dispatcher.slice(
    dispatcher.indexOf('case "bulkhead"'),
    dispatcher.indexOf('case "bulkhead"') + 500,
  );
  expect(bulkheadCase).toContain("readWorkflowSource(");
});

test("secondary string-pane demos receive secondary code fallbacks", () => {
  const dispatcher = readFileSync("lib/native-demo-code.generated.ts", "utf8");

  // choreography now uses a real preserved module
  const choreographyCase = dispatcher.slice(
    dispatcher.indexOf('case "choreography"'),
    dispatcher.indexOf('case "circuit-breaker"'),
  );
  expect(choreographyCase).toContain("return getChoreographyCodeProps()");

  // Other secondary-pane demos still use the generic fallback
  const historyCase = dispatcher.slice(
    dispatcher.indexOf('case "message-history"'),
    dispatcher.indexOf('case "message-translator"'),
  );
  expect(historyCase).toContain("stepCode: secondaryCode");
  expect(historyCase).toContain("stepHtmlLines: secondaryHtmlLines");

  const managerCase = dispatcher.slice(
    dispatcher.indexOf('case "process-manager"'),
    dispatcher.indexOf('case "publish-subscribe"'),
  );
  expect(managerCase).toContain("stepCode: secondaryCode");
  expect(managerCase).toContain("stepHtmlLines: secondaryHtmlLines");
});

// ---------------------------------------------------------------------------
// Per-demo semantic coverage: new preserved-module cluster
// ---------------------------------------------------------------------------

test("async-request-reply is a real preserved module with non-empty orchestrator and callback maps", () => {
  // Generator registration
  const generator = readFileSync(".scripts/generate-native-gallery.ts", "utf8");
  expect(generator).toContain(
    '{ slug: "async-request-reply", fn: "getAsyncRequestReplyCodeProps", mode: "preserve-file" }',
  );

  // Dispatcher routing
  const dispatcher = readFileSync("lib/native-demo-code.generated.ts", "utf8");
  const asyncCase = dispatcher.slice(
    dispatcher.indexOf('case "async-request-reply"'),
    dispatcher.indexOf('case "async-request-reply"') + 200,
  );
  expect(asyncCase).toContain("return getAsyncRequestReplyCodeProps()");

  // Module semantic markers — orchestrator line map builders
  const source = readFileSync(
    "lib/generated/demo-code-props/async-request-reply.ts",
    "utf8",
  );
  expect(source).toContain("buildOrchestratorLineMap(orchestratorCode)");
  expect(source).toContain("buildCallbackLineMap(callbackCode)");
  // Orchestrator uses manual scanning for finalizeResult
  expect(source).toContain('includes("finalizeResult(")');
  // Callback map uses helpers
  expect(source).toContain('findBlockLineNumbers(code, "if (!response)")');
  // Orchestrator line map keys
  expect(source).toContain("submit: number[]");
  expect(source).toContain("wait: number[]");
  expect(source).toContain("callback: number[]");
  expect(source).toContain("timeout: number[]");
  // Callback line map keys
  expect(source).toContain("resume: number[]");
  expect(source).toContain("duplicate: number[]");
  expect(source).toContain("delivered: number[]");
  // Exported props shape
  expect(source).toContain("orchestratorHtmlLines: string[]");
  expect(source).toContain("callbackHtmlLines: string[]");
});

test("idempotent-receiver is a real preserved module with orchestrator and step maps", () => {
  const generator = readFileSync(".scripts/generate-native-gallery.ts", "utf8");
  expect(generator).toContain(
    '{ slug: "idempotent-receiver", fn: "getIdempotentReceiverCodeProps", mode: "preserve-file" }',
  );

  const dispatcher = readFileSync("lib/native-demo-code.generated.ts", "utf8");
  const irCase = dispatcher.slice(
    dispatcher.indexOf('case "idempotent-receiver"'),
    dispatcher.indexOf('case "idempotent-receiver"') + 200,
  );
  expect(irCase).toContain("return getIdempotentReceiverCodeProps()");

  const source = readFileSync(
    "lib/generated/demo-code-props/idempotent-receiver.ts",
    "utf8",
  );
  // Orchestrator line map keys
  expect(source).toContain("checkKey: number[]");
  expect(source).toContain("duplicateBranch: number[]");
  expect(source).toContain("processBranch: number[]");
  expect(source).toContain("returnResult: number[]");
  // Step line map keys
  expect(source).toContain("processPayment: number[]");
  expect(source).toContain("storeResult: number[]");
  expect(source).toContain("emitDuplicate: number[]");
  // Semantic markers — real line-map builders, not generic fallback
  expect(source).toContain("buildOrchestratorLineMap(orchestratorCode)");
  expect(source).toContain("buildStepLineMap(stepCode)");
  expect(source).toContain('findBlockLineNumbers(code, "if (cached)")');
  expect(source).toContain('findLineNumbers(code, "checkIdempotencyKey(")');
});

test("choreography is a real preserved module with flow and participant pane data", () => {
  const generator = readFileSync(".scripts/generate-native-gallery.ts", "utf8");
  expect(generator).toContain(
    '{ slug: "choreography", fn: "getChoreographyCodeProps", mode: "preserve-file" }',
  );

  const dispatcher = readFileSync("lib/native-demo-code.generated.ts", "utf8");
  const chorCase = dispatcher.slice(
    dispatcher.indexOf('case "choreography"'),
    dispatcher.indexOf('case "choreography"') + 200,
  );
  expect(chorCase).toContain("return getChoreographyCodeProps()");

  const source = readFileSync(
    "lib/generated/demo-code-props/choreography.ts",
    "utf8",
  );
  // Flow line map keys — participant call sites
  expect(source).toContain("orderServicePlaceOrder: number[]");
  expect(source).toContain("inventoryServiceReserve: number[]");
  expect(source).toContain("paymentServiceCharge: number[]");
  expect(source).toContain("shippingServiceShip: number[]");
  expect(source).toContain("compensationBranch: number[]");
  expect(source).toContain("finalizeOutcome: number[]");
  // Participant line map keys — all 7 service functions
  expect(source).toContain("orderService: number[]");
  expect(source).toContain("inventoryService: number[]");
  expect(source).toContain("paymentService: number[]");
  expect(source).toContain("shippingService: number[]");
  expect(source).toContain("orderServiceCompensate: number[]");
  expect(source).toContain("inventoryServiceCompensate: number[]");
  expect(source).toContain("paymentServiceCompensate: number[]");
  // Real builders, not generic fallback
  expect(source).toContain("buildFlowLineMap(flowCode)");
  expect(source).toContain("buildParticipantLineMap(participantCode)");
  // Exported props include both code strings and html lines
  expect(source).toContain("flowCode: string");
  expect(source).toContain("flowHtmlLines: string[]");
  expect(source).toContain("participantCode: string");
  expect(source).toContain("participantHtmlLines: string[]");
});

test("cancellable-export is a real preserved module with sections and workbench data", () => {
  const generator = readFileSync(".scripts/generate-native-gallery.ts", "utf8");
  expect(generator).toContain(
    '{ slug: "cancellable-export", fn: "getCancellableExportCodeProps", mode: "preserve-file" }',
  );

  const dispatcher = readFileSync("lib/native-demo-code.generated.ts", "utf8");
  const ceCase = dispatcher.slice(
    dispatcher.indexOf('case "cancellable-export"'),
    dispatcher.indexOf('case "cancellable-export"') + 200,
  );
  expect(ceCase).toContain("return getCancellableExportCodeProps()");

  const source = readFileSync(
    "lib/generated/demo-code-props/cancellable-export.ts",
    "utf8",
  );
  // Props shape — multi-section workbench
  expect(source).toContain("workflowCode: string");
  expect(source).toContain("workflowLinesHtml: string[]");
  expect(source).toContain("stepCodes: string[]");
  expect(source).toContain("stepLinesHtml: string[][]");
  expect(source).toContain("sectionNames: string[]");
  expect(source).toContain("sectionContent: string[]");
  expect(source).toContain("highlightLineMap: HighlightLineMap");
  // Line map builder
  expect(source).toContain("buildHighlightLineMap(workflowCode)");
  expect(source).toContain('findLineNumbers(code, "await generateSection(")');
  // sectionNames has real content, not empty array
  expect(source).toContain('"Introduction"');
  expect(source).toContain('"Market Analysis"');
  expect(source).toContain('"Conclusion"');
  // sectionContent has real content
  expect(source).toContain("European market");
  expect(source).toContain("GDPR");
});

// ---------------------------------------------------------------------------
// Preserved module fail-fast tests
// ---------------------------------------------------------------------------

test("generator fails fast with machine-parseable error when a preserved module is missing", () => {
  // Ensure clean state first
  runGenerator();

  // Temporarily remove one preserved module
  const target = "lib/generated/demo-code-props/saga.ts";
  const backup = readFileSync(target, "utf8");
  fsRmSync(target, { force: true });

  let exitCode = 0;
  let stderr = "";
  try {
    execSync("bun .scripts/generate-native-gallery.ts", {
      stdio: ["pipe", "pipe", "pipe"],
    });
  } catch (err: unknown) {
    const e = err as { status: number; stderr: Buffer };
    exitCode = e.status;
    stderr = e.stderr.toString();
  }

  // Restore the preserved module so subsequent tests work
  writeFileSync(target, backup);
  // Re-run generator to restore all generated files
  runGenerator();

  expect(exitCode).not.toBe(0);
  expect(stderr).toContain("missing_preserved_code_props_module");
  expect(stderr).toContain("saga");
  expect(stderr).toContain("lib/generated/demo-code-props/saga.ts");
});
