import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { completeItem, getAssignmentDetail, submitAssignmentFiles } from "../api";

const IMAGE_EXTENSIONS = new Set(["jpg", "jpeg", "png", "gif", "webp", "svg"]);

function fileExtension(url) {
  const path = url.split("?")[0];
  const match = /\.([a-z0-9]+)$/i.exec(path);
  return match ? match[1].toLowerCase() : "";
}

// Opens the file inside the app rather than a bare new tab — PDFs and images
// preview inline (a browser tab can already render both natively, an iframe/
// img just keeps that rendering inside our own UI); anything else (docx,
// zip, ...) has no in-browser preview either way, so it falls back to a
// plain download link rather than pretending to embed it.
function MaterialViewerDialog({ url, label, open, onOpenChange }) {
  const ext = url ? fileExtension(url) : "";
  const isPdf = ext === "pdf";
  const isImage = IMAGE_EXTENSIONS.has(ext);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] max-w-3xl">
        <DialogHeader>
          <DialogTitle>{label}</DialogTitle>
        </DialogHeader>
        {isPdf ? (
          <iframe src={url} title={label} className="h-[70vh] w-full rounded border" />
        ) : isImage ? (
          <img src={url} alt={label} className="max-h-[70vh] w-full rounded border object-contain" />
        ) : (
          <div className="flex flex-col items-center gap-3 py-8 text-sm text-muted-foreground">
            <p>This file type can&apos;t be previewed here.</p>
            <Button asChild size="sm">
              <a href={url} target="_blank" rel="noopener noreferrer">
                Download {label}
              </a>
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function MaterialLink({ url, label }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="text-primary underline">
        {label}
      </button>
      <MaterialViewerDialog url={url} label={label} open={open} onOpenChange={setOpen} />
    </>
  );
}

export default {
  type: "assignment",
  Component: function AssignmentRenderer({ courseId, item, completed, onCompleted }) {
    const queryClient = useQueryClient();
    const [selectedFiles, setSelectedFiles] = useState([]);
    const [completeError, setCompleteError] = useState(null);
    const [isCompleting, setIsCompleting] = useState(false);

    // item.id IS the underlying Assignment document's own _id — the
    // curriculum migration/sync deliberately preserves it (see
    // services/curriculum/sync.js) — so it's what /courses/:courseId/
    // assignments/:assignmentId expects, with no extra lookup needed.
    const assignmentQuery = useQuery({
      queryKey: ["assignment", "detail", courseId, item.id],
      queryFn: () => getAssignmentDetail(courseId, item.id),
      enabled: Boolean(courseId && item?.id),
    });

    const submitMutation = useMutation({
      mutationFn: (files) => submitAssignmentFiles(courseId, item.id, files),
      onSuccess: () => {
        setSelectedFiles([]);
        queryClient.invalidateQueries({ queryKey: ["assignment", "detail", courseId, item.id] });
      },
    });

    const handleComplete = async () => {
      setIsCompleting(true);
      setCompleteError(null);
      try {
        await completeItem(courseId, item.id);
        onCompleted?.();
      } catch (err) {
        // The backend 400s an assignment with no verified submission
        // (D5) — surface that distinctly from a generic failure.
        if (err?.response?.status === 400) {
          setCompleteError("Submit your assignment before marking this complete.");
        } else {
          setCompleteError("Couldn't mark this assignment complete. Try again.");
        }
      } finally {
        setIsCompleting(false);
      }
    };

    const materialUrls = assignmentQuery.data?.assignmentUrls?.filter(Boolean) ?? [];
    const mySubmissions = assignmentQuery.data?.uploadedAssignments?.flatMap(
      (submission) => submission.submittedAssignmentUrls ?? []
    ) ?? [];

    return (
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-lg font-semibold">{item.title}</h2>
          {completed && <Badge data-testid="item-completed-badge">Completed</Badge>}
        </div>

        {assignmentQuery.isLoading && (
          <p className="text-sm text-muted-foreground">Loading assignment…</p>
        )}

        {materialUrls.length > 0 && (
          <div className="flex flex-col gap-1">
            <h3 className="text-sm font-medium">Assignment material</h3>
            <ul className="list-disc pl-5">
              {materialUrls.map((url, index) => (
                <li key={url} className="text-sm">
                  <MaterialLink url={url} label={`Material ${index + 1}`} />
                </li>
              ))}
            </ul>
          </div>
        )}

        {mySubmissions.length > 0 && (
          <div className="flex flex-col gap-1">
            <h3 className="text-sm font-medium">Your submission</h3>
            <ul className="list-disc pl-5">
              {mySubmissions.map((url, index) => (
                <li key={url} className="text-sm">
                  <MaterialLink url={url} label={`Submitted file ${index + 1}`} />
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="flex flex-col gap-2 rounded-md border p-3">
          <label className="text-sm font-medium" htmlFor={`assignment-upload-${item.id}`}>
            {mySubmissions.length > 0 ? "Replace your submission" : "Upload your submission"}
          </label>
          <input
            id={`assignment-upload-${item.id}`}
            type="file"
            multiple
            onChange={(e) => setSelectedFiles(Array.from(e.target.files ?? []))}
            className="text-sm"
          />
          <Button
            size="sm"
            className="self-start"
            disabled={selectedFiles.length === 0 || submitMutation.isPending}
            onClick={() => submitMutation.mutate(selectedFiles)}
          >
            {submitMutation.isPending ? "Uploading…" : "Submit"}
          </Button>
          {submitMutation.isError && (
            <p className="text-sm text-destructive">Couldn&apos;t upload your submission. Try again.</p>
          )}
          {submitMutation.isSuccess && (
            <p className="text-sm text-muted-foreground">Uploaded successfully.</p>
          )}
        </div>

        {!completed && (
          <div className="flex flex-col gap-2">
            <Button onClick={handleComplete} disabled={isCompleting} data-testid="mark-complete-button">
              Mark as complete
            </Button>
            {completeError && <p className="text-sm text-destructive">{completeError}</p>}
          </div>
        )}
      </div>
    );
  },
};
