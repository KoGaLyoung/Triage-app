// DOM-stub smoke test — drives the full UI flow without a real browser.
// Provides a minimal fake DOM sufficient to run app.js init → full journey.
const fs = require('fs');
const vm = require('vm');

// ── Minimal element stub ──
class FakeElement {
  constructor(tag) {
    this.tagName = tag;
    this._children = [];
    this.parent = null;
    this.attributes = {};
    this.dataset = {};
    this.style = {};
    this.disabled = false;
    this.value = '';
    this.scrollTop = 0;
    this._listeners = {};
    this._innerHTML = '';
    this.textContent = '';
    this.className = '';
  }
  get innerHTML() { return this._innerHTML; }
  set innerHTML(html) {
    this._innerHTML = html;
    if (typeof html !== 'string') { this._children = []; return; }
    this._children = []; // replace previous parsed children (matches real DOM)
    // Mini-parser: for each element opening tag with id= or class=, create a
    // child FakeElement so downstream querySelector('#id') / '.class' resolve.
    const re = /<([a-z0-9]+)\b([^>]*)>/gi;
    let m;
    while ((m = re.exec(html)) !== null) {
      const tag = m[1];
      const attrs = m[2] || '';
      const el = FakeDom.createElement(tag);
      const idMatch = attrs.match(/\bid=["']([^"']+)["']/);
      if (idMatch) {
        el.id = idMatch[1];
        FakeDom.register(idMatch[1], el);
      }
      const classMatch = attrs.match(/\bclass=["']([^"']+)["']/);
      if (classMatch) el.classList.add(...classMatch[1].split(/\s+/).filter(Boolean));
      const dataMatch = attrs.match(/\bdata-([a-z-]+)="([^"]+)"/gi);
      if (dataMatch) {
        dataMatch.forEach(dm => {
          const dm2 = dm.match(/\bdata-([a-z-]+)="([^"]+)"/i);
          if (dm2 && dm2[1] !== 'age') el.dataset[dm2[1]] = dm2[2];
        });
      }
      const textMatch = attrs.match(/\bplaceholder=["']([^"']*)["']/);
      if (textMatch) el.placeholder = textMatch[1];
      this.appendChild(el);
      // Strip tag text content into textContent for card-title spans
      const simpleText = html.match(new RegExp('>' + '[^<]*' + '</' + tag + '>', 'g'));
      if (simpleText && el.textContent === '') {
        const first = simpleText[0].replace(/^>/, '').replace(/<\/[a-z0-9]+>$/, '').trim();
        if (first && first.length < 40) el.textContent = first;
      }
    }
  }
  classList = {
    _set: new Set(),
    add(...c) { c.forEach(x => this._set.add(x)); },
    remove(...c) { c.forEach(x => this._set.delete(x)); },
    toggle(c, force) {
      const on = force !== undefined ? force : !this._set.has(c);
      if (on) this._set.add(c); else this._set.delete(c);
      return on;
    },
    contains(c) { return this._set.has(c); },
  };
  get className() { return [...this.classList._set].join(' '); }
  set className(v) {
    this.classList._set = new Set(String(v).split(/\s+/).filter(Boolean));
  }
  addEventListener(type, fn) {
    (this._listeners[type] = this._listeners[type] || []).push(fn);
  }
  dispatch(type, evt) {
    (this._listeners[type] || []).forEach(fn => fn(evt || {}));
  }
  appendChild(child) {
    child.parent = this;
    this._children.push(child);
    return child;
  }
  querySelector(sel) {
    return FakeDom._walk(this, sel, false);
  }
  querySelectorAll(sel) {
    return FakeDom._walk(this, sel, true);
  }
  scrollTo() {}
  get children() { return this._children; }
  set classListValue(v) { this._classListValue = v; }
}

class FakeDom {
  static _registry = [];
  static register(id, el) {
    const idx = FakeDom._registry.findIndex(x => x.id === id);
    if (idx >= 0) FakeDom._registry[idx].el = el; // overwrite so querySelector finds latest
    else FakeDom._registry.push({ id, el });
  }
  static reset() { FakeDom._registry = []; }

  static byId(id) {
    const rec = FakeDom._registry.find(x => x.id === id);
    return rec ? rec.el : null;
  }

