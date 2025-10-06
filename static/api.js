export class ApiClient {
    constructor(i18n = null) {
        this.token = null;
        this.i18n = i18n;
        this.requestLocks = {
            initialize: false,
            complete: false,
            generateConfig: false,
            testDatabase: false,
            testRedis: false,
            testSMTP: false,
            saveConfig: false,
            geoFileUpload: false
        };
    }

    setI18n(i18n) {
        this.i18n = i18n;
    }

    setToken(token) {
        this.token = token;
    }

    async api(method, url, data = null) {
        const options = {
            method,
            headers: {
                'Content-Type': 'application/json'
            }
        };

        if (this.token) {
            options.headers['Setup-Token'] = this.token;
        }

        if (this.i18n && this.i18n.getCurrentLanguage) {
            options.headers['X-Language'] = this.i18n.getCurrentLanguage();
        }

        if (data) {
            options.body = JSON.stringify(data);
        }

        const response = await fetch(url, options);
        const result = await response.json();

        if (!response.ok) {
            if (result.errors && result.errors.length > 0) {
                const error = new Error(result.message || 'Validation failed');
                error.validationErrors = result.errors;
                throw error;
            }
            throw new Error(result.message || 'Request failed');
        }

        return result;
    }

    acquireLock(lockName) {
        if (this.requestLocks[lockName]) {
            return false;
        }
        this.requestLocks[lockName] = true;
        return true;
    }

    releaseLock(lockName) {
        this.requestLocks[lockName] = false;
    }

    async protectedApiCall(lockName, apiCall, errorHandler) {
        if (!this.acquireLock(lockName)) {
            return null;
        }

        try {
            const result = await apiCall();
            return result;
        } catch (error) {
            if (errorHandler) {
                errorHandler(error);
            }
            throw error;
        } finally {
            this.releaseLock(lockName);
        }
    }

    async initialize() {
        return this.api('POST', '/api/initialize');
    }

    async getStatus() {
        return this.api('GET', '/api/status');
    }

    async getConfig() {
        return this.api('GET', '/api/config');
    }

    async saveConfig(config, step = null) {
        const payload = step !== null ? { ...config, current_step: step } : config;
        return this.api('POST', '/api/config', payload);
    }

    async getGeoFileStatus() {
        return this.api('GET', '/api/geo-file/status');
    }

    async uploadGeoFile(file, onProgress, onError) {
        const formData = new FormData();
        formData.append('geo_file', file);

        return new Promise((resolve, reject) => {
            const xhr = new XMLHttpRequest();

            xhr.upload.addEventListener('progress', (e) => {
                if (e.lengthComputable && onProgress) {
                    const percentComplete = (e.loaded / e.total) * 100;
                    onProgress(percentComplete, e.loaded, e.total);
                }
            });

            xhr.addEventListener('load', () => {
                if (xhr.status === 200) {
                    try {
                        const result = JSON.parse(xhr.responseText);
                        resolve(result);
                    } catch (e) {
                        reject(new Error('Invalid response format'));
                    }
                } else {
                    try {
                        const error = JSON.parse(xhr.responseText);
                        reject(new Error(error.message || 'Upload failed'));
                    } catch (e) {
                        reject(new Error('Upload failed'));
                    }
                }
            });

            xhr.addEventListener('error', () => {
                const error = new Error('Network error during upload');
                if (onError) onError(error);
                reject(error);
            });

            xhr.addEventListener('abort', () => {
                const error = new Error('Upload cancelled');
                if (onError) onError(error);
                reject(error);
            });

            xhr.open('POST', '/api/upload/geo-file');
            if (this.token) {
                xhr.setRequestHeader('Setup-Token', this.token);
            }
            xhr.send(formData);
        });
    }

    async getCurrentCertPaths() {
        const response = await fetch('/api/current-cert-paths', {
            headers: {
                'Setup-Token': this.token
            }
        });
        return response.json();
    }

    async testConnections(type, config) {
        return this.api('POST', '/api/test-connections', { type, ...config });
    }

    async generateConfig(config) {
        return this.api('POST', '/api/generate', config);
    }

    async completeSetup() {
        return this.api('POST', '/api/complete');
    }
}

export function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
}
