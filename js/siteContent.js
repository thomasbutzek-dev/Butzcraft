const CONTENT_ENDPOINT = '/api/site-content';
const SESSION_ENDPOINT = '/api/admin/session';
const LOGIN_ENDPOINT = '/api/admin/login';
const LOGOUT_ENDPOINT = '/api/admin/logout';
const IMAGE_ENDPOINT = '/api/admin/image';

export async function initializeSiteContent() {
    if (!document.body.hasAttribute('data-site-content-root')) return;

    let content = { texts: {}, images: {} };
    try {
        content = normalizeContent(await requestJson(CONTENT_ENDPOINT));
        applyContent(content);
    } catch {
        // Die statische Vorschau bleibt auch ohne Inhalts-API vollständig nutzbar.
    }

    if (new URLSearchParams(window.location.search).get('edit') !== '1') return;
    setupAdminMode(content);
}

function applyContent(content) {
    for (const element of document.querySelectorAll('[data-content-key]')) {
        const value = content.texts[element.dataset.contentKey];
        if (typeof value === 'string') element.innerHTML = value.replace(/\r?\n/g, '<br>');
    }

    for (const image of document.querySelectorAll('[data-image-key]')) {
        const value = content.images[image.dataset.imageKey];
        if (typeof value !== 'string') continue;
        image.src = value;
        image.dataset.siteImageValue = value;
        image.closest('.world-card-placeholder')?.classList.add('has-custom-image');
    }
}

