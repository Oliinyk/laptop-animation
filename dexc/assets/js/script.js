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