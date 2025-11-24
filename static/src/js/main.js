import { ApiClient } from './api.js';
import { ConfigStore } from './config-store.js';
import { Navigation } from './navigation.js';
import { UI } from './ui.js';
import { Config } from './config.js';
import { SetupService } from './setup-service.js';
import { SetupI18n } from './i18n.js';
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

        this.i18n = new SetupI18n();
        this.apiClient = new ApiClient(this.i18n);

        const defaultConfig = {
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

        this.configStore = new ConfigStore(defaultConfig);

        this.steps = [
            { key: 'welcome', titleKey: 'setup.steps.welcome', handler: (container, deps) => InitStep.render(container, deps) },
            { key: 'database', titleKey: 'setup.steps.database', handler: (container, deps) => DatabaseStep.render(container, deps) },
            { key: 'redis', titleKey: 'setup.steps.redis', handler: (container, deps) => RedisStep.render(container, deps) },
            { key: 'smtp', titleKey: 'setup.steps.smtp', handler: (container, deps) => SMTPStep.render(container, deps) },
            { key: 'app', titleKey: 'setup.steps.application', handler: (container, deps) => ApplicationStep.render(container, deps) },
            { key: 'ssl', titleKey: 'setup.steps.ssl', handler: (container, deps) => SSLStep.render(container, deps) },
            { key: 'admin', titleKey: 'setup.steps.admin_user', handler: (container, deps) => AdminStep.render(container, deps) },
            { key: 'oauth', titleKey: 'setup.steps.oauth', handler: (container, deps) => OAuthStep.render(container, deps) },
            { key: 'goaccess', titleKey: 'setup.steps.goaccess', handler: (container, deps) => GoAccessStep.render(container, deps) },
            { key: 'review', titleKey: 'setup.steps.review', handler: (container, deps) => ReviewStep.render(container, deps) },
            { key: 'config_complete', titleKey: 'setup.steps.config_complete', handler: (container, deps) => ConfigCompleteStep.render(container, deps) }
        ];

        this.navigation = new Navigation(
            this.steps,
            () => this.currentStep,
            (step) => {
                this.currentStep = step;
                this.render();
            }
        );

        this.ui = new UI(this.i18n);

        this.config = new Config(
            this.configStore,
            this.navigation,
            this.apiClient,
            this.ui
        );

        this.setupService = new SetupService(
            this.apiClient,
            this.navigation,
            this.ui,
            this.config,
            this.i18n
        );

        this.init();
    }

    get configData() {
        return this.configStore.getAll();
    }

    set configData(value) {
        this.configStore.setAll(value);
    }
    
    async init() {
        this.setFavicon();

        await this.i18n.init();
        this.i18n.setLanguageChangeCallback(() => this.render());

        try {
            this.loadFromLocalCache();

            const urlParams = new URLSearchParams(window.location.search);
            const urlToken = urlParams.get('token');
            if (urlToken) {
                this.token = urlToken;
                this.apiClient.setToken(urlToken);
                this.currentStep = 0;

                await this.checkAndLoadImportedConfig();
            }

            this.render();
        } catch (error) {
            console.error('Initialization error:', error);
            this.render();
        }
    }

    render() {
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

        const stepContent = document.getElementById('step-content');
        step.handler(stepContent, {
            config: this.config,
            navigation: this.navigation,
            ui: this.ui,
            apiClient: this.apiClient,
            setupService: this.setupService,
            i18n: this.i18n
        });

        this.i18n.applyTranslations();

        const languageSwitcherContainer = document.getElementById('language-switcher');
        if (languageSwitcherContainer) {
            this.i18n.generateLanguageSelector('language-switcher', {
                showLabel: false,
                className: 'language-selector',
                style: 'dropdown'
            });
        }

        document.querySelectorAll('.sidebar-step[data-step-index]').forEach(stepElement => {
            stepElement.addEventListener('click', () => {
                const stepIndex = parseInt(stepElement.getAttribute('data-step-index'));
                this.currentStep = stepIndex;
                this.render();
            });
        });

        this.updateUploadStates();
    }
    
    renderSidebarSteps() {
        return `
            <div class="sidebar-steps">
                ${this.steps.map((step, index) => `
                    <div class="sidebar-step ${index < this.currentStep ? 'completed' : index === this.currentStep ? 'active' : ''}"
                         ${index < this.currentStep ? `data-step-index="${index}" style="cursor: pointer;"` : ''}>
                        <div class="sidebar-step-circle">
                            ${index < this.currentStep ? '✓' : index + 1}
                        </div>
                        <div class="sidebar-step-label" data-i18n="${step.titleKey}"></div>
                    </div>
                `).join('')}
            </div>
        `;
    }

    loadFromLocalCache() {
        this.configStore.loadFromLocalCache();
    }

    async checkAndLoadImportedConfig() {
        try {
            const statusResponse = await this.apiClient.getStatus();
            if (statusResponse.success && statusResponse.data && statusResponse.data.revision_mode && statusResponse.data.revision_mode.enabled) {
                console.log('Revision mode detected, loading imported configuration...');

                const configResponse = await this.apiClient.getConfig();
                if (configResponse.success && configResponse.data) {
                    this.configStore.clearLocalCache();
                    this.configStore.setAll(configResponse.data);
                    this.config.saveToLocalCache();
                }
            }
        } catch (error) {
            console.warn('Failed to check or load imported configuration:', error);
        }
    }

    updateUploadStates() {
        updateGeoFileDisplay(this.config, this.i18n);
    }

    setFavicon() {
        const existingLinks = document.querySelectorAll('link[rel="icon"], link[rel="shortcut icon"]');
        existingLinks.forEach(link => link.remove());

        const faviconLink = document.createElement('link');
        faviconLink.rel = 'icon';
        faviconLink.type = 'image/x-icon';
        faviconLink.href = '/static/favicon.ico';
        document.head.appendChild(faviconLink);

        const pngFaviconLink = document.createElement('link');
        pngFaviconLink.rel = 'icon';
        pngFaviconLink.type = 'image/png';
        pngFaviconLink.href = '/static/logo-icon.png';
        document.head.appendChild(pngFaviconLink);
    }
}

// Initialize the app when the page loads
document.addEventListener('DOMContentLoaded', () => {
    window.app = new SetupApp();
});
