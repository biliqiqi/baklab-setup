import { validateDatabasePasswordStrength, validateExternalServicePassword, showValidationErrors, hideCustomError, showCustomError, showFormErrors, addFieldTouchListeners } from '../validator.js';

async function testDatabaseConnection(apiClient, config, ui, i18n) {
    await apiClient.protectedApiCall('testDatabase', async () => {
        const testConfig = { ...config.getAll() };
        const serviceType = document.querySelector('input[name="db-service-type"]:checked').value;

        testConfig.database = {
            service_type: serviceType,
            host: document.getElementById('db-host').value,
            port: parseInt(document.getElementById('db-port').value),
            name: document.getElementById('db-name').value,
            app_user: document.getElementById('db-app-user').value,
            app_password: document.getElementById('db-app-password').value
        };

        if (serviceType === 'docker') {
            testConfig.database.super_user = document.getElementById('db-super-user').value;
            testConfig.database.super_password = document.getElementById('db-super-password').value;
        } else {
            testConfig.database.super_user = '';
            testConfig.database.super_password = '';
        }

        const testBtn = document.getElementById('db-test-btn');
        const originalText = testBtn.textContent;
        testBtn.disabled = true;
        testBtn.textContent = i18n ? i18n.t('common.testing') : 'Testing...';

        try {
            const result = await apiClient.testConnections('database', testConfig);
            displayConnectionResults(result.data, 'database');
        } catch (error) {
            ui.showAlert('error', i18n ? i18n.t('messages.errors.failed_test_connections', {error: error.message}) : 'Connection test failed: ' + error.message);
        } finally {
            testBtn.disabled = false;
            testBtn.textContent = originalText;
        }
    }, (error) => {
        if (error.validationErrors && error.validationErrors.length > 0) {
            showValidationErrors(error.validationErrors, i18n);
        } else {
            ui.showAlert('error', error.message);
        }
    });
}

