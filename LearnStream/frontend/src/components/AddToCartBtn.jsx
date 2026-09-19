import { useNavigate } from 'react-router-dom';
import { useCart } from '@/features/commerce';

// Legacy standalone add-to-cart button. No current caller — CAT/COM's
// course page and popover use <PurchaseCta/> instead (docs/contracts/
// stubs.md), which is the frozen contract other lanes render. Kept working
// against the current useCart() facade in case a future page still wants a
// bare button rather than the full PurchaseCta state machine.
function AddToCartBtn({ course_id, enrolled }) {
  const cart = useCart();
  const navigate = useNavigate();
  const inCart = cart.has(course_id);

  const handleClick = () => {
    if (inCart) {
      navigate('/cart');
      return;
    }
    cart.add({ id: course_id });
  };

  return (
    <button
      className="bg-green-500 hover:bg-green-600 text-white font-bold py-2 px-4 rounded disabled:bg-gray-400 disabled:cursor-not-allowed"
      onClick={handleClick}
      disabled={enrolled}
    >
      {inCart ? 'Go to Cart' : 'Add to Cart'}
    </button>
  );
}

export default AddToCartBtn;
