import * as ConfigManager from './config-manager.js';

export class ConfigStore {
    constructor(initialConfig = {}) {
        this._config = initialConfig;
        this._listeners = [];
    }

    get(path) {
        if (!path) return this._config;

        const keys = path.split('.');
        let value = this._config;
        for (const key of keys) {
            value = value?.[key];
        }
        return value;
    }

    set(path, value) {
        const keys = path.split('.');
        const lastKey = keys.pop();
        let target = this._config;

        for (const key of keys) {
            if (!target[key]) target[key] = {};
            target = target[key];
        }

        target[lastKey] = value;
        this._notify();
    }

    update(updates) {
        this._config = { ...this._config, ...updates };
        this._notify();
    }

    getAll() {
        return this._config;
    }

    setAll(config) {
        this._config = config;
        this._notify();
    }

    saveToLocalCache() {
        ConfigManager.saveToLocalCache(this._config);
    }

    loadFromLocalCache() {
        this._config = ConfigManager.loadFromLocalCache(this._config);
        this._notify();
    }

    clearLocalCache() {
        ConfigManager.clearLocalCache();
    }

    async saveWithValidation(currentStepKey, apiClient, callbacks = {}) {
        return await ConfigManager.saveConfigWithValidation(
            this._config,
            currentStepKey,
            apiClient,
            callbacks
        );
    }

    async save(currentStepKey, apiClient, callbacks = {}) {
        return await ConfigManager.saveConfig(
            this._config,
            currentStepKey,
            apiClient,
            callbacks
        );
    }

    subscribe(listener) {
        this._listeners.push(listener);
        return () => {
            this._listeners = this._listeners.filter(l => l !== listener);
        };
    }

    _notify() {
        this._listeners.forEach(listener => listener(this._config));
    }
}
