"use client";

import Link from "next/link";
import { demos } from "@/lib/demos";
import type { DemoCatalogEntry } from "@/lib/demos";
import { getDemoApis, getApiColorClasses } from "@/lib/api-taxonomy";
import { HOME_TITLE, GALLERY_TITLE } from "@/lib/page-titles";
import { useState, useMemo, useCallback } from "react";

/**
 * Home page — Workflow API Finder
 *
 * Decision tree that guides users through branching questions
 * to find the right workflow pattern. Result cards lead with
 * the real-world scenario, with technical details as subtext.
 */

type Branch = {
  label: string;
  icon: string;
  slugs?: string[];
  next?: TreeNode;
};

type TreeNode = {
  id: string;
  question: string;
  branches: Branch[];
};

const tree: TreeNode = {
  id: "root",
  question: "I want to\u2026",
  branches: [
    {
      label: "Process payments & orders",
      icon: "$",
      next: {
        id: "payments",
        question: "What happens if a step fails?",
        branches: [
          {
            label: "Roll back everything automatically",
            icon: "↩",
            slugs: ["saga"],
          },
          {
            label: "Let services react independently",
            icon: "⚡",
            slugs: ["choreography"],
          },
          {
            label: "Orchestrate with branching logic",
            icon: "◈",
            slugs: ["process-manager", "pipeline"],
          },
          {
            label: "Make sure nothing gets lost",
            icon: "✓",
            slugs: [
              "guaranteed-delivery",
              "transactional-outbox",
              "idempotent-receiver",
            ],
          },
        ],
      },
    },
    {
      label: "Approve or review something",
      icon: "✋",
      next: {
        id: "approve",
        question: "How many approvers?",
        branches: [
          {
            label: "One person",
            icon: "1",
            slugs: ["approval-gate", "cancellable-export"],
          },
          {
            label: "A chain of approvers",
            icon: "⋯",
            slugs: ["approval-chain", "scheduler-agent-supervisor"],
          },
        ],
      },
    },
    {
      label: "Handle flaky APIs",
      icon: "↻",
      next: {
        id: "flaky",
        question: "What's going wrong?",
        branches: [
          {
            label: "Random failures or timeouts",
            icon: "⚠",
            slugs: ["retry-backoff"],
          },
          {
            label: "Rate limited (429s)",
            icon: "⊘",
            slugs: ["retryable-rate-limit", "throttle"],
          },
          {
            label: "Service is fully down",
            icon: "✕",
            slugs: ["circuit-breaker", "bulkhead"],
          },
          {
            label: "Too slow, need a faster fallback",
            icon: "⏱",
            slugs: ["hedge-request", "dead-letter-queue"],
          },
        ],
      },
    },
    {
      label: "Send notifications & alerts",
      icon: "→",
      next: {
        id: "notify",
        question: "How should they be sent?",
        branches: [
          {
            label: "All at once, in parallel",
            icon: "⫘",
            slugs: ["fan-out", "publish-subscribe"],
          },
          {
            label: "Only to matching recipients",
            icon: "⑂",
            slugs: ["recipient-list"],
          },
          {
            label: "Spread out over days or weeks",
            icon: "◴",
            slugs: ["onboarding-drip", "wakeable-reminder"],
          },
          {
            label: "Batched into a digest",
            icon: "▤",
            slugs: ["scheduled-digest"],
          },
        ],
      },
    },
    {
      label: "Wait for a webhook or callback",
      icon: "↓",
      next: {
        id: "wait",
        question: "What are you waiting for?",
        branches: [
          {
            label: "An async API response",
            icon: "⇄",
            slugs: ["async-request-reply", "request-reply"],
          },
          {
            label: "An inbound webhook",
            icon: "↓",
            slugs: ["webhook-basics", "claim-check"],
          },
          {
            label: "Multiple signals to converge",
            icon: "⊕",
            slugs: ["event-gateway"],
          },
          {
            label: "A job to finish (polling)",
            icon: "◴",
            slugs: ["status-poller"],
          },
        ],
      },
    },
    {
      label: "Process data in bulk",
      icon: "▤",
      next: {
        id: "bulk",
        question: "What's the shape of the work?",
        branches: [
          {
            label: "Linear pipeline (A then B then C)",
            icon: "▸",
            slugs: ["pipeline", "batch-processor"],
          },
          {
            label: "Parallel map, then merge results",
            icon: "⊕",
            slugs: ["map-reduce", "scatter-gather", "aggregator"],
          },
          {
            label: "Split one payload into many",
            icon: "⫘",
            slugs: ["splitter", "resequencer"],
          },
          {
            label: "Many workers competing for items",
            icon: "⊙",
            slugs: ["competing-consumers", "priority-queue"],
          },
        ],
      },
    },
    {
      label: "Route to the right handler",
      icon: "⑂",
      next: {
        id: "route",
        question: "What's the main operation?",
        branches: [
          {
            label: "Branch based on message content",
            icon: "◈",
            slugs: ["content-based-router", "detour"],
          },
          {
            label: "Dynamic route list per request",
            icon: "⋯",
            slugs: ["routing-slip", "recipient-list"],
          },
          {
            label: "Transform or normalize the format",
            icon: "⇄",
            slugs: ["message-translator", "normalizer", "content-enricher"],
          },
          {
            label: "Filter out noise before processing",
            icon: "✕",
            slugs: ["message-filter"],
          },
        ],
      },
    },
    {
      label: "Observe & audit the flow",
      icon: "◎",
      slugs: [
        "wire-tap",
        "message-history",
        "correlation-identifier",
        "event-sourcing",
        "namespaced-streams",
      ],
    },
  ],
};

