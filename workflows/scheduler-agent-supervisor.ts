// getWritable is used here to stream demo UI events.
// A production workflow wouldn't need these unless it has its own streaming UI.
import { getWritable, sleep } from "workflow";

const SUPERVISOR_AGENTS = [
  { id: "fast-model", label: "Fast Model" },
  { id: "thorough-model", label: "Thorough Model" },
  { id: "premium-model", label: "Premium Model" },
] as const;

export type SupervisorAgentId = (typeof SUPERVISOR_AGENTS)[number]["id"];
export type QualityThreshold = "low" | "medium" | "high";

const QUALITY_THRESHOLD_SCORE: Record<QualityThreshold, number> = {
  low: 65,
  medium: 80,
  high: 92,
};

const AGENT_QUALITY_SCORE: Record<SupervisorAgentId, number> = {
  "fast-model": 68,
  "thorough-model": 82,
  "premium-model": 89,
};

// Demo: simulate real-world latency so the UI can show progress.
const AGENT_GENERATION_MS: Record<SupervisorAgentId, number> = {
  "fast-model": 1400,
  "thorough-model": 2100,
  "premium-model": 2800,
};

const QUALITY_CHECK_MS = 600;
const PUBLISH_MS = 700;

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export type SupervisorEvent =
  | { type: "agent_dispatched"; agentId: SupervisorAgentId; agentIndex: number; label: string }
  | { type: "agent_generating"; agentId: SupervisorAgentId; progressPct: number }
  | { type: "agent_generated"; agentId: SupervisorAgentId }
  | { type: "quality_check"; agentId: SupervisorAgentId }
  | { type: "quality_result"; agentId: SupervisorAgentId; score: number; requiredScore: number; passed: boolean }
  | { type: "cooldown"; fromAgentId: SupervisorAgentId; toAgentId: SupervisorAgentId; reason: string }
  | { type: "publishing"; agentId: SupervisorAgentId }
  | { type: "done"; publishedBy: SupervisorAgentId; publicationId: string; qualityScore: number }
  | { type: "failed"; reason: string };

type DispatchResult = {
  agentId: SupervisorAgentId;
  topic: string;
  draft: string;
  estimatedScore: number;
};

type QualityGateResult = {
  score: number;
  requiredScore: number;
  passed: boolean;
  reason: string;
};

type PublishResult = {
  publicationId: string;
};

type RerouteRecord = {
  from: SupervisorAgentId;
  to: SupervisorAgentId;
  reason: string;
  cooldown: "2s";
};

export type SchedulerAgentSupervisorResult =
  | {
      status: "published";
      topic: string;
      threshold: QualityThreshold;
      requiredScore: number;
      qualityScore: number;
      publishedBy: SupervisorAgentId;
      publicationId: string;
      reroutes: RerouteRecord[];
    }
  | {
      status: "failed";
      topic: string;
      threshold: QualityThreshold;
      requiredScore: number;
      reroutes: RerouteRecord[];
    };

export async function schedulerAgentSupervisor(
  topic: string,
  threshold: QualityThreshold = "medium"
): Promise<SchedulerAgentSupervisorResult> {
  "use workflow";

  const normalizedTopic = topic.trim();
  const requiredScore = QUALITY_THRESHOLD_SCORE[threshold];
  const reroutes: RerouteRecord[] = [];

  for (let agentIndex = 0; agentIndex < SUPERVISOR_AGENTS.length; agentIndex += 1) {
    const agent = SUPERVISOR_AGENTS[agentIndex];

    const draft = await dispatchToAgent(agent.id, normalizedTopic, agentIndex);
    const quality = await checkQuality(draft, requiredScore);

    if (quality.passed) {
      const published = await publishContent(draft, quality);

      return {
        status: "published",
        topic: normalizedTopic,
        threshold,
        requiredScore,
        qualityScore: quality.score,
        publishedBy: agent.id,
        publicationId: published.publicationId,
        reroutes,
      };
    }

    const nextAgent = SUPERVISOR_AGENTS[agentIndex + 1];
    if (!nextAgent) {
      break;
    }

    const rerouteReason = `${agent.id} score ${quality.score} below ${quality.requiredScore}`;
    reroutes.push({
      from: agent.id,
      to: nextAgent.id,
      reason: rerouteReason,
      cooldown: "2s",
    });

    await emitCooldown(agent.id, nextAgent.id, rerouteReason);
    await sleep("2s");
  }

  await emitFailed("all_agents_failed_quality");

  return {
    status: "failed",
    topic: normalizedTopic,
    threshold,
    requiredScore,
    reroutes,
  };
}

