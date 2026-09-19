import { ChevronDown } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

const TYPE_LABEL = { video: "Video", article: "Article", assignment: "Assignment", resource: "Resource", quiz: "Quiz" };

function formatDuration(durationSec) {
  if (!durationSec) return null;
  const minutes = Math.floor(durationSec / 60);
  const seconds = Math.round(durationSec % 60);
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

function ItemDetails({ item }) {
  if (item.type === "resource") {
    return item.file ? (
      <a href={item.file.url} target="_blank" rel="noreferrer" className="text-xs underline">
        Download {item.file.filename || "file"}
      </a>
    ) : (
      <p className="text-xs text-muted-foreground">No file attached.</p>
    );
  }
  return (
    <p className="text-xs text-muted-foreground">
      {TYPE_LABEL[item.type] ?? item.type}
      {item.durationSec ? ` · ${formatDuration(item.durationSec)}` : ""}
    </p>
  );
}

/** Per-section "3/7" counts, per-item checkmarks, and a per-item resources
 *  dropdown showing that item's type/duration or attached file (L-FR-3.2,
 *  L-FR-3.3). */
export function CurriculumSidebar({ tree, activeItemId, onSelectItem }) {
  return (
    <ScrollArea className="h-full">
      <nav className="flex flex-col gap-4 p-3" data-testid="curriculum-sidebar">
        {tree.sections.map((section) => {
          const completedCount = section.items.filter((item) => item.completed).length;
          return (
            <div key={section.id}>
              <div className="flex items-center justify-between px-1 py-1">
                <h3 className="text-sm font-semibold">{section.title}</h3>
                <span className="text-xs text-muted-foreground" data-testid="section-progress">
                  {completedCount}/{section.items.length}
                </span>
              </div>
              <ul className="flex flex-col gap-1">
                {section.items.map((item) => (
                  <li key={item.id}>
                    <Collapsible>
                      <div
                        className={`flex min-w-0 items-center gap-1 rounded px-1 ${
                          item.id === activeItemId ? "bg-muted" : ""
                        }`}
                      >
                        <button
                          type="button"
                          data-testid="curriculum-item"
                          data-item-id={item.id}
                          onClick={() => onSelectItem(item.id)}
                          className="flex min-w-0 flex-1 items-center gap-2 py-1.5 text-left text-sm"
                        >
                          <span
                            className={`inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full border text-[10px] ${
                              item.completed
                                ? "border-primary bg-primary text-primary-foreground"
                                : "border-muted-foreground"
                            }`}
                            data-testid="item-checkmark"
                            data-completed={item.completed}
                          >
                            {item.completed ? "✓" : ""}
                          </span>
                          <span className={`min-w-0 flex-1 truncate ${item.id === activeItemId ? "font-medium" : ""}`}>
                            {item.title}
                          </span>
                        </button>
                        <CollapsibleTrigger
                          aria-label={`Show details for ${item.title}`}
                          data-testid="item-details-trigger"
                          className="rounded p-1 hover:bg-muted"
                        >
                          <ChevronDown className="h-3.5 w-3.5" />
                        </CollapsibleTrigger>
                      </div>
                      <CollapsibleContent className="px-2 pb-2 pl-8">
                        <ItemDetails item={item} />
                      </CollapsibleContent>
                    </Collapsible>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </nav>
    </ScrollArea>
  );
}

export default CurriculumSidebar;