function getDemo(slug: string) {
  return demos.find((d) => d.slug === slug);
}

type PathEntry = { nodeId: string; branchIndex: number };

export default function HomePage() {
  const [path, setPath] = useState<PathEntry[]>([]);

  const { currentNode, resultSlugs } = useMemo(() => {
    let node: TreeNode | undefined = tree;
    let slugs: string[] | undefined;

    for (const entry of path) {
      if (!node) break;
      const branch: Branch = node.branches[entry.branchIndex];
      if (branch.slugs) {
        slugs = branch.slugs;
        node = undefined;
      } else if (branch.next) {
        node = branch.next;
      }
    }

    return { currentNode: node, resultSlugs: slugs };
  }, [path]);

  const chooseBranch = useCallback(
    (branchIndex: number) => {
      if (!currentNode) return;
      setPath((prev) => [
        ...prev,
        { nodeId: currentNode.id, branchIndex },
      ]);
    },
    [currentNode]
  );

  const goToStep = useCallback((stepIndex: number) => {
    setPath((prev) => prev.slice(0, stepIndex));
  }, []);

  const restart = useCallback(() => setPath([]), []);

  const breadcrumbs = useMemo(() => {
    const crumbs: { label: string; icon: string }[] = [];
    let node: TreeNode | undefined = tree;
    for (const entry of path) {
      if (!node) break;
      const branch: Branch = node.branches[entry.branchIndex];
      crumbs.push({ label: branch.label, icon: branch.icon });
      node = branch.next;
    }
    return crumbs;
  }, [path]);

  const resultDemos = useMemo(() => {
    if (!resultSlugs) return [];
    return resultSlugs
      .map((s) => getDemo(s))
      .filter((d): d is DemoCatalogEntry => d != null);
  }, [resultSlugs]);

  return (
    <main
      id="main-content"
      className="min-h-screen px-6 pt-20 pb-20 mx-auto max-w-3xl"
    >
      <header className="mb-12 text-center">
        <h1 className="text-5xl font-semibold leading-[1.02] tracking-tight text-gray-1000 sm:text-6xl">
          {HOME_TITLE}
        </h1>
        <p className="mx-auto mt-5 max-w-xl text-base leading-relaxed text-gray-1000/70">
          Answer a few questions to find the right pattern from{" "}
          {demos.length} Workflow DevKit demos. Each result includes a live
          interactive demo and full source code.
        </p>
      </header>

      {/* Breadcrumb path */}
      {breadcrumbs.length > 0 && (
        <div className="mb-8 flex flex-wrap items-center gap-2">
          <button
            onClick={restart}
            className="text-xs font-mono text-gray-400 hover:text-gray-1000 transition-colors"
          >
            Start
          </button>
          {breadcrumbs.map((crumb, i) => (
            <div key={i} className="flex items-center gap-2">
              <span className="text-gray-400">→</span>
              <button
                onClick={() => goToStep(i + 1)}
                className="inline-flex items-center gap-1.5 rounded-full border border-blue-700/30 bg-blue-700/10 px-3 py-1 text-xs font-mono text-blue-700 hover:bg-blue-700/20 transition-colors"
              >
                <span>{crumb.icon}</span>
                {crumb.label}
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Current question with branches */}
      {currentNode && !resultSlugs && (
        <div className="mb-10">
          <h2 className="text-2xl font-semibold text-gray-1000 mb-6">
            {currentNode.question}
          </h2>
          <div className="grid gap-3">
            {currentNode.branches.map((branch, i) => (
              <button
                key={i}
                onClick={() => chooseBranch(i)}
                className="group text-left rounded-xl border border-gray-300 bg-background-200 p-5 transition-all hover:border-blue-700 hover:bg-blue-700/5"
              >
                <div className="flex items-center gap-4">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-gray-300 bg-background-100 text-lg group-hover:border-blue-700/40 group-hover:bg-blue-700/10 transition-colors">
                    {branch.icon}
                  </span>
                  <div>
                    <h3 className="text-base font-semibold text-gray-1000 group-hover:text-blue-700 transition-colors">
                      {branch.label}
                    </h3>
                    {branch.slugs && (
                      <p className="mt-0.5 text-xs font-mono text-gray-400">
                        {branch.slugs.length} demo
                        {branch.slugs.length !== 1 ? "s" : ""}
                      </p>
                    )}
                    {branch.next && (
                      <p className="mt-0.5 text-xs font-mono text-gray-400">
                        More choices →
                      </p>
                    )}
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Results — scenario-first cards */}
      {resultSlugs && (
        <div>
          <h2 className="text-xl font-semibold text-gray-1000 mb-1">
            Here&apos;s what fits
          </h2>
          <p className="text-sm text-gray-1000/60 mb-6">
            {resultDemos.length} demo{resultDemos.length !== 1 ? "s" : ""}{" "}
            match your path.
          </p>
          <div className="grid gap-4">
            {resultDemos.map((demo) => {
              const apis = getDemoApis(demo.slug);
              return (
                <Link
                  key={demo.slug}
                  href={`/demos/${demo.slug}`}
                  className="group flex flex-col rounded-xl border border-gray-300 bg-background-200 p-6 transition-all hover:border-gray-400 hover:bg-gray-100"
                >
                  {/* Scenario is the headline */}
                  <p className="text-base leading-relaxed text-gray-1000">
                    {demo.whenToUse}
                  </p>

                  {/* Technical details as subtext */}
                  <div className="mt-4 flex items-start justify-between gap-4">
                    <div>
                      <h3 className="text-sm font-mono font-medium text-gray-1000/50 group-hover:text-blue-700 transition-colors">
                        {demo.title}
                      </h3>
                      <p className="mt-1 text-xs text-gray-1000/40 line-clamp-2">
                        {demo.description}
                      </p>
                    </div>
                    <svg
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="shrink-0 mt-0.5 text-gray-400 opacity-0 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all"
                    >
                      <path d="M9 18l6-6-6-6" />
                    </svg>
                  </div>

                  {/* API pills */}
                  {apis.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {apis.map((api) => {
                        const colors = getApiColorClasses(api);
                        return (
                          <span
                            key={api.id}
                            className={`rounded-full border px-2 py-0.5 text-[11px] font-mono ${colors.badge}`}
                          >
                            {api.label}
                          </span>
                        );
                      })}
                    </div>
                  )}
                </Link>
              );
            })}
          </div>

          <div className="mt-8 flex items-center gap-4">
            <button
              onClick={restart}
              className="text-sm font-mono text-gray-400 hover:text-gray-1000 transition-colors"
            >
              ← Start over
            </button>
            <Link
              href="/explore"
              className="text-sm font-mono text-gray-400 hover:text-gray-1000 transition-colors"
            >
              {GALLERY_TITLE} →
            </Link>
          </div>
        </div>
      )}
    </main>
  );
}
