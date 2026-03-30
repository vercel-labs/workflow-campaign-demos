"use client";

import Link from "next/link";
import { demos } from "@/lib/demos";
import type { DemoCatalogEntry } from "@/lib/demos";
import { getDemoApis, getApiColorClasses } from "@/lib/api-taxonomy";
import { useState, useMemo, useCallback } from "react";

/**
 * V7 — Step-by-Step Wizard
 *
 * Progressive narrowing: each question halves the candidate set.
 * User sees how many demos remain at each step. Can back up or restart.
 * Final step shows the matching demos as cards.
 */

type Choice = {
  label: string;
  description: string;
  filter: (d: DemoCatalogEntry) => boolean;
};

type Question = {
  id: string;
  title: string;
  subtitle: string;
  choices: Choice[];
};

const questions: Question[] = [
  {
    id: "primary-need",
    title: "What's your primary need?",
    subtitle: "Start with the broad category that best describes your workflow.",
    choices: [
      {
        label: "Coordinate multiple steps",
        description:
          "Chain tasks, fan out to workers, or orchestrate complex flows",
        filter: (d) =>
          d.tags.some((t) =>
            ["orchestration", "async", "data-processing"].includes(t)
          ),
      },
      {
        label: "Handle errors gracefully",
        description: "Retry, circuit-break, compensate, or quarantine failures",
        filter: (d) => d.tags.includes("resilience"),
      },
      {
        label: "Route or transform messages",
        description:
          "Filter, split, translate, or route data to the right handler",
        filter: (d) =>
          d.tags.some((t) => ["messaging", "routing"].includes(t)),
      },
      {
        label: "Involve humans or time",
        description:
          "Wait for approvals, schedule tasks, or pause for external signals",
        filter: (d) =>
          d.tags.some((t) =>
            ["human-in-the-loop", "scheduling", "integration"].includes(t)
          ),
      },
    ],
  },
  {
    id: "human-involvement",
    title: "Does a human need to interact?",
    subtitle: "Some workflows pause for approvals, reviews, or cancellations.",
    choices: [
      {
        label: "Yes — approvals or manual input",
        description: "A person must approve, reject, or provide data mid-flow",
        filter: (d) => d.tags.includes("human-in-the-loop"),
      },
      {
        label: "No — fully automated",
        description: "The workflow runs start to finish without human input",
        filter: (d) => !d.tags.includes("human-in-the-loop"),
      },
    ],
  },
  {
    id: "timing",
    title: "Does timing matter?",
    subtitle: "Some patterns involve delays, schedules, or waiting for signals.",
    choices: [
      {
        label: "Yes — delays or schedules",
        description: "Sleep, poll, send drip emails, or wait for a time window",
        filter: (d) => {
          const apis = getDemoApis(d.slug).map((a) => a.id);
          return (
            apis.includes("sleep") || d.tags.includes("scheduling")
          );
        },
      },
      {
        label: "Yes — wait for external signals",
        description:
          "Pause until a webhook, callback, or human action arrives",
        filter: (d) => {
          const apis = getDemoApis(d.slug).map((a) => a.id);
          return apis.includes("defineHook");
        },
      },
      {
        label: "No — run immediately",
        description: "Process as fast as possible, no waiting",
        filter: (d) => {
          const apis = getDemoApis(d.slug).map((a) => a.id);
          return (
            !apis.includes("sleep") &&
            !apis.includes("defineHook") &&
            !d.tags.includes("scheduling")
          );
        },
      },
    ],
  },
  {
    id: "parallelism",
    title: "How many things happen at once?",
    subtitle: "Some patterns run tasks in parallel, others process sequentially.",
    choices: [
      {
        label: "Parallel — fan out to multiple workers",
        description: "Scatter-gather, map-reduce, or broadcast to many targets",
        filter: (d) =>
          ["fan-out", "scatter-gather", "map-reduce", "aggregator", "recipient-list", "publish-subscribe"].includes(d.slug) ||
          d.description.toLowerCase().includes("parallel"),
      },
      {
        label: "Sequential — one step at a time",
        description: "Pipeline, chain, saga, or step-by-step processing",
        filter: (d) =>
          ["pipeline", "saga", "approval-chain", "routing-slip", "process-manager", "choreography"].includes(d.slug) ||
          d.description.toLowerCase().includes("sequence"),
      },
      {
        label: "Either — doesn't matter",
        description: "Show me everything that matched so far",
        filter: () => true,
      },
    ],
  },
];

