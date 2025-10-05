// BakLab Setup - Frontend Application - v1.2 (Double Escaped Patterns)
import { showValidationErrors, handleBackendValidationErrors } from './validator.js';
import { ApiClient, formatFileSize } from './api.js';
import * as ConfigManager from './config-manager.js';
import * as InitStep from './steps/init.js';
import * as DatabaseStep from './steps/database.js';
import * as AdminStep from './steps/admin.js';
import * as ApplicationStep from './steps/application.js';
import * as OAuthStep from './steps/oauth.js';
import * as RedisStep from './steps/redis.js';
import * as SMTPStep from './steps/smtp.js';
import * as SSLStep from './steps/ssl.js';
import * as GoAccessStep from './steps/goaccess.js';
import { updateGeoFileDisplay } from './steps/goaccess.js';
import * as ReviewStep from './steps/review.js';
import * as ConfigCompleteStep from './steps/config-complete.js';

class SetupApp {
    constructor() {
        this.currentStep = 0;
        this.token = null;
        this.shouldAutoScroll = true;
        this.apiClient = new ApiClient();
        this.config = {
            database: {
                service_type: 'docker',
                host: 'localhost',
                port: 5433,
                name: 'baklab',
                user: 'baklab',
                password: ''
            },
            redis: {
                service_type: 'docker',
                host: 'localhost',
                port: 6377,
                user: '',
                password: '',
                admin_password: ''
            },
            smtp: {
                server: '',
                port: 587,
                user: '',
                password: '',
                sender: ''
            },
            app: {
                domain_name: '',
                static_host_name: '',
                brand_name: 'BakLab',
                default_lang: 'en',
                version: 'latest',
                debug: false,
                cors_allow_origins: [],
                session_secret: '',
                csrf_secret: '',
                jwt_key_file_path: '/host/path/to/jwt.pem',
                jwt_key_from_file: false,
                original_file_name: '',
                file_size: 0,
                cloudflare_site_key: '',
                cloudflare_secret: '',
                use_setup_domain: false
            },
            oauth: {
                google_enabled: false,
                google_client_id: '',
                google_client_secret: '',
                github_enabled: false,
                github_client_id: '',
                github_client_secret: '',
                frontend_origin: ''
            },
            admin_user: {
                username: 'admin',
                email: '',
                password: ''
            },
            goaccess: {
                enabled: false,
                geo_db_path: './geoip/GeoLite2-City.mmdb',
                has_geo_file: false
            },
            ssl: {
                enabled: false,
                cert_path: '',
                key_path: '',
                use_setup_cert: false
            }
        };
        
        this.steps = [
            { key: 'welcome', titleKey: 'setup.steps.welcome', handler: (container) => InitStep.render(this, container) },
            { key: 'database', titleKey: 'setup.steps.database', handler: (container) => DatabaseStep.render(this, container) },
            { key: 'redis', titleKey: 'setup.steps.redis', handler: (container) => RedisStep.render(this, container) },
            { key: 'smtp', titleKey: 'setup.steps.smtp', handler: (container) => SMTPStep.render(this, container) },
            { key: 'app', titleKey: 'setup.steps.application', handler: (container) => ApplicationStep.render(this, container) },
            { key: 'ssl', titleKey: 'setup.steps.ssl', handler: (container) => SSLStep.render(this, container) },
            { key: 'admin', titleKey: 'setup.steps.admin_user', handler: (container) => AdminStep.render(this, container) },
            { key: 'oauth', titleKey: 'setup.steps.oauth', handler: (container) => OAuthStep.render(this, container) },
            { key: 'goaccess', titleKey: 'setup.steps.goaccess', handler: (container) => GoAccessStep.render(this, container) },
            { key: 'review', titleKey: 'setup.steps.review', handler: (container) => ReviewStep.render(this, container) },
            { key: 'config_complete', titleKey: 'setup.steps.config_complete', handler: (container) => ConfigCompleteStep.render(this, container) }
        ];
        
        this.init();
    }
    
    async init() {
        // Set initial favicon
        this.setFavicon();
        
        try {
            // 从本地缓存加载配置
            this.loadFromLocalCache();

            // 检查URL中的token
            const urlParams = new URLSearchParams(window.location.search);
            const urlToken = urlParams.get('token');
            if (urlToken) {
                this.token = urlToken;
                this.apiClient.setToken(urlToken);
                this.currentStep = 0; // 从欢迎页开始

                // 检查是否有导入的配置
                await this.checkAndLoadImportedConfig();
            }

            this.render();
        } catch (error) {
            console.error('Initialization error:', error);
            this.render();
        }
    }

