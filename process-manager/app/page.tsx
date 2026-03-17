import {
  findBlockLineNumbers,
  findLineNumbers,
  highlightCodeToHtmlLines,
} from "./components/code-highlight-server";
import {
  ProcessManagerDemo,
  type OrchestratorLineMap,
  type StepLineMap,
} from "./components/demo";

const wf = `"use ${"workflow"}"`;
const st = `"use ${"step"}"`;

const orchestratorCode = `import { sleep } from "workflow";

export async function processManager(
  orderId: string,
  items: string[],
  paymentMethod: string,
  simulatePaymentFail = false,
  simulateBackorder = false
) {
  ${wf};

  let currentState = "received";
  let stateTransitions = 0;

  // Step 1: Initialize order
  currentState = await initializeOrder(order, currentState);
  stateTransitions++;

  // Step 2: Validate payment — branches on success/failure
  const paymentResult = await validatePayment(order, currentState);
  stateTransitions++;

  if (paymentResult === "payment_failed") {
    const summary = await cancelOrder(order, paymentResult, stateTransitions);
    return summary;
  }
  currentState = paymentResult;

  // Step 3: Check inventory — branches on available/backorder
  const inventoryResult = await checkInventory(order, currentState);
  stateTransitions++;

  if (inventoryResult === "backordered") {
    await sleep("5s");
    const recheckResult = await recheckInventory(order, "backordered");
    stateTransitions++;
    currentState = recheckResult;
  } else {
    currentState = inventoryResult;
  }

  // Step 4: Reserve inventory
  currentState = await reserveInventory(order, currentState);
  stateTransitions++;

  // Step 5: Ship order
  currentState = await shipOrder(order, currentState);
  stateTransitions++;

  // Step 6: Confirm delivery
  currentState = await confirmDelivery(order, currentState);
  stateTransitions++;

  // Step 7: Complete order
  return completeOrder(order, currentState, stateTransitions);
}`;

const stepCode = `async function initializeOrder(order, currentState) {
  ${st};
  // Set order state to "received", emit state_transition event
  return "received";
}

async function validatePayment(order, currentState) {
  ${st};
  // Validate payment method; returns "payment_validated" or "payment_failed"
  if (order.simulatePaymentFail) return "payment_failed";
  return "payment_validated";
}

async function checkInventory(order, currentState) {
  ${st};
  // Check stock levels; returns "inventory_checked" or "backordered"
  if (order.simulateBackorder) return "backordered";
  return "inventory_checked";
}

async function recheckInventory(order, currentState) {
  ${st};
  // Re-check after backorder wait — inventory now available
  return "inventory_checked";
}

async function reserveInventory(order, currentState) {
  ${st};
  // Reserve items in warehouse
  return "inventory_reserved";
}

async function shipOrder(order, currentState) {
  ${st};
  // Ship order and generate tracking ID
  return "shipped";
}

async function confirmDelivery(order, currentState) {
  ${st};
  // Await and confirm delivery
  return "delivery_confirmed";
}

async function completeOrder(order, currentState, stateTransitions) {
  ${st};
  // Finalize order, emit summary with tracking info
  return { orderId, finalState: "completed", stateTransitions };
}

async function cancelOrder(order, currentState, stateTransitions) {
  ${st};
  // Cancel order due to payment failure
  return { orderId, finalState: "cancelled", stateTransitions };
}`;

const orchestratorHtmlLines = highlightCodeToHtmlLines(orchestratorCode);
const stepHtmlLines = highlightCodeToHtmlLines(stepCode);

