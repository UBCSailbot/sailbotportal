/** @jest-environment node */
import type { SupabaseClient } from '@supabase/supabase-js';
import { adminClient, anonClient, signedInAs } from '@/test/supabase-helpers';

let currentClient: SupabaseClient;
jest.mock('@/lib/supabase/server', () => ({ createClient: async () => currentClient }));
jest.mock('next/cache', () => ({ revalidatePath: jest.fn() }));
import {
  addInterviewTag,
  removeInterviewTag,
  saveInterviewNotesUrl,
} from '@/app/actions/set-interview-metadata';

const admin = adminClient();
const TEAM_SLUGS = ['test-interview-metadata-soft', 'test-interview-metadata-mech'];
const USER_DOMAIN = '@interview-metadata.test';
let softTeam: string, mechTeam: string, posting: string;
let web: string, network: string, inactive: string, mechSubteam: string;
let lead: SupabaseClient,
  colleague: SupabaseClient,
  otherLead: SupabaseClient,
  administrator: SupabaseClient;
let leadId: string;

async function clearFixtures() {
  const teams = await admin.from('teams').select('id').in('slug', TEAM_SLUGS);
  if (teams.error) throw teams.error;
  const ids = (teams.data ?? []).map((t) => t.id);
  if (ids.length) {
    const postings = await admin.from('postings').delete().in('team_id', ids);
    if (postings.error) throw postings.error;
  }
  const users = await admin.auth.admin.listUsers({ perPage: 1000 });
  if (users.error) throw users.error;
  for (const user of users.data.users) {
    if (user.email?.endsWith(USER_DOMAIN)) {
      const removed = await admin.auth.admin.deleteUser(user.id);
      if (removed.error) throw removed.error;
    }
  }
  const removed = await admin.from('teams').delete().in('slug', TEAM_SLUGS);
  if (removed.error) throw removed.error;
}

async function application() {
  const result = await admin
    .from('applications')
    .insert({
      posting_id: posting,
      submission_id: crypto.randomUUID(),
      applicant_name: 'Interview Metadata Test',
      applicant_email: `${crypto.randomUUID()}${USER_DOMAIN}`,
      year_of_study: '2',
      faculty: 'Science',
      home_department: 'CPSC',
      question_schema_snapshot: [],
      ranked_subteams: [],
      status: 'interview_scheduled',
      status_changed_at: '2026-01-01T00:00:00Z',
    })
    .select('id, status, status_changed_at, interview_notes_url')
    .single();
  if (result.error) throw result.error;
  return result.data!;
}

async function tags(id: string) {
  const result = await admin
    .from('application_interview_tags')
    .select('subteam_id')
    .eq('application_id', id);
  if (result.error) throw result.error;
  return result.data ?? [];
}

beforeAll(async () => {
  await clearFixtures();
  const teams = await admin
    .from('teams')
    .insert([
      { name: 'Interview Metadata Software', slug: TEAM_SLUGS[0] },
      { name: 'Interview Metadata Mechanical', slug: TEAM_SLUGS[1] },
    ])
    .select();
  if (teams.error) throw teams.error;
  softTeam = teams.data!.find((t) => t.slug === TEAM_SLUGS[0])!.id;
  mechTeam = teams.data!.find((t) => t.slug === TEAM_SLUGS[1])!.id;
  const subteams = await admin
    .from('subteams')
    .insert([
      { team_id: softTeam, name: 'Website', slug: 'web', code: 'WEB', active: true },
      { team_id: softTeam, name: 'Network', slug: 'network', code: 'NET', active: true },
      { team_id: softTeam, name: 'Inactive', slug: 'inactive', active: false },
      { team_id: mechTeam, name: 'Hull', slug: 'hull', active: true },
    ])
    .select();
  if (subteams.error) throw subteams.error;
  web = subteams.data!.find((t) => t.slug === 'web')!.id;
  network = subteams.data!.find((t) => t.slug === 'network')!.id;
  inactive = subteams.data!.find((t) => t.slug === 'inactive')!.id;
  mechSubteam = subteams.data!.find((t) => t.slug === 'hull')!.id;
  const inserted = await admin
    .from('postings')
    .insert({
      team_id: softTeam,
      slug: 'test-interview-metadata-posting',
      title: 'Interview Metadata Test',
      status: 'open',
    })
    .select('id')
    .single();
  if (inserted.error) throw inserted.error;
  posting = inserted.data!.id;
  lead = await signedInAs({
    email: `lead-${crypto.randomUUID()}${USER_DOMAIN}`,
    role: 'lead',
    teamId: softTeam,
  });
  colleague = await signedInAs({
    email: `colleague-${crypto.randomUUID()}${USER_DOMAIN}`,
    role: 'lead',
    teamId: softTeam,
  });
  otherLead = await signedInAs({
    email: `other-${crypto.randomUUID()}${USER_DOMAIN}`,
    role: 'lead',
    teamId: mechTeam,
  });
  administrator = await signedInAs({
    email: `admin-${crypto.randomUUID()}${USER_DOMAIN}`,
    role: 'admin',
  });
  leadId = (await lead.auth.getUser()).data.user!.id;
}, 30000);
afterAll(clearFixtures);