    render() {
        // Set favicon dynamically
        this.setFavicon();
        
        const app = document.getElementById('app');
        const step = this.steps[this.currentStep];
        
        app.innerHTML = `
            <div class="container">
                <div class="sidebar">
                    <div class="sidebar-header">
                        <h1 class="sidebar-title">
                            <img src="/static/logo-icon.png" alt="BakLab Logo" class="sidebar-logo">
                            <span data-i18n="setup.title"></span>
                        </h1>
                        <p class="sidebar-subtitle" data-i18n="setup.subtitle"></p>
                    </div>
                    ${this.renderSidebarSteps()}
                </div>
                
                <div class="main-content">
                    <div class="header">
                        <h1 data-i18n="${step.titleKey}"></h1>
                    </div>
                    
                    <div class="setup-card">
                        <div id="step-content"></div>
                    </div>
                </div>
            </div>
        `;
        
        // 渲染当前步骤内容
        const stepContent = document.getElementById('step-content');
        step.handler.call(this, stepContent);
        
        // 应用翻译和生成语言选择器
        if (window.i18n) {
            window.i18n.applyTranslations();
            window.i18n.generateLanguageSelector('language-switcher', {
                showLabel: false,
                className: 'language-selector',
                style: 'dropdown'
            });
        }
        
        // 更新上传文件状态显示
        this.updateUploadStates();
    }
    
    renderSidebarSteps() {
        return `
            <div class="sidebar-steps">
                ${this.steps.map((step, index) => `
                    <div class="sidebar-step ${index < this.currentStep ? 'completed' : index === this.currentStep ? 'active' : ''}" 
                         ${index < this.currentStep ? `onclick="app.currentStep = ${index}; app.render();"` : ''}>
                        <div class="sidebar-step-circle">
                            ${index < this.currentStep ? '✓' : index + 1}
                        </div>
                        <div class="sidebar-step-label" data-i18n="${step.titleKey}"></div>
                    </div>
                `).join('')}
            </div>
        `;
    }
    
    
    
    // Step handlers
    async initializeSetup() {
        try {
            const result = await this.apiClient.protectedApiCall('initialize', async () => {
                const apiResult = await this.apiClient.initialize();
                this.token = apiResult.data.token;
                this.apiClient.setToken(this.token);
                this.nextStep();
                return apiResult;
            }, (error) => {
                if (error.validationErrors && error.validationErrors.length > 0) {
                    showValidationErrors(error.validationErrors, window.i18n);
                } else {
                    this.showAlert('error', error.message);
                }
            });

            if (!result) return;
        } catch (error) {
        }
    }
    
    
    updateRadioStyles(radioName) {
        const radios = document.querySelectorAll(`input[name="${radioName}"]`);
        radios.forEach(radio => {
            const option = radio.closest('.radio-option');
            if (radio.checked) {
                option.classList.add('selected');
            } else {
                option.classList.remove('selected');
            }
        });
    }

    saveToLocalCache() {
        ConfigManager.saveToLocalCache(this.config);
    }

    loadFromLocalCache() {
        this.config = ConfigManager.loadFromLocalCache(this.config);
    }

    async checkAndLoadImportedConfig() {
        try {
            const statusResponse = await this.apiClient.getStatus();
            if (statusResponse.success && statusResponse.data && statusResponse.data.revision_mode && statusResponse.data.revision_mode.enabled) {
                console.log('Revision mode detected, loading imported configuration...');

                const configResponse = await this.apiClient.getConfig();
                if (configResponse.success && configResponse.data) {
                    this.config = { ...this.config, ...configResponse.data };

                    this.saveToLocalCache();

                    console.log('Imported configuration loaded and cached:', statusResponse.data.revision_mode);
                }
            }
        } catch (error) {
            console.warn('Failed to check or load imported configuration:', error);
        }
    }
    
    clearLocalCache() {
        ConfigManager.clearLocalCache();
    }
    
    // 重置上传文件状态
    resetUploadStates() {
        // 重置GeoIP文件上传状态
        this.config.goaccess.has_geo_file = false;
        this.config.goaccess.geo_file_temp_path = '';
        this.config.goaccess.original_file_name = '';
        this.config.goaccess.file_size = 0;

    }
    
    // 更新上传文件状态显示
    updateUploadStates() {
        // 更新GeoIP文件状态显示
        updateGeoFileDisplay(this);
    }


    async saveConfigWithValidation() {
        try {
            await ConfigManager.saveConfigWithValidation(
                this.config,
                this.steps[this.currentStep].key,
                this.apiClient,
                {
                    onSuccess: () => this.nextStep(),
                    onValidationError: (errors) => showValidationErrors(errors, window.i18n),
                    onError: (error) => this.showAlert('error', error.message)
                }
            );
        } catch (error) {
            console.error('Configuration validation failed:', error);
        }
    }

