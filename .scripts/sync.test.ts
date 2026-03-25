import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";

type SpawnResponse = {
  exitCode?: number;
  stdout?: string;
  stderr?: string;
};

type SpawnHandler = SpawnResponse | ((cmd: string[]) => SpawnResponse);

const originalSpawnSync = Bun.spawnSync;
const originalRequire = globalThis.require;
const originalConsoleLog = console.log;

let importCounter = 0;

function makeSpawnResult(response: SpawnResponse) {
  return {
    exitCode: response.exitCode ?? 0,
    stdout: Buffer.from(response.stdout ?? ""),
    stderr: Buffer.from(response.stderr ?? ""),
  } as ReturnType<typeof Bun.spawnSync>;
}

function installSpawnQueue(queue: SpawnHandler[]) {
  const calls: string[][] = [];

  Bun.spawnSync = ((cmd: string[]) => {
    calls.push([...cmd]);
    const next = queue.shift();
    if (!next) {
      throw new Error(`Unexpected spawnSync call: ${cmd.join(" ")}`);
    }

    const response = typeof next === "function" ? next(cmd) : next;
    return makeSpawnResult(response);
  }) as typeof Bun.spawnSync;

  return calls;
}

function setPromptInput(text: string) {
  globalThis.require = ((id: string) => {
    if (id === "fs") {
      return {
        readSync: (_fd: number, buffer: Uint8Array) => {
          const bytes = Buffer.from(text);
          buffer.set(bytes.subarray(0, buffer.length));
          return Math.min(bytes.length, buffer.length);
        },
      };
    }

    return originalRequire(id);
  }) as typeof require;
}

function captureOutput() {
  const messages: string[] = [];

  console.log = ((...args: unknown[]) => {
    messages.push(args.map(String).join(" "));
  }) as typeof console.log;

  return messages;
}

function createFsMock(options?: {
  demos?: string[];
  statSync?: (path: string) => unknown;
  existsSync?: (path: string) => boolean;
}) {
  return {
    existsSync: options?.existsSync ?? (() => false),
    readdirSync: () => options?.demos ?? [],
    rmSync: () => {},
    statSync: options?.statSync ?? ((path: string) => {
      if (path.endsWith("package.json")) {
        return {};
      }

      return {};
    }),
  };
}

async function importSyncModule(fsMock?: ReturnType<typeof createFsMock>) {
  if (fsMock) {
    mock.module("fs", () => fsMock);
  }

  return import(`./sync.ts?test=${importCounter++}`);
}

beforeEach(() => {
  process.exitCode = 0;
});

afterEach(() => {
  mock.restore();
  Bun.spawnSync = originalSpawnSync;
  globalThis.require = originalRequire;
  console.log = originalConsoleLog;
  process.exitCode = 0;
});

