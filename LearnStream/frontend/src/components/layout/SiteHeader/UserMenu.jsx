import { Link } from 'react-router-dom';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useCurrentUser, useLogout } from '@/features/nav';
import menuGroups from '@/app/menuRegistry';

// Canonical display order for the groups the plan lists (§5.1, S-FR-4.1):
// Learning, Communication, Account, Roles, Session. Any group name a lane
// adds that isn't in this list (there shouldn't be one) sorts after these,
// alphabetically, rather than being dropped.
const GROUP_ORDER = ['Learning', 'Communication', 'Account', 'Roles', 'Session'];

function orderedGroups() {
  const byName = new Map();
  for (const entry of menuGroups) {
    if (!entry?.group) continue;
    const items = byName.get(entry.group) ?? [];
    byName.set(entry.group, [...items, ...(entry.items ?? [])]);
  }

  return [...byName.entries()].sort(([a], [b]) => {
    const ia = GROUP_ORDER.indexOf(a);
    const ib = GROUP_ORDER.indexOf(b);
    if (ia === -1 && ib === -1) return a.localeCompare(b);
    if (ia === -1) return 1;
    if (ib === -1) return -1;
    return ia - ib;
  });
}

export function UserMenu() {
  const { name, email, initials, avatar, role, enrolledCount } = useCurrentUser();
  const logout = useLogout();
  const groups = orderedGroups();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label="Account menu"
          data-testid="user-menu-trigger"
          className="flex h-10 w-10 items-center justify-center rounded-full ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
          <Avatar>
            {avatar && <AvatarImage src={avatar} alt="" />}
            <AvatarFallback>{initials}</AvatarFallback>
          </Avatar>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64" data-testid="user-menu-content">
        <DropdownMenuLabel className="flex flex-col gap-0.5 font-normal">
          <span className="text-sm font-medium text-foreground">{name}</span>
          <span className="text-xs text-muted-foreground">{email}</span>
          {role === 'student' && (
            <span className="text-xs text-muted-foreground">{enrolledCount} courses enrolled</span>
          )}
        </DropdownMenuLabel>

        {groups.map(([groupName, items]) => {
          const visible = items.filter((item) => !item.roles || item.roles.includes(role));
          if (visible.length === 0) return null;

          return (
            <DropdownMenuGroup key={groupName}>
              <DropdownMenuSeparator />
              {visible.map((item) =>
                item.action === 'logout' ? (
                  <DropdownMenuItem key={item.label} onSelect={logout} data-testid="nav-logout">
                    {item.label}
                  </DropdownMenuItem>
                ) : (
                  <DropdownMenuItem key={item.label} asChild>
                    <Link to={item.to}>{item.label}</Link>
                  </DropdownMenuItem>
                )
              )}
            </DropdownMenuGroup>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export default UserMenu;
