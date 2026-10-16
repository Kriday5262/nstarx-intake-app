/**
 * Minimal SendGrid Mail API typings used by the email module.
 * The full package cannot be installed in this environment because
 * npm is blocked by the local security scanner in single-query mode.
 * These declarations let TypeScript compile and type-check our code.
 * Install @sendgrid/mail in a normal environment to use the real types.
 */

declare module "@sendgrid/mail" {
  export interface Attachment {
    content: string;
    filename: string;
    type?: string;
    disposition?: "attachment" | "inline";
    content_id?: string;
  }

  export interface MailDataRequired {
    to: string | string[];
    from: string;
    subject: string;
    text?: string;
    html?: string;
    attachments?: Attachment[];
    [key: string]: unknown;
  }

  export interface Client {
    setApiKey(apiKey: string): void;
    send(data: MailDataRequired): Promise<{ statusCode: number; body: unknown; headers: unknown }[]>;
    sendMultiple(data: MailDataRequired): Promise<{ statusCode: number; body: unknown; headers: unknown }[]>;
  }

  const client: Client;
  export default client;
}
