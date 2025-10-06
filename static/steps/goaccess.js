import { formatFileSize } from '../api.js';
import { clearFormErrors, showFieldError, showFormErrors } from '../validator.js';

export function updateGeoFileDisplay(config) {
    const fileInfoDiv = document.getElementById('geo-file-info');
    const fileUploadContent = document.querySelector('#geo-upload-area .file-upload-content');

    if (!fileInfoDiv || !fileUploadContent) {
        return;
    }

    const goaccess = config.get('goaccess');

    if (goaccess.has_geo_file && goaccess.geo_file_temp_path) {
        fileUploadContent.style.display = 'none';
        fileInfoDiv.style.display = 'block';

        const fileName = goaccess.original_file_name || goaccess.geo_file_temp_path.split('/').pop();
        const fileSize = goaccess.file_size;

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

async function checkGeoFileStatus(apiClient, config) {
    try {
        const response = await apiClient.getGeoFileStatus();
        if (response.success && response.data) {
            const { exists, file_name, file_size, temp_path } = response.data;
            const goaccess = config.get('goaccess');

            if (goaccess.has_geo_file && !exists) {
                console.log('GeoIP file cache inconsistent with actual file status, resetting...');
                goaccess.has_geo_file = false;
                goaccess.geo_file_temp_path = '';
                goaccess.original_file_name = '';
                goaccess.file_size = 0;

                config.set('goaccess', goaccess);
                config.saveToLocalCache();
                updateGeoFileDisplay(config);
            }
            else if (!goaccess.has_geo_file && exists) {
                console.log('Found GeoIP file but cache shows no file, updating cache...');
                goaccess.has_geo_file = true;
                goaccess.geo_file_temp_path = temp_path;
                goaccess.original_file_name = file_name;
                goaccess.file_size = file_size;

                config.set('goaccess', goaccess);
                config.saveToLocalCache();
                updateGeoFileDisplay(config);
            }
        }
    } catch (error) {
        console.warn('Failed to check GeoIP file status:', error);
    }
}

async function handleGeoFileSelect(apiClient, config, file, fileInfoDivParam) {
    const fileInfoDiv = fileInfoDivParam || document.getElementById('geo-file-info');
    const uploadArea = document.getElementById('geo-upload-area');

    try {
        const result = await apiClient.protectedApiCall('geoFileUpload', async () => {
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

            const uploadResult = await apiClient.uploadGeoFile(file);

            if (uploadResult.success) {
                const progressEl = fileInfoDiv.querySelector('#geo-upload-progress');
                if (progressEl) {
                    const successText = window.i18n ? window.i18n.t('setup.app.jwt_upload_success') : 'Upload successful!';
                    progressEl.textContent = successText;
                    progressEl.style.color = 'var(--success-color)';
                }

                const goaccess = config.get('goaccess');
                goaccess.has_geo_file = true;
                goaccess.geo_file_temp_path = uploadResult.data.temp_path;
                goaccess.original_file_name = file.name;
                goaccess.file_size = file.size;
                config.set('goaccess', goaccess);

                if (uploadArea) {
                    uploadArea.style.pointerEvents = '';
                    uploadArea.style.opacity = '';
                }

                return uploadResult;
            } else {
                throw new Error(uploadResult.message || 'Upload failed');
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

        const goaccess = config.get('goaccess');
        goaccess.has_geo_file = false;
        config.set('goaccess', goaccess);

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

function validateGoAccessForm(config, form) {
    let valid = true;
    clearFormErrors(form);

    const goAccessEnabled = form.querySelector('#goaccess-enabled').checked;
    const goaccess = config.get('goaccess');

    if (goAccessEnabled) {
        if (!goaccess.has_geo_file ||
            (goaccess.has_geo_file && !goaccess.geo_file_temp_path)) {
            valid = false;
            const uploadArea = form.querySelector('#geo-upload-area');
            let errorMessage;

            if (!goaccess.has_geo_file) {
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

export function render(container, { config, navigation, apiClient }) {
        const goaccess = config.get('goaccess');

        container.innerHTML = `
            <form id="goaccess-form" class="form-section" novalidate>
                <h3 data-i18n="setup.goaccess.title"></h3>
                <p style="margin-bottom: 1.5rem; color: var(--gray-600);" data-i18n="setup.goaccess.description"></p>

                <div class="form-group">
                    <label class="checkbox-label">
                        <input type="checkbox" id="goaccess-enabled" name="enabled" ${goaccess.enabled ? 'checked' : ''}>
                        <span data-i18n="setup.goaccess.enable_label"></span>
                    </label>
                </div>

                <div id="goaccess-config" style="display: ${goaccess.enabled ? 'block' : 'none'};">
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
                    <button type="button" class="btn btn-secondary" id="goaccess-prev-btn">
                        <span data-i18n="common.previous"></span>
                    </button>
                    <button type="submit" class="btn btn-primary">
                        <span data-i18n="common.next"></span>
                    </button>
                </div>
            </form>
        `;

        document.getElementById('goaccess-prev-btn').addEventListener('click', () => {
            navigation.previousStep();
        });

        const enabledCheckbox = container.querySelector('#goaccess-enabled');
        const configDiv = container.querySelector('#goaccess-config');
        const fileInput = container.querySelector('#goaccess-geo-file');
        const uploadArea = container.querySelector('#geo-upload-area');
        const fileInfo = container.querySelector('#file-info');

        enabledCheckbox.addEventListener('change', (e) => {
            configDiv.style.display = e.target.checked ? 'block' : 'none';
            const goaccessConfig = config.get('goaccess');
            goaccessConfig.enabled = e.target.checked;
            config.set('goaccess', goaccessConfig);

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
            if (apiClient.requestLocks.geoFileUpload) {
                const warningMsg = window.i18n ? window.i18n.t('setup.app.jwt_uploading') : 'File upload in progress...';
                alert(warningMsg);
                return;
            }
            const files = e.dataTransfer.files;
            if (files.length > 0) {
                handleGeoFileSelect(apiClient, config, files[0], fileInfo);
            }
        });

        const selectBtn = container.querySelector('#geo-file-select-btn');
        if (selectBtn) {
            selectBtn.addEventListener('click', () => {
                if (apiClient.requestLocks.geoFileUpload) {
                    const warningMsg = window.i18n ? window.i18n.t('setup.app.jwt_uploading') : 'File upload in progress...';
                    alert(warningMsg);
                    return;
                }
                fileInput.click();
            });
        }

        const reselectBtn = container.querySelector('#geo-reselect-btn');
        if (reselectBtn) {
            reselectBtn.addEventListener('click', () => {
                showGeoUploadArea();
            });
        }

        fileInput.addEventListener('change', (e) => {
            if (e.target.files.length > 0) {
                if (apiClient.requestLocks.geoFileUpload) {
                    const warningMsg = window.i18n ? window.i18n.t('setup.app.jwt_uploading') : 'File upload in progress...';
                    alert(warningMsg);
                    e.target.value = '';
                    return;
                }
                handleGeoFileSelect(apiClient, config, e.target.files[0], fileInfo);
            }
        });

        container.querySelector('#goaccess-form').addEventListener('submit', (e) => {
            e.preventDefault();
            if (validateGoAccessForm(config, e.target)) {
                const form = e.target;
                const goaccessConfig = config.get('goaccess');
                goaccessConfig.enabled = form.querySelector('#goaccess-enabled').checked;
                config.set('goaccess', goaccessConfig);
                config.saveToLocalCache();
                navigation.nextStep();
            } else {
                showFormErrors(e.target);
            }
        });

        checkGeoFileStatus(apiClient, config);
    }

