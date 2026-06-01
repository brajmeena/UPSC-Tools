/**
 * UPSC QCAB Generator — app.js
 * Modular, no-framework, no-build-tool vanilla JS
 * Questions embedded directly — works with file:// and GitHub Pages
 */

'use strict';

/* ============================================================
   SECTION 2: STATE
   ============================================================ */
const State = {
  allQuestions:      [],
  filteredQuestions: [],
  selectedIds:       new Set(),
  currentMode:       'pyq',
  customParsed:      [],

  get selectedQuestions() {
    return this.allQuestions.filter(q => this.selectedIds.has(q.id));
  },
  get selectedCount()  { return this.selectedIds.size; },
  get selectedMarks()  {
    return this.selectedQuestions.reduce((s, q) => s + q.marks, 0);
  }
};

/* ============================================================
   SECTION 3: DATA LAYER — now uses embedded data, no fetch
   ============================================================ */
const DataLayer = (() => {

  async function loadQuestions() {
    try {
      const res = await fetch('./data/questions.json');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      State.allQuestions = data;
      State.filteredQuestions = [...data];
      return data;
    } catch (err) {
      console.error('Failed to load questions.json:', err);
      Utils.showToast('Could not load questions database.', 'error');
      State.allQuestions = [];
      State.filteredQuestions = [];
      return [];
    }
  }


  function getUniqueValues(field) {
    return [...new Set(State.allQuestions.map(q => q[field]).filter(v => v !== undefined && v !== null && v !== ''))]
      .sort((a, b) => typeof a === 'number' ? b - a : String(a).localeCompare(String(b)));
  }

  return { loadQuestions, getUniqueValues };
})();

/* ============================================================
   SECTION 4: DOM REFERENCES
   ============================================================ */
const DOM = {
  tabPyq:            () => document.getElementById('tab-pyq'),
  tabCustom:         () => document.getElementById('tab-custom'),
  panelPyq:          () => document.getElementById('panel-pyq'),
  panelCustom:       () => document.getElementById('panel-custom'),

  filterYear:        () => document.getElementById('filter-year'),
  filterPaper:       () => document.getElementById('filter-paper'),
  filterSubject:     () => document.getElementById('filter-subject'),
  filterSubtopic:    () => document.getElementById('filter-subtopic'),
  filterSearch:      () => document.getElementById('filter-search'),
  btnApply:          () => document.getElementById('btn-apply-filter'),
  btnReset:          () => document.getElementById('btn-reset-filter'),
  filterCount:       () => document.getElementById('filter-count'),

  selectedBar:       () => document.getElementById('selected-bar'),
  selectedCount:     () => document.getElementById('selected-count'),
  selectedMarks:     () => document.getElementById('selected-marks'),
  btnClearSel:       () => document.getElementById('btn-clear-selection'),
  btnGeneratePyq:    () => document.getElementById('btn-generate-pyq'),

  tbody:             () => document.getElementById('question-tbody'),
  selectAll:         () => document.getElementById('select-all'),

  customInput:       () => document.getElementById('custom-input'),
  textareaCounter:   () => document.getElementById('textarea-counter'),
  btnParsePreview:   () => document.getElementById('btn-parse-preview'),
  btnGenerateCustom: () => document.getElementById('btn-generate-custom'),
  customPreview:     () => document.getElementById('custom-preview'),
  previewList:       () => document.getElementById('preview-list'),
  customError:       () => document.getElementById('custom-error'),

  pdfModal:          () => document.getElementById('pdf-modal'),
  modalClose:        () => document.getElementById('modal-close'),
  modalCancel:       () => document.getElementById('modal-cancel'),
  modalConfirm:      () => document.getElementById('modal-confirm'),
  pdfFooterCode:     () => document.getElementById('pdf-footer-code'),
  pdfTitleInput:     () => document.getElementById('pdf-title'),
  modalSummary:      () => document.getElementById('modal-summary'),

  toast:             () => document.getElementById('toast')
};

/* ============================================================
   SECTION 5: UTILITIES
   ============================================================ */
const Utils = (() => {
  let toastTimer = null;

  function showToast(message, type = 'default') {
    const el = DOM.toast();
    el.textContent = message;
    el.className = `toast toast--${type}`;
    el.classList.remove('hidden');
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.add('hidden'), 3200);
  }

  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  return { showToast, escapeHtml };
})();

/* ============================================================
   SECTION 6: FILTERS
   ============================================================ */
