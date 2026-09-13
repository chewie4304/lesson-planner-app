const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbz88Cc0kZi-3Q36GOC_BNfpAVmkG-TZxccVb1KP6pPtU6SS7I2UTgobZtb3twwO6HDf/exec';

let calendar;
let lessonsData = [];
let specialNotes = JSON.parse(localStorage.getItem('specialNotes') || '{}');
let activeNoteDate = null;
let confirmCallback = null;
let selectedDupDates = [];
let miniCalCurrentDate = new Date();

// Reactive Form Items State
let currentObjectives = [];
let currentAssessment = [];
let currentMaterialsText = [];
let attachedLinks = [];
let currentProcedure = []; // [{ text: 'Step...', completed: false }]

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

// Helper to retry fetches automatically if Google returns an HTML cold-start error
async function fetchWithRetry(url, options = {}, retries = 3, delay = 1500) {
  for (let i = 0; i < retries; i++) {
    try {
      const response = await fetch(url, options);
      const text = await response.text();

      // Ensure the response is valid JSON and not a Google HTML error page
      const data = JSON.parse(text);
      return data;
    } catch (err) {
      if (i === retries - 1) throw err; // Re-throw on final failed attempt
      console.warn(`Fetch attempt ${i + 1} failed (cold start). Retrying in ${delay}ms...`);
      await new Promise(res => setTimeout(res, delay));
    }
  }
}

