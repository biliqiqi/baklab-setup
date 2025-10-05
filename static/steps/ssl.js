import { clearFormErrors, showFieldError, addFieldTouchListeners } from '../validator.js';

export function handleDomainSSLIntegration(app) {
    const sslUseSetupCertCheckbox = document.getElementById('ssl-use-setup-cert');
    const sslEnabled = document.getElementById('ssl-enabled');

    if (!sslUseSetupCertCheckbox || !sslEnabled) {
        return;
    }

    if (app.config.app.use_setup_domain && app.config.ssl.enabled) {
        sslUseSetupCertCheckbox.checked = true;
        sslUseSetupCertCheckbox.readOnly = true;
        sslUseSetupCertCheckbox.disabled = true;

        const event = new Event('change');
        sslUseSetupCertCheckbox.dispatchEvent(event);

        app.config.ssl.use_setup_cert = true;

        const parentLabel = sslUseSetupCertCheckbox.closest('.checkbox-label');
        if (parentLabel) {
            parentLabel.style.opacity = '0.7';
            parentLabel.title = window.i18n ?
                window.i18n.t('setup.ssl.auto_selected_due_to_domain') :
                'Automatically selected because you are using the setup program domain';

            let autoNote = parentLabel.querySelector('.auto-selection-note');
            if (!autoNote) {
                autoNote = document.createElement('span');
                autoNote.className = 'auto-selection-note';
                autoNote.style.cssText = 'font-size: 0.85em; color: var(--gray-600); margin-left: 0.5rem; font-style: italic; display: inline;';
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
    } else if (!app.config.app.use_setup_domain) {
        clearSSLAutoSelection(app);
    }
}

export function clearSSLAutoSelection(app) {
    const sslUseSetupCertCheckbox = document.getElementById('ssl-use-setup-cert');
    if (sslUseSetupCertCheckbox) {
        sslUseSetupCertCheckbox.checked = false;
        sslUseSetupCertCheckbox.readOnly = false;
        sslUseSetupCertCheckbox.disabled = false;

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

            const autoNote = parentLabel.querySelector('.auto-selection-note');
            if (autoNote) {
                autoNote.remove();
            }
        }

        app.config.ssl.use_setup_cert = false;
    }
}

export function render(app, container) {
        container.innerHTML = `
            <form id="ssl-form" class="form-section" novalidate>
                <h3 data-i18n="setup.ssl.title"></h3>
                <p style="margin-bottom: 1.5rem; color: var(--gray-600);" data-i18n="setup.ssl.description"></p>

                <div class="alert alert-warning" style="margin-bottom: 1.5rem; color: inherit;">
                    <p style="margin: 0;" data-i18n="setup.ssl.domain_match_warning_text" data-i18n-params='{"domain":"${app.config.app.domain_name || 'example.com'}"}'></p>
                </div>

                <div class="form-group">
                    <label class="checkbox-label">
                        <input type="checkbox" id="ssl-enabled" name="enabled" ${app.config.ssl.enabled ? 'checked' : ''}>
                        <span data-i18n="setup.ssl.enable_label"></span>
                    </label>
                </div>

                <div id="ssl-config" style="display: ${app.config.ssl.enabled ? 'block' : 'none'};">
                    <div class="form-group">
                        <label class="checkbox-label">
                            <input type="checkbox" id="ssl-use-setup-cert" name="use_setup_cert" ${app.config.ssl.use_setup_cert ? 'checked' : ''}>
                            <span data-i18n="setup.ssl.use_setup_cert_label"></span>
                        </label>
                        <div class="form-help" data-i18n="setup.ssl.use_setup_cert_help"></div>
                    </div>

                    <div class="form-group">
                        <label for="ssl-cert-path" data-i18n="setup.ssl.cert_path_label"></label>
                        <input type="text" id="ssl-cert-path" name="cert_path" value="${app.config.ssl.cert_path}" 
                               placeholder="/path/to/certificate.crt" required>
                        <div class="invalid-feedback" style="display: none;"></div>
                        <div class="form-help" data-i18n="setup.ssl.cert_path_help"></div>
                    </div>

                    <div class="form-group">
                        <label for="ssl-key-path" data-i18n="setup.ssl.key_path_label"></label>
                        <input type="text" id="ssl-key-path" name="key_path" value="${app.config.ssl.key_path}" 
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
                app.config.ssl.enabled = true;
                setTimeout(() => handleDomainSSLIntegration(app), 0);
            } else {
                configDiv.style.display = 'none';
                certPath.required = false;
                keyPath.required = false;
                // 清除验证错误
                clearFormErrors(document.getElementById('ssl-form'));

                // 更新配置并重置SSL证书选择的自由度
                app.config.ssl.enabled = false;
                clearSSLAutoSelection(app);
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
                            'Setup-Token': app.token
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
        handleDomainSSLIntegration(app);

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
            clearFormErrors(document.getElementById('ssl-form'));

            if (sslConfig.enabled) {
                if (!sslConfig.cert_path.trim()) {
                    const message = window.i18n ? window.i18n.t('setup.ssl.cert_path_required') : 'Certificate path is required when SSL is enabled';
                    showFieldError(document.getElementById('ssl-cert-path'), message);
                    isValid = false;
                }
                if (!sslConfig.key_path.trim()) {
                    const message = window.i18n ? window.i18n.t('setup.ssl.key_path_required') : 'Private key path is required when SSL is enabled';
                    showFieldError(document.getElementById('ssl-key-path'), message);
                    isValid = false;
                }
            }

            if (isValid) {
                app.config.ssl = sslConfig;
                await app.saveConfig();
                app.nextStep();
            }
        });

        addFieldTouchListeners(container);
    }

