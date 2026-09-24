// Supabase Client Configuration
const SUPABASE_URL = 'https://pnpudjetvfshnmysynmn.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBucHVkamV0dmZzaG5teXN5bm1uIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODcyNTY5MTksImV4cCI6MjEwMjgzMjkxOX0._XLKuDsEg3OUyJ0fGIQbsvvcLUG3GBvJtUR3tcuwt5M';
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let calendar;
let lessonsData = [];
let specialNotes = JSON.parse(localStorage.getItem('specialNotes') || '{}');
let activeNoteDate = null;
let confirmCallback = null;
let selectedDupDates = [];
let miniCalCurrentDate = new Date();
let currentEditingLessonId = null;
let draggedSameTimeIndex = null;

// Reactive Form Items State
let currentObjectives = [];
let currentAssessment = [];
let currentMaterialsText = [];
let attachedLinks = [];
let currentProcedure = [];

// Inline Edit & Drag State Tracker
let editingState = { type: null, idx: null };
let draggedStepIndex = null;

// Dedicated Color Palette for Custom Grade Levels
const GRADE_COLORS = {
  '6': { bg: '#059669', border: '#047857' }, // 6th Grade - Emerald Green
  '7': { bg: '#2563eb', border: '#1d4ed8' }, // 7th Grade - Royal Blue
  '8': { bg: '#7c3aed', border: '#6d28d9' }, // 8th Grade - Purple
  '7a': { bg: '#0891b2', border: '#0e7490' }, // 7A - Cyan/Teal
  'alg': { bg: '#db2777', border: '#be185d' }, // Algebra - Pink/Magenta
  '678': { bg: '#d97706', border: '#b45309' }  // 678 Combined - Amber/Orange
};

const GRADE_PALETTE_FALLBACK = [
  { bg: '#4f46e5', border: '#4338ca' },
  { bg: '#ea580c', border: '#c2410c' },
  { bg: '#0284c7', border: '#0369a1' }
];

function getGradeColor(grade) {
  if (!grade) return { bg: '#4f46e5', border: '#4338ca' };
  const key = String(grade).trim().toLowerCase();

  if (GRADE_COLORS[key]) {
    return GRADE_COLORS[key];
  }

  const keys = Object.keys(GRADE_COLORS).sort((a, b) => b.length - a.length);
  for (const k of keys) {
    if (key.includes(k)) return GRADE_COLORS[k];
  }

  let hash = 0;
  for (let i = 0; i < key.length; i++) {
    hash = key.charCodeAt(i) + ((hash << 5) - hash);
  }
  return GRADE_PALETTE_FALLBACK[Math.abs(hash) % GRADE_PALETTE_FALLBACK.length];
}

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
    const timePart = str.split('T').at(1);
    if (timePart) return timePart.substring(0, 5);
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
    slotDuration: '00:15:00',
    slotLabelInterval: '01:00:00',
    slotEventOverlap: true,
    eventOverlap: true,
    headerToolbar: {
      left: 'prev,next today',
      center: 'title',
      right: 'dayGridMonth,timeGridWeek,timeGridDay'
    },
    slotMinTime: '07:00:00',
    slotMaxTime: '18:00:00',
    expandRows: true,
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

// Load Lessons from Supabase
async function loadLessons() {
  updateStatus('Loading lessons...');
  try {
    const { data, error } = await supabaseClient.from('lessons').select('*');
    if (error) throw error;

    lessonsData = data || [];
    renderEventsOnCalendar();
    updateStatus('All changes synced');
  } catch (error) {
    console.error('loadLessons error:', error);
    updateStatus('Error loading lessons from Supabase', true);
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

    const color = getGradeColor(lesson.grade);

    return {
      id: String(lesson.id),
      title: `${lesson.title || 'Untitled'} (${lesson.subject || 'General'})`,
      start: startIso,
      end: endIso,
      backgroundColor: color.bg,
      borderColor: color.border
    };
  });
  calendar.addEventSource(events);
}

// Robust JSON Parsing Helpers
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
  if (Array.isArray(raw)) return raw;
  const parsed = safeJsonParse(raw);
  if (Array.isArray(parsed)) return parsed;
  if (typeof parsed === 'string') {
    return parsed.split('\n').map(s => s.trim()).filter(Boolean);
  }
  return [];
}

