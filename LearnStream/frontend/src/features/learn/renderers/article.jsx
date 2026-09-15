import { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { completeItem } from "../api";

export default {
  type: "article",
  Component: function ArticleRenderer({ courseId, item, completed, onCompleted }) {
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState(null);

    const handleComplete = async () => {
      setIsSubmitting(true);
      setError(null);
      try {
        await completeItem(courseId, item.id);
        onCompleted?.();
      } catch {
        setError("Couldn't mark this article complete. Try again.");
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
        <div className="prose prose-sm max-w-none dark:prose-invert" data-testid="article-body">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{item.body || ""}</ReactMarkdown>
        </div>
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