function setupAdminMode(initialContent) {
    let content = initialContent;
    let selectedImage = null;

    document.body.insertAdjacentHTML('beforeend', `
        <aside class="site-admin-login" data-admin-login aria-labelledby="admin-login-title">
            <div class="site-admin-login-card">
                <p class="eyebrow">Geschützter Bereich</p>
                <h2 id="admin-login-title">Butzcraft bearbeiten</h2>
                <p>Melde dich an, um Texte direkt anzuklicken und Bilder auszutauschen.</p>
                <form data-admin-login-form>
                    <label>Benutzername <input name="username" autocomplete="username" required></label>
                    <label>Passwort <input name="password" type="password" autocomplete="current-password" required></label>
                    <button class="button button-primary" type="submit">Anmelden</button>
                    <p class="form-status" data-admin-login-status role="status"></p>
                </form>
            </div>
        </aside>
        <aside class="site-admin-bar" data-admin-bar hidden aria-label="Redaktionswerkzeuge">
            <div><strong>Bearbeitungsmodus</strong><p data-admin-status>Texte anklicken oder ein Bild auswählen.</p></div>
            <div class="site-editor-tools" data-admin-tools role="toolbar" aria-label="Text formatieren">
                <button type="button" data-editor-command="bold" title="Fett" aria-label="Fett"><strong>F</strong></button>
                <button type="button" data-editor-command="italic" title="Kursiv" aria-label="Kursiv"><em>K</em></button>
                <button type="button" data-editor-command="underline" title="Unterstreichen" aria-label="Unterstreichen"><u>U</u></button>
                <button type="button" data-editor-link title="Link einfügen" aria-label="Link einfügen">Link</button>
                <button type="button" data-editor-break title="Zeilenumbruch" aria-label="Zeilenumbruch">↵</button>
                <button type="button" data-editor-command="removeFormat" title="Formatierung entfernen" aria-label="Formatierung entfernen">Tx</button>
            </div>
            <div class="site-admin-actions">
                <button class="button site-admin-logout" type="button" data-admin-logout>Abmelden</button>
                <button class="button button-primary" type="button" data-admin-save>Änderungen speichern</button>
            </div>
            <input type="file" accept="image/jpeg,image/png,image/webp" data-admin-image-input hidden>
        </aside>
    `);

    const loginOverlay = document.querySelector('[data-admin-login]');
    const loginForm = document.querySelector('[data-admin-login-form]');
    const loginStatus = document.querySelector('[data-admin-login-status]');
    const adminBar = document.querySelector('[data-admin-bar]');
    const adminStatus = document.querySelector('[data-admin-status]');
    const editorTools = document.querySelector('[data-admin-tools]');
    const imageInput = document.querySelector('[data-admin-image-input]');
    let activeEditable = null;

    checkSession();

    loginForm.addEventListener('submit', async event => {
        event.preventDefault();
        loginStatus.textContent = 'Anmeldung wird geprüft …';
        const formData = new FormData(loginForm);
        try {
            await requestJson(LOGIN_ENDPOINT, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    username: formData.get('username'),
                    password: formData.get('password')
                })
            });
            loginForm.reset();
            activateEditing();
        } catch (error) {
            loginStatus.textContent = error.message;
        }
    });

    document.querySelector('[data-admin-save]').addEventListener('click', async () => {
        adminStatus.textContent = 'Änderungen werden gespeichert …';
        const nextContent = collectContent(content);
        try {
            content = normalizeContent(await requestJson(CONTENT_ENDPOINT, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(nextContent)
            }));
            adminStatus.textContent = 'Gespeichert. Die öffentliche Seite ist aktualisiert.';
        } catch (error) {
            adminStatus.textContent = error.message;
        }
    });

    document.querySelector('[data-admin-logout]').addEventListener('click', async () => {
        try {
            await requestJson(LOGOUT_ENDPOINT, { method: 'POST' });
        } finally {
            window.location.replace('/');
        }
    });

    editorTools.addEventListener('mousedown', event => event.preventDefault());
    editorTools.addEventListener('click', event => {
        const button = event.target.closest('button');
        if (!button || !activeEditable) return;
        activeEditable.focus();

        if (button.dataset.editorCommand) {
            document.execCommand(button.dataset.editorCommand, false);
        } else if (button.hasAttribute('data-editor-break')) {
            document.execCommand('insertHTML', false, '<br>');
        } else if (button.hasAttribute('data-editor-link')) {
            const href = window.prompt('Zieladresse des Links (https:// …)');
            if (!href) return;
            if (!/^https?:\/\//i.test(href) && !href.startsWith('/')) {
                adminStatus.textContent = 'Links müssen mit https:// oder / beginnen.';
                return;
            }
            document.execCommand('createLink', false, href);
        }

        adminStatus.textContent = 'Text geändert. Zum Veröffentlichen noch speichern.';
    });

    document.addEventListener('focusin', event => {
        const editable = event.target.closest?.('[data-content-key]');
        if (!editable || !document.body.classList.contains('site-edit-mode')) return;
        activeEditable = editable;
        editorTools.classList.add('is-active');
    });

    document.addEventListener('input', event => {
        if (event.target.closest?.('[data-content-key]')) {
            adminStatus.textContent = 'Text geändert. Zum Veröffentlichen noch speichern.';
        }
    });

    for (const image of document.querySelectorAll('[data-image-key]')) {
        const selectImage = event => {
            if (!document.body.classList.contains('site-edit-mode')) return;
            event.preventDefault();
            event.stopPropagation();
            selectedImage = image;
            imageInput.click();
        };
        image.addEventListener('click', selectImage);
        image.addEventListener('keydown', event => {
            if (event.key === 'Enter' || event.key === ' ') selectImage(event);
        });
    }

    document.addEventListener('click', event => {
        if (!document.body.classList.contains('site-edit-mode')) return;
        if (event.target.closest('[data-content-key]')) event.preventDefault();
    }, true);

    imageInput.addEventListener('change', async () => {
        const file = imageInput.files?.[0];
        imageInput.value = '';
        if (!file || !selectedImage) return;
        adminStatus.textContent = 'Bild wird für das Web vorbereitet …';
        try {
            const dataUrl = await resizeImage(file);
            const result = await requestJson(IMAGE_ENDPOINT, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ key: selectedImage.dataset.imageKey, dataUrl })
            });
            selectedImage.src = result.url;
            selectedImage.dataset.siteImageValue = result.url;
            selectedImage.closest('.world-card-placeholder')?.classList.add('has-custom-image');
            content.images[selectedImage.dataset.imageKey] = result.url;
            adminStatus.textContent = 'Bild ausgetauscht. Zum Veröffentlichen noch speichern.';
        } catch (error) {
            adminStatus.textContent = error.message;
        }
    });

    async function checkSession() {
        try {
            const session = await requestJson(SESSION_ENDPOINT);
            if (session.authenticated) activateEditing();
        } catch (error) {
            loginStatus.textContent = error.message;
        }
    }

    function activateEditing() {
        loginOverlay.hidden = true;
        adminBar.hidden = false;
        document.body.classList.add('site-edit-mode');
        document.querySelectorAll('[data-reveal]').forEach(element => element.classList.add('is-visible'));
        for (const element of document.querySelectorAll('[data-content-key]')) {
            element.contentEditable = 'true';
            element.spellcheck = true;
        }
        for (const image of document.querySelectorAll('[data-image-key]')) {
            image.tabIndex = 0;
            image.setAttribute('role', 'button');
            image.setAttribute('aria-label', 'Bild ändern');
        }
    }
}

