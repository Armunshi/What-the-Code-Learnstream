import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from '@/components/ui/carousel';
import { CourseCard } from '@/features/catalog';

/** "Hot and Fresh" (FR-SRC-4.2, services/search/fresh.js — courses published
 * within 60 days, falling back to the top result's subcategory). Each item
 * is already a full CourseCardDTO, so this reuses CAT's CourseCard
 * unchanged (same as CourseGrid does for the main results). */
export function HotAndFreshCarousel({ items = [] }) {
  if (items.length === 0) return null;

  return (
    <div className="flex flex-col gap-3" data-testid="hot-and-fresh-carousel">
      <h3 className="text-sm font-semibold text-foreground">Hot and Fresh</h3>
      <Carousel opts={{ align: 'start' }} className="w-full">
        <CarouselContent>
          {items.map((course) => (
            <CarouselItem key={course.id} className="basis-1/2 sm:basis-1/3 lg:basis-1/4" data-testid="hot-and-fresh-item">
              <CourseCard course={course} showPopover={false} />
            </CarouselItem>
          ))}
        </CarouselContent>
        <CarouselPrevious />
        <CarouselNext />
      </Carousel>
    </div>
  );
}

export default HotAndFreshCarousel;
