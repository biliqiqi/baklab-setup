import { validateAndSetFieldError, validatePasswordStrength, showFormErrors, showCustomError, hideCustomError, addFieldTouchListeners } from '../validator.js';

export function render(container, { config, navigation, ui, i18n }) {
        const adminUser = config.get('admin_user');

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
                        value="${adminUser.username}"
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
                        value="${adminUser.email}"
                        placeholder="admin@example.com"
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
                        data-i18n-placeholder="setup.admin.password_confirm_placeholder"
                        required
                        data-i18n-title="setup.admin.password_confirm_error"
                    >
                    <div class="invalid-feedback" data-i18n="setup.admin.password_confirm_error"></div>
                </div>
                
                <div class="btn-group">
                    <button type="button" class="btn btn-secondary" id="admin-prev-btn" data-i18n="common.previous"></button>
                    <button type="submit" class="btn btn-primary" data-i18n="common.next"></button>
                </div>
            </form>
        `;

        document.getElementById('admin-prev-btn').addEventListener('click', () => {
            navigation.previousStep();
        });

        document.getElementById('admin-form').addEventListener('submit', async (e) => {
            e.preventDefault();

            const password = document.getElementById('admin-password').value;
            const passwordConfirm = document.getElementById('admin-password-confirm').value;
            const confirmField = document.getElementById('admin-password-confirm');
            const passwordField = document.getElementById('admin-password');

            if (password && !validatePasswordStrength(password)) {
                const errorMsg = i18n ? i18n.t('setup.admin.password_error') :
                    'Password must contain lowercase, uppercase, numbers, and special characters (!@#$%^&*)';
                passwordField.setCustomValidity(errorMsg);
            } else {
                passwordField.setCustomValidity('');
            }

            if (password !== passwordConfirm) {
                const errorMsg = i18n ? i18n.t('setup.admin.password_confirm_error') : 'Passwords must match';
                confirmField.setCustomValidity(errorMsg);
            } else {
                confirmField.setCustomValidity('');
            }

            if (e.target.checkValidity()) {
                config.set('admin_user', {
                    username: document.getElementById('admin-username').value,
                    email: document.getElementById('admin-email').value,
                    password: document.getElementById('admin-password').value
                });

                config.saveToLocalCache();
                await config.saveWithValidation();
            } else {
                showFormErrors(e.target);
            }
        });

        const passwordField = document.getElementById('admin-password');
        const confirmField = document.getElementById('admin-password-confirm');

        if (passwordField && adminUser.password) {
            passwordField.value = adminUser.password;
        }
        if (confirmField && adminUser.password) {
            confirmField.value = adminUser.password;
        }

        passwordField.addEventListener('input', () => {
            validateAndSetFieldError(
                passwordField,
                passwordField.value,
                'admin',
                {
                    i18n: i18n,
                    showCustomErrorFn: (f, m) => showCustomError(f, m),
                    hideCustomErrorFn: (f) => hideCustomError(f)
                }
            );

            if (confirmField.value && passwordField.value !== confirmField.value) {
                const errorMsg = i18n ? i18n.t('setup.admin.password_confirm_error') : 'Passwords must match';
                confirmField.setCustomValidity(errorMsg);
                showCustomError(confirmField, errorMsg);
            } else {
                confirmField.setCustomValidity('');
                hideCustomError(confirmField);
            }
        });

        confirmField.addEventListener('input', () => {
            const password = passwordField.value;
            const passwordConfirm = confirmField.value;

            if (passwordConfirm && password !== passwordConfirm) {
                const errorMsg = i18n ? i18n.t('setup.admin.password_confirm_error') : 'Passwords must match';
                confirmField.setCustomValidity(errorMsg);
                showCustomError(confirmField, errorMsg);
            } else {
                confirmField.setCustomValidity('');
                hideCustomError(confirmField);
            }
        });

        addFieldTouchListeners(container);
    }
    
