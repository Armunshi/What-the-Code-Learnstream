import { useId, useRef, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { FileText, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { normalizeApiError } from '@/lib/api/errors';
import {
  listModules,
  createModule,
  deleteModule,
  addLecture,
  deleteLecture,
  addAssignment,
  deleteAssignment,
  uploadLectureTranscript,
} from '../../legacyCurriculumApi';

const modulesKey = (courseId) => ['legacy-modules', courseId];

function AddLectureForm({ courseId, moduleId, onDone }) {
  const queryClient = useQueryClient();
  const [title, setTitle] = useState('');
  const [file, setFile] = useState(null);

  const mutation = useMutation({
    mutationFn: () => addLecture(courseId, moduleId, { title, videoFile: file }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: modulesKey(courseId) });
      toast.success('Lecture added');
      setTitle('');
      setFile(null);
      onDone?.();
    },
    onError: (err) => toast.error(normalizeApiError(err).message),
  });

  return (
    <div className="flex flex-col gap-2 rounded-md border border-dashed p-3">
      <p className="text-sm font-medium">Add a lecture</p>
      <Input placeholder="Lecture title" value={title} onChange={(e) => setTitle(e.target.value)} />
      <input type="file" accept="video/*" onChange={(e) => setFile(e.target.files?.[0] ?? null)} className="text-sm" />
      <Button
        size="sm"
        className="self-start"
        disabled={!title || !file || mutation.isPending}
        onClick={() => mutation.mutate()}
      >
        {mutation.isPending ? 'Uploading…' : 'Add lecture'}
      </Button>
    </div>
  );
}

function AddAssignmentForm({ courseId, moduleId, onDone }) {
  const queryClient = useQueryClient();
  const [title, setTitle] = useState('');
  const [deadline, setDeadline] = useState('');
  // Leaving the date field blank already stores no due date (the backend
  // treats a missing deadline as "never late") — this checkbox exists so
  // that's an explicit choice instead of something only discoverable by
  // trying it, since a sold, self-paced course usually has no real reason
  // for one.
  const [noDueDate, setNoDueDate] = useState(true);
  const [files, setFiles] = useState([]);

  const mutation = useMutation({
    mutationFn: () => addAssignment(courseId, moduleId, { title, deadline: noDueDate ? undefined : deadline, files }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: modulesKey(courseId) });
      toast.success('Assignment added');
      setTitle('');
      setDeadline('');
      setNoDueDate(true);
      setFiles([]);
      onDone?.();
    },
    onError: (err) => toast.error(normalizeApiError(err).message),
  });

  return (
    <div className="flex flex-col gap-2 rounded-md border border-dashed p-3">
      <p className="text-sm font-medium">Add an assignment</p>
      <Input placeholder="Assignment title" value={title} onChange={(e) => setTitle(e.target.value)} />
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={noDueDate} onChange={(e) => setNoDueDate(e.target.checked)} />
        No due date
      </label>
      {!noDueDate && (
        <Input type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} />
      )}
      <input
        type="file"
        multiple
        onChange={(e) => setFiles(Array.from(e.target.files ?? []))}
        className="text-sm"
      />
      <Button
        size="sm"
        className="self-start"
        disabled={!title || files.length === 0 || (!noDueDate && !deadline) || mutation.isPending}
        onClick={() => mutation.mutate()}
      >
        {mutation.isPending ? 'Uploading…' : 'Add assignment'}
      </Button>
    </div>
  );
}

// Plumbing only, ahead of a future lecture-level RAG chatbot: lets a teacher
// attach a transcript file (.txt/.vtt/.srt) to a lecture. Nothing reads or
// processes it yet — this just gets it stored and linkable.
function TranscriptUploadControl({ courseId, moduleId, lecture }) {
  const queryClient = useQueryClient();
  const inputId = useId();
  const inputRef = useRef(null);

  const mutation = useMutation({
    mutationFn: (file) => uploadLectureTranscript(courseId, moduleId, lecture._id, file),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: modulesKey(courseId) });
      toast.success('Transcript uploaded');
    },
    onError: (err) => toast.error(normalizeApiError(err).message),
  });

  return (
    <span className="flex shrink-0 items-center gap-1">
      {lecture.transcriptUrl && (
        <a
          href={lecture.transcriptUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-primary underline"
        >
          Transcript
        </a>
      )}
      <input
        id={inputId}
        ref={inputRef}
        type="file"
        accept=".txt,.vtt,.srt,text/plain,text/vtt,application/x-subrip"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) mutation.mutate(file);
          e.target.value = '';
        }}
      />
      <Button
        type="button"
        size="icon"
        variant="ghost"
        aria-label={lecture.transcriptUrl ? `Replace transcript for ${lecture.title}` : `Upload transcript for ${lecture.title}`}
        disabled={mutation.isPending}
        onClick={() => inputRef.current?.click()}
      >
        <FileText className="h-3.5 w-3.5" />
      </Button>
    </span>
  );
}