it('starts old-style applications with no tags and no document link', async () => {
  const row = await application();
  expect(row.interview_notes_url).toBeNull();
  expect(await tags(row.id)).toEqual([]);
});

it('lets own-team leads and admins add/read/remove tags', async () => {
  const row = await application();
  expect(
    (
      await lead
        .from('application_interview_tags')
        .insert({ application_id: row.id, subteam_id: web })
    ).error,
  ).toBeNull();
  const ownRead = await lead
    .from('application_interview_tags')
    .select('subteam_id')
    .eq('application_id', row.id);
  expect(ownRead.error).toBeNull();
  expect(ownRead.data).toEqual([{ subteam_id: web }]);
  expect(
    (
      await administrator
        .from('application_interview_tags')
        .insert({ application_id: row.id, subteam_id: network })
    ).error,
  ).toBeNull();
  expect(
    (
      await administrator
        .from('application_interview_tags')
        .delete()
        .eq('application_id', row.id)
        .eq('subteam_id', web)
    ).error,
  ).toBeNull();
  expect(await tags(row.id)).toEqual([{ subteam_id: network }]);
});

it('denies anonymous access and other-team reads, inserts, and removals', async () => {
  const row = await application();
  await lead
    .from('application_interview_tags')
    .insert({ application_id: row.id, subteam_id: web })
    .throwOnError();
  const anon = anonClient();
  expect(
    (await anon.from('application_interview_tags').select('*').eq('application_id', row.id)).error,
  ).not.toBeNull();
  expect(
    (
      await anon
        .from('application_interview_tags')
        .insert({ application_id: row.id, subteam_id: network })
    ).error,
  ).not.toBeNull();
  expect(
    (await anon.from('application_interview_tags').delete().eq('application_id', row.id)).error,
  ).not.toBeNull();
  expect(
    (await otherLead.from('application_interview_tags').select('*').eq('application_id', row.id))
      .data,
  ).toEqual([]);
  expect(
    (
      await otherLead
        .from('application_interview_tags')
        .insert({ application_id: row.id, subteam_id: network })
    ).error,
  ).not.toBeNull();
  const removed = await otherLead
    .from('application_interview_tags')
    .delete()
    .eq('application_id', row.id)
    .select();
  expect(removed.error).toBeNull();
  expect(removed.data).toEqual([]);
  expect(await tags(row.id)).toEqual([{ subteam_id: web }]);
});

it('rejects wrong-team and inactive subteams even for an admin', async () => {
  const row = await application();
  for (const client of [lead, administrator]) {
    for (const subteam of [mechSubteam, inactive, crypto.randomUUID()]) {
      const result = await client
        .from('application_interview_tags')
        .insert({ application_id: row.id, subteam_id: subteam });
      expect(result.error).not.toBeNull();
    }
  }
  expect(await tags(row.id)).toEqual([]);
});

it('retains and allows removal of tags after a subteam becomes inactive', async () => {
  const row = await application();
  await lead
    .from('application_interview_tags')
    .insert({ application_id: row.id, subteam_id: web })
    .throwOnError();
  await admin.from('subteams').update({ active: false }).eq('id', web).throwOnError();
  try {
    const read = await lead
      .from('application_interview_tags')
      .select('subteam_id')
      .eq('application_id', row.id);
    expect(read.data).toEqual([{ subteam_id: web }]);
    expect(
      (await lead.from('application_interview_tags').delete().eq('application_id', row.id)).error,
    ).toBeNull();
    expect(await tags(row.id)).toEqual([]);
  } finally {
    await admin.from('subteams').update({ active: true }).eq('id', web).throwOnError();
  }
});

