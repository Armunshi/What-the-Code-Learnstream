I reviewed the two recordings as a **product/requirements comparison**, treating the Udemy recording as the target benchmark and the LearnStream recording as the current implementation.

One important note: the LearnStream recording has substantial **screen-capture corruption/artifacts** over parts of the UI. I have **not treated those recording artifacts as LearnStream UI bugs**. The functional comparison below is based on controls, flows, screens, and behaviours that are actually discernible.

1. Functional gaps — things Udemy has that LearnStream lacks
2. Functional improvements — things both have, but Udemy does substantially better
3. UI/UX gaps
4. Non-functional requirements
5. Proposed target architecture/flow
6. Implementation-oriented acceptance criteria

---

# LearnStream Teacher Course Creation — Functional & UI Gap Analysis

## 1. Objective

This document defines the functional, UI/UX, and non-functional gaps between the current LearnStream teacher course creation experience and the observed Udemy instructor course creation experience.

The objective is **not to clone Udemy visually**, but to bring LearnStream to a comparable level of:

- course creation completeness
- instructor workflow guidance
- curriculum authoring capability
- content management
- publishing readiness
- validation and quality controls
- usability
- feedback and state management
- extensibility

The implementation should result in a production-ready teacher course creation system rather than a basic "module + lecture upload" interface.

---

## 2. Executive Gap Summary

### Current LearnStream Flow Observed

The current LearnStream flow primarily exposes:

```text
Teacher
  ↓
Course
  ↓
Course Modules
  ↓
Add Module
  ↓
Module Name
  ↓
Lecture Title
  ↓
Upload lecture/video
```

The current experience is therefore essentially a **basic curriculum uploader**.

### Udemy Flow Observed

Udemy provides a much broader course-authoring lifecycle:

```text
Create Course
    ↓
Plan Your Course
    ├── Intended Learners
    ├── Course Structure
    └── Setup & Test Video
    ↓
Create Your Content
    ├── Film & Edit
    ├── Curriculum
    ├── Captions
    └── Accessibility
    ↓
Publish Your Course
    ├── Course Landing Page
    ├── Pricing
    ├── Promotions
    └── Course Messages
    ↓
Submit for Review
```

Within Curriculum, Udemy additionally provides:

```text
Course
 └── Section
      ├── Section learning objective
      ├── Lecture
      │    ├── Video
      │    ├── Video & Slides
      │    ├── Article
      │    └── Resources
      └── Additional curriculum items
```

#### Primary conclusion

**LearnStream is currently missing an entire course-authoring lifecycle, not merely missing individual fields.**

The biggest architectural gap is therefore that LearnStream currently treats course creation as:

> "Create modules and upload lectures"

whereas the target should be:

> "Plan → Structure → Create Content → Enrich → Configure Course → Price → Publish → Review"

---

## 3. Functional Gap Analysis

### Priority Classification

| Priority | Meaning                                                 |
| -------- | ------------------------------------------------------- |
| P0       | Required to make course creation fundamentally complete |
| P1       | Important for reaching Udemy-level functionality        |
| P2       | Important enhancement / quality improvement             |
| P3       | Future enhancement                                      |

---

## 4. Course Creation Lifecycle

### FR-1: Guided Course Creation Workflow — P0

#### Gap

LearnStream does not currently provide the structured multi-stage authoring workflow visible in Udemy.

The teacher appears to directly enter the module/course content experience.

#### Target Behaviour

Course creation should be divided into explicit stages:

```text
1. Plan Your Course
2. Create Your Content
3. Publish Your Course
```

Each stage should contain individual tasks.

#### Proposed LearnStream structure

```text
Plan Your Course
├── Intended Learners
├── Course Structure
└── Setup & Test Video

Create Your Content
├── Film & Edit
├── Curriculum
├── Captions
└── Accessibility

Publish Your Course
├── Course Landing Page
├── Pricing
├── Promotions
└── Course Messages
```

#### Acceptance Criteria

- Instructor can see all course creation stages.
- Current step is visually highlighted.
- Completed steps show completion state.
- Instructor can navigate between completed/in-progress steps.
- Incomplete required steps prevent final publishing.
- Course creation state persists across navigation and sessions.

