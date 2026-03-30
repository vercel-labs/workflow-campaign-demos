"use client";

import Link from "next/link";
import { demos } from "@/lib/demos";
import type { DemoCatalogEntry } from "@/lib/demos";
import { getDemoApis, getApiColorClasses } from "@/lib/api-taxonomy";
import { useState, useMemo, useCallback } from "react";

/**
 * V8 — Visual Branching Paths
 *
 * Instead of sequential questions, show a tree of branching cards.
 * Each node shows a question with 2-3 paths. Clicking a path reveals
 * the next level. The tree stays visible so you can see your path
 * and explore alternate branches.
 */

type Branch = {
  label: string;
  icon: string;
  slugs?: string[]; // leaf node — these are the results
  next?: TreeNode; // branch node — continue the tree
};

type TreeNode = {
  id: string;
  question: string;
  branches: Branch[];
};

const tree: TreeNode = {
  id: "root",
  question: "What kind of workflow are you building?",
  branches: [
    {
      label: "Coordinate work",
      icon: "◇",
      next: {
        id: "coordinate",
        question: "How are tasks related?",
        branches: [
          {
            label: "Run in parallel, combine results",
            icon: "⫘",
            next: {
              id: "parallel-type",
              question: "What happens with the results?",
              branches: [
                {
                  label: "Merge into one result",
                  icon: "⊕",
                  slugs: ["aggregator", "scatter-gather", "map-reduce"],
                },
                {
                  label: "Each result is independent",
                  icon: "⊙",
                  slugs: ["fan-out", "publish-subscribe", "recipient-list"],
                },
              ],
            },
          },
          {
            label: "Run in sequence, step by step",
            icon: "→",
            next: {
              id: "sequence-type",
              question: "Is the sequence fixed or dynamic?",
              branches: [
                {
                  label: "Fixed pipeline",
                  icon: "▸",
                  slugs: ["pipeline", "choreography", "process-manager"],
                },
                {
                  label: "Dynamic — determined at runtime",
                  icon: "◈",
                  slugs: ["routing-slip", "content-based-router", "detour"],
                },
                {
                  label: "With rollback if something fails",
                  icon: "↩",
                  slugs: ["saga", "choreography"],
                },
              ],
            },
          },
          {
            label: "React to events as they arrive",
            icon: "⚡",
            slugs: ["event-gateway", "event-sourcing", "choreography"],
          },
        ],
      },
    },
    {
      label: "Handle failures",
      icon: "⚠",
      next: {
        id: "failure-type",
        question: "What's your failure strategy?",
        branches: [
          {
            label: "Retry with backoff",
            icon: "↻",
            slugs: ["retry-backoff", "retryable-rate-limit", "guaranteed-delivery"],
          },
          {
            label: "Stop calling a broken service",
            icon: "⊘",
            slugs: ["circuit-breaker", "bulkhead", "hedge-request"],
          },
          {
            label: "Quarantine bad messages",
            icon: "☐",
            slugs: ["dead-letter-queue", "idempotent-receiver", "transactional-outbox"],
          },
        ],
      },
    },
    {
      label: "Wait for something",
      icon: "◴",
      next: {
        id: "wait-type",
        question: "What are you waiting for?",
        branches: [
          {
            label: "A human to approve or act",
            icon: "✋",
            next: {
              id: "human-type",
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
            label: "An external signal or webhook",
            icon: "↓",
            slugs: [
              "async-request-reply",
              "claim-check",
              "webhook-basics",
              "request-reply",
            ],
          },
          {
            label: "A specific time or delay",
            icon: "⏱",
            slugs: [
              "onboarding-drip",
              "scheduled-digest",
              "status-poller",
              "wakeable-reminder",
              "throttle",
            ],
          },
        ],
      },
    },
    {
      label: "Transform or route data",
      icon: "⊿",
      next: {
        id: "data-type",
        question: "What's the main operation?",
        branches: [
          {
            label: "Transform format or shape",
            icon: "⇄",
            slugs: ["message-translator", "normalizer", "content-enricher"],
          },
          {
            label: "Split, filter, or batch",
            icon: "▤",
            slugs: [
              "splitter",
              "batch-processor",
              "message-filter",
              "resequencer",
            ],
          },
          {
            label: "Route to the right destination",
            icon: "⑂",
            slugs: ["content-based-router", "routing-slip", "recipient-list"],
          },
          {
            label: "Observe or audit the flow",
            icon: "◎",
            slugs: [
              "wire-tap",
              "message-history",
              "correlation-identifier",
              "namespaced-streams",
            ],
          },
        ],
      },
    },
  ],
};

function getDemo(slug: string) {
  return demos.find((d) => d.slug === slug);
}

type PathEntry = { nodeId: string; branchIndex: number };

export default function V8Page() {
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

  // Build the visible path for breadcrumbs
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
    <main className="min-h-screen px-6 pt-20 pb-20 mx-auto max-w-3xl">
      <Link
        href="/explore"
        className="text-sm text-gray-400 hover:text-gray-1000 font-mono transition-colors"
      >
        ← explorations
      </Link>

      <header className="mb-12 mt-6 text-center">
        <h1 className="text-5xl font-semibold tracking-tight text-gray-1000 sm:text-6xl">
          Workflow API Explorer
        </h1>
        <p className="mx-auto mt-5 max-w-xl text-base leading-relaxed text-gray-1000/70">
          Follow the branches to find the right workflow pattern. Each choice
          narrows the options.
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

      {/* Results */}
      {resultSlugs && (
        <div>
          <h2 className="text-xl font-semibold text-gray-1000 mb-1">
            Recommended patterns
          </h2>
          <p className="text-sm text-gray-1000/60 mb-6">
            {resultDemos.length} demo{resultDemos.length !== 1 ? "s" : ""}{" "}
            match your path.
          </p>
          <div className="grid gap-3">
            {resultDemos.map((demo) => {
              const apis = getDemoApis(demo.slug);
              return (
                <Link
                  key={demo.slug}
                  href={`/demos/${demo.slug}`}
                  className="group flex flex-col rounded-xl border border-gray-300 bg-background-200 p-5 transition-all hover:border-gray-400 hover:bg-gray-100"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="text-base font-semibold text-gray-1000 group-hover:text-blue-700 transition-colors">
                        {demo.title}
                      </h3>
                      <p className="mt-1 text-sm text-gray-1000/70">
                        {demo.description}
                      </p>
                      <p className="mt-2 text-xs text-gray-1000/50">
                        <span className="font-mono text-cyan-700">
                          scenario
                        </span>{" "}
                        {demo.whenToUse}
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
                      className="shrink-0 mt-1 text-gray-400 opacity-0 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all"
                    >
                      <path d="M9 18l6-6-6-6" />
                    </svg>
                  </div>
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
                </Link>
              );
            })}
          </div>

          <button
            onClick={restart}
            className="mt-8 text-sm font-mono text-gray-400 hover:text-gray-1000 transition-colors"
          >
            ← Start over
          </button>
        </div>
      )}
    </main>
  );
}
