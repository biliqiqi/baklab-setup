import {
    validatePasswordStrength,
    validateDatabasePasswordStrength,
    validateExternalServicePassword,
    showFormErrors,
    clearFormErrors,
    showFieldError,
    showCustomError,
    hideCustomError,
    validateAndSetFieldError
} from './validator.js';

describe('validatePasswordStrength', () => {
    test('valid password with all requirements', () => {
        expect(validatePasswordStrength('Abcd1234!@#$')).toBe(true);
    });

    test('minimum length (12 chars)', () => {
        expect(validatePasswordStrength('Abcd1234!@#$')).toBe(true);
    });

    test('too short (11 chars)', () => {
        expect(validatePasswordStrength('Abcd1234!@')).toBe(false);
    });

    test('too long (65 chars)', () => {
        const longPw = 'A'.repeat(30) + 'a'.repeat(30) + '12345!';
        expect(validatePasswordStrength(longPw)).toBe(false);
    });

    test('missing lowercase', () => {
        expect(validatePasswordStrength('ABCD1234!@#$')).toBe(false);
    });

    test('missing uppercase', () => {
        expect(validatePasswordStrength('abcd1234!@#$')).toBe(false);
    });

    test('missing digit', () => {
        expect(validatePasswordStrength('Abcdefgh!@#$')).toBe(false);
    });

    test('missing special char', () => {
        expect(validatePasswordStrength('Abcd12345678')).toBe(false);
    });

    test('invalid special char', () => {
        expect(validatePasswordStrength('Abcd1234567+')).toBe(false);
    });
});

describe('validateDatabasePasswordStrength', () => {
    test('valid with 4 types', () => {
        expect(validateDatabasePasswordStrength('Abcd1234!@#$')).toBe(true);
    });

    test('valid with 3 types (no special)', () => {
        expect(validateDatabasePasswordStrength('Abcd12345678')).toBe(true);
    });

    test('valid with 3 types (no upper)', () => {
        expect(validateDatabasePasswordStrength('abcd1234!@#$')).toBe(true);
    });

    test('invalid with 2 types only', () => {
        expect(validateDatabasePasswordStrength('abcd12345678')).toBe(false);
    });

    test('too short', () => {
        expect(validateDatabasePasswordStrength('Abc123!@#')).toBe(false);
    });

    test('exact 12 chars with 3 types', () => {
        expect(validateDatabasePasswordStrength('Abcdefg12345')).toBe(true);
    });

    test('maximum length (64 chars)', () => {
        const maxPw = 'A'.repeat(20) + 'a'.repeat(20) + '1'.repeat(24);
        expect(validateDatabasePasswordStrength(maxPw)).toBe(true);
    });
});

describe('validateExternalServicePassword', () => {
    test('valid simple password', () => {
        expect(validateExternalServicePassword('simple123')).toBe(true);
    });

    test('valid with spaces', () => {
        expect(validateExternalServicePassword('pass word 123')).toBe(true);
    });

    test('valid with special characters', () => {
        expect(validateExternalServicePassword('p@ssw0rd!#$%')).toBe(true);
    });

    test('valid single character', () => {
        expect(validateExternalServicePassword('a')).toBe(true);
    });

    test('empty string', () => {
        expect(validateExternalServicePassword('')).toBe(false);
    });

    test('null value', () => {
        expect(validateExternalServicePassword(null)).toBe(false);
    });

    test('too long (>128)', () => {
        expect(validateExternalServicePassword('a'.repeat(129))).toBe(false);
    });

    test('exactly 128 chars', () => {
        expect(validateExternalServicePassword('a'.repeat(128))).toBe(true);
    });

    test('control character (newline)', () => {
        expect(validateExternalServicePassword('pass\nword')).toBe(false);
    });

    test('control character (tab)', () => {
        expect(validateExternalServicePassword('pass\tword')).toBe(false);
    });

    test('control character (null byte)', () => {
        expect(validateExternalServicePassword('pass\0word')).toBe(false);
    });
});

