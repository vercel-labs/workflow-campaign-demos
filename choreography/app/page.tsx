import {
  findBlockLineNumbers,
  findLineNumbers,
  highlightCodeToHtmlLines,
} from "./components/code-highlight-server";
import {
  ChoreographyDemo,
  type FlowLineMap,
  type ParticipantLineMap,
} from "./components/demo";

const wf = `"use ${"workflow"}"`;
const st = `"use ${"step"}"`;

const flowCode = `import { sleep } from "workflow";
import { FatalError } from "workflow";

export async function choreography(
  orderId: string,
  items: OrderItem[],
  failService: string | null
) {
  ${wf};

  const correlationId = \`COR-\${orderId}\`;

  // Participant 1: Order Service places the order
  const orderPlaced = await orderServicePlaceOrder(correlationId, orderId, items);

  // Participant 2: Inventory Service reacts to "order_placed"
  const inventoryResult = await inventoryServiceReserve(
    correlationId, items, failService === "inventory"
  );

  if (!inventoryResult.success) {
    // Compensation: Order Service rolls back
    await orderServiceCompensate(correlationId, orderId, "inventory_failed");
    return finalizeOutcome(correlationId, "compensated", ...);
  }

  // Durable sleep: async handoff latency between participants
  await sleep("3s");

  // Participant 3: Payment Service reacts to "inventory_reserved"
  const paymentResult = await paymentServiceCharge(
    correlationId, orderId, failService === "payment"
  );

  if (!paymentResult.success) {
    // Compensation: unwind inventory + order
    await inventoryServiceCompensate(correlationId, items, "payment_failed");
    await orderServiceCompensate(correlationId, orderId, "payment_failed");
    return finalizeOutcome(correlationId, "compensated", ...);
  }

  // Participant 4: Shipping Service reacts to "payment_processed"
  const shippingResult = await shippingServiceShip(
    correlationId, orderId, items, failService === "shipping"
  );

  if (!shippingResult.success) {
    // Compensation: unwind payment + inventory + order
    await paymentServiceCompensate(correlationId, orderId, "shipping_failed");
    await inventoryServiceCompensate(correlationId, items, "shipping_failed");
    await orderServiceCompensate(correlationId, orderId, "shipping_failed");
    return finalizeOutcome(correlationId, "compensated", ...);
  }

  // All participants succeeded
  return finalizeOutcome(correlationId, "fulfilled", ...);
}`;

const participantCode = `async function orderServicePlaceOrder(correlationId, orderId, items) {
  ${st};
  // Emit "order_placed" event for downstream participants
  // writer.write({ type: "event_emitted", event: "order_placed", ... })
  return { events: 1 };
}

async function inventoryServiceReserve(correlationId, items, simulateFail) {
  ${st};
  // React to "order_placed", reserve stock
  // On failure: emit "inventory_failed", throw FatalError
  // On success: emit "inventory_reserved"
  return { success: true, events: 2 };
}

async function paymentServiceCharge(correlationId, orderId, simulateFail) {
  ${st};
  // React to "inventory_reserved", charge payment
  // On failure: emit "payment_failed", throw FatalError
  // On success: emit "payment_processed"
  return { success: true, events: 2 };
}

async function shippingServiceShip(correlationId, orderId, items, simulateFail) {
  ${st};
  // React to "payment_processed", ship order
  // On failure: emit "shipping_failed", throw FatalError
  // On success: emit "order_shipped"
  return { success: true, events: 2 };
}

async function orderServiceCompensate(correlationId, orderId, reason) {
  ${st};
  // Roll back order placement
  return { events: 1 };
}

async function inventoryServiceCompensate(correlationId, items, reason) {
  ${st};
  // Release reserved stock
  return { events: 1 };
}

async function paymentServiceCompensate(correlationId, orderId, reason) {
  ${st};
  // Refund payment
  return { events: 1 };
}`;

const flowHtmlLines = highlightCodeToHtmlLines(flowCode);
const participantHtmlLines = highlightCodeToHtmlLines(participantCode);

const flowLineMap: FlowLineMap = {
  orderServicePlaceOrder: findLineNumbers(flowCode, "await orderServicePlaceOrder("),
  inventoryServiceReserve: findLineNumbers(flowCode, "await inventoryServiceReserve("),
  sleepHandoff: findLineNumbers(flowCode, 'await sleep("3s")'),
  paymentServiceCharge: findLineNumbers(flowCode, "await paymentServiceCharge("),
  shippingServiceShip: findLineNumbers(flowCode, "await shippingServiceShip("),
  compensationBranch: [
    ...findBlockLineNumbers(flowCode, "if (!inventoryResult.success)"),
    ...findBlockLineNumbers(flowCode, "if (!paymentResult.success)"),
    ...findBlockLineNumbers(flowCode, "if (!shippingResult.success)"),
  ],
  finalizeOutcome: findLineNumbers(flowCode, "return finalizeOutcome("),
};

const participantLineMap: ParticipantLineMap = {
  orderService: findBlockLineNumbers(participantCode, "async function orderServicePlaceOrder("),
  inventoryService: findBlockLineNumbers(participantCode, "async function inventoryServiceReserve("),
  paymentService: findBlockLineNumbers(participantCode, "async function paymentServiceCharge("),
  shippingService: findBlockLineNumbers(participantCode, "async function shippingServiceShip("),
  orderServiceCompensate: findBlockLineNumbers(participantCode, "async function orderServiceCompensate("),
  inventoryServiceCompensate: findBlockLineNumbers(participantCode, "async function inventoryServiceCompensate("),
  paymentServiceCompensate: findBlockLineNumbers(participantCode, "async function paymentServiceCompensate("),
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
            Choreography
          </h1>
          <p className="max-w-3xl text-lg text-gray-900">
            Event-driven choreography where independent participant services
            collaborate without a central coordinator. Each service emits events
            that trigger the next participant, with correlation IDs threading
            through the entire flow. When a participant fails, upstream services
            compensate by rolling back their changes using durable{" "}
            <code className="rounded border border-gray-300 bg-background-200 px-2 py-0.5 font-mono text-sm">
              sleep()
            </code>{" "}
            for async handoffs between participants.
          </p>
        </header>

        <section aria-labelledby="try-it-heading" className="mb-16">
          <h2 id="try-it-heading" className="mb-4 text-2xl font-semibold tracking-tight">
            Try It
          </h2>
          <div className="rounded-lg border border-gray-400 bg-background-200 p-6">
            <ChoreographyDemo
              flowCode={flowCode}
              flowHtmlLines={flowHtmlLines}
              flowLineMap={flowLineMap}
              participantCode={participantCode}
              participantHtmlLines={participantHtmlLines}
              participantLineMap={participantLineMap}
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
