const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbz88Cc0kZi-3Q36GOC_BNfpAVmkG-TZxccVb1KP6pPtU6SS7I2UTgobZtb3twwO6HDf/exec';

let calendar;
let lessonsData = [];
let specialNotes = JSON.parse(localStorage.getItem('specialNotes') || '{}');
let activeNoteDate = null;
let confirmCallback = null;

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
    allDayText: 'All-day', // Restored to "All-day"
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
    console.error('loadLessons error:', error);
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

  document.getElementById('delete-btn').onclick = () => {
    const id = document.getElementById('lesson-id').value;
    showConfirmModal(
      'Delete Lesson Plan?',
      'Are you sure you want to delete this lesson plan from your schedule?',
      async () => {
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
      }
    );
  };

  // Confirmation Modal Listeners
  document.getElementById('confirm-cancel-btn').onclick = hideConfirmModal;
  document.getElementById('confirm-action-btn').onclick = () => {
    if (confirmCallback) confirmCallback();
    hideConfirmModal();
  };

  // Special Notes Modal Listeners
  const noteModal = document.getElementById('note-modal');
  document.getElementById('close-note-modal').onclick = () => noteModal.classList.add('hidden');
  document.getElementById('done-note-btn').onclick = () => noteModal.classList.add('hidden');

  document.getElementById('note-form').onsubmit = (e) => {
    e.preventDefault();
    const input = document.getElementById('new-note-input');
    const noteText = input.value.trim();
    if (noteText && activeNoteDate) {
      const notes = getNotesForDate(activeNoteDate);
      notes.push(noteText);
      specialNotes[activeNoteDate] = notes;
      localStorage.setItem('specialNotes', JSON.stringify(specialNotes));
      input.value = '';
      renderNoteListModal();
      renderSpecialNotesRow();
    }
  };
}

function showConfirmModal(title, message, onConfirm) {
  document.getElementById('confirm-modal-title').innerText = title;
  document.getElementById('confirm-modal-message').innerText = message;
  confirmCallback = onConfirm;
  document.getElementById('confirm-modal').classList.remove('hidden');
}

function hideConfirmModal() {
  document.getElementById('confirm-modal').classList.add('hidden');
  confirmCallback = null;
}

function updateStatus(message, isError = false) {
  const statusEl = document.getElementById('sync-status');
  statusEl.innerText = `Status: ${message}`;
  statusEl.className = `text-sm font-medium ${isError ? 'text-red-500' : 'text-slate-500'}`;
}

// Special Notes Helpers
function getNotesForDate(dateStr) {
  const val = specialNotes[dateStr];
  if (!val) return [];
  if (Array.isArray(val)) return val;
  return [val];
}

function openNoteModal(dateStr) {
  activeNoteDate = dateStr;
  document.getElementById('note-modal-subtitle').innerText = `Date: ${dateStr}`;
  document.getElementById('new-note-input').value = '';
  renderNoteListModal();
  document.getElementById('note-modal').classList.remove('hidden');
}

function renderNoteListModal() {
  const container = document.getElementById('note-list');
  const notes = getNotesForDate(activeNoteDate);

  if (notes.length === 0) {
    container.innerHTML = `<p class="text-xs text-slate-400 italic py-2">No special notes added for this day yet.</p>`;
    return;
  }

  container.innerHTML = notes.map((note, idx) => `
    <div class="flex items-center justify-between p-2 bg-slate-50 rounded-md border border-slate-200 text-sm">
      <span class="text-slate-800 font-medium">${escapeHtml(note)}</span>
      <button type="button" onclick="deleteNoteAtIndex(${idx})" class="text-red-400 hover:text-red-600 font-bold p-1 hover:bg-red-50 rounded text-xs transition-colors" title="Delete note">&times; Remove</button>
    </div>
  `).join('');
}

function deleteNoteAtIndex(index) {
  if (!activeNoteDate) return;
  const notes = getNotesForDate(activeNoteDate);
  notes.splice(index, 1);
  if (notes.length > 0) {
    specialNotes[activeNoteDate] = notes;
  } else {
    delete specialNotes[activeNoteDate];
  }
  localStorage.setItem('specialNotes', JSON.stringify(specialNotes));
  renderNoteListModal();
  renderSpecialNotesRow();
}

// Native Table-Integrated Special Notes Row
function renderSpecialNotesRow() {
  const headerTable = document.querySelector('.fc-col-header');
  if (!headerTable) {
    setTimeout(renderSpecialNotesRow, 100);
    return;
  }

  const thead = headerTable.querySelector('thead');
  if (!thead) return;

  let trEl = document.getElementById('special-notes-tr');
  if (!trEl) {
    trEl = document.createElement('tr');
    trEl.id = 'special-notes-tr';
    trEl.className = 'border-t border-slate-200 bg-white';
    thead.appendChild(trEl);

    trEl.addEventListener('click', (e) => {
      const cell = e.target.closest('[data-note-date]');
      if (cell) {
        openNoteModal(cell.getAttribute('data-note-date'));
      }
    });
  }

  const dayCells = headerTable.querySelectorAll('th.fc-col-header-cell[data-date]');
  const visibleDates = Array.from(dayCells).map(cell => cell.getAttribute('data-date')).filter(Boolean);

  if (visibleDates.length === 0) return;

  // Right-aligned "Note" label inheriting native FullCalendar cushion styles
  let html = `
    <th class="fc-timegrid-axis fc-scrollgrid-shrink bg-white border-r border-slate-200 text-right">
      <div class="fc-timegrid-axis-frame fc-scrollgrid-shrink-frame flex items-center justify-end pr-2 text-right">
        <a class="fc-timegrid-axis-cushion fc-scrollgrid-shrink-cushion font-normal text-right">Note</a>
      </div>
    </th>
  `;

  visibleDates.forEach(dateStr => {
    const notes = getNotesForDate(dateStr);
    html += `
      <td data-note-date="${dateStr}" class="p-1 text-center cursor-pointer hover:bg-indigo-50/50 transition-colors bg-white border-l border-slate-200 align-middle group"
          title="Click to manage notes for ${dateStr}">
        <div class="flex flex-wrap gap-1 items-center justify-center min-h-[28px]">
          ${notes.length > 0
        ? notes.map(n => `<span class="px-1.5 py-0.5 bg-amber-100 text-amber-800 border border-amber-300 rounded font-semibold text-[11px] shadow-sm">${escapeHtml(n)}</span>`).join('')
        : `<span class="text-slate-300 group-hover:text-indigo-600 text-[11px] font-normal">+ Add note</span>`
      }
        </div>
      </td>
    `;
  });

  trEl.innerHTML = html;
}

function escapeHtml(str) {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
