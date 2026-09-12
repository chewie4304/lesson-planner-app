const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbz88Cc0kZi-3Q36GOC_BNfpAVmkG-TZxccVb1KP6pPtU6SS7I2UTgobZtb3twwO6HDf/exec';

let calendar;
let lessonsData = [];
let specialNotes = JSON.parse(localStorage.getItem('specialNotes') || '{}');
let activeNoteDate = null;
let confirmCallback = null;
let currentMaterialsLinks = [];

document.addEventListener('DOMContentLoaded', () => {
  if (typeof FullCalendar === 'undefined') {
    updateStatus('Error: FullCalendar failed to load.', true);
    return;
  }

  const calendarEl = document.getElementById('calendar');
  if (!calendarEl) {
    updateStatus('Error: Calendar container not found.', true);
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
    allDayText: 'All-day',
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
      lessonsData = result.data || [];
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
  if (!calendar) return;

  if (typeof calendar.getEventSources === 'function') {
    calendar.getEventSources().forEach(src => src.remove());
  } else if (typeof calendar.removeAllEvents === 'function') {
    calendar.removeAllEvents();
  }

  const events = [];
  lessonsData.forEach(lesson => {
    if (!lesson || !lesson.date) return;

    const dateStr = String(lesson.date).split('T').at(0);
    if (!dateStr || dateStr.length < 10) return;

    const startTime = formatTimeForInput(lesson.startTime) || '09:00';
    const endTime = formatTimeForInput(lesson.endTime) || '10:00';
    const startIso = `${dateStr}T${startTime}:00`;
    const endIso = `${dateStr}T${endTime}:00`;

    events.push({
      id: String(lesson.id || 'lp_' + Date.now()),
      title: `${lesson.title || 'Untitled'} (${lesson.subject || 'General'})`,
      start: startIso,
      end: endIso,
      backgroundColor: '#4f46e5',
      borderColor: '#4338ca'
    });
  });

  calendar.addEventSource(events);
}

function parseMaterials(rawMaterialsStr = '') {
  currentMaterialsLinks = [];
  if (!rawMaterialsStr) return '';

  const markdownRegex = /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g;
  const cleanedText = rawMaterialsStr.replace(markdownRegex, (match, label, url) => {
    currentMaterialsLinks.push({ label, url });
    return '';
  });

  const plainUrlRegex = /(https?:\/\/[^\s]+)/g;
  const finalText = cleanedText.replace(plainUrlRegex, (match, url) => {
    if (currentMaterialsLinks.some(link => link.url === url)) {
      return '';
    }

    currentMaterialsLinks.push({
      label: url.replace(/^https?:\/\/(www\.)?/, '').substring(0, 30) + (url.length > 30 ? '...' : ''),
      url
    });
    return '';
  });

  return finalText.replace(/\s+/g, ' ').trim();
}

function renderMaterialsLinks() {
  const previewContainer = document.getElementById('materials-links-preview');
  if (!previewContainer) return;

  if (currentMaterialsLinks.length === 0) {
    previewContainer.innerHTML = '';
    return;
  }

  previewContainer.innerHTML = currentMaterialsLinks.map((link, index) => {
    const cleanUrl = escapeHtml(link.url);
    const displayLabel = escapeHtml(link.label);
    return `
      <div class="inline-flex items-center gap-1.5 px-2.5 py-1 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-md text-xs font-semibold hover:bg-indigo-100 transition-colors">
        <a href="${cleanUrl}" target="_blank" rel="noopener noreferrer" class="inline-flex items-center gap-1.5">
          🔗 <span>${displayLabel}</span> ↗
        </a>
        <button type="button" data-remove-link-index="${index}" class="ml-1 text-indigo-500 hover:text-red-600 font-bold" aria-label="Remove link">×</button>
      </div>
    `;
  }).join('');

  previewContainer.querySelectorAll('[data-remove-link-index]').forEach(button => {
    button.addEventListener('click', () => {
      const index = Number(button.getAttribute('data-remove-link-index'));
      if (!Number.isNaN(index)) {
        currentMaterialsLinks.splice(index, 1);
        renderMaterialsLinks();
      }
    });
  });
}

function getFormattedMaterialsPayload() {
  const plainText = (document.getElementById('lesson-materials').value || '').trim();
  const linksText = currentMaterialsLinks.map(link => `[${link.label}](${link.url})`).join(' ');

  if (!plainText && !linksText) return '';
  if (!plainText) return linksText;
  if (!linksText) return plainText;
  return `${plainText} ${linksText}`;
}

function openModalForNewPlan(startIso, endIso, isAllDay = false) {
  let dateStr = startIso ? startIso.split('T').at(0) : '';
  let startTimeStr = '09:00';
  let endTimeStr = '10:00';

  if (isAllDay || !startIso || !startIso.includes('T')) {
    startTimeStr = '07:00';
    endTimeStr = '15:00';
  } else {
    const startDateObj = new Date(startIso);
    const endDateObj = new Date(endIso);

    if (!isNaN(startDateObj.getTime())) {
      startTimeStr = startDateObj.toTimeString().substring(0, 5);
    }

    if (!isNaN(endDateObj.getTime())) {
      endTimeStr = endDateObj.toTimeString().substring(0, 5);
    }
  }

  document.getElementById('modal-title').innerText = 'New Lesson Plan';
  document.getElementById('lesson-form').reset();
  document.getElementById('lesson-id').value = 'lp_' + Date.now();
  document.getElementById('lesson-date').value = dateStr;
  document.getElementById('lesson-start').value = startTimeStr;
  document.getElementById('lesson-end').value = endTimeStr;
  document.getElementById('delete-btn').classList.add('hidden');
  document.getElementById('lesson-modal').classList.remove('hidden');

  currentMaterialsLinks = [];
  document.getElementById('lesson-materials').value = '';
  renderMaterialsLinks();
}

function openModalForEdit(lesson) {
  document.getElementById('modal-title').innerText = 'Edit Lesson Plan';

  let dateStr = '';
  if (lesson.date) {
    dateStr = String(lesson.date).split('T').at(0);
  }

  document.getElementById('lesson-id').value = lesson.id || '';
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

  const cleanText = parseMaterials(lesson.materials || '');
  document.getElementById('lesson-materials').value = cleanText;
  renderMaterialsLinks();
}

function setupEventListeners() {
  const modal = document.getElementById('lesson-modal');
  const form = document.getElementById('lesson-form');
  const closeModalBtn = document.getElementById('close-modal');
  const cancelBtn = document.getElementById('cancel-btn');

  if (closeModalBtn) closeModalBtn.onclick = () => modal.classList.add('hidden');
  if (cancelBtn) cancelBtn.onclick = () => modal.classList.add('hidden');

  if (form) {
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
        materials: getFormattedMaterialsPayload(),
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
  }

  const deleteBtn = document.getElementById('delete-btn');
  if (deleteBtn) {
    deleteBtn.onclick = () => {
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
  }

  const confirmCancelBtn = document.getElementById('confirm-cancel-btn');
  if (confirmCancelBtn) confirmCancelBtn.onclick = hideConfirmModal;

  const confirmActionBtn = document.getElementById('confirm-action-btn');
  if (confirmActionBtn) {
    confirmActionBtn.onclick = () => {
      if (confirmCallback) confirmCallback();
      hideConfirmModal();
    };
  }

  const noteModal = document.getElementById('note-modal');
  const closeNoteModal = document.getElementById('close-note-modal');
  const doneNoteBtn = document.getElementById('done-note-btn');
  const noteForm = document.getElementById('note-form');

  if (closeNoteModal) closeNoteModal.onclick = () => noteModal.classList.add('hidden');
  if (doneNoteBtn) doneNoteBtn.onclick = () => noteModal.classList.add('hidden');

  if (noteForm) {
    noteForm.onsubmit = (e) => {
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

  const linkModal = document.getElementById('link-modal');
  const openLinkModalBtn = document.getElementById('open-link-modal-btn');
  const closeLinkModalBtn = document.getElementById('close-link-modal');
  const cancelLinkBtn = document.getElementById('cancel-link-btn');
  const linkForm = document.getElementById('link-form');

  if (openLinkModalBtn) {
    openLinkModalBtn.onclick = () => {
      const materialsTextarea = document.getElementById('lesson-materials');
      const start = materialsTextarea ? materialsTextarea.selectionStart : 0;
      const end = materialsTextarea ? materialsTextarea.selectionEnd : 0;
      const selectedText = materialsTextarea ? materialsTextarea.value.substring(start, end).trim() : '';

      document.getElementById('link-text-input').value = selectedText || 'Resource';
      document.getElementById('link-url-input').value = '';
      if (linkModal) linkModal.classList.remove('hidden');
    };
  }

  const hideLinkModal = () => {
    if (linkModal) {
      linkModal.classList.add('hidden');
      if (linkForm) linkForm.reset();
    }
  };

  if (closeLinkModalBtn) closeLinkModalBtn.onclick = hideLinkModal;
  if (cancelLinkBtn) cancelLinkBtn.onclick = hideLinkModal;

  if (linkForm) {
    linkForm.onsubmit = (e) => {
      e.preventDefault();
      const label = document.getElementById('link-text-input').value.trim();
      const url = document.getElementById('link-url-input').value.trim();

      if (!label || !url) return;

      currentMaterialsLinks.push({ label, url });
      renderMaterialsLinks();
      hideLinkModal();
    };
  }
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
  if (!statusEl) return;

  statusEl.innerText = `Status: ${message}`;
  statusEl.className = `text-sm font-medium ${isError ? 'text-red-500' : 'text-slate-500'}`;
}

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
  if (!container) return;

  const notes = getNotesForDate(activeNoteDate);
  if (notes.length === 0) {
    container.innerHTML = '<p class="text-xs text-slate-400 italic py-2">No special notes added for this day yet.</p>';
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

  renderNoteListModal();
}

function saveSpecialNotes() {
  localStorage.setItem('specialNotes', JSON.stringify(specialNotes));
  renderNoteListModal();
  renderSpecialNotesRow();
}

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
        : '<span class="text-slate-300 group-hover:text-indigo-600 text-[11px] font-normal">+ Add note</span>'
      }
        </div>
      </td>
    `;
  });

  trEl.innerHTML = html;
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}