  // Simplify: walk a tree for querySelector(All) by treating selector in `#id` or `.class` or `tag` form.
  static _walk(root, sel, all) {
    const results = [];
    // Only support simple selectors used by app.js: '#id', '.class', 'tag'
    const isId = sel.startsWith('#');
    const isClass = sel.startsWith('.');
    const isTag = !isId && !isClass;
    const startRoot = root || FakeDom.root;

    // For '#id', look up registry global (elements are registered by id)
    if (isId) {
      const found = FakeDom.byId(sel.slice(1));
      return all ? (found ? [found] : []) : found;
    }
    if (isClass) {
      const cls = sel.slice(1);
      const walkNodes = (node) => {
        if (!node) return;
        if (node !== startRoot && node.classList && node.classList.contains(cls)) results.push(node);
        (node._children || []).forEach(walkNodes);
      };
      walkNodes(startRoot);
      return all ? results : results[0] || null;
    }
    if (isTag) {
      // For tag selectors we only need '.screen' in showScreen — handled by class check fallback
      const nodes = [];
      const walkTag = (node) => {
        if (!node) return;
        if (node !== startRoot && node.tagName && node.tagName.toLowerCase() === sel.toLowerCase()) nodes.push(node);
        (node._children || []).forEach(walkTag);
      };
      walkTag(startRoot);
      return all ? nodes : nodes[0] || null;
    }
    return all ? results : results[0] || null;
  }

  static createElement(tag) {
    return new FakeElement(tag);
  }
}

// ── Install global DOM mock BEFORE loading app.js ──
const _docListeners = {};
global.document = {
  querySelector: (sel) => FakeDom._walk(null, sel, false),
  querySelectorAll: (sel) => FakeDom._walk(null, sel, true),
  createElement: (tag) => FakeDom.createElement(tag),
  body: { appendChild: () => {}, querySelector: () => null },
  addEventListener: (type, fn) => { (_docListeners[type] = _docListeners[type] || []).push(fn); },
  dispatchEvent: (evt) => {
    if (evt && evt.type) (_docListeners[evt.type] || []).forEach(fn => fn(evt));
    if (typeof _dispatchAllQueued === 'function') _dispatchAllQueued(evt);
  },
};
global.window = {
  scrollTo: () => {},
  location: { href: '' },
};
global.navigator = { vibrate: () => {} };
global.requestAnimationFrame = () => 0; // no-op (avoid infinite recursion in tickers)
global.cancelAnimationFrame = () => {};
global.setTimeout = (fn, ms) => fn(); // synchronous for testing

// ── Build the static DOM tree matching index.html ──
function buildStaticDom() {
  const app = FakeDom.createElement('div');
  app.id = 'app';
  FakeDom.root = app;

  // Step screens (nested shells for elements that live inside them in index.html)
  const mk = (id, cls) => {
    const el = FakeDom.createElement('div');
    if (id) { el.id = id; FakeDom.register(id, el); }
    if (cls) el.classList.add(cls);
    return el;
  };

  const stepEls = {};
  for (let i = 1; i <= 5; i++) {
    stepEls['step' + i] = mk('step' + i, 'screen');
    app.appendChild(stepEls['step' + i]);
  }

  // Step 1 shells
  [
    ['disclaimer-check', null], ['emergency-call-btn', null], ['step1-next', null],
  ].forEach(([id, cls]) => stepEls.step1.appendChild(mk(id, cls)));

  // Step 2 shells + age cards
  ['pregnancy-toggle', 'patient-name', 'patient-id', 'step2-next', 'step2-back', 'peds-age-sub']
    .forEach(id => stepEls.step2.appendChild(mk(id, null)));
  [
    { cls: 'age-card', age: 'adult' },
    { cls: 'age-card', age: 'pediatric' },
    { cls: 'infant-age-card', age: 'under_3m' },
    { cls: 'infant-age-card', age: '3m_3y' },
    { cls: 'infant-age-card', age: 'over_3y' },
  ].forEach(a => {
    const card = mk(null, a.cls);
    card.dataset.age = a.age;
    stepEls.step2.appendChild(card);
  });

  // Step 3 shells
  ['chief-complaint-grid', 'step3-back'].forEach(id => stepEls.step3.appendChild(mk(id, null)));

  // Step 4 shells
  ['question-container', 'step4-back'].forEach(id => stepEls.step4.appendChild(mk(id, null)));

  // Step 5 shell
  stepEls.step5.appendChild(mk('certificate-container', null));

  // Progress fill (top fixed bar)
  app.appendChild(mk(null, 'progress-fill'));

  return app;
}

