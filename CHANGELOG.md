# Changelog

All notable changes to the **Lesson Planner** web app will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---
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