function parseProcedureField(raw) {
  if (!raw) return [];
  if (Array.isArray(raw)) {
    return raw.map(item => typeof item === 'object' && item !== null ? item : { text: String(item), completed: false });
  }
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
  if (!raw) return { textList: [], links: [], sortOrder: 1 };
  if (typeof raw === 'object' && raw !== null && !Array.isArray(raw)) {
    return {
      textList: Array.isArray(raw.textList) ? raw.textList : (raw.text ? [raw.text] : []),
      links: Array.isArray(raw.links) ? raw.links : [],
      sortOrder: raw.sortOrder || 1
    };
  }
  const parsed = safeJsonParse(raw);
  if (parsed && typeof parsed === 'object') {
    if (Array.isArray(parsed)) {
      return { textList: parsed.map(String), links: [], sortOrder: 1 };
    }
    return {
      textList: Array.isArray(parsed.textList) ? parsed.textList : (parsed.text ? [parsed.text] : []),
      links: Array.isArray(parsed.links) ? parsed.links : [],
      sortOrder: parsed.sortOrder || 1
    };
  }
  return { textList: [], links: [], sortOrder: 1 };
}

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

// Helper to safely extract sortOrder from a lesson object or its materials
function getLessonSortOrder(lesson) {
  if (!lesson) return 1;
  if (typeof lesson.sortOrder === 'number') return lesson.sortOrder;
  const mat = parseMaterialsField(lesson.materials);
  return typeof mat.sortOrder === 'number' ? mat.sortOrder : 1;
}

// Modal Lesson Navigation Helpers
function getSortedLessons() {
  return [...lessonsData].sort((a, b) => {
    const dateA = a.date ? String(a.date).split('T').at(0) : '';
    const dateB = b.date ? String(b.date).split('T').at(0) : '';
    if (dateA !== dateB) return dateA.localeCompare(dateB);

    const timeA = formatTimeForInput(a.startTime) || '00:00';
    const timeB = formatTimeForInput(b.startTime) || '00:00';
    if (timeA !== timeB) return timeA.localeCompare(timeB);

    return getLessonSortOrder(a) - getLessonSortOrder(b);
  });
}

function updateModalNavControls() {
  const counterEl = document.getElementById('lesson-nav-counter');
  const navBox = document.getElementById('modal-nav-controls');
  const prevBtn = document.getElementById('prev-lesson-btn');
  const nextBtn = document.getElementById('next-lesson-btn');

  if (!currentEditingLessonId) {
    if (counterEl) counterEl.classList.add('hidden');
    if (navBox) navBox.classList.add('hidden');
    return;
  }

  const sorted = getSortedLessons();
  const overallIndex = sorted.findIndex(l => String(l.id) === String(currentEditingLessonId));

  if (overallIndex === -1) {
    if (counterEl) counterEl.classList.add('hidden');
    if (navBox) navBox.classList.add('hidden');
    return;
  }

  const group = getSameTimeLessons();
  const slotIndex = group.findIndex(l => String(l.id) === String(currentEditingLessonId));
  const activeSlotIndex = slotIndex !== -1 ? slotIndex : 0;
  const activeGroupCount = group.length > 0 ? group.length : 1;

  if (counterEl) {
    counterEl.innerText = `Lesson ${activeSlotIndex + 1} of ${activeGroupCount} ▾`;
    counterEl.classList.remove('hidden');
  }
  if (navBox) {
    navBox.classList.remove('hidden');
  }

  if (prevBtn) prevBtn.disabled = overallIndex <= 0;
  if (nextBtn) nextBtn.disabled = overallIndex >= sorted.length - 1;
}

function toggleSameTimeReorderPanel() {
  const panel = document.getElementById('same-time-reorder-panel');
  if (!panel) return;
  panel.classList.toggle('hidden');
  if (!panel.classList.contains('hidden')) {
    renderSameTimeReorderList();
  }
}

function getSameTimeLessons() {
  if (!currentEditingLessonId) return [];
  const current = lessonsData.find(l => String(l.id) === String(currentEditingLessonId));
  if (!current) return [];

  const curDate = current.date ? String(current.date).split('T').at(0) : '';
  const curTime = formatTimeForInput(current.startTime) || '00:00';

  return getSortedLessons().filter(l => {
    const d = l.date ? String(l.date).split('T').at(0) : '';
    const t = formatTimeForInput(l.startTime) || '00:00';
    return d === curDate && t === curTime;
  });
}

