import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, MoreVertical, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';

const MAX_OBJECTIVES = 10;
const MAX_OBJECTIVE_LENGTH = 160;

// Sortable objectives editor (C-FR-2, dnd-kit) — the drag handle is a mouse/
// touch affordance; the "⋮" menu's Move up/down items are the full keyboard
// alternative (plan W1-SHELL), since dnd-kit's own keyboard sensor requires
// first tabbing to and picking up the drag handle, which is a less
// discoverable path than a plain menu item.
function ObjectiveRow({ id, index, count, register, onRemove, onMoveUp, onMoveDown }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const style = { transform: CSS.Transform.toString(transform), transition };

  return (
    <li
      ref={setNodeRef}
      style={style}
      className={cn(
        'flex items-center gap-2 rounded-md border bg-background p-2',
        isDragging && 'z-10 shadow-md'
      )}
    >
      <button
        type="button"
        className="cursor-grab touch-none rounded p-1 text-muted-foreground hover:bg-muted active:cursor-grabbing"
        aria-label={`Reorder objective ${index + 1}`}
        {...attributes}
        {...listeners}
      >
        <GripVertical className="h-4 w-4" aria-hidden="true" />
      </button>

      <Input
        aria-label={`Learning objective ${index + 1}`}
        placeholder="e.g. Build and deploy a full-stack web app"
        maxLength={MAX_OBJECTIVE_LENGTH}
        {...register(`learningObjectives.${index}.value`)}
      />

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button type="button" variant="ghost" size="icon" aria-label={`More actions for objective ${index + 1}`}>
            <MoreVertical className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem disabled={index === 0} onSelect={onMoveUp}>
            Move up
          </DropdownMenuItem>
          <DropdownMenuItem disabled={index === count - 1} onSelect={onMoveDown}>
            Move down
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Button type="button" variant="ghost" size="icon" aria-label={`Remove objective ${index + 1}`} onClick={onRemove}>
        <Trash2 className="h-4 w-4" />
      </Button>
    </li>
  );
}

export function ObjectivesList({ fields, register, append, remove, move }) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleDragEnd = (event) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = fields.findIndex((field) => field.id === active.id);
    const newIndex = fields.findIndex((field) => field.id === over.id);
    if (oldIndex !== -1 && newIndex !== -1) move(oldIndex, newIndex);
  };

  return (
    <div className="space-y-3">
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={fields.map((field) => field.id)} strategy={verticalListSortingStrategy}>
          <ul className="space-y-2">
            {fields.map((field, index) => (
              <ObjectiveRow
                key={field.id}
                id={field.id}
                index={index}
                count={fields.length}
                register={register}
                onRemove={() => remove(index)}
                onMoveUp={() => index > 0 && move(index, index - 1)}
                onMoveDown={() => index < fields.length - 1 && move(index, index + 1)}
              />
            ))}
          </ul>
        </SortableContext>
      </DndContext>

      <Button type="button" variant="outline" size="sm" onClick={() => append({ value: '' })} disabled={fields.length >= MAX_OBJECTIVES}>
        + Add objective
      </Button>
      {fields.length >= MAX_OBJECTIVES ? (
        <p className="text-xs text-muted-foreground">You can add up to {MAX_OBJECTIVES} learning objectives.</p>
      ) : null}
    </div>
  );
}

export default ObjectivesList;
