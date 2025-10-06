export class Config {
    constructor(configStore, navigation, apiClient, ui) {
        this._store = configStore;
        this._navigation = navigation;
        this._apiClient = apiClient;
        this._ui = ui;
    }

    get(path) {
        return this._store.get(path);
    }

    set(path, value) {
        this._store.set(path, value);
    }

    update(updates) {
        this._store.update(updates);
    }

    getAll() {
        return this._store.getAll();
    }

    saveToLocalCache() {
        this._store.saveToLocalCache();
    }

    async saveWithValidation() {
        return await this._store.saveWithValidation(
            this._navigation.getCurrentStepKey(),
            this._apiClient,
            {
                onSuccess: () => this._navigation.nextStep(),
                onValidationError: (errors) => this._ui.showValidationErrors(errors),
                onError: (error) => this._ui.showAlert('error', error.message)
            }
        );
    }

    async save() {
        return await this._store.save(
            this._navigation.getCurrentStepKey(),
            this._apiClient,
            {
                onValidationError: (errors) => this._ui.showValidationErrors(errors),
                onError: (error) => this._ui.showAlert('error', error.message)
            }
        );
    }
}
