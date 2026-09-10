const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbx8JhuPXvs0F_7BTpM5BaARs8v4TZhZD3pVgGWqb6ExPmP1fsLoU_ZYI0ep2nECYkHD/exec';

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
    // 1. Extract YYYY-MM-DD string
    let dateStr = '';
    if (lesson.date) {
      dateStr = String(lesson.date).split('T')[0]; // [0] gets strictly the YYYY-MM-DD string
    }

    // 2. Clean HH:mm times
    let startTime = String(lesson.startTime || '09:00');
    let endTime = String(lesson.endTime || '10:00');

    if (startTime.includes('T')) {
      startTime = startTime.split('T')[1].substring(0, 5);
    } else {
      startTime = startTime.substring(0, 5);
    }

    if (endTime.includes('T')) {
      endTime = endTime.split('T')[1].substring(0, 5);
    } else {
      endTime = endTime.substring(0, 5);
    }

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

  const dateStr = startDateObj.toISOString().split('T')[0];
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
    dateStr = String(lesson.date).split('T')[0];
  }

  document.getElementById('lesson-id').value = lesson.id;
  document.getElementById('lesson-title').value = lesson.title || '';
  document.getElementById('lesson-subject').value = lesson.subject || '';
  document.getElementById('lesson-grade').value = lesson.grade || '';
  document.getElementById('lesson-date').value = dateStr;
  document.getElementById('lesson-start').value = lesson.startTime || '';
  document.getElementById('lesson-end').value = lesson.endTime || '';
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
      await fetch(APPS_SCRIPT_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ action: 'save', payload })
      });
      await loadLessons();
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