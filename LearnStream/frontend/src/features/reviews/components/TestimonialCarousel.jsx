import { useQuery } from '@tanstack/react-query';
import { Carousel, CarouselContent, CarouselItem, CarouselPrevious, CarouselNext } from '@/components/ui/carousel';
import { Skeleton } from '@/components/ui/skeleton';
import { getFeaturedReviews } from '../api.js';
import { reviewKeys } from '../queryKeys.js';
import { StarRating } from './StarRating.jsx';
import { ExpandableText } from './ExpandableText.jsx';

// GET /reviews/featured — top-rated, most-helpful reviews across every
// course, used only for the homepage (not a specific course's own reviews).
export function TestimonialCarousel() {
  const query = useQuery({
    queryKey: reviewKeys.featured(),
    queryFn: getFeaturedReviews,
  });

  if (query.isLoading) {
    return (
      <div className="grid gap-4 sm:grid-cols-3">
        {Array.from({ length: 3 }, (_, i) => (
          <Skeleton key={i} className="h-40 w-full" />
        ))}
      </div>
    );
  }

  if (query.isError || !query.data?.length) return null;

  return (
    <Carousel opts={{ align: 'start', loop: true }} className="w-full" data-testid="testimonial-carousel">
      <CarouselContent>
        {query.data.map((testimonial) => (
          <CarouselItem key={testimonial.id} className="sm:basis-1/2 lg:basis-1/3">
            <figure className="flex h-full flex-col gap-3 rounded-lg border p-5">
              <StarRating rating={testimonial.rating} size={14} />
              <blockquote className="flex-1">
                <ExpandableText text={testimonial.comment} />
              </blockquote>
              <figcaption className="text-sm">
                <span className="font-medium">{testimonial.user.name}</span>
                <span className="block text-xs text-muted-foreground">{testimonial.course.title}</span>
              </figcaption>
            </figure>
          </CarouselItem>
        ))}
      </CarouselContent>
      <CarouselPrevious className="hidden sm:flex" />
      <CarouselNext className="hidden sm:flex" />
    </Carousel>
  );
}

export default TestimonialCarousel;
