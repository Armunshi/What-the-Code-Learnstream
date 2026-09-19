import { Search, TrendingUp, User } from 'lucide-react';
import { cn } from '@/lib/utils';

// The dropdown content shared by GlobalSearch's inline and dialog variants
// (stubs.md's frozen behavior contract): a Trending list on empty focus, or
// three grouped sections — keyphrases / Courses (<=3) / Instructors (<=3) —
// once the debounced suggest response comes back.
export function SuggestionsPanel({
  mode, // 'trending' | 'suggest'
  trending = [],
  suggestions,
  isLoading,
  onSelectQuery,
  onSelectCourse,
  onSelectInstructor,
}) {
  if (isLoading) {
    return (
      <div className="p-4 text-sm text-muted-foreground" data-testid="global-search-loading">
        Searching…
      </div>
    );
  }

  if (mode === 'trending') {
    if (trending.length === 0) return null;
    return (
      <div className="py-2" data-testid="global-search-trending" role="listbox">
        <p className="px-3 pb-1 text-xs font-medium text-muted-foreground">Trending searches</p>
        {trending.map((q) => (
          <SuggestionRow key={q} icon={TrendingUp} testId="global-search-trending-item" onClick={() => onSelectQuery(q)}>
            {q}
          </SuggestionRow>
        ))}
      </div>
    );
  }

  const keyphrases = suggestions?.keyphrases ?? [];
  const courses = suggestions?.courses ?? [];
  const instructors = suggestions?.instructors ?? [];
  const isEmpty = keyphrases.length === 0 && courses.length === 0 && instructors.length === 0;

  if (isEmpty) {
    return (
      <div className="p-4 text-sm text-muted-foreground" data-testid="global-search-empty">
        No results — press Enter to search anyway.
      </div>
    );
  }

  return (
    <div className="py-2" data-testid="global-search-suggestions" role="listbox">
      {keyphrases.length > 0 && (
        <div data-testid="global-search-keyphrases">
          <p className="px-3 pb-1 text-xs font-medium text-muted-foreground">Search suggestions</p>
          {keyphrases.map((q) => (
            <SuggestionRow key={q} icon={Search} testId="global-search-keyphrase-item" onClick={() => onSelectQuery(q)}>
              {q}
            </SuggestionRow>
          ))}
        </div>
      )}

      {courses.length > 0 && (
        <div data-testid="global-search-courses" className="mt-1">
          <p className="px-3 pb-1 text-xs font-medium text-muted-foreground">Courses</p>
          {courses.map((course) => (
            <SuggestionRow
              key={course.id}
              testId="global-search-course-item"
              onClick={() => onSelectCourse(course)}
              leading={
                course.thumbnailUrl ? (
                  <img src={course.thumbnailUrl} alt="" className="h-8 w-12 rounded object-cover" />
                ) : (
                  <div className="h-8 w-12 rounded bg-muted" />
                )
              }
            >
              <div className="flex flex-col">
                <span className="line-clamp-1">{course.title}</span>
                {course.authorName ? (
                  <span className="text-xs text-muted-foreground">{course.authorName}</span>
                ) : null}
              </div>
            </SuggestionRow>
          ))}
        </div>
      )}

      {instructors.length > 0 && (
        <div data-testid="global-search-instructors" className="mt-1">
          <p className="px-3 pb-1 text-xs font-medium text-muted-foreground">Instructors</p>
          {instructors.map((instructor) => (
            <SuggestionRow
              key={instructor.id}
              icon={User}
              testId="global-search-instructor-item"
              onClick={() => onSelectInstructor(instructor)}
            >
              <div className="flex flex-col">
                <span className="line-clamp-1">{instructor.name}</span>
                {instructor.headline ? (
                  <span className="line-clamp-1 text-xs text-muted-foreground">{instructor.headline}</span>
                ) : null}
              </div>
            </SuggestionRow>
          ))}
        </div>
      )}
    </div>
  );
}

function SuggestionRow({ icon: Icon, leading, children, onClick, testId, className }) {
  return (
    <button
      type="button"
      role="option"
      data-testid={testId}
      // onMouseDown (not onClick) fires before the input's onBlur, so a
      // click here isn't lost to the panel closing first.
      onMouseDown={(e) => {
        e.preventDefault();
        onClick();
      }}
      className={cn(
        'flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-accent focus-visible:bg-accent focus-visible:outline-none',
        className
      )}
    >
      {leading ?? (Icon ? <Icon className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" /> : null)}
      <span className="min-w-0 flex-1">{children}</span>
    </button>
  );
}

export default SuggestionsPanel;
