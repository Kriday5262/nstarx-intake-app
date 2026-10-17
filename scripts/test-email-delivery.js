/**
 * Live SendGrid delivery check for the NStarX Intake app.
 *
 * Runs the app's real email code path (lib/email.ts + lib/email-templates.ts)
 * against the live SendGrid API and reports the message IDs SendGrid returns.
 * Nothing is mocked: if SENDGRID_API_KEY is missing or invalid the script fails
 * loudly instead of silently skipping.
 *
 * Usage:
 *   node ./scripts/test-email-delivery.js
 *   EMAIL_TEST_RECIPIENT=someone@example.com node ./scripts/test-email-delivery.js
 *
 * Safety: the default recipient is the placeholder address used for all
 * test/dev traffic. Never point this at a real NStarX staff mailbox.
 */

const fs = require("fs");
const path = require("path");

const envPath = path.join(__dirname, "..", ".env");
if (fs.existsSync(envPath)) {
  const text = fs.readFileSync(envPath, "utf8");
  for (const line of text.split(/\r?\n/)) {
    const m = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (m && process.env[m[1]] === undefined) {
      process.env[m[1]] = m[2];
    }
  }
}

require("esbuild-register/dist/node").register({
  target: "node20",
  format: "cjs",
  platform: "node",
});

const emailModule = require("../lib/email");

const RECIPIENT = process.env.EMAIL_TEST_RECIPIENT || "shantanu@kamkazi.com";
const key = (process.env.SENDGRID_API_KEY || "").trim();

let failures = 0;
function assert(name, condition, details = "") {
  if (condition) {
    console.log(`PASS: ${name}`);
  } else {
    failures++;
    console.error(`FAIL: ${name}${details ? " — " + details : ""}`);
  }
}

const sampleRequest = {
  id: 0,
  publicReference: `NSX-EMAILCHECK-${Date.now()}`,
  fullName: "Email Delivery Check",
  email: RECIPIENT,
  projectType: "Presentation",
  projectTitle: "Email delivery verification",
  description:
    "Automated delivery check for the NStarX Intake form email integration. Safe to ignore.",
  desiredDeadline: null,
  priority: "Medium",
  status: "Submitted",
  dueDate: null,
  internalNotes: null,
  submittedAt: new Date(),
};

async function main() {
  if (!key) {
    console.error(
      "FAIL: SENDGRID_API_KEY is empty. Email delivery is DISABLED; " +
        "no admin notification or submitter confirmation will be sent."
    );
    process.exit(1);
  }

  const sgMail = require("@sendgrid/mail");
  sgMail.setApiKey(key);

  // Validate the key before sending anything.
  const scopesResponse = await fetch("https://api.sendgrid.com/v3/scopes", {
    headers: { Authorization: `Bearer ${key}` },
  });
  assert(
    "SendGrid API key is valid (GET /v3/scopes == 200)",
    scopesResponse.status === 200,
    `status=${scopesResponse.status}`
  );
  if (scopesResponse.status !== 200) {
    process.exit(1);
  }

  const captures = [];
  emailModule.setEmailClient({
    setApiKey() {},
    async send(data) {
      const result = await sgMail.send(data);
      captures.push({ kind: "submitter-confirmation", data, result });
      return result;
    },
    async sendMultiple(data) {
      const result = await sgMail.sendMultiple(data);
      captures.push({ kind: "admin-notification", data, result });
      return result;
    },
  });

  console.log(`Sending live test email through the app's mail module to ${RECIPIENT}`);
  await emailModule.sendAdminNotification(sampleRequest, []);
  await emailModule.sendSubmitterConfirmation(sampleRequest);

  assert(
    "admin notification was handed to SendGrid",
    captures.some((c) => c.kind === "admin-notification")
  );
  assert(
    "submitter confirmation was handed to SendGrid",
    captures.some((c) => c.kind === "submitter-confirmation")
  );

  for (const capture of captures) {
    const response = capture.result[0] || {};
    const headers = response.headers || {};
    const messageId =
      headers["x-message-id"] || headers["X-Message-Id"] || "unknown";
    const recipients = Array.isArray(capture.data.to)
      ? capture.data.to.join(",")
      : capture.data.to;
    console.log(
      `  ${capture.kind}: status=${response.statusCode} to=${recipients} from=${capture.data.from} subject="${capture.data.subject}" message-id=${messageId}`
    );
    assert(
      `${capture.kind} accepted by SendGrid (202)`,
      response.statusCode === 202,
      `status=${response.statusCode}`
    );
    assert(
      `${capture.kind} subject is set`,
      typeof capture.data.subject === "string" && capture.data.subject.length > 0
    );
  }

  console.log(
    failures === 0
      ? "\nAll live delivery checks passed — check the recipient inbox for two messages."
      : `\n${failures} live delivery check(s) failed.`
  );
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error("Unexpected error running the live delivery check:", err);
  process.exit(1);
});
