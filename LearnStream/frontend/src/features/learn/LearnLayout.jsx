import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Menu } from "lucide-react";
import { getLearnTree, markItemAccessed } from "./api";
import { CurriculumSidebar } from "./components/CurriculumSidebar";
import { getRenderer } from "./renderers";

const AUTOPLAY_COUNTDOWN_SEC = 5;

function flattenItems(tree) {
  return tree.sections.flatMap((section) => section.items);
}

export function LearnLayout() {
  const { courseId, itemId } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [countdown, setCountdown] = useState(null);
  const countdownTimerRef = useRef(null);

  const { data: tree, isLoading, isError } = useQuery({
    queryKey: ["learn-tree", courseId],
    queryFn: () => getLearnTree(courseId),
  });

  // No item selected yet — jump straight to the resume target once the
  // tree is in.
  useEffect(() => {
    if (!itemId && tree?.resume?.itemId) {
      navigate(`/learn/${courseId}/items/${tree.resume.itemId}`, { replace: true });
    }
  }, [itemId, tree, courseId, navigate]);

  const items = useMemo(() => (tree ? flattenItems(tree) : []), [tree]);
  const activeItem = items.find((item) => item.id === itemId) ?? null;
  const activeIndex = items.findIndex((item) => item.id === itemId);
  const nextItem = activeIndex >= 0 ? items[activeIndex + 1] : null;
  const prevItem = activeIndex > 0 ? items[activeIndex - 1] : null;

  useEffect(() => {
    if (!itemId || !courseId) return;
    markItemAccessed(courseId, itemId).catch(() => {});
  }, [courseId, itemId]);

  useEffect(() => {
    setCountdown(null);
    return () => clearInterval(countdownTimerRef.current);
  }, [itemId]);

  const goToItem = (id) => navigate(`/learn/${courseId}/items/${id}`);

  const invalidateTree = () => queryClient.invalidateQueries({ queryKey: ["learn-tree", courseId] });

  const startAutoplayCountdown = () => {
    if (!nextItem) return;
    setCountdown(AUTOPLAY_COUNTDOWN_SEC);
    countdownTimerRef.current = setInterval(() => {
      setCountdown((current) => {
        if (current === null) return null;
        if (current <= 1) {
          clearInterval(countdownTimerRef.current);
          goToItem(nextItem.id);
          return null;
        }
        return current - 1;
      });
    }, 1000);
  };

  if (isLoading) {
    return (
      <div className="flex flex-col gap-4 p-6">
        <Skeleton className="h-8 w-1/3" />
        <Skeleton className="aspect-video w-full" />
      </div>
    );
  }

  if (isError || !tree) {
    return <p className="p-6 text-sm text-destructive">Couldn&apos;t load this course&apos;s curriculum.</p>;
  }

  const Renderer = activeItem ? getRenderer(activeItem.type) : null;

  const sidebar = (
    <CurriculumSidebar tree={tree} activeItemId={itemId} onSelectItem={(id) => goToItem(id)} />
  );

  return (
    <div className="flex h-[calc(100vh-4rem)] flex-col md:flex-row" data-testid="learn-layout">
      <div className="hidden w-72 shrink-0 border-r md:block">{sidebar}</div>

      <div className="border-b p-2 md:hidden">
        <Sheet>
          <SheetTrigger asChild>
            <Button variant="outline" size="sm">
              <Menu className="mr-2 h-4 w-4" />
              Curriculum
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-72 p-0">
            {sidebar}
          </SheetContent>
        </Sheet>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {activeItem && Renderer ? (
          <Renderer
            courseId={courseId}
            item={activeItem}
            completed={activeItem.completed}
            onCompleted={invalidateTree}
            onEnded={startAutoplayCountdown}
          />
        ) : (
          <p className="text-sm text-muted-foreground">Select a lecture from the curriculum to begin.</p>
        )}

        <div className="mt-6 flex items-center justify-between">
          <Button variant="outline" disabled={!prevItem} onClick={() => prevItem && goToItem(prevItem.id)}>
            Previous
          </Button>
          <div className="flex items-center gap-2">
            {countdown !== null && nextItem && (
              <span className="text-sm text-muted-foreground" data-testid="autoplay-countdown">
                Next lecture in {countdown}s
                <Button variant="link" size="sm" onClick={() => { clearInterval(countdownTimerRef.current); setCountdown(null); }}>
                  Cancel
                </Button>
              </span>
            )}
            <Button disabled={!nextItem} onClick={() => nextItem && goToItem(nextItem.id)}>
              Next
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default LearnLayout;
