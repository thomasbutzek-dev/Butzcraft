import { APP_VERSION } from './version.js';

export const DEVELOPER_DIARY_ENTRIES = Object.freeze([
    Object.freeze({
        version: '0.2.0',
        date: '2026-07-23',
        title: 'Butzcraft erblickt das Licht der Welt',
        summary: 'Mit Version 0.2.0 erblickte Butzcraft das Licht der Welt und wurde erstmals veröffentlicht. Bewegte Himmelskörper, Tiere passend zu ihren Lebensräumen und zwei besondere Wächter gaben der jungen Welt schon zum Start Eigenleben und große Ziele.',
        changes: Object.freeze([
            'Der Tiefenwächter wartet am Ende großer Minen und schützt die dortige Belohnungskammer.',
            'Mit dem Siegelhüter erhielt auch der Dungeon einen eigenen Boss, der sich klar von gewöhnlichen Gegnern unterscheidet.',
            'Sonne und Mond ziehen sichtbar über den Himmel; während einer Blutmondnacht erscheint der Mond erheblich größer und färbt das Nachtlicht.',
            'Schnee, Wüste, Ozean und gemäßigte Landschaften besitzen eigene Tiergruppen – darunter Pinguine, Robben, Kamele, Füchse und Meerestiere.',
            'Butzcraft ging offiziell als Version 0.2.0 an den Start; eine zentrale Versionsanzeige und die neue Serverstatistik machen Release-Stand und Spielaufrufe nachvollziehbar.'
        ])
    }),
    Object.freeze({
        version: '0.2.1',
        date: '2026-07-23',
        title: 'Neue Kanten für deinen Helden',
        summary: 'Version 0.2.1 konzentrierte sich vollständig auf die Spielfigur. Das gemeinsame Modell für Spiel und Editor wurde neu proportioniert, stärker gegliedert und an den malerischen Blockstil der Welt angepasst.',
        changes: Object.freeze([
            'Abgerundete Blockformen geben Kopf, Körper und Gliedmaßen eine weichere, aber weiterhin klar blockige Silhouette.',
            'Arme bestehen nun sichtbar aus Ärmeln, Bündchen, Unterarmen und Händen; Hosenbeine und Stiefel wurden ebenfalls getrennt aufgebaut.',
            'Augenweiß, Iris, Gesicht und Haare erhielten feinere Formen, damit der Charakter auch aus der Nähe lesbarer wirkt.',
            'Farbverläufe, malerische Materialkörnung und weichere Konturen ersetzen einen Teil der früheren harten Pixelwirkung.',
            'Charaktereditor und laufendes Spiel verwenden weiterhin dasselbe Modell, sodass der erstellte Look ohne Stilbruch übernommen wird.'
        ])
    }),
    Object.freeze({
        version: '0.2.2',
        date: '2026-07-23',
        title: 'Rüstung für jede Reise',
        summary: 'Mit Version 0.2.2 wurde Ausrüstung zu einem vollständigen Spielsystem. Unterschiedliche Materialien, einzelne Körperplätze, Haltbarkeit und sichtbare Rüstungsteile verbinden Herstellung, Erkundung und Kampf miteinander.',
        changes: Object.freeze([
            'Sechs Rüstungsstufen reichen von leichter Busch- und Fellrüstung über Holz und Eisen bis zu verstärktem Eisen und Blutmondrüstung.',
            'Helm, Harnisch, Armschutz, Beinschutz und Stiefel werden einzeln ausgerüstet und tragen anteilig zum gesamten Schutzwert bei.',
            'Jedes Teil besitzt eine eigene Haltbarkeit, nutzt sich bei eingehendem Schaden ab und kann schließlich zerbrechen.',
            'Neue 3×3-Rezepte erweitern Werkbank und Rezeptbuch; die seltene Blutmondrüstung bleibt an den entsprechenden Questfortschritt gebunden.',
            'Inventar und Spielfigur zeigen ausgerüstete Teile sichtbar an, während der Blutmondwächter einen eigenen Auftritt und eine besondere Belohnung erhielt.'
        ])
    }),
    Object.freeze({
        version: '0.3.0',
        date: '2026-08-10',
        title: 'Eine lebendigere Welt für jede Reise',
        summary: 'Version 0.3.0 verbindet die großen Spielsysteme zu einer verlässlicheren Reise. Dörfer, Story, Charakter, mobile Steuerung und die malerische Welt reagieren klarer aufeinander und wurden über umfangreiche Szenarien geprüft.',
        changes: Object.freeze([
            'Painterly ist nun der einheitliche Produktionsstil; Werkzeuge und Waffen besitzen erkennbare mehrteilige Modelle und eigene Materialtexturen.',
            'Story-Meilensteine, Dorfvertrauen, Questtexte und Navigation führen zuverlässig von den ersten Dorfaufgaben bis zum Blutmond-Endspiel.',
            'Dörfer, Dorfbewohner, Minen, Truhen und Küsten wurden robuster erzeugt und durch verhaltensnahe Szenariotests abgesichert.',
            'Charaktereditor, First und Third Person sowie die mobile Zwei-Daumen-Steuerung greifen zuverlässiger ineinander und wurden auf einem echten Mobilgerät abgenommen.',
            'Rezeptbuch, Schadenssound, Serverbetrieb und Performance-Diagnose erhielten gezielte Korrekturen und neue automatisierte Prüfungen.'
        ])
    })
]);

