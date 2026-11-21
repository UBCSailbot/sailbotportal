import { fireEvent, render, screen } from '@testing-library/react';
import { BoardFilterBar } from '../filter-bar';
import { EMPTY_BOARD_FILTERS } from '@/lib/applications/queries';

const push = jest.fn();
jest.mock('next/navigation', () => ({ useRouter: () => ({ push }) }));
const tag = { id: '11111111-2222-4333-8444-555555555555', name: 'Hull', code: null };

beforeEach(() => push.mockClear());

it('offers interview filtering on non-ranking teams and preserves other filters', () => {
  render(
    <BoardFilterBar
      filters={{ ...EMPTY_BOARD_FILTERS, search: 'Ada' }}
      subteams={[]}
      interviewSubteams={[tag]}
      teamSlug="mech"
      showSubteamFilter={false}
      basePath="/admin/mech"
    />,
  );
  expect(screen.queryByRole('combobox', { name: 'First choice' })).not.toBeInTheDocument();
  expect(screen.getByRole('option', { name: 'MECH-HULL — Hull' })).toBeInTheDocument();
  fireEvent.change(screen.getByRole('combobox', { name: 'Interview tag' }), {
    target: { value: tag.id },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Apply filters' }));
  expect(push).toHaveBeenCalledWith(`/admin/mech?interviewTag=${tag.id}&q=Ada`);
  fireEvent.click(screen.getByRole('button', { name: 'Clear' }));
  expect(push).toHaveBeenLastCalledWith('/admin/mech');
});

const props = {
  subteams: [tag],
  interviewSubteams: [tag],
  teamSlug: 'mech',
  showSubteamFilter: true,
  basePath: '/admin/mech',
};

it('resets every control when navigation changes the URL filters', () => {
  const view = render(
    <BoardFilterBar
      {...props}
      filters={{
        search: 'Ada',
        firstChoiceSubteamId: tag.id,
        interviewSubteamId: tag.id,
        submittedFrom: '2026-01-01',
        submittedTo: '2026-01-31',
      }}
    />,
  );
  view.rerender(<BoardFilterBar {...props} filters={EMPTY_BOARD_FILTERS} />);
  expect(screen.getByRole('searchbox')).toHaveValue('');
  expect(screen.getByRole('combobox', { name: 'First choice' })).toHaveValue('');
  expect(screen.getByRole('combobox', { name: 'Interview tag' })).toHaveValue('');
  expect(screen.getByLabelText('Submitted from')).toHaveValue('');
  expect(screen.getByLabelText('Submitted to')).toHaveValue('');
  fireEvent.click(screen.getByRole('button', { name: 'Apply filters' }));
  expect(push).toHaveBeenLastCalledWith('/admin/mech');
});

it('keeps unsent typing during a refresh with equivalent URL filters', () => {
  const view = render(<BoardFilterBar {...props} filters={EMPTY_BOARD_FILTERS} />);
  fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'Unsaved search' } });
  view.rerender(<BoardFilterBar {...props} filters={{ ...EMPTY_BOARD_FILTERS }} />);
  expect(screen.getByRole('searchbox')).toHaveValue('Unsaved search');
});

it('resets the draft when changing boards even if the URL filters are identical', () => {
  const view = render(<BoardFilterBar {...props} filters={EMPTY_BOARD_FILTERS} />);
  fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'Old team search' } });
  view.rerender(<BoardFilterBar {...props} basePath="/admin/soft" filters={EMPTY_BOARD_FILTERS} />);
  expect(screen.getByRole('searchbox')).toHaveValue('');
  fireEvent.click(screen.getByRole('button', { name: 'Apply filters' }));
  expect(push).toHaveBeenLastCalledWith('/admin/soft');
});
