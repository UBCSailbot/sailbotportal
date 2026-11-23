import { APPLICATION_PRIORITIES, PRIORITY_LABELS } from '@/lib/applications/queries';
import { digestLinks, INACTIVE_AFTER_DAYS, type TeamDigest } from '@/lib/applications/digest';

/**
 * The daily digest emails, as content only: a subject, an HTML body and a
 * plain-text body. Nothing here sends anything or reads the environment, so the
 * send route decides who gets what and where it goes.
 *
 * Two emails from one building block. A lead gets their own team's section; an
 * admin gets every team's section, one after another, each under the team's
 * name. Both say the same thing about a team, because they are the same section.
 *
 * PLAIN HTML WITH INLINE STYLES. Email clients ignore stylesheets and most of
 * modern CSS, so this is paragraphs, a list and links, and nothing the app's
 * Tailwind tokens could reach. Every value from the database is escaped.
 */

export type DigestEmail = { subject: string; html: string; text: string };

export type TeamDigestForEmail = {
  team: { name: string; slug: string };
  digest: TeamDigest;
};

/**
 * @param siteUrl the app's address (e.g. `http://localhost:3000`). The board
 *                links in the digest are paths, and an email needs full URLs.
 */
export function renderLeadDigestEmail(
  { team, digest }: TeamDigestForEmail,
  siteUrl: string,
): DigestEmail {
  const section = teamSection({ team, digest }, siteUrl);
  const day = digest.newApplicants.to;

  return {
    subject: `${team.name} daily digest, ${day}`,
    html: page(`<h1 style="${H1}">${escapeHtml(team.name)} daily digest</h1>${section.html}`),
    text: `${team.name} daily digest, ${day}\n\n${section.text}`,
  };
}

/** One email, one section per team, in the order given. */
export function renderAdminDigestEmail(
  teams: TeamDigestForEmail[],
  siteUrl: string,
  /** The day every digest is for. Passed in so an admin with no teams still gets a dated subject. */
  day: string,
): DigestEmail {
  const sections = teams.map((entry) => ({
    name: entry.team.name,
    ...teamSection(entry, siteUrl),
  }));

  const html =
    sections.length === 0
      ? `<p style="${P}">There are no team boards to report on.</p>`
      : sections
          .map((section) => `<h2 style="${H2}">${escapeHtml(section.name)}</h2>${section.html}`)
          .join('');
  const text =
    sections.length === 0
      ? 'There are no team boards to report on.'
      : sections.map((section) => `${section.name}\n${section.text}`).join('\n\n');

  return {
    subject: `Daily digest, all teams, ${day}`,
    html: page(`<h1 style="${H1}">Daily digest, all teams</h1>${html}`),
    text: `Daily digest, all teams, ${day}\n\n${text}`,
  };
}

/**
 * One team's part of a digest. A zero still gets its sentence, so the email
 * reads the same every day and a missing line never has to be interpreted.
 */
function teamSection(
  { team, digest }: TeamDigestForEmail,
  siteUrl: string,
): { html: string; text: string } {
  const links = digestLinks(team.slug, digest);
  const newUrl = new URL(links.newApplicants, siteUrl).toString();
  const inactiveUrl = new URL(links.inactive, siteUrl).toString();

  const newCount = digest.newApplicants.count;
  const newSentence =
    newCount === 0
      ? 'No new applicants since yesterday.'
      : `${plural(newCount, 'new applicant')} since yesterday.`;

  const inactiveCount = digest.inactive.count;
  const inactiveSentence =
    inactiveCount === 0
      ? `No applicants waiting in Applied for ${INACTIVE_AFTER_DAYS}+ days.`
      : `${plural(inactiveCount, 'applicant')} waiting in Applied for ${INACTIVE_AFTER_DAYS}+ days.`;

  const priorities = [
    ...APPLICATION_PRIORITIES.map((priority) => ({
      label: PRIORITY_LABELS[priority],
      count: digest.priorityCounts[priority],
    })),
    { label: 'None', count: digest.priorityCounts.none },
  ];
  const priorityText = priorities.map(({ label, count }) => `${label}: ${count}`).join(', ');

  return {
    html:
      `<ul style="${UL}">` +
      `<li style="${LI}"><a href="${escapeHtml(newUrl)}" style="${A}">${newSentence}</a></li>` +
      `<li style="${LI}"><a href="${escapeHtml(inactiveUrl)}" style="${A}">${inactiveSentence}</a></li>` +
      `</ul>` +
      `<p style="${P}">Open applications by priority: ${priorityText}.</p>`,
    text:
      `- ${newSentence}\n  ${newUrl}\n` +
      `- ${inactiveSentence}\n  ${inactiveUrl}\n` +
      `Open applications by priority: ${priorityText}.`,
  };
}

function plural(count: number, noun: string): string {
  return `${count} ${noun}${count === 1 ? '' : 's'}`;
}

function page(body: string): string {
  return `<!doctype html><html><body style="${BODY}">${body}</body></html>`;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

const BODY = 'margin:0;padding:24px;font-family:Arial,Helvetica,sans-serif;color:#1f2937;';
const H1 = 'margin:0 0 16px;font-size:20px;';
const H2 = 'margin:24px 0 8px;font-size:16px;';
const UL = 'margin:0 0 8px;padding-left:20px;';
const LI = 'margin:0 0 4px;font-size:14px;';
const P = 'margin:0;font-size:14px;';
const A = 'color:#1d4ed8;';