function renderSameTimeReorderList() {
  const container = document.getElementById('same-time-lessons-list');
  if (!container) return;

  const sameTimeLessons = getSameTimeLessons();
  if (sameTimeLessons.length <= 1) {
    container.innerHTML = `<p class="text-xs text-slate-400 italic py-1">No other lessons scheduled at this exact time.</p>`;
    return;
  }

  container.innerHTML = sameTimeLessons.map((lesson, idx) => `
    <div draggable="true"
         ondragstart="handleSameTimeDragStart(event, ${idx})"
         ondragover="handleSameTimeDragOver(event)"
         ondrop="handleSameTimeDrop(event, ${idx})"
         ondragend="handleSameTimeDragEnd(event)"
         class="flex items-center gap-2 p-1.5 bg-slate-50 border border-slate-200 rounded text-xs cursor-grab active:cursor-grabbing hover:border-indigo-300 ${String(lesson.id) === String(currentEditingLessonId) ? 'ring-1 ring-indigo-500 bg-indigo-50/50' : ''}">
      <span class="text-slate-400 font-bold select-none">⠿</span>
      <span class="font-medium text-slate-700 truncate flex-1">${escapeHtml(lesson.title || 'Untitled')}</span>
      <span class="text-[10px] text-slate-500 bg-white px-1.5 py-0.5 rounded border border-slate-200">${escapeHtml(lesson.grade || 'Gen')}</span>
    </div>
  `).join('');
}

function handleSameTimeDragStart(e, idx) {
  draggedSameTimeIndex = idx;
  e.dataTransfer.effectAllowed = 'move';
}

function handleSameTimeDragOver(e) {
  e.preventDefault();
}

async function handleSameTimeDrop(e, targetIdx) {
  e.preventDefault();
  e.stopPropagation();
  if (draggedSameTimeIndex === null || draggedSameTimeIndex === targetIdx) return;

  const group = getSameTimeLessons();
  const [moved] = group.splice(draggedSameTimeIndex, 1);
  group.splice(targetIdx, 0, moved);

  // Prepare database payloads storing sortOrder safely inside materials
  const payloads = group.map((lesson, index) => {
    const mat = parseMaterialsField(lesson.materials);
    mat.sortOrder = index + 1;

    return {
      id: String(lesson.id),
      title: lesson.title || '',
      subject: lesson.subject || '',
      grade: lesson.grade || '',
      date: lesson.date ? String(lesson.date).split('T').at(0) : '',
      startTime: formatTimeForInput(lesson.startTime),
      endTime: formatTimeForInput(lesson.endTime),
      objectives: parseListField(lesson.objectives),
      procedure: parseProcedureField(lesson.procedure),
      assessment: parseListField(lesson.assessment),
      materials: mat,
      status: lesson.status || 'Scheduled'
    };
  });

  draggedSameTimeIndex = null;
  renderSameTimeReorderList();

  // Update local app state immediately
  payloads.forEach(updated => {
    const idx = lessonsData.findIndex(l => String(l.id) === String(updated.id));
    if (idx !== -1) lessonsData[idx] = updated;
  });

  updateModalNavControls();
  renderEventsOnCalendar();

  // Persist to Supabase cleanly
  updateStatus('Saving lesson order...');
  try {
    const { error } = await supabaseClient.from('lessons').upsert(payloads);
    if (error) throw error;
    updateStatus('Lesson order saved');
  } catch (err) {
    console.error('Reorder error:', err);
    updateStatus('Error saving lesson order', true);
  }
}

function handleSameTimeDragEnd(e) {
  draggedSameTimeIndex = null;
}

window.toggleSameTimeReorderPanel = toggleSameTimeReorderPanel;
window.handleSameTimeDragStart = handleSameTimeDragStart;
window.handleSameTimeDragOver = handleSameTimeDragOver;
window.handleSameTimeDrop = handleSameTimeDrop;
window.handleSameTimeDragEnd = handleSameTimeDragEnd;
window.renderSameTimeReorderList = renderSameTimeReorderList;

