type EmailTemplate = {
  id: string;
  day: number;
  label: string;
  scheduleLabel: string;
  subject: string;
  previewText: string;
  bodyHtml: string;
};

export const EMAIL_TEMPLATES: EmailTemplate[] = [
  {
    id: "welcome",
    day: 0,
    label: "Welcome",
    scheduleLabel: "Immediately after signup",
    subject: "Welcome to Workflow DevKit",
    previewText:
      "Your first run is minutes away. Here is what to expect in your first week.",
    bodyHtml: `
      <h3>Welcome to Workflow DevKit</h3>
      <p>Hi there,</p>
      <p>
        Great to have you onboard. Over the next seven days, we will share practical
        examples to help you ship durable workflows with confidence.
      </p>
      <p>
        Start by launching your first onboarding run. You can follow each step, pause
        safely, and resume without losing state.
      </p>
      <p>
        <a href="https://useworkflow.dev/">Open Workflow DevKit</a>
      </p>
      <p>Thanks,<br />Workflow Team</p>
    `.trim(),
  },
  {
    id: "getting-started-tips",
    day: 1,
    label: "Getting Started Tips",
    scheduleLabel: "After 1 day",
    subject: "Getting started tips for your first workflow",
    previewText:
      "Use durable sleep, deterministic steps, and safe retries from day one.",
    bodyHtml: `
      <h3>Three tips for a smoother launch</h3>
      <ul>
        <li>Wrap side effects in steps so retries are isolated.</li>
        <li>Use durable <code>sleep()</code> instead of cron for delayed work.</li>
        <li>Store deterministic identifiers for external callbacks.</li>
      </ul>
      <p>
        These patterns keep your workflows simple while still handling failures and restarts.
      </p>
      <p>
        <a href="https://useworkflow.dev/docs">Browse the docs</a>
      </p>
    `.trim(),
  },
  {
    id: "feature-highlights",
    day: 3,
    label: "Feature Highlights",
    scheduleLabel: "After 3 days",
    subject: "Feature highlights you should try next",
    previewText:
      "Live streams, manual webhooks, and workflow signals in one developer-friendly toolkit.",
    bodyHtml: `
      <h3>What users explore most in week one</h3>
      <p>
        Teams usually start with three features:
      </p>
      <ol>
        <li>Streaming run updates to show live progress</li>
        <li>Webhook waits for human-in-the-loop approval steps</li>
        <li>Durable retries with clear execution logs</li>
      </ol>
      <p>
        You can combine all three without introducing a queue stack.
      </p>
    `.trim(),
  },
  {
    id: "follow-up-feedback",
    day: 7,
    label: "Follow-up & Feedback",
    scheduleLabel: "After 7 days",
    subject: "How did your first workflow week go?",
    previewText:
      "Reply with feedback and tell us what examples you want to see next.",
    bodyHtml: `
      <h3>Thanks for trying Workflow DevKit</h3>
      <p>
        You made it through the first week. We would love to hear what worked,
        what felt confusing, and what you want us to build next.
      </p>
      <p>
        Hit reply with your feedback or share your workflow on X so we can amplify it.
      </p>
      <p>We read every response.</p>
      <p>Team Workflow</p>
    `.trim(),
  },
];
