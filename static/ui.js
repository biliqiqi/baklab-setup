import { showValidationErrors } from './validator.js';

export class UI {
    constructor(i18n) {
        this.i18n = i18n;
    }

    updateRadioStyles(radioName) {
        const radios = document.querySelectorAll(`input[name="${radioName}"]`);
        radios.forEach(radio => {
            const option = radio.closest('.radio-option');
            if (radio.checked) {
                option.classList.add('selected');
            } else {
                option.classList.remove('selected');
            }
        });
    }

    showAlert(type, message) {
        const alertDiv = document.createElement('div');
        alertDiv.className = `alert alert-${type}`;
        alertDiv.textContent = this.i18n && message.includes('.') ? this.i18n.t(message) : message;

        const setupCard = document.querySelector('.setup-card');
        if (setupCard) {
            setupCard.insertBefore(alertDiv, document.getElementById('step-content'));
        }

        setTimeout(() => {
            if (alertDiv.parentNode) {
                alertDiv.parentNode.removeChild(alertDiv);
            }
        }, 5000);
    }

    showValidationErrors(errors) {
        showValidationErrors(errors, this.i18n);
    }
}
