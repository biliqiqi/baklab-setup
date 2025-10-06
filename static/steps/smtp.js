import { showValidationErrors, showFormErrors, addFieldTouchListeners } from '../validator.js';

async function testSMTPConnection(apiClient, config, ui) {
    await apiClient.protectedApiCall('testSMTP', async () => {
        const testConfig = { ...config.getAll() };

        testConfig.smtp = {
            server: document.getElementById('smtp-server').value,
            port: parseInt(document.getElementById('smtp-port').value),
            user: document.getElementById('smtp-user').value,
            password: document.getElementById('smtp-password').value,
            sender: document.getElementById('smtp-sender').value
        };

        const testBtn = document.getElementById('smtp-test-btn');
        const originalText = testBtn.textContent;
        testBtn.disabled = true;
        testBtn.textContent = window.i18n ? window.i18n.t('common.testing') : 'Testing...';

        try {
            const result = await apiClient.testConnections('smtp', testConfig);
            displayConnectionResults(result.data, 'smtp');
        } catch (error) {
            ui.showAlert('error', window.i18n ? window.i18n.t('messages.errors.failed_test_connections', {error: error.message}) : 'Connection test failed: ' + error.message);
        } finally {
            testBtn.disabled = false;
            testBtn.textContent = originalText;
        }
    }, (error) => {
        if (error.validationErrors && error.validationErrors.length > 0) {
            showValidationErrors(error.validationErrors, window.i18n);
        } else {
            ui.showAlert('error', error.message);
        }
    });
}

function displayConnectionResults(results, serviceType) {
    const containerId = 'smtp-connection-results';
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
    }
}

function addSMTPFieldListeners() {
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

    fields.forEach(fieldId => {
        const field = document.getElementById(fieldId);
        if (field) {
            field.addEventListener('input', checkFieldsComplete);
            field.addEventListener('blur', checkFieldsComplete);
        }
    });

    checkFieldsComplete();
}

export function render(container, { config, navigation, ui, apiClient }) {
        const smtp = config.get('smtp');

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
                            value="${smtp.server}"
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
                            value="${smtp.port}"
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
                        value="${smtp.user}"
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
                        value="${smtp.sender}"
                        data-i18n-placeholder="setup.smtp.sender_placeholder"
                        required
                        data-i18n-title="setup.smtp.sender_error"
                    >
                    <div class="form-help" data-i18n="setup.smtp.sender_help"></div>
                    <div class="invalid-feedback" data-i18n="setup.smtp.sender_error"></div>
                </div>

                <div id="smtp-test-connection-container">
                    <div class="form-group">
                        <button type="button" id="smtp-test-btn" class="btn btn-outline-primary" data-i18n="setup.smtp.test_connection" disabled></button>
                        <div class="form-help" data-i18n="setup.smtp.test_connection_help"></div>
                    </div>
                    <div id="smtp-connection-results" class="connection-results-container"></div>
                </div>

                <div class="btn-group">
                    <button type="button" class="btn btn-secondary" id="smtp-prev-btn" data-i18n="common.previous"></button>
                    <button type="submit" class="btn btn-primary" data-i18n="common.next"></button>
                </div>
            </form>
        `;

        document.getElementById('smtp-prev-btn').addEventListener('click', () => {
            navigation.previousStep();
        });

        const smtpPasswordField = document.getElementById('smtp-password');
        if (smtpPasswordField && smtp.password) {
            smtpPasswordField.value = smtp.password;
        }

        // 添加字段变化监听以启用测试按钮
        addSMTPFieldListeners();

        document.getElementById('smtp-form').addEventListener('submit', async (e) => {
            e.preventDefault();

            if (e.target.checkValidity()) {
                config.set('smtp', {
                    server: document.getElementById('smtp-server').value,
                    port: parseInt(document.getElementById('smtp-port').value),
                    user: document.getElementById('smtp-user').value,
                    password: document.getElementById('smtp-password').value,
                    sender: document.getElementById('smtp-sender').value
                });

                config.saveToLocalCache();
                await config.saveWithValidation();
            } else {
                showFormErrors(e.target);
            }
        });

        const smtpTestBtn = document.getElementById('smtp-test-btn');
        if (smtpTestBtn) {
            smtpTestBtn.addEventListener('click', () => testSMTPConnection(apiClient, config, ui));
        }

        addFieldTouchListeners(container);
    }