async function loadLessons() {
  updateStatus('Loading lessons...');
  try {
    const result = await fetchWithRetry(APPS_SCRIPT_URL);
    if (result && result.status === 'success') {
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

// Robust JSON Parsing Helper
function safeJsonParse(raw) {
  if (!raw) return null;
  let parsed = raw;
  try {
    while (typeof parsed === 'string') {
      let temp = JSON.parse(parsed);
      if (temp === parsed) break;
      parsed = temp;
    }
  } catch (e) {
    return raw;
  }
  return parsed;
}

function parseListField(raw) {
  if (!raw) return [];
  const parsed = safeJsonParse(raw);
  if (Array.isArray(parsed)) return parsed;
  if (typeof parsed === 'string') {
    return parsed.split('\n').map(s => s.trim()).filter(Boolean);
  }
  return [];
}

function parseProcedureField(raw) {
  if (!raw) return [];
  const parsed = safeJsonParse(raw);
  if (Array.isArray(parsed)) {
    return parsed.map(item => typeof item === 'object' && item !== null ? item : { text: String(item), completed: false });
  }
  if (typeof parsed === 'string') {
    return parsed.split('\n').map(s => s.trim()).filter(Boolean).map(text => ({ text, completed: false }));
  }
  return [];
}

function parseMaterialsField(raw) {
  if (!raw) return { textList: [], links: [] };
  const parsed = safeJsonParse(raw);
  if (parsed && typeof parsed === 'object') {
    if (Array.isArray(parsed)) {
      return { textList: parsed.map(String), links: [] };
    }
    return {
      textList: Array.isArray(parsed.textList) ? parsed.textList : (parsed.text ? [parsed.text] : []),
      links: Array.isArray(parsed.links) ? parsed.links : []
    };
  }
  if (typeof parsed === 'string') {
    return { textList: parsed.split('\n').map(s => s.trim()).filter(Boolean), links: [] };
  }
  return { textList: [], links: [] };
}

// Auto-commit any text typed into inputs before clicking Save or Duplicate
function commitPendingInputs() {
  const objInput = document.getElementById('lesson-objectives-input');
  if (objInput && objInput.value.trim()) {
    currentObjectives.push(objInput.value.trim());
    objInput.value = '';
    renderObjectivesBadges();
  }

  const assessInput = document.getElementById('lesson-assessment-input');
  if (assessInput && assessInput.value.trim()) {
    currentAssessment.push(assessInput.value.trim());
    assessInput.value = '';
    renderAssessmentBadges();
  }

  const matInput = document.getElementById('lesson-materials-input');
  if (matInput && matInput.value.trim()) {
    currentMaterialsText.push(matInput.value.trim());
    matInput.value = '';
    renderMaterialsBadges();
  }

  const procInput = document.getElementById('lesson-procedure-input');
  if (procInput && procInput.value.trim()) {
    currentProcedure.push({ text: procInput.value.trim(), completed: false });
    procInput.value = '';
    renderProcedureChecklist();
  }
}

// Render Functions for Reactive Badges
function renderObjectivesBadges() {
  const container = document.getElementById('objectives-badges-container');
  if (currentObjectives.length === 0) {
    container.innerHTML = `<span class="text-xs text-slate-400 italic">No objectives added yet.</span>`;
    return;
  }
  container.innerHTML = currentObjectives.map((obj, idx) => `
    <span class="inline-flex items-center gap-1.5 px-2.5 py-1 bg-sky-50 text-sky-800 border border-sky-200 rounded-md text-xs font-medium shadow-sm">
      <span>🎯 ${escapeHtml(obj)}</span>
      <button type="button" onclick="removeObjectiveItem(${idx})" class="text-sky-400 hover:text-red-600 font-bold text-sm leading-none">&times;</button>
    </span>
  `).join('');
}

function removeObjectiveItem(idx) {
  currentObjectives.splice(idx, 1);
  renderObjectivesBadges();
}

function renderAssessmentBadges() {
  const container = document.getElementById('assessment-badges-container');
  if (currentAssessment.length === 0) {
    container.innerHTML = `<span class="text-xs text-slate-400 italic">No assessment methods added yet.</span>`;
    return;
  }
  container.innerHTML = currentAssessment.map((item, idx) => `
    <span class="inline-flex items-center gap-1.5 px-2.5 py-1 bg-purple-50 text-purple-800 border border-purple-200 rounded-md text-xs font-medium shadow-sm">
      <span>📊 ${escapeHtml(item)}</span>
      <button type="button" onclick="removeAssessmentItem(${idx})" class="text-purple-400 hover:text-red-600 font-bold text-sm leading-none">&times;</button>
    </span>
  `).join('');
}

function removeAssessmentItem(idx) {
  currentAssessment.splice(idx, 1);
  renderAssessmentBadges();
}

function renderMaterialsBadges() {
  const container = document.getElementById('materials-badges-container');
  if (currentMaterialsText.length === 0 && attachedLinks.length === 0) {
    container.innerHTML = `<span class="text-xs text-slate-400 italic">No materials or web links added yet.</span>`;
    return;
  }

  let html = '';

  // Render text items
  html += currentMaterialsText.map((item, idx) => `
    <span class="inline-flex items-center gap-1.5 px-2.5 py-1 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-md text-xs font-medium shadow-sm">
      <span>📦 ${escapeHtml(item)}</span>
      <button type="button" onclick="removeMaterialTextItem(${idx})" class="text-emerald-400 hover:text-red-600 font-bold text-sm leading-none">&times;</button>
    </span>
  `).join('');

  // Render link badges
  html += attachedLinks.map((item, idx) => `
    <span class="inline-flex items-center gap-1.5 px-2.5 py-1 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-md text-xs font-semibold shadow-sm">
      <a href="${escapeHtml(item.url)}" target="_blank" rel="noopener noreferrer" class="hover:underline flex items-center gap-1">
        🔗 <span>${escapeHtml(item.title)}</span> ↗
      </a>
      <button type="button" onclick="removeAttachedLink(${idx})" class="text-indigo-400 hover:text-red-600 font-bold text-sm leading-none">&times;</button>
    </span>
  `).join('');

  container.innerHTML = html;
}

function removeMaterialTextItem(idx) {
  currentMaterialsText.splice(idx, 1);
  renderMaterialsBadges();
}

function removeAttachedLink(idx) {
  attachedLinks.splice(idx, 1);
  renderMaterialsBadges();
}

function renderProcedureChecklist() {
  const container = document.getElementById('procedure-checklist-container');
  const countBadge = document.getElementById('procedure-count-badge');

  const completedCount = currentProcedure.filter(p => p.completed).length;
  countBadge.innerText = `${completedCount}/${currentProcedure.length} completed`;

  if (currentProcedure.length === 0) {
    container.innerHTML = `<p class="text-xs text-slate-400 italic py-4 text-center border-2 border-dashed border-slate-200 rounded-lg">No procedure steps added yet. Type a step above and press Enter.</p>`;
    return;
  }

  container.innerHTML = currentProcedure.map((step, idx) => `
    <div class="flex items-center justify-between p-2.5 ${step.completed ? 'bg-slate-100/70 border-slate-200' : 'bg-white border-slate-200'} border rounded-md shadow-sm transition-all group">
      <label class="flex items-start gap-2.5 cursor-pointer min-w-0 flex-1 pr-2">
        <input type="checkbox" ${step.completed ? 'checked' : ''} onchange="toggleProcedureStep(${idx})"
               class="mt-0.5 h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer">
        <span class="text-xs font-medium ${step.completed ? 'line-through text-slate-400' : 'text-slate-800'} break-words">
          <span class="font-bold text-slate-400 mr-1">${idx + 1}.</span>${escapeHtml(step.text)}
        </span>
      </label>
      <button type="button" onclick="removeProcedureStep(${idx})" class="text-slate-300 hover:text-red-500 font-bold text-sm px-1 transition-colors" title="Delete step">&times;</button>
    </div>
  `).join('');
}

function toggleProcedureStep(idx) {
  currentProcedure[idx].completed = !currentProcedure[idx].completed;
  renderProcedureChecklist();
}

function removeProcedureStep(idx) {
  currentProcedure.splice(idx, 1);
  renderProcedureChecklist();
}

function renderMiniCalendar() {
  const container = document.getElementById('dup-mini-calendar-days');
  const titleEl = document.getElementById('dup-month-title');
  if (!container || !titleEl) return;

  const year = miniCalCurrentDate.getFullYear();
  const month = miniCalCurrentDate.getMonth();

  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  titleEl.innerText = `${monthNames[month]} ${year}`;

  const firstDayIndex = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  let html = '';

  for (let i = 0; i < firstDayIndex; i++) {
    html += `<div class="p-1"></div>`;
  }

  for (let day = 1; day <= daysInMonth; day++) {
    const monthStr = String(month + 1).padStart(2, '0');
    const dayStr = String(day).padStart(2, '0');
    const fullDateIso = `${year}-${monthStr}-${dayStr}`;

    const isSelected = selectedDupDates.includes(fullDateIso);
    const dayOfWeek = new Date(year, month, day).getDay();
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

    let bgClasses = isSelected
      ? 'bg-amber-500 text-white font-bold border-amber-600 shadow-sm'
      : (isWeekend ? 'bg-slate-50 text-slate-400 border-transparent hover:bg-amber-100' : 'bg-white text-slate-700 border-slate-200 hover:bg-amber-100');

    html += `
      <button type="button" onclick="toggleDupDate('${fullDateIso}')" 
              class="p-1 rounded border text-xs text-center transition-colors ${bgClasses}">
        ${day}
      </button>
    `;
  }

  container.innerHTML = html;
  document.getElementById('dup-selected-count').innerText = `${selectedDupDates.length} date(s) selected`;
}

function toggleDupDate(dateStr) {
  const index = selectedDupDates.indexOf(dateStr);
  if (index > -1) {
    selectedDupDates.splice(index, 1);
  } else {
    selectedDupDates.push(dateStr);
  }
  selectedDupDates.sort();
  renderMiniCalendar();
  renderDupDatesList();
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

  // Reset Reactive Fields State
  currentObjectives = [];
  currentAssessment = [];
  currentMaterialsText = [];
  attachedLinks = [];
  currentProcedure = [];

  renderObjectivesBadges();
  renderAssessmentBadges();
  renderMaterialsBadges();
  renderProcedureChecklist();

  document.getElementById('inline-link-box').classList.add('hidden');

  selectedDupDates = [];
  miniCalCurrentDate = new Date();
  renderMiniCalendar();
  renderDupDatesList();

  document.getElementById('duplicate-panel').classList.add('hidden');
  document.getElementById('duplicate-btn').classList.add('hidden');
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

  // Populate Reactive Items from Saved Lesson Data
  currentObjectives = parseListField(lesson.objectives);
  currentAssessment = parseListField(lesson.assessment);
  currentProcedure = parseProcedureField(lesson.procedure);

  const parsedMat = parseMaterialsField(lesson.materials);
  currentMaterialsText = parsedMat.textList;
  attachedLinks = parsedMat.links;

  renderObjectivesBadges();
  renderAssessmentBadges();
  renderMaterialsBadges();
  renderProcedureChecklist();

  document.getElementById('inline-link-box').classList.add('hidden');

  selectedDupDates = [];
  miniCalCurrentDate = new Date();
  renderMiniCalendar();
  renderDupDatesList();

  document.getElementById('duplicate-panel').classList.add('hidden');
  document.getElementById('duplicate-btn').classList.remove('hidden');
  document.getElementById('delete-btn').classList.remove('hidden');
  document.getElementById('lesson-modal').classList.remove('hidden');
}

function renderDupDatesList() {
  const container = document.getElementById('dup-dates-list');
  if (selectedDupDates.length === 0) {
    container.innerHTML = `<span class="text-xs text-amber-700 italic">No target dates selected yet.</span>`;
    return;
  }
  container.innerHTML = selectedDupDates.map((d, i) => `
    <span class="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-100 text-amber-900 border border-amber-300 rounded text-xs font-semibold">
      ${d}
      <button type="button" onclick="removeDupDate(${i})" class="text-amber-700 hover:text-red-600 font-bold ml-1">&times;</button>
    </span>
  `).join('');
}

function removeDupDate(index) {
  selectedDupDates.splice(index, 1);
  renderDupDatesList();
  renderMiniCalendar();
}

function setupEventListeners() {
  const modal = document.getElementById('lesson-modal');
  const form = document.getElementById('lesson-form');

  document.getElementById('close-modal').onclick = () => modal.classList.add('hidden');
  document.getElementById('cancel-btn').onclick = () => modal.classList.add('hidden');

  // Keydown Listeners for Enter-Key Reactivity
  document.getElementById('lesson-objectives-input').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const val = e.target.value.trim();
      if (val) {
        currentObjectives.push(val);
        e.target.value = '';
        renderObjectivesBadges();
      }
    }
  });

  document.getElementById('lesson-assessment-input').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const val = e.target.value.trim();
      if (val) {
        currentAssessment.push(val);
        e.target.value = '';
        renderAssessmentBadges();
      }
    }
  });

  document.getElementById('lesson-materials-input').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const val = e.target.value.trim();
      if (val) {
        currentMaterialsText.push(val);
        e.target.value = '';
        renderMaterialsBadges();
      }
    }
  });

  document.getElementById('lesson-procedure-input').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const val = e.target.value.trim();
      if (val) {
        currentProcedure.push({ text: val, completed: false });
        e.target.value = '';
        renderProcedureChecklist();
      }
    }
  });

  // Inline Add Link Listeners
  const inlineLinkBox = document.getElementById('inline-link-box');
  document.getElementById('toggle-add-link-btn').onclick = () => {
    document.getElementById('link-title-input').value = '';
    document.getElementById('link-url-input').value = '';
    inlineLinkBox.classList.toggle('hidden');
  };
  document.getElementById('cancel-link-btn').onclick = () => inlineLinkBox.classList.add('hidden');

  document.getElementById('confirm-link-btn').onclick = () => {
    const titleInput = document.getElementById('link-title-input');
    const urlInput = document.getElementById('link-url-input');

    const titleVal = titleInput.value.trim();
    let urlVal = urlInput.value.trim();

    if (!titleVal || !urlVal) {
      alert('Please enter both a link title and a URL.');
      return;
    }

    if (!/^https?:\/\//i.test(urlVal)) {
      urlVal = 'https://' + urlVal;
    }

    attachedLinks.push({ title: titleVal, url: urlVal });
    titleInput.value = '';
    urlInput.value = '';
    inlineLinkBox.classList.add('hidden');
    renderMaterialsBadges();
  };

  // Mini-Calendar Navigation & Action Listeners
  document.getElementById('prev-dup-month-btn').onclick = () => {
    miniCalCurrentDate.setMonth(miniCalCurrentDate.getMonth() - 1);
    renderMiniCalendar();
  };

  document.getElementById('next-dup-month-btn').onclick = () => {
    miniCalCurrentDate.setMonth(miniCalCurrentDate.getMonth() + 1);
    renderMiniCalendar();
  };

  document.getElementById('clear-dup-dates-btn').onclick = () => {
    selectedDupDates = [];
    renderMiniCalendar();
    renderDupDatesList();
  };

  // Add Date Range for Duplication
  document.getElementById('add-range-btn').onclick = () => {
    const startVal = document.getElementById('dup-range-start').value;
    const endVal = document.getElementById('dup-range-end').value;

    if (!startVal || !endVal) {
      alert('Please select both a Start Date and an End Date for the range.');
      return;
    }

    let current = new Date(startVal + 'T00:00:00');
    const end = new Date(endVal + 'T00:00:00');

    if (current > end) {
      alert('Start Date must be before or equal to End Date.');
      return;
    }

    while (current <= end) {
      const year = current.getFullYear();
      const month = String(current.getMonth() + 1).padStart(2, '0');
      const day = String(current.getDate()).padStart(2, '0');
      const dateStr = `${year}-${month}-${day}`;

      if (!selectedDupDates.includes(dateStr)) {
        selectedDupDates.push(dateStr);
      }
      current.setDate(current.getDate() + 1);
    }

    selectedDupDates.sort();
    document.getElementById('dup-range-start').value = '';
    document.getElementById('dup-range-end').value = '';
    renderMiniCalendar();
    renderDupDatesList();
  };

  // Toggle Duplication Panel
  document.getElementById('duplicate-btn').onclick = () => {
    const panel = document.getElementById('duplicate-panel');
    panel.classList.toggle('hidden');
  };

  // Confirm Duplication Across All Target Dates
  document.getElementById('confirm-dup-btn').onclick = async () => {
    commitPendingInputs(); // <-- ADD THIS LINE HERE

    if (selectedDupDates.length === 0) {
      alert('Please select at least one target date on the calendar.');
      return;
    }

    const basePayload = {
      title: document.getElementById('lesson-title').value,
      subject: document.getElementById('lesson-subject').value,
      grade: document.getElementById('lesson-grade').value,
      startTime: document.getElementById('lesson-start').value,
      endTime: document.getElementById('lesson-end').value,
      objectives: JSON.stringify(currentObjectives),
      procedure: JSON.stringify(currentProcedure),
      assessment: JSON.stringify(currentAssessment),
      materials: JSON.stringify({ textList: currentMaterialsText, links: attachedLinks }),
      status: 'Scheduled'
    };

    modal.classList.add('hidden');
    updateStatus(`Duplicating plan to ${selectedDupDates.length} date(s)...`);

    try {
      for (let i = 0; i < selectedDupDates.length; i++) {
        const targetDate = selectedDupDates[i];
        const dupPayload = {
          ...basePayload,
          id: 'lp_' + Date.now() + '_' + i,
          date: targetDate
        };
        await fetch(APPS_SCRIPT_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          body: JSON.stringify({ action: 'save', payload: dupPayload })
        });
      }
      await loadLessons();
      updateStatus('Duplication complete! All changes synced');
    } catch (err) {
      console.error(err);
      updateStatus('Error duplicating plan', true);
    }
  };

  form.onsubmit = async (e) => {
    e.preventDefault();
    commitPendingInputs();

    const payload = {
      id: document.getElementById('lesson-id').value,
      title: document.getElementById('lesson-title').value,
      subject: document.getElementById('lesson-subject').value,
      grade: document.getElementById('lesson-grade').value,
      date: document.getElementById('lesson-date').value,
      startTime: document.getElementById('lesson-start').value,
      endTime: document.getElementById('lesson-end').value,
      objectives: JSON.stringify(currentObjectives),
      procedure: JSON.stringify(currentProcedure),
      assessment: JSON.stringify(currentAssessment),
      materials: JSON.stringify({ textList: currentMaterialsText, links: attachedLinks }),
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