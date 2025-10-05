import { showFormErrors, clearFormErrors, addFieldTouchListeners } from '../validator.js';

function updateFrontendOriginVisibility() {
    const googleEnabled = document.getElementById('google-enabled').checked;
    const githubEnabled = document.getElementById('github-enabled').checked;
    const frontendOriginSection = document.getElementById('frontend-origin-section');

    if (frontendOriginSection) {
        frontendOriginSection.style.display = (googleEnabled || githubEnabled) ? 'block' : 'none';
    }
}

export function render(app, container) {
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
                            <input type="checkbox" id="google-enabled" name="google_enabled" ${app.config.oauth.google_enabled ? 'checked' : ''}>
                            <span data-i18n="setup.oauth.google_enable_label"></span>
                        </label>
                    </div>
                    <div id="google-config" style="display: ${app.config.oauth.google_enabled ? 'block' : 'none'};">
                        <div class="form-row">
                            <div class="form-group">
                                <label for="google-client-id"><span data-i18n="setup.oauth.google_client_id_label"></span> <span data-i18n="common.required"></span></label>
                                <input
                                    type="text"
                                    id="google-client-id"
                                    name="google_client_id"
                                    value="${app.config.oauth.google_client_id}"
                                    data-i18n-placeholder="setup.oauth.google_client_id_placeholder"
                                    ${app.config.oauth.google_enabled ? 'required' : ''}
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
                                    ${app.config.oauth.google_enabled ? 'required' : ''}
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
                            <input type="checkbox" id="github-enabled" name="github_enabled" ${app.config.oauth.github_enabled ? 'checked' : ''}>
                            <span data-i18n="setup.oauth.github_enable_label"></span>
                        </label>
                    </div>
                    <div id="github-config" style="display: ${app.config.oauth.github_enabled ? 'block' : 'none'};">
                        <div class="form-row">
                            <div class="form-group">
                                <label for="github-client-id"><span data-i18n="setup.oauth.github_client_id_label"></span> <span data-i18n="common.required"></span></label>
                                <input
                                    type="text"
                                    id="github-client-id"
                                    name="github_client_id"
                                    value="${app.config.oauth.github_client_id}"
                                    data-i18n-placeholder="setup.oauth.github_client_id_placeholder"
                                    ${app.config.oauth.github_enabled ? 'required' : ''}
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
                                    ${app.config.oauth.github_enabled ? 'required' : ''}
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
                <div id="frontend-origin-section" style="display: ${app.config.oauth.google_enabled || app.config.oauth.github_enabled ? 'block' : 'none'}; margin-top: 2rem;">
                    <h4 style="margin: 1.5rem 0 1rem 0; color: var(--gray-700);" data-i18n="setup.oauth.frontend_origin_title"></h4>
                    <div class="form-group">
                        <label for="frontend-origin"><span data-i18n="setup.oauth.frontend_origin_label"></span></label>
                        <input
                            type="url"
                            id="frontend-origin"
                            name="frontend_origin"
                            value="${app.config.oauth.frontend_origin || (app.config.ssl?.enabled ? 'https://' : 'http://') + app.config.app.domain_name}"
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
                clearFormErrors(document.getElementById('oauth-form'));
            }
            // 更新前端源配置显示
            updateFrontendOriginVisibility();
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
                clearFormErrors(document.getElementById('oauth-form'));
            }
            // 更新前端源配置显示
            updateFrontendOriginVisibility();
        });

        // 安全地设置密码字段值，避免HTML转义问题
        const googleClientSecretField = document.getElementById('google-client-secret');
        if (googleClientSecretField && app.config.oauth.google_client_secret) {
            googleClientSecretField.value = app.config.oauth.google_client_secret;
        }
        const githubClientSecretField = document.getElementById('github-client-secret');
        if (githubClientSecretField && app.config.oauth.github_client_secret) {
            githubClientSecretField.value = app.config.oauth.github_client_secret;
        }

        // 表单提交处理
        document.getElementById('oauth-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            if (e.target.checkValidity()) {
                app.config.oauth = {
                    google_enabled: document.getElementById('google-enabled').checked,
                    google_client_id: document.getElementById('google-client-id').value.trim(),
                    google_client_secret: document.getElementById('google-client-secret').value.trim(),
                    github_enabled: document.getElementById('github-enabled').checked,
                    github_client_id: document.getElementById('github-client-id').value.trim(),
                    github_client_secret: document.getElementById('github-client-secret').value.trim(),
                    frontend_origin: document.getElementById('frontend-origin').value.trim()
                };

                app.saveToLocalCache();
                await app.saveConfigWithValidation();
            } else {
                showFormErrors(e.target);
            }
        });

        addFieldTouchListeners(container);
    }