---

## 5. Intended Learners / Learning Outcomes

### FR-2: Intended Learners & Learning Outcomes — P0

#### Gap

Udemy explicitly asks:

> What will students learn in your course?

and supports multiple learning outcomes.

LearnStream's observed flow does not expose an equivalent structured learning-outcomes stage.

#### Required functionality

Instructor should be able to define:

- learning objectives
- expected outcomes
- prerequisites
- target learner information
- required skills/experience

#### Suggested data model

```text
Course
 ├── learningObjectives[]
 ├── prerequisites[]
 ├── targetAudience
 └── intendedLearners
```

#### Acceptance Criteria

- Instructor can add multiple learning objectives.
- Instructor can remove/reorder objectives.
- Instructor can define prerequisites.
- Required fields are validated.
- Character limits are enforced.
- Data is saved independently from curriculum content.

---

## 6. Course Structure Planning

### FR-3: Course Structure Planning — P0

#### Gap

Udemy explicitly guides instructors through course structure before/during curriculum creation.

LearnStream jumps directly into modules.

#### Required functionality

Instructor should be able to establish the high-level course structure before uploading content.

```text
Course
 ├── Section 1
 │    ├── Lecture
 │    ├── Lecture
 │    └── Lecture
 ├── Section 2
 │    ├── Lecture
 │    └── Lecture
 └── Section 3
```

#### Section-level metadata

Each section should support:

- section title
- section learning objective
- ordering
- contained curriculum items

---

## 7. Section-Based Curriculum

### FR-4: Sections as First-Class Curriculum Entities — P0

#### Gap

LearnStream currently exposes **modules**, while Udemy uses a hierarchical section → lecture model with section-level learning objectives.

The LearnStream modal observed primarily handles:

- module name
- lecture title
- lecture upload

#### Required functionality

A section/module must be a persistent entity.

```text
Course
  ↓
Section
  ↓
Curriculum Item
```

#### Section operations

Instructor must be able to:

- create section
- rename section
- delete section
- reorder section
- add learning objective
- expand/collapse section
- add curriculum items

---

## 8. Multiple Content Types

### FR-5: Multi-Type Curriculum Items — P0

#### Major gap

Udemy does not restrict every curriculum item to a video upload.

The observed Udemy curriculum interface provides multiple content options including:

- Video
- Video & Slides / mashup
- Article
- Resources associated with content

LearnStream's observed creation experience is heavily centred around uploading a lecture/video.

#### Target

A curriculum item should support a typed content model:

```text
CurriculumItem
├── VIDEO
├── ARTICLE
├── VIDEO_SLIDES
├── QUIZ
├── ASSIGNMENT
└── RESOURCE
```

Only implement item types supported by the existing backend initially, but design the frontend architecture so new types can be added without rewriting the curriculum system.

#### Acceptance Criteria

- Instructor clicks `+ Content`.
- Content-type selector appears.
- Instructor selects a content type.
- Appropriate editor/upload interface appears.
- Item retains its content type.
- Curriculum renders different item types appropriately.

---

## 9. Video Upload Experience

### FR-6: Production-Grade Video Upload — P0

#### Existing LearnStream

The current experience visibly supports uploading lecture content.

#### Gap

Udemy provides a more dedicated content creation workflow and upload-oriented UX.

LearnStream should evolve from:

```text
Lecture title
+
File upload
```

into:

```text
Lecture
├── Title
├── Content type
├── Upload
├── Upload progress
├── Processing status
├── Preview
├── Replace
├── Delete
└── Save state
```

#### Required states

```text
Idle
↓
Selecting File
↓
Uploading
↓
Processing
↓
Ready
↓
Failed
```

#### Acceptance Criteria

- Upload progress is visible.
- Upload failures are recoverable.
- Instructor can retry.
- Instructor can replace an uploaded video.
- Instructor can preview uploaded content.
- UI does not lose course state during upload.
- Upload status persists after page refresh.

---

## 10. Curriculum Reordering

### FR-7: Drag-and-Drop Curriculum Ordering — P0

