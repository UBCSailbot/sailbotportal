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
