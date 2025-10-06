import { showValidationErrors } from './validator.js';

export class SetupService {
    constructor(apiClient, navigation, ui, config, i18n) {
        this.apiClient = apiClient;
        this.navigation = navigation;
        this.ui = ui;
        this.config = config;
        this.i18n = i18n;
        this.token = null;
        this.outputPath = null;
    }

    async initialize() {
        try {
            const result = await this.apiClient.protectedApiCall('initialize', async () => {
                const apiResult = await this.apiClient.initialize();
                this.token = apiResult.data.token;
                this.apiClient.setToken(this.token);

                if (window.app) {
                    window.app.token = this.token;
                }

                this.navigation.nextStep();
                return apiResult;
            }, (error) => {
                if (error.validationErrors && error.validationErrors.length > 0) {
                    showValidationErrors(error.validationErrors, this.i18n);
                } else {
                    this.ui.showAlert('error', error.message);
                }
            });

            if (!result) return;
        } catch (error) {
            console.error('Initialize error:', error);
        }
    }

    async generateConfig(onClearCache, onResetUploadStates) {
        const generateBtn = document.querySelector('button[onclick*="generateConfig"]') ||
                           document.getElementById('generate-config-btn');
        if (!generateBtn) return;

        const originalBtnText = generateBtn.innerHTML;

        try {
            generateBtn.disabled = true;
            const generatingText = this.i18n ? this.i18n.t('setup.review.generating') : 'Generating...';
            generateBtn.innerHTML = generatingText;

            await this.apiClient.protectedApiCall('generateConfig', async () => {
                await this.config.save();

                const response = await this.apiClient.generateConfig(this.config.getAll());

                if (response.data && response.data.output_path) {
                    this.outputPath = response.data.output_path;
                }

                if (onClearCache) onClearCache();
                if (onResetUploadStates) onResetUploadStates();

                this.navigation.nextStep();
                return response;
            }, (error) => {
                if (error.validationErrors && error.validationErrors.length > 0) {
                    this.ui.showValidationErrors(error.validationErrors);
                } else {
                    this.ui.showAlert('error', error.message);
                }
            });

            return this.outputPath;
        } catch (error) {
            generateBtn.disabled = false;
            generateBtn.innerHTML = originalBtnText;
            if (this.i18n) {
                this.i18n.applyTranslations();
            }

            if (error.message && error.message.includes('validation')) {
                try {
                    const errorData = JSON.parse(error.message.split('validation failed: ')[1]);
                    const errorMsg = this.i18n ? this.i18n.t('setup.review.generation_failed') : 'Configuration validation failed. Please check all fields and try again.';
                    this.ui.showAlert('error', errorMsg);
                } catch (parseError) {
                    const errorMsg = this.i18n ? this.i18n.t('setup.review.generation_failed') : 'Configuration validation failed. Please check all fields and try again.';
                    this.ui.showAlert('error', errorMsg);
                }
            } else {
                const errorMsg = this.i18n ? this.i18n.t('setup.review.generation_error') : 'Configuration generation failed. Please try again.';
                this.ui.showAlert('error', errorMsg);
            }
        }
    }

    async completeSetup(onClearCache, onRenderCompleted) {
        try {
            await this.apiClient.protectedApiCall('complete', async () => {
                await this.apiClient.completeSetup();

                if (onClearCache) onClearCache();

                this.ui.showAlert('success', this.i18n ? this.i18n.t('messages.setup_completed') : 'Setup completed successfully! Your BakLab application is ready to use.');

                setTimeout(() => {
                    if (onRenderCompleted) onRenderCompleted();
                }, 3000);
            }, (error) => {
                if (error.validationErrors && error.validationErrors.length > 0) {
                    showValidationErrors(error.validationErrors, this.i18n);
                } else {
                    this.ui.showAlert('error', error.message);
                }
            });
        } catch (error) {
            console.error('Complete setup error:', error);
        }
    }
}
