function loadConfigReview(app) {
    try {
        const config = app.config;

        const corsText = window.i18n ? window.i18n.t('setup.review.cors_configured', { count: config.app.cors_allow_origins.length }) :
                        `${config.app.cors_allow_origins.length} configured`;

        const serviceTypeText = window.i18n ? window.i18n.t(`setup.database.service_type_${config.database.service_type}`) : config.database.service_type;
        let databaseSection = `
            <h4 data-i18n="setup.review.sections.database"></h4>
            <p><strong data-i18n="setup.review.fields.service_type"></strong>: ${serviceTypeText}</p>
            <p><strong data-i18n="setup.review.fields.host"></strong>: ${config.database.host}:${config.database.port}</p>
            <p><strong data-i18n="setup.review.fields.database"></strong>: ${config.database.name}</p>
            <p><strong data-i18n="setup.review.fields.app_user"></strong>: ${config.database.app_user}</p>`;

        if (config.database.service_type === 'docker' && config.database.super_user) {
            databaseSection += `
            <p><strong data-i18n="setup.review.fields.super_user"></strong>: ${config.database.super_user}</p>`;
        }

        document.getElementById('config-review').innerHTML = `
            <div style="text-align: left;">
                ${databaseSection}

                <h4 style="margin-top: 1.5rem;" data-i18n="setup.review.sections.redis"></h4>
                <p><strong data-i18n="setup.review.fields.service_type"></strong>: ${window.i18n ? window.i18n.t(`setup.redis.service_type_${config.redis.service_type}`) : config.redis.service_type}</p>
                <p><strong data-i18n="setup.review.fields.host"></strong>: ${config.redis.host}:${config.redis.port}</p>
                ${config.redis.user ? `<p><strong data-i18n="setup.review.fields.user"></strong>: ${config.redis.user}</p>` : ''}

                <h4 style="margin-top: 1.5rem;" data-i18n="setup.review.sections.smtp"></h4>
                <p><strong data-i18n="setup.review.fields.smtp_server"></strong>: ${config.smtp.server}:${config.smtp.port}</p>
                <p><strong data-i18n="setup.review.fields.smtp_user"></strong>: ${config.smtp.user}</p>
                <p><strong data-i18n="setup.review.fields.smtp_sender"></strong>: ${config.smtp.sender}</p>

                <h4 style="margin-top: 1.5rem;" data-i18n="setup.review.sections.application"></h4>
                <p><strong data-i18n="setup.review.fields.domain"></strong>: ${config.app.domain_name}</p>
                <p><strong data-i18n="setup.review.fields.static_host"></strong>: ${config.app.static_host_name}</p>
                <p><strong data-i18n="setup.review.fields.brand"></strong>: ${config.app.brand_name}</p>
                <p><strong data-i18n="setup.review.fields.version"></strong>: ${config.app.version || 'latest'}</p>
                <p><strong data-i18n="setup.review.fields.language"></strong>: ${config.app.default_lang}</p>
                <p><strong data-i18n="setup.review.fields.cors_origins"></strong>: ${corsText}</p>
                <p><strong data-i18n="setup.review.fields.jwt_mode"></strong>: ${config.app.jwt_key_from_file ? (window.i18n ? window.i18n.t('setup.review.jwt_from_file') : 'From File') : (window.i18n ? window.i18n.t('setup.review.jwt_auto_generate') : 'Auto Generate')}</p>
                ${config.app.jwt_key_from_file ? `
                    <p><strong data-i18n="setup.review.fields.jwt_file_path"></strong>: ${config.app.jwt_key_file_path}</p>
                ` : ''}

                <h4 style="margin-top: 1.5rem;" data-i18n="setup.review.sections.ssl"></h4>
                <p><strong data-i18n="setup.review.fields.ssl_enabled"></strong>: ${config.ssl.enabled ? (window.i18n ? window.i18n.t('common.yes') : 'Yes') : (window.i18n ? window.i18n.t('common.no') : 'No')}</p>
                ${config.ssl.enabled ? `
                    <p><strong data-i18n="setup.review.fields.ssl_cert_path"></strong>: ${config.ssl.cert_path}</p>
                    <p><strong data-i18n="setup.review.fields.ssl_key_path"></strong>: ${config.ssl.key_path}</p>
                    <p><strong data-i18n="setup.review.fields.ssl_use_setup_cert"></strong>: ${config.ssl.use_setup_cert ? (window.i18n ? window.i18n.t('common.yes') : 'Yes') : (window.i18n ? window.i18n.t('common.no') : 'No')}</p>
                ` : ''}

                <h4 style="margin-top: 1.5rem;" data-i18n="setup.review.sections.administrator"></h4>
                <p><strong data-i18n="setup.review.fields.username"></strong>: ${config.admin_user.username}</p>
                <p><strong data-i18n="setup.review.fields.email"></strong>: ${config.admin_user.email}</p>

                <h4 style="margin-top: 1.5rem;" data-i18n="setup.review.sections.oauth"></h4>
                <p><strong data-i18n="setup.review.fields.google_oauth"></strong>: ${config.oauth.google_enabled ? (window.i18n ? window.i18n.t('setup.review.fields.oauth_enabled') : 'Enabled') : (window.i18n ? window.i18n.t('setup.review.fields.oauth_disabled') : 'Disabled')}</p>
                <p><strong data-i18n="setup.review.fields.github_oauth"></strong>: ${config.oauth.github_enabled ? (window.i18n ? window.i18n.t('setup.review.fields.oauth_enabled') : 'Enabled') : (window.i18n ? window.i18n.t('setup.review.fields.oauth_disabled') : 'Disabled')}</p>

                <h4 style="margin-top: 1.5rem;" data-i18n="setup.review.sections.goaccess"></h4>
                <p><strong data-i18n="setup.review.fields.goaccess_enabled"></strong>: ${config.goaccess.enabled ? (window.i18n ? window.i18n.t('common.yes') : 'Yes') : (window.i18n ? window.i18n.t('common.no') : 'No')}</p>
                ${config.goaccess.enabled && config.goaccess.has_geo_file ? `
                    <p><strong data-i18n="setup.review.fields.goaccess_geo_file"></strong>: ${config.goaccess.original_file_name || 'GeoLite2-City.mmdb'}</p>
                ` : ''}
            </div>
        `;

    } catch (error) {
        document.getElementById('config-review').innerHTML = `
            <div class="alert alert-error">${window.i18n ? window.i18n.t('messages.failed_get_config') : 'Failed to load configuration'}: ${error.message}</div>
        `;
    }

    if (window.i18n) {
        window.i18n.applyTranslations();
    }
}

export function render(app, container) {
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
                    <button class="btn btn-secondary" onclick="app.previousStep()" data-i18n="common.previous"></button>
                    <button class="btn btn-success" onclick="app.generateConfig()" data-i18n="setup.review.generate_button"></button>
                </div>
            </div>
        `;
        
        loadConfigReview(app);
    }
    
