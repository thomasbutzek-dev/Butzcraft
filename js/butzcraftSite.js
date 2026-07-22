import { createCharacterPlayUrl, getCharacterPlayTarget } from './characterTransfer.js';
import { initializeSiteContent } from './siteContent.js';
import { APP_VERSION } from './version.js';

initializeSiteContent();
document.querySelectorAll('[data-app-version]').forEach(element => { element.textContent = APP_VERSION; });

const hero = document.querySelector('[data-cinematic-hero]');
const heroVideo = document.querySelector('[data-hero-video]');
const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
let desiredHeroTime = 0;

function seekHeroVideo() {
    if (!heroVideo || heroVideo.readyState < 1 || heroVideo.seeking || motionQuery.matches) return;
    const duration = Number.isFinite(heroVideo.duration) ? heroVideo.duration : 5;
    const target = Math.min(Math.max(0, duration - 0.04), desiredHeroTime);
    if (Math.abs(heroVideo.currentTime - target) > 0.025) heroVideo.currentTime = target;
}

function updateHero() {
    if (!hero || motionQuery.matches) return;
    const rect = hero.getBoundingClientRect();
    const distance = Math.max(1, rect.height - window.innerHeight);
    const progress = Math.min(1, Math.max(0, -rect.top / distance));
    const blend = progress * progress * (3 - 2 * progress);
    hero.style.setProperty('--hero-progress', progress.toFixed(4));
    hero.style.setProperty('--hero-blend', blend.toFixed(4));
    if (heroVideo?.readyState >= 1) {
        desiredHeroTime = progress * heroVideo.duration;
        seekHeroVideo();
    }
}

let scheduled = false;
function scheduleHeroUpdate() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => {
        updateHero();
        scheduled = false;
    });
}

updateHero();
window.addEventListener('scroll', scheduleHeroUpdate, { passive: true });
window.addEventListener('resize', scheduleHeroUpdate);
motionQuery.addEventListener?.('change', scheduleHeroUpdate);

heroVideo?.addEventListener('loadedmetadata', () => {
    heroVideo.pause();
    heroVideo.classList.add('is-ready');
    updateHero();
});
heroVideo?.addEventListener('seeked', seekHeroVideo);
if (heroVideo?.readyState >= 1) {
    heroVideo.pause();
    heroVideo.classList.add('is-ready');
    updateHero();
}

const revealObserver = new IntersectionObserver(entries => {
    for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        entry.target.classList.add('is-visible');
        revealObserver.unobserve(entry.target);
    }
}, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });

document.querySelectorAll('[data-reveal]').forEach(element => revealObserver.observe(element));

const siteNav = document.querySelector('.site-nav');
const menuToggle = siteNav?.querySelector('.nav-menu-toggle');

function closeMenu() {
    siteNav?.classList.remove('is-open');
    menuToggle?.setAttribute('aria-expanded', 'false');
}

menuToggle?.addEventListener('click', () => {
    const isOpen = siteNav.classList.toggle('is-open');
    menuToggle.setAttribute('aria-expanded', String(isOpen));
});
siteNav?.querySelectorAll('.nav-links a').forEach(link => link.addEventListener('click', closeMenu));
document.addEventListener('keydown', event => {
    if (event.key === 'Escape') closeMenu();
});
document.addEventListener('click', event => {
    if (siteNav?.classList.contains('is-open') && !siteNav.contains(event.target)) closeMenu();
});

const characterEditorFrame = document.getElementById('landing-character-editor');
const playCreatedCharacterButton = document.getElementById('play-created-character');
const characterTransferStatus = document.getElementById('character-transfer-status');
let restoreContactAnchorAfterEditorResize = window.location.hash === '#kontakt';

if (restoreContactAnchorAfterEditorResize) {
    window.addEventListener('load', () => {
        requestAnimationFrame(() => document.getElementById('kontakt')?.scrollIntoView());
    }, { once: true });
}

playCreatedCharacterButton?.addEventListener('click', () => {
    if (!characterEditorFrame?.contentWindow) return;
    characterTransferStatus.textContent = 'Charakter wird übernommen …';
    characterEditorFrame.contentWindow.postMessage({ type: 'apply-profile' }, window.location.origin);
});

window.addEventListener('message', event => {
    if (event.origin !== window.location.origin || event.source !== characterEditorFrame?.contentWindow) return;
    if (event.data?.type === 'editor-height') {
        const height = Number(event.data.height);
        if (Number.isFinite(height)) characterEditorFrame.style.height = `${Math.min(2600, Math.max(620, height))}px`;
        if (restoreContactAnchorAfterEditorResize) {
            restoreContactAnchorAfterEditorResize = false;
            requestAnimationFrame(() => document.getElementById('kontakt')?.scrollIntoView());
        }
        return;
    }
    if (event.data?.type === 'apply-profile' && event.data.profile) {
        window.location.assign(createCharacterPlayUrl(event.data.profile, getCharacterPlayTarget()));
    }
});

const contactForm = document.querySelector('[data-contact-form]');
contactForm?.addEventListener('submit', async event => {
    event.preventDefault();
    const status = contactForm.querySelector('[data-contact-status]');
    const data = new FormData(contactForm);
    const submitButton = contactForm.querySelector('button[type="submit"]');
    submitButton.disabled = true;
    status.textContent = 'Deine Nachricht wird versendet …';

    try {
        const response = await fetch('/api/contact', {
            method: 'POST',
            credentials: 'same-origin',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                name: data.get('name'),
                email: data.get('email'),
                subject: data.get('subject'),
                message: data.get('message'),
                privacy: data.get('privacy') === 'on',
                website: data.get('website')
            })
        });
        const result = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(result.error || 'Die Nachricht konnte nicht versendet werden.');
        contactForm.reset();
        status.textContent = 'Deine Nachricht ist am Lagerfeuer angekommen. Danke!';
    } catch (error) {
        status.textContent = error.message;
    } finally {
        submitButton.disabled = false;
    }
});
