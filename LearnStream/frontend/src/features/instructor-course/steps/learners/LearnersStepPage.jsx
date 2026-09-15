import { useCallback, useMemo, useRef } from 'react';
import { useOutletContext } from 'react-router-dom';
import { useForm, useFieldArray, useWatch } from 'react-hook-form';
import { Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { updateCourseLearners } from '../../api';
import { useAutosave } from '../../hooks/useAutosave';
import { SaveStatus } from '../../components/SaveStatus';
import { ConflictDialog } from '../../components/ConflictDialog';
import { ObjectivesList } from './ObjectivesList';

const MAX_LIST_ITEMS = 10;

// Requirements/target-audience are plain add-remove lists (no drag) — only
// objectives get dnd-kit sortable per plan W1-SHELL.
function SimpleStringList({ label, placeholder, name, fields, register, append, remove }) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <ul className="space-y-2">
        {fields.map((field, index) => (
          <li key={field.id} className="flex items-center gap-2">
            <Input aria-label={`${label} ${index + 1}`} placeholder={placeholder} {...register(`${name}.${index}.value`)} />
            <Button type="button" variant="ghost" size="icon" aria-label={`Remove ${label.toLowerCase()} ${index + 1}`} onClick={() => remove(index)}>
              <Trash2 className="h-4 w-4" />
            </Button>
          </li>
        ))}
      </ul>
      <Button type="button" variant="outline" size="sm" onClick={() => append({ value: '' })} disabled={fields.length >= MAX_LIST_ITEMS}>
        + Add
      </Button>
    </div>
  );
}

const toFieldArray = (values) => (values ?? []).map((value) => ({ value }));
const fromFieldArray = (fields) => (fields ?? []).map((field) => field.value.trim()).filter(Boolean);

function buildDefaultValues(course) {
  return {
    learningObjectives: toFieldArray(course.learningObjectives),
    requirements: toFieldArray(course.requirements),
    targetAudience: toFieldArray(course.targetAudience),
    noPrerequisites: Boolean(course.noPrerequisites),
  };
}

// The wire payload a given set of form values would produce — used both to
// build the PATCH body and to decide whether there's anything worth saving
// at all (see the comment on `lastSavedPayloadRef` below).
function toPayload(values) {
  return {
    learningObjectives: fromFieldArray(values.learningObjectives),
    requirements: values.noPrerequisites ? [] : fromFieldArray(values.requirements),
    targetAudience: fromFieldArray(values.targetAudience),
    noPrerequisites: Boolean(values.noPrerequisites),
  };
}

export function LearnersStepPage() {
  const { course, onCourseSaved } = useOutletContext();
  const { control, register, reset, setValue } = useForm({
    defaultValues: useMemo(() => buildDefaultValues(course), [course._id]), // eslint-disable-line react-hooks/exhaustive-deps -- re-seed only when we navigate to a different course, not on every course refetch
  });

  const objectives = useFieldArray({ control, name: 'learningObjectives' });
  const requirements = useFieldArray({ control, name: 'requirements' });
  const targetAudience = useFieldArray({ control, name: 'targetAudience' });

  // useWatch, not the bare `watch()` function called during render: the
  // latter only returns a snapshot at whatever render happens to be running
  // and does not itself subscribe to changes, so typing into a register()'d
  // (uncontrolled) input would never re-render this component and this
  // value would silently stay stale — confirmed live via the e2e suite,
  // where an autosave fired with the pre-typing (empty) snapshot because no
  // re-render had happened since the field was added.
  const watchedValues = useWatch({ control });
  const noPrerequisites = watchedValues.noPrerequisites;

  // Autosave dirtiness is tracked by comparing the SERIALIZED wire payload
  // (post-trim, post-empty-filter) against the last one actually saved —
  // deliberately not react-hook-form's own `formState.isDirty`. Clicking "+
  // Add objective" makes RHF's isDirty true immediately, before the new row
  // has any content; toPayload() filters empty entries, so the wire payload
  // is unchanged until the instructor types something. That matters because
  // the alternative (autosaving the empty add immediately, then resetting
  // the form from the server's echoed-back — shorter — array once it
  // "saves") regenerates useFieldArray's row ids on every reset, which
  // unmounts and remounts every input the instructor might be mid-keystroke
  // in. Comparing payloads sidesteps needing reset() — and therefore that
  // remount — after every ordinary save; reset() is now used only for the
  // conflict "reload latest" path, where replacing the whole form's content
  // is exactly what's wanted.
  const lastSavedPayloadRef = useRef(null);
  if (lastSavedPayloadRef.current === null) {
    lastSavedPayloadRef.current = toPayload(buildDefaultValues(course));
  }
  const currentPayload = useMemo(() => toPayload(watchedValues), [watchedValues]);
  const isDirty = JSON.stringify(currentPayload) !== JSON.stringify(lastSavedPayloadRef.current);

  const save = useCallback(
    (values, editVersion) => updateCourseLearners(course._id, { ...toPayload(values), editVersion }),
    [course._id]
  );

  const handleSaved = useCallback(
    (savedCourse) => {
      lastSavedPayloadRef.current = currentPayload;
      onCourseSaved?.(savedCourse);
    },
    [currentPayload, onCourseSaved]
  );

  const autosave = useAutosave({
    sourceId: 'learners',
    editVersion: course.editVersion,
    isDirty,
    values: watchedValues,
    save,
    onSaved: handleSaved,
  });

  return (
    <div className="mx-auto max-w-2xl space-y-8 p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold">Intended learners</h1>
          <p className="text-sm text-muted-foreground">
            Tell students what they&apos;ll learn, what they need to know beforehand, and who this course is for.
          </p>
        </div>
        <SaveStatus state={autosave.state} onRetry={autosave.retry} error={autosave.error} />
      </div>

      <section className="space-y-3">
        <h2 className="text-sm font-medium">What will students learn in your course? *</h2>
        <ObjectivesList
          fields={objectives.fields}
          register={register}
          append={objectives.append}
          remove={objectives.remove}
          move={objectives.move}
        />
      </section>

      <Separator />

      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <Checkbox
            id="noPrerequisites"
            checked={noPrerequisites}
            onCheckedChange={(checked) => setValue('noPrerequisites', checked === true, { shouldDirty: true })}
          />
          <Label htmlFor="noPrerequisites">This course has no prerequisites</Label>
        </div>
        {!noPrerequisites ? (
          <SimpleStringList
            label="Requirements"
            placeholder="e.g. A laptop with Node.js installed"
            name="requirements"
            fields={requirements.fields}
            register={register}
            append={requirements.append}
            remove={requirements.remove}
          />
        ) : null}
      </section>

      <Separator />

      <section>
        <SimpleStringList
          label="Who is this course for?"
          placeholder="e.g. Beginner developers who know basic JavaScript"
          name="targetAudience"
          fields={targetAudience.fields}
          register={register}
          append={targetAudience.append}
          remove={targetAudience.remove}
        />
      </section>

      <ConflictDialog
        open={autosave.state === 'conflict'}
        onOverwrite={autosave.overwriteConflict}
        onReloadLatest={() =>
          autosave.reloadConflict((remote) => {
            reset(buildDefaultValues(remote));
            lastSavedPayloadRef.current = toPayload(buildDefaultValues(remote));
          })
        }
      />
    </div>
  );
}

export default LearnersStepPage;
