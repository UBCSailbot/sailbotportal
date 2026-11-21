import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { InterviewMetadata } from '../interview-metadata';
import {
  addInterviewTag,
  removeInterviewTag,
  saveInterviewNotesUrl,
} from '@/app/actions/set-interview-metadata';

jest.mock('next/navigation', () => ({ useRouter: () => ({ refresh: jest.fn() }) }));
jest.mock('@/app/actions/set-interview-metadata', () => ({
  addInterviewTag: jest.fn(),
  removeInterviewTag: jest.fn(),
  saveInterviewNotesUrl: jest.fn(),
}));
const web = { id: 'web-id', name: 'Website', code: 'WEB' };
const path = { id: 'path-id', name: 'Pathfinding', code: 'PATH' };
const props = {
  applicationId: 'application-id',
  teamSlug: 'soft',
  initialTags: [web],
  tagOptions: [web, path],
  initialNotesUrl: 'https://docs.google.com/document/d/notes-id/edit',
};
beforeEach(() => {
  jest.resetAllMocks();
});

it('shows saved tags and a safe document link, with editing disclosed on demand', async () => {
  render(<InterviewMetadata {...props} />);
  expect(screen.getByText('Interview tags: SOFT-WEB')).toBeVisible();
  expect(screen.getByRole('link', { name: 'Open interview notes in Google Docs' })).toHaveAttribute(
    'rel',
    'noopener noreferrer',
  );
  expect(screen.getByRole('combobox')).not.toBeVisible();
  await userEvent.click(screen.getByText('Edit interview details'));
  expect(screen.getByRole('combobox', { name: 'Interviewing subteam' })).toBeVisible();
  expect(screen.queryByRole('option', { name: 'SOFT-WEB' })).not.toBeInTheDocument();
});
it('adds a choice without changing applicant preferences or stage', async () => {
  jest.mocked(addInterviewTag).mockResolvedValue({ ok: true });
  const user = userEvent.setup();
  render(<InterviewMetadata {...props} />);
  await user.click(screen.getByText('Edit interview details'));
  await user.selectOptions(screen.getByRole('combobox'), path.id);
  await user.click(screen.getByRole('button', { name: 'Add tag' }));
  expect(addInterviewTag).toHaveBeenCalledWith('application-id', 'path-id', 'soft');
  expect(await screen.findByText('Interview tag added.')).toBeVisible();
});
it('allows an existing inactive tag to be removed even when not an available choice', async () => {
  jest.mocked(removeInterviewTag).mockResolvedValue({ ok: true });
  const user = userEvent.setup();
  render(<InterviewMetadata {...props} tagOptions={[path]} />);
  await user.click(screen.getByText('Edit interview details'));
  await user.click(screen.getByRole('button', { name: 'Remove SOFT-WEB tag' }));
  expect(removeInterviewTag).toHaveBeenCalledWith('application-id', 'web-id', 'soft');
  expect(await screen.findByText('Interview tag removed.')).toBeVisible();
});
it('retains an entered link after a failed save and explains the error', async () => {
  jest
    .mocked(saveInterviewNotesUrl)
    .mockResolvedValue({ ok: false, error: 'Could not save. Try again.' });
  const user = userEvent.setup();
  render(<InterviewMetadata {...props} />);
  await user.click(screen.getByText('Edit interview details'));
  const input = screen.getByRole('textbox', { name: 'Google Docs interview notes link' });
  await user.clear(input);
  await user.type(input, 'https://docs.google.com/document/d/new-id/edit');
  await user.click(screen.getByRole('button', { name: 'Save link' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Could not save. Try again.');
  expect(input).toHaveValue('https://docs.google.com/document/d/new-id/edit');
});
it('clears only the document link', async () => {
  jest.mocked(saveInterviewNotesUrl).mockResolvedValue({ ok: true, url: null });
  const user = userEvent.setup();
  render(<InterviewMetadata {...props} />);
  await user.click(screen.getByText('Edit interview details'));
  await user.click(screen.getByRole('button', { name: 'Clear link' }));
  expect(saveInterviewNotesUrl).toHaveBeenCalledWith('application-id', '', 'soft');
  expect(await screen.findByText('Document link cleared.')).toBeVisible();
  expect(screen.getByRole('textbox')).toHaveValue('');
});
it('does not turn a corrupted stored URL into an executable link', () => {
  render(<InterviewMetadata {...props} initialNotesUrl="javascript:alert(1)" />);
  expect(screen.queryByRole('link')).not.toBeInTheDocument();
});

it.each([
  [null, 'https://docs.google.com/document/d/new-id/edit'],
  [props.initialNotesUrl, 'https://docs.google.com/document/d/new-id/edit'],
  [props.initialNotesUrl, null],
])('follows a saved URL refresh from %s to %s when untouched', async (before, after) => {
  const view = render(<InterviewMetadata {...props} initialNotesUrl={before} />);
  view.rerender(<InterviewMetadata {...props} initialNotesUrl={after} />);
  await userEvent.click(screen.getByText('Edit interview details'));
  expect(screen.getByRole('textbox')).toHaveValue(after ?? '');
  jest.mocked(saveInterviewNotesUrl).mockResolvedValue({ ok: true, url: after });
  await userEvent.click(screen.getByRole('button', { name: 'Save link' }));
  expect(saveInterviewNotesUrl).toHaveBeenCalledWith(props.applicationId, after ?? '', 'soft');
});

it('preserves an unsaved draft across tag refreshes and another lead changing the saved URL', async () => {
  const view = render(<InterviewMetadata {...props} />);
  await userEvent.click(screen.getByText('Edit interview details'));
  const input = screen.getByRole('textbox');
  await userEvent.clear(input);
  await userEvent.type(input, 'https://docs.google.com/document/d/my-draft/edit');
  view.rerender(<InterviewMetadata {...props} initialTags={[web, path]} />);
  expect(input).toHaveValue('https://docs.google.com/document/d/my-draft/edit');
  const otherUrl = 'https://docs.google.com/document/d/other-lead/edit';
  view.rerender(<InterviewMetadata {...props} initialNotesUrl={otherUrl} />);
  expect(input).toHaveValue('https://docs.google.com/document/d/my-draft/edit');
  expect(screen.getByRole('link')).toHaveAttribute('href', otherUrl);
});

it('becomes pristine again after a normalized save and its server refresh', async () => {
  const saved = 'https://docs.google.com/document/d/saved/edit';
  jest.mocked(saveInterviewNotesUrl).mockResolvedValue({ ok: true, url: saved });
  const view = render(<InterviewMetadata {...props} />);
  await userEvent.click(screen.getByText('Edit interview details'));
  const input = screen.getByRole('textbox');
  await userEvent.clear(input);
  await userEvent.type(input, `${saved}?usp=sharing`);
  await userEvent.click(screen.getByRole('button', { name: 'Save link' }));
  expect(await screen.findByText('Document link saved.')).toBeVisible();
  expect(input).toHaveValue(saved);
  view.rerender(<InterviewMetadata {...props} initialNotesUrl={saved} />);
  expect(input).toHaveValue(saved);
  view.rerender(<InterviewMetadata {...props} initialNotesUrl={null} />);
  expect(input).toHaveValue('');
});

it('follows a newer saved link even when the refresh never echoes our successful save', async () => {
  jest.mocked(saveInterviewNotesUrl).mockResolvedValue({
    ok: true,
    url: 'https://docs.google.com/document/d/our-save/edit',
  });
  const view = render(<InterviewMetadata {...props} />);
  await userEvent.click(screen.getByText('Edit interview details'));
  const input = screen.getByRole('textbox');
  await userEvent.clear(input);
  await userEvent.type(input, 'https://docs.google.com/document/d/our-save/edit');
  await userEvent.click(screen.getByRole('button', { name: 'Save link' }));
  expect(await screen.findByText('Document link saved.')).toBeVisible();
  const newer = 'https://docs.google.com/document/d/newer-save/edit';
  view.rerender(<InterviewMetadata {...props} initialNotesUrl={newer} />);
  expect(input).toHaveValue(newer);
});

it.each([false, true])(
  'keeps a saved prop that arrived before the older save response (returned to original: %s)',
  async (returnedToOriginal) => {
    let finish!: (result: Awaited<ReturnType<typeof saveInterviewNotesUrl>>) => void;
    jest.mocked(saveInterviewNotesUrl).mockImplementation(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    const view = render(<InterviewMetadata {...props} />);
    await userEvent.click(screen.getByText('Edit interview details'));
    const input = screen.getByRole('textbox');
    await userEvent.clear(input);
    await userEvent.type(input, 'https://docs.google.com/document/d/our-save/edit');
    await userEvent.click(screen.getByRole('button', { name: 'Save link' }));
    const newer = 'https://docs.google.com/document/d/newer-save/edit';
    view.rerender(<InterviewMetadata {...props} initialNotesUrl={newer} />);
    const latest = returnedToOriginal ? props.initialNotesUrl : newer;
    if (returnedToOriginal)
      view.rerender(<InterviewMetadata {...props} initialNotesUrl={latest} />);
    expect(input).toHaveValue('https://docs.google.com/document/d/our-save/edit');
    await act(async () =>
      finish({ ok: true, url: 'https://docs.google.com/document/d/our-save/edit' }),
    );
    expect(await screen.findByText('Document link saved.')).toBeVisible();
    expect(input).toHaveValue(latest);
    view.rerender(<InterviewMetadata {...props} initialNotesUrl={null} />);
    expect(input).toHaveValue('');
  },
);
