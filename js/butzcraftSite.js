import { createCharacterPlayUrl, getCharacterPlayTarget } from './characterTransfer.js';
import { initializeSiteContent } from './siteContent.js';

initializeSiteContent();

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
contactForm?.addEventListener('submit', event => {
    event.preventDefault();
    const status = contactForm.querySelector('[data-contact-status]');
    const recipient = contactForm.dataset.recipient?.trim();
    if (!recipient) {
        status.textContent = 'Die Versandadresse muss vor der Veröffentlichung noch hinterlegt werden.';
        return;
    }

    const data = new FormData(contactForm);
    const subject = `[Butzcraft] ${data.get('subject')}`;
    const body = `Name: ${data.get('name')}\nE-Mail: ${data.get('email')}\n\n${data.get('message')}`;
    window.location.href = `mailto:${recipient}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    status.textContent = 'Dein E-Mail-Programm wird geöffnet. Bitte sende die vorbereitete Nachricht dort ab.';
});

const COOKIE_NOTICE_KEY = 'butzcraft-cookie-notice-v1';
document.body.insertAdjacentHTML('beforeend', `
    <aside class="cookie-notice" data-cookie-notice aria-labelledby="cookie-title" hidden>
        <h2 id="cookie-title">Deine Welt, deine Daten.</h2>
        <p>Butzcraft verwendet keine Analyse- oder Marketing-Cookies. Wir speichern nur technisch notwendige Einstellungen und – wenn du spielst – deinen Charakter und deine Spielstände lokal im Browser.</p>
        <div class="cookie-actions">
            <button class="button button-primary" type="button" data-cookie-accept>Verstanden</button>
            <button class="cookie-link" type="button" data-cookie-open>Einstellungen ansehen</button>
            <a class="cookie-link" href="datenschutz.html">Datenschutz</a>
        </div>
    </aside>
    <dialog class="cookie-dialog" data-cookie-dialog aria-labelledby="cookie-dialog-title">
        <div class="cookie-dialog-inner">
            <p class="eyebrow">Cookie-Einstellungen</p>
            <h2 id="cookie-dialog-title">Was Butzcraft speichert</h2>
            <p>Es sind keine Analyse-, Werbe- oder Drittanbieter-Cookies eingebunden. Technisch notwendige lokale Speicherungen sorgen dafür, dass deine Entscheidung, dein Charakterprofil und deine Spielstände in deinem Browser erhalten bleiben.</p>
            <div class="cookie-setting">
                <div><strong>Notwendige Speicherung</strong><p>Cookie-Hinweis, Spiel- und Grafikeinstellungen, Charakterprofil, lokale Spielstände und – nur im geschützten Redaktionsbereich – die Admin-Sitzung.</p></div>
                <span class="cookie-badge">Immer aktiv</span>
            </div>
            <div class="cookie-actions">
                <button class="button button-primary" type="button" data-cookie-save>Einstellungen speichern</button>
                <a class="cookie-link" href="datenschutz.html">Details im Datenschutz</a>
            </div>
        </div>
    </dialog>
`);

const cookieNotice = document.querySelector('[data-cookie-notice]');
const cookieDialog = document.querySelector('[data-cookie-dialog]');

function saveCookieChoice() {
    localStorage.setItem(COOKIE_NOTICE_KEY, 'necessary');
    cookieNotice.hidden = true;
    cookieDialog.close();
}

function openCookieSettings() {
    closeMenu();
    cookieDialog.showModal();
}

cookieNotice.querySelector('[data-cookie-accept]').addEventListener('click', saveCookieChoice);
cookieNotice.querySelector('[data-cookie-open]').addEventListener('click', openCookieSettings);
cookieDialog.querySelector('[data-cookie-save]').addEventListener('click', saveCookieChoice);
document.querySelectorAll('[data-cookie-settings]').forEach(button => button.addEventListener('click', openCookieSettings));
cookieNotice.hidden = localStorage.getItem(COOKIE_NOTICE_KEY) === 'necessary';