    async saveConfig() {
        try {
            const result = await ConfigManager.saveConfig(
                this.config,
                this.steps[this.currentStep].key,
                this.apiClient,
                {
                    onValidationError: (errors) => showValidationErrors(errors, window.i18n),
                    onError: (error) => this.showAlert('error', error.message)
                }
            );

            if (!result) return;
        } catch (error) {
            this.showAlert('error', window.i18n ? window.i18n.t('messages.errors.failed_generate', {error: error.message}) : 'Failed to save configuration: ' + error.message);
            throw error;
        }
    }
    
    
    async generateConfig() {
        const generateBtn = document.querySelector('button[onclick="app.generateConfig()"]');
        const originalBtnText = generateBtn.innerHTML;

        try {
            // 设置loading状态
            generateBtn.disabled = true;
            const generatingText = window.i18n ? window.i18n.t('setup.review.generating') : 'Generating...';
            generateBtn.innerHTML = generatingText;

            await this.apiClient.protectedApiCall('generateConfig', async () => {
                await this.saveConfig();

                const response = await this.apiClient.generateConfig(this.config);

                if (response.data && response.data.output_path) {
                    this.outputPath = response.data.output_path;
                }

                this.clearLocalCache();

                this.resetUploadStates();

                this.nextStep();
                return response;
            }, (error) => {
                if (error.validationErrors && error.validationErrors.length > 0) {
                    showValidationErrors(error.validationErrors, window.i18n);
                } else {
                    this.showAlert('error', error.message);
                }
            });
        } catch (error) {
            // 恢复按钮状态
            generateBtn.disabled = false;
            generateBtn.innerHTML = originalBtnText;
            if (window.i18n) {
                window.i18n.applyTranslations();
            }

            // 处理后端验证错误
            if (error.message && error.message.includes('validation')) {
                // 尝试解析并显示具体的验证错误
                try {
                    const errorData = JSON.parse(error.message.split('validation failed: ')[1]);
                    handleBackendValidationErrors(errorData, (type, message) => this.showAlert(type, message));
                } catch (parseError) {
                    // 如果解析失败，显示通用错误
                    const errorMsg = window.i18n ? window.i18n.t('setup.review.generation_failed') : 'Configuration validation failed. Please check all fields and try again.';
                    this.showAlert('error', errorMsg);
                }
            } else {
                // 显示生成失败的通用错误
                const errorMsg = window.i18n ? window.i18n.t('setup.review.generation_error') : 'Configuration generation failed. Please try again.';
                this.showAlert('error', errorMsg);
            }
            // 其他错误已在 protectedApiCall 中处理
        }
    }
    
    scrollToBottom() {
        const logOutput = document.getElementById('log-output');
        if (logOutput) {
            logOutput.scrollTop = logOutput.scrollHeight;
        }
    }
    
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    async completeSetup() {
        try {
            await this.apiClient.protectedApiCall('complete', async () => {
                await this.apiClient.completeSetup();

                this.clearLocalCache();

                this.showAlert('success', window.i18n ? window.i18n.t('messages.setup_completed') : 'Setup completed successfully! Your BakLab application is ready to use.');

                setTimeout(() => {
                    this.renderCompleted();
                }, 3000);
            }, (error) => {
                if (error.validationErrors && error.validationErrors.length > 0) {
                    showValidationErrors(error.validationErrors, window.i18n);
                } else {
                    this.showAlert('error', error.message);
                }
            });
        } catch (error) {
        }
    }
    
    // Navigation
    nextStep() {
        if (this.currentStep < this.steps.length - 1) {
            this.currentStep++;
            this.render();
        }
    }
    
    previousStep() {
        if (this.currentStep > 0) {
            this.currentStep--;
            this.render();
        }
    }
    
    // Set favicon for the page
    setFavicon() {
        // Remove existing favicons
        const existingLinks = document.querySelectorAll('link[rel="icon"], link[rel="shortcut icon"]');
        existingLinks.forEach(link => link.remove());
        
        // Add new favicon
        const faviconLink = document.createElement('link');
        faviconLink.rel = 'icon';
        faviconLink.type = 'image/x-icon';
        faviconLink.href = '/static/favicon.ico';
        document.head.appendChild(faviconLink);
        
        // Add PNG favicon as fallback
        const pngFaviconLink = document.createElement('link');
        pngFaviconLink.rel = 'icon';
        pngFaviconLink.type = 'image/png';
        pngFaviconLink.href = '/static/logo-icon.png';
        document.head.appendChild(pngFaviconLink);
    }
    
    // Utility functions

    showAlert(type, message) {
        const alertDiv = document.createElement('div');
        alertDiv.className = `alert alert-${type}`;
        // 如果消息是翻译键，尝试翻译
        alertDiv.textContent = window.i18n && message.includes('.') ? window.i18n.t(message) : message;
        
        document.querySelector('.setup-card').insertBefore(alertDiv, document.getElementById('step-content'));
        
        // 自动移除警告
        setTimeout(() => {
            if (alertDiv.parentNode) {
                alertDiv.parentNode.removeChild(alertDiv);
            }
        }, 5000);
    }
}

// Initialize the app when the page loads
document.addEventListener('DOMContentLoaded', () => {
    window.app = new SetupApp();
});
