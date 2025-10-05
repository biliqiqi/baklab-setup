import { clearSSLAutoSelection } from './ssl.js';
import { showFormErrors, addFieldTouchListeners } from '../validator.js';

function updateJWTMethodDisplay() {
    const method = document.querySelector('input[name="jwt_method"]:checked')?.value;
    const autoConfig = document.getElementById('jwt-auto-config');
    const pathConfig = document.getElementById('jwt-path-config');
    const pathInput = document.getElementById('jwt-key-path');

    if (pathInput) {
        pathInput.setCustomValidity('');
    }

    if (method === 'auto') {
        if (autoConfig) autoConfig.style.display = 'block';
        if (pathConfig) pathConfig.style.display = 'none';
        if (pathInput) {
            pathInput.required = false;
        }
    } else if (method === 'path') {
        if (autoConfig) autoConfig.style.display = 'none';
        if (pathConfig) pathConfig.style.display = 'block';
        if (pathInput) {
            pathInput.required = true;
        }
    }
}

export function render(app, container) {
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
                            value="${app.config.app.domain_name}"
                            data-i18n-placeholder="setup.app.domain_placeholder"
                            required
                            pattern="^([a-zA-Z0-9]([a-zA-Z0-9\\-]*[a-zA-Z0-9])?\\.)+[a-zA-Z]{2,}$|^localhost$"
                            data-i18n-title="setup.app.domain_error"
                            style="flex: 1;"
                        >
                        <div style="display: flex; align-items: center; gap: 3px;">
                            <input type="checkbox" id="use-setup-domain" name="use_setup_domain" ${app.config.app.use_setup_domain ? 'checked' : ''} style="margin: 0;">
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
                        value="${app.config.app.static_host_name || ''}"
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
                        value="${app.config.app.brand_name}"
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
                        <option value="latest" ${app.config.app.version === 'latest' ? 'selected' : ''}>latest</option>
                        <!-- Temporarily commented out specific versions, using latest only -->
                        <!-- <option value="v2.0.0" ${app.config.app.version === 'v2.0.0' ? 'selected' : ''}>v2.0.0</option> -->
                        <!-- <option value="v1.9.0" ${app.config.app.version === 'v1.9.0' ? 'selected' : ''}>v1.9.0</option> -->
                        <!-- <option value="v1.8.0" ${app.config.app.version === 'v1.8.0' ? 'selected' : ''}>v1.8.0</option> -->
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
                    >${app.config.app.cors_allow_origins.join('\\n')}</textarea>
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
                            <option value="en" ${app.config.app.default_lang === 'en' ? 'selected' : ''}>English</option>
                            <option value="zh-Hans" ${app.config.app.default_lang === 'zh-Hans' ? 'selected' : ''}>中文 (简体)</option>
                        </select>
                        <div class="form-help" data-i18n="setup.app.language_help"></div>
                        <div class="invalid-feedback" data-i18n="setup.app.language_error"></div>
                    </div>
                    <div class="form-group">
                        <label for="app-debug">
                            <input type="checkbox" id="app-debug" name="debug" ${app.config.app.debug ? 'checked' : ''}>
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
                                ${!app.config.app.jwt_key_from_file ? 'checked' : ''}
                                onchange="updateJWTMethodDisplay(); app.updateRadioStyles('jwt_method');"
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
                                ${app.config.app.jwt_key_from_file ? 'checked' : ''}
                                onchange="updateJWTMethodDisplay(); app.updateRadioStyles('jwt_method');"
                            >
                            <label for="jwt-method-path">
                                <span data-i18n="setup.app.jwt_method_path"></span>
                            </label>
                        </div>
                    </div>
                </div>
                
                <div id="jwt-auto-config" style="display: ${!app.config.app.jwt_key_from_file ? 'block' : 'none'};">
                    <div class="info-box">
                        <p style="color: var(--gray-600); font-size: 0.875rem; margin-bottom: 0;" data-i18n="setup.app.jwt_auto_description"></p>
                    </div>
                </div>
                
                <div id="jwt-path-config" style="display: ${app.config.app.jwt_key_from_file ? 'block' : 'none'};">
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
                            value="${app.config.app.jwt_key_file_path}"
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
                const corsText = document.getElementById('app-cors').value.trim();
                const corsOrigins = corsText ? corsText.split('\\n').map(url => url.trim()).filter(url => url) : [];

                const jwtMethod = document.querySelector('input[name="jwt_method"]:checked')?.value || 'auto';
                let jwtKeyFromFile = false;
                let jwtKeyFilePath = '';

                if (jwtMethod === 'path') {
                    jwtKeyFromFile = true;
                    jwtKeyFilePath = document.getElementById('jwt-key-path').value.trim();
                    if (!jwtKeyFilePath) {
                        const pathInput = document.getElementById('jwt-key-path');
                        pathInput.setCustomValidity(window.i18n ? window.i18n.t('setup.app.jwt_path_required') : 'JWT key file path is required');
                        pathInput.reportValidity();
                        return;
                    }
                }

                app.config.app = {
                    ...app.config.app,
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

                app.saveToLocalCache();
                await app.saveConfigWithValidation();
            } else {
                showFormErrors(e.target);
            }
        });
        
        // 初始化 JWT method 显示状态和样式
        updateJWTMethodDisplay();
        app.updateRadioStyles('jwt_method');

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
                if (app.config.ssl && app.config.ssl.enabled) {
                    app.config.ssl.use_setup_cert = true;
                    // 标记需要在SSL步骤中应用这个状态
                    app._shouldAutoSetSSLCert = true;
                }
            } else {
                domainInput.readOnly = false;
                domainInput.style.backgroundColor = '';

                // 取消域名使用时，恢复SSL证书选择的自由度
                app._shouldAutoSetSSLCert = false;

                // 更新SSL配置，取消使用设置程序证书
                app.config.ssl.use_setup_cert = false;

                // 清理当前页面的SSL自动选择状态（如果SSL步骤已渲染）
                clearSSLAutoSelection(app);
            }
            // 更新配置状态
            app.config.app.use_setup_domain = e.target.checked;

            // 立即保存配置状态到本地缓存
            app.saveToLocalCache();
        });

        // 初始化复选框状态
        const useSetupDomainCheckbox = document.getElementById('use-setup-domain');
        if (app.config.app.use_setup_domain) {
            const domainInput = document.getElementById('app-domain');
            const setupDomain = window.location.hostname;
            domainInput.value = setupDomain;
            domainInput.readOnly = true;
            domainInput.style.backgroundColor = '#f8f9fa';
        }

        addFieldTouchListeners(container);
    }

