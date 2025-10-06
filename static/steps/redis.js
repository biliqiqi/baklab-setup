import { validateDatabasePasswordStrength, validateExternalServicePassword, showValidationErrors, showCustomError, hideCustomError, showFormErrors, addFieldTouchListeners } from '../validator.js';

async function testRedisConnection(apiClient, config, ui, i18n) {
    await apiClient.protectedApiCall('testRedis', async () => {
        const testConfig = { ...config.getAll() };

        testConfig.redis = {
            service_type: document.querySelector('input[name="redis-service-type"]:checked').value,
            host: document.getElementById('redis-host').value,
            port: parseInt(document.getElementById('redis-port').value),
            user: document.getElementById('redis-user') ? document.getElementById('redis-user').value : '',
            password: document.getElementById('redis-password').value
        };

        const testBtn = document.getElementById('redis-test-btn');
        const originalText = testBtn.textContent;
        testBtn.disabled = true;
        testBtn.textContent = i18n ? i18n.t('common.testing') : 'Testing...';

        try {
            const result = await apiClient.testConnections('redis', testConfig);
            displayConnectionResults(result.data, 'redis');
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
    const containerId = 'redis-connection-results';
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

function updateRedisHostField(serviceType) {
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

        if (adminConfig) {
            adminConfig.style.display = 'block';
        }
        if (adminPasswordField) {
            adminPasswordField.required = true;
            adminPasswordField.disabled = false;
        }

        if (userField) {
            userField.required = true;
            const requiredIndicator = document.getElementById('redis-user-required-indicator');
            if (requiredIndicator) {
                requiredIndicator.textContent = '*';
                requiredIndicator.setAttribute('data-i18n', 'common.required');
            }
        }

        if (passwordField) {
            passwordField.minLength = 12;
            passwordField.maxLength = 64;
            passwordField.pattern = '^[A-Za-z\\d!@#$%^&*]{12,64}$';
        }
        toggleHelpText('redis-password', true);
        toggleHelpText('redis-user', true);
        toggleHelpText('redis-admin-password', true);

        if (passwordField) {
            passwordField.setCustomValidity('');
            hideCustomError(passwordField);
        }
        if (userField) {
            userField.setCustomValidity('');
            hideCustomError(userField);
        }
        if (adminPasswordField) {
            adminPasswordField.setCustomValidity('');
            hideCustomError(adminPasswordField);
        }
    } else {
        hostField.readOnly = false;
        hostField.style.backgroundColor = '';
        if (testConnectionContainer) {
            testConnectionContainer.style.display = 'block';
        }

        if (adminConfig) {
            adminConfig.style.display = 'none';
        }
        if (adminPasswordField) {
            adminPasswordField.required = false;
            adminPasswordField.disabled = true;
        }

        if (userField) {
            userField.required = false;
            userField.placeholder = '';
        }

        if (passwordField) {
            passwordField.minLength = 1;
            passwordField.maxLength = 128;
            passwordField.pattern = '';
            passwordField.removeAttribute('pattern');
        }
        toggleHelpText('redis-password', false);
        toggleHelpText('redis-user', false);
        toggleHelpText('redis-admin-password', false);

        if (passwordField) {
            passwordField.setCustomValidity('');
            hideCustomError(passwordField);
        }
        if (userField) {
            userField.setCustomValidity('');
            hideCustomError(userField);
        }
        if (adminPasswordField) {
            adminPasswordField.setCustomValidity('');
            hideCustomError(adminPasswordField);
        }
    }

    if (redisForm) {
        redisForm.noValidate = true;
        setTimeout(() => {
            redisForm.noValidate = false;
        }, 10);
    }
}

export function render(container, { config, navigation, ui, apiClient, i18n }) {
        const redis = config.get('redis');

        container.innerHTML = `
            <form id="redis-form" class="form-section" novalidate>
                <h3 data-i18n="setup.redis.title"></h3>
                <p style="margin-bottom: 1.5rem; color: var(--gray-600);" data-i18n="setup.redis.description"></p>

                <div class="form-group">
                    <label class="form-label"><span data-i18n="setup.redis.service_type_label"></span> <span data-i18n="common.required"></span></label>
                    <div class="radio-group">
                        <label class="radio-option">
                            <input type="radio" name="redis-service-type" value="docker" ${redis.service_type === 'docker' ? 'checked' : ''}>
                            <div>
                                <span data-i18n="setup.redis.service_type_docker"></span>
                            </div>
                        </label>
                        <label class="radio-option">
                            <input type="radio" name="redis-service-type" value="external" ${redis.service_type === 'external' ? 'checked' : ''}>
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
                            value="${redis.host}"
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
                            value="${redis.port}"
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
                        value="${redis.user || ''}"
                        data-i18n-placeholder="setup.redis.user_placeholder"
                        maxlength="128"
                        data-i18n-title="setup.redis.user_error"
                    >
                    <div class="form-help" data-i18n="setup.redis.user_help"></div>
                    <div class="invalid-feedback" data-i18n="setup.redis.user_error"></div>
                </div>

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
                        <button type="button" id="redis-test-btn" class="btn btn-outline-primary" data-i18n="setup.redis.test_connection"></button>
                    </div>
                    <div id="redis-connection-results" class="connection-results-container"></div>
                </div>

                <div class="btn-group">
                    <button type="button" class="btn btn-secondary" id="redis-prev-btn" data-i18n="common.previous"></button>
                    <button type="submit" class="btn btn-primary" data-i18n="common.next"></button>
                </div>
            </form>
        `;
        
        document.getElementById('redis-prev-btn').addEventListener('click', () => {
            navigation.previousStep();
        });

        const serviceTypeRadios = document.querySelectorAll('input[name="redis-service-type"]');
        serviceTypeRadios.forEach(radio => {
            radio.addEventListener('change', (e) => {
                updateRedisHostField(e.target.value);
                ui.updateRadioStyles('redis-service-type');
            });
        });

        updateRedisHostField(redis.service_type);
        ui.updateRadioStyles('redis-service-type');

        const redisPasswordField = document.getElementById('redis-password');
        if (redisPasswordField && redis.password) {
            redisPasswordField.value = redis.password;
        }
        const redisAdminPasswordField = document.getElementById('redis-admin-password');
        if (redisAdminPasswordField && redis.admin_password) {
            redisAdminPasswordField.value = redis.admin_password;
        }

        setTimeout(() => {
            updateRedisHostField(redis.service_type);
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
                    isValid = validateDatabasePasswordStrength(password);
                    errorMessage = i18n ? i18n.t('setup.redis.password_error') :
                        'Password must be 12-64 characters with at least 3 types: lowercase, uppercase, numbers, special characters (!@#$%^&*)';
                } else {
                    isValid = validateExternalServicePassword(password);
                    errorMessage = i18n ? i18n.t('setup.redis.password_external_error') :
                        'Password must be 1-128 characters and cannot contain control characters';
                }

                if (!isValid) {
                    passwordField.setCustomValidity(errorMessage);
                    showCustomError(passwordField, errorMessage);
                } else {
                    passwordField.setCustomValidity('');
                    hideCustomError(passwordField);
                }
            } else {
                passwordField.setCustomValidity('');
                hideCustomError(passwordField);
            }

            if (serviceType === 'docker' && adminPasswordField) {
                const adminPassword = adminPasswordField.value;

                if (adminPassword) {
                    const isValid = validateDatabasePasswordStrength(adminPassword);
                    const errorMessage = i18n ? i18n.t('setup.redis.admin_password_error') :
                        'CLI password must be 12-64 characters with at least 3 types: lowercase, uppercase, numbers, special characters (!@#$%^&*)';

                    if (!isValid) {
                        adminPasswordField.setCustomValidity(errorMessage);
                        showCustomError(adminPasswordField, errorMessage);
                    } else {
                        adminPasswordField.setCustomValidity('');
                        hideCustomError(adminPasswordField);
                    }
                } else {
                    adminPasswordField.setCustomValidity('');
                    hideCustomError(adminPasswordField);
                }
            } else if (adminPasswordField) {
                adminPasswordField.setCustomValidity('');
                hideCustomError(adminPasswordField);
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

        document.getElementById('redis-form').addEventListener('submit', async (e) => {
            e.preventDefault();

            const serviceType = document.querySelector('input[name="redis-service-type"]:checked').value;

            const password = document.getElementById('redis-password').value;
            const passwordField = document.getElementById('redis-password');

            if (password) {
                let isValid = true;
                let errorMessage = '';

                if (serviceType === 'docker') {
                    isValid = validateDatabasePasswordStrength(password);
                    errorMessage = i18n ? i18n.t('setup.redis.password_error') :
                        'Password must be 12-64 characters with at least 3 types: lowercase, uppercase, numbers, special characters (!@#$%^&*)';
                } else {
                    isValid = validateExternalServicePassword(password);
                    errorMessage = i18n ? i18n.t('setup.redis.password_external_error') :
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

            const adminPasswordField = document.getElementById('redis-admin-password');
            if (serviceType === 'docker') {
                const adminPassword = adminPasswordField ? adminPasswordField.value : '';

                if (adminPassword) {
                    const isValid = validateDatabasePasswordStrength(adminPassword);
                    if (!isValid) {
                        const errorMessage = i18n ? i18n.t('setup.redis.admin_password_error') :
                            'CLI password must be 12-64 characters with at least 3 types: lowercase, uppercase, numbers, special characters (!@#$%^&*)';
                        adminPasswordField.setCustomValidity(errorMessage);
                    } else {
                        adminPasswordField.setCustomValidity('');
                    }
                } else if (adminPasswordField) {
                    adminPasswordField.setCustomValidity('');
                }
            } else {
                if (adminPasswordField) {
                    adminPasswordField.setCustomValidity('');
                }
            }
            
            if (e.target.checkValidity()) {
                const serviceType = document.querySelector('input[name="redis-service-type"]:checked').value;
                const redisConfig = {
                    service_type: serviceType,
                    host: serviceType === 'docker' ? 'localhost' : document.getElementById('redis-host').value,
                    port: parseInt(document.getElementById('redis-port').value),
                    user: document.getElementById('redis-user') ? document.getElementById('redis-user').value : '',
                    password: document.getElementById('redis-password').value
                };

                if (serviceType === 'docker') {
                    redisConfig.admin_password = document.getElementById('redis-admin-password').value;
                } else {
                    redisConfig.admin_password = '';
                }

                config.set('redis', redisConfig);
                config.saveToLocalCache();
                await config.saveWithValidation();
            } else {
                showFormErrors(e.target);
            }
        });

        const testBtn = document.getElementById('redis-test-btn');
        if (testBtn) {
            testBtn.addEventListener('click', () => testRedisConnection(apiClient, config, ui, i18n));
        }

        addFieldTouchListeners(container);
    }
