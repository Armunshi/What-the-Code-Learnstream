import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { fetchSuggestions, fetchTrending } from '../api.js';
import { searchKeys } from '../queryKeys.js';
import { SuggestionsPanel } from './SuggestionsPanel.jsx';

// GlobalSearch({variant}) — replaces the Wave-0 placeholder body
// (docs/contracts/stubs.md), same frozen signature. Behavior, also frozen:
// empty focus shows Trending; at 1+ characters, a 200ms-debounced, grouped
// suggest response (aborting the in-flight request on each keystroke, via
// TanStack Query's own AbortSignal wiring — see suggestQuery below); Enter
// navigates to /courses/search?q=; "/" focuses it from anywhere SiteHeader
// is mounted.
function useGlobalSearchLogic({ onNavigate }) {
  const [value, setValue] = useState('');
  const [open, setOpen] = useState(false);
  const debouncedValue = useDebouncedValue(value, 200);
  const inputRef = useRef(null);

  const trimmed = debouncedValue.trim();

  const trendingQuery = useQuery({
    queryKey: searchKeys.trending,
    queryFn: ({ signal }) => fetchTrending(signal),
    staleTime: 5 * 60 * 1000,
    enabled: open && trimmed.length === 0,
  });

  // Keyed on the DEBOUNCED value, not `value` — a new key per settled
  // keystroke is what makes TanStack Query cancel the previous request's
  // signal automatically when a newer one supersedes it, satisfying "abort
  // the in-flight request on each keystroke" without hand-rolled
  // AbortController bookkeeping here.
  const suggestQuery = useQuery({
    queryKey: searchKeys.suggest(trimmed),
    queryFn: ({ signal }) => fetchSuggestions(trimmed, signal),
    staleTime: 30 * 1000,
    enabled: open && trimmed.length >= 1,
  });

  const submit = (q) => {
    const query = (q ?? value).trim();
    setOpen(false);
    inputRef.current?.blur();
    onNavigate(query);
  };

  // "/" focuses the search box from anywhere — but never while the user is
  // already typing into some OTHER input/textarea/contenteditable, which
  // would otherwise hijack a literal "/" character they meant to type.
  useEffect(() => {
    const handler = (e) => {
      if (e.key !== '/' || e.metaKey || e.ctrlKey || e.altKey) return;
      const target = e.target;
      const isTyping =
        target instanceof HTMLElement &&
        (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable);
      if (isTyping) return;
      e.preventDefault();
      inputRef.current?.focus();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  return {
    value,
    setValue,
    open,
    setOpen,
    inputRef,
    trimmed,
    trendingQuery,
    suggestQuery,
    submit,
  };
}

function SearchInput({ state, placeholder, onKeyDownExtra, autoFocus }) {
  const { value, setValue, setOpen, inputRef, submit } = state;
  return (
    <div className="relative w-full">
      <Search
        className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
        aria-hidden="true"
      />
      <Input
        ref={inputRef}
        type="search"
        role="combobox"
        aria-expanded={state.open}
        aria-label="Search courses"
        data-testid="global-search-input"
        placeholder={placeholder}
        autoFocus={autoFocus}
        className="pl-8"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            submit();
          } else if (e.key === 'Escape') {
            setOpen(false);
            inputRef.current?.blur();
          }
          onKeyDownExtra?.(e);
        }}
      />
    </div>
  );
}

function PanelFor(state) {
  const { open, trimmed, trendingQuery, suggestQuery } = state;
  if (!open) return null;

  const mode = trimmed.length === 0 ? 'trending' : 'suggest';
  const isLoading = mode === 'trending' ? trendingQuery.isLoading : suggestQuery.isLoading;

  return (
    <SuggestionsPanel
      mode={mode}
      trending={trendingQuery.data ?? []}
      suggestions={suggestQuery.data}
      isLoading={isLoading}
      onSelectQuery={(q) => state.submit(q)}
      onSelectCourse={(course) => {
        state.setOpen(false);
        state.navigate(`/course/${course.id}`);
      }}
      onSelectInstructor={(instructor) => {
        state.setOpen(false);
        state.navigate(instructor.username ? `/user/${instructor.username}` : '/');
      }}
    />
  );
}

function InlineGlobalSearch({ className }) {
  const navigate = useNavigate();
  const state = useGlobalSearchLogic({ onNavigate: (q) => navigate(`/courses/search?q=${encodeURIComponent(q)}`) });
  state.navigate = navigate;

  return (
    <div className={cn('relative w-full max-w-md', className)} data-testid="global-search" data-variant="inline">
      <SearchInput state={state} placeholder="Search for anything" />
      {state.open ? (
        <div
          className="absolute left-0 right-0 top-full z-50 mt-1 max-h-96 overflow-y-auto rounded-md border bg-popover shadow-md"
          data-testid="global-search-panel"
        >
          <PanelFor {...state} />
        </div>
      ) : null}
    </div>
  );
}

function DialogGlobalSearch({ className }) {
  const navigate = useNavigate();
  const [dialogOpen, setDialogOpen] = useState(false);
  const state = useGlobalSearchLogic({
    onNavigate: (q) => {
      setDialogOpen(false);
      navigate(`/courses/search?q=${encodeURIComponent(q)}`);
    },
  });
  state.navigate = (path) => {
    setDialogOpen(false);
    navigate(path);
  };

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        aria-label="Search"
        className={className}
        onClick={() => setDialogOpen(true)}
      >
        <Search className="h-5 w-5" />
      </Button>
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="top-16 translate-y-0 gap-2 p-3" data-testid="global-search" data-variant="dialog">
          <DialogTitle className="sr-only">Search courses</DialogTitle>
          <SearchInput state={state} placeholder="Search for anything" autoFocus />
          <div className="max-h-96 overflow-y-auto" data-testid="global-search-panel">
            <PanelFor {...state} open={dialogOpen && state.open} />
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

export function GlobalSearch({ variant = 'inline', className }) {
  if (variant === 'dialog') return <DialogGlobalSearch className={className} />;
  return <InlineGlobalSearch className={className} />;
}

export default GlobalSearch;
