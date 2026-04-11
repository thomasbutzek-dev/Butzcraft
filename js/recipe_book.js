
export function initRecipeBook(atlasDataURL, BLOCK_TEX, craftingRecipes, BLOCK_TYPES, TRANSLATIONS) {
    const createBlockHTML = (type) => {
        const is2D = (type === 9 || type === 10 || type === 17 || type === 18 || type === 19 || type === 21 || type === 22 || type === 23 || type === 24 || type === 25 || type === 27 || type === 31);
        let texIdx = 0;
        if (type === 17) texIdx = 21; else if (type === 18) texIdx = 23; else if (type === 19) texIdx = 26; else texIdx = BLOCK_TEX[type] || 0;
        const u = (texIdx % 16) * 100 / 15; const v = Math.floor(texIdx / 16) * 100 / 15;
        const bgPos = `${u}% ${v}%`;
        if (is2D) return `<div class="flat-icon" style="background-image: url('${atlasDataURL}'); background-position: ${bgPos};"></div>`;
        else return `<div class="mc-cube"><div class="mc-face mc-top" style="background-image: url('${atlasDataURL}'); background-position: ${bgPos};"></div><div class="mc-face mc-front" style="background-image: url('${atlasDataURL}'); background-position: ${bgPos};"></div><div class="mc-face mc-right" style="background-image: url('${atlasDataURL}'); background-position: ${bgPos};"></div></div>`;
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

        craftingRecipes.forEach(recipe => {
            const entry = document.createElement('div');
            entry.className = 'recipe-entry';
            let gridHTML = '<div class="recipe-ingredients">';
            recipe.pattern.forEach(type => {
                gridHTML += `<div class="mini-slot">${type !== 0 ? createBlockHTML(type) : ''}</div>`;
            });
            gridHTML += '</div>';

            const bName = Object.keys(BLOCK_TYPES).find(k => BLOCK_TYPES[k] === recipe.result.type) || '';
            const translatedName = TRANSLATIONS[bName] || bName;
            
            // Format name nicely: JUNGLE_LEAVES -> Jungle Leaves
            const formattedName = translatedName.toLowerCase().split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');

            const bID = recipe.result.type;
            const texIdx = BLOCK_TEX[bID] !== undefined ? BLOCK_TEX[bID] : 0;
            const u = (texIdx % 16) * 100 / 15;
            const v = Math.floor(texIdx / 16) * 100 / 15;
            const bgPos = `${u}% ${v}%`;

            entry.innerHTML = `
                ${gridHTML}
                <div class="recipe-arrow">➔</div>
                <div class="recipe-result-container">
                    <div class="mini-slot">
                        <div class="mc-cube" style="transform: translate(-50%, -50%) rotateX(-30deg) rotateY(45deg) scale(0.8);">
                            <div class="mc-face mc-top" style="background-image: url('${atlasDataURL}'); background-position: ${bgPos};"></div>
                            <div class="mc-face mc-front" style="background-image: url('${atlasDataURL}'); background-position: ${bgPos};"></div>
                            <div class="mc-face mc-right" style="background-image: url('${atlasDataURL}'); background-position: ${bgPos};"></div>
                        </div>
                        ${recipe.result.count > 1 ? `<div class="recipe-count">${recipe.result.count}</div>` : ''}
                    </div>
                    <div class="recipe-name">${formattedName}</div>
                </div>
            `;
            container.appendChild(entry);
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
