const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbwhvpL3ECYUxIIIzZK8a6ViC5VjkD2O3qmA8Oe3mWr17LA2Zm5cZ8a0bUJz8YuVQXL4/exec';

let calendar;
let lessonsData = [];
let specialNotes = JSON.parse(localStorage.getItem('specialNotes') || '{}');

document.addEventListener('DOMContentLoaded', () => {
  if (typeof FullCalendar === 'undefined') {
    updateStatus('Error: FullCalendar failed to load.', true);
    return;
  }
  initCalendar();
  setupEventListeners();
  loadLessons();
});

function formatTimeForInput(timeVal) {
  if (!timeVal) return '';
  let str = String(timeVal).trim();

  if (str.includes('T')) {
    const parts = str.split('T').at(0);
    if (parts) return parts.substring(0, 5);
  }

  if (str.includes(':')) {
    const parts = str.split(':');
    const h = parts.at(0).padStart(2, '0');
    const m = parts.at(1) ? parts.at(1).substring(0, 2) : '00';
    return `${h}:${m}`;
  }

  return str;
}

function initCalendar() {
  const calendarEl = document.getElementById('calendar');
  calendar = new FullCalendar.Calendar(calendarEl, {
    initialView: 'timeGridWeek',
    weekends: false,
    headerToolbar: {
      left: 'prev,next today',
      center: 'title',
      right: 'dayGridMonth,timeGridWeek,timeGridDay'
    },
    slotMinTime: '07:00:00',
    slotMaxTime: '18:00:00',
    selectable: true,
    datesSet: function () {
      setTimeout(renderSpecialNotesRow, 100);
    },
    select: function (info) {
      openModalForNewPlan(info.startStr, info.endStr, info.allDay);
    },
    eventClick: function (info) {
      const lesson = lessonsData.find(l => String(l.id) === String(info.event.id));
      if (lesson) {
        openModalForEdit(lesson);
      }
    }
  });
  calendar.render();
  setTimeout(renderSpecialNotesRow, 100);
}

async function loadLessons() {
  updateStatus('Loading lessons...');
  try {
    const response = await fetch(APPS_SCRIPT_URL);
    const result = await response.json();
    if (result.status === 'success') {
      lessonsData = result.data;
      renderEventsOnCalendar();
      updateStatus('All changes synced');
    } else {
      updateStatus('Failed to load lessons', true);
    }
  } catch (error) {
    console.error(error);
    updateStatus('Offline or connection error', true);
  }
}

function renderEventsOnCalendar() {
  calendar.removeAllEvents();
  const events = lessonsData.map(lesson => {
    let dateStr = '';
    if (lesson.date) {
      dateStr = String(lesson.date).split('T').at(0);
    }
    const startTime = formatTimeForInput(lesson.startTime) || '09:00';
    const endTime = formatTimeForInput(lesson.endTime) || '10:00';
    const startIso = `${dateStr}T${startTime}:00`;
    const endIso = `${dateStr}T${endTime}:00`;

    return {
      id: String(lesson.id),
      title: `${lesson.title || 'Untitled'} (${lesson.subject || 'General'})`,
      start: startIso,
      end: endIso,
      backgroundColor: '#4f46e5',
      borderColor: '#4338ca'
    };
  });
  calendar.addEventSource(events);
}

function openModalForNewPlan(startIso, endIso, isAllDay = false) {
  let dateStr = startIso.split('T').at(0);
  let startTimeStr = '09:00';
  let endTimeStr = '10:00';

  // Default to 07:00 - 15:00 if selected in all-day section or date-only selection
  if (isAllDay || !startIso.includes('T')) {
    startTimeStr = '07:00';
    endTimeStr = '15:00';
  } else {
    const startDateObj = new Date(startIso);
    const endDateObj = new Date(endIso);
    startTimeStr = startDateObj.toTimeString().substring(0, 5);
    endTimeStr = endDateObj.toTimeString().substring(0, 5);
  }

  document.getElementById('modal-title').innerText = 'New Lesson Plan';
  document.getElementById('lesson-form').reset();
  document.getElementById('lesson-id').value = 'lp_' + Date.now();
  document.getElementById('lesson-date').value = dateStr;
  document.getElementById('lesson-start').value = startTimeStr;
  document.getElementById('lesson-end').value = endTimeStr;
  document.getElementById('delete-btn').classList.add('hidden');
  document.getElementById('lesson-modal').classList.remove('hidden');
}

function openModalForEdit(lesson) {
  document.getElementById('modal-title').innerText = 'Edit Lesson Plan';
  let dateStr = '';
  if (lesson.date) {
    dateStr = String(lesson.date).split('T').at(0);
  }
  document.getElementById('lesson-id').value = lesson.id;
  document.getElementById('lesson-title').value = lesson.title || '';
  document.getElementById('lesson-subject').value = lesson.subject || '';
  document.getElementById('lesson-grade').value = lesson.grade || '';
  document.getElementById('lesson-date').value = dateStr;
  document.getElementById('lesson-start').value = formatTimeForInput(lesson.startTime);
  document.getElementById('lesson-end').value = formatTimeForInput(lesson.endTime);
  document.getElementById('lesson-objectives').value = lesson.objectives || '';
  document.getElementById('lesson-procedure').value = lesson.procedure || '';
  document.getElementById('lesson-assessment').value = lesson.assessment || '';
  document.getElementById('delete-btn').classList.remove('hidden');
  document.getElementById('lesson-modal').classList.remove('hidden');
}

