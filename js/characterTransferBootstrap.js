import {
    CHARACTER_TRANSFER_STORAGE_KEY,
    readCharacterTransfer,
    removeCharacterTransferFromUrl
} from './characterTransfer.js';

try {
    const transferredProfile = readCharacterTransfer(window.location.hash);
    if (transferredProfile) {
        localStorage.setItem(CHARACTER_TRANSFER_STORAGE_KEY, JSON.stringify(transferredProfile));
        removeCharacterTransferFromUrl();
    }
} catch {
    removeCharacterTransferFromUrl();
}
