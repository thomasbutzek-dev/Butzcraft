import { normalizeRecipe } from './recipes.js?v=20260507b';

export function initRecipeBook(atlasDataURL, BLOCK_TEX, craftingRecipes, BLOCK_TYPES, TRANSLATIONS, onRecipeClick) {
    const EMOJI_MAP = { 21: '🐟', 22: '🥩', 23: '🍗', 24: '🧟', 25: '🍖' };

    const createMiniHTML = (type) => {
        if (type === 0) return '';
        if (EMOJI_MAP[type]) return `<span class="mini-emoji">${EMOJI_MAP[type]}</span>`;
        let texIdx = 0;
        if (type === 17) texIdx = 21;
        else if (type === 18) texIdx = 23;
        else if (type === 19) texIdx = 26;
        else texIdx = BLOCK_TEX[type] || 0;
        const u = (texIdx % 16) * 100 / 15;
        const v = Math.floor(texIdx / 16) * 100 / 15;
        return `<div class="mini-icon" style="background-image:url('${atlasDataURL}');background-position:${u}% ${v}%;"></div>`;
    };

    // Blocknamen-Helfer
    const getBlockName = (type) => {
        if (type === 0) return '';
        const key = Object.keys(BLOCK_TYPES).find(k => BLOCK_TYPES[k] === type) || '';
        return TRANSLATIONS[key] || key;
    };

    // Custom-Tooltip erstellen (einmalig)
    const ensureTooltip = () => {
        let tip = document.getElementById('recipe-tooltip');
        if (!tip) {
            tip = document.createElement('div');
            tip.id = 'recipe-tooltip';
            tip.style.cssText = 'position:fixed;padding:4px 10px;background:rgba(20,20,20,0.95);color:#fff;font-size:13px;border-radius:4px;pointer-events:none;z-index:10000;display:none;white-space:nowrap;border:1px solid rgba(255,255,255,0.2);text-shadow:1px 1px 0 #000;font-weight:500;box-shadow:0 2px 8px rgba(0,0,0,0.5);';
            document.body.appendChild(tip);
        }
        return tip;
    };

    const updateRecipeList = () => {
        const overlay = document.getElementById('inventory-overlay');
        if (!overlay) return;

        if (!document.getElementById('recipe-book')) {
            overlay.style.display = 'none'; // Verhindert Flackern während Umbau
            overlay.style.flexDirection = 'row';
            overlay.style.justifyContent = 'center';
            overlay.style.alignItems = 'flex-start';
            overlay.style.gap = '40px';
            overlay.style.padding = '40px';

            const recipeBook = document.createElement('div');
            recipeBook.id = 'recipe-book';
            recipeBook.innerHTML = `
                <div id="recipe-book-title" style="color: #ffe066; font-size: 18px; font-weight: bold; margin-bottom: 15px; text-transform: uppercase; letter-spacing: 1px;">Rezeptbuch</div>
                <div id="recipe-list-container"></div>
            `;

            let mainContent = document.getElementById('inventory-main-content');
            if (!mainContent) {
                mainContent = document.createElement('div');
                mainContent.id = 'inventory-main-content';
                mainContent.style.position = 'relative';
                while (overlay.firstChild) mainContent.appendChild(overlay.firstChild);
            }
            
            overlay.innerHTML = '';
            overlay.appendChild(recipeBook);
            overlay.appendChild(mainContent);
            overlay.style.display = 'flex';
        }

        const container = document.getElementById('recipe-list-container');
        if (!container) return;
        container.innerHTML = '';

        const tooltip = ensureTooltip();

        craftingRecipes.forEach(rawRecipe => {
            const recipe = normalizeRecipe(rawRecipe);
            const entry = document.createElement('div');
            entry.className = 'recipe-entry';

            // Zutaten-Grid erstellen: Das Rezeptbuch zeigt immer die aktuelle 3x3-Werkbank.
            // Legacy-2x2-Rezepte bleiben logisch 2x2, werden aber optisch oben links in 3x3 eingebettet.
            const gs = recipe.gridSize || 2;
            const displayGridSize = 3;
            const ingredientsDiv = document.createElement('div');
            ingredientsDiv.className = `recipe-ingredients grid-${displayGridSize}x${displayGridSize}`;

            let cells;
            if (recipe.kind === 'shapeless') {
                cells = [...recipe.ingredients];
                while (cells.length < displayGridSize * displayGridSize) cells.push(0);
                cells = cells.slice(0, displayGridSize * displayGridSize);
            } else if (gs === 2) {
                cells = [
                    recipe.pattern[0] || 0, recipe.pattern[1] || 0, 0,
                    recipe.pattern[2] || 0, recipe.pattern[3] || 0, 0,
                    0, 0, 0
                ];
            } else {
                cells = recipe.pattern;
                while (cells.length < displayGridSize * displayGridSize) cells.push(0);
                cells = cells.slice(0, displayGridSize * displayGridSize);
            }

            cells.forEach(type => {
                const slot = document.createElement('div');
                slot.className = 'mini-slot';
                if (type !== 0) {
                    slot.innerHTML = createMiniHTML(type);
                    slot.dataset.tooltipText = getBlockName(type);
                }
                ingredientsDiv.appendChild(slot);
            });

            // Pfeil
            const arrow = document.createElement('div');
            arrow.className = 'recipe-arrow';
            arrow.textContent = '➔';

            // Ergebnis-Container
            const resultContainer = document.createElement('div');
            resultContainer.className = 'recipe-result-container';

            const bName = Object.keys(BLOCK_TYPES).find(k => BLOCK_TYPES[k] === recipe.result.type) || '';
            const translatedName = TRANSLATIONS[bName] || bName;
            const formattedName = translatedName.toLowerCase().split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');

            const resultSlot = document.createElement('div');
            resultSlot.className = 'mini-slot result-slot';
            resultSlot.dataset.tooltipText = translatedName + (recipe.result.count > 1 ? ' x' + recipe.result.count : '');
            resultSlot.innerHTML = createMiniHTML(recipe.result.type);
            if (recipe.result.count > 1) {
                const countEl = document.createElement('div');
                countEl.className = 'recipe-count';
                countEl.textContent = recipe.result.count;
                resultSlot.appendChild(countEl);
            }

            const nameDiv = document.createElement('div');
            nameDiv.className = 'recipe-name';
            nameDiv.textContent = formattedName;

            resultContainer.appendChild(resultSlot);
            resultContainer.appendChild(nameDiv);

            entry.appendChild(ingredientsDiv);
            entry.appendChild(arrow);
            entry.appendChild(resultContainer);
            entry.addEventListener('click', () => {
                if (onRecipeClick) onRecipeClick(recipe);
            });
            container.appendChild(entry);
        });

        // Tooltip-Events auf dem Container (Event-Delegation)
        container.addEventListener('mouseover', (e) => {
            const slot = e.target.closest('.mini-slot[data-tooltip-text]');
            if (slot && slot.dataset.tooltipText) {
                tooltip.textContent = slot.dataset.tooltipText;
                tooltip.style.display = 'block';
            }
        });

        container.addEventListener('mousemove', (e) => {
            if (tooltip.style.display === 'block') {
                tooltip.style.left = (e.clientX + 12) + 'px';
                tooltip.style.top = (e.clientY - 28) + 'px';
            }
        });

        container.addEventListener('mouseout', (e) => {
            const slot = e.target.closest('.mini-slot[data-tooltip-text]');
            if (slot) {
                tooltip.style.display = 'none';
            }
        });

        setTimeout(() => {
            const cArea = document.getElementById('crafting-area');
            const iGrid = document.getElementById('inventory-grid');
            const book = document.getElementById('recipe-book');
            if (cArea && iGrid && book) {
                const topDist = cArea.offsetTop;
                const bottomDist = iGrid.offsetTop + iGrid.offsetHeight;
                if (bottomDist > topDist) {
                    book.style.marginTop = topDist + 'px';
                    book.style.height = (bottomDist - topDist) + 'px';
                }
            }
        }, 10);
    };

    window.updateRecipeList = updateRecipeList;
}
