const DAMAGE_COOLDOWN_MS = 250;
const SHAKE_DURATION_MS = 150;

export class DamageFeedback {
    constructor(canvas) {
        this.canvas = canvas;
        this.lastAt = 0;
        this.flashElement = null;
        this.shakeUntil = 0;
        this.shakeMagnitude = 0;
    }

    trigger(amount) {
        const now = performance.now();
        if (now - this.lastAt < DAMAGE_COOLDOWN_MS) return;
        this.lastAt = now;

        const flash = this._ensureFlashElement();
        const intensity = Math.min(1, amount / 8);
        flash.style.opacity = String(0.4 + 0.5 * intensity);
        requestAnimationFrame(() => requestAnimationFrame(() => {
            flash.style.opacity = '0';
        }));

        this.shakeUntil = now + SHAKE_DURATION_MS;
        this.shakeMagnitude = 0.025 * intensity;
    }

    update() {
        if (!this.canvas) return;
        const now = performance.now();
        if (now >= this.shakeUntil || this.shakeMagnitude <= 0) {
            if (this.canvas.style.transform) this.canvas.style.transform = '';
            return;
        }

        const remaining = (this.shakeUntil - now) / SHAKE_DURATION_MS;
        const magnitude = this.shakeMagnitude * remaining;
        const angle = Math.sin(now * 0.05) * magnitude * 0.5;
        this.canvas.style.transform = `rotate(${angle}rad)`;
    }

    dispose() {
        this.flashElement?.remove();
        this.flashElement = null;
        if (this.canvas?.style.transform) this.canvas.style.transform = '';
    }

    _ensureFlashElement() {
        if (this.flashElement) return this.flashElement;
        const element = this.canvas.ownerDocument.createElement('div');
        element.id = 'damage-flash';
        element.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:200;opacity:0;background:radial-gradient(ellipse at center, transparent 35%, rgba(180,0,0,0.55) 100%);transition:opacity 250ms ease-out;';
        this.canvas.ownerDocument.body.appendChild(element);
        this.flashElement = element;
        return element;
    }
}