// ── Load scripts in order (with FakeDom as global document) ──
function loadApp() {
  buildStaticDom();
  // TTAS & QuestionsData are exposed as globals for the browser; load via vm to global scope
  const engineSrc = fs.readFileSync('./js/ttas_engine.js', 'utf8');
  const dataSrc = fs.readFileSync('./js/questions_data.js', 'utf8');
  const wheelSrc = fs.readFileSync('./js/components/wheel_picker.js', 'utf8');
  const appSrc = fs.readFileSync('./js/app.js', 'utf8');

  // Run each in the global context so const TTAS / const App / const WheelPicker become
  // global lexical bindings accessible to subsequent inputs.
  const context = vm.createContext({
    console, setTimeout, clearTimeout, requestAnimationFrame, cancelAnimationFrame,
    window, navigator, document, location: { href: '' }, QRCode: undefined,
  });
  vm.runInContext(engineSrc, context, { filename: 'ttas_engine.js' });
  vm.runInContext(dataSrc, context, { filename: 'questions_data.js' });
  vm.runInContext(wheelSrc, context, { filename: 'wheel_picker.js' });
  vm.runInContext(appSrc, context, { filename: 'app.js' });

  // Fire DOMContentLoaded (app.js registers the handler synchronously at load)
  vm.runInContext("document.dispatchEvent({ type: 'DOMContentLoaded' });", context);
  global.__ctx = context;
}

