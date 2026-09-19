import { CartPage } from './CartPage.jsx';

// Registered for forward-compatibility with the route registry
// (docs/contracts/registries.md — app/router.jsx collects features/*/routes.jsx
// via import.meta.glob and is frozen after Wave 0, so this file is the only
// way COM can add a route at all). Currently UNREACHABLE in practice, same
// situation CAT's own features/catalog/routes.jsx documents: app/router.jsx's
// legacyRoutes array still declares "cart/" -> Pages/Cart.jsx ahead of this
// registry and wins on path-order. Pages/Cart.jsx is a thin pass-through to
// this same <CartPage/> (see its own comment), so both paths render
// identically today; this entry starts working on its own, with no code
// change here, whenever a later wave's cleanup removes the legacy entry.
const routes = [{ path: 'cart', element: <CartPage /> }];

export default routes;
