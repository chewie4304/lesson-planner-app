# Changelog

All notable changes to the **Lesson Planner** web app will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [2.1.0] - 2026-09-23

### Added
- **Dual Save Controls**: Introduced distinct **Save** (saves changes while keeping the lesson modal open) and **Save & Close** (saves changes and closes the modal) buttons in the lesson editor modal footer.

## [2.0.0] - 2026-09-23

### Changed
- **Supabase Backend Migration**: Replaced Google Apps Script and Google Sheets integration with direct Supabase PostgreSQL backend integration utilizing `@supabase/supabase-js`.
- **Native JSON Storage**: Lesson objectives, procedural checklists, assessment strategies, and materials/links are now stored natively as structured `jsonb` fields.
- **Instant Persistence**: Improved saving, updating, duplicating, and deleting performance, eliminating Google Apps Script cold-start delays.

## [1.7.0] - 2026-09-19

### Added
- **Daily Assessments & Checks Grid**:
  - Added a **📊 Daily Assessments** button in the left sidebar column below the flag widget.
  - Modal view displaying all scheduled assessments for a given date grouped cleanly by **Subject**.
  - Integrated date navigation with on-screen buttons (`Prev`, `Today`, `Next`) and keyboard `ArrowLeft` / `ArrowRight` shortcuts.
  - Automatically filters out subjects or lessons without active assessments for a streamlined view formatted for paper planners.
  - Included a 🖨️ Print View option.
- **Lesson Editor Modal Navigation**:
  - Added `← Prev` / `Next →` buttons and position counter (`Lesson X of Y`) to switch between lessons directly within the editor.
  - Full keyboard `ArrowLeft` / `ArrowRight` shortcut integration.
- **Remembered Autocomplete Datalists**:
  - Native `<datalist>` auto-suggestions for **Subject** and **Grade/Student** fields.
  - Automatically remembers past entries across sessions via `localStorage`, supporting `Down Arrow` selection and `Tab` / `Enter` auto-completion.
- **Interactive Custom Color Palette**:
  - Color tag picker for Grade/Student entries saved locally and synced to Google Sheets.
- **Procedure Reordering & Inline Editing**:
  - Drag-and-drop handle (`⠿`) to reorder lesson procedure steps.
  - Inline editing for objectives, assessments, materials text, web links, and procedure steps.

### Fixed & Improved
- **Instant Local Memory Update**: Updated `form.onsubmit` to mutate local `lessonsData` immediately upon saving, eliminating Google Apps Script read-after-write latency.
- **Procedure Array Serialization**: Fixed array destructuring in drag-and-drop drop handler to prevent nested array corruption when saving to Google Sheets.
- **Type Safety**: Ensured numerical values (such as numeric grade numbers) are safely cast to strings before passing to `escapeHtml()`.

## [1.6.0] - 2026-09-17

### Added

- **Modal Lesson Navigation**: Added `← Prev` and `Next →` navigation buttons and a position counter (`Lesson X of Y`) to cycle through saved lessons directly inside the modal editor.
- **Keyboard Arrow Navigation**: Supported `ArrowLeft` and `ArrowRight` hotkeys to switch lessons instantly in 0ms, with smart input detection to avoid triggers while typing.

### Fixed

- **Date Sorting & Selection Resilience**: Fixed date string parsing in `getSortedLessons()` to prevent `TypeError` crashes during event selection [2].
- **Form Listener Null Safety**: Added null-guards in `setupEventListeners()` to ensure smooth startup across HTML versions [56–59].

## [1.5.0] - 2026-09-13

### Changed
- **Grade-Level Color Palette**: Configured custom color palette mapping in `app.js` specifically for grade levels `6`, `7`, `8`, `7A`, `Alg`, and `678`.

## [1.4.1] - 2026-09-13

### Fixed
- **15-Minute Slot Alignment**: Configured FullCalendar `slotDuration: '00:15:00'` and `slotLabelInterval: '01:00:00'` so 15-minute lessons fit cleanly within their time grid boundaries without overflowing or triggering false side-by-side column splits on back-to-back morning schedules.

## [1.4.0] - 2026-09-13

### Added
- **Side-by-Side Overlapping Timeslots**: Configured FullCalendar `slotEventOverlap: true` and `eventOverlap: true` to display multiple lesson plans in the same time slot side-by-side.
- **Subject-Based Color Coding**: Added dynamic color mapping (`getSubjectColor`) to visually distinguish overlapping or adjacent lessons by subject at a glance.

## [1.3.2] - 2026-09-12

### Fixed
- **Apps Script Cold-Start Resilience**: Added an automatic background retry mechanism (`fetchWithRetry`) to `loadLessons()` that retries up to 3 times with backoff delays, silently resolving temporary Google Apps Script cold-start HTML redirects without raising false offline errors.

## [1.3.1] - 2026-09-12

### Fixed
- **Uncommitted Input Capture**: Added `commitPendingInputs()` to auto-commit any text typed into reactive fields (Objectives, Assessment, Materials, Procedure) when clicking **Save Plan** or **Duplicate**, preventing data loss if `Enter` was not pressed.
- **Resilient JSON Parsing**: Enhanced JSON field parsing (`safeJsonParse`) in `app.js` to cleanly handle nested stringified arrays and preserve legacy data when reopening existing lesson plans.

## [1.3.0] - 2026-09-12