const Filters = (() => {

  function populateSelect(selectEl, values, placeholder) {
    selectEl.innerHTML = `<option value="">${placeholder}</option>`;
    values.forEach(v => {
      const opt = document.createElement('option');
      opt.value = v;
      opt.textContent = v;
      selectEl.appendChild(opt);
    });
  }

  function initFilterDropdowns() {
    populateSelect(DOM.filterYear(),     DataLayer.getUniqueValues('year'),     'All Years');
    populateSelect(DOM.filterPaper(),    DataLayer.getUniqueValues('paper'),    'All Papers');
    populateSelect(DOM.filterSubject(),  DataLayer.getUniqueValues('subject'),  'All Subjects');
    populateSelect(DOM.filterSubtopic(), DataLayer.getUniqueValues('subtopic'), 'All Subtopics');
  }

  function getFilterValues() {
    return {
      year:     DOM.filterYear().value,
      paper:    DOM.filterPaper().value,
      subject:  DOM.filterSubject().value,
      subtopic: DOM.filterSubtopic().value,
      search:   DOM.filterSearch().value.trim().toLowerCase()
    };
  }

  function applyFilters() {
    const f = getFilterValues();
    State.filteredQuestions = State.allQuestions.filter(q => {
      if (f.year     && String(q.year) !== f.year)    return false;
      if (f.paper    && q.paper        !== f.paper)   return false;
      if (f.subject  && q.subject      !== f.subject) return false;
      if (f.subtopic && q.subtopic     !== f.subtopic)return false;
      if (f.search) {
        const haystack = [
          q.question, q.paper, q.subject, q.subtopic,
          String(q.year), ...(q.keywords || [])
        ].join(' ').toLowerCase();
        if (!haystack.includes(f.search)) return false;
      }
      return true;
    });
    Table.render();
    updateFilterCount();
  }

  function resetFilters() {
    DOM.filterYear().value     = '';
    DOM.filterPaper().value    = '';
    DOM.filterSubject().value  = '';
    DOM.filterSubtopic().value = '';
    DOM.filterSearch().value   = '';
    State.filteredQuestions = [...State.allQuestions];
    Table.render();
    updateFilterCount();
  }

  function updateFilterCount() {
    DOM.filterCount().textContent =
      `${State.filteredQuestions.length} of ${State.allQuestions.length} questions`;
  }

  return { initFilterDropdowns, applyFilters, resetFilters, updateFilterCount };
})();

/* ============================================================
   SECTION 7: TABLE — Render & Selection
   ============================================================ */
const Table = (() => {

  function render() {
    const tbody = DOM.tbody();
    tbody.innerHTML = '';

    if (State.filteredQuestions.length === 0) {
      tbody.innerHTML = '<tr class="empty-row"><td colspan="6">No questions match your filters. Try adjusting or resetting.</td></tr>';
      syncSelectAll();
      return;
    }

    const fragment = document.createDocumentFragment();
    State.filteredQuestions.forEach(q => fragment.appendChild(buildRow(q)));
    tbody.appendChild(fragment);
    syncSelectAll();
  }

  function buildRow(q) {
    const tr = document.createElement('tr');
    tr.dataset.id = q.id;
    if (State.selectedIds.has(q.id)) tr.classList.add('row--selected');

    tr.innerHTML = `
      <td class="col-check">
        <label class="checkbox-wrapper">
          <input type="checkbox" class="row-checkbox" data-id="${q.id}" ${State.selectedIds.has(q.id) ? 'checked' : ''} />
          <span class="checkmark"></span>
        </label>
      </td>
      <td class="col-year"><span class="tag tag--year">${q.year}</span></td>
      <td class="col-paper"><span class="tag tag--paper">${Utils.escapeHtml(q.paper)}</span></td>
      <td class="col-subject" style="font-size:0.8rem;color:var(--ink-muted);">${Utils.escapeHtml(q.subject || '')}</td>
      <td class="col-question"><span class="question-text">${Utils.escapeHtml(q.question)}</span></td>
      <td class="col-marks"><span class="tag tag--marks">${q.marks}</span></td>
    `;

    tr.querySelector('.row-checkbox').addEventListener('change', e => {
      toggleRow(q.id, e.target.checked);
    });

    // Click on row (not on checkbox/label) also toggles
    tr.addEventListener('click', e => {
      if (e.target.classList.contains('row-checkbox') ||
          e.target.classList.contains('checkmark') ||
          e.target.closest('label')) return;
      const cb = tr.querySelector('.row-checkbox');
      cb.checked = !cb.checked;
      toggleRow(q.id, cb.checked);
    });

    return tr;
  }

  function toggleRow(id, checked) {
    if (checked) State.selectedIds.add(id);
    else          State.selectedIds.delete(id);
    const tr = DOM.tbody().querySelector(`tr[data-id="${id}"]`);
    if (tr) tr.classList.toggle('row--selected', checked);
    syncSelectAll();
    updateSelectedBar();
  }

  function syncSelectAll() {
    const cb = DOM.selectAll();
    const visibleIds       = State.filteredQuestions.map(q => q.id);
    const selectedVisible  = visibleIds.filter(id => State.selectedIds.has(id));

    if (selectedVisible.length === 0) {
      cb.checked = false; cb.indeterminate = false;
    } else if (selectedVisible.length === visibleIds.length) {
      cb.checked = true;  cb.indeterminate = false;
    } else {
      cb.checked = false; cb.indeterminate = true;
    }
  }

  function handleSelectAll(checked) {
    State.filteredQuestions.forEach(q => {
      if (checked) State.selectedIds.add(q.id);
      else          State.selectedIds.delete(q.id);
    });
    render();
    updateSelectedBar();
  }

  function updateSelectedBar() {
    const count = State.selectedCount;
    DOM.selectedCount().textContent = `${count} question${count !== 1 ? 's' : ''} selected`;
    DOM.selectedMarks().textContent = count > 0 ? `${State.selectedMarks} total marks` : '';
    DOM.selectedBar().style.opacity = count > 0 ? '1' : '0.7';
  }

  function clearSelection() {
    State.selectedIds.clear();
    render();
    updateSelectedBar();
  }

  return { render, updateSelectedBar, clearSelection, handleSelectAll };
})();

