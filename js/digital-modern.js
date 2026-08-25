(() => {
  'use strict';

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
  const body = document.body;
  const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)');

  // Current year
  const year = $('#currentYear');
  if (year) year.textContent = new Date().getFullYear();

  // Mobile navigation
  const menuToggle = $('.menu-toggle');
  const mainNav = $('#mainNav');
  const closeMenu = () => {
    if (!menuToggle || !mainNav) return;
    menuToggle.setAttribute('aria-expanded', 'false');
    mainNav.classList.remove('is-open');
  };
  if (menuToggle && mainNav) {
    menuToggle.addEventListener('click', () => {
      const open = menuToggle.getAttribute('aria-expanded') === 'true';
      menuToggle.setAttribute('aria-expanded', String(!open));
      mainNav.classList.toggle('is-open', !open);
    });
    $$('a', mainNav).forEach(link => link.addEventListener('click', closeMenu));
    document.addEventListener('click', (e) => {
      if (!mainNav.contains(e.target) && !menuToggle.contains(e.target)) closeMenu();
    });
  }

  // Readability mode
  const readabilityToggle = $('#readabilityToggle');
  const storedReadable = localStorage.getItem('kazior-readable') === '1';
  const setReadable = (on) => {
    body.classList.toggle('readable', on);
    if (readabilityToggle) readabilityToggle.setAttribute('aria-pressed', String(on));
    localStorage.setItem('kazior-readable', on ? '1' : '0');
  };
  if (storedReadable) setReadable(true);
  readabilityToggle?.addEventListener('click', () => setReadable(!body.classList.contains('readable')));

  // Hero slider: autoplay + thumbnails + swipe + keyboard + visibility pause
  const slider = $('#heroSlider');
  if (slider) {
    const slides = $$('.slide', slider);
    const dots = $$('[data-slider-dot]', slider);
    const thumbs = $('.slider-thumbs', slider);
    const progress = $('.slider-progress span', slider);
    let index = 0;
    let timer = null;
    let touchX = 0;
    let startedAt = 0;
    let remaining = 6500;
    const interval = 6500;

    const runProgress = (duration = interval) => {
      if (!progress || prefersReduced.matches || body.classList.contains('readable')) return;
      progress.style.transition = 'none';
      progress.style.transform = 'scaleX(0)';
      void progress.offsetWidth;
      progress.style.transition = `transform ${duration}ms linear`;
      progress.style.transform = 'scaleX(1)';
    };

    const show = (next, user = false) => {
      index = (next + slides.length) % slides.length;
      slides.forEach((slide, i) => {
        const active = i === index;
        slide.classList.toggle('is-active', active);
        slide.setAttribute('aria-hidden', active ? 'false' : 'true');
      });
      dots.forEach((dot, i) => {
        dot.classList.toggle('is-active', i === index);
        dot.setAttribute('aria-selected', i === index ? 'true' : 'false');
        if (i === index && thumbs && thumbs.scrollWidth > thumbs.clientWidth + 6) {
          const targetLeft = Math.max(0, dot.offsetLeft - (thumbs.clientWidth - dot.offsetWidth) / 2);
          thumbs.scrollTo({ left: targetLeft, behavior: user ? 'smooth' : 'auto' });
        }
      });
      if (user) restart();
    };

    const stop = () => {
      if (timer) window.clearTimeout(timer);
      timer = null;
      if (startedAt) remaining = Math.max(500, remaining - (performance.now() - startedAt));
      slider.classList.add('is-paused');
      if (progress) {
        const computed = getComputedStyle(progress).transform;
        progress.style.transition = 'none';
        if (computed && computed !== 'none') progress.style.transform = computed;
      }
    };

    let sliderInView = true;

    const start = (delay = interval) => {
      if (prefersReduced.matches || body.classList.contains('readable') || document.hidden || !sliderInView) return;
      if (timer) window.clearTimeout(timer);
      remaining = delay;
      startedAt = performance.now();
      slider.classList.remove('is-paused');
      runProgress(delay);
      timer = window.setTimeout(() => {
        show(index + 1);
        remaining = interval;
        start(interval);
      }, delay);
    };

    const restart = () => { stop(); remaining = interval; start(interval); };

    $('[data-slider-prev]', slider)?.addEventListener('click', () => show(index - 1, true));
    $('[data-slider-next]', slider)?.addEventListener('click', () => show(index + 1, true));
    dots.forEach(dot => dot.addEventListener('click', () => show(Number(dot.dataset.sliderDot), true)));

    slider.addEventListener('mouseenter', stop);
    slider.addEventListener('mouseleave', () => start(remaining || interval));
    slider.addEventListener('focusin', stop);
    slider.addEventListener('focusout', (e) => { if (!slider.contains(e.relatedTarget)) start(remaining || interval); });
    slider.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowLeft') { e.preventDefault(); show(index - 1, true); }
      if (e.key === 'ArrowRight') { e.preventDefault(); show(index + 1, true); }
    });
    slider.addEventListener('touchstart', (e) => { touchX = e.changedTouches[0].clientX; stop(); }, {passive:true});
    slider.addEventListener('touchend', (e) => {
      const delta = e.changedTouches[0].clientX - touchX;
      if (Math.abs(delta) > 45) show(index + (delta < 0 ? 1 : -1), true);
      else start(remaining || interval);
    }, {passive:true});
    document.addEventListener('visibilitychange', () => document.hidden ? stop() : start(remaining || interval));
    prefersReduced.addEventListener?.('change', () => prefersReduced.matches ? stop() : start(interval));
    readabilityToggle?.addEventListener('click', () => body.classList.contains('readable') ? stop() : start(interval));

    if ('IntersectionObserver' in window) {
      const sliderObserver = new IntersectionObserver((entries) => {
        const entry = entries[0];
        sliderInView = !!entry && entry.isIntersecting && entry.intersectionRatio > 0.18;
        if (sliderInView) start(remaining || interval);
        else stop();
      }, { threshold: [0, 0.18, 0.4] });
      sliderObserver.observe(slider);
    }

    slider.setAttribute('tabindex','0');
    show(0);
    start(interval);
  }

  // Team card pointer interaction (deliberately mild)
  const teamCards = $$('.team-card');
  teamCards.forEach(card => {
    const reset = () => {
      card.style.setProperty('--rx', '0deg');
      card.style.setProperty('--ry', '0deg');
      card.style.setProperty('--mx', '50%');
      card.style.setProperty('--my', '50%');
    };
    card.addEventListener('pointermove', (e) => {
      if (e.pointerType !== 'mouse' || body.classList.contains('readable') || prefersReduced.matches) return;
      const r = card.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width;
      const y = (e.clientY - r.top) / r.height;
      card.style.setProperty('--mx', `${x * 100}%`);
      card.style.setProperty('--my', `${y * 100}%`);
      card.style.setProperty('--ry', `${(x - .5) * 5}deg`);
      card.style.setProperty('--rx', `${(.5 - y) * 5}deg`);
    });
    card.addEventListener('pointerleave', reset);
    card.addEventListener('blur', reset);
  });

  // Team profiles
  const profiles = {
    aizhan: {
      name: 'Баракбаева Айжан Айтулгановна', role: 'Руководитель отдела', image: 'img/team-aizhan-clean.jpg',
      html: '<p><strong>Образование:</strong> 2010–2014 гг. Казахская инженерная, финансово-банковская академия (КИФБА).</p><p class="profile-body-card"><strong>Специальность:</strong> «Автоматизация и управление».</p>'
    },
    alma: {
      name: 'Муратова Алма Зульфухаровна', role: 'Инженер-программист', image: 'img/team-alma-clean.jpg',
      html: '<p><strong>Квалификация:</strong> кандидат биологических наук.</p><p class="profile-body-card"><strong>Образование:</strong> 1985–1990 гг. Карагандинский государственный университет им. Е.А. Букетова. Специальность: «Физика».</p>'
    },
    elnur: {
      name: 'Нұрқадыр Елнұр Серікұлы', role: 'Инженер-программист', image: 'img/team-elnur-clean.jpg',
      html: '<p><strong>Образование:</strong> 2021–2025 гг. Казахский национальный университет им. аль-Фараби.</p><p class="profile-body-card"><strong>Специальность:</strong> «Компьютерная физика».</p>'
    },
    altair: {
      name: 'Мелис Альтаир Сержанович', role: 'Инженер-программист', image: 'img/team-altair-clean.jpg',
      html: '<p><strong>Образование:</strong> 2017–2021 гг. Центральноазиатский технико-экономический колледж.</p><p class="profile-body-card"><strong>Специальность:</strong> «Техник-программист».</p>'
    },
    zhainar: {
      name: 'Жангербаева Жайнар Ельшатовна', role: 'Инженер-программист', initials: 'ЖЖ',
      html: '<p><strong>Образование:</strong> 2005–2009 гг. Жетысуский государственный университет им. И. Жансугурова.</p><p class="profile-body-card"><strong>Специальность:</strong> «Информационные системы».</p>'
    },
    evgeniy: {
      name: 'Тимченко Евгений Юрьевич', role: 'Системный администратор', image: 'img/team-evgeniy-clean.jpg',
      html: '<p><strong>Образование:</strong> 2007–2011 гг. Алматинский технический колледж.</p><p class="profile-body-card"><strong>Специальность:</strong> «Автоматизированные системы обработки информации и управления».</p>'
    },
    kuanysh: {
      name: 'Досов Қуаныш Рыспекұлы', role: 'Инженер-программист', image: 'img/team-kuanysh-clean.jpg',
      html: '<p><strong>Образование:</strong> 2009–2013 гг. Алматинский гуманитарно-технический университет.</p><p class="profile-body-card"><strong>Специальность:</strong> «Вычислительная техника и программное обеспечение».</p>'
    }
  };
  const dialog = $('#profileDialog');
  const openProfile = (id) => {
    const p = profiles[id];
    if (!p || !dialog) return;
    $('#profileName').textContent = p.name;
    $('#profileRole').textContent = p.role;
    $('#profileBody').innerHTML = p.html;
    const image = $('#profileImage');
    image.className = 'profile-image';
    image.style.backgroundImage = '';
    image.removeAttribute('data-initials');
    if (p.image) image.style.backgroundImage = `url("${p.image}")`;
    else { image.classList.add('initial-profile'); image.dataset.initials = p.initials || ''; }
    dialog.classList.add('is-open');
    dialog.setAttribute('aria-hidden', 'false');
    body.style.overflow = 'hidden';
    $('.profile-close', dialog)?.focus();
  };
  const closeProfile = () => {
    if (!dialog) return;
    dialog.classList.remove('is-open');
    dialog.setAttribute('aria-hidden', 'true');
    body.style.overflow = '';
  };
  $$('[data-open-profile]').forEach(btn => btn.addEventListener('click', (e) => {
    e.stopPropagation();
    openProfile(btn.dataset.openProfile);
  }));
  teamCards.forEach(card => {
    card.addEventListener('click', () => openProfile(card.dataset.profile));
    card.addEventListener('keydown', (e) => {
      if ((e.key === 'Enter' || e.key === ' ') && !e.target.closest('button')) {
        e.preventDefault();
        openProfile(card.dataset.profile);
      }
    });
  });
  $$('[data-close-profile]').forEach(el => el.addEventListener('click', closeProfile));
  document.addEventListener('keydown', e => { if (e.key === 'Escape') { closeProfile(); closeMenu(); } });

  // Back to top
  const backTop = $('#backTop');
  const updateBack = () => backTop?.classList.toggle('is-visible', window.scrollY > 700);
  window.addEventListener('scroll', updateBack, {passive:true});
  updateBack();
  backTop?.addEventListener('click', () => window.scrollTo({top:0, behavior: body.classList.contains('readable') ? 'auto' : 'smooth'}));

  // Calm cursor-responsive network canvas
  const webCanvas = $('#ambientWeb');
  const webCtx = webCanvas?.getContext('2d');
  let nodes = [];
  let webBursts = [];
  let webRaf = 0;
  const pointer = {x:innerWidth * .5, y:innerHeight * .3, active:false};
  const dpr = () => Math.min(window.devicePixelRatio || 1, 1.6);

  const createWebNodes = () => {
    const count = innerWidth < 700 ? 34 : innerWidth < 1100 ? 52 : 68;
    nodes = Array.from({length:count}, () => ({
      baseX: Math.random() * innerWidth,
      baseY: Math.random() * innerHeight,
      orbit: 6 + Math.random() * 18,
      speed: .55 + Math.random() * .95,
      phase: Math.random() * Math.PI * 2,
      r: 1.1 + Math.random() * 1.9,
      x: 0,
      y: 0
    }));
  };

  const resizeWeb = () => {
    if (!webCanvas || !webCtx) return;
    const ratio = dpr();
    webCanvas.width = Math.round(innerWidth * ratio);
    webCanvas.height = Math.round(innerHeight * ratio);
    webCanvas.style.width = `${innerWidth}px`;
    webCanvas.style.height = `${innerHeight}px`;
    webCtx.setTransform(ratio,0,0,ratio,0,0);
    createWebNodes();
  };

  const createWebBurst = (x, y) => {
    webBursts.push({x, y, born: performance.now(), life: 1400});
    if (webBursts.length > 8) webBursts = webBursts.slice(-8);
  };


  const drawWeb = (now = performance.now()) => {
    if (!webCtx || !webCanvas || body.classList.contains('readable') || prefersReduced.matches) return;
    webCtx.clearRect(0, 0, innerWidth, innerHeight);
    webBursts = webBursts.filter(b => now - b.born < b.life);

    const maxDist = innerWidth < 700 ? 150 : 200;
    const pullDist = innerWidth < 700 ? 170 : 230;

    for (const n of nodes) {
      let x = n.baseX + Math.cos(now * 0.00022 * n.speed + n.phase) * n.orbit;
      let y = n.baseY + Math.sin(now * 0.00016 * n.speed + n.phase * 1.15) * n.orbit;

      if (pointer.active) {
        const dx = pointer.x - x;
        const dy = pointer.y - y;
        const dist = Math.hypot(dx, dy);
        if (dist < pullDist && dist > 1) {
          const force = (1 - dist / pullDist) * 20;
          x += dx / dist * force;
          y += dy / dist * force;
        }
      }

      for (const burst of webBursts) {
        const age = (now - burst.born) / burst.life;
        const dx = x - burst.x;
        const dy = y - burst.y;
        const dist = Math.hypot(dx, dy) || 1;
        const range = 150 + (1 - age) * 80;
        if (dist < range) {
          const force = (1 - dist / range) * (1 - age) * 56;
          x += dx / dist * force;
          y += dy / dist * force;
        }
      }

      n.x = x;
      n.y = y;
    }

    for (const burst of webBursts) {
      const age = (now - burst.born) / burst.life;
      const radius = 18 + age * 210;
      webCtx.save();
      webCtx.globalAlpha = (1 - age) * .35;
      webCtx.strokeStyle = 'rgba(79,231,248,.95)';
      webCtx.lineWidth = 1;
      webCtx.beginPath();
      webCtx.arc(burst.x, burst.y, radius, 0, Math.PI * 2);
      webCtx.stroke();
      webCtx.beginPath();
      webCtx.arc(burst.x, burst.y, radius * .56, 0, Math.PI * 2);
      webCtx.stroke();
      webCtx.restore();
    }

    for (let i = 0; i < nodes.length; i++) {
      const a = nodes[i];
      for (let j = i + 1; j < nodes.length; j++) {
        const b = nodes[j];
        const dist = Math.hypot(a.x - b.x, a.y - b.y);
        if (dist < maxDist) {
          webCtx.beginPath();
          webCtx.moveTo(a.x, a.y);
          webCtx.lineTo(b.x, b.y);
          webCtx.strokeStyle = `rgba(18,162,204,${.22 * (1 - dist / maxDist)})`;
          webCtx.lineWidth = .9;
          webCtx.stroke();
        }
      }

      if (pointer.active) {
        const pd = Math.hypot(a.x - pointer.x, a.y - pointer.y);
        if (pd < 190) {
          webCtx.beginPath();
          webCtx.moveTo(a.x, a.y);
          webCtx.lineTo(pointer.x, pointer.y);
          webCtx.strokeStyle = `rgba(90,238,252,${.32 * (1 - pd / 190)})`;
          webCtx.lineWidth = .95;
          webCtx.stroke();
        }
      }

      webCtx.beginPath();
      webCtx.arc(a.x, a.y, a.r, 0, Math.PI * 2);
      webCtx.fillStyle = 'rgba(19,176,212,.56)';
      webCtx.fill();
    }

    webRaf = requestAnimationFrame(drawWeb);
  };

  const startWeb = () => {
    cancelAnimationFrame(webRaf);
    if (!body.classList.contains('readable') && !prefersReduced.matches) drawWeb();
  };

  if (webCanvas && webCtx) {
    resizeWeb();
    startWeb();
    window.addEventListener('resize', () => { resizeWeb(); startWeb(); }, {passive:true});
    window.addEventListener('pointermove', e => { pointer.x = e.clientX; pointer.y = e.clientY; pointer.active = true; }, {passive:true});
    document.documentElement.addEventListener('mouseleave', () => pointer.active = false);
    readabilityToggle?.addEventListener('click', startWeb);
    prefersReduced.addEventListener?.('change', startWeb);
  }

  // Soft lightning, impulse and web burst on click/tap
  const fxCanvas = $('#clickFx');
  const fxCtx = fxCanvas?.getContext('2d');
  const fxEffects = [];
  let fxRaf = 0;

  const resizeFx = () => {
    if (!fxCanvas || !fxCtx) return;
    const ratio = dpr();
    fxCanvas.width = Math.round(innerWidth * ratio);
    fxCanvas.height = Math.round(innerHeight * ratio);
    fxCanvas.style.width = `${innerWidth}px`;
    fxCanvas.style.height = `${innerHeight}px`;
    fxCtx.setTransform(ratio, 0, 0, ratio, 0, 0);
  };

  const animateFx = (now) => {
    if (!fxCtx) return;
    fxCtx.clearRect(0, 0, innerWidth, innerHeight);
    for (let i = fxEffects.length - 1; i >= 0; i--) {
      const effect = fxEffects[i];
      const t = (now - effect.born) / effect.life;
      if (t >= 1) {
        fxEffects.splice(i, 1);
        continue;
      }
      const alpha = (1 - t);
      fxCtx.save();
      fxCtx.globalAlpha = alpha * .92;
      fxCtx.shadowBlur = 18;
      fxCtx.shadowColor = 'rgba(84,236,255,.85)';
      fxCtx.strokeStyle = 'rgba(215,252,255,.96)';
      fxCtx.lineWidth = 1.2;
      fxCtx.beginPath();
      fxCtx.moveTo(effect.points[0].x, effect.points[0].y);
      effect.points.slice(1).forEach(pt => fxCtx.lineTo(pt.x, pt.y));
      fxCtx.stroke();

      fxCtx.globalAlpha = alpha * .45;
      fxCtx.lineWidth = .8;
      effect.branches.forEach(branch => {
        fxCtx.beginPath();
        fxCtx.moveTo(branch.from.x, branch.from.y);
        fxCtx.lineTo(branch.to.x, branch.to.y);
        fxCtx.stroke();
      });

      fxCtx.globalAlpha = alpha * .75;
      fxCtx.fillStyle = 'rgba(88,240,255,.95)';
      effect.sparks.forEach(spark => {
        const sx = spark.x + spark.vx * t * 48;
        const sy = spark.y + spark.vy * t * 48 + t * 8;
        fxCtx.beginPath();
        fxCtx.arc(sx, sy, 1.5 + (1 - t) * 1.2, 0, Math.PI * 2);
        fxCtx.fill();
      });
      fxCtx.restore();
    }
    if (fxEffects.length) fxRaf = requestAnimationFrame(animateFx);
    else fxRaf = 0;
  };

  const ensureFx = () => {
    if (!fxRaf) fxRaf = requestAnimationFrame(animateFx);
  };

  const createBolt = (x, y) => {
    if (!fxCtx || body.classList.contains('readable') || prefersReduced.matches) return;
    const pulse = document.createElement('span');
    pulse.className = 'click-pulse';
    pulse.style.left = `${x}px`;
    pulse.style.top = `${y}px`;
    document.body.appendChild(pulse);
    pulse.addEventListener('animationend', () => pulse.remove());

    createWebBurst(x, y);

    const angle = (-Math.PI / 2) + (Math.random() - .5) * 1.25;
    const length = 110 + Math.random() * 90;
    const segments = 9;
    const points = [{x, y}];
    for (let i = 1; i <= segments; i++) {
      const t = i / segments;
      points.push({
        x: x + Math.cos(angle) * length * t + (Math.random() - .5) * 26,
        y: y + Math.sin(angle) * length * t + (Math.random() - .5) * 20
      });
    }
    const branches = [];
    for (let i = 2; i < segments - 1; i += 2) {
      const from = points[i];
      branches.push({
        from,
        to: {
          x: from.x + (Math.random() - .5) * 52,
          y: from.y - 18 - Math.random() * 32
        }
      });
    }
    const sparks = Array.from({length: 10}, () => ({
      x,
      y,
      vx: (Math.random() - .5) * 2.8,
      vy: -Math.random() * 2.5 - .2
    }));
    fxEffects.push({born: performance.now(), life: 560, points, branches, sparks});
    ensureFx();
  };

  resizeFx();
  window.addEventListener('resize', resizeFx, {passive:true});
  document.addEventListener('pointerdown', e => {
    if (e.button !== undefined && e.button !== 0) return;
    createBolt(e.clientX, e.clientY);
  }, {passive:true});

})();
