import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2];
const STORAGE_KEY = "learn.playbackRate";

export function getPersistedPlaybackRate() {
  try {
    const stored = Number(localStorage.getItem(STORAGE_KEY));
    return SPEEDS.includes(stored) ? stored : 1;
  } catch {
    return 1;
  }
}

function persistPlaybackRate(rate) {
  try {
    localStorage.setItem(STORAGE_KEY, String(rate));
  } catch {
    // Private browsing / storage disabled — the session still works, the
    // chosen speed just won't survive a reload.
  }
}

export function SpeedMenu({ playbackRate, onChange }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" data-testid="speed-menu-trigger">
          {playbackRate}x
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {SPEEDS.map((speed) => (
          <DropdownMenuItem
            key={speed}
            data-testid={`speed-option-${speed}`}
            onSelect={() => {
              persistPlaybackRate(speed);
              onChange(speed);
            }}
          >
            {speed}x{speed === playbackRate ? " ✓" : ""}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export default SpeedMenu;
