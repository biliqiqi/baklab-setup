export function render(container, { setupService }) {
    container.innerHTML = `
        <div class="form-section">
            <h3 data-i18n="setup.init.welcome_title"></h3>
            <div style="margin-bottom: 2rem; color: var(--gray-600); line-height: 1.6;">
                <span data-i18n="setup.init.welcome_description_part1"></span>
                <strong data-i18n="setup.init.timeout_highlight"></strong>
                <span data-i18n="setup.init.welcome_description_part2"></span>
            </div>

            <div style="border: 1px solid #ddd; border-radius: 4px; padding: 1rem; margin: 1rem 0; background: #f9f9f9;">
                <h4 style="margin: 0 0 0.75rem 0;" data-i18n="setup.init.prerequisites_title"></h4>
                <p style="margin: 0 0 0.75rem 0;" data-i18n="setup.init.prerequisites_description"></p>

                <ul style="margin: 0.25rem 0 0.75rem 1rem;">
                    <li data-i18n="setup.init.required_smtp"></li>
                    <li data-i18n="setup.init.required_https"></li>
                    <li data-i18n="setup.init.required_static"></li>
                </ul>

                <p style="margin: 0; font-size: 0.9rem; font-style: italic;" data-i18n="setup.init.prerequisites_note"></p>
            </div>

            <div class="form-group" style="margin-bottom: 2rem;">
                <label class="form-label" data-i18n="setup.init.language_label"></label>
                <div class="language-switcher-container" id="language-switcher"></div>
            </div>

            <div class="btn-group init-actions">
                <button class="btn btn-primary" id="init-btn">
                    <span data-i18n="setup.init.initialize_button"></span>
                </button>
            </div>
        </div>
    `;

    document.getElementById('init-btn').addEventListener('click', async () => {
        await setupService.initialize();
    });
}