async function navigateLesson(offset) {
  if (!currentEditingLessonId) return;

  const sorted = getSortedLessons();
  const currentIndex = sorted.findIndex(l => String(l.id) === String(currentEditingLessonId));
  if (currentIndex === -1) return;

  const targetIndex = currentIndex + offset;
  if (targetIndex < 0 || targetIndex >= sorted.length) return;

  commitPendingInputs();
  const currentSortOrder = getLessonSortOrder(lessonsData.find(l => String(l.id) === String(document.getElementById('lesson-id').value)) || {});

  const payload = {
    id: document.getElementById('lesson-id').value,
    title: document.getElementById('lesson-title').value,
    subject: document.getElementById('lesson-subject').value,
    grade: document.getElementById('lesson-grade').value,
    date: document.getElementById('lesson-date').value,
    startTime: document.getElementById('lesson-start').value,
    endTime: document.getElementById('lesson-end').value,
    objectives: currentObjectives,
    procedure: currentProcedure,
    assessment: currentAssessment,
    materials: { textList: currentMaterialsText, links: attachedLinks, sortOrder: currentSortOrder },
    status: 'Scheduled'
  };

  updateStatus('Saving & switching lesson...');
  try {
    const { error } = await supabaseClient.from('lessons').upsert(payload);
    if (error) throw error;

    const localIdx = lessonsData.findIndex(l => String(l.id) === String(payload.id));
    if (localIdx !== -1) {
      lessonsData[localIdx] = payload;
    } else {
      lessonsData.push(payload);
    }
    renderEventsOnCalendar();
  } catch (err) {
    console.error('Auto-save failed during navigation:', err);
  }

  const targetLesson = sorted[targetIndex];
  if (targetLesson) {
    openModalForEdit(targetLesson);
  }
}

// --- Objectives Editing & Rendering ---

function editObjectiveItem(e, idx) {
  if (e) e.stopPropagation();
  editingState = { type: 'objective', idx };
  renderObjectivesBadges();
}

function saveObjectiveEdit(idx, val) {
  if (editingState.type !== 'objective' || editingState.idx !== idx) return;
  editingState = { type: null, idx: null };
  const trimmed = val.trim();
  if (trimmed) {
    currentObjectives[idx] = trimmed;
  } else {
    currentObjectives.splice(idx, 1);
  }
  renderObjectivesBadges();
}

function renderObjectivesBadges() {
  const container = document.getElementById('objectives-badges-container');
  if (currentObjectives.length === 0) {
    container.innerHTML = `<span class="text-xs text-slate-400 italic">No objectives added yet.</span>`;
    return;
  }
  container.innerHTML = currentObjectives.map((obj, idx) => {
    if (editingState.type === 'objective' && editingState.idx === idx) {
      return `
        <span class="inline-flex items-center gap-1 px-1.5 py-0.5 bg-sky-50 border border-sky-300 rounded-md">
          <input type="text" id="active-edit-input" value="${escapeHtml(obj)}"
                 class="px-1.5 py-0.5 text-xs border border-sky-300 rounded bg-white text-slate-800 focus:outline-none focus:ring-1 focus:ring-sky-500"
                 onkeydown="if(event.key==='Enter'){ event.preventDefault(); saveObjectiveEdit(${idx}, this.value); }"
                 onblur="saveObjectiveEdit(${idx}, this.value)">
        </span>
      `;
    }
    return `
      <span class="inline-flex items-center gap-1.5 px-2.5 py-1 bg-sky-50 text-sky-800 border border-sky-200 rounded-md text-xs font-medium shadow-sm">
        <span class="cursor-pointer hover:underline" onclick="editObjectiveItem(event, ${idx})" title="Click to edit">🎯 ${escapeHtml(obj)}</span>
        <button type="button" onclick="removeObjectiveItem(${idx})" class="text-sky-400 hover:text-red-600 font-bold text-sm leading-none">&times;</button>
      </span>
    `;
  }).join('');

  if (editingState.type === 'objective') {
    setTimeout(() => {
      const input = document.getElementById('active-edit-input');
      if (input) { input.focus(); input.select(); }
    }, 20);
  }
}

function removeObjectiveItem(idx) {
  currentObjectives.splice(idx, 1);
  renderObjectivesBadges();
}

// --- Assessment Editing & Rendering ---
function editAssessmentItem(e, idx) {
  if (e) e.stopPropagation();
  editingState = { type: 'assessment', idx };
  renderAssessmentBadges();
}

function saveAssessmentEdit(idx, val) {
  if (editingState.type !== 'assessment' || editingState.idx !== idx) return;
  editingState = { type: null, idx: null };
  const trimmed = val.trim();
  if (trimmed) {
    currentAssessment[idx] = trimmed;
  } else {
    currentAssessment.splice(idx, 1);
  }
  renderAssessmentBadges();
}