#### Gap

Udemy's curriculum is designed around ordered sections and curriculum items.

LearnStream needs explicit ordering support.

#### Required operations

```text
Move Section
Move Lecture
Move Content Item
Move Item Between Sections
```

#### Example

```text
Section 1
 ├── Lecture A
 ├── Lecture B
 └── Lecture C

↓ Move Lecture C

Section 1
 ├── Lecture A
 ├── Lecture C
 └── Lecture B
```

#### Acceptance Criteria

- Items can be reordered without page reload.
- Optimistic UI updates immediately.
- Backend ordering is persisted.
- Failed reorder requests roll back safely.
- Keyboard-accessible alternative should exist for accessibility.

---

## 11. Bulk Upload

### FR-8: Bulk Curriculum Upload — P1

#### Gap

Udemy exposes a **Bulk Uploader** workflow in the observed curriculum experience.

LearnStream's current flow requires individual content handling.

#### Target

Provide:

```text
Bulk Upload
    ↓
Select multiple files
    ↓
Upload queue
    ↓
Assign files to lectures
    ↓
Process
    ↓
Review
```

#### Acceptance Criteria

- Multiple files can be selected.
- Upload queue shows each file.
- Individual failures do not cancel successful uploads.
- Instructor can map files to curriculum items.
- Upload status is visible.

---

## 12. Course Requirements / Prerequisites

### FR-9: Requirements & Prerequisites — P1

Udemy explicitly provides a course requirements area.

LearnStream should support:

```text
Course Requirements
├── Required Skills
├── Required Experience
├── Required Tools
└── Required Equipment
```

If there are no prerequisites, instructor should be able to explicitly indicate:

> No prior experience required.

---

## 13. Course Landing Page

### FR-10: Course Landing Page Editor — P0

#### Major gap

Udemy provides a dedicated publishing/landing-page stage.

LearnStream's observed teacher flow does not show a comparable course publishing configuration experience.

#### Required fields

At minimum:

```text
Course Title
Course Subtitle
Course Description
Course Image
Instructor
Category
Subcategory
Learning Objectives
Requirements
Target Audience
```

#### UI

Use a dedicated editor rather than adding all fields to the curriculum page.

---

## 14. Pricing

### FR-11: Course Pricing — P0

#### Gap

Udemy exposes pricing as an explicit publishing step.

LearnStream needs dedicated pricing configuration.

#### Required functionality

```text
Currency
Price
Pricing validation
Free/Paid course
```

Potential future architecture:

```text
CoursePricing
├── currency
├── amount
├── pricingType
└── effectiveAt
```

---

## 15. Promotions

### FR-12: Course Promotions — P1

Udemy exposes a dedicated promotions area.

LearnStream should eventually support:

- promotional pricing
- coupon codes
- promotional campaigns
- discount configuration

This can initially be implemented as a dedicated placeholder/settings screen if backend support does not yet exist.

---

## 16. Course Messages

### FR-13: Instructor Course Messages — P1

#### Gap

Udemy has a dedicated Course Messages publishing step.

LearnStream should support instructor-authored messages such as:

```text
Welcome Message
Congratulations Message
Course Announcement
```

Architecture should separate:

```text
Course Content
```

from:

```text
Course Communication
```

---

## 17. Captions

### FR-14: Caption Management — P1

#### Gap

Udemy exposes captions as a separate content-creation stage.

LearnStream should support:

```text
Lecture
 └── Captions
      ├── Upload
      ├── Select language
      ├── Replace
      └── Delete
```

Future enhancement:

- automatic transcription
- caption editing
- caption synchronization
- multiple languages

---

## 18. Accessibility

### FR-15: Accessibility Configuration — P1

Udemy explicitly exposes accessibility as part of course creation.

LearnStream should introduce an accessibility configuration layer covering applicable course/content metadata.

Examples:

- captions availability
- accessible content metadata
- alternative descriptions
- accessibility validation

---

## 19. Preview Mode

### FR-16: Course Preview — P0

#### Gap

Udemy provides a visible `Preview` control within the instructor curriculum interface.

LearnStream should provide:

```text
Preview
```

