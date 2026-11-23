import 'server-only';
import type { DigestEmail } from './render';

export type OutgoingEmail = DigestEmail & { to: string };

/**
 * Hands one email to the mail server.
 *
 * A STUB FOR NOW. There is no access yet to the organisation's email to set up
 * a provider or its credentials, so this logs what it would have sent and
 * returns. Everything before it (who gets which email, and what it says) is
 * real, so the send route can be exercised end to end.
 *
 * When a provider is set up, this is the only function that changes: connect
 * to it here (SMTP or its API, with settings from the environment) and throw
 * if it refuses the message, so the route counts it as failed.
 */
export async function sendEmail(email: OutgoingEmail): Promise<void> {
  console.info('[digest] email not sent: sending is stubbed', {
    to: email.to,
    subject: email.subject,
  });
}
