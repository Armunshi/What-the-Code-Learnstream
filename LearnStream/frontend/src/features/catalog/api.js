import { publicClient } from '@/lib/api/publicClient';

// Guest-facing reads only (catalog, categories) — always through publicClient
// (H-FR-3.2, docs/contracts/api-conventions.md): this feature never needs an
// authenticated identity to render.

export async function fetchCatalog({ category, subcategory, sort, page, limit } = {}) {
  const { data } = await publicClient.get('/courses/catalog', {
    params: { category, subcategory, sort, page, limit },
  });
  return data.data; // { items, total, page, limit }
}

export async function fetchCategories() {
  const { data } = await publicClient.get('/courses/categories');
  return data.data.categories;
}
