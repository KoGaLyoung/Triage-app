/**
 * App Controller — State machine, DOM controller, verification code generator
 * Manages the 5-step triage flow
 */

const App = (() => {
  'use strict';

  // ── State ──
  const state = {
    currentStep: 1,
    totalSteps: 5,
    disclaimerAccepted: false,
    ageGroup: null,          // 'adult' | 'pediatric'
    infantAge: null,         // 'under_3m' | '3m_3y' | 'over_3y' (for pediatric)
    pregnancy: false,
    patientInitials: '',
    patientIdLast4: '',
    chiefComplaint: null,
    answers: {},
    questionIndex: 0,
    triageResult: null,
    verificationCode: '',
    timestamp: null,
  };

  // ── Helpers ──
  function $(sel, parent) { return (parent || document).querySelector(sel); }
  function $$(sel, parent) { return [...(parent || document).querySelectorAll(sel)]; }

  function generateVerificationCode() {
    const now = new Date();
    const date = now.toISOString().slice(0, 10).replace(/-/g, '');
    const rand = Math.random().toString(36).substring(2, 6).toUpperCase();
    return `TTAS-${date}-${rand}`;
  }

  function generatePatientId() {
    const r = Math.random().toString(36).substring(2, 6).toUpperCase();
    return r;
  }

  // ── Screen Navigation ──
  function showScreen(step) {
    state.currentStep = step;
    $$('.screen').forEach(s => s.classList.remove('active'));
    const target = $(`#step${step}`);
    if (target) target.classList.add('active');
    updateProgress();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function updateProgress() {
    const pct = ((state.currentStep - 1) / (state.totalSteps - 1)) * 100;
    const fill = $('.progress-fill');
    if (fill) fill.style.width = pct + '%';

    $$('.step-dot').forEach((dot, i) => {
      dot.classList.remove('active', 'completed');
      if (i + 1 === state.currentStep) dot.classList.add('active');
      else if (i + 1 < state.currentStep) dot.classList.add('completed');
    });
  }

  // ── Step 1: Disclaimer ──
  function initStep1() {
    const disclaimerCheckbox = $('#disclaimer-check');
    const emergencyBtn = $('#emergency-call-btn');
    const nextBtn = $('#step1-next');

    disclaimerCheckbox.addEventListener('click', () => {
      state.disclaimerAccepted = !state.disclaimerAccepted;
      disclaimerCheckbox.classList.toggle('checked', state.disclaimerAccepted);
      nextBtn.disabled = !state.disclaimerAccepted;
    });

    nextBtn.addEventListener('click', () => {
      if (state.disclaimerAccepted) showScreen(2);
    });

    emergencyBtn.addEventListener('click', () => {
      window.location.href = 'tel:119';
    });
  }

  // ── Step 2: Basic Info ──
  function initStep2() {
    // Age group selection
    $$('#step2 .age-card').forEach(card => {
      card.addEventListener('click', () => {
        $$('#step2 .age-card').forEach(c => c.classList.remove('selected'));
        card.classList.add('selected');
        state.ageGroup = card.dataset.age;
        updateStep2Next();

        // Show pediatric sub-selector
        const pedsSub = $('#peds-age-sub');
        if (pedsSub) {
          pedsSub.style.display = state.ageGroup === 'pediatric' ? 'block' : 'none';
        }
      });
    });

    // Pediatric age sub-selector
    $$('#step2 .infant-age-card').forEach(card => {
      card.addEventListener('click', () => {
        $$('#step2 .infant-age-card').forEach(c => c.classList.remove('selected'));
        card.classList.add('selected');
        state.infantAge = card.dataset.age;
      });
    });

    // Pregnancy toggle
    const pregToggle = $('#pregnancy-toggle');
    if (pregToggle) {
      pregToggle.addEventListener('click', () => {
        state.pregnancy = !state.pregnancy;
        pregToggle.classList.toggle('active', state.pregnancy);
      });
    }

    // Patient initials
    const nameInput = $('#patient-name');
    if (nameInput) {
      nameInput.addEventListener('input', (e) => {
        state.patientInitials = e.target.value;
      });
    }

    // ID last 4 digits
    const idInput = $('#patient-id');
    if (idInput) {
      idInput.addEventListener('input', (e) => {
        state.patientIdLast4 = e.target.value.replace(/\D/g, '').slice(0, 4);
        e.target.value = state.patientIdLast4;
      });
    }

    // Next button
    $('#step2-next').addEventListener('click', () => {
      showScreen(3);
    });

    // Back button
    $('#step2-back').addEventListener('click', () => {
      showScreen(1);
    });
  }

  function updateStep2Next() {
    const btn = $('#step2-next');
    btn.disabled = !state.ageGroup;
  }

  // ── Step 3: Chief Complaint ──
  function initStep3() {
    renderChiefComplaints();

    $('#step3-back').addEventListener('click', () => {
      showScreen(2);
    });
  }

  function renderChiefComplaints() {
    const grid = $('#chief-complaint-grid');
    grid.innerHTML = '';

    QuestionsData.CHIEF_COMPLAINTS.forEach(cc => {
      const card = document.createElement('div');
      card.className = 'bento-card';
      card.dataset.complaint = cc.id;
      card.innerHTML = `
        <span class="card-icon">${cc.icon}</span>
        <span class="card-title">${cc.title}</span>
        <span class="card-desc">${cc.description}</span>
      `;
      card.addEventListener('click', () => {
        $$('#chief-complaint-grid .bento-card').forEach(c => c.classList.remove('selected'));
        card.classList.add('selected');
        state.chiefComplaint = cc.id;
        // Auto-advance to questions after short delay
        setTimeout(() => {
          state.answers = {
            _chiefComplaint: cc.id,
            isPediatric: state.ageGroup === 'pediatric',
            infantAge: state.infantAge,
          };
          state.questionIndex = 0;
          renderQuestion();
          showScreen(4);
        }, 200);
      });
      grid.appendChild(card);
    });
  }

  // ── Step 4: Dynamic Questioning ──
  function initStep4() {
    $('#step4-back').addEventListener('click', () => {
      showScreen(3);
    });
  }

  function getQuestionsForComplaint() {
    const flow = QuestionsData.QUESTION_FLOWS[state.chiefComplaint];
    if (!flow) return [];

    // Filter questions based on conditions
    return flow.filter(q => {
      if (q.condition) {
        return q.condition(state.answers);
      }
      return true;
    });
  }

  function renderQuestion() {
    const container = $('#question-container');
    const questions = getQuestionsForComplaint();

    if (state.questionIndex >= questions.length) {
      // All questions answered → evaluate and show result
      performTriage();
      return;
    }

    const q = questions[state.questionIndex];
    const progress = ((state.questionIndex) / questions.length) * 100;

    container.innerHTML = `
      <div class="question-progress" style="margin-bottom: 16px;">
        <div class="progress-bar">
          <div class="progress-fill" style="width: ${progress}%"></div>
        </div>
        <div class="text-xs" style="margin-top: 4px;">問題 ${state.questionIndex + 1} / ${questions.length}</div>
      </div>
      <div class="question-card animate-up">
        <div class="question-title">${q.prompt}</div>
        ${q.hint ? `<div class="text-xs" style="margin-bottom: 16px; color: var(--text-tertiary);">${q.hint}</div>` : ''}
        <div id="question-body"></div>
      </div>
      <div class="btn-row">
        <button class="btn btn-ghost" id="q-back-btn">← 上一步</button>
      </div>
    `;

    // Back button
    $('#q-back-btn').addEventListener('click', () => {
      if (state.questionIndex > 0) {
        state.questionIndex--;
        renderQuestion();
      } else {
        showScreen(3);
      }
    });

    const body = $('#question-body');

    switch (q.type) {
      case 'single':
        renderSingleChoice(body, q);
        break;
      case 'multi':
        renderMultiChoice(body, q);
        break;
      case 'stepper':
        renderStepper(body, q);
        break;
      case 'wheel':
        renderWheelInput(body, q);
        break;
    }
  }

  // ── Single choice ──
  function renderSingleChoice(container, q) {
    const currentValue = state.answers[q.mapsTo] ?? null;

    container.innerHTML = '';
    const grid = document.createElement('div');
    grid.className = 'bento-grid single-col';

    q.options.forEach(opt => {
      const card = document.createElement('div');
      card.className = 'bento-card full-width';
      if (currentValue === opt.value) card.classList.add('selected');
      card.innerHTML = `<span class="card-title" style="font-size: 0.9375rem;">${opt.label}</span>`;

      card.addEventListener('click', () => {
        // Remove previous selection
        grid.querySelectorAll('.bento-card').forEach(c => c.classList.remove('selected'));
        card.classList.add('selected');
        state.answers[q.mapsTo] = opt.value;

        // Haptic feedback
        if (navigator.vibrate) navigator.vibrate(10);

        // Auto-advance after short delay
        setTimeout(() => {
          state.questionIndex++;
          renderQuestion();
        }, 250);
      });

      grid.appendChild(card);
    });

    container.appendChild(grid);
  }

  // ── Multi choice ──
  function renderMultiChoice(container, q) {
    const currentValues = state.answers[q.mapsTo] || [];

    container.innerHTML = '';
    const row = document.createElement('div');
    row.className = 'pill-row';

    q.options.forEach(opt => {
      const pill = document.createElement('span');
      pill.className = 'pill';
      if (currentValues.includes(opt.value)) pill.classList.add('selected');
      pill.textContent = opt.label;

      pill.addEventListener('click', () => {
        pill.classList.toggle('selected');
        if (navigator.vibrate) navigator.vibrate(10);
      });

      row.appendChild(pill);
    });

    container.appendChild(row);

    // Confirm button
    const btn = document.createElement('button');
    btn.className = 'btn btn-primary';
    btn.textContent = '確認';
    btn.style.marginTop = '16px';
    btn.addEventListener('click', () => {
      const selected = [...row.querySelectorAll('.pill.selected')].map(p =>
        q.options.find(o => o.label === p.textContent)?.value
      ).filter(Boolean);
      state.answers[q.mapsTo] = selected;

      // Check if any high-risk mechanism was selected
      if (q.mapsTo === 'mechanism' && selected.length > 0) {
        state.answers.mechanism = selected[0]; // Take first for primary mechanism
      }

      state.questionIndex++;
      renderQuestion();
    });
    container.appendChild(btn);
  }

  // ── Stepper ──
  function renderStepper(container, q) {
    let value = state.answers[q.mapsTo] !== undefined ? state.answers[q.mapsTo] : (q.default ?? q.min);
    const min = q.min ?? 0;
    const max = q.max ?? 100;
    const step = q.step ?? 1;

    container.innerHTML = `
      <div class="stepper">
        <button class="stepper-btn" id="step-minus">−</button>
        <div>
          <span class="stepper-value" id="stepper-display">${value}</span>
          ${q.unit ? `<span class="stepper-unit">${q.unit}</span>` : ''}
        </div>
        <button class="stepper-btn" id="step-plus">+</button>
      </div>
      <button class="btn btn-primary" style="margin-top: 24px;" id="stepper-confirm">確認</button>
    `;

    const display = $('#stepper-display');

    const update = (delta) => {
      value = Math.round((value + delta) * 100) / 100;
      value = Math.max(min, Math.min(max, value));
      display.textContent = value;
      if (navigator.vibrate) navigator.vibrate(5);
    };

    $('#step-minus').addEventListener('click', () => update(-step));
    $('#step-plus').addEventListener('click', () => update(step));

    // Long press for rapid adjustment
    let pressTimer = null;
    let rapidTimer = null;
    const startRapid = (delta) => {
      pressTimer = setTimeout(() => {
        rapidTimer = setInterval(() => {
          update(delta);
          display.textContent = value;
        }, 80);
      }, 400);
    };
    const stopRapid = () => {
      if (pressTimer) clearTimeout(pressTimer);
      if (rapidTimer) clearInterval(rapidTimer);
    };

    $('#step-minus').addEventListener('mousedown', () => startRapid(-step));
    $('#step-minus').addEventListener('mouseup', stopRapid);
    $('#step-minus').addEventListener('mouseleave', stopRapid);
    $('#step-minus').addEventListener('touchstart', () => startRapid(-step), { passive: true });
    $('#step-minus').addEventListener('touchend', stopRapid);

    $('#step-plus').addEventListener('mousedown', () => startRapid(step));
    $('#step-plus').addEventListener('mouseup', stopRapid);
    $('#step-plus').addEventListener('mouseleave', stopRapid);
    $('#step-plus').addEventListener('touchstart', () => startRapid(step), { passive: true });
    $('#step-plus').addEventListener('touchend', stopRapid);

    $('#stepper-confirm').addEventListener('click', () => {
      state.answers[q.mapsTo] = value;
      state.questionIndex++;
      renderQuestion();
    });
  }

  // ── Wheel input ──
  function renderWheelInput(container, q) {
    const currentValue = state.answers[q.mapsTo] !== undefined ? state.answers[q.mapsTo] : (q.default ?? q.min);

    container.innerHTML = `
      <div class="wheel-picker-display" style="cursor: pointer;" id="wheel-trigger">
        <div class="wheel-picker-value" style="font-size: 2rem;">
          ${currentValue}<span class="wheel-picker-unit">${q.unit || ''}</span>
        </div>
        <div class="text-xs" style="margin-top: 8px; color: var(--text-tertiary);">點擊調整</div>
      </div>
      <button class="btn btn-primary" style="margin-top: 24px;" id="wheel-confirm">確認</button>
    `;

    let selectedValue = currentValue;

    $('#wheel-trigger').addEventListener('click', () => {
      WheelPicker.show({
        prompt: q.prompt,
        min: q.min,
        max: q.max,
        step: q.step,
        value: selectedValue,
        default: q.default,
        unit: q.unit,
        onDone: (val) => {
          selectedValue = val;
          const display = $('#wheel-trigger .wheel-picker-value');
          if (display) {
            display.innerHTML = `${val}<span class="wheel-picker-unit">${q.unit || ''}</span>`;
          }
        },
      });
    });

    $('#wheel-confirm').addEventListener('click', () => {
      state.answers[q.mapsTo] = selectedValue;
      state.questionIndex++;
      renderQuestion();
    });
  }

  // ── Step 5: Triage & Evaluate ──
  function performTriage() {
    const ttasInput = QuestionsData.buildTTASInput(
      state.answers,
      state.ageGroup,
      state.pregnancy
    );

    state.triageResult = TTAS.evaluate(ttasInput);
    state.verificationCode = generateVerificationCode();
    state.timestamp = new Date();

    renderCertificate();
    showScreen(5);
  }

  function initStep5() {
    // The print/reset buttons are dynamically created inside
    // renderCertificate(), which binds its own event handlers.
    // No static binding needed here — binding to non-existent
    // nodes would throw during init.
  }

  function renderCertificate() {
    const cert = $('#certificate-container');
    const r = state.triageResult;
    const ts = state.timestamp;

    const timeStr = ts.toLocaleTimeString('zh-TW', { hour12: false });
    const dateStr = ts.toLocaleDateString('zh-TW');
    const patientDisplay = state.patientInitials
      ? `${state.patientInitials}*`
      : '未填寫';
    const idDisplay = state.patientIdLast4
      ? `****${state.patientIdLast4}`
      : '****';

    const rec = r.recommendations;

    // Findings summary
    let findingsHTML = '';
    if (r.allFindings.length > 0) {
      findingsHTML = r.allFindings.map(f =>
        `<div style="margin-bottom: 6px;">
          <span style="color: var(--text-tertiary);">[${f.category}]</span>
          ${f.reason}
        </div>`
      ).join('');
    }

    // Safety net HTML
    let safetyHTML = '';
    if (r.safetyNet && r.safetyNet.length > 0) {
      safetyHTML = r.safetyNet.map(net => `
        <div class="safety-net">
          <div class="safety-net-title">${net.title}</div>
          <div class="safety-net-text">
            <div style="margin-bottom: 6px;">${net.text}</div>
            <ul style="padding-left: 18px; margin: 0;">
              ${net.signs.map(s => `<li style="margin-bottom: 4px;">${s}</li>`).join('')}
            </ul>
          </div>
        </div>
      `).join('');
    }

    // Emergency contacts
    let emergencyHTML = '';
    if (r.level <= 2) {
      emergencyHTML = `
        <a href="tel:119" class="phone-link">📞 立即撥打 119 救護車</a>
        <a href="tel:110" class="phone-link" style="margin-top: 8px;">🚔 警察局 110</a>
        ${state.chiefComplaint === 'mental' ? `
        <a href="tel:1925" class="phone-link" style="margin-top: 8px;">🧠 安心專線 1925（24 小時心理諮詢）</a>
        ` : ''}
      `;
    }

    // Diversion message
    let diversionHTML = '';
    if (rec.diversion) {
      diversionHTML = `
        <div class="alert-banner alert-green" style="margin-top: 16px;">
          <div style="font-weight: 600; margin-bottom: 8px;">📋 分流建議</div>
          <div class="text-sm" style="color: var(--text-secondary); line-height: 1.6;">
            依分級標準為輕症，<strong>不建議前往醫學中心急診</strong>。<br>
            急診將排至最後順位（候診時間可能達 3-5 小時以上）<br>
            並需自付最高額掛號與部分負擔費用。<br><br>
            ✅ 建議至<strong>鄰近基層診所</strong>或<strong>門診</strong>就醫。
          </div>
        </div>
      `;
    }

    cert.innerHTML = `
      <div class="certificate ${r.levelColor} animate-up">
        <div class="cert-header">
          <div class="cert-hash">${state.verificationCode}</div>
          <div class="cert-timestamp">
            <span class="cert-pulse"></span>
            <span>${dateStr} ${timeStr}</span>
            <span id="cert-ticking"></span>
          </div>
        </div>

        <div class="cert-patient">
          ${patientDisplay} ｜ ${idDisplay}
        </div>

        <div class="cert-level-badge ${r.levelColor}">
          <span>${r.levelEmoji}</span>
          <span>${r.levelName}</span>
        </div>

        <div class="cert-recommendation" style="color: var(--text-primary);">
          ${rec.title}
        </div>

        <div class="text-sm" style="color: var(--text-secondary); padding: 0 16px; line-height: 1.6;">
          ${rec.text}
        </div>

        <div class="cert-reasoning">
          <div class="cert-reasoning-title">📋 評估依據</div>
          ${findingsHTML}
        </div>

        <div id="qrcode" style="display: none;"></div>
      </div>

      ${safetyHTML}

      ${diversionHTML}

      ${emergencyHTML}

      <div class="btn-row" style="margin-top: 24px;">
        <button class="btn btn-outline" id="step5-print">🖨️ 列印</button>
        <button class="btn btn-primary" id="step5-reset">🔄 重新評估</button>
      </div>
    `;

    // Generate QR code
    generateQRCode();

    // Start ticking clock
    startTickingClock();

    // Re-bind print and reset
    $('#step5-print').addEventListener('click', () => window.print());
    $('#step5-reset').addEventListener('click', resetApp);
  }

  function generateQRCode() {
    const qrContainer = $('#qrcode');
    if (!qrContainer) return;

    qrContainer.style.display = 'inline-block';

    const r = state.triageResult;
    const data = {
      code: state.verificationCode,
      level: r.level,
      levelName: r.levelLabel,
      patient: state.patientInitials + '*',
      id: '****' + state.patientIdLast4,
      time: state.timestamp.toISOString(),
      reason: r.primaryReason,
    };

    try {
      new QRCode(qrContainer, {
        text: JSON.stringify(data),
        width: 120,
        height: 120,
        colorDark: '#1a1a1d',
        colorLight: '#ffffff',
        correctLevel: QRCode.CorrectLevel.M,
      });
    } catch (e) {
      qrContainer.innerHTML = '<div class="text-xs">QR Code 產生失敗</div>';
    }
  }

  function startTickingClock() {
    const el = $('#cert-ticking');
    if (!el) return;

    const update = () => {
      const now = new Date();
      const diff = Math.floor((now - state.timestamp) / 1000);
      el.textContent = `（${diff}s）`;
      requestAnimationFrame(update);
    };
    update();
  }

  // ── Reset ──
  function resetApp() {
    state.currentStep = 1;
    state.disclaimerAccepted = false;
    state.ageGroup = null;
    state.infantAge = null;
    state.pregnancy = false;
    state.patientInitials = '';
    state.patientIdLast4 = '';
    state.chiefComplaint = null;
    state.answers = {};
    state.questionIndex = 0;
    state.triageResult = null;
    state.verificationCode = '';
    state.timestamp = null;

    // Reset UI
    const disclaimerCheckbox = $('#disclaimer-check');
    if (disclaimerCheckbox) disclaimerCheckbox.classList.remove('checked');
    const nextBtn = $('#step1-next');
    if (nextBtn) nextBtn.disabled = true;

    $$('#step2 .age-card, #step2 .infant-age-card').forEach(c => c.classList.remove('selected'));
    const nameInput = $('#patient-name');
    if (nameInput) nameInput.value = '';
    const idInput = $('#patient-id');
    if (idInput) idInput.value = '';
    const pregToggle = $('#pregnancy-toggle');
    if (pregToggle) pregToggle.classList.remove('active');
    const pedsSub = $('#peds-age-sub');
    if (pedsSub) pedsSub.style.display = 'none';

    const step2Next = $('#step2-next');
    if (step2Next) step2Next.disabled = true;

    renderChiefComplaints();
    showScreen(1);
  }

  // ── Init ──
  function init() {
    initStep1();
    initStep2();
    initStep3();
    initStep4();
    initStep5();
    showScreen(1);
  }

  return { init, state };
})();

// ── Bootstrap ──
document.addEventListener('DOMContentLoaded', App.init);
