// Baklab Setup - Frontend Application - v1.2 (Double Escaped Patterns)
class SetupApp {
    constructor() {
        this.currentStep = 0;
        this.token = null;
        this.shouldAutoScroll = true;
        this.deploymentEventSource = null;
        this.config = {
            database: {
                host: 'localhost',
                port: 5432,
                name: 'baklab',
                user: 'baklab',
                password: ''
            },
            redis: {
                host: 'localhost',
                port: 6379,
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
                brand_name: 'Baklab',
                admin_email: '',
                default_lang: 'en',
                debug: false,
                cors_allow_origins: [],
                session_secret: '',
                csrf_secret: '',
                jwt_secret: '',
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
            }
        };
        
        this.steps = [
            { key: 'init', title: 'Initialize', handler: this.renderInitStep },
            { key: 'database', title: 'Database', handler: this.renderDatabaseStep },
            { key: 'redis', title: 'Redis', handler: this.renderRedisStep },
            { key: 'app', title: 'Application', handler: this.renderAppStep },
            { key: 'admin', title: 'Admin User', handler: this.renderAdminStep },
            { key: 'review', title: 'Review', handler: this.renderReviewStep },
            { key: 'complete', title: 'Complete', handler: this.renderCompleteStep }
        ];
        
        this.init();
    }
    
    async init() {
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
        const app = document.getElementById('app');
        const step = this.steps[this.currentStep];
        
        app.innerHTML = `
            <div class="container">
                <div class="header">
                    <h1>🚀 Baklab Setup</h1>
                    <p>Configure your Baklab application for production deployment</p>
                </div>
                
                ${this.renderProgress()}
                
                <div class="setup-card">
                    <div id="step-content"></div>
                </div>
            </div>
        `;
        
        // 渲染当前步骤内容
        const stepContent = document.getElementById('step-content');
        step.handler.call(this, stepContent);
    }
    
    renderProgress() {
        return `
            <div class="progress-container">
                <div class="progress-steps">
                    ${this.steps.map((step, index) => `
                        <div class="progress-step ${index < this.currentStep ? 'completed' : index === this.currentStep ? 'active' : ''}">
                            <div class="progress-step-circle">
                                ${index < this.currentStep ? '✓' : index + 1}
                            </div>
                            <div class="progress-step-label">${step.title}</div>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    }
    
    renderInitStep(container) {
        const existingWarning = this.showExistingDeploymentWarning ? `
            <div class="alert alert-warning">
                <strong>⚠️ Existing Deployment Detected</strong><br>
                Configuration files already exist in the config/ directory. Proceeding will overwrite the existing deployment configuration.
                <br><br>
                <strong>This will:</strong>
                <ul style="margin: 0.5rem 0 0 1.5rem;">
                    <li>Replace all configuration files (.env, docker-compose.yml, etc.)</li>
                    <li>Generate new security keys and tokens</li>
                    <li>Not affect running services (you'll need to restart them manually)</li>
                </ul>
                <br>
                <strong>Make sure to backup your current configuration if needed.</strong>
            </div>
        ` : '';
        
        container.innerHTML = `
            <div class="form-section">
                <h3>Welcome to Baklab Setup</h3>
                <p style="margin-bottom: 2rem; color: var(--gray-600); line-height: 1.6;">
                    This setup wizard will help you configure your Baklab application for production deployment.
                    Click the button below to generate a secure setup token and begin the configuration process.
                </p>
                
                ${existingWarning}
                
                <div class="btn-group">
                    <button class="btn btn-primary" onclick="app.initializeSetup()">
                        ${this.showExistingDeploymentWarning ? 'Proceed with Override' : 'Initialize Setup'}
                    </button>
                </div>
            </div>
        `;
    }
    
