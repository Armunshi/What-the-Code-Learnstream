import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

// Controlled by the caller (HomePage keeps `category` in the URL, matching
// D8's "/?category=&sub=" link shape so a switch is bookmarkable/shareable
// and Back/Forward works) — this component just renders the tab strip.
export function CategoryTabs({ categories = [], value, onChange }) {
  if (categories.length === 0) return null;

  return (
    <Tabs value={value ?? 'all'} onValueChange={onChange} data-testid="category-tabs">
      <TabsList className="h-auto flex-wrap justify-start gap-1 bg-transparent p-0">
        <TabsTrigger value="all" data-testid="category-tab" className="data-[state=active]:bg-muted">
          All
        </TabsTrigger>
        {categories.map((category) => (
          <TabsTrigger key={category.slug} value={category.slug} data-testid="category-tab" className="data-[state=active]:bg-muted">
            {category.label}
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  );
}

export default CategoryTabs;