at course and/or lecture level.

#### Required behaviour

Preview should show the course approximately as a student will experience it without publishing the course.

---

## 20. Draft State

### FR-17: Course Draft Lifecycle — P0

Udemy visibly communicates course state through a `DRAFT` status.

LearnStream should explicitly model course lifecycle:

```text
DRAFT
↓
READY_FOR_REVIEW
↓
UNDER_REVIEW
↓
PUBLISHED
↓
ARCHIVED
```

The initial implementation can start with:

```text
DRAFT
PUBLISHED
```

but the database/API should be extensible.

---

## 21. Publish Validation / Quality Gate

### FR-18: Pre-Publish Validation — P0

#### Major gap

LearnStream should not allow a teacher to publish an incomplete course.

Before submission:

```text
Validate Course
       ↓
 ┌───────────────┐
 │ Missing title │
 │ Missing image │
 │ No sections   │
 │ No content    │
 │ No price      │
 └───────────────┘
       ↓
Validation Summary
```

#### Example

```text
Course readiness

✓ Course title
✓ Description
✓ Course image
✓ Learning objectives
✓ Curriculum
✗ Course pricing

1 requirement remaining
```

---

## 22. Submit for Review

### FR-19: Course Review Submission — P0

Udemy visibly provides:

> Submit for Review

LearnStream should provide an equivalent final action.

#### Workflow

```text
Draft
 ↓
Validate
 ↓
Review Summary
 ↓
Submit for Review
 ↓
Under Review
```

The button should be disabled until mandatory requirements are satisfied.

---

## 23. Course Creation Autosave

### FR-20: Autosave — P0

#### Gap

Course authoring is a long-running workflow. Losing instructor work is unacceptable.

Implement:

```text
User edits
   ↓
Debounced save
   ↓
Backend
   ↓
Saved state
```

UI should communicate:

```text
Saving...
Saved just now
```

#### Important

Autosave must operate independently for:

- course metadata
- section changes
- lecture metadata
- content uploads
- pricing
- publishing metadata

---

## 24. Unsaved Changes Protection

### FR-21: Unsaved Change Detection — P1

If an instructor attempts to leave while a mutation is pending:

```text
You have unsaved changes.

Leave page?
[Stay] [Leave]
```

Do not rely solely on browser `beforeunload`; implement application-level dirty state.

---

## 25. Error Recovery

### FR-22: Recoverable Errors — P0

Errors should be contextual.

Bad:

```text
Something went wrong
```

Better:

```text
Unable to upload "lecture-03.mp4"

The upload was interrupted.

[Retry]
```

For API failures:

```text
Unable to save this section.

Your previous version is still available.

[Retry]
```

---

## 26. UI / UX Gap Analysis

### UI Gap 1 — Information Architecture

#### Udemy

The instructor immediately understands:

```text
Plan
Create
Publish
```

through the persistent left-side navigation.

#### LearnStream

The observed experience centres primarily around:

```text
Course Modules
Add Module
```

##### Gap

The instructor does not receive enough guidance regarding **where they are in the overall course creation lifecycle**.

##### Target

Introduce a persistent course-authoring sidebar:

```text
COURSE CREATION

Plan
  ○ Intended Learners
  ○ Course Structure
  ○ Test Video

Create
  ○ Curriculum
  ○ Captions
  ○ Accessibility

Publish
  ○ Landing Page
  ○ Pricing
  ○ Promotions
  ○ Messages

──────────────

[Preview]

[Submit for Review]
```

---

### UI Gap 2 — Course Context

Udemy consistently displays course context in the top header:

```text
Back to courses
Course name
DRAFT
Course progress/status
Preview
Settings
```

LearnStream should adopt a similar persistent authoring header.

Recommended:

```text
← Back to My Courses

My New Course          DRAFT

                         Preview ▾
                         ⚙
```

---

### UI Gap 3 — Visual Hierarchy

LearnStream's current course-module interface is visually simple but too close to a CRUD interface.

The target should visually communicate hierarchy:

```text
COURSE
   ↓
SECTION
   ↓
LECTURE
   ↓
CONTENT
   ↓
RESOURCES
```