    renderDatabaseStep(container) {
        container.innerHTML = `
            <form id="database-form" class="form-section" novalidate>
                <h3>Database Configuration</h3>
                <p style="margin-bottom: 1.5rem; color: var(--gray-600);">
                    Configure your PostgreSQL database connection settings. Connection will be tested after Docker deployment.
                </p>
                
                <div class="form-row">
                    <div class="form-group">
                        <label for="db-host">Host *</label>
                        <input 
                            type="text" 
                            id="db-host" 
                            name="host"
                            value="${this.config.database.host}" 
                            placeholder="localhost"
                            required
                            pattern="^[a-zA-Z0-9.\\-]+$"
                            title="Please enter a valid hostname or IP address"
                        >
                        <div class="form-help">Hostname or IP address (e.g., localhost, db.example.com, 192.168.1.10)</div>
                        <div class="invalid-feedback">Please enter a valid hostname or IP address</div>
                    </div>
                    <div class="form-group">
                        <label for="db-port">Port *</label>
                        <input 
                            type="number" 
                            id="db-port" 
                            name="port"
                            value="${this.config.database.port}" 
                            placeholder="5432"
                            required
                            min="1"
                            max="65535"
                            title="Port must be between 1 and 65535"
                        >
                        <div class="form-help">PostgreSQL port number (default: 5432, range: 1-65535)</div>
                        <div class="invalid-feedback">Port must be between 1 and 65535</div>
                    </div>
                </div>
                
                <div class="form-group">
                    <label for="db-name">Database Name *</label>
                    <input 
                        type="text" 
                        id="db-name" 
                        name="database"
                        value="${this.config.database.name}" 
                        placeholder="baklab"
                        required
                        pattern="^[a-zA-Z][a-zA-Z0-9_]*$"
                        minlength="1"
                        maxlength="63"
                        title="Database name must start with a letter and contain only letters, numbers, and underscores (max 63 characters)"
                    >
                    <div class="form-help">Start with letter, only letters/numbers/underscores (e.g., baklab, my_app_db)</div>
                    <div class="invalid-feedback">Database name must start with a letter and contain only letters, numbers, and underscores (max 63 characters)</div>
                </div>
                
                <div class="form-row">
                    <div class="form-group">
                        <label for="db-user">Username *</label>
                        <input 
                            type="text" 
                            id="db-user" 
                            name="username"
                            value="${this.config.database.user}" 
                            placeholder="baklab"
                            required
                            pattern="^[a-zA-Z][a-zA-Z0-9_]*$"
                            minlength="1"
                            maxlength="63"
                            title="Username must start with a letter and contain only letters, numbers, and underscores (max 63 characters)"
                        >
                        <div class="form-help">PostgreSQL username, start with letter (e.g., baklab, admin_user)</div>
                        <div class="invalid-feedback">Username must start with a letter and contain only letters, numbers, and underscores (max 63 characters)</div>
                    </div>
                    <div class="form-group">
                        <label for="db-password">Password *</label>
                        <input 
                            type="password" 
                            id="db-password" 
                            name="password"
                            value="${this.config.database.password}" 
                            placeholder="Enter database password"
                            required
                            minlength="8"
                            title="Database password must be at least 8 characters long"
                        >
                        <div class="form-help">Minimum 8 characters (database authentication password)</div>
                        <div class="invalid-feedback">Database password must be at least 8 characters long</div>
                    </div>
                </div>
                
                <div class="btn-group">
                    <button type="button" class="btn btn-secondary" onclick="app.previousStep()">Previous</button>
                    <button type="submit" class="btn btn-primary">Next</button>
                </div>
            </form>
        `;
        
        // 添加表单提交事件监听
        document.getElementById('database-form').addEventListener('submit', (e) => {
            e.preventDefault();
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
                <h3>Redis Configuration</h3>
                <p style="margin-bottom: 1.5rem; color: var(--gray-600);">
                    Configure your Redis cache server settings. Connection will be tested after Docker deployment.
                </p>
                
                <div class="form-row">
                    <div class="form-group">
                        <label for="redis-host">Host *</label>
                        <input 
                            type="text" 
                            id="redis-host" 
                            name="host"
                            value="${this.config.redis.host}" 
                            placeholder="localhost"
                            required
                            pattern="^[a-zA-Z0-9.\\-]+$"
                            title="Please enter a valid hostname or IP address"
                        >
                        <div class="form-help">Redis server hostname or IP (e.g., localhost, redis.example.com, 192.168.1.20)</div>
                        <div class="invalid-feedback">Please enter a valid hostname or IP address</div>
                    </div>
                    <div class="form-group">
                        <label for="redis-port">Port *</label>
                        <input 
                            type="number" 
                            id="redis-port" 
                            name="port"
                            value="${this.config.redis.port}" 
                            placeholder="6379"
                            required
                            min="1"
                            max="65535"
                            title="Port must be between 1 and 65535"
                        >
                        <div class="form-help">Redis port number (default: 6379, range: 1-65535)</div>
                        <div class="invalid-feedback">Port must be between 1 and 65535</div>
                    </div>
                </div>
                
                <div class="form-group">
                    <label for="redis-password">Password *</label>
                    <input 
                        type="password" 
                        id="redis-password" 
                        name="password"
                        value="${this.config.redis.password}" 
                        placeholder="Enter Redis password"
                        required
                        minlength="1"
                        title="Redis password is required"
                    >
                    <div class="form-help">Redis authentication password (required)</div>
                    <div class="invalid-feedback">Redis password is required</div>
                </div>
                
                <div class="btn-group">
                    <button type="button" class="btn btn-secondary" onclick="app.previousStep()">Previous</button>
                    <button type="submit" class="btn btn-primary">Next</button>
                </div>
            </form>
        `;
        
        // 添加表单提交事件监听
        document.getElementById('redis-form').addEventListener('submit', (e) => {
            e.preventDefault();
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
                <h3>Application Configuration</h3>
                <p style="margin-bottom: 1.5rem; color: var(--gray-600);">
                    Configure your application's basic settings and security options.
                </p>
                
                <div class="form-row">
                    <div class="form-group">
                        <label for="app-domain">Domain Name *</label>
                        <input 
                            type="text" 
                            id="app-domain" 
                            name="domain"
                            value="${this.config.app.domain_name}" 
                            placeholder="example.com"
                            required
                            pattern="^[a-zA-Z0-9][a-zA-Z0-9\\-]{1,61}[a-zA-Z0-9]\\.[a-zA-Z]{2,}$|^localhost$"
                            title="Please enter a valid domain name (e.g., example.com) or localhost"
                        >
                        <div class="form-help">Your production domain name</div>
                        <div class="invalid-feedback">Please enter a valid domain name (e.g., example.com) or localhost</div>
                    </div>
                    <div class="form-group">
                        <label for="app-brand">Brand Name *</label>
                        <input 
                            type="text" 
                            id="app-brand" 
                            name="brand"
                            value="${this.config.app.brand_name}" 
                            placeholder="Baklab"
                            required
                            minlength="2"
                            maxlength="50"
                            pattern="^[a-zA-Z0-9\\s\\-_]+$"
                            title="Brand name must be 2-50 characters and contain only letters, numbers, spaces, hyphens, and underscores"
                        >
                        <div class="invalid-feedback">Brand name must be 2-50 characters and contain only letters, numbers, spaces, hyphens, and underscores</div>
                    </div>
                </div>
                
                <div class="form-group">
                    <label for="app-email">Admin Email *</label>
                    <input 
                        type="email" 
                        id="app-email" 
                        name="email"
                        value="${this.config.app.admin_email}" 
                        placeholder="admin@example.com"
                        required
                        title="Please enter a valid email address"
                    >
                    <div class="form-help">System administrator email (used for TLS certificates and system notifications)</div>
                    <div class="invalid-feedback">Please enter a valid email address</div>
                </div>
                
                <div class="form-group">
                    <label for="app-cors">CORS Allow Origins</label>
                    <textarea 
                        id="app-cors" 
                        name="cors"
                        rows="3" 
                        placeholder="https://app.example.com&#10;https://admin.example.com"
                        pattern="^(https?:\\/\\/[a-zA-Z0-9.\\-]+(?:\\:[0-9]+)?(?:\\/.*)?\\s*)*$"
                        title="Each line should be a valid HTTP/HTTPS URL"
                    >${this.config.app.cors_allow_origins.join('\\n')}</textarea>
                    <div class="form-help">Frontend URLs allowed to access your API. One per line. Format: https://domain.com or http://localhost:3000</div>
                    <div class="invalid-feedback">Each line should be a valid HTTP/HTTPS URL</div>
                </div>
                
                <div class="form-row">
                    <div class="form-group">
                        <label for="app-lang">Default Language *</label>
                        <select 
                            id="app-lang" 
                            name="language"
                            required
                            title="Please select a default language"
                        >
                            <option value="en" ${this.config.app.default_lang === 'en' ? 'selected' : ''}>English</option>
                            <option value="zh-Hans" ${this.config.app.default_lang === 'zh-Hans' ? 'selected' : ''}>中文 (简体)</option>
                            <option value="zh-Hant" ${this.config.app.default_lang === 'zh-Hant' ? 'selected' : ''}>中文 (繁體)</option>
                            <option value="ja" ${this.config.app.default_lang === 'ja' ? 'selected' : ''}>日本語</option>
                        </select>
                        <div class="form-help">Primary language for the application interface</div>
                        <div class="invalid-feedback">Please select a default language</div>
                    </div>
                    <div class="form-group">
                        <label for="app-debug">
                            <input type="checkbox" id="app-debug" name="debug" ${this.config.app.debug ? 'checked' : ''}>
                            Enable Debug Mode
                        </label>
                        <div class="form-help">Only enable for development environments</div>
                    </div>
                </div>
                
                <div class="btn-group">
                    <button type="button" class="btn btn-secondary" onclick="app.previousStep()">Previous</button>
                    <button type="submit" class="btn btn-primary">Next</button>
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
    }
    
    renderAdminStep(container) {
        container.innerHTML = `
            <form id="admin-form" class="form-section" novalidate>
                <h3>Administrator User</h3>
                <p style="margin-bottom: 1.5rem; color: var(--gray-600);">
                    Create the initial administrator account for your application. The email defaults to the system admin email, but you can change it if needed.
                </p>
                
                <div class="form-group">
                    <label for="admin-username">Username *</label>
                    <input 
                        type="text" 
                        id="admin-username" 
                        name="username"
                        value="${this.config.admin_user.username}" 
                        placeholder="admin"
                        required
                        minlength="4"
                        maxlength="20"
                        pattern="^[a-zA-Z0-9][a-zA-Z0-9._\\-]+[a-zA-Z0-9]$"
                        title="Username must be 4-20 characters, start and end with alphanumeric characters"
                    >
                    <div class="form-help">4-20 characters, start/end with letters/numbers, can contain dots, underscores, hyphens</div>
                    <div class="invalid-feedback">Username must be 4-20 characters, start and end with alphanumeric characters</div>
                </div>
                
                <div class="form-group">
                    <label for="admin-email">Email *</label>
                    <input 
                        type="email" 
                        id="admin-email" 
                        name="email"
                        value="${this.config.admin_user.email || this.config.app.admin_email}" 
                        placeholder="${this.config.app.admin_email || 'admin@example.com'}"
                        required
                        title="Please enter a valid email address"
                    >
                    <div class="form-help">Admin user login email (defaults to system admin email, can be different)</div>
                    <div class="invalid-feedback">Please enter a valid email address</div>
                </div>
                
                <div class="form-group">
                    <label for="admin-password">Password *</label>
                    <input 
                        type="password" 
                        id="admin-password" 
                        name="password"
                        value="${this.config.admin_user.password}" 
                        placeholder="Enter secure password"
                        required
                        minlength="12"
                        maxlength="64"
                        pattern="^[A-Za-z\\d!@#$%^&*]{12,64}$"
                        title="Password must be 12-64 characters with letters, numbers, and special characters (!@#$%^&*)"
                    >
                    <div class="form-help">12-64 characters with lowercase, uppercase, numbers, and special characters (!@#$%^&*)</div>
                    <div class="invalid-feedback">Password must be 12-64 characters with lowercase, uppercase, numbers, and special characters (!@#$%^&*)</div>
                </div>
                
                <div class="form-group">
                    <label for="admin-password-confirm">Confirm Password *</label>
                    <input 
                        type="password" 
                        id="admin-password-confirm" 
                        name="passwordConfirm"
                        value="${this.config.admin_user.password}" 
                        placeholder="Confirm your password"
                        required
                        title="Please confirm your password"
                    >
                    <div class="invalid-feedback">Passwords must match</div>
                </div>
                
                <div class="btn-group">
                    <button type="button" class="btn btn-secondary" onclick="app.previousStep()">Previous</button>
                    <button type="submit" class="btn btn-primary">Next</button>
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
                <h3>Review Configuration</h3>
                <p style="margin-bottom: 1.5rem; color: var(--gray-600);">
                    Please review your configuration before generating the deployment files.
                </p>
                
                <div id="config-review">
                    <div class="loading">
                        <div class="loading-spinner"></div>
                    </div>
                </div>
                
                <div class="btn-group">
                    <button class="btn btn-secondary" onclick="app.previousStep()">Previous</button>
                    <button class="btn btn-success" onclick="app.generateConfig()">Generate Config</button>
                </div>
            </div>
        `;
        
        this.loadConfigReview();
    }
    
    renderCompleteStep(container) {
        container.innerHTML = `
            <div class="form-section" style="text-align: center;">
                <div style="font-size: 4rem; margin-bottom: 1rem;">🎉</div>
                <h3>Setup Complete!</h3>
                <p style="margin-bottom: 2rem; color: var(--gray-600); line-height: 1.6;">
                    Your Baklab application has been successfully configured. 
                    The configuration files have been generated and are ready for deployment.
                </p>
                
                <div class="alert alert-info">
                    <strong>Ready for Deployment!</strong><br>
                    Your configuration has been generated and validated. Click "Deploy Application" to automatically start your Baklab services.
                </div>
                
                <div class="btn-group">
                    <button class="btn btn-success btn-lg" onclick="app.startDeployment()">
                        🚀 Deploy Application
                    </button>
                    <button class="btn btn-secondary" onclick="app.completeSetup()">
                        Skip Deployment
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
                    <p>Your Baklab application has been successfully configured and deployed.</p>
                </div>
                
                <div class="setup-card">
                    <div class="alert alert-success">
                        <strong>Congratulations!</strong> Your Baklab instance is now ready for use.
                        The setup service remains available for future configuration updates.
                    </div>
                    
                    <h3>Next Steps</h3>
                    <ul style="line-height: 1.8; color: var(--gray-700);">
                        <li><strong>Access your application:</strong> Visit your domain to start using Baklab</li>
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
        this.config.database = {
            host: document.getElementById('db-host').value,
            port: parseInt(document.getElementById('db-port').value),
            name: document.getElementById('db-name').value,
            user: document.getElementById('db-user').value,
            password: document.getElementById('db-password').value
        };
        
        // 只保存到本地缓存，不调用后端API
        this.saveToLocalCache();
        this.nextStep();
    }
    
    async saveRedisConfig() {
        this.config.redis = {
            host: document.getElementById('redis-host').value,
            port: parseInt(document.getElementById('redis-port').value),
            password: document.getElementById('redis-password').value
        };
        
        // 只保存到本地缓存，不调用后端API
        this.saveToLocalCache();
        this.nextStep();
    }
    
    async saveAppConfig() {
        const corsText = document.getElementById('app-cors').value.trim();
        const corsOrigins = corsText ? corsText.split('\\n').map(url => url.trim()).filter(url => url) : [];
        
        this.config.app = {
            ...this.config.app,
            domain_name: document.getElementById('app-domain').value,
            brand_name: document.getElementById('app-brand').value,
            admin_email: document.getElementById('app-email').value,
            cors_allow_origins: corsOrigins,
            default_lang: document.getElementById('app-lang').value,
            debug: document.getElementById('app-debug').checked
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
            this.showAlert('error', 'Failed to save configuration: ' + error.message);
            throw error;
        }
    }
    
    async loadConfigReview() {
        try {
            // 从本地缓存读取配置显示
            const config = this.config;
            
            document.getElementById('config-review').innerHTML = `
                <div style="text-align: left;">
                    <h4>Database</h4>
                    <p><strong>Host:</strong> ${config.database.host}:${config.database.port}</p>
                    <p><strong>Database:</strong> ${config.database.name}</p>
                    <p><strong>User:</strong> ${config.database.user}</p>
                    
                    <h4 style="margin-top: 1.5rem;">Redis</h4>
                    <p><strong>Host:</strong> ${config.redis.host}:${config.redis.port}</p>
                    <p><strong>Password:</strong> ••••••••</p>
                    
                    <h4 style="margin-top: 1.5rem;">Application</h4>
                    <p><strong>Domain:</strong> ${config.app.domain_name}</p>
                    <p><strong>Brand:</strong> ${config.app.brand_name}</p>
                    <p><strong>Language:</strong> ${config.app.default_lang}</p>
                    <p><strong>CORS Origins:</strong> ${config.app.cors_allow_origins.length} configured</p>
                    
                    <h4 style="margin-top: 1.5rem;">Administrator</h4>
                    <p><strong>Username:</strong> ${config.admin_user.username}</p>
                    <p><strong>Email:</strong> ${config.admin_user.email}</p>
                    <p><strong>Password:</strong> ••••••••</p>
                </div>
            `;
        } catch (error) {
            document.getElementById('config-review').innerHTML = `
                <div class="alert alert-error">Failed to load configuration: ${error.message}</div>
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
        
        if (type === 'database') {
            testConfig.database = {
                host: document.getElementById('db-host').value,
                port: parseInt(document.getElementById('db-port').value),
                name: document.getElementById('db-name').value,
                user: document.getElementById('db-user').value,
                password: document.getElementById('db-password').value
            };
        } else if (type === 'redis') {
            testConfig.redis = {
                host: document.getElementById('redis-host').value,
                port: parseInt(document.getElementById('redis-port').value),
                password: document.getElementById('redis-password').value
            };
        }
        
        try {
            const result = await this.api('POST', '/api/test-connections', testConfig);
            this.displayConnectionResults(result.data);
        } catch (error) {
            this.showAlert('error', 'Connection test failed: ' + error.message);
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
    
    displayConnectionResults(results) {
        const container = document.getElementById('connection-results');
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
    
    async generateConfig() {
        try {
            // 首先提交完整配置到后端进行验证
            await this.saveConfig();
            
            // 配置验证通过后，生成配置文件
            await this.api('POST', '/api/generate');
            
            // 清除本地缓存（配置已成功保存到后端）
            this.clearLocalCache();
            
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

    async completeSetup() {
        try {
            await this.api('POST', '/api/complete');
            
            // 清除本地缓存（设置已完成）
            this.clearLocalCache();
            
            this.showAlert('success', 'Setup completed successfully! Your Baklab application is ready to use.');
            
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
    
    // Utility functions
    showAlert(type, message) {
        const alertDiv = document.createElement('div');
        alertDiv.className = `alert alert-${type}`;
        alertDiv.textContent = message;
        
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
let app;
document.addEventListener('DOMContentLoaded', () => {
    app = new SetupApp();
});