const CONFIG_STORAGE_KEY = 'baklab_setup_config';

export function saveToLocalCache(config) {
    try {
        localStorage.setItem(CONFIG_STORAGE_KEY, JSON.stringify(config));
    } catch (error) {
        console.warn('Failed to save to localStorage:', error);
    }
}

export function loadFromLocalCache(defaultConfig = {}) {
    try {
        const cached = localStorage.getItem(CONFIG_STORAGE_KEY);
        if (cached) {
            return { ...defaultConfig, ...JSON.parse(cached) };
        }
        return defaultConfig;
    } catch (error) {
        console.warn('Failed to load from localStorage:', error);
        return defaultConfig;
    }
}

export function clearLocalCache() {
    try {
        localStorage.removeItem(CONFIG_STORAGE_KEY);
    } catch (error) {
        console.warn('Failed to clear localStorage:', error);
    }
}

export async function saveConfigWithValidation(config, currentStepKey, apiClient, callbacks = {}) {
    const { onSuccess, onValidationError, onError } = callbacks;

    try {
        const result = await apiClient.protectedApiCall('saveConfig', async () => {
            const configWithStep = {
                ...config,
                current_step: currentStepKey
            };

            const response = await apiClient.saveConfig(configWithStep);

            if (response.success && onSuccess) {
                onSuccess(response);
            }

            return response;
        }, (error) => {
            if (error.validationErrors && error.validationErrors.length > 0) {
                if (onValidationError) {
                    onValidationError(error.validationErrors);
                }
            } else {
                if (onError) {
                    onError(error);
                }
            }
        });

        return result;
    } catch (error) {
        console.error('Configuration validation failed:', error);
        throw error;
    }
}

export async function saveConfig(config, currentStepKey, apiClient, callbacks = {}) {
    const { onValidationError, onError } = callbacks;

    try {
        const result = await apiClient.protectedApiCall('saveConfig', async () => {
            const configWithStep = {
                ...config,
                current_step: currentStepKey
            };
            return await apiClient.saveConfig(configWithStep);
        }, (error) => {
            if (error.validationErrors && error.validationErrors.length > 0) {
                if (onValidationError) {
                    onValidationError(error.validationErrors);
                }
            } else {
                if (onError) {
                    onError(error);
                }
            }
        });

        return result;
    } catch (error) {
        if (onError) {
            onError(error);
        }
        throw error;
    }
}
