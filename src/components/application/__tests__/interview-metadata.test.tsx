import { render, screen } from '@testing-library/react';
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
