import assert from "node:assert/strict";
import test from "node:test";

import { EMAIL_TEMPLATES } from "./email-templates.ts";

test("test_email_templates_include_required_onboarding_sequence", () => {
  assert.equal(EMAIL_TEMPLATES.length, 4);
  assert.deepEqual(
    EMAIL_TEMPLATES.map((template) => template.label),
    [
      "Welcome",
      "Getting Started Tips",
      "Feature Highlights",
      "Follow-up & Feedback",
    ]
  );
  assert.deepEqual(
    EMAIL_TEMPLATES.map((template) => template.day),
    [0, 1, 3, 7]
  );
});

test("test_email_templates_include_subject_preview_and_html_body_content", () => {
  for (const template of EMAIL_TEMPLATES) {
    assert.ok(template.subject.length > 0);
    assert.ok(template.previewText.length > 0);
    assert.ok(template.bodyHtml.length > 0);
    assert.ok(template.bodyHtml.includes("<p"));
  }
});