function ModuleCard({ courseId, module: mod }) {
  const queryClient = useQueryClient();
  const [addingLecture, setAddingLecture] = useState(false);
  const [addingAssignment, setAddingAssignment] = useState(false);

  const deleteLectureMutation = useMutation({
    mutationFn: (lectureId) => deleteLecture(courseId, mod._id, lectureId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: modulesKey(courseId) });
      toast.success('Lecture removed');
    },
    onError: (err) => toast.error(normalizeApiError(err).message),
  });

  const deleteAssignmentMutation = useMutation({
    mutationFn: (assignmentId) => deleteAssignment(courseId, mod._id, assignmentId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: modulesKey(courseId) });
      toast.success('Assignment removed');
    },
    onError: (err) => toast.error(normalizeApiError(err).message),
  });

  const deleteModuleMutation = useMutation({
    mutationFn: () => deleteModule(courseId, mod._id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: modulesKey(courseId) });
      toast.success('Section removed');
    },
    onError: (err) => toast.error(normalizeApiError(err).message),
  });

  return (
    <Card className="flex flex-col gap-3 p-4">
      <div className="flex items-center justify-between">
        <h3 className="font-medium">{mod.title}</h3>
        <Button
          size="icon"
          variant="ghost"
          aria-label={`Delete ${mod.title}`}
          onClick={() => deleteModuleMutation.mutate()}
          disabled={deleteModuleMutation.isPending}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>

      {(mod.lectures?.length > 0 || mod.assignments?.length > 0) && (
        <ul className="flex flex-col gap-1">
          {mod.lectures?.map((lecture) => (
            <li key={lecture._id} className="flex items-center justify-between gap-2 text-sm">
              <span className="min-w-0 flex-1 truncate">🎬 {lecture.title}</span>
              <TranscriptUploadControl courseId={courseId} moduleId={mod._id} lecture={lecture} />
              <Button
                size="icon"
                variant="ghost"
                aria-label={`Delete ${lecture.title}`}
                onClick={() => deleteLectureMutation.mutate(lecture._id)}
                disabled={deleteLectureMutation.isPending}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </li>
          ))}
          {mod.assignments?.map((assignment) => (
            <li key={assignment._id} className="flex items-center justify-between gap-2 text-sm">
              <span className="min-w-0 flex-1 truncate">📄 {assignment.title}</span>
              <span className="shrink-0 text-xs text-muted-foreground">
                {assignment.deadline ? `Due ${new Date(assignment.deadline).toLocaleDateString()}` : 'No due date'}
              </span>
              <Button
                size="icon"
                variant="ghost"
                aria-label={`Delete ${assignment.title}`}
                onClick={() => deleteAssignmentMutation.mutate(assignment._id)}
                disabled={deleteAssignmentMutation.isPending}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </li>
          ))}
        </ul>
      )}

      <div className="flex flex-wrap gap-2">
        {addingLecture ? (
          <AddLectureForm courseId={courseId} moduleId={mod._id} onDone={() => setAddingLecture(false)} />
        ) : (
          <Button size="sm" variant="outline" onClick={() => setAddingLecture(true)}>
            <Plus className="mr-1 h-3.5 w-3.5" /> Lecture
          </Button>
        )}
        {addingAssignment ? (
          <AddAssignmentForm courseId={courseId} moduleId={mod._id} onDone={() => setAddingAssignment(false)} />
        ) : (
          <Button size="sm" variant="outline" onClick={() => setAddingAssignment(true)}>
            <Plus className="mr-1 h-3.5 w-3.5" /> Assignment
          </Button>
        )}
      </div>
    </Card>
  );
}

function AddModuleForm({ courseId }) {
  const queryClient = useQueryClient();
  const [title, setTitle] = useState('');

  const mutation = useMutation({
    mutationFn: () => createModule(courseId, { title }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: modulesKey(courseId) });
      toast.success('Section added');
      setTitle('');
    },
    onError: (err) => toast.error(normalizeApiError(err).message),
  });

  return (
    <Card className="flex flex-wrap items-center gap-2 p-4">
      <Input
        placeholder="New section title (e.g. Module 3: Deployment)"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        className="max-w-sm"
      />
      <Button disabled={!title || mutation.isPending} onClick={() => mutation.mutate()}>
        <Plus className="mr-1 h-4 w-4" /> Add section
      </Button>
    </Card>
  );
}

// Adds/removes sections, lectures and assignments through the legacy
// CourseRoutes endpoints (legacyCurriculumApi.js) — the new authoring shell
// otherwise has no curriculum-building step at all (a real drag-reorder
// editor against the new CurriculumItems schema is Wave 2 / CURR-lane
// scope). Living here, under /instructor/courses/:courseId/…, means this
// renders inside the same RootLayout/SiteHeader as every other step, unlike
// the legacy per-course page this replaces as the discoverable way in.
export function CurriculumStepPage() {
  const { course } = useOutletContext();
  const courseId = course._id;

  const modulesQuery = useQuery({
    queryKey: modulesKey(courseId),
    queryFn: () => listModules(courseId),
    enabled: Boolean(courseId),
  });

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-4 p-6">
      <div>
        <h1 className="text-xl font-semibold">Curriculum</h1>
        <p className="text-sm text-muted-foreground">
          Organize your course into sections, then add lectures and assignments to each one.
        </p>
      </div>

      {modulesQuery.isLoading && <p className="text-sm text-muted-foreground">Loading curriculum…</p>}
      {modulesQuery.isError && (
        <p className="text-sm text-destructive">Couldn&apos;t load the curriculum. Try refreshing.</p>
      )}

      {modulesQuery.data?.map((mod) => (
        <ModuleCard key={mod._id} courseId={courseId} module={mod} />
      ))}

      <AddModuleForm courseId={courseId} />
    </div>
  );
}

export default CurriculumStepPage;
