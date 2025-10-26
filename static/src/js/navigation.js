export class Navigation {
    constructor(steps, getCurrentStep, setCurrentStep) {
        this._steps = steps;
        this._getCurrentStep = getCurrentStep;
        this._setCurrentStep = setCurrentStep;
    }

    getCurrentStepKey() {
        const index = this._getCurrentStep();
        return this._steps[index].key;
    }

    nextStep() {
        const current = this._getCurrentStep();
        if (current < this._steps.length - 1) {
            this._setCurrentStep(current + 1);
        }
    }

    previousStep() {
        const current = this._getCurrentStep();
        if (current > 0) {
            this._setCurrentStep(current - 1);
        }
    }

    goToStep(index) {
        if (index >= 0 && index < this._steps.length) {
            this._setCurrentStep(index);
        }
    }
}
