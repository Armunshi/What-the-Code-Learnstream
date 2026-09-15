import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { completeItem } from "../api";

export default {
  type: "assignment",
  Component: function AssignmentRenderer({ courseId, item, completed, onCompleted }) {
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState(null);

    const handleComplete = async () => {
      setIsSubmitting(true);
      setError(null);
      try {
        await completeItem(courseId, item.id);
        onCompleted?.();
      } catch (err) {
        // The backend 400s an assignment with no verified submission
        // (D5) — surface that distinctly from a generic failure.
        if (err?.response?.status === 400) {
          setError("Submit your assignment before marking this complete.");
        } else {
          setError("Couldn't mark this assignment complete. Try again.");
        }
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
        <p className="text-sm text-muted-foreground">
          Submit your work for this assignment from Your Work, then come back here to mark it complete.
        </p>
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