function renderAssessmentBadges() {
  const container = document.getElementById('assessment-badges-container');
  if (currentAssessment.length === 0) {
    container.innerHTML = `<span class="text-xs text-slate-400 italic">No assessment methods added yet.</span>`;
    return;
  }
  container.innerHTML = currentAssessment.map((item, idx) => {
    if (editingState.type === 'assessment' && editingState.idx === idx) {
      return `
        <span class="inline-flex items-center gap-1 px-1.5 py-0.5 bg-purple-50 border border-purple-300 rounded-md">
          <input type="text" id="active-edit-input" value="${escapeHtml(item)}"
                 class="px-1.5 py-0.5 text-xs border border-purple-300 rounded bg-white text-slate-800 focus:outline-none focus:ring-1 focus:ring-purple-500"
                 onkeydown="if(event.key==='Enter'){ event.preventDefault(); saveAssessmentEdit(${idx}, this.value); }"
                 onblur="saveAssessmentEdit(${idx}, this.value)">
        </span>
      `;
    }
    return `
      <span class="inline-flex items-center gap-1.5 px-2.5 py-1 bg-purple-50 text-purple-800 border border-purple-200 rounded-md text-xs font-medium shadow-sm">
        <span class="cursor-pointer hover:underline" onclick="editAssessmentItem(event, ${idx})" title="Click to edit">📊 ${escapeHtml(item)}</span>
        <button type="button" onclick="removeAssessmentItem(${idx})" class="text-purple-400 hover:text-red-600 font-bold text-sm leading-none">&times;</button>
      </span>
    `;
  }).join('');

  if (editingState.type === 'assessment') {
    setTimeout(() => {
      const input = document.getElementById('active-edit-input');
      if (input) { input.focus(); input.select(); }
    }, 20);
  }
}

function removeAssessmentItem(idx) {
  currentAssessment.splice(idx, 1);
  renderAssessmentBadges();
}

// --- Materials Editing & Rendering ---
function editMaterialTextItem(e, idx) {
  if (e) e.stopPropagation();
  editingState = { type: 'material', idx };
  renderMaterialsBadges();
}

function saveMaterialTextEdit(idx, val) {
  if (editingState.type !== 'material' || editingState.idx !== idx) return;
  editingState = { type: null, idx: null };
  const trimmed = val.trim();
  if (trimmed) {
    currentMaterialsText[idx] = trimmed;
  } else {
    currentMaterialsText.splice(idx, 1);
  }
  renderMaterialsBadges();
}

function renderMaterialsBadges() {
  const container = document.getElementById('materials-badges-container');
  if (currentMaterialsText.length === 0 && attachedLinks.length === 0) {
    container.innerHTML = `<span class="text-xs text-slate-400 italic">No materials or web links added yet.</span>`;
    return;
  }

  let html = '';

  html += currentMaterialsText.map((item, idx) => {
    if (editingState.type === 'material' && editingState.idx === idx) {
      return `
        <span class="inline-flex items-center gap-1 px-1.5 py-0.5 bg-emerald-50 border border-emerald-300 rounded-md">
          <input type="text" id="active-edit-input" value="${escapeHtml(item)}"
                 class="px-1.5 py-0.5 text-xs border border-emerald-300 rounded bg-white text-slate-800 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                 onkeydown="if(event.key==='Enter'){ event.preventDefault(); saveMaterialTextEdit(${idx}, this.value); }"
                 onblur="saveMaterialTextEdit(${idx}, this.value)">
        </span>
      `;
    }
    return `
      <span class="inline-flex items-center gap-1.5 px-2.5 py-1 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-md text-xs font-medium shadow-sm">
        <span class="cursor-pointer hover:underline" onclick="editMaterialTextItem(event, ${idx})" title="Click to edit">📦 ${escapeHtml(item)}</span>
        <button type="button" onclick="removeMaterialTextItem(${idx})" class="text-emerald-400 hover:text-red-600 font-bold text-sm leading-none">&times;</button>
      </span>
    `;
  }).join('');

  html += attachedLinks.map((item, idx) => `
    <span class="inline-flex items-center gap-1.5 px-2.5 py-1 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-md text-xs font-semibold shadow-sm">
      <a href="${escapeHtml(item.url)}" target="_blank" rel="noopener noreferrer" class="hover:underline flex items-center gap-1">
        🔗 <span>${escapeHtml(item.title)}</span> ↗
      </a>
      <button type="button" onclick="removeAttachedLink(${idx})" class="text-indigo-400 hover:text-red-600 font-bold text-sm leading-none">&times;</button>
    </span>
  `).join('');

  container.innerHTML = html;

  if (editingState.type === 'material') {
    setTimeout(() => {
      const input = document.getElementById('active-edit-input');
      if (input) { input.focus(); input.select(); }
    }, 20);
  }
}