Use:

- indentation
- cards/containers
- section headers
- lecture rows
- content-type icons
- status indicators
- contextual actions

---

### UI Gap 4 — Module vs Section Terminology

The LearnStream interface uses:

> Module

Udemy's observed experience uses:

> Section

Either terminology is acceptable, but LearnStream should establish a consistent hierarchy.

Recommended:

```text
Course
 └── Module / Section
      └── Lecture
           └── Content
```

Do **not** allow the UI/API to inconsistently use Module, Section, Chapter and Unit for the same entity.

---

### UI Gap 5 — Content Creation Interaction

Current LearnStream:

```text
Add Module
 ↓
Module Name
 ↓
Lecture Title
 ↓
Upload
```

This puts too much responsibility inside one modal.

#### Recommended

Use progressive workflows:

```text
+ Add Section
```

then:

```text
Section
 ├── + Add Lecture
 ├── + Add Quiz
 ├── + Add Article
 └── ...
```

Then:

```text
Lecture
 ├── Content
 ├── Resources
 ├── Settings
 └── Preview
```

This will scale much better as content types are added.

---

### UI Gap 6 — Modal Overuse

The observed LearnStream implementation uses an `Add Module` modal containing module and lecture information.

For simple creation this is acceptable, but it becomes problematic when the entity grows.

Avoid turning the modal into:

```text
Module
 ├── name
 ├── description
 ├── lecture 1
 ├── lecture 2
 ├── lecture 3
 ├── uploads
 ├── settings
 ├── resources
 └── ...
```

#### Recommendation

Use:

- modal for lightweight creation
- dedicated page/drawer for editing
- inline editing for titles
- dedicated upload interface for media

---

### UI Gap 7 — Empty States

Every authoring area needs an intentional empty state.

Example:

```text
No sections yet

Start building your curriculum by adding
your first section.

[+ Add Section]
```

Rather than displaying an empty container.

---

### UI Gap 8 — Loading States

All asynchronous operations should have visible states:

```text
Loading course...
Loading curriculum...
Saving...
Uploading...
Processing...
```

Use skeletons for page-level loading and progress indicators for operations.

---

### UI Gap 9 — Success Feedback

After operations:

```text
✓ Section created
✓ Lecture saved
✓ Video uploaded
✓ Course details saved
```

Avoid relying on silent state changes.

---

### UI Gap 10 — Error Presentation

Errors should appear adjacent to the operation that failed.

For example:

```text
Lecture 3
────────────────────

Video upload failed

Unable to upload the selected file.

[Retry] [Choose another file]
```

rather than a generic page-level error.

---

### UI Gap 11 — Completion Indicators

The Udemy flow gives the instructor a strong sense of progress through its sidebar.

LearnStream should show:

```text
✓ Intended Learners
✓ Course Structure
● Curriculum
○ Captions
○ Accessibility
```

This reduces cognitive load during a long authoring workflow.

---

### UI Gap 12 — Course Readiness

Add a visible readiness indicator:

```text
Course readiness

████████░░ 80%

8 of 10 requirements completed
```

Clicking it opens the validation checklist.

---

### UI Gap 13 — Preview

Preview should be available persistently in the authoring header rather than hidden deep inside the workflow.

---

### UI Gap 14 — Responsive Behaviour

The authoring interface should remain usable on:

- desktop
- laptop
- tablet

The primary authoring experience can remain desktop-first because course creation is a complex workflow, but the layout must not overflow or become unusable at smaller widths.

---

## 27. Non-Functional Requirements

### NFR-1: Performance

#### NFR-1.1 Initial authoring page

Course authoring page should become interactive within:

**< 2 seconds** under normal network conditions.

#### NFR-1.2 Curriculum operations

Operations such as:

- expand section
- collapse section
- inline rename
- add item

should provide UI feedback within:

**< 100 ms**

even if backend persistence happens asynchronously.

#### NFR-1.3 Optimistic mutations

Use optimistic updates for low-risk operations:

- rename section
- rename lecture
- reorder item
- expand/collapse
- mark completion

---

### NFR-2: Upload Performance