### Added
- **Wide 2-Column Modal Layout**: Expanded the lesson plan editor modal (`#lesson-modal`) to a spacious `max-w-5xl` container with a top metadata bar and side-by-side content columns.
- **Reactive Enter-Key Badges**: Added `Enter`-key listeners across Objectives, Assessments, and Materials fields that clear input on enter and append items as styled badges.
- **Interactive Procedure Checklist**: Transformed the Procedure field into an interactive step-by-step checklist complete with completion checkboxes, progress counter (`X/Y completed`), and strike-through styling.

## [1.2.0] - 2026-09-12

### Added
- **Visual Mini-Calendar Duplication Picker**: Integrated an interactive month-grid calendar inside the duplication panel allowing single-click date toggling across any month.
- **Month Navigation**: Added month navigation controls (`← Prev` / `Next →`) to easily select target duplication dates across multi-month terms.
- **Quick Selection Tools**: Retained date range auto-fill alongside single-click calendar pickers with a 1-click "Clear All" action.

## [1.1.1] - 2026-09-12

### Added
- **Inline Web Link Manager**: Added an explicit **"+ Add Web Link"** button next to the Materials & Resources label, toggling an inline form to quickly attach titled web links without leaving the main modal.
- **Interactive Link Badges**: Attached web links display as styled, clickable **🔗 Title ↗** badge buttons directly below the materials text area with individual remove (`×`) controls.

### Changed
- **Freeform Materials Entry**: Restored direct freeform typing in the Materials & Resources text area for physical supplies (worksheets, graph paper, lab kits) alongside attached web links.

## [1.1.0] - 2026-09-12

### Added
- **Lesson Plan Duplication**: Added a "Duplicate" button and multi-date picker inside the lesson plan editor modal, enabling teachers to copy an existing plan to one or more target dates in a single step.
- **Materials & Hyperlinks Field**: Introduced a dedicated "Materials & Resources" field in the lesson plan form with auto-detection that turns pasted `http://` / `https://` web URLs into clickable badges for 1-click resource opening.

### Fixed
- **Sheet Headers Integration**: Ensured `materials` payload field maps cleanly to Google Sheets backend storage.

## [1.0.4] - 2026-09-10

### Added

- **Materials Field**: Added a dedicated Materials field (`#lesson-materials`) to the lesson plan editor modal in `index.html` to capture required classroom supplies.

### Fixed

- **Materials Persistence**: Updated `app.js` payload handling and `openModalForEdit` form population to save and load the materials field properly alongside Google Sheets header synchronization.

## [1.0.3] - 2026-09-10

### Added
- **Table-Integrated Special Notes**: Added a custom note row directly inside FullCalendar's header table (`.fc-col-header`) for exact column alignment and support for multiple notes per day.
- **Custom Tailwind Modals**: Replaced native browser popups (`confirm` / `prompt`) with styled modals for managing daily notes (`#note-modal`) and confirming lesson plan deletions (`#confirm-modal`).

### Changed
- **Weekend Visibility**: Hidden Saturday and Sunday (`weekends: false`) for a focused Monday–Friday workweek grid.
- **All-Day Time Range**: Configured clicks in the "All-day" slot area to default to **07:00–15:00** in the lesson plan form.
- **Axis Styling Parity**: Right-justified "All-day" and "Note" labels using FullCalendar's internal axis cushion classes for 1:1 typography and color matching.
- **Updated API Endpoint**: Pointed backend connection to the latest Google Apps Script Web App deployment.

## [1.0.2] - 2026-09-10

### Added
- **Half-Staff Flag Widget**: Integrated the national half-staff flag widget from halfstaff.org in a dedicated left sidebar container.

### Changed
- **Responsive Two-Column Layout**: Updated dashboard layout to a side-by-side flexbox structure featuring a left widget sidebar and a main calendar workspace.
- **Column Header Alignment**: Restructured header layout per column using an empty spacer block above the widget, aligning the top of the widget container horizontally with the calendar card.

## [1.0.1] - 2026-09-10

### Fixed
- **Date String Parsing**: Fixed ISO date string array splitting using `.at(0)` to feed clean `YYYY-MM-DD` strings into HTML date inputs, resolving browser validation warnings and unblocking form submission.
- **Time Formatting**: Corrected string method execution in `formatTimeForInput` to properly format hours and minutes.
- **Google Apps Script Header Mapping**: Fixed 2D array extraction (`getValues().at(0)`) in `doGet` and `doPost` to properly map payload keys to Google Sheets column headers.
- **Lesson Updates & Deletion**: Fixed row identification in Apps Script by checking Column A IDs (`allData[i].at(0)`), restoring full row update and deletion sync.

## [1.0.0] - 2026-09-10

### Added
- **Interactive Calendar Dashboard**: Month, Week, and Day calendar views powered by FullCalendar.js.
- **Time-Slot Selection**: Click or drag across time slots in Day/Week views to trigger lesson creation with auto-filled date and start/end times.
- **Lesson Management Modal**: Slide-over modal form to create, view, edit, and delete detailed lesson plans (Title, Subject, Grade, Objectives, Procedure, Assessment).
- **Google Sheets Backend Integration**: REST API wrapper built with Google Apps Script (`doGet`/`doPost`) for cloud persistence across devices without external database dependencies.
- **Real-Time Sync Status Indicator**: Visual indicator tracking connection and sync state (`Loading`, `Saving`, `All changes synced`, `Error`).
- **Responsive UI**: Responsive styling built with Tailwind CSS.