/* ============================================================
   SECTION 8: CUSTOM QUESTION PARSER
   ============================================================ */
const CustomParser = (() => {

  // Accepts: Q1. text [15] | Q1. text (15) | 1. text 15 marks | Q1. text 15
  const PATTERN =
    /^(?:Q\s*)?(\d+)[.)]\s*(.+?)\s*[\[(](\d+)[\])][.)?\s]*$|^(?:Q\s*)?(\d+)[.)]\s*(.+?)\s+(\d+)\s*(?:marks?)?\s*\.?\s*$/i;

  function parse(rawText) {
    if (!rawText) return [];
    const lines = rawText.split('\n').map(l => l.trim()).filter(Boolean);
    const questions = [];

    lines.forEach((line, idx) => {
      const m = line.match(PATTERN);
      if (m) {
        const qno  = m[1] || m[4];
        const text = (m[2] || m[5] || '').trim().replace(/\s*[\[(]\d+[\])]\s*$/, '').trim();
        const mks  = parseInt(m[3] || m[6], 10);
        if (text && mks && mks > 0 && mks <= 250) {
          questions.push({
            id:       `custom_${idx}`,
            qno:      `Q${qno}`,
            question: text,
            marks:    mks,
            paper:    'Custom',
            year:     new Date().getFullYear(),
            subject:  'Custom',
            subtopic: ''
          });
        }
      }
    });

    return questions;
  }

  function countDetected(rawText) {
    return parse(rawText).length;
  }

  return { parse, countDetected };
})();

/* ============================================================
   SECTION 9: PDF GENERATOR
   ============================================================ */
