import RequireAuth from '@/app/guards/RequireAuth';
import { WishlistPage } from './WishlistPage.jsx';

export default [
  {
    path: 'wishlist',
    element: <RequireAuth />,
    children: [{ index: true, element: <WishlistPage /> }],
  },
];
