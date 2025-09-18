// BakLab Setup - Frontend Application - v1.2 (Double Escaped Patterns)
class SetupApp {
    constructor() {
        this.currentStep = 0;
        this.token = null;
        this.shouldAutoScroll = true;

        // 统一的请求锁机制
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
                brand_name: 'BakLab',
                admin_email: '',
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
                cloudflare_secret: ''
            },
            oauth: {
                google_enabled: false,
                google_client_id: '',
                google_client_secret: '',
                github_enabled: false,
                github_client_id: '',
                github_client_secret: ''
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
            
            // 检查是否有已存在的配置文件
            
            // 检查URL中的token
            const urlParams = new URLSearchParams(window.location.search);
            const urlToken = urlParams.get('token');
            if (urlToken) {
                this.token = urlToken;
                this.currentStep = 0; // 从欢迎页开始
            }
            
            this.render();
        } catch (error) {
            console.error('Initialization error:', error);
            this.render();
        }
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
        
        // Add language header for request-level localization
        if (window.i18n && window.i18n.getCurrentLanguage) {
            options.headers['X-Language'] = window.i18n.getCurrentLanguage();
        }
        
        if (data) {
            options.body = JSON.stringify(data);
        }
        
        const response = await fetch(url, options);
        const result = await response.json();
        
        if (!response.ok) {
            // 如果有验证错误，创建包含详细错误信息的错误对象
            if (result.errors && result.errors.length > 0) {
                const error = new Error(result.message || 'Validation failed');
                error.validationErrors = result.errors;
                throw error;
            }
            throw new Error(result.message || 'Request failed');
        }
        