function collectContent(currentContent) {
    const texts = {};
    for (const element of document.querySelectorAll('[data-content-key]')) {
        texts[element.dataset.contentKey] = serializeEditableContent(element);
    }

    const images = { ...currentContent.images };
    for (const image of document.querySelectorAll('[data-image-key]')) {
        if (image.dataset.siteImageValue) images[image.dataset.imageKey] = image.dataset.siteImageValue;
    }
    return { texts, images };
}

function serializeEditableContent(element) {
    const serializeChildren = parent => {
        let html = '';
        for (const node of parent.childNodes) {
            if (node.nodeType === Node.TEXT_NODE) {
                html += escapeHtml(node.textContent).replace(/\r?\n/g, '<br>');
                continue;
            }
            if (node.nodeType !== Node.ELEMENT_NODE) continue;

            const tag = node.tagName.toLowerCase();
            const children = serializeChildren(node);
            if (tag === 'br') html += '<br>';
            else if (tag === 'b' || tag === 'strong') html += `<strong>${children}</strong>`;
            else if (tag === 'i' || tag === 'em') html += `<em>${children}</em>`;
            else if (tag === 'u') html += `<u>${children}</u>`;
            else if (tag === 'a') {
                const href = node.getAttribute('href') || '';
                html += (/^https?:\/\//i.test(href) || href.startsWith('/'))
                    ? `<a href="${escapeHtml(href)}">${children}</a>`
                    : children;
            } else if (tag === 'div' || tag === 'p') {
                if (html && !html.endsWith('<br>')) html += '<br>';
                html += children;
            } else {
                html += children;
            }
        }
        return html;
    };

    return serializeChildren(element).replace(/^(<br>)+|(<br>)+$/g, '').trim();
}

function escapeHtml(value) {
    return String(value)
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;');
}

function normalizeContent(value) {
    return {
        texts: value?.texts && typeof value.texts === 'object' ? value.texts : {},
        images: value?.images && typeof value.images === 'object' ? value.images : {},
        updatedAt: value?.updatedAt || null
    };
}

async function requestJson(url, options = {}) {
    const response = await fetch(url, { credentials: 'same-origin', ...options });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || 'Die Anfrage konnte nicht ausgeführt werden.');
    return data;
}

async function resizeImage(file) {
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
        throw new Error('Bitte ein JPG-, PNG- oder WebP-Bild auswählen.');
    }

    const sourceUrl = URL.createObjectURL(file);
    try {
        const image = await loadImage(sourceUrl);
        const scale = Math.min(1, 1920 / Math.max(image.naturalWidth, image.naturalHeight));
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
        canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
        canvas.getContext('2d').drawImage(image, 0, 0, canvas.width, canvas.height);
        const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/webp', .86));
        if (!blob) throw new Error('Das Bild konnte nicht verarbeitet werden.');
        return readAsDataUrl(blob);
    } finally {
        URL.revokeObjectURL(sourceUrl);
    }
}

function loadImage(source) {
    return new Promise((resolve, reject) => {
        const image = new Image();
        image.onload = () => resolve(image);
        image.onerror = () => reject(new Error('Das Bild konnte nicht gelesen werden.'));
        image.src = source;
    });
}

function readAsDataUrl(blob) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(new Error('Das Bild konnte nicht gelesen werden.'));
        reader.readAsDataURL(blob);
    });
}
