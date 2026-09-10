# Changelog

All notable changes to the **Lesson Planner** web app will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [1.0.0] - 2026-09-10

### Added
- **Interactive Calendar Dashboard**: Month, Week, and Day calendar views powered by FullCalendar.js.
- **Time-Slot Selection**: Click or drag across time slots in Day/Week views to trigger lesson creation with auto-filled date and start/end times.
- **Lesson Management Modal**: Slide-over modal form to create, view, edit, and delete detailed lesson plans (Title, Subject, Grade, Objectives, Procedure, Assessment).
- **Google Sheets Backend Integration**: REST API wrapper built with Google Apps Script (`doGet`/`doPost`) for cloud persistence across devices without external database dependencies.
- **Real-Time Sync Status Indicator**: Visual indicator tracking connection and sync state (`Loading`, `Saving`, `All changes synced`, `Error`).
- **Responsive UI**: Responsive styling built with Tailwind CSS.