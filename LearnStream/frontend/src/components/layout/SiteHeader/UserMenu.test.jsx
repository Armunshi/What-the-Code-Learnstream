import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockLogout = vi.fn();
const mockUseCurrentUser = vi.fn();

// UserMenu is a pure consumer of the registry + this lane's own hooks — the
// live registry pulls in every other feature's real menu.js, and the real
// useCurrentUser hook fires a network request (GET /users/me/summary) that
// has nothing to talk to in jsdom, so both are mocked to keep this a unit
// test of UserMenu's own group-merging/ordering/role-filtering logic.
vi.mock('@/features/nav', () => ({
  useCurrentUser: (...args) => mockUseCurrentUser(...args),
  useLogout: () => mockLogout,
}));

vi.mock('@/app/menuRegistry', () => ({
  default: [
    { group: 'Learning', items: [{ label: 'My learning', to: '/my-learning', roles: ['student'] }] },
    { group: 'Learning', items: [{ label: 'My cart', to: '/cart', roles: ['student'] }] },
    { group: 'Account', items: [{ label: 'Account settings', to: '/account/profile' }] },
    { group: 'Session', items: [{ label: 'Log out', action: 'logout', roles: ['student', 'teacher'] }] },
  ],
}));

const { UserMenu } = await import('./UserMenu.jsx');

function renderMenu() {
  return render(
    <MemoryRouter>
      <UserMenu />
    </MemoryRouter>
  );
}

describe('UserMenu', () => {
  beforeEach(() => {
    mockLogout.mockClear();
  });

  it('shows the student label, merges same-named groups, and hides teacher-only items', async () => {
    mockUseCurrentUser.mockReturnValue({
      name: 'Ada Lovelace',
      email: 'ada@example.com',
      initials: 'AL',
      avatar: null,
      role: 'student',
      enrolledCount: 3,
    });
    renderMenu();

    await userEvent.click(screen.getByTestId('user-menu-trigger'));

    expect(screen.getByText('Ada Lovelace')).toBeInTheDocument();
    expect(screen.getByText('ada@example.com')).toBeInTheDocument();
    expect(screen.getByText('3 courses enrolled')).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'My learning' })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'My cart' })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'Account settings' })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'Log out' })).toBeInTheDocument();
  });

  it('hides student-only entries (Cart, wishlist-style items) for a teacher and skips the enrolled-count line', async () => {
    mockUseCurrentUser.mockReturnValue({
      name: 'Grace Hopper',
      email: 'grace@example.com',
      initials: 'GH',
      avatar: null,
      role: 'teacher',
      enrolledCount: 0,
    });
    renderMenu();

    await userEvent.click(screen.getByTestId('user-menu-trigger'));

    expect(screen.queryByRole('menuitem', { name: 'My learning' })).not.toBeInTheDocument();
    expect(screen.queryByRole('menuitem', { name: 'My cart' })).not.toBeInTheDocument();
    expect(screen.queryByText(/courses enrolled/)).not.toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'Account settings' })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'Log out' })).toBeInTheDocument();
  });

  it('calls useLogout() when Log out is selected', async () => {
    mockUseCurrentUser.mockReturnValue({
      name: 'Ada Lovelace',
      email: 'ada@example.com',
      initials: 'AL',
      avatar: null,
      role: 'student',
      enrolledCount: 3,
    });
    renderMenu();

    await userEvent.click(screen.getByTestId('user-menu-trigger'));
    await userEvent.click(screen.getByRole('menuitem', { name: 'Log out' }));

    expect(mockLogout).toHaveBeenCalledTimes(1);
  });
});
