import { clearFormErrors, showFieldError, addFieldTouchListeners } from '../validator.js';

export function handleDomainSSLIntegration(config, i18n) {
    const sslUseSetupCertCheckbox = document.getElementById('ssl-use-setup-cert');
    const sslEnabled = document.getElementById('ssl-enabled');

    if (!sslUseSetupCertCheckbox || !sslEnabled) {
        return;
    }

    const appConfig = config.get('app');
    const sslConfig = config.get('ssl');

    if (appConfig.use_setup_domain && sslConfig.enabled) {
        sslUseSetupCertCheckbox.checked = true;
        sslUseSetupCertCheckbox.readOnly = true;
        sslUseSetupCertCheckbox.disabled = true;
        sslUseSetupCertCheckbox.dataset.autoSelected = 'true';

        const event = new Event('change');
        sslUseSetupCertCheckbox.dispatchEvent(event);

        sslConfig.use_setup_cert = true;
        config.set('ssl', sslConfig);

        const parentLabel = sslUseSetupCertCheckbox.closest('.checkbox-label');
        if (parentLabel) {
            parentLabel.style.opacity = '0.7';
            parentLabel.title = i18n ?
                i18n.t('setup.ssl.auto_selected_due_to_domain') :
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
            const noteText = i18n ?
                i18n.t('setup.ssl.auto_selected_due_to_domain') :
                'Automatically selected because you are using the setup program domain';
            autoNote.textContent = ` (${noteText})`;
        }
    } else if (!appConfig.use_setup_domain && sslUseSetupCertCheckbox.dataset.autoSelected === 'true') {
        clearSSLAutoSelection(config);
    }
}

export function clearSSLAutoSelection(config) {
    const sslUseSetupCertCheckbox = document.getElementById('ssl-use-setup-cert');
    if (sslUseSetupCertCheckbox) {
        sslUseSetupCertCheckbox.checked = false;
        sslUseSetupCertCheckbox.readOnly = false;
        sslUseSetupCertCheckbox.disabled = false;
        delete sslUseSetupCertCheckbox.dataset.autoSelected;

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

        const sslConfig = config.get('ssl');
        sslConfig.use_setup_cert = false;
        config.set('ssl', sslConfig);
    }
}

