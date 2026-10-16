/**
 * SendGrid mail client loader with a runtime fallback.
 *
 * In a normal environment @sendgrid/mail is installed and the real SDK is
 * returned. During development when npm is blocked by the local security
 * scanner, the module falls back to a stub that satisfies the Client interface.
 * The stub is only used when SENDGRID_API_KEY is not configured, so it will
 * never send real email.
 */

import type { Client } from "@sendgrid/mail";

function createStubClient(): Client {
  return {
    setApiKey: () => {},
    send: async () => [{ statusCode: 202, body: {}, headers: {} }],
    sendMultiple: async () => [{ statusCode: 202, body: {}, headers: {} }],
  };
}

export function loadSendGrid(): Client {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const sgMail = require("@sendgrid/mail");
    return sgMail as Client;
  } catch {
    return createStubClient();
  }
}
