import { getWritable, sleep } from "workflow";

export type DetourEvent =
  | { type: "pipeline_started"; deployId: string; qaMode: boolean }
  | { type: "step_running"; deployId: string; step: string }
  | { type: "step_complete"; deployId: string; step: string; result: string }
  | { type: "detour_entered"; deployId: string }
  | { type: "detour_exited"; deployId: string }
  | { type: "done"; deployId: string; totalSteps: number; qaMode: boolean };

export interface DetourResult {
  deployId: string;
  totalSteps: number;
  qaMode: boolean;
  status: "done";
}

// Demo timing
const STEP_DELAY_MS = 600;
const QA_STEP_DELAY_MS = 800;

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function detourFlow(
  deployId: string,
  qaMode: boolean = false
): Promise<DetourResult> {
  "use workflow";

  let stepCount = 0;

  // Step 1: Emit pipeline start
  await emitEvent({ type: "pipeline_started", deployId, qaMode });

  // Step 2: Build
  stepCount += await runBuild(deployId);

  // Step 3: Lint
  stepCount += await runLint(deployId);

  // Step 4: Conditional detour — QA stages only when qaMode is true
  if (qaMode) {
    stepCount += await runQaDetour(deployId);
  }

  // Step 5: Deploy
  stepCount += await runDeploy(deployId);

  // Step 6: Emit completion
  await emitEvent({ type: "done", deployId, totalSteps: stepCount, qaMode });

  return { deployId, totalSteps: stepCount, qaMode, status: "done" };
}

async function runBuild(deployId: string): Promise<number> {
  "use step";

  const writer = getWritable<DetourEvent>().getWriter();
  try {
    await writer.write({ type: "step_running", deployId, step: "build" });
    await delay(STEP_DELAY_MS);
    await writer.write({
      type: "step_complete",
      deployId,
      step: "build",
      result: "Build succeeded — 42 modules compiled",
    });
    return 1;
  } finally {
    writer.releaseLock();
  }
}

async function runLint(deployId: string): Promise<number> {
  "use step";

  const writer = getWritable<DetourEvent>().getWriter();
  try {
    await writer.write({ type: "step_running", deployId, step: "lint" });
    await delay(STEP_DELAY_MS);
    await writer.write({
      type: "step_complete",
      deployId,
      step: "lint",
      result: "Lint passed — 0 warnings, 0 errors",
    });
    return 1;
  } finally {
    writer.releaseLock();
  }
}

async function runQaDetour(deployId: string): Promise<number> {
  "use step";

  const writer = getWritable<DetourEvent>().getWriter();
  const qaSteps = [
    { step: "qa-review", result: "QA review approved — all acceptance criteria met" },
    { step: "staging-test", result: "Staging tests passed — 128/128 assertions green" },
    { step: "security-scan", result: "Security scan clear — no vulnerabilities found" },
  ];

  try {
    await writer.write({ type: "detour_entered", deployId });

    for (const { step, result } of qaSteps) {
      await writer.write({ type: "step_running", deployId, step });
      await delay(QA_STEP_DELAY_MS);
      await writer.write({ type: "step_complete", deployId, step, result });
    }

    await writer.write({ type: "detour_exited", deployId });
    return qaSteps.length;
  } finally {
    writer.releaseLock();
  }
}

async function runDeploy(deployId: string): Promise<number> {
  "use step";

  const writer = getWritable<DetourEvent>().getWriter();
  try {
    await writer.write({ type: "step_running", deployId, step: "deploy" });
    await delay(STEP_DELAY_MS);
    await writer.write({
      type: "step_complete",
      deployId,
      step: "deploy",
      result: "Deployed to production — v2.4.1 live",
    });
    return 1;
  } finally {
    writer.releaseLock();
  }
}

async function emitEvent(event: DetourEvent): Promise<void> {
  "use step";
  const writer = getWritable<DetourEvent>().getWriter();
  try {
    await writer.write(event);
  } finally {
    writer.releaseLock();
  }
}