export function render(container, { config, navigation, apiClient, i18n }) {
        const ssl = config.get('ssl');
        const appConfig = config.get('app');

        container.innerHTML = `
            <form id="ssl-form" class="form-section" novalidate>
                <h3 data-i18n="setup.ssl.title"></h3>
                <p style="margin-bottom: 1.5rem; color: var(--gray-600);" data-i18n="setup.ssl.description"></p>

                <div class="alert alert-warning" style="margin-bottom: 1.5rem; color: inherit;">
                    <p style="margin: 0;" data-i18n="setup.ssl.domain_match_warning_text" data-i18n-params='{"domain":"${appConfig.domain_name || 'example.com'}"}'></p>
                </div>

                <div class="form-group">
                    <label class="checkbox-label">
                        <input type="checkbox" id="ssl-enabled" name="enabled" ${ssl.enabled ? 'checked' : ''}>
                        <span data-i18n="setup.ssl.enable_label"></span>
                    </label>
                </div>

                <div id="ssl-config" style="display: ${ssl.enabled ? 'block' : 'none'};">
                    <div class="form-group">
                        <label class="checkbox-label">
                            <input type="checkbox" id="ssl-use-setup-cert" name="use_setup_cert" ${ssl.use_setup_cert ? 'checked' : ''}>
                            <span data-i18n="setup.ssl.use_setup_cert_label"></span>
                        </label>
                        <div class="form-help" data-i18n="setup.ssl.use_setup_cert_help"></div>
                    </div>

                    <div class="form-group">
                        <label for="ssl-cert-path" data-i18n="setup.ssl.cert_path_label"></label>
                        <input type="text" id="ssl-cert-path" name="cert_path" value="${ssl.cert_path}"
                               placeholder="/path/to/certificate.crt" required>
                        <div class="invalid-feedback" style="display: none;"></div>
                        <div class="form-help" data-i18n="setup.ssl.cert_path_help"></div>
                    </div>

                    <div class="form-group">
                        <label for="ssl-key-path" data-i18n="setup.ssl.key_path_label"></label>
                        <input type="text" id="ssl-key-path" name="key_path" value="${ssl.key_path}"
                               placeholder="/path/to/private.key" required>
                        <div class="invalid-feedback" style="display: none;"></div>
                        <div class="form-help" data-i18n="setup.ssl.key_path_help"></div>
                    </div>
                </div>

                <div class="btn-group">
                    <button type="button" class="btn btn-secondary" id="ssl-prev-btn" data-i18n="common.previous"></button>
                    <button type="submit" class="btn btn-primary" data-i18n="common.next"></button>
                </div>
            </form>
        `;

        document.getElementById('ssl-prev-btn').addEventListener('click', () => {
            navigation.previousStep();
        });

        document.getElementById('ssl-enabled').addEventListener('change', (e) => {
            const configDiv = document.getElementById('ssl-config');
            const certPath = document.getElementById('ssl-cert-path');
            const keyPath = document.getElementById('ssl-key-path');

            if (e.target.checked) {
                configDiv.style.display = 'block';
                certPath.required = true;
                keyPath.required = true;

                const sslConfig = config.get('ssl');
                sslConfig.enabled = true;
                config.set('ssl', sslConfig);
                setTimeout(() => handleDomainSSLIntegration(config, i18n), 0);
            } else {
                configDiv.style.display = 'none';
                certPath.required = false;
                keyPath.required = false;
                clearFormErrors(document.getElementById('ssl-form'));

                const sslConfig = config.get('ssl');
                sslConfig.enabled = false;
                config.set('ssl', sslConfig);
                clearSSLAutoSelection(config);
            }
        });

        document.getElementById('ssl-use-setup-cert').addEventListener('change', async (e) => {
            const certPath = document.getElementById('ssl-cert-path');
            const keyPath = document.getElementById('ssl-key-path');

            if (e.target.checked) {
                try {
                    const response = await apiClient.getCurrentCertPaths();
                    if (response.data) {
                        certPath.value = response.data.cert_path;
                        keyPath.value = response.data.key_path;
                        certPath.readOnly = true;
                        keyPath.readOnly = true;
                    }
                } catch (error) {
                    console.error('Failed to get current cert paths:', error);
                    e.target.checked = false;
                }
            } else {
                certPath.readOnly = false;
                keyPath.readOnly = false;
            }
        });

        handleDomainSSLIntegration(config, i18n);

        document.getElementById('ssl-form').addEventListener('submit', async (e) => {
            e.preventDefault();

            const formData = new FormData(e.target);
            const sslConfig = {
                enabled: formData.get('enabled') === 'on',
                cert_path: formData.get('cert_path') || '',
                key_path: formData.get('key_path') || '',
                use_setup_cert: formData.get('use_setup_cert') === 'on'
            };

            let isValid = true;
            clearFormErrors(document.getElementById('ssl-form'));

            if (sslConfig.enabled) {
                if (!sslConfig.cert_path.trim()) {
                    const message = i18n ? i18n.t('setup.ssl.cert_path_required') : 'Certificate path is required when SSL is enabled';
                    showFieldError(document.getElementById('ssl-cert-path'), message);
                    isValid = false;
                } else if (!sslConfig.cert_path.startsWith('/')) {
                    const message = i18n ? i18n.t('setup.ssl.cert_path_must_be_absolute') : 'Certificate path must be an absolute path (starting with /)';
                    showFieldError(document.getElementById('ssl-cert-path'), message);
                    isValid = false;
                }

                if (!sslConfig.key_path.trim()) {
                    const message = i18n ? i18n.t('setup.ssl.key_path_required') : 'Private key path is required when SSL is enabled';
                    showFieldError(document.getElementById('ssl-key-path'), message);
                    isValid = false;
                } else if (!sslConfig.key_path.startsWith('/')) {
                    const message = i18n ? i18n.t('setup.ssl.key_path_must_be_absolute') : 'Private key path must be an absolute path (starting with /)';
                    showFieldError(document.getElementById('ssl-key-path'), message);
                    isValid = false;
                }
            }

            if (isValid) {
                config.set('ssl', sslConfig);
                await config.save();
                navigation.nextStep();
            }
        });

        addFieldTouchListeners(container);
    }
