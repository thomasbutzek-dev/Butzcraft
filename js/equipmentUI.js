import { createBlockHTML, inventorySlots, updateInventoryUI } from './inventory.js?v=20260801c';
import {
    EQUIPMENT_SLOTS,
    equipArmorFromInventory,
    getArmorInfo,
    getArmorProtection,
    unequipArmorToInventory
} from './equipmentRules.js?v=20260723e';

function durabilityText(item, armor) {
    const durability = Number.isFinite(item?.durability) ? item.durability : armor.maxDurability;
    return `${Math.ceil(durability)}/${armor.maxDurability}`;
}

function notifyEquipmentChanged() {
    updateInventoryUI();
    window.dispatchEvent(new CustomEvent('butzcraft:equipment-changed'));
}

function renderSlot(slot) {
    const item = inventorySlots[slot.inventoryIndex];
    const armor = item && item.count > 0 ? getArmorInfo(item.type) : null;
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `equipment-slot equipment-slot-${slot.id}`;
    button.dataset.equipmentSlot = slot.id;
    button.setAttribute('aria-label', armor ? `${slot.label}: ${armor.name} ablegen` : `${slot.label}: leer`);

    const label = document.createElement('span');
    label.className = 'equipment-slot-label';
    label.textContent = slot.label;
    const icon = document.createElement('span');
    icon.className = 'equipment-slot-icon';
    if (armor) icon.innerHTML = createBlockHTML(item.type);
    const detail = document.createElement('span');
    detail.className = 'equipment-slot-detail';
    detail.textContent = armor ? durabilityText(item, armor) : 'Leer';
    button.append(label, icon, detail);
    button.disabled = !armor;
    button.addEventListener('click', () => {
        const result = unequipArmorToInventory(inventorySlots, slot.id);
        if (!result.unequipped) {
            const status = document.getElementById('equipment-status');
            if (status) status.textContent = result.reason === 'inventory-full' ? 'Inventar voll.' : '';
            return;
        }
        notifyEquipmentChanged();
    });
    return button;
}

function renderEquippableItems(container) {
    container.innerHTML = '';
    const candidates = inventorySlots
        .map((item, index) => ({ item, index, armor: item && item.count > 0 ? getArmorInfo(item.type) : null }))
        .filter(candidate => candidate.armor && !EQUIPMENT_SLOTS.some(slot => slot.inventoryIndex === candidate.index));

    if (candidates.length === 0) {
        const empty = document.createElement('p');
        empty.className = 'equipment-empty';
        empty.textContent = 'Keine ausrüstbaren Gegenstände im Inventar.';
        container.appendChild(empty);
        return;
    }

    for (const candidate of candidates) {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'equipment-item';
        button.innerHTML = `
            <span class="equipment-item-icon">${createBlockHTML(candidate.item.type)}</span>
            <span><strong>${candidate.armor.name}</strong><small>${candidate.armor.slot === 'body' ? 'Körper' : EQUIPMENT_SLOTS.find(slot => slot.id === candidate.armor.slot)?.label} · ${durabilityText(candidate.item, candidate.armor)}</small></span>
            <span class="equipment-item-action">Anlegen</span>
        `;
        button.addEventListener('click', () => {
            if (equipArmorFromInventory(inventorySlots, candidate.index).equipped) notifyEquipmentChanged();
        });
        container.appendChild(button);
    }
}

export function renderEquipmentPanel() {
    const slots = document.getElementById('equipment-slots');
    const items = document.getElementById('equipment-items');
    const protection = document.getElementById('equipment-protection');
    if (!slots || !items) return;
    slots.innerHTML = '';
    EQUIPMENT_SLOTS.forEach(slot => slots.appendChild(renderSlot(slot)));
    renderEquippableItems(items);
    if (protection) protection.textContent = `${Math.round(getArmorProtection(inventorySlots) * 100)} % Schutz`;
}

export function initEquipmentUI() {
    document.getElementById('equipment-view-tab')?.addEventListener('click', () => {
        window.showInventoryPanel?.('equipment');
    });
    window.renderEquipmentPanel = renderEquipmentPanel;
    window.addEventListener('butzcraft:equipment-changed', renderEquipmentPanel);
}
