import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { MediaUploadField } from '../MediaUploadField';
import { ImageUploadField } from '../ImageUploadField';
import { UploadTray } from '../UploadTray';

/**
 * Drives the upload pipeline end to end without depending on the curriculum
 * authoring UI (W2-CURR, not built yet) — D4's own test requirement: "e2e
 * on the harness (fake provider): progress → processing → ready survives
 * reload; a forced chunk failure succeeds on Retry." Only ever mounted
 * behind VITE_E2E_HARNESS=1 (see ../routes.jsx), so this never ships in a
 * production bundle.
 *
 * ?courseId=<id> selects the target course (the e2e fixture's seeded
 * course — see e2e/global-setup.ts). Exercises `course-promo` (async,
 * video — the only async kind that needs no itemId, since no
 * CurriculumItem fixture exists yet either) via MediaUploadField, and
 * `course-thumbnail` (sync, image) via ImageUploadField.
 */
export function UploadHarnessPage() {
  const [searchParams] = useSearchParams();
  const courseId = searchParams.get('courseId');
  const [forceFailure, setForceFailure] = useState(false);

  const toggleForceFailure = (event) => {
    const next = event.target.checked;
    setForceFailure(next);
    window.__E2E_FORCE_UPLOAD_FAILURE__ = next;
  };

  if (!courseId) {
    return <div data-testid="upload-harness-missing-course">Pass ?courseId=&lt;id&gt; to use the upload harness.</div>;
  }

  return (
    <div className="mx-auto max-w-xl space-y-8 p-6">
      <h1 className="text-lg font-semibold">Upload pipeline harness</h1>

      <label className="flex items-center gap-2 text-sm" data-testid="force-failure-toggle">
        <input type="checkbox" checked={forceFailure} onChange={toggleForceFailure} />
        Force the next chunk upload to fail
      </label>

      <section>
        <h2 className="mb-2 text-sm font-medium">course-promo (async / video)</h2>
        <MediaUploadField courseId={courseId} target={{ kind: 'course-promo' }} label="Upload a promo video" />
      </section>

      <section>
        <h2 className="mb-2 text-sm font-medium">course-thumbnail (sync / image)</h2>
        <ImageUploadField courseId={courseId} target={{ kind: 'course-thumbnail' }} label="Upload a thumbnail" />
      </section>

      <UploadTray />
    </div>
  );
}

export default UploadHarnessPage;