const DATE_FORMAT = new Intl.DateTimeFormat('de-DE', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC'
});

function renderEntry(spread, entry, index) {
    const changeItems = entry.changes.map(change => `
        <li><span class="diary-block-marker" aria-hidden="true"></span><span>${change}</span></li>
    `).join('');

    spread.innerHTML = `
        <article class="diary-page diary-page-left">
            <p class="diary-chapter">Kapitel ${String(index + 1).padStart(2, '0')}</p>
            <p class="diary-version">Version ${entry.version}</p>
            <h3>${entry.title}</h3>
            <time datetime="${entry.date}">${DATE_FORMAT.format(new Date(`${entry.date}T00:00:00Z`))}</time>
            <p class="diary-summary">${entry.summary}</p>
            <span class="diary-page-number" aria-hidden="true">${index * 2 + 1}</span>
        </article>
        <article class="diary-page diary-page-right">
            <p class="diary-chapter">Was neu ist</p>
            <ul class="diary-change-list">${changeItems}</ul>
            <p class="diary-signature">Butzcraft · Entwicklungstagebuch</p>
            <span class="diary-page-number" aria-hidden="true">${index * 2 + 2}</span>
        </article>
    `;
}

export function initializeDeveloperDiary(root = document.querySelector('[data-developer-diary]')) {
    if (!root || DEVELOPER_DIARY_ENTRIES.length === 0) return;

    const spread = root.querySelector('[data-diary-spread]');
    const book = root.querySelector('[data-diary-book]');
    const chapters = root.querySelector('[data-diary-chapters]');
    const previous = root.querySelector('[data-diary-previous]');
    const next = root.querySelector('[data-diary-next]');
    const position = root.querySelector('[data-diary-position]');
    if (!spread || !book || !chapters || !previous || !next || !position) return;

    const currentVersionIndex = DEVELOPER_DIARY_ENTRIES.findIndex(entry => entry.version === APP_VERSION);
    let currentIndex = currentVersionIndex >= 0 ? currentVersionIndex : DEVELOPER_DIARY_ENTRIES.length - 1;

    chapters.innerHTML = DEVELOPER_DIARY_ENTRIES.map((entry, index) => `
        <button type="button" data-diary-index="${index}" aria-label="Version ${entry.version} öffnen">${entry.version}</button>
    `).join('');

    function showEntry(index, direction = 0) {
        if (index < 0 || index >= DEVELOPER_DIARY_ENTRIES.length || index === currentIndex && direction !== 0) return;
        currentIndex = index;
        renderEntry(spread, DEVELOPER_DIARY_ENTRIES[currentIndex], currentIndex);
        spread.classList.remove('is-turning-back', 'is-turning-forward');
        void spread.offsetWidth;
        if (direction !== 0) spread.classList.add(direction < 0 ? 'is-turning-back' : 'is-turning-forward');

        previous.disabled = currentIndex === 0;
        next.disabled = currentIndex === DEVELOPER_DIARY_ENTRIES.length - 1;
        position.textContent = `Seite ${currentIndex + 1} von ${DEVELOPER_DIARY_ENTRIES.length}`;
        chapters.querySelectorAll('[data-diary-index]').forEach((button, buttonIndex) => {
            button.setAttribute('aria-current', buttonIndex === currentIndex ? 'page' : 'false');
        });
    }

    previous.addEventListener('click', () => showEntry(currentIndex - 1, -1));
    next.addEventListener('click', () => showEntry(currentIndex + 1, 1));
    chapters.addEventListener('click', event => {
        const button = event.target.closest('[data-diary-index]');
        if (!button) return;
        const index = Number(button.dataset.diaryIndex);
        showEntry(index, Math.sign(index - currentIndex));
    });
    book.addEventListener('keydown', event => {
        if (event.key === 'ArrowLeft') {
            event.preventDefault();
            showEntry(currentIndex - 1, -1);
        } else if (event.key === 'ArrowRight') {
            event.preventDefault();
            showEntry(currentIndex + 1, 1);
        } else if (event.key === 'Home') {
            event.preventDefault();
            showEntry(0, -1);
        } else if (event.key === 'End') {
            event.preventDefault();
            showEntry(DEVELOPER_DIARY_ENTRIES.length - 1, 1);
        }
    });

    showEntry(currentIndex);
}