function setupEventListeners() {
  const modal = document.getElementById('lesson-modal');
  const form = document.getElementById('lesson-form');

  document.getElementById('close-modal').onclick = () => modal.classList.add('hidden');
  document.getElementById('cancel-btn').onclick = () => modal.classList.add('hidden');

  form.onsubmit = async (e) => {
    e.preventDefault();
    const payload = {
      id: document.getElementById('lesson-id').value,
      title: document.getElementById('lesson-title').value,
      subject: document.getElementById('lesson-subject').value,
      grade: document.getElementById('lesson-grade').value,
      date: document.getElementById('lesson-date').value,
      startTime: document.getElementById('lesson-start').value,
      endTime: document.getElementById('lesson-end').value,
      objectives: document.getElementById('lesson-objectives').value,
      procedure: document.getElementById('lesson-procedure').value,
      assessment: document.getElementById('lesson-assessment').value,
      status: 'Scheduled'
    };

    modal.classList.add('hidden');
    updateStatus('Saving to Google Sheets...');

    try {
      const response = await fetch(APPS_SCRIPT_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ action: 'save', payload })
      });
      const result = await response.json();
      if (result.status === 'success') {
        await loadLessons();
      } else {
        updateStatus(`Save error: ${result.message}`, true);
      }
    } catch (err) {
      console.error(err);
      updateStatus('Error saving plan', true);
    }
  };

  document.getElementById('delete-btn').onclick = async () => {
    const id = document.getElementById('lesson-id').value;
    if (!confirm('Are you sure you want to delete this lesson plan?')) return;
    modal.classList.add('hidden');
    updateStatus('Deleting plan...');

    try {
      await fetch(APPS_SCRIPT_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ action: 'delete', payload: { id } })
      });
      await loadLessons();
    } catch (err) {
      console.error(err);
      updateStatus('Error deleting plan', true);
    }
  };
}

function updateStatus(message, isError = false) {
  const statusEl = document.getElementById('sync-status');
  statusEl.innerText = `Status: ${message}`;
  statusEl.className = `text-sm font-medium ${isError ? 'text-red-500' : 'text-slate-500'}`;
}

// Special Notes Row Renderer
function renderSpecialNotesRow() {
  const target =
    document.querySelector('.fc-timegrid-allday') ||
    document.querySelector('.fc-timegrid-allday-frame') ||
    document.querySelector('.fc-scrollgrid-section-body') ||
    document.querySelector('.fc-timegrid-slots');

  if (!target) {
    setTimeout(renderSpecialNotesRow, 100);
    return;
  }

  let rowEl = document.getElementById('special-notes-row');
  if (!rowEl) {
    rowEl = document.createElement('div');
    rowEl.id = 'special-notes-row';
    rowEl.className = 'flex border-b border-slate-200 bg-slate-50 text-xs font-medium text-slate-600 my-1 rounded-md overflow-hidden shadow-sm';

    target.parentNode.insertBefore(rowEl, target);

    rowEl.addEventListener('click', (e) => {
      const cell = e.target.closest('[data-note-date]');
      if (cell) {
        editSpecialNote(cell.getAttribute('data-note-date'));
      }
    });
  }

  const dayCells = document.querySelectorAll('.fc-col-header-cell[data-date]');
  const visibleDates = Array.from(dayCells).map(cell => cell.getAttribute('data-date')).filter(Boolean);

  if (visibleDates.length === 0) return;

  let html = `<div class="fc-timegrid-axis flex items-center justify-end pr-2 font-semibold text-slate-500 w-[60px] flex-shrink-0 border-r border-slate-200 bg-slate-100">Note</div>`;
  html += `<div class="flex-1 flex divide-x divide-slate-200">`;

  visibleDates.forEach(dateStr => {
    const note = specialNotes[dateStr] || '';
    html += `
      <div data-note-date="${dateStr}" class="flex-1 p-1.5 min-h-[34px] flex items-center justify-center cursor-pointer hover:bg-indigo-50 transition-colors text-center group"
           title="Click to edit special note for ${dateStr}">
        ${note
        ? `<span class="px-2 py-0.5 bg-amber-100 text-amber-800 border border-amber-300 rounded font-semibold text-xs shadow-sm">${escapeHtml(note)}</span>`
        : `<span class="text-slate-400 group-hover:text-indigo-600 text-[11px] font-normal">+ Add note</span>`
      }
      </div>
    `;
  });
  html += `</div>`;

  rowEl.innerHTML = html;
}

function editSpecialNote(dateStr) {
  const currentNote = specialNotes[dateStr] || '';
  const newNote = prompt(`Special Note / Label for ${dateStr}:`, currentNote);
  if (newNote !== null) {
    if (newNote.trim()) {
      specialNotes[dateStr] = newNote.trim();
    } else {
      delete specialNotes[dateStr];
    }
    localStorage.setItem('specialNotes', JSON.stringify(specialNotes));
    renderSpecialNotesRow();
  }
}

function escapeHtml(str) {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}