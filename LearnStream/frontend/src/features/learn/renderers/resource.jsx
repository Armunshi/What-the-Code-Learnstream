import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { completeItem } from "../api";

export default {
  type: "resource",
  Component: function ResourceRenderer({ courseId, item, completed, onCompleted }) {
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState(null);

    const handleComplete = async () => {
      setIsSubmitting(true);
      setError(null);
      try {
        await completeItem(courseId, item.id);
        onCompleted?.();
      } catch {
        setError("Couldn't mark this resource complete. Try again.");
      } finally {
        setIsSubmitting(false);
      }
    };

    return (
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-lg font-semibold">{item.title}</h2>
          {completed && <Badge data-testid="item-completed-badge">Completed</Badge>}
        </div>
        {item.file ? (
          <a
            href={item.file.url}
            target="_blank"
            rel="noreferrer"
            className="text-sm font-medium text-primary underline"
            data-testid="resource-download-link"
          >
            Download {item.file.filename || "resource"}
          </a>
        ) : (
          <p className="text-sm text-muted-foreground">No file attached to this resource.</p>
        )}
        {!completed && (
          <div className="flex flex-col gap-2">
            <Button onClick={handleComplete} disabled={isSubmitting} data-testid="mark-complete-button">
              Mark as complete
            </Button>
            {error && <p className="text-sm text-destructive">{error}</p>}
          </div>
        )}
      </div>
    );
  },
};
