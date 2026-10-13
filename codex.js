/* UI adaptations from Lucian UX/UI Prompt, MIT (c) 2026 Seokwoooo.
   Elements 008, 039, 044, 050, 058, 092. See LUCIAN-UI-LICENSE.txt. */
(() => {
  'use strict';
  const input = document.querySelector('#docs-search');
  const resultRoot = document.querySelector('#docs-results');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  if (input && resultRoot) {
    const cards = [...resultRoot.querySelectorAll('[data-doc]')];
    const status = document.querySelector('#docs-status');
    const empty = document.querySelector('#docs-empty');
    const buttons = [...document.querySelectorAll('[data-filter]')];
    const pill = document.querySelector('.docs-filter-pill');
    function movePill() {
      const selected = buttons.find(b => b.getAttribute('aria-pressed') === 'true');
      if (!pill || !selected) return;
      pill.style.setProperty('--pill-x', `${selected.offsetLeft}px`);
      pill.style.setProperty('--pill-y', `${selected.offsetTop}px`);
      pill.style.setProperty('--pill-w', `${selected.offsetWidth}px`);
      pill.style.setProperty('--pill-h', `${selected.offsetHeight}px`);
      pill.parentElement.classList.add('has-pill');
    }
    if (pill && 'ResizeObserver' in window) new ResizeObserver(movePill).observe(pill.parentElement);
    let category = 'all';
    let indexPromise;
    let sequence = 0;
    const normalize = s => s.normalize('NFKC').toLocaleLowerCase().replace(/\s+/g, ' ').trim();
    function loadIndex() {
      if (!indexPromise) indexPromise = fetch('data/codex-search.json').then(r => {
        if (!r.ok) throw new Error('Search unavailable');
        return r.json();
      }).then(data => new Map(data.map(d => [d.file, normalize(`${d.title} ${d.description} ${d.text}`)]))).catch(error => { indexPromise = null; throw error; });
      return indexPromise;
    }
    async function filter() {
      const current = ++sequence;
      const query = normalize(input.value);
      const terms = query.split(' ').filter(Boolean);
      let index;
      let limited = false;
      if (query) {
        status.textContent = '正在查找…';
        try { index = await loadIndex(); }
        catch { limited = true; }
      }
      if (current !== sequence) return;
      let count = 0;
      for (const card of cards) {
        const text = index?.get(card.dataset.doc) || normalize(card.textContent);
        const match = (category === 'all' || category === card.dataset.category) && terms.every(t => text.includes(t));
        card.hidden = !match;
        if (match) {
          count++;
          if (!reduced.matches) {
            card.classList.remove('result-enter');
            card.style.setProperty('--entry-delay', `${Math.min(count - 1, 5) * 25}ms`);
            requestAnimationFrame(() => card.classList.add('result-enter'));
          }
        }
      }
      empty.hidden = count !== 0;
      status.textContent = `${query ? `“${input.value.trim()}” · ` : ''}找到 ${count} 篇${limited ? '（全文搜索暂不可用，当前只搜索标题与摘要）' : ''}。`;
      const url = new URL(location.href);
      query ? url.searchParams.set('q', input.value.trim()) : url.searchParams.delete('q');
      category === 'all' ? url.searchParams.delete('category') : url.searchParams.set('category', category);
      history.replaceState(null, '', url);
    }
    buttons.forEach(button => button.addEventListener('click', () => {
      category = button.dataset.filter;
      buttons.forEach(b => b.setAttribute('aria-pressed', String(b === button)));
      movePill();
      filter();
    }));
    buttons.forEach((button, index) => button.addEventListener('keydown', event => {
      let next;
      if (event.key === 'ArrowRight') next = (index + 1) % buttons.length;
      else if (event.key === 'ArrowLeft') next = (index - 1 + buttons.length) % buttons.length;
      else if (event.key === 'Home') next = 0;
      else if (event.key === 'End') next = buttons.length - 1;
      else return;
      event.preventDefault(); buttons[next].focus(); buttons[next].click();
    }));
    document.querySelector('[data-reset-search]')?.addEventListener('click', () => {
      input.value = ''; category = 'all';
      buttons.forEach(b => b.setAttribute('aria-pressed', String(b.dataset.filter === 'all')));
      movePill(); filter(); input.focus({ preventScroll: true });
    });
    document.querySelectorAll('[data-suggest]').forEach(button => button.addEventListener('click', () => {
      input.value = button.dataset.suggest; category = 'all';
      buttons.forEach(b => b.setAttribute('aria-pressed', String(b.dataset.filter === 'all')));
      movePill(); filter(); input.focus({ preventScroll: true });
    }));
    let timer;
    input.addEventListener('input', () => { clearTimeout(timer); timer = setTimeout(filter, 160); });
    input.closest('form').addEventListener('submit', event => { event.preventDefault(); clearTimeout(timer); filter(); });
    const params = new URLSearchParams(location.search);
    input.value = params.get('q') || '';
    const initial = buttons.find(b => b.dataset.filter === params.get('category'));
    if (initial) { category = initial.dataset.filter; buttons.forEach(b => b.setAttribute('aria-pressed', String(b === initial))); }
    if (input.value || initial) filter();
    movePill(); document.fonts?.ready.then(movePill);
  }
  document.querySelectorAll('.copy-code').forEach(button => button.addEventListener('click', async () => {
    const text = button.closest('.docs-code').querySelector('code').textContent;
    try {
      await navigator.clipboard.writeText(text);
      button.textContent = '已复制';
      button.classList.add('is-copied');
    } catch {
      const range = document.createRange();
      range.selectNodeContents(button.closest('.docs-code').querySelector('code'));
      const selection = window.getSelection();
      selection.removeAllRanges(); selection.addRange(range);
      button.textContent = '已选中，请复制';
    }
    setTimeout(() => { button.textContent = '复制'; button.classList.remove('is-copied'); }, 2500);
  }));
  // Mobile sidebars begin collapsed; desktop exposes the active category.
  if (matchMedia('(max-width: 800px)').matches) {
    document.querySelectorAll('.docs-sidebar details,.docs-toc details').forEach(d => { d.open = false; });
  }
  const headings = [...document.querySelectorAll('.docs-prose h2[id],.docs-prose h3[id]')];
  // Lucian 050: use gentle paper-colored glare and tilt only for a precise mouse.
  if (matchMedia('(hover: hover) and (pointer: fine)').matches) {
    document.querySelectorAll('.docs-card,.docs-path').forEach(card => {
      let frame;
      card.addEventListener('pointermove', event => {
        if (event.pointerType !== 'mouse' || reduced.matches) return;
        cancelAnimationFrame(frame);
        frame = requestAnimationFrame(() => {
          const rect = card.getBoundingClientRect();
          const x = (event.clientX - rect.left) / rect.width;
          const y = (event.clientY - rect.top) / rect.height;
          card.style.setProperty('--light-x', `${x * 100}%`);
          card.style.setProperty('--light-y', `${y * 100}%`);
          card.style.setProperty('--tilt-x', `${(0.5 - y) * 3}deg`);
          card.style.setProperty('--tilt-y', `${(x - 0.5) * 3}deg`);
          card.classList.add('has-spotlight');
        });
      });
      card.addEventListener('pointerleave', () => {
        cancelAnimationFrame(frame); card.classList.remove('has-spotlight');
        card.style.setProperty('--tilt-x', '0deg'); card.style.setProperty('--tilt-y', '0deg');
      });
    });
  }
  const prose = document.querySelector('.docs-prose');
  const reading = document.querySelector('.docs-reading-status');
  const bar = document.querySelector('.docs-reading-bar');
  if (prose && reading && bar) {
    const ring = reading.querySelector('[role=progressbar]');
    reading.hidden = false; bar.hidden = false;
    let frame = 0;
    function updateReading() {
      frame = 0;
      const rect = prose.getBoundingClientRect();
      const start = rect.top + scrollY - 140;
      const end = rect.bottom + scrollY - innerHeight + 40;
      const progress = Math.max(0, Math.min(1, (scrollY - start) / Math.max(1, end - start)));
      const percent = Math.round(progress * 100);
      reading.style.setProperty('--read-progress', progress);
      bar.style.setProperty('--read-progress', progress);
      ring.setAttribute('aria-valuenow', String(percent));
      ring.querySelector('span').textContent = percent === 100 ? '✓' : `${percent}%`;
      reading.classList.toggle('is-done', percent === 100);
    }
    const queue = () => { if (!frame) frame = requestAnimationFrame(updateReading); };
    addEventListener('scroll', queue, { passive: true }); addEventListener('resize', queue);
    if ('ResizeObserver' in window) new ResizeObserver(queue).observe(prose);
    updateReading();
  }
  if ('IntersectionObserver' in window && headings.length) {
    const links = [...document.querySelectorAll('.docs-toc a')];
    const observer = new IntersectionObserver(entries => {
      const visible = entries.filter(e => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
      if (!visible) return;
      links.forEach(link => { link.removeAttribute('aria-current'); if (decodeURIComponent(link.hash.slice(1)) === visible.target.id) link.setAttribute('aria-current', 'location'); });
    }, { rootMargin: '-130px 0px -55% 0px' });
    headings.forEach(h => observer.observe(h));
  }
})();