const PDFGenerator = (() => {

  const PAGE_W           = 210;
  const PAGE_H           = 297;
  const MARGIN_LEFT_OUTER = 10;
  const MARGIN_LEFT_LINE  = 22;
  const MARGIN_LEFT_TEXT  = 24;
  const MARGIN_RIGHT_LINE = 186;
  const MARGIN_TOP        = 20;
  const MARGIN_BOTTOM     = 18;
  const RIGHT_NOTE_X      = 188;

  function pagesForMarks(marks) {
    if (marks <= 10) return 2;
    if (marks <= 15) return 3;
    if (marks <= 20) return 4;
    return Math.ceil(marks / 5) + 1;
  }

  function drawPageFrame(doc) {
    doc.setDrawColor(100, 100, 100);
    doc.setLineWidth(0.3);
    doc.line(MARGIN_LEFT_LINE,  MARGIN_TOP - 5, MARGIN_LEFT_LINE,  PAGE_H - MARGIN_BOTTOM);
    doc.line(MARGIN_RIGHT_LINE, MARGIN_TOP - 5, MARGIN_RIGHT_LINE, PAGE_H - MARGIN_BOTTOM);
  }

  function drawRightMarginNote(doc) {
    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(80, 80, 80);
    const noteLines = ['Candidates', 'must not', 'write on', 'this margin'];
    let y = MARGIN_TOP + 2;
    noteLines.forEach(line => { doc.text(line, RIGHT_NOTE_X + 1, y); y += 4; });
    doc.setTextColor(0, 0, 0);
  }

  function drawFooter(doc, footerCode, pageNum) {
    const footerY = PAGE_H - 8;
    doc.setFontSize(8.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(0, 0, 0);
    doc.text(footerCode, MARGIN_LEFT_TEXT, footerY);
    doc.text(String(pageNum), PAGE_W / 2, footerY, { align: 'center' });
  }

  function drawQuestionPage(doc, questionText, qSeqNum, marksText, footerCode, pageNum) {
    drawPageFrame(doc);
    drawRightMarginNote(doc);

    const textAreaWidth = MARGIN_RIGHT_LINE - MARGIN_LEFT_TEXT - 22;

    // Q number outside margin
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(0, 0, 0);
    doc.text(`Q${qSeqNum}.`, MARGIN_LEFT_OUTER, MARGIN_TOP + 5);

    // Question text
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10.5);
    const lines = doc.splitTextToSize(questionText, textAreaWidth);
    let y = MARGIN_TOP + 5;
    lines.forEach(line => { doc.text(line, MARGIN_LEFT_TEXT, y); y += 6; });

    // Marks — right-aligned, same level as first text line
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.text(marksText, MARGIN_RIGHT_LINE - 2, MARGIN_TOP + 5, { align: 'right' });

    drawFooter(doc, footerCode, pageNum);
  }

  function drawAnswerPage(doc, footerCode, pageNum) {
    drawPageFrame(doc);
    drawRightMarginNote(doc);
    drawFooter(doc, footerCode, pageNum);
  }

  function generate(questions, footerCode, titleNote) {
    if (!questions || questions.length === 0) {
      Utils.showToast('No questions to generate.', 'error');
      return;
    }

    try {
      const { jsPDF } = window.jspdf;
      const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      const code = footerCode || 'XXX-X-GS/0000';

      let pdfPageNumber = 1;
      let firstPage     = true;

      questions.forEach((q, index) => {
        const totalPgs = pagesForMarks(q.marks);

        if (!firstPage) doc.addPage();
        firstPage = false;

        drawQuestionPage(doc, q.question, index + 1, String(q.marks), code, pdfPageNumber);
        pdfPageNumber++;

        for (let i = 1; i < totalPgs; i++) {
          doc.addPage();
          drawAnswerPage(doc, code, pdfPageNumber);
          pdfPageNumber++;
        }
      });

      const filename = titleNote
        ? `QCAB_${titleNote.replace(/[^a-z0-9]/gi, '_')}.pdf`
        : `QCAB_${Date.now()}.pdf`;

      doc.save(filename);
      Utils.showToast('PDF generated successfully!', 'success');
    } catch (err) {
      console.error('PDF generation error:', err);
      Utils.showToast('PDF generation failed. Check console for details.', 'error');
    }
  }

  return { generate };
})();

/* ============================================================
   SECTION 10: MODAL CONTROLLER
   ============================================================ */
const Modal = (() => {
  let _pendingQuestions = null;

  function open(questions) {
    _pendingQuestions = questions;

    const totalMarks = questions.reduce((s, q) => s + q.marks, 0);
    const totalPages = questions.reduce((s, q) => {
      if (q.marks <= 10) return s + 2;
      if (q.marks <= 15) return s + 3;
      if (q.marks <= 20) return s + 4;
      return s + Math.ceil(q.marks / 5) + 1;
    }, 0);

    DOM.modalSummary().innerHTML =
      `<strong>${questions.length}</strong> question${questions.length !== 1 ? 's' : ''} &nbsp;&middot;&nbsp; ` +
      `<strong>${totalMarks}</strong> total marks &nbsp;&middot;&nbsp; ` +
      `<strong>${totalPages}</strong> pages in PDF`;

    DOM.pdfModal().classList.remove('hidden');
  }

  function close() {
    DOM.pdfModal().classList.add('hidden');
    // NOTE: do NOT clear _pendingQuestions here — confirm() needs it
  }

  function confirm() {
    // Capture questions before closing modal
    const questionsToGenerate = _pendingQuestions;
    if (!questionsToGenerate || questionsToGenerate.length === 0) {
      Utils.showToast('No questions to generate.', 'error');
      return;
    }
    const code  = DOM.pdfFooterCode().value.trim() || 'XXX-X-GS/0000';
    const title = DOM.pdfTitleInput().value.trim();

    // Close modal first, then generate
    close();
    _pendingQuestions = null;
    PDFGenerator.generate(questionsToGenerate, code, title);
  }

  return { open, close, confirm };
})();

/* ============================================================
   SECTION 11: CUSTOM PANEL CONTROLLER
   ============================================================ */
