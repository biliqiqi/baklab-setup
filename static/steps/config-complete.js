export function render(app, container) {
        container.innerHTML = `
            <div class="form-section">
                <h3 style="text-align: center;">
                    <span style="color: var(--success-color); margin-right: 0.5rem;">✓</span>
                    <span data-i18n="setup.config_complete.title"></span>
                </h3>
                <p style="margin-bottom: 2rem; color: var(--gray-600); line-height: 1.6;" data-i18n="setup.config_complete.description"></p>

                <div style="background: var(--info-bg, #e3f2fd); border: 1px solid var(--info-border, #1976d2); border-radius: 4px; padding: 1rem; margin: 2rem 0;">
                    <p style="margin: 0 0 0.5rem 0; color: var(--gray-700); font-weight: 600;" data-i18n-html="setup.config_complete.ready_notice" id="ready-notice"></p>
                    <p style="margin: 0; color: var(--gray-600); line-height: 1.6;" data-i18n-html="setup.config_complete.ready_description" id="ready-description"></p>
                </div>

            </div>
        `;
        
        // 应用翻译，包含动态路径参数
        setTimeout(() => {
            if (window.i18n) {
                const outputPath = app.outputPath || './output';
                const params = { outputPath: outputPath };
                
                // 手动设置包含路径的翻译内容
                const readyNotice = document.getElementById('ready-notice');
                const readyDescription = document.getElementById('ready-description');
                
                if (readyNotice) {
                    const noticeText = window.i18n.t('setup.config_complete.ready_notice', params);
                    readyNotice.innerHTML = noticeText;
                    // 移除 data-i18n-html 属性，防止被 applyTranslations 覆盖
                    readyNotice.removeAttribute('data-i18n-html');
                }
                if (readyDescription) {
                    const descText = window.i18n.t('setup.config_complete.ready_description', params);
                    // 为长代码命令添加特殊样式处理
                    const processedText = descText.replace(/<code>([^<]*cd [^<]*)<\/code>/g, '<code class="complete-step-code">$1</code>');
                    readyDescription.innerHTML = processedText;
                    // 移除 data-i18n-html 属性，防止被 applyTranslations 覆盖
                    readyDescription.removeAttribute('data-i18n-html');
                }
                
            }
        }, 50);
    }
    
    
    // Step handlers