// Run the smoke test
(async () => {
  try {
    loadApp();
    console.log('✅ App loaded + DOMContentLoaded fired without error');

    // Verify step 1 is active
    const step1 = FakeDom.byId('step1');
    console.log('   step1 active: ' + step1.classList.contains('active'));

    // ── Step 1: accept disclaimer, click next ──
    FakeDom.byId('disclaimer-check').dispatch('click');
    const next1 = FakeDom.byId('step1-next');
    console.log('   step1-next enabled after checkbox: ' + !next1.disabled);
    next1.dispatch('click');
    console.log('   step2 active after next: ' + FakeDom.byId('step2').classList.contains('active'));

    // ── Step 2: select adult, fill info, next ──
    const adultCard = FakeDom.byId('step2').querySelector('.age-card');
    adultCard.dispatch('click');
    console.log('   step2-next enabled after adult: ' + !FakeDom.byId('step2-next').disabled);
    FakeDom.byId('patient-name').value = '陳';
    FakeDom.byId('patient-id').value = '5678';
    FakeDom.byId('step2-next').dispatch('click');
    console.log('   step3 active after next: ' + FakeDom.byId('step3').classList.contains('active'));

    // ── Step 3: complain grid populated? ──
    const grid = FakeDom.byId('chief-complaint-grid');
    console.log('   chief complaint cards rendered: ' + grid.children.length);
    // Use 'minor' — a deterministic 3-question flow (single → stepper → wheel)
    const chosenCard = grid.children.find(c => c.dataset.complaint === 'minor');
    chosenCard.dispatch('click');
    await new Promise(r => setTimeout(r, 50)); // wait for auto-advance
    console.log('   step4 active after complaint: ' + FakeDom.byId('step4').classList.contains('active'));

    // ── Step 4: answer the question flow via #question-body registry node ──
    let guard = 0;
    const typesSeen = new Set();
    while (true) {
      guard++;
      if (guard > 60) { console.log('   ⚠️  Too many question steps — possible loop'); break; }
      if (FakeDom.byId('step5').classList.contains('active')) break; // done

      const body = FakeDom.byId('question-body');
      const options = body ? body.querySelectorAll('.bento-card') : [];
      const steppers = body ? body.querySelectorAll('.stepper-btn') : [];
      const wheels = body ? body.querySelectorAll('#wheel-trigger') : [];
      const confirms = body ? body.querySelectorAll('.btn-primary') : [];

      if (options.length > 0) {
        const first = options[0];
        const label = first.querySelector('.card-title');
        typesSeen.add('single:' + (label ? label.textContent : '?'));
        first.dispatch('click');
      } else if (steppers.length > 0) {
        typesSeen.add('stepper');
        (confirms[confirms.length - 1] || {}).dispatch && confirms[confirms.length - 1].dispatch('click');
      } else if (wheels.length > 0) {
        typesSeen.add('wheel');
        (confirms[confirms.length - 1] || {}).dispatch && confirms[confirms.length - 1].dispatch('click');
      } else {
        // No more inputs — may have advanced to result
        break;
      }
    }

    console.log('   question types seen: ' + [...typesSeen].join(', '));

    // ── Step 5: certificate rendered? ──
    const cert = FakeDom.byId('certificate-container');
    console.log('   step5 active: ' + FakeDom.byId('step5').classList.contains('active'));
    if (cert.querySelector('.certificate')) {
      console.log('   ✅ certificate rendered');
      const hash = cert.querySelector('.cert-hash');
      console.log('   verification code: ' + (hash ? hash.textContent : 'MISSING'));
      const badge = cert.querySelector('.cert-level-badge');
      console.log('   level badge: ' + (badge ? badge.textContent.trim() : 'MISSING'));
    } else {
      console.log('   ❌ certificate NOT rendered');
      console.log('   cert-content: ' + cert.innerHTML);
    }

    // ── Reset flow ──
    const resetBtn = cert.querySelector('#step5-reset');
    if (resetBtn) {
      resetBtn.dispatch('click');
      console.log('   step1 active after reset: ' + FakeDom.byId('step1').classList.contains('active'));
      console.log('   reset reactivated step1-next? disabled=' + FakeDom.byId('step1-next').disabled);
    }

    // ── Scenario 2: TRAUMA flow — exercises the multi-select pill path ──
    if (true) {
      // Re-do step1 → step3
      FakeDom.byId('disclaimer-check').dispatch('click');
      FakeDom.byId('step1-next').dispatch('click');
      FakeDom.byId('step2').querySelector('.age-card').dispatch('click');
      FakeDom.byId('step2-next').dispatch('click');
      const grid2 = FakeDom.byId('chief-complaint-grid');
      grid2.children.find(c => c.dataset.complaint === 'trauma').dispatch('click');

      let guard = 0;
      const seen = new Set();
      let singleCount = 0;
      while (guard++ < 60 && !FakeDom.byId('step5').classList.contains('active')) {
        const body = FakeDom.byId('question-body');
        const opts = body ? body.querySelectorAll('.bento-card') : [];
        const pills = body ? body.querySelectorAll('.pill') : [];
        const steppers = body ? body.querySelectorAll('.stepper-btn') : [];
        const wheels = body ? body.querySelectorAll('#wheel-trigger') : [];
        const confirms = body ? body.querySelectorAll('.btn-primary') : [];

        if (opts.length > 0) {
          seen.add('single');
          singleCount++;
          // First single = injury mechanism → choose "車禍" to trigger high-risk multi-select
          const target = singleCount === 1 && opts[1] ? opts[1] : opts[0];
          target.dispatch('click');
        } else if (pills.length > 0) {
          seen.add('multi');
          // Select the first 2 pills, then confirm
          pills.slice(0, 2).forEach(p => p.dispatch('click'));
          (confirms[confirms.length - 1] || {}).dispatch && confirms[confirms.length - 1].dispatch('click');
        } else if (steppers.length > 0) {
          seen.add('stepper');
          (confirms[confirms.length - 1] || {}).dispatch && confirms[confirms.length - 1].dispatch('click');
        } else if (wheels.length > 0) {
          seen.add('wheel');
          (confirms[confirms.length - 1] || {}).dispatch && confirms[confirms.length - 1].dispatch('click');
        } else {
          break;
        }
      }
      console.log('   [trauma] question types seen: ' + [...seen].join(', '));
      const cert2 = FakeDom.byId('certificate-container').querySelector('.certificate');
      console.log('   [trauma] certificate rendered: ' + !!cert2 + ' | step5 active: ' + FakeDom.byId('step5').classList.contains('active'));
    }

    console.log('\nSMOKE TEST COMPLETE');
  } catch (e) {
    console.error('❌ SMOKE TEST FAILED: ' + e.message);
    console.error(e.stack);
    process.exit(1);
  }
})();