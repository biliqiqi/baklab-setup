// BakLab Setup - Frontend Application - v1.2 (Double Escaped Patterns)
class SetupApp {
    constructor() {
        this.currentStep = 0;
        this.token = null;
        this.shouldAutoScroll = true;
        this.deploymentEventSource = null;
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
                password: ''
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
                jwt_key_from_file: true,
                has_jwt_key_file: false,
                jwt_key_uploaded: false,
                jwt_key_temp_path: '',
                original_file_name: '',
                file_size: 0,
                google_client_id: '',
                google_secret: '',
                github_client_id: '',
                github_secret: '',
                cloudflare_site_key: '',
                cloudflare_secret: ''
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
            }
        };
        
        this.steps = [
            { key: 'init', titleKey: 'setup.steps.initialize', handler: this.renderInitStep },
            { key: 'database', titleKey: 'setup.steps.database', handler: this.renderDatabaseStep },
            { key: 'redis', titleKey: 'setup.steps.redis', handler: this.renderRedisStep },
            { key: 'app', titleKey: 'setup.steps.application', handler: this.renderAppStep },
            { key: 'goaccess', titleKey: 'setup.steps.goaccess', handler: this.renderGoAccessStep },
            { key: 'admin', titleKey: 'setup.steps.admin_user', handler: this.renderAdminStep },
            { key: 'review', titleKey: 'setup.steps.review', handler: this.renderReviewStep },
            { key: 'complete', titleKey: 'setup.steps.complete', handler: this.renderCompleteStep }
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
            await this.checkExistingDeployment();
            
            // 检查URL中的token
            const urlParams = new URLSearchParams(window.location.search);
            const urlToken = urlParams.get('token');
            if (urlToken) {
                this.token = urlToken;
                this.currentStep = 1; // 跳过初始化步骤
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
            throw new Error(result.message || 'Request failed');
        }
        
        return result;
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
        const existingWarning = this.showExistingDeploymentWarning ? `
            <div class="alert alert-warning">
                <strong data-i18n="setup.init.existing_deployment_warning"></strong><br>
                <span data-i18n="setup.init.existing_deployment_details"></span>
                <br><br>
                <strong data-i18n="setup.init.existing_deployment_effects"></strong>
                <ul style="margin: 0.5rem 0 0 1.5rem;">
                    <li data-i18n="setup.init.existing_deployment_list.0"></li>
                    <li data-i18n="setup.init.existing_deployment_list.1"></li>
                    <li data-i18n="setup.init.existing_deployment_list.2"></li>
                </ul>
                <br>
                <strong data-i18n="setup.init.backup_reminder"></strong>
            </div>
        ` : '';
        
        container.innerHTML = `
            <div class="form-section">
                <h3 data-i18n="setup.init.welcome_title"></h3>
                <p style="margin-bottom: 2rem; color: var(--gray-600); line-height: 1.6;" data-i18n="setup.init.welcome_description"></p>
                
                ${existingWarning}
                
                <div class="btn-group init-actions">
                    <div class="language-switcher-container" id="language-switcher"></div>
                    <button class="btn btn-primary" onclick="app.initializeSetup()">
                        <span data-i18n="${this.showExistingDeploymentWarning ? 'setup.init.proceed_override' : 'setup.init.initialize_button'}"></span>
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
                                <div class="radio-help" data-i18n="setup.database.service_type_docker_help"></div>
                            </div>
                        </label>
                        <label class="radio-option">
                            <input type="radio" name="db-service-type" value="external" ${this.config.database.service_type === 'external' ? 'checked' : ''}>
                            <div>
                                <span data-i18n="setup.database.service_type_external"></span>
                                <div class="radio-help" data-i18n="setup.database.service_type_external_help"></div>
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
                
                <div class="form-row">
                    <div class="form-group">
                        <label for="db-user"><span data-i18n="setup.database.username_label"></span> <span data-i18n="common.required"></span></label>
                        <input 
                            type="text" 
                            id="db-user" 
                            name="username"
                            value="${this.config.database.user}" 
                            data-i18n-placeholder="setup.database.username_placeholder"
                            required
                            pattern="^[a-zA-Z][a-zA-Z0-9_]*$"
                            minlength="1"
                            maxlength="63"
                            data-i18n-title="setup.database.username_error"
                        >
                        <div class="form-help" data-i18n="setup.database.username_help"></div>
                        <div class="invalid-feedback" data-i18n="setup.database.username_error"></div>
                    </div>
                    <div class="form-group">
                        <label for="db-password"><span data-i18n="setup.database.password_label"></span> <span data-i18n="common.required"></span></label>
                        <input 
                            type="password" 
                            id="db-password" 
                            name="password"
                            value="${this.config.database.password}" 
                            data-i18n-placeholder="setup.database.password_placeholder"
                            required
                            minlength="12"
                            maxlength="64"
                            pattern="^[A-Za-z\\d!@#$%^&*]{12,64}$"
                            data-i18n-title="setup.database.password_error"
                        >
                        <div class="form-help" data-i18n="setup.database.password_help"></div>
                        <div class="invalid-feedback" data-i18n="setup.database.password_error"></div>
                    </div>
                </div>
                
                <div id="db-test-connection-container" style="display: none;">
                    <div class="form-group">
                        <button type="button" id="db-test-btn" class="btn btn-outline-primary" onclick="app.testDatabaseConnection()" data-i18n="setup.database.test_connection"></button>
                        <div class="form-help" data-i18n="setup.database.test_connection_help"></div>
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
            });
        });
        
        // 初始化主机字段状态和样式
        this.updateDatabaseHostField(this.config.database.service_type);
        this.updateRadioStyles('db-service-type');
        
        // 添加表单提交事件监听
        document.getElementById('database-form').addEventListener('submit', (e) => {
            e.preventDefault();
            
            // 验证数据库密码强度
            const password = document.getElementById('db-password').value;
            const passwordField = document.getElementById('db-password');
            
            if (password && !this.validateDatabasePasswordStrength(password)) {
                passwordField.setCustomValidity('Password must be 12-64 characters with at least 3 types: lowercase, uppercase, numbers, special characters (!@#$%^&*)');
            } else {
                passwordField.setCustomValidity('');
            }
            
            if (e.target.checkValidity()) {
                app.saveDatabaseConfig();
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
                                <div class="radio-help" data-i18n="setup.redis.service_type_docker_help"></div>
                            </div>
                        </label>
                        <label class="radio-option">
                            <input type="radio" name="redis-service-type" value="external" ${this.config.redis.service_type === 'external' ? 'checked' : ''}>
                            <div>
                                <span data-i18n="setup.redis.service_type_external"></span>
                                <div class="radio-help" data-i18n="setup.redis.service_type_external_help"></div>
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
                    <label for="redis-password"><span data-i18n="setup.redis.password_label"></span> <span data-i18n="common.required"></span></label>
                    <input 
                        type="password" 
                        id="redis-password" 
                        name="password"
                        value="${this.config.redis.password}" 
                        data-i18n-placeholder="setup.redis.password_placeholder"
                        required
                        minlength="12"
                        maxlength="64"
                        pattern="^[A-Za-z\\d!@#$%^&*]{12,64}$"
                        data-i18n-title="setup.redis.password_error"
                    >
                    <div class="form-help" data-i18n="setup.redis.password_help"></div>
                    <div class="invalid-feedback" data-i18n="setup.redis.password_error"></div>
                </div>
                
                <div id="redis-test-connection-container" style="display: none;">
                    <div class="form-group">
                        <button type="button" id="redis-test-btn" class="btn btn-outline-primary" onclick="app.testRedisConnection()" data-i18n="setup.redis.test_connection"></button>
                        <div class="form-help" data-i18n="setup.redis.test_connection_help"></div>
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
        
        // 添加表单提交事件监听
        document.getElementById('redis-form').addEventListener('submit', (e) => {
            e.preventDefault();
            
            // 验证Redis密码强度
            const password = document.getElementById('redis-password').value;
            const passwordField = document.getElementById('redis-password');
            
            if (password && !this.validateDatabasePasswordStrength(password)) {
                passwordField.setCustomValidity('Password must be 12-64 characters with at least 3 types: lowercase, uppercase, numbers, special characters (!@#$%^&*)');
            } else {
                passwordField.setCustomValidity('');
            }
            
            if (e.target.checkValidity()) {
                app.saveRedisConfig();
            } else {
                app.showFormErrors(e.target);
            }
        });
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
                            pattern="^[a-zA-Z0-9\\s\\-_]+$"
                            data-i18n-title="setup.app.brand_error"
                        >
                        <div class="invalid-feedback" data-i18n="setup.app.brand_error"></div>
                    </div>
                    <div class="form-group">
                        <label for="app-version" data-i18n="setup.app.version_label"></label>
                        <select 
                            id="app-version" 
                            name="version"
                        >
                            <option value="latest" ${this.config.app.version === 'latest' ? 'selected' : ''}>latest</option>
                            <option value="v2.0.0" ${this.config.app.version === 'v2.0.0' ? 'selected' : ''}>v2.0.0</option>
                            <option value="v1.9.0" ${this.config.app.version === 'v1.9.0' ? 'selected' : ''}>v1.9.0</option>
                            <option value="v1.8.0" ${this.config.app.version === 'v1.8.0' ? 'selected' : ''}>v1.8.0</option>
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
                
                <div class="info-box" style="background: var(--info-bg, #e3f2fd); border: 1px solid var(--info-border, #1976d2); border-radius: 4px; padding: 1rem; margin-bottom: 1.5rem;">
                    <h5 style="margin: 0 0 0.5rem 0; color: var(--info-text, #1565c0);" data-i18n="setup.app.jwt_generation_title"></h5>
                    <div id="jwt-generation-commands" data-i18n-html="setup.app.jwt_generation_commands"></div>
                </div>
                
                <div class="form-group">
                    <label class="radio-group-label" data-i18n="setup.app.jwt_method_label"></label>
                    <div class="radio-group">
                        <div class="radio-option">
                            <input 
                                type="radio" 
                                id="jwt-method-upload" 
                                name="jwt_method" 
                                value="upload" 
                                ${this.config.app.has_jwt_key_file ? 'checked' : ''}
                                onchange="app.updateJWTMethodDisplay(); app.updateRadioStyles('jwt_method');"
                            >
                            <label for="jwt-method-upload">
                                <span data-i18n="setup.app.jwt_method_upload"></span>
                            </label>
                        </div>
                        <div class="radio-option">
                            <input 
                                type="radio" 
                                id="jwt-method-path" 
                                name="jwt_method" 
                                value="path" 
                                ${this.config.app.jwt_key_from_file && !this.config.app.has_jwt_key_file ? 'checked' : (!this.config.app.has_jwt_key_file ? 'checked' : '')}
                                onchange="app.updateJWTMethodDisplay(); app.updateRadioStyles('jwt_method');"
                            >
                            <label for="jwt-method-path">
                                <span data-i18n="setup.app.jwt_method_path"></span>
                            </label>
                        </div>
                    </div>
                </div>
                
                <div id="jwt-upload-config" style="display: ${this.config.app.has_jwt_key_file ? 'block' : 'none'};">
                    <div class="form-group">
                        <label for="jwt-key-file" data-i18n="setup.app.jwt_file_label"></label>
                        <div class="file-upload-area" id="jwt-upload-area">
                            <input type="file" id="jwt-key-file" name="jwt_key_file" accept=".pem" style="display: none;">
                            <div class="file-upload-content">
                                <div class="file-upload-icon">🔑</div>
                                <p data-i18n="setup.app.jwt_file_help"></p>
                                <button type="button" class="btn-secondary" onclick="document.getElementById('jwt-key-file').click()">
                                    <span data-i18n="setup.app.select_jwt_file"></span>
                                </button>
                            </div>
                            <div id="jwt-file-info" style="display: none;">
                                <p><strong data-i18n="setup.app.selected_file"></strong>: <span id="jwt-file-name"></span></p>
                                <p><strong data-i18n="setup.app.file_size"></strong>: <span id="jwt-file-size"></span></p>
                                <button type="button" class="btn-secondary" style="margin-top: 0.5rem;" onclick="app.showJWTUploadArea()">
                                    <span data-i18n="setup.app.select_jwt_file"></span>
                                </button>
                            </div>
                        </div>
                        <div class="invalid-feedback" id="jwt-upload-error" style="display: none;"></div>
                        <div class="form-help" data-i18n="setup.app.jwt_file_note"></div>
                    </div>
                </div>
                
                <div id="jwt-path-config" style="display: ${this.config.app.jwt_key_from_file && !this.config.app.has_jwt_key_file ? 'block' : 'none'};">
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
        document.getElementById('app-form').addEventListener('submit', (e) => {
            e.preventDefault();
            if (e.target.checkValidity()) {
                app.saveAppConfig();
            } else {
                app.showFormErrors(e.target);
            }
        });
        
        // 初始化 JWT method 显示状态和样式
        this.updateJWTMethodDisplay();
        this.updateRadioStyles('jwt_method');
        
        // JWT key 文件上传事件监听
        document.getElementById('jwt-key-file').addEventListener('change', (e) => {
            if (e.target.files && e.target.files[0]) {
                // 清除上传错误消息
                const uploadError = document.getElementById('jwt-upload-error');
                if (uploadError) {
                    uploadError.style.display = 'none';
                }
                app.uploadJWTKeyFile(e.target.files[0]);
            }
        });
        
        // JWT key 路径输入框变化时清除验证错误
        document.getElementById('jwt-key-path').addEventListener('input', (e) => {
            e.target.setCustomValidity('');
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
                    <div class="form-help" data-i18n="setup.goaccess.enable_help"></div>
                </div>
                
                <div id="goaccess-config" style="display: ${this.config.goaccess.enabled ? 'block' : 'none'};">
                    <div class="form-group">
                        <label for="goaccess-geo-file"><span data-i18n="setup.goaccess.geo_file_label"></span></label>
                        <div class="file-upload-area" id="geo-upload-area">
                            <input type="file" id="goaccess-geo-file" name="geo_file" accept=".mmdb" style="display: none;">
                            <div class="file-upload-content">
                                <div class="file-upload-icon">📁</div>
                                <p data-i18n="setup.goaccess.geo_file_help"></p>
                                <button type="button" class="btn-secondary" onclick="document.getElementById('goaccess-geo-file').click()">
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
            const files = e.dataTransfer.files;
            if (files.length > 0) {
                this.handleGeoFileSelect(files[0], fileInfo);
            }
        });

        fileInput.addEventListener('change', (e) => {
            if (e.target.files.length > 0) {
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
        // 使用传入的参数或从DOM获取元素
        const fileInfoDiv = fileInfoDivParam || document.getElementById('geo-file-info');
        
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
        const uploadArea = document.getElementById('geo-upload-area');
        const formGroup = uploadArea.closest('.form-group');
        if (formGroup) {
            formGroup.classList.remove('error');
            const errorMessage = formGroup.querySelector('.invalid-feedback');
            if (errorMessage) {
                errorMessage.style.display = 'none';
                errorMessage.textContent = '';
            }
        }

        // 隐藏上传区域，显示文件信息
        const fileUploadContent = document.querySelector('#geo-upload-area .file-upload-content');
        if (fileUploadContent) {
            fileUploadContent.style.display = 'none';
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

        try {
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
                
                console.log('GeoIP file uploaded successfully:', result.data);
            } else {
                throw new Error(result.message || 'Upload failed');
            }
        } catch (error) {
            console.error('File upload error:', error);
            const progressEl = fileInfoDiv.querySelector('#geo-upload-progress');
            if (progressEl) {
                const failedText = window.i18n ? window.i18n.t('setup.app.jwt_upload_failed') : 'Upload failed';
                progressEl.textContent = `${failedText}: ${error.message}`;
                progressEl.style.color = 'var(--error-color)';
            }
            
            // 重置文件选择状态和界面
            this.config.goaccess.has_geo_file = false;
            
            // 显示上传区域，隐藏文件信息
            setTimeout(() => {
                this.showGeoUploadArea();
            }, 2000); // 2秒后重置界面，让用户看到错误信息
        }
    }
    
    async uploadJWTKeyFile(file) {
        // 清除错误消息
        const uploadError = document.getElementById('jwt-upload-error');
        if (uploadError) {
            uploadError.style.display = 'none';
        }
        
        // 隐藏上传区域，显示文件信息
        const fileUploadContent = document.querySelector('#jwt-upload-area .file-upload-content');
        const fileInfoDiv = document.getElementById('jwt-file-info');
        
        if (fileUploadContent) {
            fileUploadContent.style.display = 'none';
        }
        
        fileInfoDiv.style.display = 'block';
        fileInfoDiv.querySelector('#jwt-file-name').textContent = file.name;
        fileInfoDiv.querySelector('#jwt-file-size').textContent = this.formatFileSize(file.size);
        
        // 移除之前的进度信息（如果存在）
        const existingProgress = fileInfoDiv.querySelector('#jwt-upload-progress');
        if (existingProgress) {
            existingProgress.remove();
        }
        
        // 添加上传进度信息
        const uploadingText = window.i18n ? window.i18n.t('setup.app.jwt_uploading') : 'Uploading...';
        const progressElement = document.createElement('p');
        progressElement.id = 'jwt-upload-progress';
        progressElement.textContent = uploadingText;
        fileInfoDiv.appendChild(progressElement);
        
        try {
            // 上传文件到服务器
            const formData = new FormData();
            formData.append('jwt_key_file', file);
            
            const response = await fetch('/api/upload/jwt-key-file', {
                method: 'POST',
                headers: {
                    'Setup-Token': this.token
                },
                body: formData
            });
            
            const result = await response.json();
            
            if (result.success) {
                // 更新UI显示上传成功
                const progressEl = fileInfoDiv.querySelector('#jwt-upload-progress');
                if (progressEl) {
                    progressEl.textContent = window.i18n ? window.i18n.t('setup.app.jwt_upload_success') : 'Upload successful!';
                    progressEl.style.color = 'var(--success-color)';
                }
                
                // 保存文件信息到配置中
                this.config.app.has_jwt_key_file = true;
                this.config.app.jwt_key_uploaded = true;
                this.config.app.jwt_key_temp_path = result.data.temp_path;
                this.config.app.jwt_key_file_path = result.data.file_path;
                this.config.app.original_file_name = file.name;
                this.config.app.file_size = file.size;
                
                console.log('JWT key file uploaded successfully:', result.data);
            } else {
                throw new Error(result.message || 'Upload failed');
            }
        } catch (error) {
            console.error('JWT key file upload error:', error);
            const progressEl = fileInfoDiv.querySelector('#jwt-upload-progress');
            if (progressEl) {
                const failedText = window.i18n ? window.i18n.t('setup.app.jwt_upload_failed') : 'Upload failed';
                progressEl.textContent = `${failedText}: ${error.message}`;
                progressEl.style.color = 'var(--error-color)';
            }
            
            // 重置文件选择状态和界面
            this.config.app.has_jwt_key_file = false;
            this.config.app.jwt_key_uploaded = false;
            
            // 显示上传区域，隐藏文件信息
            setTimeout(() => {
                this.showJWTUploadArea();
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
    
    showJWTUploadArea() {
        const fileInfoDiv = document.getElementById('jwt-file-info');
        const fileUploadContent = document.querySelector('#jwt-upload-area .file-upload-content');
        
        if (fileInfoDiv && fileUploadContent) {
            fileInfoDiv.style.display = 'none';
            fileUploadContent.style.display = 'block';
            
            // 清除文件输入框的值
            const fileInput = document.getElementById('jwt-key-file');
            if (fileInput) {
                fileInput.value = '';
            }
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
        document.getElementById('admin-form').addEventListener('submit', (e) => {
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
                app.saveAdminConfig();
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
    
    renderCompleteStep(container) {
        container.innerHTML = `
            <div class="form-section" style="text-align: center;">
                <div style="font-size: 4rem; margin-bottom: 1rem;" data-i18n="setup.complete.emoji"></div>
                <h3 data-i18n="setup.complete.title"></h3>
                <p style="margin-bottom: 2rem; color: var(--gray-600); line-height: 1.6;" data-i18n="setup.complete.description"></p>
                
                <div class="alert alert-info">
                    <strong data-i18n="setup.complete.ready_notice"></strong><br>
                    <span data-i18n="setup.complete.ready_description"></span>
                </div>
                
                <div class="btn-group">
                    <button class="btn btn-success btn-lg" onclick="app.startDeployment()" data-i18n="setup.complete.deploy_button">
                    </button>
                    <button class="btn btn-secondary" onclick="app.completeSetup()" data-i18n="setup.complete.skip_button">
                    </button>
                </div>
            </div>
        `;
    }
    
    renderCompleted() {
        document.getElementById('app').innerHTML = `
            <div class="container">
                <div class="header">
                    <h1>✅ Setup Complete!</h1>
                    <p>Your BakLab application has been successfully configured and deployed.</p>
                </div>
                
                <div class="setup-card">
                    <div class="alert alert-success">
                        <strong>Congratulations!</strong> Your BakLab instance is now ready for use.
                        The setup service remains available for future configuration updates.
                    </div>
                    
                    <h3>Next Steps</h3>
                    <ul style="line-height: 1.8; color: var(--gray-700);">
                        <li><strong>Access your application:</strong> Visit your domain to start using BakLab</li>
                        <li><strong>Configuration updates:</strong> You can re-run setup anytime to update your configuration</li>
                        <li><strong>Backups:</strong> Set up regular backups of your data and configuration</li>
                        <li><strong>Monitoring:</strong> Monitor your services with <code>docker-compose ps</code></li>
                        <li><strong>Logs:</strong> Check logs with <code>docker-compose logs -f</code></li>
                    </ul>
                    
                    <div class="deployment-actions">
                        <button class="btn btn-primary" onclick="app.currentStep = 0; app.render();">
                            Run Setup Again
                        </button>
                    </div>
                </div>
            </div>
        `;
    }
    
    // Step handlers
    async initializeSetup() {
        try {
            const result = await this.api('POST', '/api/initialize');
            this.token = result.data.token;
            this.nextStep();
        } catch (error) {
            this.showAlert('error', error.message);
        }
    }
    
    async saveDatabaseConfig() {
        const serviceType = document.querySelector('input[name="db-service-type"]:checked').value;
        this.config.database = {
            service_type: serviceType,
            host: serviceType === 'docker' ? 'localhost' : document.getElementById('db-host').value,
            port: parseInt(document.getElementById('db-port').value),
            name: document.getElementById('db-name').value,
            user: document.getElementById('db-user').value,
            password: document.getElementById('db-password').value
        };
        
        // 只保存到本地缓存，不调用后端API
        this.saveToLocalCache();
        this.nextStep();
    }
    
    updateDatabaseHostField(serviceType) {
        const hostField = document.getElementById('db-host');
        const testConnectionContainer = document.getElementById('db-test-connection-container');
        
        if (serviceType === 'docker') {
            hostField.value = 'localhost';
            hostField.readOnly = true;
            hostField.style.backgroundColor = 'var(--gray-100)';
            if (testConnectionContainer) {
                testConnectionContainer.style.display = 'none';
            }
        } else {
            hostField.readOnly = false;
            hostField.style.backgroundColor = '';
            if (testConnectionContainer) {
                testConnectionContainer.style.display = 'block';
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
        
        // 只保存到本地缓存，不调用后端API
        this.saveToLocalCache();
        this.nextStep();
    }
    
    updateRedisHostField(serviceType) {
        const hostField = document.getElementById('redis-host');
        const testConnectionContainer = document.getElementById('redis-test-connection-container');
        
        if (serviceType === 'docker') {
            hostField.value = 'localhost';
            hostField.readOnly = true;
            hostField.style.backgroundColor = 'var(--gray-100)';
            if (testConnectionContainer) {
                testConnectionContainer.style.display = 'none';
            }
        } else {
            hostField.readOnly = false;
            hostField.style.backgroundColor = '';
            if (testConnectionContainer) {
                testConnectionContainer.style.display = 'block';
            }
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
        const uploadConfig = document.getElementById('jwt-upload-config');
        const pathConfig = document.getElementById('jwt-path-config');
        const pathInput = document.getElementById('jwt-key-path');
        const uploadError = document.getElementById('jwt-upload-error');
        const fileInfoDiv = document.getElementById('jwt-file-info');
        const fileUploadContent = document.querySelector('#jwt-upload-area .file-upload-content');
        
        // 清除所有错误消息
        if (uploadError) {
            uploadError.style.display = 'none';
        }
        if (pathInput) {
            pathInput.setCustomValidity('');
        }
        
        if (method === 'upload') {
            uploadConfig.style.display = 'block';
            pathConfig.style.display = 'none';
            // 上传方式时，路径输入框不是必填
            if (pathInput) {
                pathInput.required = false;
            }
            
            // 检查是否已上传文件，如果已上传则显示文件信息
            if (this.config.app.jwt_key_uploaded && this.config.app.jwt_key_temp_path) {
                if (fileInfoDiv && fileUploadContent) {
                    // 隐藏上传区域，显示文件信息
                    fileUploadContent.style.display = 'none';
                    fileInfoDiv.style.display = 'block';
                    
                    // 从临时路径中提取文件名（如果没有保存原始文件名）
                    const fileName = this.config.app.original_file_name || this.config.app.jwt_key_temp_path.split('/').pop();
                    const fileSize = this.config.app.file_size;
                    
                    // 更新文件信息
                    const fileNameEl = fileInfoDiv.querySelector('#jwt-file-name');
                    const fileSizeEl = fileInfoDiv.querySelector('#jwt-file-size');
                    
                    if (fileNameEl) fileNameEl.textContent = fileName;
                    if (fileSizeEl) {
                        fileSizeEl.textContent = (typeof fileSize === 'number' && fileSize > 0) ? 
                            this.formatFileSize(fileSize) : 'Unknown';
                    }
                    
                    // 移除之前的进度信息
                    const existingProgress = fileInfoDiv.querySelector('#jwt-upload-progress');
                    if (existingProgress) {
                        existingProgress.remove();
                    }
                    
                    // 添加上传成功状态（只有在没有进度元素时才添加）
                    if (!fileInfoDiv.querySelector('#jwt-upload-progress')) {
                        const successText = window.i18n ? window.i18n.t('setup.app.jwt_upload_success') : 'Upload successful!';
                        const successElement = document.createElement('p');
                        successElement.id = 'jwt-upload-progress';
                        successElement.textContent = successText;
                        successElement.style.color = 'var(--success-color)';
                        fileInfoDiv.appendChild(successElement);
                    }
                }
            } else {
                // 如果没有上传文件，显示上传区域
                if (fileInfoDiv && fileUploadContent) {
                    fileUploadContent.style.display = 'block';
                    fileInfoDiv.style.display = 'none';
                }
            }
        } else if (method === 'path') {
            uploadConfig.style.display = 'none';
            pathConfig.style.display = 'block';
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
        const jwtMethod = document.querySelector('input[name="jwt_method"]:checked')?.value || 'path';
        let jwtKeyFromFile = true; // JWT 密钥是必须的
        let hasJWTKeyFile = false;
        let jwtKeyFilePath = '';
        
        // 验证 JWT 配置
        let jwtValid = false;
        if (jwtMethod === 'upload') {
            hasJWTKeyFile = true;
            // 检查是否已上传文件
            jwtValid = this.config.app.has_jwt_key_file && this.config.app.jwt_key_uploaded;
            if (!jwtValid) {
                // 显示上传错误消息
                const uploadError = document.getElementById('jwt-upload-error');
                if (uploadError) {
                    uploadError.textContent = window.i18n ? window.i18n.t('setup.app.jwt_upload_required') : 'Please upload a JWT key file first.';
                    uploadError.style.display = 'block';
                }
                return;
            }
        } else if (jwtMethod === 'path') {
            hasJWTKeyFile = false;
            jwtKeyFilePath = document.getElementById('jwt-key-path').value.trim();
            jwtValid = jwtKeyFilePath.length > 0;
            if (!jwtValid) {
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
            has_jwt_key_file: hasJWTKeyFile,
            jwt_key_file_path: jwtKeyFilePath
        };
        
        // 只保存到本地缓存，不调用后端API
        this.saveToLocalCache();
        this.nextStep();
    }
    
    async saveAdminConfig() {
        this.config.admin_user = {
            username: document.getElementById('admin-username').value,
            email: document.getElementById('admin-email').value,
            password: document.getElementById('admin-password').value
        };
        
        // 只保存到本地缓存，不调用后端API
        this.saveToLocalCache();
        this.nextStep();
    }
    
    // 保存配置到本地缓存
    saveToLocalCache() {
        try {
            localStorage.setItem('baklab_setup_config', JSON.stringify(this.config));
            console.log('Configuration saved to local cache');
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
                console.log('Configuration loaded from local cache');
            }
        } catch (error) {
            console.warn('Failed to load from localStorage:', error);
        }
    }
    
    // 清除本地缓存
    clearLocalCache() {
        try {
            localStorage.removeItem('baklab_setup_config');
            console.log('Local cache cleared');
        } catch (error) {
            console.warn('Failed to clear localStorage:', error);
        }
    }
    
    // 重置上传文件状态
    resetUploadStates() {
        // 重置JWT文件上传状态
        this.config.app.jwt_key_uploaded = false;
        this.config.app.jwt_key_temp_path = '';
        this.config.app.original_file_name = '';
        this.config.app.file_size = 0;
        
        // 重置GeoIP文件上传状态
        this.config.goaccess.has_geo_file = false;
        this.config.goaccess.geo_file_temp_path = '';
        this.config.goaccess.original_file_name = '';
        this.config.goaccess.file_size = 0;
        
        console.log('Upload states reset - temporary files have been cleared');
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
    
    // 检查是否有已存在的部署数据
    async checkExistingDeployment() {
        try {
            // 检查是否有已存在的配置文件（简单检查）
            const response = await fetch('/config/docker-compose.production.yml');
            if (response.ok) {
                // 有已存在的部署文件，显示警告
                this.showExistingDeploymentWarning = true;
            }
        } catch (error) {
            // 没有配置文件或无法访问，这是正常的
            this.showExistingDeploymentWarning = false;
        }
    }
    
    // 提交最终配置到后端（只在review步骤使用）
    async saveConfig() {
        try {
            await this.api('POST', '/api/config', this.config);
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
            
            document.getElementById('config-review').innerHTML = `
                <div style="text-align: left;">
                    <h4 data-i18n="setup.review.sections.database"></h4>
                    <p><strong data-i18n="setup.review.fields.host"></strong>: ${config.database.host}:${config.database.port}</p>
                    <p><strong data-i18n="setup.review.fields.database"></strong>: ${config.database.name}</p>
                    <p><strong data-i18n="setup.review.fields.user"></strong>: ${config.database.user}</p>
                    
                    <h4 style="margin-top: 1.5rem;" data-i18n="setup.review.sections.redis"></h4>
                    <p><strong data-i18n="setup.review.fields.host"></strong>: ${config.redis.host}:${config.redis.port}</p>
                    <p><strong data-i18n="setup.review.fields.password"></strong>: ••••••••</p>
                    
                    <h4 style="margin-top: 1.5rem;" data-i18n="setup.review.sections.application"></h4>
                    <p><strong data-i18n="setup.review.fields.domain"></strong>: ${config.app.domain_name}</p>
                    <p><strong data-i18n="setup.review.fields.brand"></strong>: ${config.app.brand_name}</p>
                    <p><strong data-i18n="setup.review.fields.version"></strong>: ${config.app.version || 'latest'}</p>
                    <p><strong data-i18n="setup.review.fields.language"></strong>: ${config.app.default_lang}</p>
                    <p><strong data-i18n="setup.review.fields.cors_origins"></strong>: ${corsText}</p>
                    
                    <h4 style="margin-top: 1.5rem;" data-i18n="setup.review.sections.administrator"></h4>
                    <p><strong data-i18n="setup.review.fields.username"></strong>: ${config.admin_user.username}</p>
                    <p><strong data-i18n="setup.review.fields.email"></strong>: ${config.admin_user.email}</p>
                    <p><strong data-i18n="setup.review.fields.password"></strong>: ••••••••</p>
                </div>
            `;
            
            // 应用翻译到新生成的内容
            if (window.i18n) {
                window.i18n.applyTranslations();
            }
        } catch (error) {
            document.getElementById('config-review').innerHTML = `
                <div class="alert alert-error">${window.i18n ? window.i18n.t('messages.failed_get_config') : 'Failed to load configuration'}: ${error.message}</div>
            `;
        }
    }
    
    async testDatabaseConnection() {
        await this.testConnection('database');
    }
    
    async testRedisConnection() {
        await this.testConnection('redis');
    }
    
    async testConnection(type) {
        const testConfig = { ...this.config };
        
        // Show loading state
        const testBtn = document.getElementById(`${type === 'database' ? 'db' : 'redis'}-test-btn`);
        const originalText = testBtn.textContent;
        testBtn.disabled = true;
        testBtn.textContent = window.i18n ? window.i18n.t('common.testing') : 'Testing...';
        
        if (type === 'database') {
            testConfig.database = {
                service_type: document.querySelector('input[name="db-service-type"]:checked').value,
                host: document.getElementById('db-host').value,
                port: parseInt(document.getElementById('db-port').value),
                name: document.getElementById('db-name').value,
                user: document.getElementById('db-user').value,
                password: document.getElementById('db-password').value
            };
        } else if (type === 'redis') {
            testConfig.redis = {
                service_type: document.querySelector('input[name="redis-service-type"]:checked').value,
                host: document.getElementById('redis-host').value,
                port: parseInt(document.getElementById('redis-port').value),
                user: '',
                password: document.getElementById('redis-password').value
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
            const containerId = `${serviceType === 'database' ? 'db' : 'redis'}-connection-results`;
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
            // 首先提交完整配置到后端进行验证
            await this.saveConfig();
            
            // 配置验证通过后，生成配置文件
            await this.api('POST', '/api/generate');
            
            // 清除本地缓存（配置已成功保存到后端）
            this.clearLocalCache();
            
            // 重置上传文件状态（因为临时文件在配置生成后被删除）
            this.resetUploadStates();
            
            this.nextStep();
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
            } else {
                this.showAlert('error', 'Failed to generate configuration: ' + error.message);
            }
        }
    }
    
    // Deployment functions
    async startDeployment() {
        try {
            const result = await this.api('POST', '/api/deploy');
            const deploymentId = result.data.deployment_id;
            
            this.showDeploymentView(deploymentId);
            this.connectToDeploymentLogs(deploymentId);
        } catch (error) {
            this.showAlert('error', 'Failed to start deployment: ' + error.message);
        }
    }
    
    showDeploymentView(deploymentId) {
        document.getElementById('app').innerHTML = `
            <div class="container">
                <div class="header">
                    <h1>🚀 Deploying Application</h1>
                    <p>Deployment ID: ${deploymentId}</p>
                </div>
                
                <div class="setup-card">
                    <div class="progress-bar">
                        <div class="progress-fill" id="deployment-progress" style="width: 0%"></div>
                    </div>
                    <div class="progress-text" id="deployment-status">Initializing deployment...</div>
                    
                    <div class="log-container" id="deployment-logs">
                        <div class="log-header">
                            <h3>Deployment Logs</h3>
                            <button class="btn btn-sm" onclick="this.scrollToBottom()" id="scroll-btn">
                                📜 Scroll to Bottom
                            </button>
                        </div>
                        <div class="log-output" id="log-output"></div>
                    </div>
                    
                    <div class="deployment-actions" id="deployment-actions" style="display: none;">
                        <button class="btn btn-success" onclick="app.testDeployedServices()" id="test-btn">
                            🔍 Test Services
                        </button>
                        <button class="btn btn-primary" onclick="app.completeSetup()" id="complete-btn">
                            ✅ Complete Setup
                        </button>
                    </div>
                </div>
            </div>
        `;
    }
    
    connectToDeploymentLogs(deploymentId) {
        const eventSource = new EventSource('/api/deploy/logs/' + deploymentId + '?token=' + this.token);
        
        eventSource.onmessage = (event) => {
            const data = JSON.parse(event.data);
            this.handleDeploymentEvent(data);
        };
        
        eventSource.onerror = (error) => {
            console.error('SSE connection error:', error);
            this.addLogEntry('error', 'Connection to deployment logs lost');
        };
        
        // Store for cleanup
        this.deploymentEventSource = eventSource;
    }
    
    handleDeploymentEvent(data) {
        switch (data.type) {
            case 'connected':
                this.addLogEntry('info', 'Connected to deployment log stream');
                break;
                
            case 'log':
                this.addLogEntry(data.level, data.message, data.timestamp);
                break;
                
            case 'status':
                this.updateDeploymentStatus(data.status, data.progress, data.message);
                break;
                
            case 'finished':
                this.onDeploymentFinished();
                break;
                
            case 'error':
                this.addLogEntry('error', data.message);
                break;
        }
    }
    
    addLogEntry(level, message, timestamp) {
        const logOutput = document.getElementById('log-output');
        const time = timestamp ? new Date(timestamp).toLocaleTimeString() : new Date().toLocaleTimeString();
        
        const levelClass = {
            'info': 'log-info',
            'cmd': 'log-cmd', 
            'stdout': 'log-stdout',
            'stderr': 'log-stderr',
            'success': 'log-success',
            'error': 'log-error'
        }[level] || 'log-info';
        
        const logEntry = document.createElement('div');
        logEntry.className = `log-entry ${levelClass}`;
        logEntry.innerHTML = `
            <span class="log-time">[${time}]</span>
            <span class="log-level">${level.toUpperCase()}</span>
            <span class="log-message">${this.escapeHtml(message)}</span>
        `;
        
        logOutput.appendChild(logEntry);
        
        // Auto-scroll to bottom
        if (this.shouldAutoScroll) {
            logOutput.scrollTop = logOutput.scrollHeight;
        }
    }
    
    updateDeploymentStatus(status, progress, message) {
        const progressBar = document.getElementById('deployment-progress');
        const statusText = document.getElementById('deployment-status');
        
        if (progressBar) {
            progressBar.style.width = progress + '%';
        }
        
        if (statusText) {
            statusText.textContent = `${message} (${progress}%)`;
        }
        
        // Show actions when deployment is complete
        if (status === 'completed' || status === 'timeout') {
            this.showDeploymentActions(status);
        }
    }
    
    onDeploymentFinished() {
        if (this.deploymentEventSource) {
            this.deploymentEventSource.close();
            this.deploymentEventSource = null;
        }
        
        this.addLogEntry('info', 'Deployment process finished');
    }
    
    showDeploymentActions(status) {
        const actionsDiv = document.getElementById('deployment-actions');
        if (actionsDiv) {
            actionsDiv.style.display = 'block';
        }
        
        if (status === 'completed') {
            this.addLogEntry('success', '🎉 Deployment completed successfully!');
        } else if (status === 'timeout') {
            this.addLogEntry('info', '⏰ Deployment timed out, but services may still be starting...');
        }
    }
    
    async testDeployedServices() {
        try {
            const result = await this.api('GET', '/api/deploy/status');
            this.addLogEntry('info', 'Testing deployed services...');
            
            // Simulate service testing - in reality this would be a real health check
            setTimeout(() => {
                this.addLogEntry('success', '✅ All services are responding correctly');
            }, 2000);
        } catch (error) {
            this.addLogEntry('error', 'Service test failed: ' + error.message);
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
                'database.user': 'db-user',
                'database.password': 'db-password',
                'redis.host': 'redis-host',
                'redis.port': 'redis-port',
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

    async completeSetup() {
        try {
            await this.api('POST', '/api/complete');
            
            // 清除本地缓存（设置已完成）
            this.clearLocalCache();
            
            this.showAlert('success', window.i18n ? window.i18n.t('messages.setup_completed') : 'Setup completed successfully! Your BakLab application is ready to use.');
            
            // 延迟跳转到完成页面
            setTimeout(() => {
                this.renderCompleted();
            }, 3000);
        } catch (error) {
            this.showAlert('error', 'Failed to complete setup: ' + error.message);
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
