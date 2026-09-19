import { useContext, useState } from 'react';
import { Link } from 'react-router-dom';
import { Menu } from 'lucide-react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Skeleton } from '@/components/ui/skeleton';
import AuthContext from '@/contexts/AuthProvider';
import { useCategories } from '@/features/nav';
import { Logo } from './Logo';

// Below lg (plan §5.1's responsive table: "md-lg: Explore and Teach move
// into the sheet"; "below md: ... hamburger"). Sheet side="left" per
// stubs.md's frozen SiteHeader composition.
export function MobileNavSheet() {
  const { data: categories, isLoading } = useCategories();
  const { auth, status } = useContext(AuthContext);
  const [open, setOpen] = useState(false);
  const isTeacher = status === 'authenticated' && auth?.role === 'teacher';

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <button
          type="button"
          aria-label="Open navigation menu"
          data-testid="mobile-nav-trigger"
          className="inline-flex h-10 w-10 items-center justify-center rounded-md lg:hidden"
        >
          <Menu className="h-5 w-5" aria-hidden="true" />
        </button>
      </SheetTrigger>
      <SheetContent side="left" className="w-80 overflow-y-auto">
        <SheetHeader>
          <SheetTitle asChild>
            <Logo onClick={() => setOpen(false)} />
          </SheetTitle>
        </SheetHeader>

        <nav aria-label="Explore categories" className="mt-6">
          <h2 className="px-1 pb-2 text-xs font-semibold uppercase text-muted-foreground">Explore</h2>
          {isLoading && (
            <div className="flex flex-col gap-2 px-1">
              {Array.from({ length: 4 }, (_, index) => (
                <Skeleton key={index} className="h-8 w-full" />
              ))}
            </div>
          )}
          <Accordion type="single" collapsible>
            {categories?.map((category) => (
              <AccordionItem key={category.slug} value={category.slug}>
                <AccordionTrigger data-testid="mobile-explore-category">{category.label}</AccordionTrigger>
                <AccordionContent>
                  <ul className="flex flex-col gap-1">
                    <li>
                      <Link
                        to={`/?category=${category.slug}`}
                        onClick={() => setOpen(false)}
                        className="block rounded-md px-3 py-1.5 text-sm font-medium hover:bg-accent/50"
                      >
                        All {category.label}
                      </Link>
                    </li>
                    {category.subcategories.map((sub) => (
                      <li key={sub.slug}>
                        <Link
                          to={`/?category=${category.slug}&sub=${sub.slug}`}
                          onClick={() => setOpen(false)}
                          className="block rounded-md px-3 py-1.5 text-sm text-muted-foreground hover:bg-accent/50"
                        >
                          {sub.label}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </nav>

        <div className="mt-6 border-t pt-4">
          <Link
            to={isTeacher ? '/instructor/courses' : '/teach'}
            onClick={() => setOpen(false)}
            className="block px-1 py-2 text-sm font-medium hover:text-brand-dark"
          >
            {isTeacher ? 'Instructor dashboard' : 'Teach on LearnStream'}
          </Link>
        </div>
      </SheetContent>
    </Sheet>
  );
}

export default MobileNavSheet;
