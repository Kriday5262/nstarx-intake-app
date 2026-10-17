/**
 * Lightweight unit-test harness for lib/email.ts and lib/email-templates.ts.
 * Compiles the TS modules with esbuild-register so we can run tests without
 * pre-building. Does not require a test framework dependency, since npm
 * install is blocked by the local security scanner in single-query mode.
 *
 * Run with: node ./scripts/test-email.js
 */

process.env.SENDGRID_API_KEY = process.env.SENDGRID_API_KEY || "test-key";
process.env.ADMIN_NOTIFY_EMAILS =
  process.env.ADMIN_NOTIFY_EMAILS ||
  "admin-a@example.com,admin-b@example.com";
process.env.SENDGRID_FROM_EMAIL =
  process.env.SENDGRID_FROM_EMAIL || "noreply@example.com";
process.env.NEXT_PUBLIC_BASE_URL =
  process.env.NEXT_PUBLIC_BASE_URL || "https://nstarx-intake.kamkazi.com";

require("esbuild-register/dist/node").register({
  target: "node20",
  format: "cjs",
  platform: "node",
});

const emailModule = require("../lib/email");
const templateModule = require("../lib/email-templates");

const sampleRequest = {
  id: 1,
  publicReference: "NSX-20261016-001",
  fullName: "Jane Doe",
  email: "jane.doe@example.com",
  projectType: "Deck Redesign",
  projectTitle: "Q4 Brand Refresh Deck",
  description:
    "We need the Q4 brand refresh presentation redesigned to match the new NStarX visual identity. It should be clean, modern, and use the approved purple/lime color palette.\n\nPlease include editable source files.",
  desiredDeadline: new Date("2026-11-15T00:00:00.000Z"),
  priority: "High",
  status: "Submitted",
  dueDate: null,
  internalNotes: null,
  submittedAt: new Date("2026-10-16T10:00:00.000Z"),
};

const sampleAttachments = [
  {
    id: "a1",
    requestId: 1,
    originalFilename: "brand-brief.pdf",
    storedPath: "/tmp/uploads/1/uuid1_brand-brief.pdf",
    mimeType: "application/pdf",
    sizeBytes: 1024 * 1024 * 2.5,
  },
  {
    id: "a2",
    requestId: 1,
    originalFilename: "logo.png",
    storedPath: "/tmp/uploads/1/uuid2_logo.png",
    mimeType: "image/png",
    sizeBytes: 1024 * 450,
  },
];

let failures = 0;
function assert(name, condition, details = "") {
  if (!condition) {
    failures++;
    console.error(`FAIL: ${name}${details ? " — " + details : ""}`);
  } else {
    console.log(`PASS: ${name}`);
  }
}

