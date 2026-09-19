import { NavLink } from 'react-router-dom';
import { Check, Circle } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import { useCourseReadinessQuery } from '../hooks/useCourseQueries';
import { getStepsByGroup } from '../steps/registry';

// C-UI-1 "information architecture sidebar": Plan / Create / Publish groups
// from the step registry, with a completion icon per step and an overall
// readiness bar (C-UI-11, C-UI-12).
export function CourseAuthoringSidebar({ courseId }) {
  const readinessQuery = useCourseReadinessQuery(courseId);
  const stepsByGroup = getStepsByGroup();
  const percent = readinessQuery.data?.percent ?? 0;

  return (
    <nav aria-label="Course authoring steps" className="hidden w-64 shrink-0 border-r bg-muted/30 p-4 md:block">
      <div className="mb-4">
        <div className="mb-1 flex items-center justify-between text-xs text-muted-foreground">
          <span>Course readiness</span>
          <span>{percent}%</span>
        </div>
        <Progress value={percent} />
      </div>

      {stepsByGroup.map(({ group, label, steps }) => (
        <div key={group} className="mb-5">
          <p className="mb-1.5 px-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
          <ul className="space-y-0.5">
            {steps.map((step) => {
              const stepReadiness = readinessQuery.data?.steps?.[step.id];
              const isComplete = stepReadiness?.complete === true;
              return (
                <li key={step.id}>
                  <NavLink
                    to={`/instructor/courses/${courseId}/${step.path}`}
                    className={({ isActive }) =>
                      cn(
                        'flex items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted',
                        isActive && 'bg-muted font-medium text-foreground'
                      )
                    }
                  >
                    {isComplete ? (
                      <Check className="h-3.5 w-3.5 shrink-0 text-emerald-600" aria-hidden="true" />
                    ) : (
                      <Circle className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
                    )}
                    <span className="truncate">{step.label}</span>
                  </NavLink>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}

export default CourseAuthoringSidebar;
