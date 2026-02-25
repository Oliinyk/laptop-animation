(function () {

/* ── Helpers ── */
const clamp  = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const lerp   = (a, b, t)   => a + (b - a) * t;
const easeIO = t => t < .5 ? 4*t*t*t : 1 - Math.pow(-2*t + 2, 3) / 2;

/* ══════════════════════════════════
   1. HERO SCROLL — zoom + text + scrim
   ══════════════════════════════════ */
const hwZoom      = document.getElementById('hw-zoom');
const hwContainer = document.getElementById('hw-container');
const scrim       = document.getElementById('scrim');
const lines       = document.querySelectorAll('.hardware-zoom-copy p');

const PHASE = {
	scrimIn:  [0.10, 0.30],
	textIn:   [0.30, 0.68],
	scrimOut: [0.80, 0.95],
	zoomOut:  [0.75, 1.00],
};

function seg(p, from, to) { return clamp((p - from) / (to - from), 0, 1); }

function animateHero() {
	const rect     = hwZoom.getBoundingClientRect();
	const trackLen = rect.height - window.innerHeight;
	const p        = clamp(-rect.top / trackLen, 0, 1);

	/* Scrim overlay fades in then out */
	const scrimIn  = easeIO(seg(p, ...PHASE.scrimIn));
	const scrimOut = easeIO(seg(p, ...PHASE.scrimOut));
	scrim.style.opacity = Math.max(0, scrimIn - scrimOut);

	/* Text lines slide up from clip, then fade out with scrim */
	lines.forEach((line, i) => {
		const lineFrom = PHASE.textIn[0] + i * 0.07;
		const lineP    = easeIO(seg(p, lineFrom, lineFrom + 0.12));
		const fadeOut  = easeIO(seg(p, ...PHASE.scrimOut));
		line.style.transform = `translateY(${lerp(40, 0, lineP)}px)`;
		line.style.opacity   = lineP * (1 - fadeOut);
	});

	/* MacBook display: animated zoom on desktop (≥992px), fixed small scale on mobile */
	if (window.innerWidth >= 992) {
		hwContainer.style.transform = `scale(${lerp(1.7, 0.72, easeIO(seg(p, ...PHASE.zoomOut)))})`;
	} else {
		// hwContainer.style.transform = 'scale(0.38)';
        hwContainer.style.transform = `scale(${lerp(1.7, 0.38, easeIO(seg(p, ...PHASE.zoomOut)))})`;
	}

}

window.addEventListener('scroll', animateHero, { passive: true });
animateHero();

/* ══════════════════════════════════
   2. CONTENT REVEALS — IntersectionObserver
   ══════════════════════════════════ */
(function initContentReveals() {

	/* Text paragraphs: slide up from bottom, staggered by CSS nth-child delay */
	const textObserver = new IntersectionObserver((entries) => {
		entries.forEach(entry => {
			if (entry.isIntersecting) {
				entry.target.classList.add('revealed');
				textObserver.unobserve(entry.target);
			}
		});
	}, { threshold: 0.15, rootMargin: '0px 0px -60px 0px' });

	document.querySelectorAll('.reveal-text').forEach(el => textObserver.observe(el));

	/* Device images: fly in from sides (or bottom on mobile via CSS transform override) */
	const deviceObserver = new IntersectionObserver((entries) => {
		entries.forEach(entry => {
			if (entry.isIntersecting) {
				entry.target.classList.add('revealed');
				deviceObserver.unobserve(entry.target);
			}
		});
	}, { threshold: 0.20, rootMargin: '0px 0px -40px 0px' });

	['device-macbook', 'device-ipad'].forEach(id => {
		const el = document.getElementById(id);
		if (el) deviceObserver.observe(el);
	});

})();

/* ══════════════════════════════════
   3. STICKERS — drop animation + drag & drop
   ══════════════════════════════════ */
(function initStickers() {
	const board    = document.getElementById('sticker-board');
	const stickers = document.querySelectorAll('.sticker');
	let   zCounter = 10;

	/* Trigger drop animation when sticker board scrolls into view */
	const stickerObserver = new IntersectionObserver((entries) => {
		entries.forEach(entry => {
			if (entry.isIntersecting) {
				entry.target.classList.add('landed');
				stickerObserver.unobserve(entry.target);
			}
		});
	}, { threshold: 0.10, rootMargin: '0px 0px -40px 0px' });

	stickers.forEach(s => stickerObserver.observe(s));

	/* Drag & Drop */
	stickers.forEach(sticker => {
		let isDragging = false;
		let startX, startY, origLeft, origTop;
		const currentRot = parseFloat(sticker.dataset.rot) || 0;

		/*
		 * Resolve actual pixel position via getBoundingClientRect.
		 * Necessary because some stickers use `bottom`/`right` anchoring —
		 * reading style.left/top directly would return 0 and cause a jump.
		 */
		const resolvePos = () => {
			const sr = sticker.getBoundingClientRect();
			const br = board.getBoundingClientRect();
			return { left: sr.left - br.left, top: sr.top - br.top };
		};

		sticker.addEventListener('pointerdown', e => {
			if (!sticker.classList.contains('landed')) return;
			e.preventDefault();

			isDragging = true;
			sticker.setPointerCapture(e.pointerId);

			/* Freeze CSS animation */
			sticker.style.animation = 'none';
			sticker.style.opacity   = '1';

			/* Switch any bottom/right anchoring to top/left for consistent math */
			const pos = resolvePos();
			origLeft = pos.left;
			origTop  = pos.top;
			sticker.style.left   = `${origLeft}px`;
			sticker.style.top    = `${origTop}px`;
			sticker.style.right  = 'auto';
			sticker.style.bottom = 'auto';

			startX = e.clientX;
			startY = e.clientY;

			zCounter++;
			sticker.style.zIndex = zCounter;
			sticker.classList.add('dragging');
			sticker.style.transform = `rotate(${currentRot}deg) scale(1.1)`;
		});

		sticker.addEventListener('pointermove', e => {
			if (!isDragging) return;
			e.preventDefault();

			const dx = e.clientX - startX;
			const dy = e.clientY - startY;

			/* Lean into horizontal movement direction */
			const tilt = clamp(dx * 0.04, -10, 10);

			sticker.style.left      = `${origLeft + dx}px`;
			sticker.style.top       = `${origTop  + dy}px`;
			sticker.style.transform = `rotate(${currentRot + tilt}deg) scale(1.1)`;
		});

		const onRelease = e => {
			if (!isDragging) return;
			isDragging = false;
			sticker.classList.remove('dragging');

			const dx = e.clientX - startX;
			const dy = e.clientY - startY;
			const bw = board.offsetWidth;
			const bh = board.offsetHeight;
			const sw = sticker.offsetWidth;
			const sh = sticker.offsetHeight;

			/* Clamp so sticker stays mostly inside the board */
			sticker.style.left = `${clamp(origLeft + dx, -sw * 0.25, bw - sw * 0.75)}px`;
			sticker.style.top  = `${clamp(origTop  + dy, -sh * 0.25, bh - sh * 0.75)}px`;

			/* Landing wobble */
			sticker.classList.add('snap-back');
			const wobble = [
				`rotate(${currentRot + 2}deg) scale(1.02)`,
				`rotate(${currentRot - 1}deg) scale(0.99)`,
				`rotate(${currentRot}deg) scale(1)`,
			];
			let wi = 0;
			const doWobble = () => {
				if (wi >= wobble.length) { sticker.classList.remove('snap-back'); return; }
				sticker.style.transform = wobble[wi++];
				setTimeout(doWobble, 90);
			};
			setTimeout(doWobble, 320);
		};

		sticker.addEventListener('pointerup',     onRelease);
		sticker.addEventListener('pointercancel', onRelease);
	});

})();

})();