it('supports duplicate-ignore insertion, absent removal, and concurrent distinct additions', async () => {
  const row = await application();
  const [first, second] = await Promise.all([
    lead
      .from('application_interview_tags')
      .upsert({ application_id: row.id, subteam_id: web }, { ignoreDuplicates: true }),
    colleague
      .from('application_interview_tags')
      .upsert({ application_id: row.id, subteam_id: network }, { ignoreDuplicates: true }),
  ]);
  expect(first.error).toBeNull();
  expect(second.error).toBeNull();
  expect(
    (
      await lead
        .from('application_interview_tags')
        .upsert({ application_id: row.id, subteam_id: web }, { ignoreDuplicates: true })
    ).error,
  ).toBeNull();
  expect((await tags(row.id)).map((t) => t.subteam_id).sort()).toEqual([web, network].sort());
  for (let repeat = 0; repeat < 2; repeat++) {
    expect(
      (
        await lead
          .from('application_interview_tags')
          .delete()
          .eq('application_id', row.id)
          .eq('subteam_id', web)
      ).error,
    ).toBeNull();
  }
  expect(await tags(row.id)).toEqual([{ subteam_id: network }]);
});

it('cascades tag cleanup when an application or subteam is deleted', async () => {
  const row = await application();
  await lead
    .from('application_interview_tags')
    .insert({ application_id: row.id, subteam_id: web })
    .throwOnError();
  await admin.from('applications').delete().eq('id', row.id).throwOnError();
  expect(await tags(row.id)).toEqual([]);
  const second = await application();
  const temporary = await admin
    .from('subteams')
    .insert({ team_id: softTeam, name: 'Temporary', slug: `temporary-${crypto.randomUUID()}` })
    .select('id')
    .single();
  if (temporary.error) throw temporary.error;
  await lead
    .from('application_interview_tags')
    .insert({ application_id: second.id, subteam_id: temporary.data!.id })
    .throwOnError();
  await admin.from('subteams').delete().eq('id', temporary.data!.id).throwOnError();
  expect(await tags(second.id)).toEqual([]);
});

it('stores canonical documents, allows clearing, and rejects noncanonical direct updates', async () => {
  const row = await application();
  const valid = 'https://docs.google.com/document/d/interview_test-123/edit';
  expect(
    (await lead.from('applications').update({ interview_notes_url: valid }).eq('id', row.id)).error,
  ).toBeNull();
  for (const value of [
    '',
    'javascript:alert(1)',
    'http://docs.google.com/document/d/id/edit',
    'https://docs.google.com.evil.test/document/d/id/edit',
    'https://docs.google.com/document/d/id/edit?usp=sharing',
    'https://docs.google.com:443/document/d/id/edit',
    'https://docs.google.com/document/u/0/d/id/edit',
    'https://docs.google.com/document/d/id/edit\n',
    `https://docs.google.com/document/d/${'a'.repeat(2048)}/edit`,
  ]) {
    expect(
      (await lead.from('applications').update({ interview_notes_url: value }).eq('id', row.id))
        .error,
    ).not.toBeNull();
  }
  expect(
    (await lead.from('applications').select('interview_notes_url').eq('id', row.id).single()).data
      ?.interview_notes_url,
  ).toBe(valid);
  const foreignWrite = await otherLead
    .from('applications')
    .update({ interview_notes_url: null })
    .eq('id', row.id)
    .select('id');
  expect(foreignWrite.data).toEqual([]);
  expect(
    (await lead.from('applications').update({ interview_notes_url: null }).eq('id', row.id)).error,
  ).toBeNull();
});

it('preserves status, its timestamp, history, answers, and existing notes on metadata edits', async () => {
  const row = await application();
  const note = await lead
    .from('application_notes')
    .insert({ application_id: row.id, author_id: leadId, body: 'Keep this interview note.' })
    .select('id')
    .single();
  if (note.error) throw note.error;
  await lead
    .from('application_interview_tags')
    .insert({ application_id: row.id, subteam_id: web })
    .throwOnError();
  await lead
    .from('applications')
    .update({ interview_notes_url: 'https://docs.google.com/document/d/test-doc/edit' })
    .eq('id', row.id)
    .throwOnError();
  await lead
    .from('application_interview_tags')
    .delete()
    .eq('application_id', row.id)
    .throwOnError();
  const read = await admin
    .from('applications')
    .select('status, status_changed_at, answers, question_schema_snapshot')
    .eq('id', row.id)
    .single();
  expect(read.data).toEqual({
    status: row.status,
    status_changed_at: row.status_changed_at,
    answers: {},
    question_schema_snapshot: [],
  });
  const events = await admin.from('application_events').select('id').eq('application_id', row.id);
  expect(events.data).toEqual([]);
  const notes = await lead
    .from('application_notes')
    .select('id, body')
    .eq('application_id', row.id);
  expect(notes.data).toEqual([{ id: note.data!.id, body: 'Keep this interview note.' }]);
});

