import { useEffect, useRef, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Send } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { normalizeApiError } from "@/lib/api/errors";
import { askLectureQuestion } from "../api";

const MIN_QUESTION_CHARS = 3;

function formatTimestamp(sec) {
  if (sec == null) return null;
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

/**
 * Retrieve-and-answer chat over the current lecture's transcript
 * (backend/src/services/rag) — the assistant answers only from what the
 * transcript actually covers, and every answer's timestamp citations are
 * clickable, seeking the video the same way TranscriptPanel's cues do.
 *
 * Message history is client-side only, reset on lecture change: there is no
 * backend endpoint to persist or replay a chat thread, only to answer one
 * question at a time.
 */
export function ChatPanel({ lectureId, onSeek }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const bottomRef = useRef(null);

  useEffect(() => {
    setMessages([]);
    setInput("");
  }, [lectureId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages]);

  const mutation = useMutation({
    mutationFn: (question) => askLectureQuestion(lectureId, question),
    onSuccess: (result) => {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: result.answer, citations: result.citations ?? [] },
      ]);
    },
    onError: (error) => {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: normalizeApiError(error).message, citations: [], isError: true },
      ]);
    },
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    const question = input.trim();
    if (question.length < MIN_QUESTION_CHARS || mutation.isPending) return;

    setMessages((prev) => [...prev, { role: "user", content: question }]);
    setInput("");
    mutation.mutate(question);
  };

  return (
    <div className="flex h-full flex-col" data-testid="chat-panel">
      <ScrollArea className="flex-1">
        <div className="flex flex-col gap-3 p-3">
          {messages.length === 0 && (
            <p className="text-sm text-muted-foreground" data-testid="chat-empty">
              Ask a question about this lecture — the assistant answers only from what it actually covers.
            </p>
          )}

          {messages.map((message, index) => (
            <div
              key={index}
              data-testid="chat-message"
              data-role={message.role}
              className={`max-w-[85%] rounded-lg px-3 py-2 text-sm ${
                message.role === "user"
                  ? "ml-auto bg-primary text-primary-foreground"
                  : message.isError
                    ? "bg-destructive/10 text-destructive"
                    : "bg-muted text-foreground"
              }`}
            >
              <p className="whitespace-pre-wrap">{message.content}</p>
              {message.citations?.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {message.citations.map((citation, i) => (
                    <button
                      key={i}
                      type="button"
                      data-testid="chat-citation"
                      onClick={() => onSeek(citation.startSec)}
                      className="rounded border border-current/30 px-1.5 py-0.5 text-xs hover:bg-background/50"
                    >
                      {formatTimestamp(citation.startSec)}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))}

          {mutation.isPending && (
            <div className="max-w-[85%] rounded-lg bg-muted px-3 py-2 text-sm text-muted-foreground" data-testid="chat-pending">
              Thinking…
            </div>
          )}

          <div ref={bottomRef} />
        </div>
      </ScrollArea>

      <form onSubmit={handleSubmit} className="flex items-center gap-2 border-t p-2">
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask about this lecture…"
          disabled={mutation.isPending}
          maxLength={500}
          data-testid="chat-input"
        />
        <Button
          type="submit"
          size="icon"
          disabled={mutation.isPending || input.trim().length < MIN_QUESTION_CHARS}
          data-testid="chat-send"
        >
          <Send className="h-4 w-4" />
        </Button>
      </form>
    </div>
  );
}

export default ChatPanel;
