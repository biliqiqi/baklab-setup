import { formatFileSize } from '../api.js';
import { clearFormErrors, showFieldError, showFormErrors } from '../validator.js';

export function updateGeoFileDisplay(app) {
    const fileInfoDiv = document.getElementById('geo-file-info');
    const fileUploadContent = document.querySelector('#geo-upload-area .file-upload-content');

    if (!fileInfoDiv || !fileUploadContent) {
        return;
    }

    if (app.config.goaccess.has_geo_file && app.config.goaccess.geo_file_temp_path) {
        fileUploadContent.style.display = 'none';
        fileInfoDiv.style.display = 'block';

        const fileName = app.config.goaccess.original_file_name || app.config.goaccess.geo_file_temp_path.split('/').pop();
        const fileSize = app.config.goaccess.file_size;

        const fileNameEl = fileInfoDiv.querySelector('#geo-file-name');
        const fileSizeEl = fileInfoDiv.querySelector('#geo-file-size');

        if (fileNameEl) fileNameEl.textContent = fileName;
        if (fileSizeEl) {
            fileSizeEl.textContent = (typeof fileSize === 'number' && fileSize > 0) ?
                formatFileSize(fileSize) : 'Unknown';
        }

        const existingProgress = fileInfoDiv.querySelector('#geo-upload-progress');
        if (existingProgress) {
            existingProgress.remove();
        }

        if (!fileInfoDiv.querySelector('#geo-upload-progress')) {
            const successText = window.i18n ? window.i18n.t('setup.app.jwt_upload_success') : 'Upload successful!';
            const successElement = document.createElement('p');
            successElement.id = 'geo-upload-progress';
            successElement.textContent = successText;
            successElement.style.color = 'var(--success-color)';
            fileInfoDiv.appendChild(successElement);
        }
    } else {
        fileUploadContent.style.display = 'block';
        fileInfoDiv.style.display = 'none';
    }
}

async function checkGeoFileStatus(app) {
    try {
        const response = await app.apiClient.getGeoFileStatus();
        if (response.success && response.data) {
            const { exists, file_name, file_size, temp_path } = response.data;

            if (app.config.goaccess.has_geo_file && !exists) {
                console.log('GeoIP file cache inconsistent with actual file status, resetting...');
                app.config.goaccess.has_geo_file = false;
                app.config.goaccess.geo_file_temp_path = '';
                app.config.goaccess.original_file_name = '';
                app.config.goaccess.file_size = 0;

                app.saveToLocalCache();
                updateGeoFileDisplay(app);
            }
            else if (!app.config.goaccess.has_geo_file && exists) {
                console.log('Found GeoIP file but cache shows no file, updating cache...');
                app.config.goaccess.has_geo_file = true;
                app.config.goaccess.geo_file_temp_path = temp_path;
                app.config.goaccess.original_file_name = file_name;
                app.config.goaccess.file_size = file_size;

                app.saveToLocalCache();
                updateGeoFileDisplay(app);
            }
        }
    } catch (error) {
        console.warn('Failed to check GeoIP file status:', error);
    }
}