it('wakes a second authorized board subscription for both tag addition and removal', async () => {
  const row = await application();
  const session = await colleague.auth.getSession();
  await colleague.realtime.setAuth(session.data.session!.access_token);
  let receive: (() => void) | undefined;
  const channel = colleague
    .channel(`interview-tags-${row.id}`)
    .on(
      'postgres_changes',
      { event: 'UPDATE', schema: 'public', table: 'applications', filter: `id=eq.${row.id}` },
      () => receive?.(),
    );
  const subscribed = new Promise<void>((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error('Realtime subscription did not start.')),
      12000,
    );
    channel.subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        clearTimeout(timer);
        resolve();
      }
      if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        clearTimeout(timer);
        reject(new Error(`Realtime: ${status}`));
      }
    });
  });
  function nextUpdate(label: string) {
    return new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => {
        receive = undefined;
        reject(new Error(`${label} did not wake application subscriber.`));
      }, 12000);
      receive = () => {
        clearTimeout(timer);
        receive = undefined;
        resolve();
      };
    });
  }
  try {
    await subscribed;
    await Promise.all([
      nextUpdate('Changed-value control update'),
      lead
        .from('applications')
        .update({ interview_notes_url: 'https://docs.google.com/document/d/realtime-control/edit' })
        .eq('id', row.id)
        .throwOnError(),
    ]);
    await Promise.all([
      nextUpdate('Tag addition'),
      lead
        .from('application_interview_tags')
        .insert({ application_id: row.id, subteam_id: web })
        .throwOnError(),
    ]);
    await Promise.all([
      nextUpdate('Tag removal'),
      lead
        .from('application_interview_tags')
        .delete()
        .eq('application_id', row.id)
        .eq('subteam_id', web)
        .throwOnError(),
    ]);
    const read = await admin
      .from('applications')
      .select('status, status_changed_at')
      .eq('id', row.id)
      .single();
    expect(read.data).toEqual({ status: row.status, status_changed_at: row.status_changed_at });
  } finally {
    await colleague.removeChannel(channel);
    await colleague.realtime.disconnect();
  }
}, 55000);

it('does not expose direct trigger execution or tag replacement through the public API', async () => {
  const called = await lead.rpc('notify_application_interview_tags_changed');
  expect(called.error).not.toBeNull();
  const row = await application();
  await lead
    .from('application_interview_tags')
    .insert({ application_id: row.id, subteam_id: web })
    .throwOnError();
  const updated = await lead
    .from('application_interview_tags')
    .update({ subteam_id: network })
    .eq('application_id', row.id);
  expect(updated.error).not.toBeNull();
  expect(await tags(row.id)).toEqual([{ subteam_id: web }]);
});

it('runs the actions idempotently against caller RLS and persists normalized document URLs', async () => {
  const row = await application();
  currentClient = lead;
  for (let repeat = 0; repeat < 2; repeat++) {
    expect(await addInterviewTag(row.id, web, TEAM_SLUGS[0])).toEqual({ ok: true });
  }
  expect(await tags(row.id)).toEqual([{ subteam_id: web }]);
  expect(
    await saveInterviewNotesUrl(
      row.id,
      'https://docs.google.com/document/u/0/d/test-notes/view?usp=sharing#heading',
      TEAM_SLUGS[0],
    ),
  ).toEqual({ ok: true, url: 'https://docs.google.com/document/d/test-notes/edit' });
  const read = await admin
    .from('applications')
    .select('interview_notes_url')
    .eq('id', row.id)
    .single();
  expect(read.data?.interview_notes_url).toBe('https://docs.google.com/document/d/test-notes/edit');
  for (let repeat = 0; repeat < 2; repeat++) {
    expect(await removeInterviewTag(row.id, web, TEAM_SLUGS[0])).toEqual({ ok: true });
  }
  expect(await tags(row.id)).toEqual([]);
  expect(await saveInterviewNotesUrl(row.id, '', TEAM_SLUGS[0])).toEqual({ ok: true, url: null });
});

it('reports the same action failure for hidden and nonexistent applications without modifying them', async () => {
  const row = await application();
  currentClient = otherLead;
  for (const action of [
    (id: string) => addInterviewTag(id, web, TEAM_SLUGS[0]),
    (id: string) => removeInterviewTag(id, web, TEAM_SLUGS[0]),
    (id: string) =>
      saveInterviewNotesUrl(
        id,
        'https://docs.google.com/document/d/test-notes/edit',
        TEAM_SLUGS[0],
      ),
  ]) {
    const hidden = await action(row.id);
    expect(hidden).toEqual({ ok: false, error: 'That application is not available.' });
    expect(await action(crypto.randomUUID())).toEqual(hidden);
  }
  expect(await tags(row.id)).toEqual([]);
  expect(
    (await admin.from('applications').select('interview_notes_url').eq('id', row.id).single()).data
      ?.interview_notes_url,
  ).toBeNull();
});
