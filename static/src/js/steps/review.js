function loadConfigReview(config, i18n) {
    try {
        const configData = config.getAll();

        const corsText = i18n ? i18n.t('setup.review.cors_configured', { count: configData.app.cors_allow_origins.length }) :
                        `${configData.app.cors_allow_origins.length} configured`;

        const serviceTypeText = i18n ? i18n.t(`setup.database.service_type_${configData.database.service_type}`) : configData.database.service_type;
        let databaseSection = `
            <h4 data-i18n="setup.review.sections.database"></h4>
            <p><strong data-i18n="setup.review.fields.service_type"></strong>: ${serviceTypeText}</p>
            <p><strong data-i18n="setup.review.fields.host"></strong>: ${configData.database.host}:${configData.database.port}</p>
            <p><strong data-i18n="setup.review.fields.database"></strong>: ${configData.database.name}</p>
            <p><strong data-i18n="setup.review.fields.app_user"></strong>: ${configData.database.app_user}</p>`;

        if (configData.database.service_type === 'docker' && configData.database.super_user) {
            databaseSection += `
            <p><strong data-i18n="setup.review.fields.super_user"></strong>: ${configData.database.super_user}</p>`;
        }

        document.getElementById('config-review').innerHTML = `
            <div style="text-align: left;">
                ${databaseSection}

                <h4 style="margin-top: 1.5rem;" data-i18n="setup.review.sections.redis"></h4>
                <p><strong data-i18n="setup.review.fields.service_type"></strong>: ${i18n ? i18n.t(`setup.redis.service_type_${configData.redis.service_type}`) : configData.redis.service_type}</p>
                <p><strong data-i18n="setup.review.fields.host"></strong>: ${configData.redis.host}:${configData.redis.port}</p>
                ${configData.redis.user ? `<p><strong data-i18n="setup.review.fields.user"></strong>: ${configData.redis.user}</p>` : ''}

                <h4 style="margin-top: 1.5rem;" data-i18n="setup.review.sections.smtp"></h4>
                <p><strong data-i18n="setup.review.fields.smtp_server"></strong>: ${configData.smtp.server}:${configData.smtp.port}</p>
                <p><strong data-i18n="setup.review.fields.smtp_user"></strong>: ${configData.smtp.user}</p>
                <p><strong data-i18n="setup.review.fields.smtp_sender"></strong>: ${configData.smtp.sender}</p>

                <h4 style="margin-top: 1.5rem;" data-i18n="setup.review.sections.application"></h4>
                <p><strong data-i18n="setup.review.fields.domain"></strong>: ${configData.app.domain_name}</p>
                <p><strong data-i18n="setup.review.fields.static_host"></strong>: ${configData.app.static_host_name}</p>
                <p><strong data-i18n="setup.review.fields.brand"></strong>: ${configData.app.brand_name}</p>
                <p><strong data-i18n="setup.review.fields.version"></strong>: ${configData.app.version || 'latest'}</p>
                <p><strong data-i18n="setup.review.fields.language"></strong>: ${configData.app.default_lang}</p>
                <p><strong data-i18n="setup.review.fields.cors_origins"></strong>: ${corsText}</p>
                <p><strong data-i18n="setup.review.fields.jwt_mode"></strong>: ${configData.app.jwt_key_from_file ? (i18n ? i18n.t('setup.review.jwt_from_file') : 'From File') : (i18n ? i18n.t('setup.review.jwt_auto_generate') : 'Auto Generate')}</p>
                ${configData.app.jwt_key_from_file ? `
                    <p><strong data-i18n="setup.review.fields.jwt_file_path"></strong>: ${configData.app.jwt_key_file_path}</p>
                ` : ''}

                <h4 style="margin-top: 1.5rem;" data-i18n="setup.review.sections.ssl"></h4>
                <p><strong data-i18n="setup.review.fields.ssl_enabled"></strong>: ${configData.ssl.enabled ? (i18n ? i18n.t('common.yes') : 'Yes') : (i18n ? i18n.t('common.no') : 'No')}</p>
                ${configData.ssl.enabled ? `
                    <p><strong data-i18n="setup.review.fields.ssl_cert_path"></strong>: ${configData.ssl.cert_path}</p>
                    <p><strong data-i18n="setup.review.fields.ssl_key_path"></strong>: ${configData.ssl.key_path}</p>
                    <p><strong data-i18n="setup.review.fields.ssl_use_setup_cert"></strong>: ${configData.ssl.use_setup_cert ? (i18n ? i18n.t('common.yes') : 'Yes') : (i18n ? i18n.t('common.no') : 'No')}</p>
                ` : ''}

                <h4 style="margin-top: 1.5rem;" data-i18n="setup.review.sections.administrator"></h4>
                <p><strong data-i18n="setup.review.fields.username"></strong>: ${configData.admin_user.username}</p>
                <p><strong data-i18n="setup.review.fields.email"></strong>: ${configData.admin_user.email}</p>

                <h4 style="margin-top: 1.5rem;" data-i18n="setup.review.sections.oauth"></h4>
                <p><strong data-i18n="setup.review.fields.google_oauth"></strong>: ${configData.oauth.google_enabled ? (i18n ? i18n.t('setup.review.fields.oauth_enabled') : 'Enabled') : (i18n ? i18n.t('setup.review.fields.oauth_disabled') : 'Disabled')}</p>
                <p><strong data-i18n="setup.review.fields.github_oauth"></strong>: ${configData.oauth.github_enabled ? (i18n ? i18n.t('setup.review.fields.oauth_enabled') : 'Enabled') : (i18n ? i18n.t('setup.review.fields.oauth_disabled') : 'Disabled')}</p>

                <h4 style="margin-top: 1.5rem;" data-i18n="setup.review.sections.goaccess"></h4>
                <p><strong data-i18n="setup.review.fields.goaccess_enabled"></strong>: ${configData.goaccess.enabled ? (i18n ? i18n.t('common.yes') : 'Yes') : (i18n ? i18n.t('common.no') : 'No')}</p>
                ${configData.goaccess.enabled && configData.goaccess.has_geo_file ? `
                    <p><strong data-i18n="setup.review.fields.goaccess_geo_file"></strong>: ${configData.goaccess.original_file_name || 'GeoLite2-City.mmdb'}</p>
                ` : ''}
            </div>
        `;

    } catch (error) {
        document.getElementById('config-review').innerHTML = `
            <div class="alert alert-error">${i18n ? i18n.t('messages.failed_get_config') : 'Failed to load configuration'}: ${error.message}</div>
        `;
    }

    if (i18n) {
        i18n.applyTranslations();
    }
}

export function render(container, { config, navigation, setupService, i18n }) {
        container.innerHTML = `
            <div class="form-section">
                <h3 data-i18n="setup.review.title"></h3>
                <p style="margin-bottom: 1.5rem; color: var(--gray-600);" data-i18n="setup.review.description"></p>

                <div id="config-review">
                    <div class="loading">
                        <div class="loading-spinner"></div>
                    </div>
                </div>

                <div class="btn-group">
                    <button class="btn btn-secondary" id="review-prev-btn" data-i18n="common.previous"></button>
                    <button class="btn btn-success" id="generate-config-btn" data-i18n="setup.review.generate_button"></button>
                </div>
            </div>
        `;

        document.getElementById('review-prev-btn').addEventListener('click', () => {
            navigation.previousStep();
        });

        document.getElementById('generate-config-btn').addEventListener('click', async () => {
            await setupService.generateConfig();
        });

        loadConfigReview(config, i18n);
    }
    