Video uploads must not block the entire application.

Required:

```text
Upload Queue
    ↓
Independent Upload
    ↓
Progress
    ↓
Processing
```

Large files should use resumable/chunked uploads if supported by backend infrastructure.

---

### NFR-3: Reliability

Course creation is a high-value long-running workflow.

The system should tolerate:

- network interruption
- page refresh
- navigation
- failed API requests
- upload interruption
- backend restart

without silently losing saved data.

---

### NFR-4: Data Consistency

Curriculum ordering must be deterministic.

Each curriculum entity should have an explicit ordering value.

Example:

```text
section.order
lecture.order
curriculumItem.order
```

Avoid relying on database insertion order.

---

### NFR-5: Concurrency

If the instructor has multiple tabs open, the application should avoid silently overwriting newer data.

Future-ready architecture should support:

```text
updatedAt
version
revision
```

on course/curriculum entities.

---

### NFR-6: Accessibility

The authoring interface must support:

- keyboard navigation
- visible focus states
- semantic buttons
- accessible modal dialogs
- accessible drag/drop alternative
- screen-reader labels
- sufficient contrast
- accessible upload controls

---

### NFR-7: Responsive Layout

The primary desktop layout should use:

```text
┌─────────────────────────────────────────┐
│ Authoring Header                        │
├──────────────┬──────────────────────────┤
│ Sidebar      │ Main Content             │
│              │                          │
│ Navigation   │ Curriculum/editor        │
│              │                          │
│              │                          │
└──────────────┴──────────────────────────┘
```

Sidebar width should be fixed within a reasonable range, while the content area should remain fluid.

---

### NFR-8: Component Reusability

All content types should follow a common component contract.

Example:

```tsx
<ContentItem type="video" />
<ContentItem type="article" />
<ContentItem type="quiz" />
```

Avoid creating unrelated bespoke implementations for every content type.

---

### NFR-9: State Persistence

The application should distinguish:

```text
Server State
```

from:

```text
Local UI State
```

#### Server state

Use a server-state solution such as TanStack Query for:

- course
- sections
- lectures
- uploads
- publishing state

#### Local UI state

Use local state/store for:

- active sidebar step
- modal open/close
- selected item
- drag state
- dirty state
- temporary form values

---

### NFR-10: Error Observability

Frontend errors should be captured with sufficient context:

```text
courseId
sectionId
lectureId
operation
timestamp
errorCode
```

Do not expose raw backend stack traces to instructors.

---

## 28. Recommended Target Information Architecture

```text
/instructor
    /courses
        /:courseId
            /overview

            /plan
                /learners
                /structure
                /test-video

            /content
                /curriculum
                /curriculum/:itemId
                /captions
                /accessibility

            /publish
                /landing-page
                /pricing
                /promotions
                /messages

            /review
            /preview
```

---

## 29. Recommended Component Architecture

