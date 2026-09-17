/**
 * Wheel Picker Component
 * iOS-style smooth scroll/drum picker for continuous numerical inputs
 * Touch-friendly with momentum scrolling and snap-to-center
 */

const WheelPicker = (() => {
  'use strict';

  let _backdrop = null;
  let _container = null;
  let _itemsEl = null;
  let _valueEl = null;
  let _callback = null;
  let _config = {};
  let _currentValue = 0;
  let _isOpen = false;
  let _itemHeight = 40;
  let _visibleCount = 5; // Must be odd for center alignment

  // ── Generate items array ──
  function generateItems(min, max, step) {
    const items = [];
    // Use integer math to avoid floating-point drift
    const decimals = (step.toString().split('.')[1] || '').length;
    const multiplier = Math.pow(10, decimals);

    for (let v = min; v <= max + 0.0001; v += step) {
      items.push(Math.round(v * multiplier) / multiplier);
    }
    return items;
  }

  // ── Format display value ──
  function formatValue(val) {
    if (_config.decimals !== undefined) {
      return val.toFixed(_config.decimals);
    }
    if (Number.isInteger(val)) return val.toString();
    // Auto-detect decimals from step
    const stepStr = _config.step.toString();
    const dec = (stepStr.split('.')[1] || '').length;
    return val.toFixed(dec);
  }

  // ── Find nearest index for a value ──
  function findIndex(items, value) {
    let best = 0;
    let bestDist = Infinity;
    for (let i = 0; i < items.length; i++) {
      const dist = Math.abs(items[i] - value);
      if (dist < bestDist) {
        bestDist = dist;
        best = i;
      }
    }
    return best;
  }

  // ── Scroll to index ──
  function scrollToIndex(index, smooth = false) {
    if (!_itemsEl) return;
    const paddingOffset = Math.floor(_visibleCount / 2) * _itemHeight;
    const scrollTop = index * _itemHeight;

    if (smooth) {
      _itemsEl.scrollTo({ top: scrollTop, behavior: 'smooth' });
    } else {
      _itemsEl.scrollTop = scrollTop;
    }
  }

  // ── Update display ──
  function updateDisplay() {
    if (!_itemsEl) return;
    const items = _config._items || [];
    const paddingOffset = Math.floor(_visibleCount / 2) * _itemHeight;
    const rawIndex = (_itemsEl.scrollTop + _itemHeight / 2) / _itemHeight;
    const index = Math.round(rawIndex);
    const clamped = Math.max(0, Math.min(items.length - 1, index));

    if (items[clamped] !== undefined) {
      _currentValue = items[clamped];
      if (_valueEl) {
        _valueEl.textContent = formatValue(_currentValue);
      }
    }

    // Update active states
    const allItems = _itemsEl.querySelectorAll('.wheel-item');
    allItems.forEach((el, i) => {
      const isActive = i === clamped;
      el.classList.toggle('active', isActive);
    });
  }

  // ── Create DOM ──
  function createDOM() {
    if (_container) return;

    // Backdrop
    _backdrop = document.createElement('div');
    _backdrop.className = 'wheel-picker-backdrop';
    _backdrop.addEventListener('click', close);
    document.body.appendChild(_backdrop);

    // Container
    _container = document.createElement('div');
    _container.className = 'wheel-picker-container';
    _container.innerHTML = `
      <div class="wheel-picker-header">
        <span class="wheel-picker-title"></span>
        <button class="wheel-picker-done">完成</button>
      </div>
      <div class="wheel-picker-display">
        <span class="wheel-picker-value"></span>
      </div>
      <div class="wheel-track">
        <div class="wheel-highlight"></div>
        <div class="wheel-items"></div>
      </div>
    `;
    document.body.appendChild(_container);

    _itemsEl = _container.querySelector('.wheel-items');
    _valueEl = _container.querySelector('.wheel-picker-value');

    // Done button
    _container.querySelector('.wheel-picker-done').addEventListener('click', () => {
      if (_callback && _config._items) {
        _callback(_currentValue);
      }
      close();
    });

    // Scroll snap handler with debounce
    let scrollTimer = null;
    _itemsEl.addEventListener('scroll', () => {
      if (scrollTimer) cancelAnimationFrame(scrollTimer);
      scrollTimer = requestAnimationFrame(() => {
        updateDisplay();
      });
    });

    // Touch momentum: snap to nearest after scroll ends
    let touchEndTimer = null;
    _itemsEl.addEventListener('touchend', () => {
      if (touchEndTimer) clearTimeout(touchEndTimer);
      touchEndTimer = setTimeout(() => {
        const items = _config._items || [];
        const rawIndex = (_itemsEl.scrollTop + _itemHeight / 2) / _itemHeight;
        const index = Math.round(rawIndex);
        const clamped = Math.max(0, Math.min(items.length - 1, index));
        scrollToIndex(clamped, true);
      }, 100);
    }, { passive: true });
  }

  // ── Open picker ──
  function open(config) {
    _config = { ...config };
    _callback = config.onDone;

    const items = generateItems(config.min, config.max, config.step);
    _config._items = items;
    _currentValue = config.value !== undefined ? config.value : config.default;

    createDOM();

    // Set title
    _container.querySelector('.wheel-picker-title').textContent = config.prompt || '';

    // Render items
    _itemsEl.innerHTML = '';

    // Add padding items at top and bottom for visual centering
    const paddingCount = Math.floor(_visibleCount / 2);

    for (let i = 0; i < paddingCount; i++) {
      const spacer = document.createElement('div');
      spacer.className = 'wheel-item';
      spacer.style.height = _itemHeight + 'px';
      _itemsEl.appendChild(spacer);
    }

    items.forEach((val, idx) => {
      const el = document.createElement('div');
      el.className = 'wheel-item';
      el.textContent = formatValue(val);
      el.style.height = _itemHeight + 'px';
      _itemsEl.appendChild(el);
    });

    for (let i = 0; i < paddingCount; i++) {
      const spacer = document.createElement('div');
      spacer.className = 'wheel-item';
      spacer.style.height = _itemHeight + 'px';
      _itemsEl.appendChild(spacer);
    }

    // Set initial scroll position
    const targetIndex = findIndex(items, _currentValue);
    // Need to wait for DOM to render
    requestAnimationFrame(() => {
      scrollToIndex(targetIndex, false);
      updateDisplay();
    });

    // Show
    requestAnimationFrame(() => {
      _backdrop.classList.add('open');
      _container.classList.add('open');
      _isOpen = true;
    });
  }

  // ── Close picker ──
  function close() {
    if (!_isOpen) return;
    _backdrop.classList.remove('open');
    _container.classList.remove('open');
    _isOpen = false;
  }

  // ── Quick open helper ──
  function show(options) {
    open({
      prompt: options.prompt || '',
      min: options.min ?? 0,
      max: options.max ?? 100,
      step: options.step ?? 1,
      value: options.value,
      default: options.default ?? options.min ?? 0,
      unit: options.unit || '',
      decimals: options.decimals,
      onDone: options.onDone,
    });
  }

  return { show, open, close };
})();