function displayConnectionResults(results, serviceType) {
    const containerId = 'db-connection-results';
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

function toggleHelpText(fieldId, show) {
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

function updateDatabaseHostField(serviceType) {
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
        toggleHelpText('db-app-user', true);
        toggleHelpText('db-app-password', true);

        if (appUserField) {
            appUserField.setCustomValidity('');
            hideCustomError(appUserField);
        }
        if (appPasswordField) {
            appPasswordField.setCustomValidity('');
            hideCustomError(appPasswordField);
        }
        if (superUserField) {
            superUserField.setCustomValidity('');
            hideCustomError(superUserField);
        }
        if (superPasswordField) {
            superPasswordField.setCustomValidity('');
            hideCustomError(superPasswordField);
        }
    } else {
        hostField.readOnly = false;
        hostField.style.backgroundColor = '';
        if (testConnectionContainer) {
            testConnectionContainer.style.display = 'block';
        }
        if (superUserConfig) {
            superUserConfig.style.display = 'none';
        }
        if (superUserField) {
            superUserField.required = false;
            superUserField.disabled = true;
        }
        if (superPasswordField) {
            superPasswordField.required = false;
            superPasswordField.disabled = true;
        }
        if (appUserField) {
            appUserField.minLength = 1;
            appUserField.maxLength = 128;
            appUserField.pattern = '';
            appUserField.removeAttribute('pattern');
        }
        if (appPasswordField) {
            appPasswordField.minLength = 1;
            appPasswordField.maxLength = 128;
            appPasswordField.pattern = '';
            appPasswordField.removeAttribute('pattern');
        }
        toggleHelpText('db-app-user', false);
        toggleHelpText('db-app-password', false);

        if (appUserField) {
            appUserField.setCustomValidity('');
            hideCustomError(appUserField);
        }
        if (appPasswordField) {
            appPasswordField.setCustomValidity('');
            hideCustomError(appPasswordField);
        }
        if (superUserField) {
            superUserField.setCustomValidity('');
            hideCustomError(superUserField);
        }
        if (superPasswordField) {
            superPasswordField.setCustomValidity('');
            hideCustomError(superPasswordField);
        }
    }

    if (dbForm) {
        const inputs = dbForm.querySelectorAll('input, select, textarea');
        inputs.forEach(input => {
            if (input.style.display !== 'none' && !input.closest('[style*="display: none"]')) {
                input.setCustomValidity('');
            }
        });

        dbForm.noValidate = true;
        setTimeout(() => {
            dbForm.noValidate = false;
        }, 10);
    }
}

export function render(container, { config, navigation, ui, apiClient, i18n }) {
    const database = config.get('database');

    container.innerHTML = `
        <form id="database-form" class="form-section" novalidate>
            <h3 data-i18n="setup.database.title"></h3>
            <p style="margin-bottom: 1.5rem; color: var(--gray-600);" data-i18n="setup.database.description"></p>

            <div class="form-group">
                <label class="form-label"><span data-i18n="setup.database.service_type_label"></span> <span data-i18n="common.required"></span></label>
                <div class="radio-group">
                    <label class="radio-option">
                        <input type="radio" name="db-service-type" value="docker" ${database.service_type === 'docker' ? 'checked' : ''}>
                        <div>
                            <span data-i18n="setup.database.service_type_docker"></span>
                        </div>
                    </label>
                    <label class="radio-option">
                        <input type="radio" name="db-service-type" value="external" ${database.service_type === 'external' ? 'checked' : ''}>
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
                        value="${database.host}"
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
                        value="${database.port}"
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
                    value="${database.name}"
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

            <div id="db-super-user-config" style="background: var(--gray-50); padding: 1rem; border-radius: 8px; margin-bottom: 1.5rem;">
                <h4 style="margin: 0 0 1rem 0; color: var(--gray-700); font-size: 1rem;" data-i18n="setup.database.super_user_title"></h4>
                <div class="form-row">
                    <div class="form-group">
                        <label for="db-super-user"><span data-i18n="setup.database.super_username_label"></span> <span data-i18n="common.required"></span></label>
                        <input
                            type="text"
                            id="db-super-user"
                            name="super_username"
                            value="${database.super_user || 'baklab_super'}"
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

            <div style="background: var(--gray-50); padding: 1rem; border-radius: 8px; margin-bottom: 1.5rem;">
                <h4 style="margin: 0 0 1rem 0; color: var(--gray-700); font-size: 1rem;" data-i18n="setup.database.app_user_title"></h4>
                <div class="form-row">
                    <div class="form-group">
                        <label for="db-app-user"><span data-i18n="setup.database.app_username_label"></span> <span data-i18n="common.required"></span></label>
                        <input
                            type="text"
                            id="db-app-user"
                            name="app_username"
                            value="${database.app_user || 'baklab'}"
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
                    <button type="button" id="db-test-btn" class="btn btn-outline-primary" data-i18n="setup.database.test_connection"></button>
                </div>
                <div id="db-connection-results" class="connection-results-container"></div>
            </div>

            <div class="btn-group">
                <button type="button" class="btn btn-secondary" id="db-prev-btn" data-i18n="common.previous"></button>
                <button type="submit" class="btn btn-primary" data-i18n="common.next"></button>
            </div>
        </form>
    `;

    document.getElementById('db-prev-btn').addEventListener('click', () => {
        navigation.previousStep();
    });

    const serviceTypeRadios = document.querySelectorAll('input[name="db-service-type"]');
    serviceTypeRadios.forEach(radio => {
        radio.addEventListener('change', (e) => {
            updateDatabaseHostField(e.target.value);
            ui.updateRadioStyles('db-service-type');
            setTimeout(() => validateDuplicates(), 10);
        });
    });

    updateDatabaseHostField(database.service_type);
    ui.updateRadioStyles('db-service-type');

    setTimeout(() => {
        updateDatabaseHostField(database.service_type);
    }, 100);

    const validateDuplicates = () => {
        const serviceType = document.querySelector('input[name="db-service-type"]:checked').value;
        const appUserField = document.getElementById('db-app-user');
        const appPasswordField = document.getElementById('db-app-password');

        if (serviceType === 'docker') {
            const superUser = document.getElementById('db-super-user').value;
            const appUser = document.getElementById('db-app-user').value;
            const superPassword = document.getElementById('db-super-password').value;
            const appPassword = document.getElementById('db-app-password').value;

            if (superUser === appUser && superUser !== '' && appUser !== '') {
                const errorMsg = i18n ? i18n.t('setup.database.username_duplicate_error') : 'Application username must be different from super user username';
                appUserField.setCustomValidity(errorMsg);
                showCustomError(appUserField, errorMsg);
            } else {
                appUserField.setCustomValidity('');
                hideCustomError(appUserField);
            }
        } else {
            appUserField.setCustomValidity('');
            hideCustomError(appUserField);
        }

        if (serviceType === 'docker') {
            const superPassword = document.getElementById('db-super-password').value;
            const appPassword = document.getElementById('db-app-password').value;

            if (superPassword === appPassword && superPassword !== '' && appPassword !== '') {
                const errorMsg = i18n ? i18n.t('setup.database.password_duplicate_error') : 'Application password must be different from super user password';
                appPasswordField.setCustomValidity(errorMsg);
                showCustomError(appPasswordField, errorMsg);
                return;
            }
        }

        const superPasswordField = document.getElementById('db-super-password');
        const superPassword = document.getElementById('db-super-password').value;
        if (serviceType === 'docker' && superPassword) {
            const isValid = validateDatabasePasswordStrength(superPassword);
            const errorMsg = i18n ? i18n.t('setup.database.super_password_error') :
                'Super password must be 12-64 characters with at least 3 types: lowercase, uppercase, numbers, special characters (!@#$%^&*)';

            if (!isValid) {
                superPasswordField.setCustomValidity(errorMsg);
                showCustomError(superPasswordField, errorMsg);
            } else {
                superPasswordField.setCustomValidity('');
                hideCustomError(superPasswordField);
            }
        } else if (superPassword === '' || serviceType !== 'docker') {
            superPasswordField.setCustomValidity('');
            hideCustomError(superPasswordField);
        }

        const appPassword = document.getElementById('db-app-password').value;
        if (appPassword) {
            let isValid = true;
            let errorMsg = '';

            if (serviceType === 'docker') {
                isValid = validateDatabasePasswordStrength(appPassword);
                errorMsg = i18n ? i18n.t('setup.database.app_password_error') :
                    'App password must be 12-64 characters with at least 3 types: lowercase, uppercase, numbers, special characters (!@#$%^&*)';
            } else {
                isValid = validateExternalServicePassword(appPassword);
                errorMsg = i18n ? i18n.t('setup.database.app_password_external_error') :
                    'App password must be 1-128 characters and cannot contain control characters';
            }

            if (!isValid) {
                appPasswordField.setCustomValidity(errorMsg);
                showCustomError(appPasswordField, errorMsg);
            } else {
                appPasswordField.setCustomValidity('');
                hideCustomError(appPasswordField);
            }
        } else if (appPassword === '') {
            appPasswordField.setCustomValidity('');
            hideCustomError(appPasswordField);
        }
    };

    const dbSuperPasswordField = document.getElementById('db-super-password');
    if (dbSuperPasswordField && database.super_password) {
        dbSuperPasswordField.value = database.super_password;
    }
    const dbAppPasswordField = document.getElementById('db-app-password');
    if (dbAppPasswordField && database.app_password) {
        dbAppPasswordField.value = database.app_password;
    }

    ['db-super-user', 'db-app-user', 'db-super-password', 'db-app-password'].forEach(id => {
        const field = document.getElementById(id);
        if (field) {
            field.addEventListener('input', validateDuplicates);
        }
    });

    document.getElementById('database-form').addEventListener('submit', async (e) => {
        e.preventDefault();

        const serviceType = document.querySelector('input[name="db-service-type"]:checked').value;

        const superPassword = document.getElementById('db-super-password').value;
        const appPassword = document.getElementById('db-app-password').value;
        const superPasswordField = document.getElementById('db-super-password');
        const appPasswordField = document.getElementById('db-app-password');

        if (serviceType === 'docker') {
            if (superPassword && !validateDatabasePasswordStrength(superPassword)) {
                const errorMsg = i18n ? i18n.t('setup.database.super_password_error') : 'Super password must be 12-64 characters with at least 3 types: lowercase, uppercase, numbers, special characters (!@#$%^&*)';
                superPasswordField.setCustomValidity(errorMsg);
            } else {
                superPasswordField.setCustomValidity('');
            }
        } else {
            if (superPasswordField) {
                superPasswordField.setCustomValidity('');
            }
        }

        if (appPassword) {
            let isValid = true;
            let errorMsg = '';

            if (serviceType === 'docker') {
                isValid = validateDatabasePasswordStrength(appPassword);
                errorMsg = i18n ? i18n.t('setup.database.app_password_error') : 'App password must be 12-64 characters with at least 3 types: lowercase, uppercase, numbers, special characters (!@#$%^&*)';
            } else {
                isValid = validateExternalServicePassword(appPassword);
                errorMsg = i18n ? i18n.t('setup.database.app_password_external_error') : 'App password must be 1-128 characters and cannot contain control characters';
            }

            if (!isValid) {
                appPasswordField.setCustomValidity(errorMsg);
            } else {
                appPasswordField.setCustomValidity('');
            }
        } else {
            appPasswordField.setCustomValidity('');
        }

        if (serviceType === 'docker') {
            const superUser = document.getElementById('db-super-user').value;
            const appUser = document.getElementById('db-app-user').value;
            const appUserField = document.getElementById('db-app-user');

            if (superUser === appUser && superUser !== '') {
                const errorMsg = i18n ? i18n.t('setup.database.username_duplicate_error') : 'Application username must be different from super user username';
                appUserField.setCustomValidity(errorMsg);
            } else {
                appUserField.setCustomValidity('');
            }

            if (superPassword === appPassword && superPassword !== '') {
                const errorMsg = i18n ? i18n.t('setup.database.password_duplicate_error') : 'Application password must be different from super user password';
                appPasswordField.setCustomValidity(errorMsg);
            } else if (appPassword) {
                let isValid = true;
                let errorMsg = '';

                if (serviceType === 'docker') {
                    isValid = validateDatabasePasswordStrength(appPassword);
                    errorMsg = i18n ? i18n.t('setup.database.app_password_error') : 'App password must be 12-64 characters with at least 3 types: lowercase, uppercase, numbers, special characters (!@#$%^&*)';
                } else {
                    isValid = validateExternalServicePassword(appPassword);
                    errorMsg = i18n ? i18n.t('setup.database.app_password_external_error') : 'App password must be 1-128 characters and cannot contain control characters';
                }

                if (!isValid) {
                    appPasswordField.setCustomValidity(errorMsg);
                }
            }
        } else {
            const appUserField = document.getElementById('db-app-user');
            if (appUserField) {
                appUserField.setCustomValidity('');
            }
        }

        if (e.target.checkValidity()) {
            const serviceType = document.querySelector('input[name="db-service-type"]:checked').value;

            config.set('database', {
                service_type: serviceType,
                host: serviceType === 'docker' ? 'localhost' : document.getElementById('db-host').value,
                port: parseInt(document.getElementById('db-port').value),
                name: document.getElementById('db-name').value,
                app_user: document.getElementById('db-app-user').value,
                app_password: document.getElementById('db-app-password').value,
                super_user: serviceType === 'docker' ? document.getElementById('db-super-user').value : '',
                super_password: serviceType === 'docker' ? document.getElementById('db-super-password').value : ''
            });

            config.saveToLocalCache();
            await config.saveWithValidation();
        } else {
            showFormErrors(e.target);
        }
    });

    const testBtn = document.getElementById('db-test-btn');
    if (testBtn) {
        testBtn.addEventListener('click', () => testDatabaseConnection(apiClient, config, ui, i18n));
    }

    addFieldTouchListeners(container);
}
