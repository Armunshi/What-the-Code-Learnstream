import { useQuery } from '@tanstack/react-query';
import { fetchCategories } from '../api';
import { categoriesKeys } from '../queryKeys';

// Backs ExploreMenu's two-pane mega menu (plan §5.1). 5 min staleTime: the
// taxonomy is effectively static (backend/src/config/taxonomy.js), so there
// is no reason to refetch it on every mount.
export function useCategories() {
  return useQuery({
    queryKey: categoriesKeys.all,
    queryFn: fetchCategories,
    staleTime: 5 * 60 * 1000,
  });
}

export default useCategories;