export default function V7Page() {
  const [answers, setAnswers] = useState<number[]>([]);

  const { currentCandidates, stepCandidates } = useMemo(() => {
    let candidates = [...demos];
    const perStep: DemoCatalogEntry[][] = [candidates];

    for (let i = 0; i < answers.length; i++) {
      const question = questions[i];
      const choice = question.choices[answers[i]];
      candidates = candidates.filter(choice.filter);
      perStep.push(candidates);
    }

    return { currentCandidates: candidates, stepCandidates: perStep };
  }, [answers]);

  const currentStep = answers.length;
  const isDone = currentStep >= questions.length || currentCandidates.length <= 5;
  const currentQuestion = questions[currentStep];

  const choose = useCallback(
    (choiceIndex: number) => {
      setAnswers((prev) => [...prev, choiceIndex]);
    },
    []
  );

  const goBack = useCallback(() => {
    setAnswers((prev) => prev.slice(0, -1));
  }, []);

  const restart = useCallback(() => {
    setAnswers([]);
  }, []);

  // Preview how many candidates each choice would leave
  const choiceCounts = useMemo(() => {
    if (!currentQuestion) return [];
    return currentQuestion.choices.map(
      (choice) => currentCandidates.filter(choice.filter).length
    );
  }, [currentQuestion, currentCandidates]);

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
          Find Your Pattern
        </h1>
        <p className="mx-auto mt-5 max-w-xl text-base leading-relaxed text-gray-1000/70">
          Answer a few questions and we&apos;ll narrow down the {demos.length}{" "}
          demos to exactly what you need.
        </p>
      </header>

      {/* Progress bar */}
      <div className="mb-10">
        <div className="flex items-center gap-2 mb-3">
          {questions.map((q, i) => (
            <div
              key={q.id}
              className={`h-1 flex-1 rounded-full transition-colors ${
                i < currentStep
                  ? "bg-blue-700"
                  : i === currentStep && !isDone
                    ? "bg-blue-700/40"
                    : "bg-gray-300"
              }`}
            />
          ))}
        </div>
        <div className="flex items-center justify-between">
          <p className="text-xs font-mono text-gray-400">
            Step {Math.min(currentStep + 1, questions.length)} of{" "}
            {questions.length}
          </p>
          <p className="text-xs font-mono text-gray-1000/60">
            {currentCandidates.length} demo
            {currentCandidates.length !== 1 ? "s" : ""} remaining
          </p>
        </div>
      </div>

      {/* Breadcrumb of past answers */}
      {answers.length > 0 && (
        <div className="mb-8 flex flex-wrap gap-2">
          {answers.map((answerIdx, stepIdx) => (
            <button
              key={stepIdx}
              onClick={() => setAnswers((prev) => prev.slice(0, stepIdx))}
              className="inline-flex items-center gap-1.5 rounded-full border border-blue-700/30 bg-blue-700/10 px-3 py-1 text-xs font-mono text-blue-700 hover:bg-blue-700/20 transition-colors"
            >
              <span className="text-blue-700/50">{stepIdx + 1}.</span>
              {questions[stepIdx].choices[answerIdx].label}
              <svg
                width="10"
                height="10"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="3"
                className="opacity-50"
              >
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>
          ))}
          <button
            onClick={restart}
            className="text-xs font-mono text-gray-400 hover:text-gray-1000 transition-colors px-2 py-1"
          >
            Start over
          </button>
        </div>
      )}

      {/* Current question */}
      {!isDone && currentQuestion && (
        <div className="mb-10">
          <h2 className="text-2xl font-semibold text-gray-1000 mb-2">
            {currentQuestion.title}
          </h2>
          <p className="text-sm text-gray-1000/60 mb-6">
            {currentQuestion.subtitle}
          </p>
          <div className="grid gap-3">
            {currentQuestion.choices.map((choice, i) => (
              <button
                key={i}
                onClick={() => choose(i)}
                disabled={choiceCounts[i] === 0}
                className={`group relative text-left rounded-xl border p-5 transition-all ${
                  choiceCounts[i] === 0
                    ? "border-gray-300/50 opacity-40 cursor-not-allowed"
                    : "border-gray-300 bg-background-200 hover:border-blue-700 hover:bg-blue-700/5"
                }`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h3 className="text-base font-semibold text-gray-1000 group-hover:text-blue-700 transition-colors">
                      {choice.label}
                    </h3>
                    <p className="mt-1 text-sm text-gray-1000/60">
                      {choice.description}
                    </p>
                  </div>
                  <span className="shrink-0 rounded-full border border-gray-300 px-2.5 py-0.5 text-xs font-mono text-gray-1000/50 tabular-nums">
                    {choiceCounts[i]}
                  </span>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Results */}
      {(isDone || currentCandidates.length <= 8) && (
        <div>
          <h2 className="text-xl font-semibold text-gray-1000 mb-1">
            {isDone
              ? `Your matches`
              : `Top matches so far`}
          </h2>
          <p className="text-sm text-gray-1000/60 mb-6">
            {currentCandidates.length} demo
            {currentCandidates.length !== 1 ? "s" : ""} match your criteria.
          </p>
          <div className="grid gap-3">
            {currentCandidates.map((demo) => {
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
        </div>
      )}
    </main>
  );
}