describe('DOM manipulation functions', () => {
    beforeEach(() => {
        document.body.innerHTML = '';
    });

    describe('showFormErrors', () => {
        test('marks invalid fields with error class', () => {
            const form = document.createElement('form');
            form.innerHTML = `
                <div class="form-group">
                    <input type="text" required>
                    <div class="invalid-feedback" style="display:none;">Error</div>
                </div>
            `;
            document.body.appendChild(form);

            const input = form.querySelector('input');
            input.scrollIntoView = () => {};
            input.focus = () => {};

            showFormErrors(form);

            const formGroup = form.querySelector('.form-group');
            const errorMsg = form.querySelector('.invalid-feedback');
            expect(formGroup.classList.contains('error')).toBe(true);
            expect(errorMsg.style.display).toBe('block');
        });

        test('clears error from valid fields', () => {
            const form = document.createElement('form');
            form.innerHTML = `
                <div class="form-group error">
                    <input type="text" value="valid">
                    <div class="invalid-feedback" style="display:block;">Error</div>
                </div>
            `;
            document.body.appendChild(form);

            showFormErrors(form);

            const formGroup = form.querySelector('.form-group');
            const errorMsg = form.querySelector('.invalid-feedback');
            expect(formGroup.classList.contains('error')).toBe(false);
            expect(errorMsg.style.display).toBe('none');
        });
    });

    describe('clearFormErrors', () => {
        test('removes error states from form', () => {
            const form = document.createElement('form');
            form.innerHTML = `
                <div class="form-group error">
                    <input type="text">
                    <div class="invalid-feedback" style="display:block;">Error message</div>
                </div>
            `;
            document.body.appendChild(form);

            clearFormErrors(form);

            const formGroup = form.querySelector('.form-group');
            const errorMsg = form.querySelector('.invalid-feedback');
            expect(formGroup.classList.contains('error')).toBe(false);
            expect(errorMsg.style.display).toBe('none');
            expect(errorMsg.textContent).toBe('');
        });
    });

    describe('showFieldError', () => {
        test('displays error on specific field', (done) => {
            const container = document.createElement('div');
            container.innerHTML = `
                <div class="form-group">
                    <input type="text" id="test-field">
                    <div class="invalid-feedback" style="display:none;"></div>
                </div>
            `;
            document.body.appendChild(container);

            const field = container.querySelector('#test-field');
            showFieldError(field, 'Test error message');

            setTimeout(() => {
                const formGroup = container.querySelector('.form-group');
                const errorMsg = container.querySelector('.invalid-feedback');
                expect(formGroup.classList.contains('error')).toBe(true);
                expect(errorMsg.textContent).toBe('Test error message');
                expect(errorMsg.style.display).toBe('block');
                done();
            }, 10);
        });
    });

    describe('showCustomError', () => {
        test('displays error with border color', () => {
            const container = document.createElement('div');
            container.innerHTML = `
                <div class="form-group">
                    <input type="text" id="test-field">
                    <div class="invalid-feedback"></div>
                </div>
            `;
            document.body.appendChild(container);

            const field = container.querySelector('#test-field');
            showCustomError(field, 'Custom error');

            const formGroup = container.querySelector('.form-group');
            const errorMsg = container.querySelector('.invalid-feedback');
            expect(formGroup.classList.contains('error')).toBe(true);
            expect(errorMsg.textContent).toBe('Custom error');
            expect(errorMsg.style.display).toBe('block');
            expect(field.style.borderColor).toBe('#dc2626');
        });
    });

    describe('hideCustomError', () => {
        test('removes error styling', () => {
            const container = document.createElement('div');
            container.innerHTML = `
                <div class="form-group error">
                    <input type="text" id="test-field" style="border-color: rgb(220, 38, 38);">
                    <div class="invalid-feedback" style="display:block;">Error</div>
                </div>
            `;
            document.body.appendChild(container);

            const field = container.querySelector('#test-field');
            hideCustomError(field);

            const formGroup = container.querySelector('.form-group');
            const errorMsg = container.querySelector('.invalid-feedback');
            expect(formGroup.classList.contains('error')).toBe(false);
            expect(errorMsg.style.display).toBe('none');
            expect(field.style.borderColor).toBe('');
        });
    });
});
describe('validateAndSetFieldError', () => {
    let field;

    beforeEach(() => {
        field = document.createElement('input');
        field.setCustomValidity = () => {};
    });

    test('admin mode with valid password', () => {
        const result = validateAndSetFieldError(field, 'Abcd1234!@#$', 'admin');
        expect(result).toBe(true);
    });

    test('admin mode with invalid password', () => {
        const result = validateAndSetFieldError(field, 'weakpass', 'admin');
        expect(result).toBe(false);
    });

    test('database mode with valid password', () => {
        const result = validateAndSetFieldError(field, 'Abcd12345678', 'database');
        expect(result).toBe(true);
    });

    test('database mode with invalid password', () => {
        const result = validateAndSetFieldError(field, 'short', 'database');
        expect(result).toBe(false);
    });

    test('external mode with valid password', () => {
        const result = validateAndSetFieldError(field, 'any-password-123', 'external');
        expect(result).toBe(true);
    });

    test('external mode with control character', () => {
        const result = validateAndSetFieldError(field, 'pass\nword', 'external');
        expect(result).toBe(false);
    });

    test('empty password clears error', () => {
        const result = validateAndSetFieldError(field, '', 'admin');
        expect(result).toBe(true);
    });

    test('calls showCustomErrorFn on invalid', () => {
        let called = false;
        const showErrorFn = () => { called = true; };
        validateAndSetFieldError(field, 'weak', 'admin', { showCustomErrorFn: showErrorFn });
        expect(called).toBe(true);
    });

    test('calls hideCustomErrorFn on valid', () => {
        let called = false;
        const hideErrorFn = () => { called = true; };
        validateAndSetFieldError(field, 'Abcd1234!@#$', 'admin', { hideCustomErrorFn: hideErrorFn });
        expect(called).toBe(true);
    });

    test('throws error for unknown validation mode', () => {
        expect(() => {
            validateAndSetFieldError(field, 'password', 'unknown');
        }).toThrow('Unknown validation mode: unknown');
    });
});