function removeMaterialTextItem(idx) {
  currentMaterialsText.splice(idx, 1);
  renderMaterialsBadges();
}

function removeAttachedLink(idx) {
  attachedLinks.splice(idx, 1);
  renderMaterialsBadges();
}

// --- Procedure Drag-and-Drop & Inline Editing ---
function handleDragStart(e, idx) {
  if (editingState.type === 'procedure') return;
  draggedStepIndex = idx;
  e.dataTransfer.effectAllowed = 'move';
  e.dataTransfer.setData('text/plain', String(idx));
  e.currentTarget.classList.add('opacity-40');
}

function handleDragOver(e) {
  e.preventDefault();
  e.dataTransfer.dropEffect = 'move';
}

function handleDrop(e, targetIdx) {
  e.preventDefault();
  e.stopPropagation();
  if (draggedStepIndex === null || draggedStepIndex === targetIdx) return;

  const [movedItem] = currentProcedure.splice(draggedStepIndex, 1);
  if (movedItem) {
    currentProcedure.splice(targetIdx, 0, movedItem);
  }
  draggedStepIndex = null;
  renderProcedureChecklist();
}

function handleDragEnd(e) {
  e.currentTarget.classList.remove('opacity-40');
  draggedStepIndex = null;
}

function editProcedureStep(e, idx) {
  if (e) e.stopPropagation();
  editingState = { type: 'procedure', idx };
  renderProcedureChecklist();
}

function saveProcedureEdit(idx, val) {
  if (editingState.type !== 'procedure' || editingState.idx !== idx) return;
  editingState = { type: null, idx: null };
  const trimmed = val.trim();
  if (trimmed) {
    currentProcedure[idx].text = trimmed;
  } else {
    currentProcedure.splice(idx, 1);
  }
  renderProcedureChecklist();
}

function renderProcedureChecklist() {
  const container = document.getElementById('procedure-checklist-container');
  const countBadge = document.getElementById('procedure-count-badge');

  const completedCount = currentProcedure.filter(p => p && p.completed).length;
  countBadge.innerText = `${completedCount}/${currentProcedure.length} completed`;

  if (currentProcedure.length === 0) {
    container.innerHTML = `<p class="text-xs text-slate-400 italic py-4 text-center border-2 border-dashed border-slate-200 rounded-lg">No procedure steps added yet. Type a step above and press Enter.</p>`;
    return;
  }

  container.innerHTML = currentProcedure.map((step, idx) => {
    if (!step) return '';
    if (editingState.type === 'procedure' && editingState.idx === idx) {
      return `
        <div class="flex items-center justify-between p-2.5 bg-indigo-50/50 border border-indigo-300 rounded-md shadow-sm">
          <div class="flex items-center gap-2 flex-1 pr-2">
            <span class="font-bold text-slate-400 text-xs">${idx + 1}.</span>
            <input type="text" id="active-edit-input" value="${escapeHtml(step.text)}"
                   class="w-full p-1 text-xs border border-indigo-300 rounded bg-white text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                   onkeydown="if(event.key==='Enter'){ event.preventDefault(); saveProcedureEdit(${idx}, this.value); }"
                   onblur="saveProcedureEdit(${idx}, this.value)">
          </div>
        </div>
      `;
    }
    return `
      <div draggable="true"
           ondragstart="handleDragStart(event, ${idx})"
           ondragover="handleDragOver(event)"
           ondrop="handleDrop(event, ${idx})"
           ondragend="handleDragEnd(event)"
           class="flex items-center justify-between p-2.5 ${step.completed ? 'bg-slate-100/70 border-slate-200' : 'bg-white border-slate-200'} border rounded-md shadow-sm transition-all group hover:border-indigo-200">
        <div class="flex items-center gap-2 min-w-0 flex-1 pr-2">
          <span class="cursor-grab active:cursor-grabbing text-slate-300 hover:text-slate-600 font-bold select-none text-xs px-0.5" title="Drag to reorder step">⠿</span>
          <input type="checkbox" ${step.completed ? 'checked' : ''} onchange="toggleProcedureStep(${idx})"
                 class="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer flex-shrink-0">
          <span class="text-xs font-medium ${step.completed ? 'line-through text-slate-400' : 'text-slate-800'} break-words cursor-pointer hover:underline flex-1"
                onclick="editProcedureStep(event, ${idx})" title="Click to edit step">
            <span class="font-bold text-slate-400 mr-1">${idx + 1}.</span>${escapeHtml(step.text)}
          </span>
        </div>
        <button type="button" onclick="removeProcedureStep(${idx})" class="text-slate-300 hover:text-red-500 font-bold text-sm px-1 transition-colors" title="Delete step">&times;</button>
      </div>
    `;
  }).join('');

  if (editingState.type === 'procedure') {
    setTimeout(() => {
      const input = document.getElementById('active-edit-input');
      if (input) { input.focus(); input.select(); }
    }, 20);
  }
}