function run() {
  console.log("Running email template tests...\n");

  const admin = templateModule.renderAdminNotificationEmail(
    sampleRequest,
    sampleAttachments,
  );
  assert(
    "admin notification subject contains reference and title",
    admin.subject.includes("NSX-20261016-001") &&
      admin.subject.includes("Q4 Brand Refresh Deck"),
  );
  assert(
    "admin notification html contains all submitted fields",
    admin.html.includes("Jane Doe") &&
      admin.html.includes("jane.doe@example.com") &&
      admin.html.includes("Deck Redesign") &&
      admin.html.includes("Q4 Brand Refresh Deck") &&
      admin.html.includes("NStarX visual identity") &&
      admin.html.includes("November 15, 2026") &&
      admin.html.includes("High") &&
      admin.html.includes("Submitted"),
  );
  assert(
    "admin notification html lists attachment filenames and sizes",
    admin.html.includes("brand-brief.pdf") &&
      admin.html.includes("logo.png") &&
      admin.html.includes("2.5 MB") &&
      admin.html.includes("450.0 KB"),
  );
  assert(
    "admin notification html has dashboard deep link",
    admin.html.includes('href="https://nstarx-intake.kamkazi.com/dashboard/requests/1"'),
  );
  assert("admin notification plain text body present", admin.text.length > 0);

  const confirm = templateModule.renderSubmitterConfirmationEmail(sampleRequest);
  assert(
    "submitter confirmation subject contains reference",
    confirm.subject.includes("NSX-20261016-001"),
  );
  assert(
    "submitter confirmation html greets submitter",
    confirm.html.includes("Hi Jane Doe"),
  );
  assert(
    "submitter confirmation html shows reference number",
    confirm.html.includes("NSX-20261016-001"),
  );
  assert(
    "submitter confirmation html includes status page link",
    confirm.html.includes(
      'href="https://nstarx-intake.kamkazi.com/status?ref=NSX-20261016-001',
    ) && confirm.html.includes("jane.doe%40example.com"),
  );

  const injectionRequest = {
    ...sampleRequest,
    fullName: "<script>alert(1)</script>",
  };
  const escaped = templateModule.renderAdminNotificationEmail(injectionRequest, []);
  assert(
    "HTML special characters are escaped",
    escaped.html.includes("&lt;script&gt;alert(1)&lt;/script&gt;") &&
      !escaped.html.includes("<script>alert(1)</script>"),
  );

  console.log("\nRunning email service tests...\n");

  const sentCalls = [];
  const sentMultipleCalls = [];

  const mockClient = {
    send: async (data) => {
      sentCalls.push(data);
      return [{ statusCode: 202, body: {}, headers: {} }];
    },
    sendMultiple: async (data) => {
      sentMultipleCalls.push(data);
      return [{ statusCode: 202, body: {}, headers: {} }];
    },
  };

  emailModule.setEmailClient(mockClient);

  (async () => {
    await emailModule.sendSubmitterConfirmation(sampleRequest);
    assert(
      "sendSubmitterConfirmation uses submitter email",
      sentCalls.length === 1 && sentCalls[0].to === "jane.doe@example.com",
    );
    assert(
      "sendSubmitterConfirmation sets correct from address",
      sentCalls[0].from === "noreply@example.com",
    );
    assert(
      "sendSubmitterConfirmation payload has html, text, subject",
      sentCalls[0].html && sentCalls[0].text && sentCalls[0].subject,
    );

    await emailModule.sendAdminNotification(sampleRequest, sampleAttachments);
    assert(
      "sendAdminNotification uses all admin recipients",
      sentMultipleCalls.length === 1 &&
        sentMultipleCalls[0].to.includes("admin-a@example.com") &&
        sentMultipleCalls[0].to.includes("admin-b@example.com"),
    );
    assert(
      "sendAdminNotification includes attachments in SendGrid format",
      sentMultipleCalls[0].attachments.length === 2 &&
        sentMultipleCalls[0].attachments[0].filename === "brand-brief.pdf",
    );

    const sampleComment = {
      actorName: "Shantanu",
      actorEmail: "shantanu.chaturvedi@nstarxinc.com",
      content:
        "Let's finalize the color palette before moving this into production. I've left notes in the drive folder.",
    };

    await emailModule.sendCommentNotification(
      { id: 1, projectTitle: sampleRequest.projectTitle, publicReference: sampleRequest.publicReference },
      sampleComment
    );
    assert(
      "sendCommentNotification sends to all admin recipients",
      sentMultipleCalls.length === 2 &&
        sentMultipleCalls[1].to.includes("admin-a@example.com") &&
        sentMultipleCalls[1].to.includes("admin-b@example.com"),
    );
    assert(
      "sendCommentNotification subject includes reference and title",
      sentMultipleCalls[1].subject.includes("NSX-20261016-001") &&
        sentMultipleCalls[1].subject.includes("Q4 Brand Refresh Deck"),
    );
    assert(
      "sendCommentNotification body contains actor, preview, and dashboard link",
      sentMultipleCalls[1].html.includes("Shantanu commented on") &&
        sentMultipleCalls[1].html.includes("color palette") &&
        sentMultipleCalls[1].html.includes('href="https://nstarx-intake.kamkazi.com/dashboard/requests/1"'),
    );

    // Missing API key path.
    delete process.env.SENDGRID_API_KEY;
    emailModule.resetEmailClient();
    const originalWarn = console.warn;
    const warnings = [];
    console.warn = (...args) => warnings.push(args.join(" "));

    await emailModule.sendSubmitterConfirmation(sampleRequest);
    assert(
      "missing API key logs warning and does not throw",
      warnings.some((w) => w.includes("SendGrid API key not configured")),
    );
    assert(
      "missing API key does not call SendGrid",
      sentCalls.length === 1,
    );

    console.warn = originalWarn;

    console.log("\n" + (failures === 0 ? "All tests passed." : `${failures} test(s) failed.`));
    process.exit(failures === 0 ? 0 : 1);
  })().catch((err) => {
    console.error("Unexpected error running tests:", err);
    process.exit(1);
  });
}

run();
