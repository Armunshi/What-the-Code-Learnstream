import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  NavigationMenu,
  NavigationMenuContent,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  NavigationMenuTrigger,
} from '@/components/ui/navigation-menu';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { useCategories } from '@/features/nav';

// Two-pane mega menu (plan §5.1): categories on the left, the hovered/
// focused category's subcategories on the right. Links go to
// `/?category=&sub=` — CategoryTabs (CAT) only reads `category` off that URL
// today, not `sub` yet, but that's CAT's own HomePage catching up to the
// frozen contract, not something this lane's link target should hedge on.
export function ExploreMenu() {
  const { data: categories, isLoading } = useCategories();
  const [open, setOpen] = useState(false);
  const [activeSlug, setActiveSlug] = useState(null);

  useEffect(() => {
    if (categories?.length && !activeSlug) {
      setActiveSlug(categories[0].slug);
    }
  }, [categories, activeSlug]);

  const active = categories?.find((category) => category.slug === activeSlug) ?? categories?.[0] ?? null;

  return (
    <NavigationMenu
      value={open ? 'explore' : ''}
      onValueChange={(value) => setOpen(value === 'explore')}
      className="hidden lg:flex"
    >
      <NavigationMenuList>
        <NavigationMenuItem value="explore">
          <NavigationMenuTrigger>Explore</NavigationMenuTrigger>
          <NavigationMenuContent>
            <div className="flex w-[640px]" data-testid="explore-menu-panel">
              <div role="list" aria-label="Categories" className="w-56 shrink-0 border-r p-2">
                {isLoading &&
                  Array.from({ length: 5 }, (_, index) => <Skeleton key={index} className="my-1 h-8 w-full" />)}
                {categories?.map((category) => (
                  <NavigationMenuLink asChild key={category.slug}>
                    <Link
                      to={`/?category=${category.slug}`}
                      role="listitem"
                      data-testid="explore-category"
                      aria-current={category.slug === active?.slug ? 'true' : undefined}
                      className={cn(
                        'block rounded-md px-3 py-2 text-sm font-medium transition-colors',
                        category.slug === active?.slug
                          ? 'bg-accent text-accent-foreground'
                          : 'hover:bg-accent/50'
                      )}
                      onFocus={() => setActiveSlug(category.slug)}
                      onMouseEnter={() => setActiveSlug(category.slug)}
                      onClick={() => setOpen(false)}
                    >
                      {category.label}
                    </Link>
                  </NavigationMenuLink>
                ))}
              </div>
              <div className="flex-1 p-4" aria-live="polite">
                {active && (
                  <ul
                    className="grid grid-cols-2 gap-x-4 gap-y-1"
                    aria-label={`${active.label} subcategories`}
                  >
                    {active.subcategories.map((sub) => (
                      <li key={sub.slug}>
                        <NavigationMenuLink asChild>
                          <Link
                            to={`/?category=${active.slug}&sub=${sub.slug}`}
                            data-testid="explore-subcategory"
                            className="block rounded-md px-3 py-2 text-sm hover:bg-accent/50"
                            onClick={() => setOpen(false)}
                          >
                            {sub.label}
                          </Link>
                        </NavigationMenuLink>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </NavigationMenuContent>
        </NavigationMenuItem>
      </NavigationMenuList>
    </NavigationMenu>
  );
}

export default ExploreMenu;