        return result;
    }

    // 通用的请求锁管理
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

    // 带锁保护的API调用包装器
    async protectedApiCall(lockName, apiCall, ...args) {
        if (!this.acquireLock(lockName)) {
            return null; // 请求被阻止
        }

        try {
            const result = await apiCall.apply(this, args);
            return result;
        } catch (error) {
            // 如果是验证错误，显示详细的错误信息
            if (error.validationErrors && error.validationErrors.length > 0) {
                this.showValidationErrors(error.validationErrors);
            } else {
                this.showAlert('error', error.message);
            }
            throw error; // 继续抛出错误供调用者处理
        } finally {
            this.releaseLock(lockName);
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
                <p style="margin-bottom: 2rem; color: var(--gray-600); line-height: 1.6;" data-i18n="setup.init.welcome_description"></p>
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
                                value="${this.config.database.super_password || ''}"
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
                                value="${this.config.database.app_password || ''}"
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

            // 验证密码强度 - 两种模式都需要
            const appPassword = document.getElementById('db-app-password').value;
            if (appPassword) {
                // 根据服务类型验证密码强度
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
                    this.showCustomError(appPasswordField, errorMsg);
                } else {
                    // 只有当密码确实有效时才清除错误，但保持更友好的清除策略
                    appPasswordField.setCustomValidity('');
                    this.hideCustomError(appPasswordField);
                }
            } else if (appPassword === '') {
                // 只有当密码为完全空白时才清除错误（用户删除了所有内容）
                appPasswordField.setCustomValidity('');
                this.hideCustomError(appPasswordField);
            }
            // 如果密码有内容但不为空字符串，保持当前验证状态不变
        };

        // 为相关字段添加实时验证监听器
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
                            value="${this.config.redis.admin_password || ''}"
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
                        value="${this.config.redis.password}"
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

        // 确保DOM渲染完成后再次设置验证规则
        setTimeout(() => {
            this.updateRedisHostField(this.config.redis.service_type);
        }, 100);
        
        // 添加表单提交事件监听
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
                    // Docker模式使用严格验证
                    isValid = this.validateDatabasePasswordStrength(password);
                    errorMessage = 'Password must be 12-64 characters with at least 3 types: lowercase, uppercase, numbers, special characters (!@#$%^&*)';
                } else {
                    // 外部服务使用宽松验证
                    isValid = this.validateExternalServicePassword(password);
                    errorMessage = 'Password must be 1-128 characters and cannot contain control characters';
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
                        const errorMessage = 'CLI password must be 12-64 characters with at least 3 types: lowercase, uppercase, numbers, special characters (!@#$%^&*)';
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
                        value="${this.config.smtp.password}"
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
                
                <div class="form-row">
                    <div class="form-group">
                        <label for="app-domain"><span data-i18n="setup.app.domain_label"></span> <span data-i18n="common.required"></span></label>
                        <input 
                            type="text" 
                            id="app-domain" 
                            name="domain"
                            value="${this.config.app.domain_name}" 
                            data-i18n-placeholder="setup.app.domain_placeholder"
                            required
                            pattern="^([a-zA-Z0-9]([a-zA-Z0-9\\-]*[a-zA-Z0-9])?\\.)+[a-zA-Z]{2,}$|^localhost$"
                            data-i18n-title="setup.app.domain_error"
                        >
                        <div class="form-help" data-i18n="setup.app.domain_help"></div>
                        <div class="invalid-feedback" data-i18n="setup.app.domain_error"></div>
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
                </div>
                
                <div class="form-group">
                    <label for="app-email"><span data-i18n="setup.app.email_label"></span> <span data-i18n="common.required"></span></label>
                    <input 
                        type="email" 
                        id="app-email" 
                        name="email"
                        value="${this.config.app.admin_email}" 
                        data-i18n-placeholder="setup.app.email_placeholder"
                        required
                        data-i18n-title="setup.app.email_error"
                    >
                    <div class="form-help" data-i18n="setup.app.email_help"></div>
                    <div class="invalid-feedback" data-i18n="setup.app.email_error"></div>
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
                                    value="${this.config.oauth.google_client_secret}"
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
                                    value="${this.config.oauth.github_client_secret}"
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
        });

        // 表单提交处理
        document.getElementById('oauth-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            if (e.target.checkValidity()) {
                await app.saveOAuthConfig();
            } else {
                app.showFormErrors(e.target);
            }
        });
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
            } else {
                configDiv.style.display = 'none';
                certPath.required = false;
                keyPath.required = false;
                // 清除验证错误
                this.clearFormErrors(document.getElementById('ssl-form'));
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
            if (this.requestLocks.geoFileUpload) {
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
                if (this.requestLocks.geoFileUpload) {
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
                if (this.requestLocks.geoFileUpload) {
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
    }

    async handleGeoFileSelect(file, fileInfoDivParam) {
        // 声明所有需要的DOM元素引用
        const fileInfoDiv = fileInfoDivParam || document.getElementById('geo-file-info');
        const uploadArea = document.getElementById('geo-upload-area');

        try {
            const result = await this.protectedApiCall('geoFileUpload', async () => {
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

                const maxSize = 100 * 1024 * 1024; // 100MB
                if (file.size > maxSize) {
                    const errorMsg = window.i18n ? window.i18n.t('setup.goaccess.file_too_large') :
                                   'File size too large. Maximum allowed size is 100MB';
                    alert(errorMsg);
                    return;
                }

                // 清除文件上传错误状态
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

                // 隐藏上传区域，显示文件信息
                const fileUploadContent = document.querySelector('#geo-upload-area .file-upload-content');
                if (fileUploadContent) {
                    fileUploadContent.style.display = 'none';
                }

                // 在上传过程中禁用拖拽区域
                if (uploadArea) {
                    uploadArea.style.pointerEvents = 'none';
                    uploadArea.style.opacity = '0.6';
                }

                fileInfoDiv.style.display = 'block';
                fileInfoDiv.querySelector('#geo-file-name').textContent = file.name;
                fileInfoDiv.querySelector('#geo-file-size').textContent = this.formatFileSize(file.size);

                // 移除之前的进度信息（如果存在）
                const existingProgress = fileInfoDiv.querySelector('#geo-upload-progress');
                if (existingProgress) {
                    existingProgress.remove();
                }

                // 添加上传进度信息
                const uploadingText = window.i18n ? window.i18n.t('setup.app.jwt_uploading') : 'Uploading...';
                const progressElement = document.createElement('p');
                progressElement.id = 'geo-upload-progress';
                progressElement.textContent = uploadingText;
                fileInfoDiv.appendChild(progressElement);

                // 上传文件到服务器
                const formData = new FormData();
                formData.append('geo_file', file);

                const response = await fetch('/api/upload/geo-file', {
                    method: 'POST',
                    headers: {
                        'Setup-Token': this.token
                    },
                    body: formData
                });

                const result = await response.json();

                if (result.success) {
                    // 更新UI显示上传成功
                    const progressEl = fileInfoDiv.querySelector('#geo-upload-progress');
                    if (progressEl) {
                        const successText = window.i18n ? window.i18n.t('setup.app.jwt_upload_success') : 'Upload successful!';
                        progressEl.textContent = successText;
                        progressEl.style.color = 'var(--success-color)';
                    }

                    // 保存文件信息到配置中
                    this.config.goaccess.has_geo_file = true;
                    this.config.goaccess.geo_file_temp_path = result.data.temp_path;
                    this.config.goaccess.original_file_name = file.name;
                    this.config.goaccess.file_size = file.size;

                    // 恢复上传区域交互性
                    if (uploadArea) {
                        uploadArea.style.pointerEvents = '';
                        uploadArea.style.opacity = '';
                    }

                    return result;
                } else {
                    throw new Error(result.message || 'Upload failed');
                }
            });

            if (!result) return; // 被锁保护，忽略重复调用
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
    

    formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
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
        let valid = true;
        this.clearFormErrors(form);
        
        const goAccessEnabled = form.querySelector('#goaccess-enabled').checked;
        
        if (goAccessEnabled) {
            // 检查是否需要上传GeoIP文件或文件已丢失
            if (!this.config.goaccess.has_geo_file || 
                (this.config.goaccess.has_geo_file && !this.config.goaccess.geo_file_temp_path)) {
                valid = false;
                const uploadArea = form.querySelector('#geo-upload-area');
                let errorMessage;
                
                if (!this.config.goaccess.has_geo_file) {
                    errorMessage = window.i18n ? window.i18n.t('setup.goaccess.geo_file_required') : 
                                   'GeoIP database file is required when GoAccess is enabled';
                } else {
                    errorMessage = 'GeoIP database file is no longer available. Please re-upload your GeoIP database file.';
                }
                
                this.showFieldError(uploadArea, errorMessage);
            }
        }

        return valid;
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
                        value="${this.config.admin_user.email || this.config.app.admin_email}" 
                        placeholder="${this.config.app.admin_email || 'admin@example.com'}"
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
                        value="${this.config.admin_user.password}" 
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
                        value="${this.config.admin_user.password}" 
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
            
            // 密码格式和强度验证（与主项目规则一致）
            if (password && !this.validatePasswordStrength(password)) {
                passwordField.setCustomValidity('Password must contain lowercase, uppercase, numbers, and special characters (!@#$%^&*)');
            } else {
                passwordField.setCustomValidity('');
            }
            
            if (password !== passwordConfirm) {
                confirmField.setCustomValidity('Passwords must match');
            } else {
                confirmField.setCustomValidity('');
            }
            
            if (e.target.checkValidity()) {
                await app.saveAdminConfig();
            } else {
                app.showFormErrors(e.target);
            }
        });
        
        // 实时密码确认匹配检查
        document.getElementById('admin-password-confirm').addEventListener('input', (e) => {
            const password = document.getElementById('admin-password').value;
            const passwordConfirm = e.target.value;
            
            if (passwordConfirm && password !== passwordConfirm) {
                e.target.setCustomValidity('Passwords must match');
            } else {
                e.target.setCustomValidity('');
            }
        });
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
            const result = await this.protectedApiCall('initialize', async () => {
                const apiResult = await this.api('POST', '/api/initialize');
                this.token = apiResult.data.token;
                this.nextStep();
                return apiResult;
            });

            if (!result) return; // 被锁保护，忽略重复调用
        } catch (error) {
            // 错误已在 protectedApiCall 中显示
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
            brand_name: document.getElementById('app-brand').value,
            admin_email: document.getElementById('app-email').value,
            version: document.getElementById('app-version').value,
            cors_allow_origins: corsOrigins,
            default_lang: document.getElementById('app-lang').value,
            debug: document.getElementById('app-debug').checked,
            jwt_key_from_file: jwtKeyFromFile,
            jwt_key_file_path: jwtKeyFilePath
        };
        
        // 保存到本地缓存并调用后端验证
        this.saveToLocalCache();
        await this.saveConfigWithValidation();
    }

    async saveOAuthConfig() {
        this.config.oauth = {
            google_enabled: document.getElementById('google-enabled').checked,
            google_client_id: document.getElementById('google-client-id').value.trim(),
            google_client_secret: document.getElementById('google-client-secret').value.trim(),
            github_enabled: document.getElementById('github-enabled').checked,
            github_client_id: document.getElementById('github-client-id').value.trim(),
            github_client_secret: document.getElementById('github-client-secret').value.trim()
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

    // 保存配置到本地缓存
    saveToLocalCache() {
        try {
            localStorage.setItem('baklab_setup_config', JSON.stringify(this.config));
        } catch (error) {
            console.warn('Failed to save to localStorage:', error);
        }
    }
    
    // 从本地缓存加载配置
    loadFromLocalCache() {
        try {
            const cached = localStorage.getItem('baklab_setup_config');
            if (cached) {
                this.config = { ...this.config, ...JSON.parse(cached) };
            }
        } catch (error) {
            console.warn('Failed to load from localStorage:', error);
        }
    }
    
    // 清除本地缓存
    clearLocalCache() {
        try {
            localStorage.removeItem('baklab_setup_config');
        } catch (error) {
            console.warn('Failed to clear localStorage:', error);
        }
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
                    this.formatFileSize(fileSize) : 'Unknown';
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
    
    
    // 通用的配置保存和验证方法
    async saveConfigWithValidation() {
        try {
            const result = await this.protectedApiCall('saveConfig', async () => {
                // 传递当前步骤信息以支持递增验证
                const configWithStep = {
                    ...this.config,
                    current_step: this.steps[this.currentStep].key
                };

                const response = await this.api('POST', '/api/config', configWithStep);

                if (response.success) {
                    // 保存成功，继续下一步
                    this.nextStep();
                }

                return response;
            });
        } catch (error) {
            // 错误已在 protectedApiCall 中处理
            console.error('Configuration validation failed:', error);
        }
    }

    // 提交最终配置到后端（保留用于review步骤的向后兼容）
    async saveConfig() {
        try {
            const result = await this.protectedApiCall('saveConfig', async () => {
                // 传递当前步骤信息以支持递增验证
                const configWithStep = {
                    ...this.config,
                    current_step: this.steps[this.currentStep].key
                };
                return await this.api('POST', '/api/config', configWithStep);
            });

            if (!result) return; // 被锁保护，忽略重复调用
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

                    <h4 style="margin-top: 1.5rem;" data-i18n="setup.review.sections.ssl"></h4>
                    <p><strong data-i18n="setup.review.fields.ssl_enabled"></strong>: ${config.ssl.enabled ? (window.i18n ? window.i18n.t('common.yes') : 'Yes') : (window.i18n ? window.i18n.t('common.no') : 'No')}</p>
                    ${config.ssl.enabled ? `
                        <p><strong data-i18n="setup.review.fields.ssl_cert_path"></strong>: ${config.ssl.cert_path}</p>
                        <p><strong data-i18n="setup.review.fields.ssl_key_path"></strong>: ${config.ssl.key_path}</p>
                        <p><strong data-i18n="setup.review.fields.ssl_use_setup_cert"></strong>: ${config.ssl.use_setup_cert ? (window.i18n ? window.i18n.t('common.yes') : 'Yes') : (window.i18n ? window.i18n.t('common.no') : 'No')}</p>
                    ` : ''}

                    <h4 style="margin-top: 1.5rem;" data-i18n="setup.review.sections.goaccess"></h4>
                    <p><strong data-i18n="setup.review.fields.goaccess_enabled"></strong>: ${config.goaccess.enabled ? (window.i18n ? window.i18n.t('common.yes') : 'Yes') : (window.i18n ? window.i18n.t('common.no') : 'No')}</p>
                    ${config.goaccess.enabled && config.goaccess.has_geo_file ? `
                        <p><strong data-i18n="setup.review.fields.goaccess_geo_file"></strong>: ${config.goaccess.original_file_name || 'GeoLite2-City.mmdb'}</p>
                    ` : ''}

                    <h4 style="margin-top: 1.5rem;" data-i18n="setup.review.sections.application"></h4>
                    <p><strong data-i18n="setup.review.fields.domain"></strong>: ${config.app.domain_name}</p>
                    <p><strong data-i18n="setup.review.fields.brand"></strong>: ${config.app.brand_name}</p>
                    <p><strong data-i18n="setup.review.fields.version"></strong>: ${config.app.version || 'latest'}</p>
                    <p><strong data-i18n="setup.review.fields.language"></strong>: ${config.app.default_lang}</p>
                    <p><strong data-i18n="setup.review.fields.cors_origins"></strong>: ${corsText}</p>
                    <p><strong data-i18n="setup.review.fields.jwt_mode"></strong>: ${config.app.jwt_key_from_file ? (window.i18n ? window.i18n.t('setup.review.jwt_from_file') : 'From File') : (window.i18n ? window.i18n.t('setup.review.jwt_auto_generate') : 'Auto Generate')}</p>
                    ${config.app.jwt_key_from_file ? `
                        <p><strong data-i18n="setup.review.fields.jwt_file_path"></strong>: ${config.app.jwt_key_file_path}</p>
                    ` : ''}

                    <h4 style="margin-top: 1.5rem;" data-i18n="setup.review.sections.oauth"></h4>
                    <p><strong data-i18n="setup.review.fields.google_oauth"></strong>: ${config.oauth.google_enabled ? (window.i18n ? window.i18n.t('setup.review.fields.oauth_enabled') : 'Enabled') : (window.i18n ? window.i18n.t('setup.review.fields.oauth_disabled') : 'Disabled')}</p>
                    <p><strong data-i18n="setup.review.fields.github_oauth"></strong>: ${config.oauth.github_enabled ? (window.i18n ? window.i18n.t('setup.review.fields.oauth_enabled') : 'Enabled') : (window.i18n ? window.i18n.t('setup.review.fields.oauth_disabled') : 'Disabled')}</p>

                    <h4 style="margin-top: 1.5rem;" data-i18n="setup.review.sections.administrator"></h4>
                    <p><strong data-i18n="setup.review.fields.username"></strong>: ${config.admin_user.username}</p>
                    <p><strong data-i18n="setup.review.fields.email"></strong>: ${config.admin_user.email}</p>
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
        await this.protectedApiCall('testDatabase', () => this.testConnection('database'));
    }

    async testRedisConnection() {
        await this.protectedApiCall('testRedis', () => this.testConnection('redis'));
    }

    async testSMTPConnection() {
        await this.protectedApiCall('testSMTP', () => this.testConnection('smtp'));
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
            const result = await this.api('POST', '/api/test-connections', testConfig);
            this.displayConnectionResults(result.data, type);
        } catch (error) {
            this.showAlert('error', window.i18n ? window.i18n.t('messages.errors.failed_test_connections', {error: error.message}) : 'Connection test failed: ' + error.message);
        } finally {
            // Reset button state
            testBtn.disabled = false;
            testBtn.textContent = originalText;
        }
    }
    
    async testAllConnections() {
        try {
            const result = await this.api('POST', '/api/test-connections', this.config);
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
        try {
            await this.protectedApiCall('generateConfig', async () => {
                // 首先提交完整配置到后端进行验证
                await this.saveConfig();

                // 配置验证通过后，生成配置文件
                const response = await this.api('POST', '/api/generate');

                // 保存输出路径信息
                if (response.data && response.data.output_path) {
                    this.outputPath = response.data.output_path;
                }

                // 清除本地缓存（配置已成功保存到后端）
                this.clearLocalCache();

                // 重置上传文件状态（因为临时文件在配置生成后被删除）
                this.resetUploadStates();

                this.nextStep();
                return response;
            });
        } catch (error) {
            // 处理后端验证错误
            if (error.message && error.message.includes('validation')) {
                // 尝试解析并显示具体的验证错误
                try {
                    const errorData = JSON.parse(error.message.split('validation failed: ')[1]);
                    this.handleBackendValidationErrors(errorData);
                } catch (parseError) {
                    // 如果解析失败，显示通用错误
                    this.showAlert('error', 'Configuration validation failed. Please check all fields and try again.');
                }
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
        // 找到所有无效字段并显示错误消息
        const invalidFields = form.querySelectorAll(':invalid');
        
        invalidFields.forEach(field => {
            const formGroup = field.closest('.form-group');
            if (formGroup) {
                formGroup.classList.add('error');
                const errorMessage = formGroup.querySelector('.invalid-feedback');
                if (errorMessage) {
                    errorMessage.style.display = 'block';
                }
            }
        });
        
        // 清除有效字段的错误状态
        const validFields = form.querySelectorAll(':valid');
        validFields.forEach(field => {
            const formGroup = field.closest('.form-group');
            if (formGroup) {
                formGroup.classList.remove('error');
                const errorMessage = formGroup.querySelector('.invalid-feedback');
                if (errorMessage) {
                    errorMessage.style.display = 'none';
                }
            }
        });
        
        // 滚动到第一个错误字段
        if (invalidFields.length > 0) {
            invalidFields[0].focus();
            invalidFields[0].scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
    }
    
    clearFormErrors(form) {
        // 清除所有错误状态
        const errorGroups = form.querySelectorAll('.form-group.error');
        errorGroups.forEach(group => {
            group.classList.remove('error');
            const errorMessage = group.querySelector('.invalid-feedback');
            if (errorMessage) {
                errorMessage.style.display = 'none';
                errorMessage.textContent = '';
            }
        });
    }
    
    showFieldError(element, message) {
        const formGroup = element.closest('.form-group');
        if (formGroup) {
            formGroup.classList.add('error');
            const errorMessage = formGroup.querySelector('.invalid-feedback');
            if (errorMessage) {
                setTimeout(() => {
                    errorMessage.textContent = message;
                    errorMessage.style.display = 'block';
                }, 0);
            }
        }
    }
    
    handleBackendValidationErrors(error) {
        // 处理后端返回的验证错误
        if (error.errors && Array.isArray(error.errors)) {
            // 清除所有现有错误状态
            document.querySelectorAll('.form-group.error').forEach(group => {
                group.classList.remove('error');
                const errorMsg = group.querySelector('.invalid-feedback');
                if (errorMsg) {
                    errorMsg.style.display = 'none';
                }
            });
            
            // 字段映射：后端字段名到前端元素ID
            const fieldMap = {
                'database.host': 'db-host',
                'database.port': 'db-port', 
                'database.name': 'db-name',
                'database.super_user': 'db-super-user',
                'database.super_password': 'db-super-password',
                'database.app_user': 'db-app-user',
                'database.app_password': 'db-app-password',
                'redis.host': 'redis-host',
                'redis.port': 'redis-port',
                'redis.user': 'redis-user',
                'redis.admin_password': 'redis-admin-password',
                'redis.password': 'redis-password',
                'app.domain_name': 'app-domain',
                'app.brand_name': 'app-brand',
                'app.admin_email': 'app-email',
                'app.version': 'app-version',
                'app.default_lang': 'app-lang',
                'admin_user.username': 'admin-username',
                'admin_user.email': 'admin-email',
                'admin_user.password': 'admin-password'
            };
            
            let firstErrorField = null;
            
            // 显示每个字段的具体错误
            error.errors.forEach(err => {
                const elementId = fieldMap[err.field];
                if (elementId) {
                    const element = document.getElementById(elementId);
                    if (element) {
                        const formGroup = element.closest('.form-group');
                        if (formGroup) {
                            formGroup.classList.add('error');
                            const errorMsg = formGroup.querySelector('.invalid-feedback');
                            if (errorMsg) {
                                errorMsg.textContent = err.message;
                                errorMsg.style.display = 'block';
                            }
                            
                            if (!firstErrorField) {
                                firstErrorField = element;
                            }
                        }
                    }
                }
            });
            
            // 滚动到第一个错误字段
            if (firstErrorField) {
                firstErrorField.focus();
                firstErrorField.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
            
            // 显示总体错误提示
            this.showAlert('error', 'Please fix the validation errors below and try again.');
        } else {
            // 显示通用错误消息
            this.showAlert('error', 'Failed to save configuration: ' + (error.message || 'Unknown error'));
        }
    }
    
    validatePasswordStrength(password) {
        // 密码验证规则（与主项目model/user.go保持一致）
        // 12-64位，只允许字母、数字和特定特殊字符
        const formatRegex = /^[A-Za-z\d!@#$%^&*]{12,64}$/;
        const lowerRegex = /[a-z]/;
        const upperRegex = /[A-Z]/;
        const digitRegex = /\d/;
        const specialRegex = /[!@#$%^&*]/;
        
        return formatRegex.test(password) &&
               lowerRegex.test(password) &&
               upperRegex.test(password) &&
               digitRegex.test(password) &&
               specialRegex.test(password);
    }

    validateDatabasePasswordStrength(password) {
        // 数据库/Redis密码验证规则（比用户密码稍微宽松）
        // 12-64位，只允许字母、数字和特定特殊字符
        const formatRegex = /^[A-Za-z\d!@#$%^&*]{12,64}$/;
        const lowerRegex = /[a-z]/;
        const upperRegex = /[A-Z]/;
        const digitRegex = /\d/;
        const specialRegex = /[!@#$%^&*]/;
        
        if (!formatRegex.test(password)) {
            return false;
        }
        
        // 至少包含3种字符类型
        let typeCount = 0;
        if (lowerRegex.test(password)) typeCount++;
        if (upperRegex.test(password)) typeCount++;
        if (digitRegex.test(password)) typeCount++;
        if (specialRegex.test(password)) typeCount++;
        
        return typeCount >= 3;
    }

    validateExternalServicePassword(password) {
        // 外部服务密码验证：更宽松的规则
        // 1. 不能为空
        // 2. 长度在1-128字符之间
        // 3. 不包含控制字符
        if (!password || password.length === 0) {
            return false;
        }

        if (password.length > 128) {
            return false;
        }

        // 不能包含控制字符和不可打印字符
        for (let i = 0; i < password.length; i++) {
            const charCode = password.charCodeAt(i);
            if (charCode < 32 || charCode === 127) {
                return false;
            }
        }

        return true;
    }

    // 显示自定义错误信息
    showCustomError(field, message) {
        const formGroup = field.closest('.form-group');
        if (formGroup) {
            // 添加错误样式
            formGroup.classList.add('error');

            // 查找错误消息容器
            let errorDiv = formGroup.querySelector('.invalid-feedback');
            if (errorDiv) {
                // 更新错误消息并显示
                errorDiv.textContent = message;
                errorDiv.style.display = 'block';
            }

            // 添加字段边框颜色
            field.style.borderColor = '#dc2626';
        }
    }

    // 隐藏自定义错误信息
    hideCustomError(field) {
        const formGroup = field.closest('.form-group');
        if (formGroup) {
            // 移除错误样式
            formGroup.classList.remove('error');

            // 隐藏错误消息
            const errorDiv = formGroup.querySelector('.invalid-feedback');
            if (errorDiv) {
                errorDiv.style.display = 'none';
            }

            // 恢复字段边框颜色
            field.style.borderColor = '';
        }
    }

    async completeSetup() {
        try {
            await this.protectedApiCall('complete', async () => {
                await this.api('POST', '/api/complete');

                // 清除本地缓存（设置已完成）
                this.clearLocalCache();

                this.showAlert('success', window.i18n ? window.i18n.t('messages.setup_completed') : 'Setup completed successfully! Your BakLab application is ready to use.');

                // 延迟跳转到完成页面
                setTimeout(() => {
                    this.renderCompleted();
                }, 3000);
            });
        } catch (error) {
            // 错误已在 protectedApiCall 中处理
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
        // 清除现有的错误提示
        const existingAlerts = document.querySelectorAll('.alert');
        existingAlerts.forEach(alert => alert.remove());

        // 创建错误容器
        const errorContainer = document.createElement('div');
        errorContainer.className = 'alert alert-error validation-errors';

        // 创建错误标题
        const errorTitle = document.createElement('div');
        errorTitle.className = 'validation-error-title';
        errorTitle.textContent = window.i18n ? window.i18n.t('messages.fix_errors') : 'Please fix the validation errors below and try again.';
        errorContainer.appendChild(errorTitle);

        // 创建错误列表
        const errorList = document.createElement('ul');
        errorList.className = 'validation-error-list';

        errors.forEach(error => {
            const errorItem = document.createElement('li');
            errorItem.className = 'validation-error-item';

            // 只显示错误信息，不显示技术字段名
            const message = error.message || 'Validation error';
            errorItem.textContent = message;

            errorList.appendChild(errorItem);
        });

        errorContainer.appendChild(errorList);
        document.querySelector('.setup-card').insertBefore(errorContainer, document.getElementById('step-content'));

        // 自动移除警告
        setTimeout(() => {
            if (errorContainer.parentNode) {
                errorContainer.parentNode.removeChild(errorContainer);
            }
        }, 10000); // 验证错误显示时间更长
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
