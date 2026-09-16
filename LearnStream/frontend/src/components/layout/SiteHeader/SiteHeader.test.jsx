import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, it, expect, vi } from 'vitest';
import AuthContext from '@/contexts/AuthProvider';

// GlobalSearch (SRC) and CartButton (COM) are still W0-A's frozen stubs
// (both render null), so this test exercises them exactly as SiteHeader
// will see them today. useCategories/useCurrentUser are mocked purely to
// avoid a real network call in jsdom — SiteHeader.jsx's own status
// branching (Skeleton / AuthCtas / UserMenu) is what's under test.
vi.mock('@/features/nav', () => ({
  useCategories: () => ({ data: [], isLoading: false }),
  useCurrentUser: () => ({
    name: 'Ada Lovelace',
    email: 'ada@example.com',
    initials: 'AL',
    avatar: null,
    role: 'student',
    enrolledCount: 2,
  }),
  useLogout: () => vi.fn(),
}));

vi.mock('@/app/menuRegistry', () => ({ default: [] }));

const { SiteHeader } = await import('./index.jsx');

function renderHeader({ status, auth = {} }) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <AuthContext.Provider value={{ status, auth, setAuth: () => {} }}>
        <MemoryRouter>
          <SiteHeader />
        </MemoryRouter>
      </AuthContext.Provider>
    </QueryClientProvider>
  );
}

describe('SiteHeader', () => {
  it('renders a skeleton in place of the auth area while status is unknown', () => {
    const { container } = renderHeader({ status: 'unknown' });
    expect(container.querySelector('[data-slot="skeleton"], .animate-pulse')).toBeTruthy();
    expect(screen.queryByTestId('nav-signup-link')).not.toBeInTheDocument();
    expect(screen.queryByTestId('user-menu-trigger')).not.toBeInTheDocument();
  });

  it('renders guest CTAs when status is guest', () => {
    renderHeader({ status: 'guest' });
    expect(screen.getByTestId('nav-login-link')).toBeInTheDocument();
    expect(screen.getByTestId('nav-signup-link')).toBeInTheDocument();
    expect(screen.queryByTestId('user-menu-trigger')).not.toBeInTheDocument();
  });

  it('renders UserMenu when authenticated', () => {
    renderHeader({ status: 'authenticated', auth: { role: 'student', name: 'Ada Lovelace' } });
    expect(screen.getByTestId('user-menu-trigger')).toBeInTheDocument();
    expect(screen.queryByTestId('nav-signup-link')).not.toBeInTheDocument();
  });

  it('always renders the skip link and the LearnStream logo', () => {
    renderHeader({ status: 'guest' });
    expect(screen.getByText('Skip to content')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'LearnStream' })).toHaveAttribute('href', '/');
  });
});
