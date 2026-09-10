const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbwhvpL3ECYUxIIIzZK8a6ViC5VjkD2O3qmA8Oe3mWr17LA2Zm5cZ8a0bUJz8YuVQXL4/exec';

let calendar;
let lessonsData = [];

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
    headerToolbar: {
      left: 'prev,next today',
      center: 'title',
      right: 'dayGridMonth,timeGridWeek,timeGridDay'
    },
    slotMinTime: '07:00:00',
    slotMaxTime: '18:00:00',
    selectable: true,

    select: function (info) {
      openModalForNewPlan(info.startStr, info.endStr);
    },

    eventClick: function (info) {
      const lesson = lessonsData.find(l => String(l.id) === String(info.event.id));
      if (lesson) {
        openModalForEdit(lesson);
      }
    }
  });

  calendar.render();
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

function openModalForNewPlan(startIso, endIso) {
  const startDateObj = new Date(startIso);
  const endDateObj = new Date(endIso);

  const dateStr = startDateObj.toISOString().split('T').at(0);
  const startTimeStr = startDateObj.toTimeString().substring(0, 5);
  const endTimeStr = endDateObj.toTimeString().substring(0, 5);

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