```text
src/
└── features/
    └── instructor-course/
        ├── components/
        │   ├── CourseAuthoringLayout.tsx
        │   ├── CourseAuthoringHeader.tsx
        │   ├── CourseAuthoringSidebar.tsx
        │   ├── CourseProgress.tsx
        │   ├── CourseReadiness.tsx
        │   │
        │   ├── curriculum/
        │   │   ├── CurriculumBuilder.tsx
        │   │   ├── SectionCard.tsx
        │   │   ├── SectionHeader.tsx
        │   │   ├── LectureRow.tsx
        │   │   ├── CurriculumItem.tsx
        │   │   ├── AddSectionButton.tsx
        │   │   ├── AddContentMenu.tsx
        │   │   ├── ContentTypeSelector.tsx
        │   │   ├── CurriculumDragHandle.tsx
        │   │   └── BulkUploader.tsx
        │   │
        │   ├── video/
        │   │   ├── VideoUploader.tsx
        │   │   ├── UploadProgress.tsx
        │   │   ├── VideoPreview.tsx
        │   │   └── VideoProcessingStatus.tsx
        │   │
        │   ├── landing-page/
        │   │   ├── CourseLandingPageForm.tsx
        │   │   └── CourseImageUploader.tsx
        │   │
        │   ├── pricing/
        │   │   └── CoursePricingForm.tsx
        │   │
        │   ├── review/
        │   │   ├── CourseValidation.tsx
        │   │   ├── ValidationChecklist.tsx
        │   │   └── SubmitForReview.tsx
        │   │
        │   └── common/
        │       ├── SaveStatus.tsx
        │       ├── UnsavedChangesDialog.tsx
        │       ├── AuthoringError.tsx
        │       └── AuthoringSkeleton.tsx
        │
        ├── pages/
        │   ├── CourseAuthoringPage.tsx
        │   ├── CurriculumPage.tsx
        │   ├── CourseLandingPage.tsx
        │   ├── PricingPage.tsx
        │   └── ReviewPage.tsx
        │
        ├── hooks/
        │   ├── useCourse.ts
        │   ├── useCurriculum.ts
        │   ├── useCourseAutosave.ts
        │   ├── useCourseValidation.ts
        │   └── useVideoUpload.ts
        │
        ├── api/
        │   ├── courseApi.ts
        │   ├── curriculumApi.ts
        │   ├── uploadApi.ts
        │   └── publishingApi.ts
        │
        ├── stores/
        │   └── courseAuthoringStore.ts
        │
        ├── types/
        │   ├── course.ts
        │   ├── curriculum.ts
        │   └── publishing.ts
        │
        └── routes.ts
```

---

## 30. Recommended Curriculum Data Model

The frontend should not model the course as:

```ts
Course {
  modules: Module[]
}
```

with each module containing arbitrary lecture fields.

Instead, use explicit entities:

```ts
Course {
  id: string;
  title: string;
  description: string;
  status: CourseStatus;

  learningObjectives: LearningObjective[];
  prerequisites: Requirement[];

  sections: CourseSection[];
}
```

```ts
CourseSection {
  id: string;
  courseId: string;
  title: string;
  learningObjective?: string;
  order: number;

  items: CurriculumItem[];
}
```

```ts
CurriculumItem {
  id: string;
  sectionId: string;

  type: CurriculumItemType;
  title: string;
  order: number;

  content?: ContentReference;
}
```

```ts
type CurriculumItemType =
  | "video"
  | "article"
  | "video-slides"
  | "quiz"
  | "assignment"
  | "resource";
```

This gives LearnStream room to evolve beyond video-only courses.

---

## 31. Recommended Authoring UX

The target experience should be:

```text
                 LEARNSTREAM
────────────────────────────────────────────────

← My Courses     My New Course       DRAFT   Preview

┌─────────────────┬────────────────────────────────┐
│ COURSE CREATION │                                │
│                 │   Curriculum                   │
│ ✓ Learners      │                                │
│ ✓ Structure     │   Build your course curriculum │
│                 │                                │
│ CREATE          │   Section 1 — Introduction     │
│ ● Curriculum    │   ┌────────────────────────┐   │
│ ○ Captions      │   │ Lecture 1              │   │
│ ○ Accessibility │   │ 🎥 Introduction        │   │
│                 │   │                        │   │
│ PUBLISH         │   └────────────────────────┘   │
│ ○ Landing Page  │                                │
│ ○ Pricing       │   + Add Content                │
│ ○ Promotions    │                                │
│ ○ Messages      │                                │
│                 │   + Add Section                 │
│                 │                                │
│                 │                                │
│                 │                     Save status │
└─────────────────┴────────────────────────────────┘
```

---

## 32. Implementation Priority

### Phase 1 — Core Authoring Foundation — P0

Implement first:

1. Course authoring layout
2. Persistent authoring sidebar
3. Course draft state
4. Section/module entity
5. Lecture entity
6. Section/lecture CRUD
7. Ordering/reordering
8. Video upload
9. Upload progress
10. Autosave
11. Save status
12. Error handling
13. Preview
14. Course readiness validation
15. Submit for review

---

### Phase 2 — Course Planning — P0/P1

Implement:

1. Intended learners
2. Learning objectives
3. Requirements
4. Prerequisites
5. Course structure planning

---

### Phase 3 — Publishing — P0/P1

Implement:

