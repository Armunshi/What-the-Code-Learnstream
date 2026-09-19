import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { CartButton } from './CartButton.jsx';
import { useCart } from './CartProvider.jsx';

vi.mock('./CartProvider.jsx', () => ({ useCart: vi.fn() }));

// jsdom (this project's vitest environment) doesn't implement
// window.matchMedia — hooks/useMediaQuery.js (a frozen, shared W0-A hook
// this lane doesn't own) needs it for the hover-preview's pointer-type
// check. Stubbed here, scoped to this test file only, rather than touching
// the shared src/test/setup.js.
beforeAll(() => {
  window.matchMedia =
    window.matchMedia ||
    ((query) => ({
      matches: false,
      media: query,
      addEventListener: () => {},
      removeEventListener: () => {},
    }));
});

function renderCartButton() {
  return render(
    <MemoryRouter>
      <CartButton />
    </MemoryRouter>
  );
}

describe('CartButton', () => {
  it('renders nothing when the cart is disabled (teacher viewer)', () => {
    useCart.mockReturnValue({ mode: 'disabled', items: [], count: 0 });
    const { container } = renderCartButton();
    expect(container).toBeEmptyDOMElement();
  });

  it('shows the item count in its aria-label and badge', () => {
    useCart.mockReturnValue({
      mode: 'guest',
      items: [{ id: 'c1', title: 'Course 1', priceInPaise: 0 }],
      count: 1,
    });
    renderCartButton();

    expect(screen.getByTestId('cart-count')).toHaveAccessibleName('Cart, 1 items');
    expect(screen.getByText('1')).toBeInTheDocument();
  });

  it('shows no badge when the cart is empty', () => {
    useCart.mockReturnValue({ mode: 'server', items: [], count: 0 });
    renderCartButton();

    expect(screen.getByTestId('cart-count')).toHaveAccessibleName('Cart, 0 items');
  });

  it('links to /cart', async () => {
    useCart.mockReturnValue({ mode: 'guest', items: [], count: 0 });
    renderCartButton();

    const link = screen.getByTestId('cart-count').closest('a');
    expect(link).toHaveAttribute('href', '/cart');
  });
});