describe("sync.ts", () => {
  test("getSubtreeArgs adds ignore-joins when a slug needs extra subtree flags", async () => {
    const mod = await importSyncModule();

    expect(mod.getSubtreeArgs("async-request-reply")).toEqual([
      "--prefix=async-request-reply",
      "--ignore-joins",
    ]);
    expect(mod.getSubtreeArgs("fan-out")).toEqual(["--prefix=fan-out"]);
  });

  test("pushSubtreeIfChanged skips git push when remote main already matches split SHA", async () => {
    const mod = await importSyncModule();
    const calls = installSpawnQueue([
      { stdout: "deadbeef\n" },
      { stdout: "deadbeef\trefs/heads/main\n" },
    ]);

    expect(mod.pushSubtreeIfChanged("fan-out")).toEqual({
      status: "skipped",
      splitSha: "deadbeef",
    });
    expect(calls).toEqual([
      ["git", "subtree", "split", "--prefix=fan-out"],
      ["git", "ls-remote", "workflow-fan-out", "refs/heads/main"],
    ]);
  });

  test("pushSubtreeIfChanged pushes split SHA directly when remote main differs", async () => {
    const mod = await importSyncModule();
    const calls = installSpawnQueue([
      (cmd) => {
        expect(cmd).toEqual([
          "git",
          "subtree",
          "split",
          "--prefix=async-request-reply",
          "--ignore-joins",
        ]);
        return { stdout: "cafebabe\n" };
      },
      { stdout: "deadbeef\trefs/heads/main\n" },
      (cmd) => {
        expect(cmd).toEqual([
          "git",
          "push",
          "workflow-async-request-reply",
          "cafebabe:refs/heads/main",
        ]);
        return { stdout: "" };
      },
    ]);

    expect(mod.pushSubtreeIfChanged("async-request-reply")).toEqual({
      status: "pushed",
      splitSha: "cafebabe",
    });
    expect(calls).toHaveLength(3);
  });

  test("cmdSync aborts push when pull fails and leaves a non-zero exit code", async () => {
    const mod = await importSyncModule();
    const calls = installSpawnQueue([{ exitCode: 1, stderr: "pull exploded" }]);
    const messages = captureOutput();

    mod.cmdSync();

    expect(process.exitCode).toBe(1);
    expect(calls).toEqual([["git", "pull", "origin", "main"]]);
    expect(messages.some((message) => message.includes("Sync aborted because pull failed."))).toBe(true);
  });

  test("cmdPush sets exitCode when any subtree operation fails", async () => {
    const mod = await importSyncModule(createFsMock({ demos: ["fan-out"] }));
    const calls = installSpawnQueue([
      { stdout: "https://github.com/vercel-labs/workflow-fan-out.git\n" },
      { exitCode: 1, stderr: "split failed" },
    ]);
    captureOutput();

    mod.cmdPush();

    expect(process.exitCode).toBe(1);
    expect(calls).toEqual([
      ["git", "remote", "get-url", "workflow-fan-out"],
      ["git", "subtree", "split", "--prefix=fan-out"],
    ]);
  });

  test("cmdPushOne sets exitCode when the selected subtree push fails", async () => {
    const mod = await importSyncModule(createFsMock({ demos: ["fan-out"] }));
    const calls = installSpawnQueue([
      { stdout: "https://github.com/vercel-labs/workflow-fan-out.git\n" },
      { stdout: "https://github.com/vercel-labs/workflow-fan-out.git\n" },
      { exitCode: 1, stderr: "split failed" },
    ]);
    setPromptInput("1\n");
    captureOutput();

    mod.cmdPushOne();

    expect(process.exitCode).toBe(1);
    expect(calls).toEqual([
      ["git", "remote", "get-url", "workflow-fan-out"],
      ["git", "remote", "get-url", "workflow-fan-out"],
      ["git", "subtree", "split", "--prefix=fan-out"],
    ]);
  });

  test("cmdInitNew stops after git remote add failure and marks the run as failed", async () => {
    const mod = await importSyncModule(createFsMock({ demos: ["new-demo"] }));
    const calls = installSpawnQueue([
      { exitCode: 1, stderr: "no remote" },
      { exitCode: 1, stderr: "missing repo" },
      { stdout: "created" },
      { exitCode: 1, stderr: "no remote" },
      { exitCode: 1, stderr: "permission denied" },
    ]);
    setPromptInput("y\n");
    captureOutput();

    mod.cmdInitNew();

    expect(process.exitCode).toBe(1);
    expect(calls).toEqual([
      ["git", "remote", "get-url", "workflow-new-demo"],
      ["gh", "repo", "view", "vercel-labs/workflow-new-demo"],
      ["gh", "repo", "create", "vercel-labs/workflow-new-demo", "--public", "--confirm"],
      ["git", "remote", "get-url", "workflow-new-demo"],
      ["git", "remote", "add", "workflow-new-demo", "https://github.com/vercel-labs/workflow-new-demo.git"],
    ]);
  });

  test("cmdAdd does not print a created message when gh repo create fails", async () => {
    const mod = await importSyncModule(createFsMock({
      statSync: () => {
        throw new Error("missing");
      },
    }));
    const calls = installSpawnQueue([
      { exitCode: 1, stderr: "no remote" },
      { exitCode: 1, stderr: "no remote" },
      { exitCode: 1, stderr: "missing repo" },
      { exitCode: 1, stderr: "create failed" },
    ]);
    setPromptInput("demo\n");
    const messages = captureOutput();

    mod.cmdAdd();

    expect(process.exitCode).toBe(1);
    expect(calls).toEqual([
      ["git", "remote", "get-url", "workflow-demo"],
      ["git", "remote", "get-url", "workflow-demo"],
      ["gh", "repo", "view", "vercel-labs/workflow-demo"],
      ["gh", "repo", "create", "vercel-labs/workflow-demo", "--public", "--confirm"],
    ]);
    expect(messages.some((message) => message.includes("Created vercel-labs/workflow-demo."))).toBe(false);
    expect(messages.some((message) => message.includes("Done! Demo demo is configured."))).toBe(false);
  });

  test("cmdAdd does not print subtree push success when the subtree push fails", async () => {
    const mod = await importSyncModule(createFsMock());
    const calls = installSpawnQueue([
      { exitCode: 1, stderr: "no remote" },
      { exitCode: 1, stderr: "no remote" },
      { exitCode: 1, stderr: "missing repo" },
      { stdout: "created" },
      { stdout: "" },
      { stdout: "cafebabe\n" },
      { stdout: "deadbeef\trefs/heads/main\n" },
      { exitCode: 1, stderr: "push denied" },
    ]);
    setPromptInput("demo\n");
    const messages = captureOutput();

    mod.cmdAdd();

    expect(process.exitCode).toBe(1);
    expect(calls).toEqual([
      ["git", "remote", "get-url", "workflow-demo"],
      ["git", "remote", "get-url", "workflow-demo"],
      ["gh", "repo", "view", "vercel-labs/workflow-demo"],
      ["gh", "repo", "create", "vercel-labs/workflow-demo", "--public", "--confirm"],
      ["git", "remote", "add", "workflow-demo", "https://github.com/vercel-labs/workflow-demo.git"],
      ["git", "subtree", "split", "--prefix=demo"],
      ["git", "ls-remote", "workflow-demo", "refs/heads/main"],
      ["git", "push", "workflow-demo", "cafebabe:refs/heads/main"],
    ]);
    expect(messages.some((message) => message.includes("Subtree pushed"))).toBe(false);
    expect(messages.some((message) => message.includes("Done! Demo demo is configured."))).toBe(false);
  });
});
