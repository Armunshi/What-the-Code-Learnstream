import { useContext, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import AuthContext from '@/contexts/AuthProvider';
import { useRequireAuth } from '@/features/auth';
import { normalizeApiError } from '@/lib/api/errors';
import { displayRazorpay } from '@/Pages/displayRazorpay';
import { useCart } from './CartProvider';
import { enrollFreeCourse, fetchMeSummary } from './api';
import { cartKeys, meSummaryKeys } from './queryKeys';

// A CoursePublicDTO (course page) spells price as `price`/author id as
// `instructor.id`; a CourseCardDTO (popover) spells the same facts
// `priceInPaise`/`author.id` (docs/contracts/dto.md — both frozen, COM
// doesn't own either). PurchaseCta is the one place both shapes meet, so it
// normalizes here rather than each caller doing it.
function readCourseFacts(course) {
  const price = course.priceInPaise ?? course.price ?? 0;
  const authorId = course.author?.id ?? course.instructor?.id ?? null;
  return { price, isFree: price === 0, authorId };
}

// useCart().add() is frozen to take a full CourseCardDTO (docs/contracts/
// dto.md — "so the guest cart can render itself with no extra fetch").
// PurchaseCta is also handed a CoursePublicDTO on the course page (a
// different, also-frozen shape this lane doesn't own), so adding to cart
// from there needs this normalization step first.
function toCartItem(course) {
  const { price } = readCourseFacts(course);
  return {
    id: course.id,
    title: course.title,
    subtitle: course.subtitle ?? null,
    thumbnailUrl: course.thumbnailUrl ?? course.thumbnail ?? null,
    author: {
      id: course.author?.id ?? course.instructor?.id ?? null,
      name: course.author?.name ?? course.instructor?.name ?? null,
      username: course.author?.username ?? course.instructor?.username ?? null,
    },
    priceInPaise: price,
    isFree: price === 0,
    currency: course.currency ?? 'INR',
    rating: course.rating ?? { avg: 0, count: 0 },
  };
}

/**
 * PurchaseCta({course, variant}) (docs/contracts/stubs.md) — the state
 * machine keyed on viewer role and course state:
 *   Owner -> Edit course | Enrolled -> Go to course | Free -> Enroll now
 *   (guest gets a login prompt, auto-enrolled after login) | Paid -> Add to
 *   cart / Buy now | Teacher (not the owner) -> Disabled.
 */
export function PurchaseCta({ course, variant = 'default' }) {
  const { auth, status } = useContext(AuthContext);
  const { requireAuth } = useRequireAuth();
  const cart = useCart();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const { isFree, authorId } = readCourseFacts(course);
  const isTeacherViewer = status === 'authenticated' && auth?.role === 'teacher';
  const isStudentViewer = status === 'authenticated' && auth?.role === 'student';
  const isOwner = isTeacherViewer && authorId && authorId === auth?.user_id;

  const meSummaryQuery = useQuery({
    queryKey: meSummaryKeys.all,
    queryFn: fetchMeSummary,
    enabled: isStudentViewer,
    staleTime: 30 * 1000,
  });
  const isEnrolled = isStudentViewer && (meSummaryQuery.data?.enrolledCourseIds ?? []).includes(course.id);

  const enrollMutation = useMutation({
    mutationFn: () => enrollFreeCourse(course.id),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: meSummaryKeys.all });
      queryClient.invalidateQueries({ queryKey: cartKeys.all });
      toast.success("You're enrolled!");
      navigate(data.redirectTo ?? `/learn/${course.id}`);
    },
    onError: (error) => toast.error(normalizeApiError(error).message),
  });

  // Auto-enroll-after-login (plan's W1-COM task list): a signed-in student
  // who lands back on the course page with ?enroll=1 (set when a guest was
  // sent to log in over a free course's "Enroll now") is enrolled
  // automatically, with no second click required. Scoped to variant
  // 'default' only — the popover renders many PurchaseCtas at once
  // (CoursePopoverGroup) and none of them are "the" course page.
  useEffect(() => {
    if (variant !== 'default') return;
    if (searchParams.get('enroll') !== '1') return;
    if (!isStudentViewer || !isFree || isEnrolled || meSummaryQuery.isLoading) return;
    if (enrollMutation.isPending) return;

    enrollMutation.mutate();
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.delete('enroll');
        return next;
      },
      { replace: true }
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [variant, searchParams, isStudentViewer, isFree, isEnrolled, meSummaryQuery.isLoading]);

  if (isOwner) {
    return (
      <Button asChild data-testid="purchase-cta-owner">
        <Link to={`/instructor/courses/${course.id}/plan`}>Edit course</Link>
      </Button>
    );
  }

  if (isEnrolled) {
    return (
      <Button asChild data-testid="purchase-cta-enrolled">
        <Link to={`/learn/${course.id}`}>Go to course</Link>
      </Button>
    );
  }

  if (isTeacherViewer) {
    return (
      <Button disabled data-testid="purchase-cta-disabled">
        Not available
      </Button>
    );
  }

  if (isFree) {
    return (
      <Button
        onClick={() => requireAuth(() => enrollMutation.mutate())}
        disabled={enrollMutation.isPending}
        data-testid="purchase-cta-enroll"
      >
        {enrollMutation.isPending ? 'Enrolling…' : 'Enroll now'}
      </Button>
    );
  }

  const inCart = cart.has(course.id);

  const handleBuyNow = () => {
    requireAuth(() => {
      displayRazorpay({
        course_ids: [course.id],
        studentName: auth?.name,
        queryClient,
        navigate,
        onError: (message) => toast.error(message),
      });
    });
  };

  return (
    <div className="flex flex-col gap-2" data-testid="purchase-cta-paid">
      {inCart ? (
        <Button asChild variant="outline" data-testid="purchase-cta-go-to-cart">
          <Link to="/cart">Go to cart</Link>
        </Button>
      ) : (
        // No requireAuth() here on purpose: the guest cart (plan §2.3) works
        // entirely without a session — login is only required at checkout,
        // below.
        <Button onClick={() => cart.add(toCartItem(course))} data-testid="purchase-cta-add-to-cart">
          Add to cart
        </Button>
      )}
      {variant === 'default' ? (
        <Button variant="secondary" onClick={handleBuyNow} data-testid="purchase-cta-buy-now">
          Buy now
        </Button>
      ) : null}
    </div>
  );
}

export default PurchaseCta;
