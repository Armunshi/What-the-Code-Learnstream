import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Play, Lock, FileText, HelpCircle, Paperclip } from 'lucide-react';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { ErrorState } from '@/components/common/ErrorState';
import { TextLineSkeleton } from '@/components/common/Skeletons';
import { formatHoursMinutes } from '@/lib/format';
import { fetchCurriculum } from '../api';
import { courseKeys } from '../queryKeys';
import { FreePreviewDialog } from './FreePreviewDialog';

const TYPE_ICONS = {
  video: Play,
  article: FileText,
  quiz: HelpCircle,
  assignment: HelpCircle,
  resource: Paperclip,
};

function sectionDurationSec(items) {
  return items.reduce((total, item) => total + (item.durationSec ?? 0), 0);
}

function itemDurationLabel(item) {
  if (item.type === 'video') return formatHoursMinutes(item.durationSec);
  if (item.type === 'article') return 'Article';
  if (item.type === 'quiz') return 'Quiz';
  if (item.type === 'assignment') return 'Assignment';
  return null;
}

// "N sections • M lectures • Xh Ym" (plan's W1-CAT task list) — CourseHero/
// CourseDetailPage already has these totals from CoursePublicDTO.stats, so
// this component takes them as a prop rather than recomputing lectureCount/
// totalDurationSec from the (possibly viewer-restricted) curriculum tree it
// fetches separately for the section/item breakdown itself.
export function CurriculumAccordion({ courseId, stats = {} }) {
  const [previewItem, setPreviewItem] = useState(null);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: courseKeys.curriculum(courseId),
    queryFn: () => fetchCurriculum(courseId),
  });

  const sections = data?.sections ?? [];

  return (
    <section>
      <h2 className="text-lg font-semibold text-foreground">Course content</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        {[
          `${sections.length || 0} sections`,
          `${stats.lectureCount ?? 0} lectures`,
          `${formatHoursMinutes(stats.totalDurationSec)} total length`,
        ].join(' • ')}
      </p>

      {isLoading ? (
        <div className="mt-4 space-y-2">
          {Array.from({ length: 4 }, (_, index) => (
            <TextLineSkeleton key={index} />
          ))}
        </div>
      ) : null}

      {isError ? <ErrorState className="mt-4" description="Couldn't load the curriculum." onRetry={refetch} /> : null}

      {!isLoading && !isError ? (
        <Accordion type="multiple" defaultValue={sections[0] ? [sections[0].id] : []} className="mt-4" data-testid="curriculum-accordion">
          {sections.map((section) => (
            <AccordionItem key={section.id} value={section.id}>
              <AccordionTrigger>
                <span className="flex flex-1 flex-col text-left">
                  <span>{section.title}</span>
                  <span className="text-xs font-normal text-muted-foreground">
                    {section.items.length} lectures • {formatHoursMinutes(sectionDurationSec(section.items))}
                  </span>
                </span>
              </AccordionTrigger>
              <AccordionContent>
                <ul className="space-y-1">
                  {section.items.map((item) => {
                    const Icon = TYPE_ICONS[item.type] ?? FileText;
                    return (
                      <li key={item.id} className="flex items-center justify-between gap-2 py-1.5 text-sm" data-testid="curriculum-item">
                        <span className="flex min-w-0 items-center gap-2 text-foreground">
                          <Icon className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                          <span className="truncate">{item.title}</span>
                        </span>
                        <span className="flex shrink-0 items-center gap-3 text-xs text-muted-foreground">
                          {item.isFreePreview ? (
                            <button
                              type="button"
                              data-testid="preview-item-button"
                              className="font-semibold text-primary hover:underline"
                              onClick={() => setPreviewItem({ itemId: item.id, title: item.title })}
                            >
                              Preview
                            </button>
                          ) : (
                            <Lock className="h-3.5 w-3.5" aria-label="Locked" />
                          )}
                          {itemDurationLabel(item)}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      ) : null}

      <FreePreviewDialog
        courseId={courseId}
        itemId={previewItem?.itemId}
        title={previewItem?.title}
        open={Boolean(previewItem)}
        onOpenChange={(next) => !next && setPreviewItem(null)}
      />
    </section>
  );
}

export default CurriculumAccordion;
