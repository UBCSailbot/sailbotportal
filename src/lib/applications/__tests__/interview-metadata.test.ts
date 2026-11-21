import { interviewTagLabel, parseInterviewNotesUrl } from '../interview-metadata';

describe('interview document links', () => {
  it.each([
    'https://docs.google.com/document/d/a_B-123',
    'https://docs.google.com/document/d/a_B-123/edit?usp=sharing#heading=test',
    'https://docs.google.com/document/u/0/d/a_B-123/view',
    ' https://docs.google.com:443/document/d/a_B-123/preview/ ',
  ])('normalizes %s to a document URL', (value) => {
    expect(parseInterviewNotesUrl(value)).toEqual({
      ok: true,
      url: 'https://docs.google.com/document/d/a_B-123/edit',
    });
  });
  it.each([
    'http://docs.google.com/document/d/id/edit',
    'javascript:alert(1)',
    'https://docs.google.com.evil.test/document/d/id/edit',
    'https://docs.google.com@evil.test/document/d/id/edit',
    'https://user:password@docs.google.com/document/d/id/edit',
    'https://docs.google.com:444/document/d/id/edit',
    'https://docs.google.com/spreadsheets/d/id/edit',
    'https://docs.google.com/document/d/id/unsupported',
    'https://docs.google.com/document/d//edit',
    'https://docs.google.com/document/d/id/edit?x=' + 'a'.repeat(2048),
  ])('rejects unsafe or non-document URL %s', (value) => {
    expect(parseInterviewNotesUrl(value).ok).toBe(false);
  });
  it('clears an empty link', () =>
    expect(parseInterviewNotesUrl('  ')).toEqual({ ok: true, url: null }));
});

describe('interview tag labels', () => {
  it('uses existing code and team independently of preferences', () => {
    expect(interviewTagLabel({ name: 'Website', code: 'WEB' }, 'soft')).toBe('SOFT-WEB');
    expect(interviewTagLabel({ name: 'DevOps', code: 'DevOps' }, 'soft')).toBe('SOFT-DEVOPS');
    expect(interviewTagLabel({ name: 'Hull', code: null }, 'mech')).toBe('MECH-HULL');
  });
});

it.each([null, undefined, {}, ['https://docs.google.com/document/d/id/edit']])(
  'rejects non-text input %s without throwing',
  (value) => {
    expect(parseInterviewNotesUrl(value).ok).toBe(false);
  },
);
