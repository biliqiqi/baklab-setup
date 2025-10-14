export function validatePasswordStrength(password) {
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

export function validateDatabasePasswordStrength(password) {
    const formatRegex = /^[A-Za-z\d!@#$%^&*]{12,64}$/;
    const lowerRegex = /[a-z]/;
    const upperRegex = /[A-Z]/;
    const digitRegex = /\d/;
    const specialRegex = /[!@#$%^&*]/;

    if (!formatRegex.test(password)) {
        return false;
    }

    let typeCount = 0;
    if (lowerRegex.test(password)) typeCount++;
    if (upperRegex.test(password)) typeCount++;
    if (digitRegex.test(password)) typeCount++;
    if (specialRegex.test(password)) typeCount++;

    return typeCount >= 3;
}

export function validateExternalServicePassword(password) {
    if (!password || password.length === 0) {
        return false;
    }

    if (password.length > 128) {
        return false;
    }

    for (let i = 0; i < password.length; i++) {
        const charCode = password.charCodeAt(i);
        if (charCode < 32 || charCode === 127) {
            return false;
        }
    }

    return true;
}

export function validateGoAccessForm(form, config, clearFormErrorsFn, showFieldErrorFn, i18n = null) {
    let valid = true;
    clearFormErrorsFn(form);

    const goAccessEnabled = form.querySelector('#goaccess-enabled').checked;

    if (goAccessEnabled) {
        if (!config.goaccess.has_geo_file ||
            (config.goaccess.has_geo_file && !config.goaccess.geo_file_temp_path)) {
            valid = false;
            const uploadArea = form.querySelector('#geo-upload-area');
            let errorMessage;

            if (!config.goaccess.has_geo_file) {
                errorMessage = i18n ? i18n.t('setup.goaccess.geo_file_required') :
                               'GeoIP database file is required when GoAccess is enabled';
            } else {
                errorMessage = i18n ? i18n.t('setup.goaccess.geo_file_missing') :
                               'GeoIP database file is no longer available. Please re-upload your GeoIP database file.';
            }

            showFieldErrorFn(uploadArea, errorMessage);
        }
    }

    return valid;
}

export function showFormErrors(form) {
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

    if (invalidFields.length > 0) {
        invalidFields[0].focus();
        invalidFields[0].scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
}

export function clearFormErrors(form) {
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

export function addFieldTouchListeners(container) {
    const formFields = container.querySelectorAll('input, select, textarea');
    formFields.forEach(field => {
        const markTouched = () => {
            const formGroup = field.closest('.form-group');
            if (formGroup) {
                formGroup.classList.add('touched');
            }
        };

        field.addEventListener('input', markTouched);
        field.addEventListener('change', markTouched);
        field.addEventListener('blur', markTouched);
    });
}

export function showFieldError(element, message) {
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

export function showCustomError(field, message) {
    const formGroup = field.closest('.form-group');
    if (formGroup) {
        formGroup.classList.add('error');

        let errorDiv = formGroup.querySelector('.invalid-feedback');
        if (errorDiv) {
            errorDiv.textContent = message;
            errorDiv.style.display = 'block';
        }

        field.style.borderColor = '#dc2626';
    }
}

export function hideCustomError(field) {
    const formGroup = field.closest('.form-group');
    if (formGroup) {
        formGroup.classList.remove('error');

        const errorDiv = formGroup.querySelector('.invalid-feedback');
        if (errorDiv) {
            errorDiv.style.display = 'none';
        }

        field.style.borderColor = '';
    }
}

export function handleBackendValidationErrors(error, showAlertFn, i18n = null) {
    if (error.errors && Array.isArray(error.errors)) {
        document.querySelectorAll('.form-group.error').forEach(group => {
            group.classList.remove('error');
            const errorMsg = group.querySelector('.invalid-feedback');
            if (errorMsg) {
                errorMsg.style.display = 'none';
            }
        });

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
            'app.version': 'app-version',
            'app.default_lang': 'app-lang',
            'admin_user.username': 'admin-username',
            'admin_user.email': 'admin-email',
            'admin_user.password': 'admin-password'
        };

        let firstErrorField = null;

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

        if (firstErrorField) {
            firstErrorField.focus();
            firstErrorField.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }

        showAlertFn('error', 'Please fix the validation errors below and try again.');
    } else {
        const msg = i18n ? i18n.t('messages.errors.failed_save_config') : 'Failed to save configuration';
        showAlertFn('error', msg + ': ' + (error.message || 'Unknown error'));
    }
}

export function showValidationErrors(errors, i18n = null) {
    const existingAlerts = document.querySelectorAll('.alert');
    existingAlerts.forEach(alert => alert.remove());

    const errorContainer = document.createElement('div');
    errorContainer.className = 'alert alert-error validation-errors';

    const errorTitle = document.createElement('div');
    errorTitle.className = 'validation-error-title';
    errorTitle.textContent = i18n ? i18n.t('messages.fix_errors') :
                             'Please fix the validation errors below and try again.';
    errorContainer.appendChild(errorTitle);

    const errorList = document.createElement('ul');
    errorList.className = 'validation-error-list';

    errors.forEach(error => {
        const errorItem = document.createElement('li');
        errorItem.className = 'validation-error-item';

        const fallback = i18n ? i18n.t('messages.errors.validation_error_generic') : 'Validation error';
        const message = error.message || fallback;
        errorItem.textContent = message;

        errorList.appendChild(errorItem);
    });

    errorContainer.appendChild(errorList);
    document.querySelector('.setup-card').insertBefore(errorContainer, document.getElementById('step-content'));

    setTimeout(() => {
        if (errorContainer.parentNode) {
            errorContainer.parentNode.removeChild(errorContainer);
        }
    }, 10000);
}

export function validateAndSetFieldError(field, password, validationMode, options = {}) {
    const {
        i18n = null,
        showCustomErrorFn = null,
        hideCustomErrorFn = null,
        errorMessages = {}
    } = options;

    if (!password) {
        field.setCustomValidity('');
        if (hideCustomErrorFn) hideCustomErrorFn(field);
        return true;
    }

    let isValid = false;
    let errorMessage = '';

    switch (validationMode) {
        case 'admin':
            isValid = validatePasswordStrength(password);
            errorMessage = errorMessages.admin ||
                (i18n ? i18n.t('setup.admin.password_error') :
                'Password must contain lowercase, uppercase, numbers, and special characters (!@#$%^&*)');
            break;

        case 'database':
            isValid = validateDatabasePasswordStrength(password);
            errorMessage = errorMessages.database ||
                (i18n ? i18n.t('setup.database.password_error') :
                'Password must be 12-64 characters with at least 3 types: lowercase, uppercase, numbers, special characters (!@#$%^&*)');
            break;

        case 'external':
            isValid = validateExternalServicePassword(password);
            errorMessage = errorMessages.external ||
                (i18n ? i18n.t('setup.password_external_error') :
                'Password must be 1-128 characters and cannot contain control characters');
            break;

        default:
            throw new Error(`Unknown validation mode: ${validationMode}`);
    }

    if (!isValid) {
        field.setCustomValidity(errorMessage);
        if (showCustomErrorFn) showCustomErrorFn(field, errorMessage);
    } else {
        field.setCustomValidity('');
        if (hideCustomErrorFn) hideCustomErrorFn(field);
    }

    return isValid;
}