async function handleGeoFileSelect(app, file, fileInfoDivParam) {
    const fileInfoDiv = fileInfoDivParam || document.getElementById('geo-file-info');
    const uploadArea = document.getElementById('geo-upload-area');

    try {
        const result = await app.apiClient.protectedApiCall('geoFileUpload', async () => {
            if (!fileInfoDiv) {
                console.error('fileInfoDiv is null in handleGeoFileSelect');
                return;
            }

            if (!file.name.endsWith('.mmdb')) {
                const errorMsg = window.i18n ? window.i18n.t('setup.goaccess.invalid_file_type') :
                               'Please select a valid .mmdb file';
                alert(errorMsg);
                return;
            }

            const maxSize = 100 * 1024 * 1024;
            if (file.size > maxSize) {
                const errorMsg = window.i18n ? window.i18n.t('setup.goaccess.file_too_large') :
                               'File size too large. Maximum allowed size is 100MB';
                alert(errorMsg);
                return;
            }

            if (uploadArea) {
                const formGroup = uploadArea.closest('.form-group');
                if (formGroup) {
                    formGroup.classList.remove('error');
                    const errorMessage = formGroup.querySelector('.invalid-feedback');
                    if (errorMessage) {
                        errorMessage.style.display = 'none';
                        errorMessage.textContent = '';
                    }
                }
            }

            const fileUploadContent = document.querySelector('#geo-upload-area .file-upload-content');
            if (fileUploadContent) {
                fileUploadContent.style.display = 'none';
            }

            if (uploadArea) {
                uploadArea.style.pointerEvents = 'none';
                uploadArea.style.opacity = '0.6';
            }

            fileInfoDiv.style.display = 'block';
            fileInfoDiv.querySelector('#geo-file-name').textContent = file.name;
            fileInfoDiv.querySelector('#geo-file-size').textContent = formatFileSize(file.size);

            const existingProgress = fileInfoDiv.querySelector('#geo-upload-progress');
            if (existingProgress) {
                existingProgress.remove();
            }

            const uploadingText = window.i18n ? window.i18n.t('setup.app.jwt_uploading') : 'Uploading...';
            const progressElement = document.createElement('p');
            progressElement.id = 'geo-upload-progress';
            progressElement.textContent = uploadingText;
            fileInfoDiv.appendChild(progressElement);

            const formData = new FormData();
            formData.append('geo_file', file);

            const response = await fetch('/api/upload/geo-file', {
                method: 'POST',
                headers: {
                    'Setup-Token': app.token
                },
                body: formData
            });

            const result = await response.json();

            if (result.success) {
                const progressEl = fileInfoDiv.querySelector('#geo-upload-progress');
                if (progressEl) {
                    const successText = window.i18n ? window.i18n.t('setup.app.jwt_upload_success') : 'Upload successful!';
                    progressEl.textContent = successText;
                    progressEl.style.color = 'var(--success-color)';
                }

                app.config.goaccess.has_geo_file = true;
                app.config.goaccess.geo_file_temp_path = result.data.temp_path;
                app.config.goaccess.original_file_name = file.name;
                app.config.goaccess.file_size = file.size;

                if (uploadArea) {
                    uploadArea.style.pointerEvents = '';
                    uploadArea.style.opacity = '';
                }

                return result;
            } else {
                throw new Error(result.message || 'Upload failed');
            }
        });

        if (!result) return;
    } catch (error) {
        console.error('File upload error:', error);
        if (fileInfoDiv) {
            const progressEl = fileInfoDiv.querySelector('#geo-upload-progress');
            if (progressEl) {
                const failedText = window.i18n ? window.i18n.t('setup.app.jwt_upload_failed') : 'Upload failed';
                progressEl.textContent = `${failedText}: ${error.message}`;
                progressEl.style.color = 'var(--error-color)';
            }
        }

        if (uploadArea) {
            uploadArea.style.pointerEvents = '';
            uploadArea.style.opacity = '';
        }

        app.config.goaccess.has_geo_file = false;

        setTimeout(() => {
            showGeoUploadArea();
        }, 2000);
    }
}

function showGeoUploadArea() {
    const fileInfoDiv = document.getElementById('geo-file-info');
    const fileUploadContent = document.querySelector('#geo-upload-area .file-upload-content');

    if (fileInfoDiv && fileUploadContent) {
        fileInfoDiv.style.display = 'none';
        fileUploadContent.style.display = 'block';

        const fileInput = document.getElementById('goaccess-geo-file');
        if (fileInput) {
            fileInput.value = '';
        }
    }
}

function validateGoAccessForm(app, form) {
    let valid = true;
    clearFormErrors(form);

    const goAccessEnabled = form.querySelector('#goaccess-enabled').checked;

    if (goAccessEnabled) {
        if (!app.config.goaccess.has_geo_file ||
            (app.config.goaccess.has_geo_file && !app.config.goaccess.geo_file_temp_path)) {
            valid = false;
            const uploadArea = form.querySelector('#geo-upload-area');
            let errorMessage;

            if (!app.config.goaccess.has_geo_file) {
                errorMessage = window.i18n ? window.i18n.t('setup.goaccess.geo_file_required') :
                               'GeoIP database file is required when GoAccess is enabled';
            } else {
                errorMessage = 'GeoIP database file is no longer available. Please re-upload your GeoIP database file.';
            }

            showFieldError(uploadArea, errorMessage);
        }
    }

    return valid;
}