async function dispatchToAgent(
  agentId: SupervisorAgentId,
  topic: string,
  agentIndex: number
): Promise<DispatchResult> {
  "use step";

  const writer = getWritable<SupervisorEvent>().getWriter();
  const estimatedScore = AGENT_QUALITY_SCORE[agentId];
  const agentDef = SUPERVISOR_AGENTS.find((a) => a.id === agentId)!;

  try {
    await writer.write({
      type: "agent_dispatched",
      agentId,
      agentIndex,
      label: agentDef.label,
    });

    // Demo: simulate generation with progress ticks
    const genMs = AGENT_GENERATION_MS[agentId];
    const tickCount = 5;
    const tickMs = genMs / tickCount;
    for (let tick = 1; tick <= tickCount; tick++) {
      await delay(tickMs);
      await writer.write({
        type: "agent_generating",
        agentId,
        progressPct: Math.round((tick / tickCount) * 100),
      });
    }

    await writer.write({ type: "agent_generated", agentId });

    const draft = `Draft ${agentIndex + 1} for topic "${topic}" by ${agentId}`;
    return { agentId, topic, draft, estimatedScore };
  } finally {
    writer.releaseLock();
  }
}

async function checkQuality(
  draft: DispatchResult,
  requiredScore: number
): Promise<QualityGateResult> {
  "use step";

  const writer = getWritable<SupervisorEvent>().getWriter();

  try {
    await writer.write({ type: "quality_check", agentId: draft.agentId });
    await delay(QUALITY_CHECK_MS);

    const score = draft.estimatedScore;
    const passed = score >= requiredScore;
    const reason = passed
      ? `Score ${score} passed threshold ${requiredScore}`
      : `Score ${score} below threshold ${requiredScore}`;

    await writer.write({
      type: "quality_result",
      agentId: draft.agentId,
      score,
      requiredScore,
      passed,
    });

    return { score, requiredScore, passed, reason };
  } finally {
    writer.releaseLock();
  }
}

async function publishContent(
  draft: DispatchResult,
  quality: QualityGateResult
): Promise<PublishResult> {
  "use step";

  const writer = getWritable<SupervisorEvent>().getWriter();

  try {
    await writer.write({ type: "publishing", agentId: draft.agentId });
    await delay(PUBLISH_MS);

    const publicationId = `pub_${draft.agentId}_${Date.now().toString(36)}`;

    await writer.write({
      type: "done",
      publishedBy: draft.agentId,
      publicationId,
      qualityScore: quality.score,
    });

    return { publicationId };
  } finally {
    writer.releaseLock();
  }
}

async function emitCooldown(
  fromAgentId: SupervisorAgentId,
  toAgentId: SupervisorAgentId,
  reason: string
): Promise<void> {
  "use step";
  const writer = getWritable<SupervisorEvent>().getWriter();
  try {
    await writer.write({ type: "cooldown", fromAgentId, toAgentId, reason });
  } finally {
    writer.releaseLock();
  }
}

emitCooldown.maxRetries = 0;

async function emitFailed(reason: string): Promise<void> {
  "use step";
  const writer = getWritable<SupervisorEvent>().getWriter();
  try {
    await writer.write({ type: "failed", reason });
  } finally {
    writer.releaseLock();
  }
}

emitFailed.maxRetries = 0;
