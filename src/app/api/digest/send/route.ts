import { createHash, timingSafeEqual } from 'node:crypto';
import { NextResponse, type NextRequest } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getTeamDigest } from '@/lib/applications/digest';
import {
  renderAdminDigestEmail,
  renderLeadDigestEmail,
  type DigestEmail,
  type TeamDigestForEmail,
} from '@/lib/digest-email/render';
import { sendEmail, type OutgoingEmail } from '@/lib/digest-email/send';

/**
 * Builds and sends the daily digest emails called on a schedule
 *
 * Endpoint called by Supabase with bearer token secret to ensure that
 * no other actors can call this endpoint.
 *
 * Endpoint checks for bearer token and sends sub-team specific email to
 * all leads; admins get email containing digest for all sub-teams
 *
 * ## Response
 *
 *   200 { day, sent: { leads, admins }, failed: 0, skipped }
 *   401 { error }   — missing or wrong secret
 *   500 { error }   — not configured, or the digest could not be built
 *   502 { day, sent, failed, skipped } — some emails were refused
 */

export const runtime = 'nodejs';

/** Every call sends email; there is nothing to cache or prerender. */
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const secret = process.env.EMAIL_SECRET;
  if (!secret) {
    // Refuse rather than run unprotected.
    console.error('[digest] EMAIL_SECRET is not set; refusing to send');
    return NextResponse.json({ error: 'Digest sending is not configured.' }, { status: 500 });
  }
  if (!hasSecret(request.headers.get('authorization'), secret)) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  }

  const supabase = createAdminClient();
  const now = new Date();
  const day = now.toISOString().slice(0, 10);

  // The links need a full address. The request's own origin is right locally
  // SITE_URL is for when the app sits behind something that changes it
  const siteUrl = process.env.SITE_URL ?? request.nextUrl.origin;

  const [teamsResult, postingsResult, profilesResult] = await Promise.all([
    supabase.from('teams').select('id, name, slug').order('name'),
    supabase.from('postings').select('id, team_id').order('position'),
    supabase.from('profiles').select('email, role, team_id'),
  ]);

  const loadError = teamsResult.error ?? postingsResult.error ?? profilesResult.error;
  if (loadError) {
    console.error('[digest] could not load teams, postings or profiles', {
      message: loadError.message,
    });

    return NextResponse.json({ error: 'Could not build the digest.' }, { status: 500 });
  }

  // Each team's first posting by `position`, the same rule as the board page,
  // so every count describes the board its link opens.
  const postingIdByTeam = new Map<string, string>();
  for (const posting of postingsResult.data ?? []) {
    if (!postingIdByTeam.has(posting.team_id)) postingIdByTeam.set(posting.team_id, posting.id);
  }

  let digests: (TeamDigestForEmail & { teamId: string })[];
  try {
    digests = await Promise.all(
      (teamsResult.data ?? [])
        .filter((team) => postingIdByTeam.has(team.id))
        .map(async (team) => ({
          teamId: team.id,
          team: { name: team.name, slug: team.slug },
          digest: await getTeamDigest(postingIdByTeam.get(team.id)!, now, supabase),
        })),
    );
  } catch {
    // `getTeamDigest` has already logged the detail.
    return NextResponse.json({ error: 'Could not build the digest.' }, { status: 500 });
  }

  const leadEmailByTeam = new Map<string, DigestEmail>(
    digests.map((entry) => [entry.teamId, renderLeadDigestEmail(entry, siteUrl)]),
  );

  const adminEmail = renderAdminDigestEmail(digests, siteUrl, day);

  const outgoing: { role: 'lead' | 'admin'; email: OutgoingEmail }[] = [];

  let skipped = 0;
  for (const profile of profilesResult.data ?? []) {
    if (profile.role === 'admin') {
      outgoing.push({ role: 'admin', email: { ...adminEmail, to: profile.email } });
      continue;
    }

    // A lead with no team, or whose team has no board yet, has nothing to read.
    const leadEmail = profile.team_id ? leadEmailByTeam.get(profile.team_id) : undefined;
    if (leadEmail) {
      outgoing.push({ role: 'lead', email: { ...leadEmail, to: profile.email } });
    } else {
      skipped += 1;
    }
  }

  // One refused email must not stop the rest, so every send is awaited apart.
  const results = await Promise.allSettled(outgoing.map(({ email }) => sendEmail(email)));

  const sent = { leads: 0, admins: 0 };
  let failed = 0;
  results.forEach((result, index) => {
    if (result.status === 'rejected') {
      failed += 1;
      console.error('[digest] email was not sent', { message: String(result.reason) });
    } else if (outgoing[index].role === 'admin') {
      sent.admins += 1;
    } else {
      sent.leads += 1;
    }
  });

  return NextResponse.json({ day, sent, failed, skipped }, { status: failed === 0 ? 200 : 502 });
}

/**
 * `Authorization: Bearer <secret>`, compared in constant time so the response
 * time does not reveal how much of a guess was right. Both sides are hashed
 * first because `timingSafeEqual` needs equal lengths, and comparing lengths
 * directly would leak the secret's.
 */
function hasSecret(header: string | null, secret: string): boolean {
  if (!header?.startsWith('Bearer ')) return false;
  const given = createHash('sha256').update(header.slice('Bearer '.length)).digest();
  const expected = createHash('sha256').update(secret).digest();
  return timingSafeEqual(given, expected);
}
