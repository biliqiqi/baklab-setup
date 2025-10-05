// BakLab Setup - Frontend Application - v1.2 (Double Escaped Patterns)
import * as Validator from './validator.js';
import { validateAndSetFieldError } from './validator.js';
import { ApiClient, formatFileSize } from './api.js';
import * as ConfigManager from './config-manager.js';

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
            { key: 'welcome', titleKey: 'setup.steps.welcome', handler: this.renderInitStep },
            { key: 'database', titleKey: 'setup.steps.database', handler: this.renderDatabaseStep },
            { key: 'redis', titleKey: 'setup.steps.redis', handler: this.renderRedisStep },
            { key: 'smtp', titleKey: 'setup.steps.smtp', handler: this.renderSMTPStep },
            { key: 'app', titleKey: 'setup.steps.application', handler: this.renderAppStep },
            { key: 'ssl', titleKey: 'setup.steps.ssl', handler: this.renderSSLStep },
            { key: 'admin', titleKey: 'setup.steps.admin_user', handler: this.renderAdminStep },
            { key: 'oauth', titleKey: 'setup.steps.oauth', handler: this.renderOAuthStep },
            { key: 'goaccess', titleKey: 'setup.steps.goaccess', handler: this.renderGoAccessStep },
            { key: 'review', titleKey: 'setup.steps.review', handler: this.renderReviewStep },
            { key: 'config_complete', titleKey: 'setup.steps.config_complete', handler: this.renderConfigCompleteStep }
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
    
    renderInitStep(container) {
        
        container.innerHTML = `
            <div class="form-section">
                <h3 data-i18n="setup.init.welcome_title"></h3>
                <div style="margin-bottom: 2rem; color: var(--gray-600); line-height: 1.6;">
                    <span data-i18n="setup.init.welcome_description_part1"></span>
                    <strong data-i18n="setup.init.timeout_highlight"></strong>
                    <span data-i18n="setup.init.welcome_description_part2"></span>
                </div>

                <!-- 准备工作说明 -->
                <div style="border: 1px solid #ddd; border-radius: 4px; padding: 1rem; margin: 1rem 0; background: #f9f9f9;">
                    <h4 style="margin: 0 0 0.75rem 0;" data-i18n="setup.init.prerequisites_title"></h4>
                    <p style="margin: 0 0 0.75rem 0;" data-i18n="setup.init.prerequisites_description"></p>

                    <ul style="margin: 0.25rem 0 0.75rem 1rem;">
                        <li data-i18n="setup.init.required_smtp"></li>
                        <li data-i18n="setup.init.required_https"></li>
                        <li data-i18n="setup.init.required_static"></li>
                    </ul>

                    <p style="margin: 0; font-size: 0.9rem; font-style: italic;" data-i18n="setup.init.prerequisites_note"></p>
                </div>

                <div class="form-group" style="margin-bottom: 2rem;">
                    <label class="form-label" data-i18n="setup.init.language_label"></label>
                    <div class="language-switcher-container" id="language-switcher"></div>
                </div>

                <div class="btn-group init-actions">
                    <button class="btn btn-primary" onclick="app.initializeSetup()">
                        <span data-i18n="setup.init.initialize_button"></span>
                    </button>
                </div>
            </div>
        `;
    }
    
    renderDatabaseStep(container) {
        container.innerHTML = `
            <form id="database-form" class="form-section" novalidate>
                <h3 data-i18n="setup.database.title"></h3>
                <p style="margin-bottom: 1.5rem; color: var(--gray-600);" data-i18n="setup.database.description"></p>
                
                <div class="form-group">
                    <label class="form-label"><span data-i18n="setup.database.service_type_label"></span> <span data-i18n="common.required"></span></label>
                    <div class="radio-group">
                        <label class="radio-option">
                            <input type="radio" name="db-service-type" value="docker" ${this.config.database.service_type === 'docker' ? 'checked' : ''}>
                            <div>
                                <span data-i18n="setup.database.service_type_docker"></span>
                            </div>
                        </label>
                        <label class="radio-option">
                            <input type="radio" name="db-service-type" value="external" ${this.config.database.service_type === 'external' ? 'checked' : ''}>
                            <div>
                                <span data-i18n="setup.database.service_type_external"></span>
                            </div>
                        </label>
                    </div>
                </div>
                
                <div class="form-row" id="db-connection-fields">
                    <div class="form-group">
                        <label for="db-host"><span data-i18n="setup.database.host_label"></span> <span data-i18n="common.required"></span></label>
                        <input 
                            type="text" 
                            id="db-host" 
                            name="host"
                            value="${this.config.database.host}" 
                            data-i18n-placeholder="setup.database.host_placeholder"
                            required
                            pattern="^[a-zA-Z0-9.\\-]+$"
                            data-i18n-title="setup.database.host_error"
                        >
                        <div class="form-help" data-i18n="setup.database.host_help"></div>
                        <div class="invalid-feedback" data-i18n="setup.database.host_error"></div>
                    </div>
                    <div class="form-group">
                        <label for="db-port"><span data-i18n="setup.database.port_label"></span> <span data-i18n="common.required"></span></label>
                        <input 
                            type="number" 
                            id="db-port" 
                            name="port"
                            value="${this.config.database.port}" 
                            data-i18n-placeholder="setup.database.port_placeholder"
                            required
                            min="1"
                            max="65535"
                            data-i18n-title="setup.database.port_error"
                        >
                        <div class="form-help" data-i18n="setup.database.port_help"></div>
                        <div class="invalid-feedback" data-i18n="setup.database.port_error"></div>
                    </div>
                </div>
                
                <div class="form-group">
                    <label for="db-name"><span data-i18n="setup.database.name_label"></span> <span data-i18n="common.required"></span></label>
                    <input 
                        type="text" 
                        id="db-name" 
                        name="database"
                        value="${this.config.database.name}" 
                        data-i18n-placeholder="setup.database.name_placeholder"
                        required
                        pattern="^[a-zA-Z][a-zA-Z0-9_]*$"
                        minlength="1"
                        maxlength="63"
                        data-i18n-title="setup.database.name_error"
                    >
                    <div class="form-help" data-i18n="setup.database.name_help"></div>
                    <div class="invalid-feedback" data-i18n="setup.database.name_error"></div>
                </div>
                
                <!-- 超级用户配置 -->
                <div id="db-super-user-config" style="background: var(--gray-50); padding: 1rem; border-radius: 8px; margin-bottom: 1.5rem;">
                    <h4 style="margin: 0 0 1rem 0; color: var(--gray-700); font-size: 1rem;" data-i18n="setup.database.super_user_title"></h4>
                    <div class="form-row">
                        <div class="form-group">
                            <label for="db-super-user"><span data-i18n="setup.database.super_username_label"></span> <span data-i18n="common.required"></span></label>
                            <input
                                type="text"
                                id="db-super-user"
                                name="super_username"
                                value="${this.config.database.super_user || 'baklab_super'}"
                                data-i18n-placeholder="setup.database.super_username_placeholder"
                                required
                                pattern="^[a-zA-Z][a-zA-Z0-9_]*$"
                                minlength="1"
                                maxlength="63"
                                data-i18n-title="setup.database.super_username_error"
                            >
                            <div class="form-help" data-i18n="setup.database.super_username_help"></div>
                            <div class="invalid-feedback" data-i18n="setup.database.super_username_error"></div>
                        </div>
                        <div class="form-group">
                            <label for="db-super-password"><span data-i18n="setup.database.super_password_label"></span> <span data-i18n="common.required"></span></label>
                            <input
                                type="password"
                                id="db-super-password"
                                name="super_password"
                                data-i18n-placeholder="setup.database.super_password_placeholder"
                                required
                                minlength="12"
                                maxlength="64"
                                pattern="^[A-Za-z\\d!@#$%^&*]{12,64}$"
                                data-i18n-title="setup.database.super_password_error"
                            >
                            <div class="form-help" data-i18n="setup.database.super_password_help"></div>
                            <div class="invalid-feedback" data-i18n="setup.database.super_password_error"></div>
                        </div>
                    </div>
                </div>

                <!-- 应用用户配置 -->
                <div style="background: var(--gray-50); padding: 1rem; border-radius: 8px; margin-bottom: 1.5rem;">
                    <h4 style="margin: 0 0 1rem 0; color: var(--gray-700); font-size: 1rem;" data-i18n="setup.database.app_user_title"></h4>
                    <div class="form-row">
                        <div class="form-group">
                            <label for="db-app-user"><span data-i18n="setup.database.app_username_label"></span> <span data-i18n="common.required"></span></label>
                            <input
                                type="text"
                                id="db-app-user"
                                name="app_username"
                                value="${this.config.database.app_user || 'baklab'}"
                                data-i18n-placeholder="setup.database.app_username_placeholder"
                                required
                                data-i18n-title="setup.database.app_username_error"
                            >
                            <div class="form-help" data-i18n="setup.database.app_username_help"></div>
                            <div class="invalid-feedback" data-i18n="setup.database.app_username_error"></div>
                        </div>
                        <div class="form-group">
                            <label for="db-app-password"><span data-i18n="setup.database.app_password_label"></span> <span data-i18n="common.required"></span></label>
                            <input
                                type="password"
                                id="db-app-password"
                                name="app_password"
                                data-i18n-placeholder="setup.database.app_password_placeholder"
                                required
                                data-i18n-title="setup.database.app_password_error"
                            >
                            <div class="form-help" data-i18n="setup.database.app_password_help"></div>
                            <div class="invalid-feedback" data-i18n="setup.database.app_password_error"></div>
                        </div>
                    </div>
                </div>
                
                <div id="db-test-connection-container" style="display: none;">
                    <div class="form-group">
                        <button type="button" id="db-test-btn" class="btn btn-outline-primary" onclick="app.testDatabaseConnection()" data-i18n="setup.database.test_connection"></button>
                    </div>
                    <div id="db-connection-results" class="connection-results-container"></div>
                </div>
                
                <div class="btn-group">
                    <button type="button" class="btn btn-secondary" onclick="app.previousStep()" data-i18n="common.previous"></button>
                    <button type="submit" class="btn btn-primary" data-i18n="common.next"></button>
                </div>
            </form>
        `;
        
        // 添加服务类型切换事件监听
        const serviceTypeRadios = document.querySelectorAll('input[name="db-service-type"]');
        serviceTypeRadios.forEach(radio => {
            radio.addEventListener('change', (e) => {
                this.updateDatabaseHostField(e.target.value);
                this.updateRadioStyles('db-service-type');
                // 服务类型切换时重新验证，清除可能的重复验证错误
                setTimeout(() => validateDuplicates(), 10);
            });
        });
        
        // 初始化主机字段状态和样式
        this.updateDatabaseHostField(this.config.database.service_type);
        this.updateRadioStyles('db-service-type');

        // 确保DOM渲染完成后再次设置验证规则
        setTimeout(() => {
            this.updateDatabaseHostField(this.config.database.service_type);
        }, 100);
        
        // 添加实时验证事件监听
        const validateDuplicates = () => {
            const serviceType = document.querySelector('input[name="db-service-type"]:checked').value;
            const appUserField = document.getElementById('db-app-user');
            const appPasswordField = document.getElementById('db-app-password');

            // 仅Docker模式需要验证重复性
            if (serviceType === 'docker') {
                const superUser = document.getElementById('db-super-user').value;
                const appUser = document.getElementById('db-app-user').value;
                const superPassword = document.getElementById('db-super-password').value;
                const appPassword = document.getElementById('db-app-password').value;

                // 验证用户名重复 - 重复性验证优先级最高
                if (superUser === appUser && superUser !== '' && appUser !== '') {
                    const errorMsg = window.i18n ? window.i18n.t('setup.database.username_duplicate_error') : 'Application username must be different from super user username';
                    appUserField.setCustomValidity(errorMsg);
                    // 显示自定义错误提示
                    this.showCustomError(appUserField, errorMsg);
                } else {
                    appUserField.setCustomValidity('');
                    this.hideCustomError(appUserField);
                }
            } else {
                // 外部服务模式清空可能的重复验证错误
                appUserField.setCustomValidity('');
                this.hideCustomError(appUserField);
            }

            // 验证密码重复 - 仅Docker模式需要检查
            if (serviceType === 'docker') {
                const superPassword = document.getElementById('db-super-password').value;
                const appPassword = document.getElementById('db-app-password').value;

                if (superPassword === appPassword && superPassword !== '' && appPassword !== '') {
                    const errorMsg = window.i18n ? window.i18n.t('setup.database.password_duplicate_error') : 'Application password must be different from super user password';
                    appPasswordField.setCustomValidity(errorMsg);
                    // 显示自定义错误提示
                    this.showCustomError(appPasswordField, errorMsg);
                    return; // 重复错误优先级最高，直接返回
                }
            }

            // 验证超级用户密码强度 - 仅Docker模式
            const superPasswordField = document.getElementById('db-super-password');
            const superPassword = document.getElementById('db-super-password').value;
            if (serviceType === 'docker' && superPassword) {
                const isValid = this.validateDatabasePasswordStrength(superPassword);
                const errorMsg = window.i18n ? window.i18n.t('setup.database.super_password_error') :
                    'Super password must be 12-64 characters with at least 3 types: lowercase, uppercase, numbers, special characters (!@#$%^&*)';

                if (!isValid) {
                    superPasswordField.setCustomValidity(errorMsg);
                    this.showCustomError(superPasswordField, errorMsg);
                } else {
                    superPasswordField.setCustomValidity('');
                    this.hideCustomError(superPasswordField);
                }
            } else if (superPassword === '' || serviceType !== 'docker') {
                superPasswordField.setCustomValidity('');
                this.hideCustomError(superPasswordField);
            }

            // 验证应用用户密码强度 - 两种模式都需要
            const appPassword = document.getElementById('db-app-password').value;
            if (appPassword) {
                let isValid = true;
                let errorMsg = '';

                if (serviceType === 'docker') {
                    isValid = this.validateDatabasePasswordStrength(appPassword);
                    errorMsg = window.i18n ? window.i18n.t('setup.database.app_password_error') :
                        'App password must be 12-64 characters with at least 3 types: lowercase, uppercase, numbers, special characters (!@#$%^&*)';
                } else {
                    isValid = this.validateExternalServicePassword(appPassword);
                    errorMsg = window.i18n ? window.i18n.t('setup.database.app_password_external_error') :
                        'App password must be 1-128 characters and cannot contain control characters';
                }

                if (!isValid) {
                    appPasswordField.setCustomValidity(errorMsg);
                    this.showCustomError(appPasswordField, errorMsg);
                } else {
                    appPasswordField.setCustomValidity('');
                    this.hideCustomError(appPasswordField);
                }
            } else if (appPassword === '') {
                appPasswordField.setCustomValidity('');
                this.hideCustomError(appPasswordField);
            }
        };

        // 为相关字段添加实时验证监听器
        // 安全地设置密码字段值，避免HTML转义问题
        const dbSuperPasswordField = document.getElementById('db-super-password');
        if (dbSuperPasswordField && this.config.database.super_password) {
            dbSuperPasswordField.value = this.config.database.super_password;
        }
        const dbAppPasswordField = document.getElementById('db-app-password');
        if (dbAppPasswordField && this.config.database.app_password) {
            dbAppPasswordField.value = this.config.database.app_password;
        }

        ['db-super-user', 'db-app-user', 'db-super-password', 'db-app-password'].forEach(id => {
            const field = document.getElementById(id);
            if (field) {
                field.addEventListener('input', validateDuplicates.bind(this));
                // 移除blur事件监听，避免点击空白处时错误消息被清除
                // field.addEventListener('blur', validateDuplicates.bind(this));
            }
        });

        // 添加表单提交事件监听
        document.getElementById('database-form').addEventListener('submit', async (e) => {
            e.preventDefault();

            // 获取当前服务类型
            const serviceType = document.querySelector('input[name="db-service-type"]:checked').value;

            // 验证数据库密码强度
            const superPassword = document.getElementById('db-super-password').value;
            const appPassword = document.getElementById('db-app-password').value;
            const superPasswordField = document.getElementById('db-super-password');
            const appPasswordField = document.getElementById('db-app-password');

            // 验证超级用户密码 - 仅在Docker模式下验证
            if (serviceType === 'docker') {
                if (superPassword && !this.validateDatabasePasswordStrength(superPassword)) {
                    const errorMsg = window.i18n ? window.i18n.t('setup.database.super_password_error') : 'Super password must be 12-64 characters with at least 3 types: lowercase, uppercase, numbers, special characters (!@#$%^&*)';
                    superPasswordField.setCustomValidity(errorMsg);
                } else {
                    superPasswordField.setCustomValidity('');
                }
            } else {
                // 外部服务模式清除超级用户密码验证错误
                if (superPasswordField) {
                    superPasswordField.setCustomValidity('');
                }
            }

            // 验证应用用户密码 - 根据服务类型使用不同验证规则

            if (appPassword) {
                let isValid = true;
                let errorMsg = '';

                if (serviceType === 'docker') {
                    // Docker模式使用严格验证
                    isValid = this.validateDatabasePasswordStrength(appPassword);
                    errorMsg = window.i18n ? window.i18n.t('setup.database.app_password_error') : 'App password must be 12-64 characters with at least 3 types: lowercase, uppercase, numbers, special characters (!@#$%^&*)';
                } else {
                    // 外部服务使用宽松验证
                    isValid = this.validateExternalServicePassword(appPassword);
                    errorMsg = window.i18n ? window.i18n.t('setup.database.app_password_external_error') : 'App password must be 1-128 characters and cannot contain control characters';
                }

                if (!isValid) {
                    appPasswordField.setCustomValidity(errorMsg);
                } else {
                    appPasswordField.setCustomValidity('');
                }
            } else {
                appPasswordField.setCustomValidity('');
            }

            // 验证用户名和密码不重复 - 仅Docker模式需要检查
            if (serviceType === 'docker') {
                const superUser = document.getElementById('db-super-user').value;
                const appUser = document.getElementById('db-app-user').value;
                const appUserField = document.getElementById('db-app-user');

                if (superUser === appUser && superUser !== '') {
                    const errorMsg = window.i18n ? window.i18n.t('setup.database.username_duplicate_error') : 'Application username must be different from super user username';
                    appUserField.setCustomValidity(errorMsg);
                } else {
                    appUserField.setCustomValidity('');
                }

                if (superPassword === appPassword && superPassword !== '') {
                    const errorMsg = window.i18n ? window.i18n.t('setup.database.password_duplicate_error') : 'Application password must be different from super user password';
                    appPasswordField.setCustomValidity(errorMsg);
                } else if (appPassword) {
                    // 根据服务类型重新验证密码强度（如果之前被密码重复错误覆盖）
                    let isValid = true;
                    let errorMsg = '';

                    if (serviceType === 'docker') {
                        // Docker模式使用严格验证
                        isValid = this.validateDatabasePasswordStrength(appPassword);
                        errorMsg = window.i18n ? window.i18n.t('setup.database.app_password_error') : 'App password must be 12-64 characters with at least 3 types: lowercase, uppercase, numbers, special characters (!@#$%^&*)';
                    } else {
                        // 外部服务使用宽松验证
                        isValid = this.validateExternalServicePassword(appPassword);
                        errorMsg = window.i18n ? window.i18n.t('setup.database.app_password_external_error') : 'App password must be 1-128 characters and cannot contain control characters';
                    }

                    if (!isValid) {
                        appPasswordField.setCustomValidity(errorMsg);
                    }
                }
            } else {
                // 外部服务模式下，清除可能存在的重复验证错误
                const appUserField = document.getElementById('db-app-user');
                if (appUserField) {
                    appUserField.setCustomValidity('');
                }
            }
            
            if (e.target.checkValidity()) {
                await app.saveDatabaseConfig();
            } else {
                app.showFormErrors(e.target);
            }
        });

        this.addFieldTouchListeners(container);
    }
    
    renderRedisStep(container) {
        container.innerHTML = `
            <form id="redis-form" class="form-section" novalidate>
                <h3 data-i18n="setup.redis.title"></h3>
                <p style="margin-bottom: 1.5rem; color: var(--gray-600);" data-i18n="setup.redis.description"></p>
                
                <div class="form-group">
                    <label class="form-label"><span data-i18n="setup.redis.service_type_label"></span> <span data-i18n="common.required"></span></label>
                    <div class="radio-group">
                        <label class="radio-option">
                            <input type="radio" name="redis-service-type" value="docker" ${this.config.redis.service_type === 'docker' ? 'checked' : ''}>
                            <div>
                                <span data-i18n="setup.redis.service_type_docker"></span>
                            </div>
                        </label>
                        <label class="radio-option">
                            <input type="radio" name="redis-service-type" value="external" ${this.config.redis.service_type === 'external' ? 'checked' : ''}>
                            <div>
                                <span data-i18n="setup.redis.service_type_external"></span>
                            </div>
                        </label>
                    </div>
                </div>
                
                <div class="form-row">
                    <div class="form-group">
                        <label for="redis-host"><span data-i18n="setup.redis.host_label"></span> <span data-i18n="common.required"></span></label>
                        <input 
                            type="text" 
                            id="redis-host" 
                            name="host"
                            value="${this.config.redis.host}" 
                            data-i18n-placeholder="setup.redis.host_placeholder"
                            required
                            pattern="^[a-zA-Z0-9.\\-]+$"
                            data-i18n-title="setup.redis.host_error"
                        >
                        <div class="form-help" data-i18n="setup.redis.host_help"></div>
                        <div class="invalid-feedback" data-i18n="setup.redis.host_error"></div>
                    </div>
                    <div class="form-group">
                        <label for="redis-port"><span data-i18n="setup.redis.port_label"></span> <span data-i18n="common.required"></span></label>
                        <input 
                            type="number" 
                            id="redis-port" 
                            name="port"
                            value="${this.config.redis.port}" 
                            data-i18n-placeholder="setup.redis.port_placeholder"
                            required
                            min="1"
                            max="65535"
                            data-i18n-title="setup.redis.port_error"
                        >
                        <div class="form-help" data-i18n="setup.redis.port_help"></div>
                        <div class="invalid-feedback" data-i18n="setup.redis.port_error"></div>
                    </div>
                </div>

                <div class="form-group">
                    <label for="redis-user" id="redis-user-label"><span data-i18n="setup.redis.user_label"></span> <span id="redis-user-required-indicator" data-i18n="common.optional"></span></label>
                    <input
                        type="text"
                        id="redis-user"
                        name="user"
                        value="${this.config.redis.user || ''}"
                        data-i18n-placeholder="setup.redis.user_placeholder"
                        maxlength="128"
                        data-i18n-title="setup.redis.user_error"
                    >
                    <div class="form-help" data-i18n="setup.redis.user_help"></div>
                    <div class="invalid-feedback" data-i18n="setup.redis.user_error"></div>
                </div>

                <!-- Redis CLI 管理配置 -->
                <div id="redis-admin-config" style="background: var(--gray-50); padding: 1rem; border-radius: 8px; margin-bottom: 1.5rem; display: none;">
                    <h4 style="margin: 0 0 0.5rem 0; color: var(--gray-700); font-size: 1rem;" data-i18n="setup.redis.admin_password_title"></h4>
                    <p style="margin: 0 0 1rem 0; color: var(--gray-600); font-size: 0.9rem;" data-i18n="setup.redis.admin_password_description"></p>
                    <div class="form-group">
                        <label for="redis-admin-password"><span data-i18n="setup.redis.admin_password_label"></span> <span data-i18n="common.required"></span></label>
                        <input
                            type="password"
                            id="redis-admin-password"
                            name="admin_password"
                            data-i18n-placeholder="setup.redis.admin_password_placeholder"
                            required
                            minlength="12"
                            maxlength="64"
                            pattern="^[A-Za-z\\d!@#$%^&*]{12,64}$"
                            data-i18n-title="setup.redis.admin_password_error"
                        >
                        <div class="form-help" data-i18n="setup.redis.admin_password_help"></div>
                        <div class="invalid-feedback" data-i18n="setup.redis.admin_password_error"></div>
                    </div>
                </div>

                <div class="form-group">
                    <label for="redis-password"><span data-i18n="setup.redis.password_label"></span> <span data-i18n="common.required"></span></label>
                    <input
                        type="password"
                        id="redis-password"
                        name="password"
                        data-i18n-placeholder="setup.redis.password_placeholder"
                        required
                        data-i18n-title="setup.redis.password_error"
                    >
                    <div class="form-help" data-i18n="setup.redis.password_help"></div>
                    <div class="invalid-feedback" data-i18n="setup.redis.password_error"></div>
                </div>
                
                <div id="redis-test-connection-container" style="display: none;">
                    <div class="form-group">
                        <button type="button" id="redis-test-btn" class="btn btn-outline-primary" onclick="app.testRedisConnection()" data-i18n="setup.redis.test_connection"></button>
                    </div>
                    <div id="redis-connection-results" class="connection-results-container"></div>
                </div>
                
                <div class="btn-group">
                    <button type="button" class="btn btn-secondary" onclick="app.previousStep()" data-i18n="common.previous"></button>
                    <button type="submit" class="btn btn-primary" data-i18n="common.next"></button>
                </div>
            </form>
        `;
        
        // 添加服务类型切换事件监听
        const serviceTypeRadios = document.querySelectorAll('input[name="redis-service-type"]');
        serviceTypeRadios.forEach(radio => {
            radio.addEventListener('change', (e) => {
                this.updateRedisHostField(e.target.value);
                this.updateRadioStyles('redis-service-type');
            });
        });
        
        // 初始化主机字段状态和样式
        this.updateRedisHostField(this.config.redis.service_type);
        this.updateRadioStyles('redis-service-type');

        // 安全地设置密码字段值，避免HTML转义问题
        const redisPasswordField = document.getElementById('redis-password');
        if (redisPasswordField && this.config.redis.password) {
            redisPasswordField.value = this.config.redis.password;
        }
        const redisAdminPasswordField = document.getElementById('redis-admin-password');
        if (redisAdminPasswordField && this.config.redis.admin_password) {
            redisAdminPasswordField.value = this.config.redis.admin_password;
        }

        setTimeout(() => {
            this.updateRedisHostField(this.config.redis.service_type);
        }, 100);

        const validateRedisPasswords = () => {
            const serviceType = document.querySelector('input[name="redis-service-type"]:checked').value;
            const passwordField = document.getElementById('redis-password');
            const adminPasswordField = document.getElementById('redis-admin-password');
            const password = passwordField.value;

            if (password) {
                let isValid = true;
                let errorMessage = '';

                if (serviceType === 'docker') {
                    isValid = this.validateDatabasePasswordStrength(password);
                    errorMessage = window.i18n ? window.i18n.t('setup.redis.password_error') :
                        'Password must be 12-64 characters with at least 3 types: lowercase, uppercase, numbers, special characters (!@#$%^&*)';
                } else {
                    isValid = this.validateExternalServicePassword(password);
                    errorMessage = window.i18n ? window.i18n.t('setup.redis.password_external_error') :
                        'Password must be 1-128 characters and cannot contain control characters';
                }

                if (!isValid) {
                    passwordField.setCustomValidity(errorMessage);
                    this.showCustomError(passwordField, errorMessage);
                } else {
                    passwordField.setCustomValidity('');
                    this.hideCustomError(passwordField);
                }
            } else {
                passwordField.setCustomValidity('');
                this.hideCustomError(passwordField);
            }

            if (serviceType === 'docker' && adminPasswordField) {
                const adminPassword = adminPasswordField.value;

                if (adminPassword) {
                    const isValid = this.validateDatabasePasswordStrength(adminPassword);
                    const errorMessage = window.i18n ? window.i18n.t('setup.redis.admin_password_error') :
                        'CLI password must be 12-64 characters with at least 3 types: lowercase, uppercase, numbers, special characters (!@#$%^&*)';

                    if (!isValid) {
                        adminPasswordField.setCustomValidity(errorMessage);
                        this.showCustomError(adminPasswordField, errorMessage);
                    } else {
                        adminPasswordField.setCustomValidity('');
                        this.hideCustomError(adminPasswordField);
                    }
                } else {
                    adminPasswordField.setCustomValidity('');
                    this.hideCustomError(adminPasswordField);
                }
            } else if (adminPasswordField) {
                adminPasswordField.setCustomValidity('');
                this.hideCustomError(adminPasswordField);
            }
        };

        const passwordField = document.getElementById('redis-password');
        const adminPasswordField = document.getElementById('redis-admin-password');
        if (passwordField) {
            passwordField.addEventListener('input', validateRedisPasswords.bind(this));
        }
        if (adminPasswordField) {
            adminPasswordField.addEventListener('input', validateRedisPasswords.bind(this));
        }

        serviceTypeRadios.forEach(radio => {
            radio.addEventListener('change', () => {
                setTimeout(() => validateRedisPasswords.bind(this)(), 10);
            });
        });

        // Form submit handler
        document.getElementById('redis-form').addEventListener('submit', async (e) => {
            e.preventDefault();

            const serviceType = document.querySelector('input[name="redis-service-type"]:checked').value;

            // 验证Redis应用密码强度
            const password = document.getElementById('redis-password').value;
            const passwordField = document.getElementById('redis-password');

            if (password) {
                let isValid = true;
                let errorMessage = '';

                if (serviceType === 'docker') {
                    isValid = this.validateDatabasePasswordStrength(password);
                    errorMessage = window.i18n ? window.i18n.t('setup.redis.password_error') :
                        'Password must be 12-64 characters with at least 3 types: lowercase, uppercase, numbers, special characters (!@#$%^&*)';
                } else {
                    isValid = this.validateExternalServicePassword(password);
                    errorMessage = window.i18n ? window.i18n.t('setup.redis.password_external_error') :
                        'Password must be 1-128 characters and cannot contain control characters';
                }

                if (!isValid) {
                    passwordField.setCustomValidity(errorMessage);
                } else {
                    passwordField.setCustomValidity('');
                }
            } else {
                passwordField.setCustomValidity('');
            }

            // 验证Redis管理密码强度（仅Docker模式）
            const adminPasswordField = document.getElementById('redis-admin-password');
            if (serviceType === 'docker') {
                const adminPassword = adminPasswordField ? adminPasswordField.value : '';

                if (adminPassword) {
                    const isValid = this.validateDatabasePasswordStrength(adminPassword);
                    if (!isValid) {
                        const errorMessage = window.i18n ? window.i18n.t('setup.redis.admin_password_error') :
                            'CLI password must be 12-64 characters with at least 3 types: lowercase, uppercase, numbers, special characters (!@#$%^&*)';
                        adminPasswordField.setCustomValidity(errorMessage);
                    } else {
                        adminPasswordField.setCustomValidity('');
                    }
                } else if (adminPasswordField) {
                    adminPasswordField.setCustomValidity('');
                }
            } else {
                // 外部服务模式：清除管理密码的验证错误
                if (adminPasswordField) {
                    adminPasswordField.setCustomValidity('');
                }
            }
            
            if (e.target.checkValidity()) {
                await app.saveRedisConfig();
            } else {
                app.showFormErrors(e.target);
            }
        });

        this.addFieldTouchListeners(container);
    }

    renderSMTPStep(container) {
        container.innerHTML = `
            <form id="smtp-form" class="form-section" novalidate>
                <h3 data-i18n="setup.smtp.title"></h3>
                <p style="margin-bottom: 1.5rem; color: var(--gray-600);" data-i18n="setup.smtp.description"></p>

                <div class="form-row">
                    <div class="form-group">
                        <label for="smtp-server"><span data-i18n="setup.smtp.server_label"></span> <span data-i18n="common.required"></span></label>
                        <input
                            type="text"
                            id="smtp-server"
                            name="server"
                            value="${this.config.smtp.server}"
                            data-i18n-placeholder="setup.smtp.server_placeholder"
                            required
                            pattern="^[a-zA-Z0-9.\\-]+$"
                            data-i18n-title="setup.smtp.server_error"
                        >
                        <div class="form-help" data-i18n="setup.smtp.server_help"></div>
                        <div class="invalid-feedback" data-i18n="setup.smtp.server_error"></div>
                    </div>
                    <div class="form-group">
                        <label for="smtp-port"><span data-i18n="setup.smtp.port_label"></span> <span data-i18n="common.required"></span></label>
                        <input
                            type="number"
                            id="smtp-port"
                            name="port"
                            value="${this.config.smtp.port}"
                            data-i18n-placeholder="setup.smtp.port_placeholder"
                            required
                            min="1"
                            max="65535"
                            data-i18n-title="setup.smtp.port_error"
                        >
                        <div class="form-help" data-i18n="setup.smtp.port_help"></div>
                        <div class="invalid-feedback" data-i18n="setup.smtp.port_error"></div>
                    </div>
                </div>

                <div class="form-group">
                    <label for="smtp-user"><span data-i18n="setup.smtp.user_label"></span> <span data-i18n="common.required"></span></label>
                    <input
                        type="text"
                        id="smtp-user"
                        name="user"
                        value="${this.config.smtp.user}"
                        data-i18n-placeholder="setup.smtp.user_placeholder"
                        required
                        data-i18n-title="setup.smtp.user_error"
                    >
                    <div class="form-help" data-i18n="setup.smtp.user_help"></div>
                    <div class="invalid-feedback" data-i18n="setup.smtp.user_error"></div>
                </div>

                <div class="form-group">
                    <label for="smtp-password"><span data-i18n="setup.smtp.password_label"></span> <span data-i18n="common.required"></span></label>
                    <input
                        type="password"
                        id="smtp-password"
                        name="password"
                        data-i18n-placeholder="setup.smtp.password_placeholder"
                        required
                        data-i18n-title="setup.smtp.password_error"
                    >
                    <div class="form-help" data-i18n="setup.smtp.password_help"></div>
                    <div class="invalid-feedback" data-i18n="setup.smtp.password_error"></div>
                </div>

                <div class="form-group">
                    <label for="smtp-sender"><span data-i18n="setup.smtp.sender_label"></span> <span data-i18n="common.required"></span></label>
                    <input
                        type="email"
                        id="smtp-sender"
                        name="sender"
                        value="${this.config.smtp.sender}"
                        data-i18n-placeholder="setup.smtp.sender_placeholder"
                        required
                        data-i18n-title="setup.smtp.sender_error"
                    >
                    <div class="form-help" data-i18n="setup.smtp.sender_help"></div>
                    <div class="invalid-feedback" data-i18n="setup.smtp.sender_error"></div>
                </div>

                <div id="smtp-test-connection-container">
                    <div class="form-group">
                        <button type="button" id="smtp-test-btn" class="btn btn-outline-primary" onclick="app.testSMTPConnection()" data-i18n="setup.smtp.test_connection" disabled></button>
                        <div class="form-help" data-i18n="setup.smtp.test_connection_help"></div>
                    </div>
                    <div id="smtp-connection-results" class="connection-results-container"></div>
                </div>

                <div class="btn-group">
                    <button type="button" class="btn btn-secondary" onclick="app.previousStep()" data-i18n="common.previous"></button>
                    <button type="submit" class="btn btn-primary" data-i18n="common.next"></button>
                </div>
            </form>
        `;

        // 安全地设置密码字段值，避免HTML转义问题
        const smtpPasswordField = document.getElementById('smtp-password');
        if (smtpPasswordField && this.config.smtp.password) {
            smtpPasswordField.value = this.config.smtp.password;
        }

        // 添加字段变化监听以启用测试按钮
        this.addSMTPFieldListeners();

        // 添加表单提交事件监听
        document.getElementById('smtp-form').addEventListener('submit', async (e) => {
            e.preventDefault();

            if (e.target.checkValidity()) {
                await app.saveSMTPConfig();
            } else {
                app.showFormErrors(e.target);
            }
        });

        this.addFieldTouchListeners(container);
    }

    addSMTPFieldListeners() {
        const fields = ['smtp-server', 'smtp-port', 'smtp-user', 'smtp-password', 'smtp-sender'];
        const testBtn = document.getElementById('smtp-test-btn');

        const checkFieldsComplete = () => {
            const allFieldsFilled = fields.every(fieldId => {
                const field = document.getElementById(fieldId);
                return field && field.value.trim() !== '';
            });

            if (testBtn) {
                testBtn.disabled = !allFieldsFilled;
            }
        };

        // 为每个字段添加输入监听
        fields.forEach(fieldId => {
            const field = document.getElementById(fieldId);
            if (field) {
                field.addEventListener('input', checkFieldsComplete);
                field.addEventListener('blur', checkFieldsComplete);
            }
        });

        // 初始检查
        checkFieldsComplete();
    }

    renderAppStep(container) {
        container.innerHTML = `
            <form id="app-form" class="form-section" novalidate>
                <h3 data-i18n="setup.app.title"></h3>
                <p style="margin-bottom: 1.5rem; color: var(--gray-600);" data-i18n="setup.app.description"></p>
                
                <div class="form-group">
                    <label for="app-domain"><span data-i18n="setup.app.domain_label"></span> <span data-i18n="common.required"></span></label>
                    <div style="display: flex; align-items: center; gap: 10px;">
                        <input
                            type="text"
                            id="app-domain"
                            name="domain"
                            value="${this.config.app.domain_name}"
                            data-i18n-placeholder="setup.app.domain_placeholder"
                            required
                            pattern="^([a-zA-Z0-9]([a-zA-Z0-9\\-]*[a-zA-Z0-9])?\\.)+[a-zA-Z]{2,}$|^localhost$"
                            data-i18n-title="setup.app.domain_error"
                            style="flex: 1;"
                        >
                        <div style="display: flex; align-items: center; gap: 3px;">
                            <input type="checkbox" id="use-setup-domain" name="use_setup_domain" ${this.config.app.use_setup_domain ? 'checked' : ''} style="margin: 0;">
                            <label for="use-setup-domain" data-i18n="setup.app.use_setup_domain" style="margin: 0; white-space: nowrap; line-height: 1;"></label>
                        </div>
                    </div>
                    <div class="invalid-feedback" data-i18n="setup.app.domain_error"></div>
                </div>

                <div class="form-group">
                    <label for="app-static-host"><span data-i18n="setup.app.static_host_label"></span> <span data-i18n="common.required"></span></label>
                    <input
                        type="text"
                        id="app-static-host"
                        name="static_host"
                        value="${this.config.app.static_host_name || ''}"
                        data-i18n-placeholder="setup.app.static_host_placeholder"
                        required
                        pattern="^([a-zA-Z0-9]([a-zA-Z0-9\\-]*[a-zA-Z0-9])?\\.)+[a-zA-Z]{2,}(:[0-9]{1,5})?$|^localhost(:[0-9]{1,5})?$"
                        data-i18n-title="setup.app.static_host_error"
                    >
                    <div class="form-help" data-i18n="setup.app.static_host_help"></div>
                    <div class="invalid-feedback" data-i18n="setup.app.static_host_error"></div>
                </div>

                <div class="form-group">
                    <label for="app-brand"><span data-i18n="setup.app.brand_label"></span> <span data-i18n="common.required"></span></label>
                    <input
                        type="text"
                        id="app-brand"
                        name="brand"
                        value="${this.config.app.brand_name}"
                        data-i18n-placeholder="setup.app.brand_placeholder"
                        required
                        minlength="2"
                        maxlength="50"
                    >
                </div>
                <div class="form-group">
                    <label for="app-version" data-i18n="setup.app.version_label"></label>
                    <select
                        id="app-version"
                        name="version"
                    >
                        <option value="latest" ${this.config.app.version === 'latest' ? 'selected' : ''}>latest</option>
                        <!-- Temporarily commented out specific versions, using latest only -->
                        <!-- <option value="v2.0.0" ${this.config.app.version === 'v2.0.0' ? 'selected' : ''}>v2.0.0</option> -->
                        <!-- <option value="v1.9.0" ${this.config.app.version === 'v1.9.0' ? 'selected' : ''}>v1.9.0</option> -->
                        <!-- <option value="v1.8.0" ${this.config.app.version === 'v1.8.0' ? 'selected' : ''}>v1.8.0</option> -->
                    </select>
                    <div class="form-help" data-i18n="setup.app.version_help"></div>
                </div>


                <div class="form-group">
                    <label for="app-cors" data-i18n="setup.app.cors_label"></label>
                    <textarea
                        id="app-cors"
                        name="cors"
                        rows="3"
                        data-i18n-placeholder="setup.app.cors_placeholder"
                        pattern="^(https?:\\/\\/[a-zA-Z0-9.\\-]+(?:\\:[0-9]+)?(?:\\/.*)?\\s*)*$"
                        data-i18n-title="setup.app.cors_error"
                    >${this.config.app.cors_allow_origins.join('\\n')}</textarea>
                    <div class="form-help" data-i18n="setup.app.cors_help"></div>
                    <div class="invalid-feedback" data-i18n="setup.app.cors_error"></div>
                </div>
                
                <div class="form-row">
                    <div class="form-group">
                        <label for="app-lang"><span data-i18n="setup.app.language_label"></span> <span data-i18n="common.required"></span></label>
                        <select 
                            id="app-lang" 
                            name="language"
                            required
                            data-i18n-title="setup.app.language_error"
                        >
                            <option value="en" ${this.config.app.default_lang === 'en' ? 'selected' : ''}>English</option>
                            <option value="zh-Hans" ${this.config.app.default_lang === 'zh-Hans' ? 'selected' : ''}>中文 (简体)</option>
                        </select>
                        <div class="form-help" data-i18n="setup.app.language_help"></div>
                        <div class="invalid-feedback" data-i18n="setup.app.language_error"></div>
                    </div>
                    <div class="form-group">
                        <label for="app-debug">
                            <input type="checkbox" id="app-debug" name="debug" ${this.config.app.debug ? 'checked' : ''}>
                            <span data-i18n="setup.app.debug_label"></span>
                        </label>
                        <div class="form-help" data-i18n="setup.app.debug_help"></div>
                    </div>
                </div>

                <h4 style="margin: 2rem 0 1rem 0; color: var(--gray-700);" data-i18n="setup.app.jwt_section_title"></h4>
                <p style="margin-bottom: 1rem; color: var(--gray-600);" data-i18n="setup.app.jwt_section_description"></p>
                
                <div class="form-group">
                    <label class="radio-group-label" data-i18n="setup.app.jwt_method_label"></label>
                    <div class="radio-group">
                        <div class="radio-option">
                            <input
                                type="radio"
                                id="jwt-method-auto"
                                name="jwt_method"
                                value="auto"
                                ${!this.config.app.jwt_key_from_file ? 'checked' : ''}
                                onchange="app.updateJWTMethodDisplay(); app.updateRadioStyles('jwt_method');"
                            >
                            <label for="jwt-method-auto">
                                <span data-i18n="setup.app.jwt_method_auto"></span>
                            </label>
                        </div>
                        <div class="radio-option">
                            <input
                                type="radio"
                                id="jwt-method-path"
                                name="jwt_method"
                                value="path"
                                ${this.config.app.jwt_key_from_file ? 'checked' : ''}
                                onchange="app.updateJWTMethodDisplay(); app.updateRadioStyles('jwt_method');"
                            >
                            <label for="jwt-method-path">
                                <span data-i18n="setup.app.jwt_method_path"></span>
                            </label>
                        </div>
                    </div>
                </div>
                
                <div id="jwt-auto-config" style="display: ${!this.config.app.jwt_key_from_file ? 'block' : 'none'};">
                    <div class="info-box">
                        <p style="color: var(--gray-600); font-size: 0.875rem; margin-bottom: 0;" data-i18n="setup.app.jwt_auto_description"></p>
                    </div>
                </div>
                
                <div id="jwt-path-config" style="display: ${this.config.app.jwt_key_from_file ? 'block' : 'none'};">
                    <details style="margin-bottom: 1.5rem;">
                        <summary style="color: var(--gray-600); font-size: 0.9rem; margin-bottom: 0.75rem;" data-i18n="setup.app.jwt_generation_title"></summary>
                        <div style="background: var(--info-bg, #e3f2fd); border: 1px solid var(--info-border, #1976d2); border-radius: 4px; padding: 1rem;" id="jwt-generation-commands" data-i18n-html="setup.app.jwt_generation_commands"></div>
                    </details>
                    <div class="form-group">
                        <label for="jwt-key-path" data-i18n="setup.app.jwt_path_label"></label>
                        <input
                            type="text"
                            id="jwt-key-path"
                            name="jwt_key_path"
                            value="${this.config.app.jwt_key_file_path}"
                            data-i18n-placeholder="setup.app.jwt_path_placeholder"
                        >
                        <div class="form-help" data-i18n="setup.app.jwt_path_help"></div>
                        <div class="invalid-feedback" data-i18n="setup.app.jwt_path_required"></div>
                    </div>
                </div>
                
                <div class="btn-group">
                    <button type="button" class="btn btn-secondary" onclick="app.previousStep()" data-i18n="common.previous"></button>
                    <button type="submit" class="btn btn-primary" data-i18n="common.next"></button>
                </div>
            </form>
        `;
        
        // 添加表单提交事件监听
        document.getElementById('app-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            if (e.target.checkValidity()) {
                await app.saveAppConfig();
            } else {
                app.showFormErrors(e.target);
            }
        });
        
        // 初始化 JWT method 显示状态和样式
        this.updateJWTMethodDisplay();
        this.updateRadioStyles('jwt_method');

        // JWT key 路径输入框变化时清除验证错误
        document.getElementById('jwt-key-path').addEventListener('input', (e) => {
            e.target.setCustomValidity('');
        });

        // 域名复选框事件监听
        document.getElementById('use-setup-domain').addEventListener('change', (e) => {
            const domainInput = document.getElementById('app-domain');
            if (e.target.checked) {
                // 获取设置程序使用的域名（从URL中获取）
                const setupDomain = window.location.hostname;
                domainInput.value = setupDomain;
                domainInput.readOnly = true;
                domainInput.style.backgroundColor = '#f8f9fa';

                // 如果启用了HTTPS，自动勾选使用设置程序证书
                if (this.config.ssl && this.config.ssl.enabled) {
                    this.config.ssl.use_setup_cert = true;
                    // 标记需要在SSL步骤中应用这个状态
                    this._shouldAutoSetSSLCert = true;
                }
            } else {
                domainInput.readOnly = false;
                domainInput.style.backgroundColor = '';

                // 取消域名使用时，恢复SSL证书选择的自由度
                this._shouldAutoSetSSLCert = false;

                // 更新SSL配置，取消使用设置程序证书
                this.config.ssl.use_setup_cert = false;

                // 清理当前页面的SSL自动选择状态（如果SSL步骤已渲染）
                this.clearSSLAutoSelection();
            }
            // 更新配置状态
            this.config.app.use_setup_domain = e.target.checked;

            // 立即保存配置状态到本地缓存
            this.saveToLocalCache();
        });

        // 初始化复选框状态
        const useSetupDomainCheckbox = document.getElementById('use-setup-domain');
        if (this.config.app.use_setup_domain) {
            const domainInput = document.getElementById('app-domain');
            const setupDomain = window.location.hostname;
            domainInput.value = setupDomain;
            domainInput.readOnly = true;
            domainInput.style.backgroundColor = '#f8f9fa';
        }

        this.addFieldTouchListeners(container);
    }

    renderOAuthStep(container) {
        container.innerHTML = `
            <form id="oauth-form" class="form-section" novalidate>
                <h3 data-i18n="setup.oauth.title"></h3>
                <p style="margin-bottom: 1.5rem; color: var(--gray-600);" data-i18n="setup.oauth.description"></p>

                <!-- Google OAuth Configuration -->
                <div class="oauth-provider-section" style="margin-bottom: 2rem;">
                    <h4 style="margin: 1.5rem 0 1rem 0; color: var(--gray-700); display: flex; align-items: center;">
                        <img src="/static/google.webp" alt="Google" width="20" height="20" style="margin-right: 0.5rem;">
                        Google
                    </h4>
                    <div class="form-group">
                        <label class="checkbox-label">
                            <input type="checkbox" id="google-enabled" name="google_enabled" ${this.config.oauth.google_enabled ? 'checked' : ''}>
                            <span data-i18n="setup.oauth.google_enable_label"></span>
                        </label>
                    </div>
                    <div id="google-config" style="display: ${this.config.oauth.google_enabled ? 'block' : 'none'};">
                        <div class="form-row">
                            <div class="form-group">
                                <label for="google-client-id"><span data-i18n="setup.oauth.google_client_id_label"></span> <span data-i18n="common.required"></span></label>
                                <input
                                    type="text"
                                    id="google-client-id"
                                    name="google_client_id"
                                    value="${this.config.oauth.google_client_id}"
                                    data-i18n-placeholder="setup.oauth.google_client_id_placeholder"
                                    ${this.config.oauth.google_enabled ? 'required' : ''}
                                >
                                <div class="invalid-feedback" data-i18n="setup.oauth.google_client_id_error"></div>
                            </div>
                            <div class="form-group">
                                <label for="google-client-secret"><span data-i18n="setup.oauth.google_client_secret_label"></span> <span data-i18n="common.required"></span></label>
                                <input
                                    type="password"
                                    id="google-client-secret"
                                    name="google_client_secret"
                                    data-i18n-placeholder="setup.oauth.google_client_secret_placeholder"
                                    ${this.config.oauth.google_enabled ? 'required' : ''}
                                >
                                <div class="invalid-feedback" data-i18n="setup.oauth.google_client_secret_error"></div>
                            </div>
                        </div>
                    </div>
                    <div style="margin-top: 0.5rem; font-size: 0.875rem; color: var(--gray-600);">
                        <span data-i18n="setup.oauth.google_docs_description"></span>
                        <a href="https://developers.google.com/identity/protocols/oauth2" target="_blank" data-i18n="setup.oauth.google_docs_link" style="margin-left: 0.25rem;"></a>
                    </div>
                </div>

                <!-- GitHub OAuth Configuration -->
                <div class="oauth-provider-section">
                    <h4 style="margin: 1.5rem 0 1rem 0; color: var(--gray-700); display: flex; align-items: center;">
                        <img src="/static/github-mark.png" alt="GitHub" width="20" height="20" style="margin-right: 0.5rem;">
                        GitHub
                    </h4>
                    <div class="form-group">
                        <label class="checkbox-label">
                            <input type="checkbox" id="github-enabled" name="github_enabled" ${this.config.oauth.github_enabled ? 'checked' : ''}>
                            <span data-i18n="setup.oauth.github_enable_label"></span>
                        </label>
                    </div>
                    <div id="github-config" style="display: ${this.config.oauth.github_enabled ? 'block' : 'none'};">
                        <div class="form-row">
                            <div class="form-group">
                                <label for="github-client-id"><span data-i18n="setup.oauth.github_client_id_label"></span> <span data-i18n="common.required"></span></label>
                                <input
                                    type="text"
                                    id="github-client-id"
                                    name="github_client_id"
                                    value="${this.config.oauth.github_client_id}"
                                    data-i18n-placeholder="setup.oauth.github_client_id_placeholder"
                                    ${this.config.oauth.github_enabled ? 'required' : ''}
                                >
                                <div class="invalid-feedback" data-i18n="setup.oauth.github_client_id_error"></div>
                            </div>
                            <div class="form-group">
                                <label for="github-client-secret"><span data-i18n="setup.oauth.github_client_secret_label"></span> <span data-i18n="common.required"></span></label>
                                <input
                                    type="password"
                                    id="github-client-secret"
                                    name="github_client_secret"
                                    data-i18n-placeholder="setup.oauth.github_client_secret_placeholder"
                                    ${this.config.oauth.github_enabled ? 'required' : ''}
                                >
                                <div class="invalid-feedback" data-i18n="setup.oauth.github_client_secret_error"></div>
                            </div>
                        </div>
                    </div>
                    <div style="margin-top: 0.5rem; font-size: 0.875rem; color: var(--gray-600);">
                        <span data-i18n="setup.oauth.github_docs_description"></span>
                        <a href="https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/creating-an-oauth-app" target="_blank" data-i18n="setup.oauth.github_docs_link" style="margin-left: 0.25rem;"></a>
                    </div>
                </div>

                <!-- Frontend Origin Configuration (only when OAuth is enabled) -->
                <div id="frontend-origin-section" style="display: ${this.config.oauth.google_enabled || this.config.oauth.github_enabled ? 'block' : 'none'}; margin-top: 2rem;">
                    <h4 style="margin: 1.5rem 0 1rem 0; color: var(--gray-700);" data-i18n="setup.oauth.frontend_origin_title"></h4>
                    <div class="form-group">
                        <label for="frontend-origin"><span data-i18n="setup.oauth.frontend_origin_label"></span></label>
                        <input
                            type="url"
                            id="frontend-origin"
                            name="frontend_origin"
                            value="${this.config.oauth.frontend_origin || (this.config.ssl?.enabled ? 'https://' : 'http://') + this.config.app.domain_name}"
                            data-i18n-placeholder="setup.oauth.frontend_origin_placeholder"
                        >
                        <div class="form-help" data-i18n="setup.oauth.frontend_origin_help"></div>
                        <div class="invalid-feedback" data-i18n="setup.oauth.frontend_origin_error"></div>
                    </div>
                </div>

                <div class="btn-group">
                    <button type="button" class="btn btn-secondary" onclick="app.previousStep()" data-i18n="common.previous"></button>
                    <button type="submit" class="btn btn-primary" data-i18n="common.next"></button>
                </div>
            </form>
        `;

        // Google OAuth 启用状态切换
        document.getElementById('google-enabled').addEventListener('change', (e) => {
            const configDiv = document.getElementById('google-config');
            const clientId = document.getElementById('google-client-id');
            const clientSecret = document.getElementById('google-client-secret');

            if (e.target.checked) {
                configDiv.style.display = 'block';
                clientId.required = true;
                clientSecret.required = true;
            } else {
                configDiv.style.display = 'none';
                clientId.required = false;
                clientSecret.required = false;
                // 清除验证错误
                this.clearFormErrors(document.getElementById('oauth-form'));
            }
            // 更新前端源配置显示
            this.updateFrontendOriginVisibility();
        });

        // GitHub OAuth 启用状态切换
        document.getElementById('github-enabled').addEventListener('change', (e) => {
            const configDiv = document.getElementById('github-config');
            const clientId = document.getElementById('github-client-id');
            const clientSecret = document.getElementById('github-client-secret');

            if (e.target.checked) {
                configDiv.style.display = 'block';
                clientId.required = true;
                clientSecret.required = true;
            } else {
                configDiv.style.display = 'none';
                clientId.required = false;
                clientSecret.required = false;
                // 清除验证错误
                this.clearFormErrors(document.getElementById('oauth-form'));
            }
            // 更新前端源配置显示
            this.updateFrontendOriginVisibility();
        });

        // 安全地设置密码字段值，避免HTML转义问题
        const googleClientSecretField = document.getElementById('google-client-secret');
        if (googleClientSecretField && this.config.oauth.google_client_secret) {
            googleClientSecretField.value = this.config.oauth.google_client_secret;
        }
        const githubClientSecretField = document.getElementById('github-client-secret');
        if (githubClientSecretField && this.config.oauth.github_client_secret) {
            githubClientSecretField.value = this.config.oauth.github_client_secret;
        }

        // 表单提交处理
        document.getElementById('oauth-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            if (e.target.checkValidity()) {
                await app.saveOAuthConfig();
            } else {
                app.showFormErrors(e.target);
            }
        });

        this.addFieldTouchListeners(container);
    }

    renderSSLStep(container) {
        container.innerHTML = `
            <form id="ssl-form" class="form-section" novalidate>
                <h3 data-i18n="setup.ssl.title"></h3>
                <p style="margin-bottom: 1.5rem; color: var(--gray-600);" data-i18n="setup.ssl.description"></p>

                <div class="alert alert-warning" style="margin-bottom: 1.5rem; color: inherit;">
                    <p style="margin: 0;" data-i18n="setup.ssl.domain_match_warning_text" data-i18n-params='{"domain":"${this.config.app.domain_name || 'example.com'}"}'></p>
                </div>

                <div class="form-group">
                    <label class="checkbox-label">
                        <input type="checkbox" id="ssl-enabled" name="enabled" ${this.config.ssl.enabled ? 'checked' : ''}>
                        <span data-i18n="setup.ssl.enable_label"></span>
                    </label>
                </div>

                <div id="ssl-config" style="display: ${this.config.ssl.enabled ? 'block' : 'none'};">
                    <div class="form-group">
                        <label class="checkbox-label">
                            <input type="checkbox" id="ssl-use-setup-cert" name="use_setup_cert" ${this.config.ssl.use_setup_cert ? 'checked' : ''}>
                            <span data-i18n="setup.ssl.use_setup_cert_label"></span>
                        </label>
                        <div class="form-help" data-i18n="setup.ssl.use_setup_cert_help"></div>
                    </div>

                    <div class="form-group">
                        <label for="ssl-cert-path" data-i18n="setup.ssl.cert_path_label"></label>
                        <input type="text" id="ssl-cert-path" name="cert_path" value="${this.config.ssl.cert_path}" 
                               placeholder="/path/to/certificate.crt" required>
                        <div class="invalid-feedback" style="display: none;"></div>
                        <div class="form-help" data-i18n="setup.ssl.cert_path_help"></div>
                    </div>

                    <div class="form-group">
                        <label for="ssl-key-path" data-i18n="setup.ssl.key_path_label"></label>
                        <input type="text" id="ssl-key-path" name="key_path" value="${this.config.ssl.key_path}" 
                               placeholder="/path/to/private.key" required>
                        <div class="invalid-feedback" style="display: none;"></div>
                        <div class="form-help" data-i18n="setup.ssl.key_path_help"></div>
                    </div>
                </div>

                <div class="btn-group">
                    <button type="button" class="btn btn-secondary" onclick="app.previousStep()" data-i18n="common.previous"></button>
                    <button type="submit" class="btn btn-primary" data-i18n="common.next"></button>
                </div>
            </form>
        `;

        // SSL 启用状态切换
        document.getElementById('ssl-enabled').addEventListener('change', (e) => {
            const configDiv = document.getElementById('ssl-config');
            const certPath = document.getElementById('ssl-cert-path');
            const keyPath = document.getElementById('ssl-key-path');

            if (e.target.checked) {
                configDiv.style.display = 'block';
                certPath.required = true;
                keyPath.required = true;

                // 更新配置并触发域名SSL整合
                this.config.ssl.enabled = true;
                setTimeout(() => this.handleDomainSSLIntegration(), 0);
            } else {
                configDiv.style.display = 'none';
                certPath.required = false;
                keyPath.required = false;
                // 清除验证错误
                this.clearFormErrors(document.getElementById('ssl-form'));

                // 更新配置并重置SSL证书选择的自由度
                this.config.ssl.enabled = false;
                this.clearSSLAutoSelection();
            }
        });

        // 使用设置程序证书切换
        document.getElementById('ssl-use-setup-cert').addEventListener('change', async (e) => {
            const certPath = document.getElementById('ssl-cert-path');
            const keyPath = document.getElementById('ssl-key-path');
            
            if (e.target.checked) {
                // 获取当前设置程序使用的证书路径
                try {
                    const response = await fetch('/api/current-cert-paths', {
                        method: 'GET',
                        headers: {
                            'Setup-Token': this.token
                        }
                    });
                    const result = await response.json();
                    if (result.success) {
                        certPath.value = result.data.cert_path;
                        keyPath.value = result.data.key_path;
                        certPath.readOnly = true;
                        keyPath.readOnly = true;
                    }
                } catch (error) {
                    console.error('Failed to get current cert paths:', error);
                    e.target.checked = false; // 取消勾选
                }
            } else {
                certPath.readOnly = false;
                keyPath.readOnly = false;
            }
        });

        // 处理域名复选框对SSL证书的影响
        this.handleDomainSSLIntegration();

        // 表单提交处理
        document.getElementById('ssl-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const formData = new FormData(e.target);
            const sslConfig = {
                enabled: formData.get('enabled') === 'on',
                cert_path: formData.get('cert_path') || '',
                key_path: formData.get('key_path') || '',
                use_setup_cert: formData.get('use_setup_cert') === 'on'
            };

            // 验证逻辑
            let isValid = true;
            this.clearFormErrors(document.getElementById('ssl-form'));

            if (sslConfig.enabled) {
                if (!sslConfig.cert_path.trim()) {
                    const message = window.i18n ? window.i18n.t('setup.ssl.cert_path_required') : 'Certificate path is required when SSL is enabled';
                    this.showFieldError(document.getElementById('ssl-cert-path'), message);
                    isValid = false;
                }
                if (!sslConfig.key_path.trim()) {
                    const message = window.i18n ? window.i18n.t('setup.ssl.key_path_required') : 'Private key path is required when SSL is enabled';
                    this.showFieldError(document.getElementById('ssl-key-path'), message);
                    isValid = false;
                }
            }

            if (isValid) {
                this.config.ssl = sslConfig;
                await this.saveConfig();
                this.nextStep();
            }
        });

        this.addFieldTouchListeners(container);
    }

    // 处理域名复选框对SSL证书选择的影响
    handleDomainSSLIntegration() {
        const sslUseSetupCertCheckbox = document.getElementById('ssl-use-setup-cert');
        const sslEnabled = document.getElementById('ssl-enabled');

        if (!sslUseSetupCertCheckbox || !sslEnabled) {
            return; // SSL元素不存在时跳过
        }

        // 检查域名复选框是否勾选且SSL已启用
        if (this.config.app.use_setup_domain && this.config.ssl.enabled) {
            // 自动勾选使用设置程序证书
            sslUseSetupCertCheckbox.checked = true;
            sslUseSetupCertCheckbox.readOnly = true;
            sslUseSetupCertCheckbox.disabled = true;

            // 触发证书路径的自动填充
            const event = new Event('change');
            sslUseSetupCertCheckbox.dispatchEvent(event);

            // 更新配置
            this.config.ssl.use_setup_cert = true;

            // 添加提示样式和说明
            const parentLabel = sslUseSetupCertCheckbox.closest('.checkbox-label');
            if (parentLabel) {
                parentLabel.style.opacity = '0.7';
                parentLabel.title = window.i18n ?
                    window.i18n.t('setup.ssl.auto_selected_due_to_domain') :
                    'Automatically selected because you are using the setup program domain';

                // 添加说明文本
                let autoNote = parentLabel.querySelector('.auto-selection-note');
                if (!autoNote) {
                    autoNote = document.createElement('span');
                    autoNote.className = 'auto-selection-note';
                    autoNote.style.cssText = 'font-size: 0.85em; color: var(--gray-600); margin-left: 0.5rem; font-style: italic; display: inline;';
                    // 插入到label的span元素后面
                    const labelSpan = parentLabel.querySelector('span');
                    if (labelSpan) {
                        labelSpan.parentNode.insertBefore(autoNote, labelSpan.nextSibling);
                    } else {
                        parentLabel.appendChild(autoNote);
                    }
                }
                const noteText = window.i18n ?
                    window.i18n.t('setup.ssl.auto_selected_due_to_domain') :
                    'Automatically selected because you are using the setup program domain';
                autoNote.textContent = ` (${noteText})`;
            }
        } else if (!this.config.app.use_setup_domain) {
            // 如果域名复选框未勾选，确保SSL证书复选框也不会被自动勾选
            this.clearSSLAutoSelection();
        }
    }

    // 清理SSL证书的自动选择状态
    clearSSLAutoSelection() {
        const sslUseSetupCertCheckbox = document.getElementById('ssl-use-setup-cert');
        if (sslUseSetupCertCheckbox) {
            // 取消勾选复选框
            sslUseSetupCertCheckbox.checked = false;
            sslUseSetupCertCheckbox.readOnly = false;
            sslUseSetupCertCheckbox.disabled = false;

            // 清除证书路径输入框的内容和只读状态
            const certPath = document.getElementById('ssl-cert-path');
            const keyPath = document.getElementById('ssl-key-path');
            if (certPath) {
                certPath.value = '';
                certPath.readOnly = false;
                certPath.style.backgroundColor = '';
            }
            if (keyPath) {
                keyPath.value = '';
                keyPath.readOnly = false;
                keyPath.style.backgroundColor = '';
            }

            const parentLabel = sslUseSetupCertCheckbox.closest('.checkbox-label');
            if (parentLabel) {
                parentLabel.style.opacity = '';
                parentLabel.title = '';

                // 移除自动选择说明文本
                const autoNote = parentLabel.querySelector('.auto-selection-note');
                if (autoNote) {
                    autoNote.remove();
                }
            }

            // 更新配置
            this.config.ssl.use_setup_cert = false;
        }
    }

    renderGoAccessStep(container) {
        container.innerHTML = `
            <form id="goaccess-form" class="form-section" novalidate>
                <h3 data-i18n="setup.goaccess.title"></h3>
                <p style="margin-bottom: 1.5rem; color: var(--gray-600);" data-i18n="setup.goaccess.description"></p>
                
                <div class="form-group">
                    <label class="checkbox-label">
                        <input type="checkbox" id="goaccess-enabled" name="enabled" ${this.config.goaccess.enabled ? 'checked' : ''}>
                        <span data-i18n="setup.goaccess.enable_label"></span>
                    </label>
                </div>
                
                <div id="goaccess-config" style="display: ${this.config.goaccess.enabled ? 'block' : 'none'};">
                    <div class="form-group">
                        <label for="goaccess-geo-file"><span data-i18n="setup.goaccess.geo_file_label"></span></label>
                        <div class="file-upload-area" id="geo-upload-area">
                            <input type="file" id="goaccess-geo-file" name="geo_file" accept=".mmdb" style="display: none;">
                            <div class="file-upload-content">
                                <div class="file-upload-icon">📁</div>
                                <p data-i18n="setup.goaccess.geo_file_help"></p>
                                <button type="button" class="btn-secondary" id="geo-file-select-btn">
                                    <span data-i18n="setup.goaccess.select_file"></span>
                                </button>
                            </div>
                            <div id="geo-file-info" style="display: none;">
                                <p><strong data-i18n="setup.goaccess.selected_file"></strong>: <span id="geo-file-name"></span></p>
                                <p><strong data-i18n="setup.goaccess.file_size"></strong>: <span id="geo-file-size"></span></p>
                                <button type="button" class="btn-secondary" style="margin-top: 0.5rem;" onclick="app.showGeoUploadArea()">
                                    <span data-i18n="setup.goaccess.select_file"></span>
                                </button>
                            </div>
                        </div>
                        <div class="invalid-feedback" style="display: none;"></div>
                        <div class="form-help">
                            <span data-i18n="setup.goaccess.geo_file_note"></span>
                            <a href="https://dev.maxmind.com/geoip/geolite2-free-geolocation-data" target="_blank" data-i18n="setup.goaccess.download_link"></a>
                        </div>
                    </div>
                </div>
                
                <div class="btn-group">
                    <button type="button" class="btn btn-secondary" onclick="app.previousStep()">
                        <span data-i18n="common.previous"></span>
                    </button>
                    <button type="submit" class="btn btn-primary">
                        <span data-i18n="common.next"></span>
                    </button>
                </div>
            </form>
        `;

        // 绑定事件监听器
        const enabledCheckbox = container.querySelector('#goaccess-enabled');
        const configDiv = container.querySelector('#goaccess-config');
        const fileInput = container.querySelector('#goaccess-geo-file');
        const uploadArea = container.querySelector('#geo-upload-area');
        const fileInfo = container.querySelector('#file-info');

        enabledCheckbox.addEventListener('change', (e) => {
            configDiv.style.display = e.target.checked ? 'block' : 'none';
            this.config.goaccess.enabled = e.target.checked;
            
            // 如果禁用 GoAccess，清除文件上传错误状态
            if (!e.target.checked) {
                const formGroup = uploadArea.closest('.form-group');
                if (formGroup) {
                    formGroup.classList.remove('error');
                    const errorMessage = formGroup.querySelector('.invalid-feedback');
                    if (errorMessage) {
                        errorMessage.style.display = 'none';
                        errorMessage.textContent = '';
                    }
                }
            }
        });

        // 文件拖拽支持
        uploadArea.addEventListener('dragover', (e) => {
            e.preventDefault();
            uploadArea.classList.add('drag-over');
        });

        uploadArea.addEventListener('dragleave', (e) => {
            e.preventDefault();
            uploadArea.classList.remove('drag-over');
        });

        uploadArea.addEventListener('drop', (e) => {
            e.preventDefault();
            uploadArea.classList.remove('drag-over');
            // 检查是否有上传正在进行中
            if (this.apiClient.requestLocks.geoFileUpload) {
                const warningMsg = window.i18n ? window.i18n.t('setup.app.jwt_uploading') : 'File upload in progress...';
                alert(warningMsg);
                return;
            }
            const files = e.dataTransfer.files;
            if (files.length > 0) {
                this.handleGeoFileSelect(files[0], fileInfo);
            }
        });

        // 文件选择按钮点击事件
        const selectBtn = container.querySelector('#geo-file-select-btn');
        if (selectBtn) {
            selectBtn.addEventListener('click', () => {
                // 检查是否有上传正在进行中
                if (this.apiClient.requestLocks.geoFileUpload) {
                    const warningMsg = window.i18n ? window.i18n.t('setup.app.jwt_uploading') : 'File upload in progress...';
                    alert(warningMsg);
                    return;
                }
                fileInput.click();
            });
        }

        fileInput.addEventListener('change', (e) => {
            if (e.target.files.length > 0) {
                // 检查是否有上传正在进行中
                if (this.apiClient.requestLocks.geoFileUpload) {
                    const warningMsg = window.i18n ? window.i18n.t('setup.app.jwt_uploading') : 'File upload in progress...';
                    alert(warningMsg);
                    e.target.value = ''; // 清空文件选择
                    return;
                }
                this.handleGeoFileSelect(e.target.files[0], fileInfo);
            }
        });

        // 表单提交
        const self = this;
        container.querySelector('#goaccess-form').addEventListener('submit', (e) => {
            e.preventDefault();
            if (self.validateGoAccessForm(e.target)) {
                self.saveGoAccessConfig();
                self.nextStep();
            } else {
                self.showFormErrors(e.target);
            }
        });

        // 检查实际的GeoIP文件状态，确保缓存与实际文件同步
        this.checkGeoFileStatus();
    }


    async handleGeoFileSelect(file, fileInfoDivParam) {
        // 声明所有需要的DOM元素引用
        const fileInfoDiv = fileInfoDivParam || document.getElementById('geo-file-info');
        const uploadArea = document.getElementById('geo-upload-area');

        try {
            const result = await this.apiClient.protectedApiCall('geoFileUpload', async () => {
                if (!fileInfoDiv) {
                    console.error('fileInfoDiv is null in handleGeoFileSelect');
                    return;
                }

                if (!file.name.endsWith('.mmdb')) {
                    const errorMsg = window.i18n ? window.i18n.t('setup.goaccess.invalid_file_type') :
                                   'Please select a valid .mmdb file';
                    alert(errorMsg);
                    return;
                }

                const maxSize = 100 * 1024 * 1024;
                if (file.size > maxSize) {
                    const errorMsg = window.i18n ? window.i18n.t('setup.goaccess.file_too_large') :
                                   'File size too large. Maximum allowed size is 100MB';
                    alert(errorMsg);
                    return;
                }

                if (uploadArea) {
                    const formGroup = uploadArea.closest('.form-group');
                    if (formGroup) {
                        formGroup.classList.remove('error');
                        const errorMessage = formGroup.querySelector('.invalid-feedback');
                        if (errorMessage) {
                            errorMessage.style.display = 'none';
                            errorMessage.textContent = '';
                        }
                    }
                }

                const fileUploadContent = document.querySelector('#geo-upload-area .file-upload-content');
                if (fileUploadContent) {
                    fileUploadContent.style.display = 'none';
                }

                if (uploadArea) {
                    uploadArea.style.pointerEvents = 'none';
                    uploadArea.style.opacity = '0.6';
                }

                fileInfoDiv.style.display = 'block';
                fileInfoDiv.querySelector('#geo-file-name').textContent = file.name;
                fileInfoDiv.querySelector('#geo-file-size').textContent = formatFileSize(file.size);

                const existingProgress = fileInfoDiv.querySelector('#geo-upload-progress');
                if (existingProgress) {
                    existingProgress.remove();
                }

                const uploadingText = window.i18n ? window.i18n.t('setup.app.jwt_uploading') : 'Uploading...';
                const progressElement = document.createElement('p');
                progressElement.id = 'geo-upload-progress';
                progressElement.textContent = uploadingText;
                fileInfoDiv.appendChild(progressElement);

                const result = await this.apiClient.uploadGeoFile(
                    file,
                    (percentComplete, loaded, total) => {
                        const progressEl = fileInfoDiv.querySelector('#geo-upload-progress');
                        if (progressEl) {
                            progressEl.textContent = `${uploadingText} ${Math.round(percentComplete)}%`;
                        }
                    },
                    (error) => {
                        console.error('Upload error:', error);
                    }
                );

                if (result.success) {
                    const progressEl = fileInfoDiv.querySelector('#geo-upload-progress');
                    if (progressEl) {
                        const successText = window.i18n ? window.i18n.t('setup.app.jwt_upload_success') : 'Upload successful!';
                        progressEl.textContent = successText;
                        progressEl.style.color = 'var(--success-color)';
                    }

                    this.config.goaccess.has_geo_file = true;
                    this.config.goaccess.geo_file_temp_path = result.data.temp_path;
                    this.config.goaccess.original_file_name = file.name;
                    this.config.goaccess.file_size = file.size;

                    if (uploadArea) {
                        uploadArea.style.pointerEvents = '';
                        uploadArea.style.opacity = '';
                    }

                    return result;
                } else {
                    throw new Error(result.message || 'Upload failed');
                }
            }, (error) => {
                if (error.validationErrors && error.validationErrors.length > 0) {
                    this.showValidationErrors(error.validationErrors);
                } else {
                    this.showAlert('error', error.message);
                }
            });

            if (!result) return;
        } catch (error) {
            console.error('File upload error:', error);
            if (fileInfoDiv) {
                const progressEl = fileInfoDiv.querySelector('#geo-upload-progress');
                if (progressEl) {
                    const failedText = window.i18n ? window.i18n.t('setup.app.jwt_upload_failed') : 'Upload failed';
                    progressEl.textContent = `${failedText}: ${error.message}`;
                    progressEl.style.color = 'var(--error-color)';
                }
            }

            // 恢复上传区域交互性
            if (uploadArea) {
                uploadArea.style.pointerEvents = '';
                uploadArea.style.opacity = '';
            }

            // 重置文件选择状态和界面
            this.config.goaccess.has_geo_file = false;

            // 显示上传区域，隐藏文件信息
            setTimeout(() => {
                this.showGeoUploadArea();
            }, 2000); // 2秒后重置界面，让用户看到错误信息
        }
    }

    showGeoUploadArea() {
        const fileInfoDiv = document.getElementById('geo-file-info');
        const fileUploadContent = document.querySelector('#geo-upload-area .file-upload-content');
        
        if (fileInfoDiv && fileUploadContent) {
            fileInfoDiv.style.display = 'none';
            fileUploadContent.style.display = 'block';
            
            // 清除文件输入框的值
            const fileInput = document.getElementById('goaccess-geo-file');
            if (fileInput) {
                fileInput.value = '';
            }
        }
    }

    validateGoAccessForm(form) {
        return Validator.validateGoAccessForm(
            form,
            this.config,
            (f) => this.clearFormErrors(f),
            (el, msg) => this.showFieldError(el, msg),
            window.i18n
        );
    }

    saveGoAccessConfig() {
        const form = document.getElementById('goaccess-form');
        this.config.goaccess.enabled = form.querySelector('#goaccess-enabled').checked;
        this.saveToLocalCache();
    }
    
    renderAdminStep(container) {
        container.innerHTML = `
            <form id="admin-form" class="form-section" novalidate>
                <h3 data-i18n="setup.admin.title"></h3>
                <p style="margin-bottom: 1.5rem; color: var(--gray-600);" data-i18n="setup.admin.description"></p>
                
                <div class="form-group">
                    <label for="admin-username"><span data-i18n="setup.admin.username_label"></span> <span data-i18n="common.required"></span></label>
                    <input 
                        type="text" 
                        id="admin-username" 
                        name="username"
                        value="${this.config.admin_user.username}" 
                        data-i18n-placeholder="setup.admin.username_placeholder"
                        required
                        minlength="4"
                        maxlength="20"
                        pattern="^[a-zA-Z0-9][a-zA-Z0-9._\\-]+[a-zA-Z0-9]$"
                        data-i18n-title="setup.admin.username_error"
                    >
                    <div class="form-help" data-i18n="setup.admin.username_help"></div>
                    <div class="invalid-feedback" data-i18n="setup.admin.username_error"></div>
                </div>
                
                <div class="form-group">
                    <label for="admin-email"><span data-i18n="setup.admin.email_label"></span> <span data-i18n="common.required"></span></label>
                    <input 
                        type="email" 
                        id="admin-email" 
                        name="email"
                        value="${this.config.admin_user.email}" 
                        placeholder="admin@example.com"
                        required
                        data-i18n-title="setup.admin.email_error"
                    >
                    <div class="form-help" data-i18n="setup.admin.email_help"></div>
                    <div class="invalid-feedback" data-i18n="setup.admin.email_error"></div>
                </div>
                
                <div class="form-group">
                    <label for="admin-password"><span data-i18n="setup.admin.password_label"></span> <span data-i18n="common.required"></span></label>
                    <input
                        type="password"
                        id="admin-password"
                        name="password"
                        data-i18n-placeholder="setup.admin.password_placeholder"
                        required
                        minlength="12"
                        maxlength="64"
                        pattern="^[A-Za-z\\d!@#$%^&*]{12,64}$"
                        data-i18n-title="setup.admin.password_error"
                    >
                    <div class="form-help" data-i18n="setup.admin.password_help"></div>
                    <div class="invalid-feedback" data-i18n="setup.admin.password_error"></div>
                </div>
                
                <div class="form-group">
                    <label for="admin-password-confirm"><span data-i18n="setup.admin.password_confirm_label"></span> <span data-i18n="common.required"></span></label>
                    <input
                        type="password"
                        id="admin-password-confirm"
                        name="passwordConfirm"
                        data-i18n-placeholder="setup.admin.password_confirm_placeholder"
                        required
                        data-i18n-title="setup.admin.password_confirm_error"
                    >
                    <div class="invalid-feedback" data-i18n="setup.admin.password_confirm_error"></div>
                </div>
                
                <div class="btn-group">
                    <button type="button" class="btn btn-secondary" onclick="app.previousStep()" data-i18n="common.previous"></button>
                    <button type="submit" class="btn btn-primary" data-i18n="common.next"></button>
                </div>
            </form>
        `;
        
        // 添加表单提交事件监听
        document.getElementById('admin-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            
            // 检查密码匹配
            const password = document.getElementById('admin-password').value;
            const passwordConfirm = document.getElementById('admin-password-confirm').value;
            const confirmField = document.getElementById('admin-password-confirm');
            const passwordField = document.getElementById('admin-password');
            
            if (password && !this.validatePasswordStrength(password)) {
                const errorMsg = window.i18n ? window.i18n.t('setup.admin.password_error') :
                    'Password must contain lowercase, uppercase, numbers, and special characters (!@#$%^&*)';
                passwordField.setCustomValidity(errorMsg);
            } else {
                passwordField.setCustomValidity('');
            }

            if (password !== passwordConfirm) {
                const errorMsg = window.i18n ? window.i18n.t('setup.admin.password_confirm_error') : 'Passwords must match';
                confirmField.setCustomValidity(errorMsg);
            } else {
                confirmField.setCustomValidity('');
            }
            
            if (e.target.checkValidity()) {
                await app.saveAdminConfig();
            } else {
                app.showFormErrors(e.target);
            }
        });

        const passwordField = document.getElementById('admin-password');
        const confirmField = document.getElementById('admin-password-confirm');

        if (passwordField && this.config.admin_user.password) {
            passwordField.value = this.config.admin_user.password;
        }
        if (confirmField && this.config.admin_user.password) {
            confirmField.value = this.config.admin_user.password;
        }

        passwordField.addEventListener('input', () => {
            validateAndSetFieldError(
                passwordField,
                passwordField.value,
                'admin',
                {
                    i18n: window.i18n,
                    showCustomErrorFn: (f, m) => this.showCustomError(f, m),
                    hideCustomErrorFn: (f) => this.hideCustomError(f)
                }
            );

            if (confirmField.value && passwordField.value !== confirmField.value) {
                const errorMsg = window.i18n ? window.i18n.t('setup.admin.password_confirm_error') : 'Passwords must match';
                confirmField.setCustomValidity(errorMsg);
                this.showCustomError(confirmField, errorMsg);
            } else {
                confirmField.setCustomValidity('');
                this.hideCustomError(confirmField);
            }
        });

        confirmField.addEventListener('input', () => {
            const password = passwordField.value;
            const passwordConfirm = confirmField.value;

            if (passwordConfirm && password !== passwordConfirm) {
                const errorMsg = window.i18n ? window.i18n.t('setup.admin.password_confirm_error') : 'Passwords must match';
                confirmField.setCustomValidity(errorMsg);
                this.showCustomError(confirmField, errorMsg);
            } else {
                confirmField.setCustomValidity('');
                this.hideCustomError(confirmField);
            }
        });

        this.addFieldTouchListeners(container);
    }
    
    renderReviewStep(container) {
        container.innerHTML = `
            <div class="form-section">
                <h3 data-i18n="setup.review.title"></h3>
                <p style="margin-bottom: 1.5rem; color: var(--gray-600);" data-i18n="setup.review.description"></p>
                
                <div id="config-review">
                    <div class="loading">
                        <div class="loading-spinner"></div>
                    </div>
                </div>
                
                <div class="btn-group">
                    <button class="btn btn-secondary" onclick="app.previousStep()" data-i18n="common.previous"></button>
                    <button class="btn btn-success" onclick="app.generateConfig()" data-i18n="setup.review.generate_button"></button>
                </div>
            </div>
        `;
        
        this.loadConfigReview();
    }
    
    renderConfigCompleteStep(container) {
        container.innerHTML = `
            <div class="form-section">
                <h3 style="text-align: center;">
                    <span style="color: var(--success-color); margin-right: 0.5rem;">✓</span>
                    <span data-i18n="setup.config_complete.title"></span>
                </h3>
                <p style="margin-bottom: 2rem; color: var(--gray-600); line-height: 1.6;" data-i18n="setup.config_complete.description"></p>

                <div style="background: var(--info-bg, #e3f2fd); border: 1px solid var(--info-border, #1976d2); border-radius: 4px; padding: 1rem; margin: 2rem 0;">
                    <p style="margin: 0 0 0.5rem 0; color: var(--gray-700); font-weight: 600;" data-i18n-html="setup.config_complete.ready_notice" id="ready-notice"></p>
                    <p style="margin: 0; color: var(--gray-600); line-height: 1.6;" data-i18n-html="setup.config_complete.ready_description" id="ready-description"></p>
                </div>

            </div>
        `;
        
        // 应用翻译，包含动态路径参数
        setTimeout(() => {
            if (window.i18n) {
                const outputPath = this.outputPath || './output';
                const params = { outputPath: outputPath };
                
                // 手动设置包含路径的翻译内容
                const readyNotice = document.getElementById('ready-notice');
                const readyDescription = document.getElementById('ready-description');
                
                if (readyNotice) {
                    const noticeText = window.i18n.t('setup.config_complete.ready_notice', params);
                    readyNotice.innerHTML = noticeText;
                    // 移除 data-i18n-html 属性，防止被 applyTranslations 覆盖
                    readyNotice.removeAttribute('data-i18n-html');
                }
                if (readyDescription) {
                    const descText = window.i18n.t('setup.config_complete.ready_description', params);
                    // 为长代码命令添加特殊样式处理
                    const processedText = descText.replace(/<code>([^<]*cd [^<]*)<\/code>/g, '<code class="complete-step-code">$1</code>');
                    readyDescription.innerHTML = processedText;
                    // 移除 data-i18n-html 属性，防止被 applyTranslations 覆盖
                    readyDescription.removeAttribute('data-i18n-html');
                }
                
            }
        }, 50);
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
                    this.showValidationErrors(error.validationErrors);
                } else {
                    this.showAlert('error', error.message);
                }
            });

            if (!result) return;
        } catch (error) {
        }
    }
    
    async saveDatabaseConfig() {
        const serviceType = document.querySelector('input[name="db-service-type"]:checked').value;

        // 基础配置
        this.config.database = {
            service_type: serviceType,
            host: serviceType === 'docker' ? 'localhost' : document.getElementById('db-host').value,
            port: parseInt(document.getElementById('db-port').value),
            name: document.getElementById('db-name').value,
            app_user: document.getElementById('db-app-user').value,
            app_password: document.getElementById('db-app-password').value
        };

        // 仅Docker模式需要超级用户配置
        if (serviceType === 'docker') {
            this.config.database.super_user = document.getElementById('db-super-user').value;
            this.config.database.super_password = document.getElementById('db-super-password').value;
        } else {
            // 外部服务模式清空超级用户字段
            this.config.database.super_user = '';
            this.config.database.super_password = '';
        }

        // 保存到本地缓存并调用后端验证
        this.saveToLocalCache();
        await this.saveConfigWithValidation();
    }

    updateDatabaseHostField(serviceType) {
        const hostField = document.getElementById('db-host');
        const testConnectionContainer = document.getElementById('db-test-connection-container');
        const superUserConfig = document.getElementById('db-super-user-config');
        const superUserField = document.getElementById('db-super-user');
        const superPasswordField = document.getElementById('db-super-password');
        const appUserField = document.getElementById('db-app-user');
        const appPasswordField = document.getElementById('db-app-password');
        const dbForm = document.getElementById('database-form');

        if (serviceType === 'docker') {
            hostField.value = 'localhost';
            hostField.readOnly = true;
            hostField.style.backgroundColor = 'var(--gray-100)';
            if (testConnectionContainer) {
                testConnectionContainer.style.display = 'none';
            }
            // Docker模式显示超级用户配置并设置为必填
            if (superUserConfig) {
                superUserConfig.style.display = 'block';
            }
            if (superUserField) {
                superUserField.required = true;
                superUserField.disabled = false;
            }
            if (superPasswordField) {
                superPasswordField.required = true;
                superPasswordField.disabled = false;
            }
            // Docker模式使用严格的用户名和密码验证
            if (appUserField) {
                appUserField.minLength = 1;
                appUserField.maxLength = 63;
                appUserField.pattern = '^[a-zA-Z][a-zA-Z0-9_]*$';
            }
            if (appPasswordField) {
                appPasswordField.minLength = 12;
                appPasswordField.maxLength = 64;
                appPasswordField.pattern = '^[A-Za-z\\d!@#$%^&*]{12,64}$';
            }
            // Docker模式显示帮助文本
            this.toggleHelpText('db-app-user', true);
            this.toggleHelpText('db-app-password', true);

            // Docker模式也要清除所有自定义验证错误
            if (appUserField) {
                appUserField.setCustomValidity('');
                this.hideCustomError(appUserField);
            }
            if (appPasswordField) {
                appPasswordField.setCustomValidity('');
                this.hideCustomError(appPasswordField);
            }
            if (superUserField) {
                superUserField.setCustomValidity('');
                this.hideCustomError(superUserField);
            }
            if (superPasswordField) {
                superPasswordField.setCustomValidity('');
                this.hideCustomError(superPasswordField);
            }
        } else {
            hostField.readOnly = false;
            hostField.style.backgroundColor = '';
            if (testConnectionContainer) {
                testConnectionContainer.style.display = 'block';
            }
            // 外部服务模式隐藏超级用户配置并禁用字段
            if (superUserConfig) {
                superUserConfig.style.display = 'none';
            }
            if (superUserField) {
                superUserField.required = false;
                superUserField.disabled = true;  // 禁用字段，表单验证会自动跳过
            }
            if (superPasswordField) {
                superPasswordField.required = false;
                superPasswordField.disabled = true;  // 禁用字段，表单验证会自动跳过
            }
            // 外部服务模式使用宽松的用户名和密码验证
            if (appUserField) {
                appUserField.minLength = 1;
                appUserField.maxLength = 128;
                appUserField.pattern = '';  // 移除用户名pattern限制
                appUserField.removeAttribute('pattern');  // 完全移除pattern属性
            }
            if (appPasswordField) {
                appPasswordField.minLength = 1;
                appPasswordField.maxLength = 128;
                appPasswordField.pattern = '';  // 移除密码pattern限制
                appPasswordField.removeAttribute('pattern');  // 完全移除pattern属性
            }
            // 外部服务模式隐藏帮助文本
            this.toggleHelpText('db-app-user', false);
            this.toggleHelpText('db-app-password', false);

            // 清除所有自定义验证错误
            if (appUserField) {
                appUserField.setCustomValidity('');
                this.hideCustomError(appUserField);
            }
            if (appPasswordField) {
                appPasswordField.setCustomValidity('');
                this.hideCustomError(appPasswordField);
            }
            if (superUserField) {
                superUserField.setCustomValidity('');
                this.hideCustomError(superUserField);
            }
            if (superPasswordField) {
                superPasswordField.setCustomValidity('');
                this.hideCustomError(superPasswordField);
            }
        }

        // 重置表单验证状态，清除所有验证错误
        if (dbForm) {
            // 获取所有表单输入元素并清除验证状态
            const inputs = dbForm.querySelectorAll('input, select, textarea');
            inputs.forEach(input => {
                if (input.style.display !== 'none' && !input.closest('[style*="display: none"]')) {
                    // 仅处理可见的输入元素
                    input.setCustomValidity('');
                }
            });

            // 暂时禁用表单的原生验证
            dbForm.noValidate = true;
            // 异步恢复表单验证
            setTimeout(() => {
                dbForm.noValidate = false;
            }, 10);
        }
    }

    toggleHelpText(fieldId, show) {
        const field = document.getElementById(fieldId);
        if (field) {
            const formGroup = field.closest('.form-group');
            if (formGroup) {
                const helpText = formGroup.querySelector('.form-help');
                if (helpText) {
                    helpText.style.display = show ? 'block' : 'none';
                }
            }
        }
    }

    async saveRedisConfig() {
        const serviceType = document.querySelector('input[name="redis-service-type"]:checked').value;
        this.config.redis = {
            service_type: serviceType,
            host: serviceType === 'docker' ? 'localhost' : document.getElementById('redis-host').value,
            port: parseInt(document.getElementById('redis-port').value),
            user: document.getElementById('redis-user') ? document.getElementById('redis-user').value : '',
            password: document.getElementById('redis-password').value
        };

        // 仅Docker模式需要管理密码配置
        if (serviceType === 'docker') {
            this.config.redis.admin_password = document.getElementById('redis-admin-password').value;
        } else {
            // 外部服务模式清空管理密码字段
            this.config.redis.admin_password = '';
        }

        // 保存到本地缓存并调用后端验证
        this.saveToLocalCache();
        await this.saveConfigWithValidation();
    }

    async saveSMTPConfig() {
        this.config.smtp = {
            server: document.getElementById('smtp-server').value,
            port: parseInt(document.getElementById('smtp-port').value),
            user: document.getElementById('smtp-user').value,
            password: document.getElementById('smtp-password').value,
            sender: document.getElementById('smtp-sender').value
        };

        // 保存到本地缓存并调用后端验证
        this.saveToLocalCache();
        await this.saveConfigWithValidation();
    }

    updateRedisHostField(serviceType) {
        const hostField = document.getElementById('redis-host');
        const testConnectionContainer = document.getElementById('redis-test-connection-container');
        const passwordField = document.getElementById('redis-password');
        const userField = document.getElementById('redis-user');
        const adminConfig = document.getElementById('redis-admin-config');
        const adminPasswordField = document.getElementById('redis-admin-password');
        const redisForm = document.getElementById('redis-form');

        if (serviceType === 'docker') {
            hostField.value = 'localhost';
            hostField.readOnly = true;
            hostField.style.backgroundColor = 'var(--gray-100)';
            if (testConnectionContainer) {
                testConnectionContainer.style.display = 'none';
            }

            // Docker模式：显示管理密码配置并设置为必填
            if (adminConfig) {
                adminConfig.style.display = 'block';
            }
            if (adminPasswordField) {
                adminPasswordField.required = true;
                adminPasswordField.disabled = false;
            }

            // Docker模式：用户名必填但不设置默认值
            if (userField) {
                // 不设置默认值，让用户必须手动输入
                userField.required = true;
                // placeholder已通过i18n设置为app_user

                // 更新标签为必填
                const requiredIndicator = document.getElementById('redis-user-required-indicator');
                if (requiredIndicator) {
                    requiredIndicator.textContent = '*';
                    requiredIndicator.setAttribute('data-i18n', 'common.required');
                }
            }

            // Docker模式使用严格的密码验证
            if (passwordField) {
                passwordField.minLength = 12;
                passwordField.maxLength = 64;
                passwordField.pattern = '^[A-Za-z\\d!@#$%^&*]{12,64}$';
            }
            // Docker模式显示帮助文本
            this.toggleHelpText('redis-password', true);
            this.toggleHelpText('redis-user', true);
            this.toggleHelpText('redis-admin-password', true);

            // Docker模式也要清除所有自定义验证错误
            if (passwordField) {
                passwordField.setCustomValidity('');
                this.hideCustomError(passwordField);
            }
            if (userField) {
                userField.setCustomValidity('');
                this.hideCustomError(userField);
            }
            if (adminPasswordField) {
                adminPasswordField.setCustomValidity('');
                this.hideCustomError(adminPasswordField);
            }
        } else {
            hostField.readOnly = false;
            hostField.style.backgroundColor = '';
            if (testConnectionContainer) {
                testConnectionContainer.style.display = 'block';
            }

            // 外部服务模式：隐藏管理密码配置并禁用字段
            if (adminConfig) {
                adminConfig.style.display = 'none';
            }
            if (adminPasswordField) {
                adminPasswordField.required = false;
                adminPasswordField.disabled = true;  // 禁用字段，表单验证会自动跳过
            }

            // 外部服务模式：用户名可选，兼容旧版Redis
            if (userField) {
                userField.required = false;
                userField.placeholder = '';
            }

            // 外部服务模式使用宽松的密码验证
            if (passwordField) {
                passwordField.minLength = 1;
                passwordField.maxLength = 128;
                passwordField.pattern = '';  // 移除pattern限制
                passwordField.removeAttribute('pattern');  // 完全移除pattern属性
            }
            // 外部服务模式隐藏帮助文本
            this.toggleHelpText('redis-password', false);
            this.toggleHelpText('redis-user', false);
            this.toggleHelpText('redis-admin-password', false);

            // 清除所有自定义验证错误
            if (passwordField) {
                passwordField.setCustomValidity('');
                this.hideCustomError(passwordField);
            }
            if (userField) {
                userField.setCustomValidity('');
                this.hideCustomError(userField);
            }
            if (adminPasswordField) {
                adminPasswordField.setCustomValidity('');
                this.hideCustomError(adminPasswordField);
            }
        }

        // 重置表单验证状态，清除所有验证错误
        if (redisForm) {
            // 暂时禁用表单的原生验证
            redisForm.noValidate = true;
            // 异步恢复表单验证
            setTimeout(() => {
                redisForm.noValidate = false;
            }, 10);
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
    
    updateJWTMethodDisplay() {
        const method = document.querySelector('input[name="jwt_method"]:checked')?.value;
        const autoConfig = document.getElementById('jwt-auto-config');
        const pathConfig = document.getElementById('jwt-path-config');
        const pathInput = document.getElementById('jwt-key-path');

        // 清除路径输入框的错误状态
        if (pathInput) {
            pathInput.setCustomValidity('');
        }

        if (method === 'auto') {
            if (autoConfig) autoConfig.style.display = 'block';
            if (pathConfig) pathConfig.style.display = 'none';
            // 自动生成方式时，路径输入框不是必填
            if (pathInput) {
                pathInput.required = false;
            }
        } else if (method === 'path') {
            if (autoConfig) autoConfig.style.display = 'none';
            if (pathConfig) pathConfig.style.display = 'block';
            // 指定路径方式时，路径输入框是必填
            if (pathInput) {
                pathInput.required = true;
            }
        }
    }

    async saveAppConfig() {
        const corsText = document.getElementById('app-cors').value.trim();
        const corsOrigins = corsText ? corsText.split('\\n').map(url => url.trim()).filter(url => url) : [];
        
        // 处理 JWT key 配置
        const jwtMethod = document.querySelector('input[name="jwt_method"]:checked')?.value || 'auto';
        let jwtKeyFromFile = false;
        let jwtKeyFilePath = '';

        // 验证 JWT 配置
        if (jwtMethod === 'path') {
            jwtKeyFromFile = true;
            jwtKeyFilePath = document.getElementById('jwt-key-path').value.trim();
            if (!jwtKeyFilePath) {
                // 设置输入框验证错误
                const pathInput = document.getElementById('jwt-key-path');
                pathInput.setCustomValidity(window.i18n ? window.i18n.t('setup.app.jwt_path_required') : 'JWT key file path is required');
                pathInput.reportValidity();
                return;
            }
        }

        this.config.app = {
            ...this.config.app,
            domain_name: document.getElementById('app-domain').value,
            static_host_name: document.getElementById('app-static-host').value,
            brand_name: document.getElementById('app-brand').value,
            version: document.getElementById('app-version').value,
            cors_allow_origins: corsOrigins,
            default_lang: document.getElementById('app-lang').value,
            debug: document.getElementById('app-debug').checked,
            jwt_key_from_file: jwtKeyFromFile,
            jwt_key_file_path: jwtKeyFilePath,
            use_setup_domain: document.getElementById('use-setup-domain').checked
        };
        
        // 保存到本地缓存并调用后端验证
        this.saveToLocalCache();
        await this.saveConfigWithValidation();
    }

    // 更新前端源配置的显示状态
    updateFrontendOriginVisibility() {
        const googleEnabled = document.getElementById('google-enabled').checked;
        const githubEnabled = document.getElementById('github-enabled').checked;
        const frontendOriginSection = document.getElementById('frontend-origin-section');

        if (frontendOriginSection) {
            frontendOriginSection.style.display = (googleEnabled || githubEnabled) ? 'block' : 'none';
        }
    }

    async saveOAuthConfig() {
        this.config.oauth = {
            google_enabled: document.getElementById('google-enabled').checked,
            google_client_id: document.getElementById('google-client-id').value.trim(),
            google_client_secret: document.getElementById('google-client-secret').value.trim(),
            github_enabled: document.getElementById('github-enabled').checked,
            github_client_id: document.getElementById('github-client-id').value.trim(),
            github_client_secret: document.getElementById('github-client-secret').value.trim(),
            frontend_origin: document.getElementById('frontend-origin').value.trim()
        };

        // 保存到本地缓存并调用后端验证
        this.saveToLocalCache();
        await this.saveConfigWithValidation();
    }

    async saveAdminConfig() {
        this.config.admin_user = {
            username: document.getElementById('admin-username').value,
            email: document.getElementById('admin-email').value,
            password: document.getElementById('admin-password').value
        };
        
        // 保存到本地缓存并调用后端验证
        this.saveToLocalCache();
        await this.saveConfigWithValidation();
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
        // 更新JWT文件状态显示
        this.updateJWTMethodDisplay();
        
        // 更新GeoIP文件状态显示
        this.updateGeoFileDisplay();
    }
    
    // 更新GeoIP文件显示状态
    updateGeoFileDisplay() {
        const fileInfoDiv = document.getElementById('geo-file-info');
        const fileUploadContent = document.querySelector('#geo-upload-area .file-upload-content');
        
        if (!fileInfoDiv || !fileUploadContent) {
            return; // 如果不在相关页面就跳过
        }
        
        // 检查是否已上传GeoIP文件
        if (this.config.goaccess.has_geo_file && this.config.goaccess.geo_file_temp_path) {
            // 隐藏上传区域，显示文件信息
            fileUploadContent.style.display = 'none';
            fileInfoDiv.style.display = 'block';
            
            // 更新文件信息
            const fileName = this.config.goaccess.original_file_name || this.config.goaccess.geo_file_temp_path.split('/').pop();
            const fileSize = this.config.goaccess.file_size;
            
            const fileNameEl = fileInfoDiv.querySelector('#geo-file-name');
            const fileSizeEl = fileInfoDiv.querySelector('#geo-file-size');
            
            if (fileNameEl) fileNameEl.textContent = fileName;
            if (fileSizeEl) {
                fileSizeEl.textContent = (typeof fileSize === 'number' && fileSize > 0) ?
                    formatFileSize(fileSize) : 'Unknown';
            }
            
            // 移除之前的进度信息
            const existingProgress = fileInfoDiv.querySelector('#geo-upload-progress');
            if (existingProgress) {
                existingProgress.remove();
            }
            
            // 添加上传成功状态（只有在没有进度元素时才添加）
            if (!fileInfoDiv.querySelector('#geo-upload-progress')) {
                const successText = window.i18n ? window.i18n.t('setup.app.jwt_upload_success') : 'Upload successful!';
                const successElement = document.createElement('p');
                successElement.id = 'geo-upload-progress';
                successElement.textContent = successText;
                successElement.style.color = 'var(--success-color)';
                fileInfoDiv.appendChild(successElement);
            }
        } else {
            // 如果没有上传文件，显示上传区域
            fileUploadContent.style.display = 'block';
            fileInfoDiv.style.display = 'none';
        }
    }

    async checkGeoFileStatus() {
        try {
            const response = await this.apiClient.getGeoFileStatus();
            if (response.success && response.data) {
                const { exists, file_name, file_size, temp_path } = response.data;

                // 如果缓存显示有文件但实际不存在，重置缓存状态
                if (this.config.goaccess.has_geo_file && !exists) {
                    console.log('GeoIP file cache inconsistent with actual file status, resetting...');
                    this.config.goaccess.has_geo_file = false;
                    this.config.goaccess.geo_file_temp_path = '';
                    this.config.goaccess.original_file_name = '';
                    this.config.goaccess.file_size = 0;

                    // 保存更新后的配置到本地缓存
                    this.saveToLocalCache();

                    // 更新UI显示
                    this.updateGeoFileDisplay();
                }
                // 如果实际有文件但缓存没有记录，更新缓存状态
                else if (!this.config.goaccess.has_geo_file && exists) {
                    console.log('Found GeoIP file but cache shows no file, updating cache...');
                    this.config.goaccess.has_geo_file = true;
                    this.config.goaccess.geo_file_temp_path = temp_path;
                    this.config.goaccess.original_file_name = file_name;
                    this.config.goaccess.file_size = file_size;

                    // 保存更新后的配置到本地缓存
                    this.saveToLocalCache();

                    // 更新UI显示
                    this.updateGeoFileDisplay();
                }
            }
        } catch (error) {
            console.warn('Failed to check GeoIP file status:', error);
            // 如果检查失败，不做任何操作，保持当前状态
        }
    }


    async saveConfigWithValidation() {
        try {
            await ConfigManager.saveConfigWithValidation(
                this.config,
                this.steps[this.currentStep].key,
                this.apiClient,
                {
                    onSuccess: () => this.nextStep(),
                    onValidationError: (errors) => this.showValidationErrors(errors),
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
                    onValidationError: (errors) => this.showValidationErrors(errors),
                    onError: (error) => this.showAlert('error', error.message)
                }
            );

            if (!result) return;
        } catch (error) {
            this.showAlert('error', window.i18n ? window.i18n.t('messages.errors.failed_generate', {error: error.message}) : 'Failed to save configuration: ' + error.message);
            throw error;
        }
    }
    
    async loadConfigReview() {
        try {
            // 从本地缓存读取配置显示
            const config = this.config;

            // 使用i18n渲染配置审查
            const corsText = window.i18n ? window.i18n.t('setup.review.cors_configured', { count: config.app.cors_allow_origins.length }) : 
                            `${config.app.cors_allow_origins.length} configured`;
            
            // 构建数据库配置显示
            const serviceTypeText = window.i18n ? window.i18n.t(`setup.database.service_type_${config.database.service_type}`) : config.database.service_type;
            let databaseSection = `
                <h4 data-i18n="setup.review.sections.database"></h4>
                <p><strong data-i18n="setup.review.fields.service_type"></strong>: ${serviceTypeText}</p>
                <p><strong data-i18n="setup.review.fields.host"></strong>: ${config.database.host}:${config.database.port}</p>
                <p><strong data-i18n="setup.review.fields.database"></strong>: ${config.database.name}</p>
                <p><strong data-i18n="setup.review.fields.app_user"></strong>: ${config.database.app_user}</p>`;

            // Docker模式显示超级用户信息
            if (config.database.service_type === 'docker' && config.database.super_user) {
                databaseSection += `
                <p><strong data-i18n="setup.review.fields.super_user"></strong>: ${config.database.super_user}</p>`;
            }

            document.getElementById('config-review').innerHTML = `
                <div style="text-align: left;">
                    ${databaseSection}

                    <h4 style="margin-top: 1.5rem;" data-i18n="setup.review.sections.redis"></h4>
                    <p><strong data-i18n="setup.review.fields.service_type"></strong>: ${window.i18n ? window.i18n.t(`setup.redis.service_type_${config.redis.service_type}`) : config.redis.service_type}</p>
                    <p><strong data-i18n="setup.review.fields.host"></strong>: ${config.redis.host}:${config.redis.port}</p>
                    ${config.redis.user ? `<p><strong data-i18n="setup.review.fields.user"></strong>: ${config.redis.user}</p>` : ''}

                    <h4 style="margin-top: 1.5rem;" data-i18n="setup.review.sections.smtp"></h4>
                    <p><strong data-i18n="setup.review.fields.smtp_server"></strong>: ${config.smtp.server}:${config.smtp.port}</p>
                    <p><strong data-i18n="setup.review.fields.smtp_user"></strong>: ${config.smtp.user}</p>
                    <p><strong data-i18n="setup.review.fields.smtp_sender"></strong>: ${config.smtp.sender}</p>

                    <h4 style="margin-top: 1.5rem;" data-i18n="setup.review.sections.application"></h4>
                    <p><strong data-i18n="setup.review.fields.domain"></strong>: ${config.app.domain_name}</p>
                    <p><strong data-i18n="setup.review.fields.static_host"></strong>: ${config.app.static_host_name}</p>
                    <p><strong data-i18n="setup.review.fields.brand"></strong>: ${config.app.brand_name}</p>
                    <p><strong data-i18n="setup.review.fields.version"></strong>: ${config.app.version || 'latest'}</p>
                    <p><strong data-i18n="setup.review.fields.language"></strong>: ${config.app.default_lang}</p>
                    <p><strong data-i18n="setup.review.fields.cors_origins"></strong>: ${corsText}</p>
                    <p><strong data-i18n="setup.review.fields.jwt_mode"></strong>: ${config.app.jwt_key_from_file ? (window.i18n ? window.i18n.t('setup.review.jwt_from_file') : 'From File') : (window.i18n ? window.i18n.t('setup.review.jwt_auto_generate') : 'Auto Generate')}</p>
                    ${config.app.jwt_key_from_file ? `
                        <p><strong data-i18n="setup.review.fields.jwt_file_path"></strong>: ${config.app.jwt_key_file_path}</p>
                    ` : ''}

                    <h4 style="margin-top: 1.5rem;" data-i18n="setup.review.sections.ssl"></h4>
                    <p><strong data-i18n="setup.review.fields.ssl_enabled"></strong>: ${config.ssl.enabled ? (window.i18n ? window.i18n.t('common.yes') : 'Yes') : (window.i18n ? window.i18n.t('common.no') : 'No')}</p>
                    ${config.ssl.enabled ? `
                        <p><strong data-i18n="setup.review.fields.ssl_cert_path"></strong>: ${config.ssl.cert_path}</p>
                        <p><strong data-i18n="setup.review.fields.ssl_key_path"></strong>: ${config.ssl.key_path}</p>
                        <p><strong data-i18n="setup.review.fields.ssl_use_setup_cert"></strong>: ${config.ssl.use_setup_cert ? (window.i18n ? window.i18n.t('common.yes') : 'Yes') : (window.i18n ? window.i18n.t('common.no') : 'No')}</p>
                    ` : ''}

                    <h4 style="margin-top: 1.5rem;" data-i18n="setup.review.sections.administrator"></h4>
                    <p><strong data-i18n="setup.review.fields.username"></strong>: ${config.admin_user.username}</p>
                    <p><strong data-i18n="setup.review.fields.email"></strong>: ${config.admin_user.email}</p>

                    <h4 style="margin-top: 1.5rem;" data-i18n="setup.review.sections.oauth"></h4>
                    <p><strong data-i18n="setup.review.fields.google_oauth"></strong>: ${config.oauth.google_enabled ? (window.i18n ? window.i18n.t('setup.review.fields.oauth_enabled') : 'Enabled') : (window.i18n ? window.i18n.t('setup.review.fields.oauth_disabled') : 'Disabled')}</p>
                    <p><strong data-i18n="setup.review.fields.github_oauth"></strong>: ${config.oauth.github_enabled ? (window.i18n ? window.i18n.t('setup.review.fields.oauth_enabled') : 'Enabled') : (window.i18n ? window.i18n.t('setup.review.fields.oauth_disabled') : 'Disabled')}</p>

                    <h4 style="margin-top: 1.5rem;" data-i18n="setup.review.sections.goaccess"></h4>
                    <p><strong data-i18n="setup.review.fields.goaccess_enabled"></strong>: ${config.goaccess.enabled ? (window.i18n ? window.i18n.t('common.yes') : 'Yes') : (window.i18n ? window.i18n.t('common.no') : 'No')}</p>
                    ${config.goaccess.enabled && config.goaccess.has_geo_file ? `
                        <p><strong data-i18n="setup.review.fields.goaccess_geo_file"></strong>: ${config.goaccess.original_file_name || 'GeoLite2-City.mmdb'}</p>
                    ` : ''}
                </div>
            `;
            
        } catch (error) {
            document.getElementById('config-review').innerHTML = `
                <div class="alert alert-error">${window.i18n ? window.i18n.t('messages.failed_get_config') : 'Failed to load configuration'}: ${error.message}</div>
            `;
        }

        // 应用翻译到动态生成的内容
        if (window.i18n) {
            window.i18n.applyTranslations();
        }
    }
    
    async testDatabaseConnection() {
        await this.apiClient.protectedApiCall('testDatabase', () => this.testConnection('database'), (error) => {
            if (error.validationErrors && error.validationErrors.length > 0) {
                this.showValidationErrors(error.validationErrors);
            } else {
                this.showAlert('error', error.message);
            }
        });
    }

    async testRedisConnection() {
        await this.apiClient.protectedApiCall('testRedis', () => this.testConnection('redis'), (error) => {
            if (error.validationErrors && error.validationErrors.length > 0) {
                this.showValidationErrors(error.validationErrors);
            } else {
                this.showAlert('error', error.message);
            }
        });
    }

    async testSMTPConnection() {
        await this.apiClient.protectedApiCall('testSMTP', () => this.testConnection('smtp'), (error) => {
            if (error.validationErrors && error.validationErrors.length > 0) {
                this.showValidationErrors(error.validationErrors);
            } else {
                this.showAlert('error', error.message);
            }
        });
    }
    
    async testConnection(type) {
        const testConfig = { ...this.config };
        
        // Show loading state
        const testBtn = document.getElementById(`${type === 'database' ? 'db' : type === 'smtp' ? 'smtp' : 'redis'}-test-btn`);
        const originalText = testBtn.textContent;
        testBtn.disabled = true;
        testBtn.textContent = window.i18n ? window.i18n.t('common.testing') : 'Testing...';
        
        if (type === 'database') {
            const serviceType = document.querySelector('input[name="db-service-type"]:checked').value;
            testConfig.database = {
                service_type: serviceType,
                host: document.getElementById('db-host').value,
                port: parseInt(document.getElementById('db-port').value),
                name: document.getElementById('db-name').value,
                app_user: document.getElementById('db-app-user').value,
                app_password: document.getElementById('db-app-password').value
            };

            // 仅Docker模式包含超级用户配置
            if (serviceType === 'docker') {
                testConfig.database.super_user = document.getElementById('db-super-user').value;
                testConfig.database.super_password = document.getElementById('db-super-password').value;
            } else {
                testConfig.database.super_user = '';
                testConfig.database.super_password = '';
            }
        } else if (type === 'redis') {
            testConfig.redis = {
                service_type: document.querySelector('input[name="redis-service-type"]:checked').value,
                host: document.getElementById('redis-host').value,
                port: parseInt(document.getElementById('redis-port').value),
                user: document.getElementById('redis-user') ? document.getElementById('redis-user').value : '',
                password: document.getElementById('redis-password').value
            };
        } else if (type === 'smtp') {
            testConfig.smtp = {
                server: document.getElementById('smtp-server').value,
                port: parseInt(document.getElementById('smtp-port').value),
                user: document.getElementById('smtp-user').value,
                password: document.getElementById('smtp-password').value,
                sender: document.getElementById('smtp-sender').value
            };
        }
        
        try {
            const result = await this.apiClient.testConnections(type, testConfig);
            this.displayConnectionResults(result.data, type);
        } catch (error) {
            this.showAlert('error', window.i18n ? window.i18n.t('messages.errors.failed_test_connections', {error: error.message}) : 'Connection test failed: ' + error.message);
        } finally {
            testBtn.disabled = false;
            testBtn.textContent = originalText;
        }
    }

    async testAllConnections() {
        try {
            const result = await this.apiClient.testConnections('all', this.config);
            this.displayConnectionResults(result.data);
        } catch (error) {
            this.showAlert('error', 'Connection tests failed: ' + error.message);
        }
    }
    
    displayConnectionResults(results, serviceType = null) {
        // If serviceType is specified, show results in the specific service container
        if (serviceType) {
            const containerId = `${serviceType === 'database' ? 'db' : serviceType === 'smtp' ? 'smtp' : 'redis'}-connection-results`;
            const container = document.getElementById(containerId);
            if (container) {
                const serviceResults = results.filter(r => r.service === serviceType);
                container.innerHTML = serviceResults.length > 0 ? `
                    <div class="connection-results">
                        ${serviceResults.map(result => `
                            <div class="connection-result ${result.success ? 'success' : 'error'}">
                                <div class="connection-result-icon">
                                    ${result.success ? '✓' : '✗'}
                                </div>
                                <div class="connection-result-text">
                                    <strong>${result.service.toUpperCase()}</strong>: ${result.message}
                                </div>
                            </div>
                        `).join('')}
                    </div>
                ` : '';
                return;
            }
        }
        
        // Default behavior - show all results in main container
        const container = document.getElementById('connection-results');
        if (container) {
            container.innerHTML = `
                <div class="connection-results">
                    <h4 style="margin-bottom: 1rem;">Connection Test Results</h4>
                    ${results.map(result => `
                        <div class="connection-result ${result.success ? 'success' : 'error'}">
                            <div class="connection-result-icon">
                                ${result.success ? '✓' : '✗'}
                            </div>
                            <div class="connection-result-text">
                                <strong>${result.service.toUpperCase()}</strong>: ${result.message}
                            </div>
                        </div>
                    `).join('')}
                </div>
            `;
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
                    this.showValidationErrors(error.validationErrors);
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
                    this.handleBackendValidationErrors(errorData);
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
    
    showFormErrors(form) {
        Validator.showFormErrors(form);
    }
    
    clearFormErrors(form) {
        Validator.clearFormErrors(form);
    }

    addFieldTouchListeners(container) {
        Validator.addFieldTouchListeners(container);
    }
    
    showFieldError(element, message) {
        Validator.showFieldError(element, message);
    }
    
    handleBackendValidationErrors(error) {
        Validator.handleBackendValidationErrors(error, (type, message) => this.showAlert(type, message));
    }
    
    validatePasswordStrength(password) {
        return Validator.validatePasswordStrength(password);
    }

    validateDatabasePasswordStrength(password) {
        return Validator.validateDatabasePasswordStrength(password);
    }

    validateExternalServicePassword(password) {
        return Validator.validateExternalServicePassword(password);
    }

    showCustomError(field, message) {
        Validator.showCustomError(field, message);
    }

    hideCustomError(field) {
        Validator.hideCustomError(field);
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
                    this.showValidationErrors(error.validationErrors);
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
    showValidationErrors(errors) {
        Validator.showValidationErrors(errors, window.i18n);
    }

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
