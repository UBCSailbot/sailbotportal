import 'server-only';
import { createTransport } from 'nodemailer';
import type { DigestEmail } from './render';

export type OutgoingEmail = DigestEmail & { to: string };

/**
 * STUBS: Mailgun user, password, and domain
 *
 * We need to register a domain with Mailgun that we'll use to send emails.
 * This ensures that the email is not rejected by lead/admin mail servers (must be registered DNS domain)
 *
 * The user and password we'll get as secrets from Mailgun to authorize our request.
 */

// Mail server defined by Mailgun for SMTP connections
const MAILGUN_SERVER = 'smtp.mailgun.org';

// Can either use port 587 with secure=false, requireTLS=true or
// port 465 with secure=true, requireTLS=false (587 recommended default)
const PORT_OPTIONS = { port: 587, secure: false, requireTLS: true };

// TODO: should be changed to use domain we registered with Mailgun
const MAILGUN_DOMAIN = 'stub-mailgun-domain';

/**
 * Mailgun over SMTP with registered domain, user, and password for organization
 *
 * - Port 587 starts unencrypted and upgrades with STARTTLS, which is why
 *   `secure` is false. `requireTLS` refuses to send if that upgrade fails, so
 *   the password never crosses the network in the clear.
 */

const transport = createTransport({
  host: MAILGUN_SERVER,
  ...PORT_OPTIONS,
  auth: { user: process.env.MAILGUN_SMTP_USER, pass: process.env.MAILGUN_SMTP_PASSWORD },
});

/** Any address on the verified domain works; Mailgun does not host it as a mailbox. */
const FROM = `Sailbot Hiring <digest@${MAILGUN_DOMAIN}>`;

/**
 * Hands one email to Mailgun. Throws if Mailgun is not configured yet, or if
 * it refuses the message, so the send route counts it as failed and carries on
 * with the rest.
 */
export async function sendEmail(email: OutgoingEmail): Promise<void> {
  // TODO: make sure that we have env variables and registered Mailgun domain

  await transport.sendMail({
    from: FROM,
    to: email.to,
    subject: email.subject,
    html: email.html,
    text: email.text,
  });
}
