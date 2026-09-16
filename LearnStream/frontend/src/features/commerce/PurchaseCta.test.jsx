import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, expect, it, vi } from 'vitest';
import AuthContext from '@/contexts/AuthProvider';
import { PurchaseCta } from './PurchaseCta.jsx';
import { useCart } from './CartProvider.jsx';

vi.mock('./CartProvider.jsx', () => ({ useCart: vi.fn(() => ({ mode: 'guest', has: () => false, add: vi.fn() })) }));
vi.mock('./api.js', () => ({
  fetchMeSummary: vi.fn(() => Promise.resolve({ enrolledCourseIds: [] })),
  enrollFreeCourse: vi.fn(),
}));

const requireAuthMock = vi.fn((action) => action?.());
vi.mock('@/features/auth', () => ({ useRequireAuth: () => ({ requireAuth: requireAuthMock }) }));

const course = {
  id: 'course-1',
  title: 'Learn Testing',
  price: 0,
  currency: 'INR',
  instructor: { id: 'teacher-1', name: 'Ada' },
};

function renderCta(authValue, courseOverrides = {}) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <AuthContext.Provider value={authValue}>
          <PurchaseCta course={{ ...course, ...courseOverrides }} />
        </AuthContext.Provider>
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe('PurchaseCta', () => {
  it('shows "Edit course" for the owning teacher', () => {
    renderCta({ status: 'authenticated', auth: { role: 'teacher', user_id: 'teacher-1' } });
    expect(screen.getByTestId('purchase-cta-owner')).toHaveTextContent('Edit course');
  });

  it('shows "Not available" for a teacher who is not the owner', () => {
    renderCta({ status: 'authenticated', auth: { role: 'teacher', user_id: 'teacher-2' } });
    expect(screen.getByTestId('purchase-cta-disabled')).toBeDisabled();
  });

  it('shows "Enroll now" for a guest viewing a free course', () => {
    renderCta({ status: 'guest', auth: {} });
    expect(screen.getByTestId('purchase-cta-enroll')).toHaveTextContent('Enroll now');
  });

  it('gates the guest "Enroll now" click behind requireAuth()', async () => {
    renderCta({ status: 'guest', auth: {} });
    screen.getByTestId('purchase-cta-enroll').click();
    expect(requireAuthMock).toHaveBeenCalled();
  });

  it('shows "Add to cart" for a paid course, with no requireAuth gate for a guest', () => {
    renderCta({ status: 'guest', auth: {} }, { price: 49900 });
    expect(screen.getByTestId('purchase-cta-add-to-cart')).toHaveTextContent('Add to cart');
  });

  it('shows "Go to cart" instead of "Add to cart" once the course is already in the cart', () => {
    useCart.mockReturnValue({ mode: 'guest', has: () => true, add: vi.fn() });
    renderCta({ status: 'guest', auth: {} }, { price: 49900 });
    expect(screen.getByTestId('purchase-cta-go-to-cart')).toBeInTheDocument();
    useCart.mockReturnValue({ mode: 'guest', has: () => false, add: vi.fn() });
  });
});
