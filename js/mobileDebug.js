// Persistentes Debug-Overlay für Mobile-Browser ohne Remote-DevTools.
// Lädt VOR allem anderen (kein ES-Module-Import), damit auch frühe Module-Load-Fehler
// von GameMain.js sichtbar werden. Aktiv, wenn das Gerät Touch hat oder ?debug=1 in der URL steht.
(function () {
    if (window.__butzcraftMobileDebugInstalled) return;
    window.__butzcraftMobileDebugInstalled = true;

    const params = new URLSearchParams(window.location.search);
    const forceOn = params.has('debug');
    const forceOff = params.get('debug') === '0';
    const isTouch = ('ontouchstart' in window)
        || (navigator.maxTouchPoints > 0)
        || window.matchMedia?.('(pointer: coarse)').matches;
    const enabled = !forceOff && (forceOn || isTouch);

    const buffer = [];
    const MAX = 80;

    function push(level, args) {
        const ts = new Date().toISOString().substring(11, 19);
        let msg;
        try {
            msg = Array.from(args).map(a => {
                if (a instanceof Error) return (a.stack || a.message || String(a));
                if (typeof a === 'object') return JSON.stringify(a);
                return String(a);
            }).join(' ');
        } catch (_) {
            msg = '[unserialisierbar]';
        }
        buffer.push({ ts, level, msg });
        if (buffer.length > MAX) buffer.shift();
        if (enabled) render();
    }

    let panel, list, badge;
    let collapsed = true;

    function ensurePanel() {
        if (panel) return;
        panel = document.createElement('div');
        panel.id = 'butzcraft-mdebug';
        panel.style.cssText = [
            'position:fixed', 'top:6px', 'right:6px', 'z-index:99999',
            'font-family:monospace', 'font-size:11px', 'color:#fff',
            'max-width:min(92vw, 520px)', 'pointer-events:auto',
            'box-shadow:0 2px 8px rgba(0,0,0,0.6)', 'border-radius:6px'
        ].join(';');

        const header = document.createElement('div');
        header.style.cssText = [
            'display:flex', 'align-items:center', 'gap:6px',
            'background:#222', 'padding:6px 8px', 'cursor:pointer',
            'border-radius:6px 6px 0 0', 'user-select:none'
        ].join(';');

        badge = document.createElement('span');
        badge.textContent = 'DEBUG';
        badge.style.cssText = 'background:#e67e22;padding:1px 6px;border-radius:3px;font-weight:bold;';

        const title = document.createElement('span');
        title.textContent = 'Mobile-Log';
        title.style.flex = '1';

        const copyBtn = document.createElement('button');
        copyBtn.textContent = '📋';
        copyBtn.title = 'In Zwischenablage kopieren';
        copyBtn.style.cssText = 'background:#444;color:#fff;border:none;border-radius:3px;padding:2px 8px;font-size:12px;';
        copyBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            const txt = buffer.map(b => `[${b.ts}] ${b.level.toUpperCase()} ${b.msg}`).join('\n');
            try {
                navigator.clipboard.writeText(txt);
                copyBtn.textContent = '✓';
                setTimeout(() => { copyBtn.textContent = '📋'; }, 1200);
            } catch (_) {
                const ta = document.createElement('textarea');
                ta.value = txt;
                document.body.appendChild(ta);
                ta.select();
                try { document.execCommand('copy'); } catch (_) {}
                ta.remove();
            }
        });

        const clearBtn = document.createElement('button');
        clearBtn.textContent = '✕';
        clearBtn.title = 'Logs leeren';
        clearBtn.style.cssText = 'background:#444;color:#fff;border:none;border-radius:3px;padding:2px 8px;font-size:12px;';
        clearBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            buffer.length = 0;
            render();
        });

        header.appendChild(badge);
        header.appendChild(title);
        header.appendChild(copyBtn);
        header.appendChild(clearBtn);
        header.addEventListener('click', () => {
            collapsed = !collapsed;
            list.style.display = collapsed ? 'none' : 'block';
        });

        list = document.createElement('div');
        list.style.cssText = [
            'background:rgba(0,0,0,0.85)', 'max-height:40vh', 'overflow-y:auto',
            'padding:6px 8px', 'border-radius:0 0 6px 6px', 'display:none',
            'word-break:break-word', 'white-space:pre-wrap'
        ].join(';');

        panel.appendChild(header);
        panel.appendChild(list);

        if (document.body) {
            document.body.appendChild(panel);
        } else {
            document.addEventListener('DOMContentLoaded', () => document.body.appendChild(panel), { once: true });
        }
    }

    function render() {
        if (!enabled) return;
        ensurePanel();
        if (!list) return;
        const errCount = buffer.filter(b => b.level === 'error').length;
        const warnCount = buffer.filter(b => b.level === 'warn').length;
        if (badge) {
            if (errCount > 0) {
                badge.textContent = `ERR ${errCount}`;
                badge.style.background = '#c0392b';
                if (collapsed) {
                    collapsed = false;
                    list.style.display = 'block';
                }
            } else if (warnCount > 0) {
                badge.textContent = `WARN ${warnCount}`;
                badge.style.background = '#e67e22';
            } else {
                badge.textContent = `LOG ${buffer.length}`;
                badge.style.background = '#27ae60';
            }
        }
        const html = buffer.slice(-40).map(b => {
            const color = b.level === 'error' ? '#ff8a80'
                : b.level === 'warn' ? '#ffd966'
                : b.level === 'info' ? '#8ecae6'
                : '#ccc';
            const prefix = `[${b.ts}] ${b.level.toUpperCase()}: `;
            const escape = s => s.replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
            return `<div style="color:${color};margin-bottom:2px;">${escape(prefix + b.msg)}</div>`;
        }).join('');
        list.innerHTML = html;
        list.scrollTop = list.scrollHeight;
    }

    const origError = console.error.bind(console);
    const origWarn = console.warn.bind(console);
    const origLog = console.log.bind(console);
    const origInfo = console.info.bind(console);

    console.error = function () { push('error', arguments); origError(...arguments); };
    console.warn = function () { push('warn', arguments); origWarn(...arguments); };
    console.info = function () { push('info', arguments); origInfo(...arguments); };
    if (params.has('debugVerbose')) {
        console.log = function () { push('log', arguments); origLog(...arguments); };
    }

    window.addEventListener('error', (event) => {
        const msg = event.error?.stack || event.message || 'Unbekannter Fehler';
        push('error', [`[window.error] ${msg} @ ${event.filename || '?'}:${event.lineno || '?'}`]);
    });
    window.addEventListener('unhandledrejection', (event) => {
        const reason = event.reason;
        const msg = reason?.stack || reason?.message || String(reason);
        push('error', [`[unhandledrejection] ${msg}`]);
    });

    window.__butzcraftMobileDebug = {
        log: (...args) => push('log', args),
        info: (...args) => push('info', args),
        warn: (...args) => push('warn', args),
        error: (...args) => push('error', args),
        enabled,
        isTouch,
        buffer
    };

    if (enabled) {
        push('info', [`Debug-Overlay aktiv (touch=${isTouch}, force=${forceOn}). UA: ${navigator.userAgent}`]);
    }
})();
