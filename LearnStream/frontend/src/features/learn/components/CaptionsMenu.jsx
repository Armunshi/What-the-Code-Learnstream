import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

/**
 * `captions` is the video item's full `media.captions` list; `selectedLang`
 * is either a lang code or null ("Off"). VideoPlayer's frozen `tracks` prop
 * takes the array as-is, so the parent is responsible for filtering it down
 * to zero-or-one entries based on this selection before passing it through.
 */
export function CaptionsMenu({ captions, selectedLang, onChange }) {
  if (!captions || captions.length === 0) return null;

  const activeLabel = captions.find((c) => c.lang === selectedLang)?.label ?? "Off";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" data-testid="captions-menu-trigger">
          CC: {activeLabel}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem data-testid="captions-option-off" onSelect={() => onChange(null)}>
          Off{selectedLang === null ? " ✓" : ""}
        </DropdownMenuItem>
        {captions.map((caption) => (
          <DropdownMenuItem
            key={caption.lang}
            data-testid={`captions-option-${caption.lang}`}
            onSelect={() => onChange(caption.lang)}
          >
            {caption.label}
            {selectedLang === caption.lang ? " ✓" : ""}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export default CaptionsMenu;
