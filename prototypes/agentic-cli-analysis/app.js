(function () {
  const deck = document.getElementById('deck');
  const slidesData = window.SLIDES || [];
  const total = slidesData.length;
  let current = 0;

  // Build slides
  slidesData.forEach((s, i) => {
    const el = document.createElement('section');
    el.className = 'slide';
    el.dataset.index = i;
    el.innerHTML = s.html;
    deck.appendChild(el);
  });
  const slides = Array.from(document.querySelectorAll('.slide'));

  const counter = document.getElementById('counter');
  const bar = document.getElementById('progress-bar');
  const pad = (n) => String(n + 1).padStart(2, '0');

  function render() {
    slides.forEach((el, i) => {
      el.classList.remove('active', 'prev');
      if (i === current) el.classList.add('active');
      else if (i < current) el.classList.add('prev');
    });
    counter.textContent = `${pad(current)} / ${String(total).padStart(2, '0')}`;
    bar.style.width = `${((current + 1) / total) * 100}%`;
    if (location.hash !== '#' + (current + 1)) {
      history.replaceState(null, '', '#' + (current + 1));
    }
  }

  function go(n) {
    current = Math.max(0, Math.min(total - 1, n));
    render();
  }
  const next = () => go(current + 1);
  const prev = () => go(current - 1);

  document.getElementById('next').addEventListener('click', next);
  document.getElementById('prev').addEventListener('click', prev);

  // Keyboard
  document.addEventListener('keydown', (e) => {
    if (!document.getElementById('overview').classList.contains('hidden')) {
      if (e.key === 'Escape' || e.key === 'o' || e.key === 'O') toggleOverview();
      return;
    }
    switch (e.key) {
      case 'ArrowRight':
      case ' ':
      case 'PageDown': e.preventDefault(); next(); break;
      case 'ArrowLeft':
      case 'PageUp': e.preventDefault(); prev(); break;
      case 'Home': go(0); break;
      case 'End': go(total - 1); break;
      case 'f': case 'F': toggleFullscreen(); break;
      case 'o': case 'O': toggleOverview(); break;
    }
  });

  // Touch / swipe
  let touchX = null;
  deck.addEventListener('touchstart', (e) => { touchX = e.touches[0].clientX; }, { passive: true });
  deck.addEventListener('touchend', (e) => {
    if (touchX === null) return;
    const dx = e.changedTouches[0].clientX - touchX;
    if (Math.abs(dx) > 50) (dx < 0 ? next() : prev());
    touchX = null;
  }, { passive: true });

  // Fullscreen
  function toggleFullscreen() {
    if (!document.fullscreenElement) document.documentElement.requestFullscreen?.();
    else document.exitFullscreen?.();
  }

  // Overview
  const overview = document.getElementById('overview');
  function buildOverview() {
    overview.innerHTML = '';
    slidesData.forEach((s, i) => {
      const c = document.createElement('div');
      c.className = 'ov-card';
      c.innerHTML = `<div class="ov-n">${s.section} · ${pad(i)}</div>
        <div class="ov-t">${s.title || ''}</div>
        <div class="ov-s">${s.sub || ''}</div>`;
      c.addEventListener('click', () => { go(i); toggleOverview(); });
      overview.appendChild(c);
    });
  }
  function toggleOverview() {
    if (overview.classList.contains('hidden')) { buildOverview(); overview.classList.remove('hidden'); }
    else overview.classList.add('hidden');
  }
  document.getElementById('overview-toggle').addEventListener('click', toggleOverview);

  // Deep link
  const fromHash = parseInt((location.hash || '').replace('#', ''), 10);
  if (!isNaN(fromHash) && fromHash >= 1 && fromHash <= total) current = fromHash - 1;

  render();
})();