// cap-carousel
(function() {
  const CAROUSEL_ID = 'cap-carousel-001';
  const TRACK_ID    = 'cap-track-001';

  const capabilities = [
    {
      label: 'Music Composition and Notation',
      icon: `<svg viewBox="0 0 48 48" fill="none" stroke="url(#icon-grad)" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
        <path d="M18 36V16l22-4v20"/>
        <circle cx="14" cy="36" r="4"/>
        <circle cx="36" cy="32" r="4"/>
      </svg>`
    },
    {
      label: 'Bioinformatics',
      icon: `<svg viewBox="0 0 48 48" fill="none" stroke="url(#icon-grad)" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
        <path d="M16 8 C16 16 32 16 32 24 C32 32 16 32 16 40"/>
        <path d="M32 8 C32 16 16 16 16 24 C16 32 32 32 32 40"/>
        <line x1="13" y1="14" x2="35" y2="14"/>
        <line x1="13" y1="34" x2="35" y2="34"/>
      </svg>`
    },
    {
      label: 'DNA Sequencing',
      icon: `<svg viewBox="0 0 48 48" fill="none" stroke="url(#icon-grad)" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
        <rect x="8" y="8" width="8" height="8" rx="1"/>
        <rect x="8" y="20" width="8" height="8" rx="1"/>
        <rect x="8" y="32" width="8" height="8" rx="1"/>
        <rect x="32" y="8" width="8" height="8" rx="1"/>
        <rect x="32" y="20" width="8" height="8" rx="1"/>
        <rect x="32" y="32" width="8" height="8" rx="1"/>
        <line x1="16" y1="12" x2="32" y2="12"/>
        <line x1="16" y1="24" x2="32" y2="24"/>
        <line x1="16" y1="36" x2="32" y2="36"/>
      </svg>`
    },
    {
      label: 'Network Visualization',
      icon: `<svg viewBox="0 0 48 48" fill="none" stroke="url(#icon-grad)" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="24" cy="24" r="4"/>
        <circle cx="8"  cy="12" r="3"/>
        <circle cx="40" cy="12" r="3"/>
        <circle cx="8"  cy="36" r="3"/>
        <circle cx="40" cy="36" r="3"/>
        <line x1="11" y1="14" x2="21" y2="21"/>
        <line x1="37" y1="14" x2="27" y2="21"/>
        <line x1="11" y1="34" x2="21" y2="27"/>
        <line x1="37" y1="34" x2="27" y2="27"/>
      </svg>`
    },
    {
      label: 'Algorithm Development',
      icon: `<svg viewBox="0 0 48 48" fill="none" stroke="url(#icon-grad)" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
        <polyline points="8,24 16,14 24,30 32,18 40,24"/>
        <line x1="8" y1="38" x2="40" y2="38"/>
      </svg>`
    },

    {
      label: 'Illustration and Design',
      icon: `<svg viewBox="0 0 48 48" fill="none" stroke="url(#icon-grad)" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
        <path d="M12 36 L20 16 L28 28 L34 20 L40 36 Z"/>
        <circle cx="14" cy="14" r="5"/>
      </svg>`
    },
    {
      label: 'Evolutionary Simulation',
      icon: `<svg viewBox="0 0 48 48" fill="none" stroke="url(#icon-grad)" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
        <path d="M8 32 Q14 20 20 28 Q26 36 32 24 Q38 12 42 18"/>
        <polyline points="36,14 42,18 38,24"/>
      </svg>`
    },
    {
      label: 'Stage Sound and Lighting Programming',
      icon: `<svg viewBox="0 0 48 48" fill="none" stroke="url(#icon-grad)" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
        <polygon points="14,18 26,10 26,38 14,30"/>
        <path d="M30 18 Q36 24 30 30"/>
        <path d="M34 13 Q44 24 34 35"/>
        <circle cx="10" cy="40" r="3" fill="url(#icon-grad)" stroke="none"/>
      </svg>`
    },
    {
      label: 'Machine Learning Algorithms',
      icon: `<svg viewBox="0 0 48 48" fill="none" stroke="url(#icon-grad)" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
        <rect x="20" y="20" width="8" height="8"/>
        <circle cx="10" cy="10" r="3"/>
        <circle cx="38" cy="10" r="3"/>
        <circle cx="10" cy="38" r="3"/>
        <circle cx="38" cy="38" r="3"/>
        <line x1="13" y1="10" x2="20" y2="22"/>
        <line x1="35" y1="10" x2="28" y2="22"/>
        <line x1="13" y1="38" x2="20" y2="26"/>
        <line x1="35" y1="38" x2="28" y2="26"/>
      </svg>`
    },
    {
      label: 'Spectrometer Control',
      icon: `<svg viewBox="0 0 48 48" fill="none" stroke="url(#icon-grad)" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
        <line x1="8" y1="24" x2="40" y2="24"/>
        <line x1="14" y1="18" x2="14" y2="30"/>
        <line x1="20" y1="14" x2="20" y2="34"/>
        <line x1="26" y1="10" x2="26" y2="38"/>
        <line x1="32" y1="16" x2="32" y2="32"/>
        <line x1="38" y1="20" x2="38" y2="28"/>
      </svg>`
    },
    {
      label: 'Kinematic and Dynamic Modeling',
      icon: `<svg viewBox="0 0 48 48" fill="none" stroke="url(#icon-grad)" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="12" cy="12" r="4"/>
        <circle cx="36" cy="24" r="4"/>
        <circle cx="14" cy="38" r="4"/>
        <line x1="15" y1="15" x2="33" y2="22"/>
        <line x1="34" y1="27" x2="17" y2="36"/>
      </svg>`
    },
    {
      label: 'Video Production and Editing',
      icon: `<svg viewBox="0 0 48 48" fill="none" stroke="url(#icon-grad)" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
        <rect x="6" y="14" width="26" height="20"/>
        <polyline points="32,20 42,14 42,34 32,28"/>
        <line x1="12" y1="20" x2="12" y2="28"/>
        <line x1="18" y1="20" x2="18" y2="28"/>
        <line x1="24" y1="20" x2="24" y2="28"/>
      </svg>`
    },
    {
      label: 'Interactive Geometry',
      icon: `<svg viewBox="0 0 48 48" fill="none" stroke="url(#icon-grad)" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
        <polygon points="24,8 40,36 8,36"/>
        <circle cx="24" cy="8"  r="2.5" fill="url(#icon-grad)" stroke="url(#icon-grad)"/>
        <circle cx="40" cy="36" r="2.5" fill="url(#icon-grad)" stroke="url(#icon-grad)"/>
        <circle cx="8"  cy="36" r="2.5" fill="url(#icon-grad)" stroke="url(#icon-grad)"/>
        <line x1="24" y1="8" x2="24" y2="36"/>
      </svg>`
    },
    {
      label: 'Nuclear Magnetic Resonance Processing',
      icon: `<svg viewBox="0 0 48 48" fill="none" stroke="url(#icon-grad)" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="24" cy="24" r="14"/>
        <circle cx="24" cy="24" r="6"/>
        <line x1="24" y1="6"  x2="24" y2="10"/>
        <line x1="24" y1="38" x2="24" y2="42"/>
        <line x1="6"  y1="24" x2="10" y2="24"/>
        <line x1="38" y1="24" x2="42" y2="24"/>
      </svg>`
    },
    {
      label: 'Molecular Evolutionary Genetics Analysis',
      icon: `<svg viewBox="0 0 48 48" fill="none" stroke="url(#icon-grad)" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="24" cy="24" r="10"/>
        <circle cx="24" cy="24" r="3"/>
        <line x1="24" y1="8" x2="24" y2="14"/>
        <line x1="24" y1="34" x2="24" y2="40"/>
        <line x1="8" y1="24" x2="14" y2="24"/>
        <line x1="34" y1="24" x2="40" y2="24"/>
        <line x1="13" y1="13" x2="17" y2="17"/>
        <line x1="31" y1="31" x2="35" y2="35"/>
        <line x1="35" y1="13" x2="31" y2="17"/>
        <line x1="17" y1="31" x2="13" y2="35"/>
      </svg>`
    },
    {
      label: 'Programming in C, C++, CSS, HTML, Java, JS, Python, R, Ruby, Rust, SQL, TypeScript, and more',
      icon: `<svg viewBox="0 0 48 48" fill="none" stroke="url(#icon-grad)" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
        <polyline points="16,16 8,24 16,32"/>
        <polyline points="32,16 40,24 32,32"/>
        <line x1="22" y1="12" x2="26" y2="36"/>
      </svg>`
    },
    {
      label: 'Chemical Drawing and Analysis',
      icon: `<svg viewBox="0 0 48 48" fill="none" stroke="url(#icon-grad)" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
        <line x1="24" y1="8"  x2="38" y2="16"/>
        <line x1="38" y1="16" x2="38" y2="32"/>
        <line x1="38" y1="32" x2="24" y2="40"/>
        <line x1="24" y1="40" x2="10" y2="32"/>
        <line x1="10" y1="32" x2="10" y2="16"/>
        <line x1="10" y1="16" x2="24" y2="8"/>
        <circle cx="24" cy="24" r="5"/>
      </svg>`
    }
  ];

  function buildCard(item) {
    const card = document.createElement('div');
    card.className = 'cap-card';
    card.setAttribute('aria-label', item.label);

    const icon = document.createElement('div');
    icon.className = 'cap-icon';
    icon.innerHTML = item.icon;

    const label = document.createElement('span');
    label.className = 'cap-label';
    label.textContent = item.label;

    card.appendChild(icon);
    card.appendChild(label);
    return card;
  }

  const track = document.getElementById(TRACK_ID);
  if (track) {
    // Build cards twice for seamless loop
    const allItems = [...capabilities, ...capabilities];
    allItems.forEach(item => track.appendChild(buildCard(item)));
  }
})();



// faq
document.querySelectorAll('.faq-question').forEach(question => {
	question.addEventListener('click', () => {
		const clickedItem = question.closest('.faq-item');
		const isOpen = clickedItem.classList.contains('is-open');

		// close all
		document.querySelectorAll('.faq-item').forEach(item => {
			item.classList.remove('is-open');
		});

		// open clicked (unless it was already open — toggle)
		if (!isOpen) {
			clickedItem.classList.add('is-open');
		}
	});
});