const CustomPanel = (() => {

  function showError(msg) {
    const el = DOM.customError();
    el.textContent = msg;
    el.classList.remove('hidden');
  }

  function hideError() {
    DOM.customError().classList.add('hidden');
  }

  function updateCounter() {
    const count = CustomParser.countDetected(DOM.customInput().value);
    DOM.textareaCounter().textContent =
      count === 0 ? '0 questions detected'
                  : `${count} question${count !== 1 ? 's' : ''} detected`;
  }

  function renderPreview(questions) {
    const list = DOM.previewList();
    list.innerHTML = '';
    questions.forEach((q, i) => {
      const li = document.createElement('li');
      li.className = 'preview-item';
      li.innerHTML =
        `<span class="q-num">Q${i + 1}</span>` +
        `<span>${Utils.escapeHtml(q.question)}</span>` +
        `<span class="q-marks">${q.marks}M</span>`;
      list.appendChild(li);
    });
    DOM.customPreview().style.display = 'block';
  }

  function handlePreview() {
    hideError();
    const raw = DOM.customInput().value.trim();
    if (!raw) { showError('Please enter some questions first.'); return; }
    const parsed = CustomParser.parse(raw);
    if (parsed.length === 0) {
      showError('No valid questions found. Check the format — e.g. "Q1. Your question text. [15]"');
      return;
    }
    State.customParsed = parsed;
    renderPreview(parsed);
  }

  function handleGenerate() {
    hideError();
    const raw = DOM.customInput().value.trim();
    if (!raw) { showError('Please enter some questions first.'); return; }
    const parsed = CustomParser.parse(raw);
    if (parsed.length === 0) {
      showError('No valid questions found. Check the format — e.g. "Q1. Your question text. [15]"');
      return;
    }
    State.customParsed = parsed;
    Modal.open(parsed);
  }

  return { updateCounter, handlePreview, handleGenerate };
})();

/* ============================================================
   SECTION 12: MODE SWITCHER
   ============================================================ */
const ModeSwitcher = (() => {
  function switchTo(mode) {
    State.currentMode = mode;
    DOM.tabPyq().classList.toggle('active',      mode === 'pyq');
    DOM.tabCustom().classList.toggle('active',   mode === 'custom');
    DOM.panelPyq().classList.toggle('hidden',    mode !== 'pyq');
    DOM.panelCustom().classList.toggle('hidden', mode !== 'custom');
  }
  return { switchTo };
})();

/* ============================================================
   SECTION 13: EVENT BINDING
   ============================================================ */
const EventBinder = (() => {

  function bindAll() {
    DOM.tabPyq().addEventListener('click',    () => ModeSwitcher.switchTo('pyq'));
    DOM.tabCustom().addEventListener('click', () => ModeSwitcher.switchTo('custom'));

    DOM.btnApply().addEventListener('click', Filters.applyFilters);
    DOM.btnReset().addEventListener('click', Filters.resetFilters);
    DOM.filterSearch().addEventListener('keydown', e => {
      if (e.key === 'Enter') Filters.applyFilters();
    });

    DOM.selectAll().addEventListener('change', e => Table.handleSelectAll(e.target.checked));
    DOM.btnClearSel().addEventListener('click', Table.clearSelection);
    DOM.btnGeneratePyq().addEventListener('click', handleGeneratePyq);

    DOM.customInput().addEventListener('input',        CustomPanel.updateCounter);
    DOM.btnParsePreview().addEventListener('click',    CustomPanel.handlePreview);
    DOM.btnGenerateCustom().addEventListener('click',  CustomPanel.handleGenerate);

    DOM.modalClose().addEventListener('click',   Modal.close);
    DOM.modalCancel().addEventListener('click',  Modal.close);
    DOM.modalConfirm().addEventListener('click', Modal.confirm);
    DOM.pdfModal().addEventListener('click', e => {
      if (e.target === DOM.pdfModal()) Modal.close();
    });
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape') Modal.close();
    });
  }

  function handleGeneratePyq() {
    const selected = State.selectedQuestions;
    if (selected.length === 0) {
      Utils.showToast('Please select at least one question.', 'error');
      return;
    }
    Modal.open(selected);
  }

  return { bindAll };
})();

/* ============================================================
   SECTION 14: INIT
   ============================================================ */
function init() {
  DataLayer.loadQuestions();          // synchronous — uses embedded data
  Filters.initFilterDropdowns();
  Filters.updateFilterCount();
  Table.render();
  Table.updateSelectedBar();
  EventBinder.bindAll();
}

document.addEventListener('DOMContentLoaded', init);