export function render(app, container) {
        container.innerHTML = `
            <form id="goaccess-form" class="form-section" novalidate>
                <h3 data-i18n="setup.goaccess.title"></h3>
                <p style="margin-bottom: 1.5rem; color: var(--gray-600);" data-i18n="setup.goaccess.description"></p>
                
                <div class="form-group">
                    <label class="checkbox-label">
                        <input type="checkbox" id="goaccess-enabled" name="enabled" ${app.config.goaccess.enabled ? 'checked' : ''}>
                        <span data-i18n="setup.goaccess.enable_label"></span>
                    </label>
                </div>
                
                <div id="goaccess-config" style="display: ${app.config.goaccess.enabled ? 'block' : 'none'};">
                    <div class="form-group">
                        <label for="goaccess-geo-file"><span data-i18n="setup.goaccess.geo_file_label"></span></label>
                        <div class="file-upload-area" id="geo-upload-area">
                            <input type="file" id="goaccess-geo-file" name="geo_file" accept=".mmdb" style="display: none;">
                            <div class="file-upload-content">
                                <div class="file-upload-icon">📁</div>
                                <p data-i18n="setup.goaccess.geo_file_help"></p>
                                <button type="button" class="btn-secondary" id="geo-file-select-btn">
                                    <span data-i18n="setup.goaccess.select_file"></span>
                                </button>
                            </div>
                            <div id="geo-file-info" style="display: none;">
                                <p><strong data-i18n="setup.goaccess.selected_file"></strong>: <span id="geo-file-name"></span></p>
                                <p><strong data-i18n="setup.goaccess.file_size"></strong>: <span id="geo-file-size"></span></p>
                                <button type="button" id="geo-reselect-btn" class="btn-secondary" style="margin-top: 0.5rem;">
                                    <span data-i18n="setup.goaccess.select_file"></span>
                                </button>
                            </div>
                        </div>
                        <div class="invalid-feedback" style="display: none;"></div>
                        <div class="form-help">
                            <span data-i18n="setup.goaccess.geo_file_note"></span>
                            <a href="https://dev.maxmind.com/geoip/geolite2-free-geolocation-data" target="_blank" data-i18n="setup.goaccess.download_link"></a>
                        </div>
                    </div>
                </div>
                
                <div class="btn-group">
                    <button type="button" class="btn btn-secondary" onclick="app.previousStep()">
                        <span data-i18n="common.previous"></span>
                    </button>
                    <button type="submit" class="btn btn-primary">
                        <span data-i18n="common.next"></span>
                    </button>
                </div>
            </form>
        `;

        // 绑定事件监听器
        const enabledCheckbox = container.querySelector('#goaccess-enabled');
        const configDiv = container.querySelector('#goaccess-config');
        const fileInput = container.querySelector('#goaccess-geo-file');
        const uploadArea = container.querySelector('#geo-upload-area');
        const fileInfo = container.querySelector('#file-info');

        enabledCheckbox.addEventListener('change', (e) => {
            configDiv.style.display = e.target.checked ? 'block' : 'none';
            app.config.goaccess.enabled = e.target.checked;
            
            // 如果禁用 GoAccess，清除文件上传错误状态
            if (!e.target.checked) {
                const formGroup = uploadArea.closest('.form-group');
                if (formGroup) {
                    formGroup.classList.remove('error');
                    const errorMessage = formGroup.querySelector('.invalid-feedback');
                    if (errorMessage) {
                        errorMessage.style.display = 'none';
                        errorMessage.textContent = '';
                    }
                }
            }
        });

        // 文件拖拽支持
        uploadArea.addEventListener('dragover', (e) => {
            e.preventDefault();
            uploadArea.classList.add('drag-over');
        });

        uploadArea.addEventListener('dragleave', (e) => {
            e.preventDefault();
            uploadArea.classList.remove('drag-over');
        });

        uploadArea.addEventListener('drop', (e) => {
            e.preventDefault();
            uploadArea.classList.remove('drag-over');
            // 检查是否有上传正在进行中
            if (app.apiClient.requestLocks.geoFileUpload) {
                const warningMsg = window.i18n ? window.i18n.t('setup.app.jwt_uploading') : 'File upload in progress...';
                alert(warningMsg);
                return;
            }
            const files = e.dataTransfer.files;
            if (files.length > 0) {
                handleGeoFileSelect(app, files[0], fileInfo);
            }
        });

        // 文件选择按钮点击事件
        const selectBtn = container.querySelector('#geo-file-select-btn');
        if (selectBtn) {
            selectBtn.addEventListener('click', () => {
                // 检查是否有上传正在进行中
                if (app.apiClient.requestLocks.geoFileUpload) {
                    const warningMsg = window.i18n ? window.i18n.t('setup.app.jwt_uploading') : 'File upload in progress...';
                    alert(warningMsg);
                    return;
                }
                fileInput.click();
            });
        }

        // 重新选择文件按钮点击事件
        const reselectBtn = container.querySelector('#geo-reselect-btn');
        if (reselectBtn) {
            reselectBtn.addEventListener('click', () => {
                showGeoUploadArea();
            });
        }

        fileInput.addEventListener('change', (e) => {
            if (e.target.files.length > 0) {
                // 检查是否有上传正在进行中
                if (app.apiClient.requestLocks.geoFileUpload) {
                    const warningMsg = window.i18n ? window.i18n.t('setup.app.jwt_uploading') : 'File upload in progress...';
                    alert(warningMsg);
                    e.target.value = ''; // 清空文件选择
                    return;
                }
                handleGeoFileSelect(app, e.target.files[0], fileInfo);
            }
        });

        // 表单提交
        container.querySelector('#goaccess-form').addEventListener('submit', (e) => {
            e.preventDefault();
            if (validateGoAccessForm(app, e.target)) {
                const form = e.target;
                app.config.goaccess.enabled = form.querySelector('#goaccess-enabled').checked;
                app.saveToLocalCache();
                app.nextStep();
            } else {
                showFormErrors(e.target);
            }
        });

        // 检查实际的GeoIP文件状态，确保缓存与实际文件同步
        checkGeoFileStatus(app);
    }