1. Course landing page
2. Course image
3. Course description
4. Pricing
5. Publish validation
6. Review submission

---

### Phase 4 — Advanced Content Creation — P1

Implement:

1. Multiple curriculum item types
2. Article content
3. Video + slides
4. Resources
5. Bulk uploader
6. Caption management
7. Accessibility

---

### Phase 5 — Instructor Growth Features — P2

Implement:

1. Promotions
2. Coupon system
3. Course messages
4. Advanced course analytics
5. Instructor quality recommendations
6. Content quality scoring

---

## 33. Final Functional Gap Matrix

| Capability                        | Udemy             | LearnStream Observed     | Gap                   |
| --------------------------------- | ----------------- | ------------------------ | --------------------- |
| Guided course creation workflow   | ✓                 | ✗                        | **Critical**          |
| Intended learner planning         | ✓                 | ✗                        | **Critical**          |
| Learning objectives               | ✓                 | ✗                        | **Critical**          |
| Course requirements/prerequisites | ✓                 | ✗                        | **High**              |
| Course structure planning         | ✓                 | Partial                  | **High**              |
| Sections/modules                  | ✓                 | ✓                        | Improve architecture  |
| Section learning objectives       | ✓                 | ✗                        | **High**              |
| Lecture creation                  | ✓                 | ✓                        | Improve UX            |
| Multiple content types            | ✓                 | Primarily video/upload   | **Critical**          |
| Video upload                      | ✓                 | ✓                        | Improve substantially |
| Upload progress/state             | ✓                 | Limited/not evident      | **High**              |
| Bulk uploader                     | ✓                 | ✗                        | **High**              |
| Curriculum reordering             | ✓                 | Not sufficiently evident | **High**              |
| Course preview                    | ✓                 | Not evident              | **High**              |
| Captions                          | ✓                 | ✗                        | **High**              |
| Accessibility workflow            | ✓                 | ✗                        | **High**              |
| Course landing page               | ✓                 | ✗                        | **Critical**          |
| Course pricing                    | ✓                 | ✗                        | **Critical**          |
| Promotions                        | ✓                 | ✗                        | Medium                |
| Course messages                   | ✓                 | ✗                        | Medium                |
| Draft state                       | ✓                 | Not sufficiently evident | **High**              |
| Publish validation                | ✓                 | ✗                        | **Critical**          |
| Submit for review                 | ✓                 | ✗                        | **Critical**          |
| Autosave                          | ✓/mature workflow | Not evident              | **Critical**          |
| Save status                       | ✓                 | Not evident              | **High**              |
| Contextual errors                 | ✓                 | Limited                  | **High**              |
| Completion indicators             | ✓                 | ✗                        | **High**              |
| Authoring sidebar                 | ✓                 | ✗                        | **Critical UI gap**   |
| Course readiness                  | ✓                 | ✗                        | **High UI gap**       |

---

## 34. Most Important Architectural Conclusion

**Do not implement these requirements by simply adding more fields to the existing `Add Module` modal.**

That would reproduce the current architectural limitation at a larger scale.

The correct direction is to turn LearnStream's teacher experience into a dedicated **Course Authoring Platform**:

```text
                    COURSE AUTHORING
                           │
          ┌────────────────┼────────────────┐
          │                │                │
        PLAN             CREATE           PUBLISH
          │                │                │
    Learners         Curriculum       Landing Page
    Objectives       Sections         Pricing
    Requirements     Lectures         Promotions
    Structure        Videos           Messages
                     Articles
                     Resources
                     Captions
                     Accessibility
          │                │                │
          └────────────────┼────────────────┘
                           ↓
                    VALIDATE COURSE
                           ↓
                    PREVIEW COURSE
                           ↓
                   SUBMIT FOR REVIEW
                           ↓
                       PUBLISHED
```

**This is the key requirement I would give the coding agent:** build the authoring system around a persistent course lifecycle and hierarchical curriculum model, rather than extending the current module-upload modal.

That architectural decision will make the subsequent features—quizzes, assignments, captions, resources, pricing, publishing, review, analytics, etc.—incremental additions instead of repeated rewrites.