const orchestratorLineMap: OrchestratorLineMap = {
  initializeOrder: findLineNumbers(orchestratorCode, "await initializeOrder("),
  validatePayment: findLineNumbers(orchestratorCode, "await validatePayment("),
  paymentFailedBranch: findBlockLineNumbers(
    orchestratorCode,
    'if (paymentResult === "payment_failed")'
  ),
  cancelOrder: findLineNumbers(orchestratorCode, "await cancelOrder("),
  checkInventory: findLineNumbers(orchestratorCode, "await checkInventory("),
  backorderBranch: findBlockLineNumbers(
    orchestratorCode,
    'if (inventoryResult === "backordered")'
  ),
  sleepBackorder: findLineNumbers(orchestratorCode, 'await sleep("5s")'),
  recheckInventory: findLineNumbers(orchestratorCode, "await recheckInventory("),
  reserveInventory: findLineNumbers(orchestratorCode, "await reserveInventory("),
  shipOrder: findLineNumbers(orchestratorCode, "await shipOrder("),
  confirmDelivery: findLineNumbers(orchestratorCode, "await confirmDelivery("),
  completeOrder: findLineNumbers(orchestratorCode, "return completeOrder("),
};

const stepLineMap: StepLineMap = {
  initializeOrder: findBlockLineNumbers(stepCode, "async function initializeOrder("),
  validatePayment: findBlockLineNumbers(stepCode, "async function validatePayment("),
  checkInventory: findBlockLineNumbers(stepCode, "async function checkInventory("),
  recheckInventory: findBlockLineNumbers(stepCode, "async function recheckInventory("),
  reserveInventory: findBlockLineNumbers(stepCode, "async function reserveInventory("),
  shipOrder: findBlockLineNumbers(stepCode, "async function shipOrder("),
  confirmDelivery: findBlockLineNumbers(stepCode, "async function confirmDelivery("),
  completeOrder: findBlockLineNumbers(stepCode, "async function completeOrder("),
  cancelOrder: findBlockLineNumbers(stepCode, "async function cancelOrder("),
};

export default function Home() {
  return (
    <div className="min-h-screen bg-background-100 p-8 text-gray-1000">
      <main id="main-content" className="mx-auto max-w-5xl" role="main">
        <header className="mb-16">
          <div className="mb-4 inline-flex items-center rounded-full border border-teal-700/40 bg-teal-700/20 px-3 py-1 text-sm font-medium text-teal-700">
            Workflow DevKit Example
          </div>
          <h1 className="mb-4 text-5xl font-semibold tracking-tight text-gray-1000">
            Process Manager
          </h1>
          <p className="max-w-3xl text-lg text-gray-900">
            Orchestrate a multi-step order fulfillment process as a stateful
            state machine. The process manager reacts to intermediate results,
            handles backorder timeouts with{" "}
            <code className="rounded border border-gray-300 bg-background-200 px-2 py-0.5 font-mono text-sm">
              sleep()
            </code>
            , and makes branching decisions — cancelling on payment failure or
            waiting and rechecking when inventory is backordered.
          </p>
        </header>

        <section aria-labelledby="try-it-heading" className="mb-16">
          <h2 id="try-it-heading" className="mb-4 text-2xl font-semibold tracking-tight">
            Try It
          </h2>
          <div className="rounded-lg border border-gray-400 bg-background-200 p-6">
            <ProcessManagerDemo
              orchestratorCode={orchestratorCode}
              orchestratorHtmlLines={orchestratorHtmlLines}
              orchestratorLineMap={orchestratorLineMap}
              stepCode={stepCode}
              stepHtmlLines={stepHtmlLines}
              stepLineMap={stepLineMap}
            />
          </div>
        </section>

        <footer
          className="border-t border-gray-400 py-6 text-center text-sm text-gray-900"
          role="contentinfo"
        >
          <a
            href="https://useworkflow.dev/"
            className="underline underline-offset-2 transition-colors hover:text-gray-1000 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-700/60 focus-visible:ring-offset-2 focus-visible:ring-offset-background-100"
            target="_blank"
            rel="noopener noreferrer"
          >
            Workflow DevKit Docs
          </a>
        </footer>
      </main>
    </div>
  );
}
