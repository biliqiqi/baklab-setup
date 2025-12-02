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

        const closeBtn = document.createElement('button');
        closeBtn.type = 'button';
        closeBtn.className = 'alert-close';
        closeBtn.innerHTML = '&times;';
        closeBtn.setAttribute('aria-label', 'Close');
        closeBtn.addEventListener('click', () => {
            if (alertDiv.parentNode) {
                alertDiv.parentNode.removeChild(alertDiv);
            }
        });

        const alertMessage = document.createElement('div');
        alertMessage.className = 'alert-message';
        alertMessage.textContent = this.i18n && message.includes('.')
            ? this.i18n.t(message)
            : message;

        alertDiv.appendChild(closeBtn);
        alertDiv.appendChild(alertMessage);

        const setupCard = document.querySelector('.setup-card');
        if (setupCard) {
            setupCard.insertBefore(alertDiv, document.getElementById('step-content'));
        }
    }

    showValidationErrors(errors) {
        showValidationErrors(errors, this.i18n);
    }
}
