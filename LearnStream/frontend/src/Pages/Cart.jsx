import { CartPage } from '@/features/commerce';

// app/router.jsx (frozen after Wave 0) still serves "cart/" and
// "student/:user_id/Cart" through this legacy page rather than the
// features/commerce/routes.jsx registry entry — see that file's own comment
// for why. The real implementation lives in features/commerce/CartPage.jsx;
// this is a thin pass-through so the legacy route renders it, the same
// pattern Pages/Home.jsx uses for features/catalog/pages/HomePage.jsx.
const Cart = () => <CartPage />;

export default Cart;
