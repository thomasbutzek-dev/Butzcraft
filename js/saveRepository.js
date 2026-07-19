export class SaveRepository {
    constructor({ browserStore, fetchJson, warn = () => {} }) {
        this.browserStore = browserStore;
        this.fetchJson = fetchJson;
        this.warn = warn;
    }

    async list() {
        let browserNames = [];
        try {
            browserNames = await this.browserStore.list();
        } catch (error) {
            this.warn('[Save] Browser-Save-Liste nicht lesbar:', error);
        }

        let serverNames = [];
        try {
            const result = await this.fetchJson('api/saves');
            serverNames = Array.isArray(result) ? result : [];
        } catch (error) {
            serverNames = [];
        }

        return [...new Set([...browserNames, ...serverNames])];
    }

    async load(name) {
        try {
            const gameData = await this.browserStore.load(name);
            if (gameData) return gameData;
        } catch (error) {
            if (error && error.message === 'Invalid name') throw error;
            this.warn('[Save] Browser-Save nicht lesbar, versuche Server-Fallback:', error);
        }

        const result = await this.fetchJson(`api/load?name=${encodeURIComponent(name)}`);
        if (result && result.error) throw new Error(result.error);
        return result;
    }

    save(name, gameData) {
        return this.browserStore.save(name, gameData);
    }
}