function toggleProcedureStep(idx) {
  if (currentProcedure[idx]) {
    currentProcedure[idx].completed = !currentProcedure[idx].completed;
    renderProcedureChecklist();
  }
}

function removeProcedureStep(idx) {
  currentProcedure.splice(idx, 1);
  renderProcedureChecklist();
}

// Bind functions to window so inline HTML attributes can invoke them globally
window.editObjectiveItem = editObjectiveItem;
window.saveObjectiveEdit = saveObjectiveEdit;
window.removeObjectiveItem = removeObjectiveItem;

window.editAssessmentItem = editAssessmentItem;
window.saveAssessmentEdit = saveAssessmentEdit;
window.removeAssessmentItem = removeAssessmentItem;

window.editMaterialTextItem = editMaterialTextItem;
window.saveMaterialTextEdit = saveMaterialTextEdit;
window.removeMaterialTextItem = removeMaterialTextItem;

window.editProcedureStep = editProcedureStep;
window.saveProcedureEdit = saveProcedureEdit;
window.removeProcedureStep = removeProcedureStep;

window.handleDragStart = handleDragStart;
window.handleDragOver = handleDragOver;
window.handleDrop = handleDrop;
window.handleDragEnd = handleDragEnd;

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

  currentObjectives = [];
  currentAssessment = [];
  currentMaterialsText = [];
  attachedLinks = [];
  currentProcedure = [];
  editingState = { type: null, idx: null };

  renderObjectivesBadges();
  renderAssessmentBadges();
  renderMaterialsBadges();
  renderProcedureChecklist();

  document.getElementById('inline-link-box').classList.add('hidden');

  selectedDupDates = [];
  miniCalCurrentDate = new Date();
  renderMiniCalendar();
  renderDupDatesList();

  currentEditingLessonId = null;
  updateModalNavControls();

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

  currentObjectives = parseListField(lesson.objectives);
  currentAssessment = parseListField(lesson.assessment);
  currentProcedure = parseProcedureField(lesson.procedure);

  const parsedMat = parseMaterialsField(lesson.materials);
  currentMaterialsText = parsedMat.textList;
  attachedLinks = parsedMat.links;
  editingState = { type: null, idx: null };

  renderObjectivesBadges();
  renderAssessmentBadges();
  renderMaterialsBadges();
  renderProcedureChecklist();

  document.getElementById('inline-link-box').classList.add('hidden');

  selectedDupDates = [];
  miniCalCurrentDate = new Date();
  renderMiniCalendar();
  renderDupDatesList();

  currentEditingLessonId = lesson.id;
  updateModalNavControls();

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

  // Auto-convert '--' to '–' (en-dash) and '---' to '—' (em-dash) in input fields
  if (modal) {
    modal.addEventListener('input', (e) => {
      const target = e.target;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') {
        const val = target.value;
        const cursorPos = target.selectionStart;

        if (val.includes('---')) {
          target.value = val.replace(/---/g, '—');
          if (cursorPos !== null) target.setSelectionRange(cursorPos - 2, cursorPos - 2);
        } else if (val.includes('--')) {
          target.value = val.replace(/--/g, '–');
          if (cursorPos !== null) target.setSelectionRange(cursorPos - 1, cursorPos - 1);
        }
      }
    });
  }

  // Navigation Button Handlers
  const prevBtn = document.getElementById('prev-lesson-btn');
  if (prevBtn) prevBtn.onclick = () => navigateLesson(-1);

  const nextBtn = document.getElementById('next-lesson-btn');
  if (nextBtn) nextBtn.onclick = () => navigateLesson(1);

  // Keyboard Arrow Hotkeys
  document.addEventListener('keydown', async (e) => {
    const modalEl = document.getElementById('lesson-modal');
    if (!modalEl || modalEl.classList.contains('hidden')) return;

    const activeTag = document.activeElement ? document.activeElement.tagName.toLowerCase() : '';
    if (activeTag === 'input' || activeTag === 'textarea' || activeTag === 'select') return;

    if (e.key === 'ArrowLeft') {
      e.preventDefault();
      await navigateLesson(-1);
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      await navigateLesson(1);
    }
  });

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

  document.getElementById('duplicate-btn').onclick = () => {
    const panel = document.getElementById('duplicate-panel');
    panel.classList.toggle('hidden');
  };

  // Duplication Logic
  document.getElementById('confirm-dup-btn').onclick = async () => {
    commitPendingInputs();

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
      objectives: currentObjectives,
      procedure: currentProcedure,
      assessment: currentAssessment,
      materials: { textList: currentMaterialsText, links: attachedLinks },
      status: 'Scheduled'
    };

    modal.classList.add('hidden');
    updateStatus(`Duplicating plan to ${selectedDupDates.length} date(s)...`);

    try {
      const payloads = selectedDupDates.map((targetDate, i) => ({
        ...basePayload,
        id: 'lp_' + Date.now() + '_' + i,
        date: targetDate
      }));

      const { error } = await supabaseClient.from('lessons').upsert(payloads);
      if (error) throw error;

      await loadLessons();
      updateStatus('Duplication complete! All changes synced');
    } catch (err) {
      console.error(err);
      updateStatus('Error duplicating plan', true);
    }
  };

  // Save / Save & Close Logic
  form.onsubmit = async (e) => {
    e.preventDefault();
    commitPendingInputs();

    const isSaveAndClose = e.submitter ? e.submitter.id === 'save-close-btn' : true;

    const currentSortOrder = getLessonSortOrder(lessonsData.find(l => String(l.id) === String(document.getElementById('lesson-id').value)) || {});

    const payload = {
      id: document.getElementById('lesson-id').value,
      title: document.getElementById('lesson-title').value,
      subject: document.getElementById('lesson-subject').value,
      grade: document.getElementById('lesson-grade').value,
      date: document.getElementById('lesson-date').value,
      startTime: document.getElementById('lesson-start').value,
      endTime: document.getElementById('lesson-end').value,
      objectives: currentObjectives,
      procedure: currentProcedure,
      assessment: currentAssessment,
      materials: { textList: currentMaterialsText, links: attachedLinks, sortOrder: currentSortOrder },
      status: 'Scheduled'
    };

    if (isSaveAndClose) {
      modal.classList.add('hidden');
    }
    updateStatus('Saving to Supabase...');

    try {
      const { error } = await supabaseClient.from('lessons').upsert(payload);
      if (error) throw error;

      await loadLessons();
      if (!isSaveAndClose) {
        updateStatus('Lesson saved successfully');
      }
    } catch (err) {
      console.error(err);
      updateStatus('Error saving plan', true);
    }
  };

  // Delete Logic
  document.getElementById('delete-btn').onclick = () => {
    const id = document.getElementById('lesson-id').value;
    showConfirmModal(
      'Delete Lesson Plan?',
      'Are you sure you want to delete this lesson plan from your schedule?',
      async () => {
        modal.classList.add('hidden');
        updateStatus('Deleting plan...');
        try {
          const { error } = await supabaseClient.from('lessons').delete().eq('id', id);
          if (error) throw error;

          await loadLessons();
        } catch (err) {
          console.error(err);
          updateStatus('Error deleting plan', true);
        }
      }
    );
  };

  document.getElementById('confirm-cancel-btn').onclick = hideConfirmModal;
  document.getElementById('confirm-action-btn').onclick = () => {
    if (confirmCallback) confirmCallback();
    hideConfirmModal();
  };

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
        ? notes.map(n => `<span class="px-1.5 py-0.5 bg-amber-100 text-amber-800 border border-amber-300 rounded font-semibold text-[11px] shadow-sm">\${escapeHtml(n)}</span>`).join('')
        : `<span class="text-slate-300 group-hover:text-indigo-600 text-[11px] font-normal">+ Add note</span>`
      }
        </div>
      </td>
    `;
  });

  trEl.innerHTML = html;
}

function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}