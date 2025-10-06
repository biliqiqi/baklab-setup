package web

import (
	"crypto/x509"
	"encoding/json"
	"encoding/pem"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"strings"

	"github.com/biliqiqi/baklab-setup/internal/i18n"
	"github.com/biliqiqi/baklab-setup/internal/model"
	"github.com/biliqiqi/baklab-setup/internal/services"
	"golang.org/x/text/language"
)

type SetupHandlers struct {
	setupService *services.SetupService
	i18nManager  *i18n.I18nManager
	devMode      bool
	certPath     string
	keyPath      string
}

func NewSetupHandlers(setupService *services.SetupService, i18nManager *i18n.I18nManager, devMode bool, certPath, keyPath string) *SetupHandlers {
	return &SetupHandlers{
		setupService: setupService,
		i18nManager:  i18nManager,
		devMode:      devMode,
		certPath:     certPath,
		keyPath:      keyPath,
	}
}

func (h *SetupHandlers) getLocalizerFromContext(r *http.Request) *i18n.I18nCustom {
	if h.i18nManager != nil {
		if lang, ok := r.Context().Value(MiddlewareI18nLangKey).(language.Tag); ok {
			return h.i18nManager.GetLocalizer(lang)
		}
		lang := GetAcceptLang(r)
		return h.i18nManager.GetLocalizer(lang)
	}
	return i18n.New(language.English)
}

func (h *SetupHandlers) localizeMessage(r *http.Request, messageKey string, data ...interface{}) string {
	localizer := h.getLocalizerFromContext(r)
	if len(data) > 0 {
		return localizer.LocalTpl(messageKey, data...)
	}
	return localizer.LocalTpl(messageKey)
}

func (h *SetupHandlers) translateValidationErrors(r *http.Request, errors []model.ValidationError) {
	for i := range errors {
		if strings.HasPrefix(errors[i].Message, "key:") {
			messageKey := strings.TrimPrefix(errors[i].Message, "key:")
			errors[i].Message = h.localizeMessage(r, messageKey)
		}
	}
}

func (h *SetupHandlers) translateConnectionResults(r *http.Request, results []model.ConnectionTestResult) {
	for i := range results {
		if strings.HasPrefix(results[i].Message, "key:") {
			messageKey := strings.TrimPrefix(results[i].Message, "key:")
			results[i].Message = h.localizeMessage(r, messageKey)
		}
	}
}

func (h *SetupHandlers) IndexHandler(w http.ResponseWriter, r *http.Request) {
	if h.devMode {
		h.renderSetupPage(w, r)
		return
	}

	token := r.Header.Get("Setup-Token")
	if token == "" {
		token = r.URL.Query().Get("token")
	}

	if token == "" {
		h.renderUnauthorizedPage(w, r)
		return
	}

	clientIP := getClientIP(r)
	if err := h.setupService.ValidateSetupToken(token, clientIP); err != nil {
		h.renderUnauthorizedPage(w, r)
		return
	}

	completed, err := h.setupService.IsSetupCompleted()
	if err != nil {
		h.writeJSONResponse(w, model.SetupResponse{
			Success: false,
			Message: h.localizeMessage(r, "messages.errors.failed_check_status"),
		}, http.StatusInternalServerError)
		return
	}

	if completed {
		h.writeJSONResponse(w, model.SetupResponse{
			Success: false,
			Message: h.localizeMessage(r, "messages.errors.setup_already_completed"),
		}, http.StatusForbidden)
		return
	}

	h.renderSetupPage(w, r)
}

func (h *SetupHandlers) InitializeHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		h.writeJSONResponse(w, model.SetupResponse{
			Success: false,
			Message: h.localizeMessage(r, "messages.errors.method_not_allowed"),
		}, http.StatusMethodNotAllowed)
		return
	}

	clientIP := getClientIP(r)

	token, err := h.setupService.InitializeSetup(clientIP)
	if err != nil {
		h.writeJSONResponse(w, model.SetupResponse{
			Success: false,
			Message: err.Error(),
		}, http.StatusBadRequest)
		return
	}

	h.writeJSONResponse(w, model.SetupResponse{
		Success: true,
		Message: h.localizeMessage(r, "messages.setup_initialized"),
		Data: map[string]interface{}{
			"token":      token.Token,
			"expires_at": token.ExpiresAt,
		},
	}, http.StatusOK)
}

func (h *SetupHandlers) StatusHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		h.writeJSONResponse(w, model.SetupResponse{
			Success: false,
			Message: h.localizeMessage(r, "messages.errors.method_not_allowed"),
		}, http.StatusMethodNotAllowed)
		return
	}

	state, err := h.setupService.GetSetupStatus()
	if err != nil {
		h.writeJSONResponse(w, model.SetupResponse{
			Success: false,
			Message: h.localizeMessage(r, "messages.failed_get_setup_status"),
		}, http.StatusInternalServerError)
		return
	}

	var revisionMode map[string]interface{}
	if cfg, err := h.setupService.GetSetupConfig(); err == nil && cfg.RevisionMode.Enabled {
		revisionMode = map[string]interface{}{
			"enabled":        cfg.RevisionMode.Enabled,
			"imported_at":    cfg.RevisionMode.ImportedAt,
			"modified_steps": cfg.RevisionMode.ModifiedSteps,
		}
	}

	safeState := map[string]interface{}{
		"status":        state.Status,
		"current_step":  state.CurrentStep,
		"progress":      state.Progress,
		"message":       state.Message,
		"updated_at":    state.UpdatedAt,
		"revision_mode": revisionMode,
	}

	h.writeJSONResponse(w, model.SetupResponse{
		Success: true,
		Data:    safeState,
	}, http.StatusOK)
}

func (h *SetupHandlers) SaveConfigHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		h.writeJSONResponse(w, model.SetupResponse{
			Success: false,
			Message: h.localizeMessage(r, "messages.errors.method_not_allowed"),
		}, http.StatusMethodNotAllowed)
		return
	}

	var cfg model.SetupConfig
	if err := json.NewDecoder(r.Body).Decode(&cfg); err != nil {
		h.writeJSONResponse(w, model.SetupResponse{
			Success: false,
			Message: h.localizeMessage(r, "messages.errors.invalid_json"),
		}, http.StatusBadRequest)
		return
	}

	validator := services.NewValidatorService()
	errors := validator.ValidateConfig(&cfg)

	if len(errors) > 0 {
		h.translateValidationErrors(r, errors)
		h.writeJSONResponse(w, model.SetupResponse{
			Success: false,
			Message: h.localizeMessage(r, "messages.configuration_validation_failed"),
			Errors:  errors,
		}, http.StatusBadRequest)
		return
	}

	if err := h.setupService.SaveConfiguration(&cfg); err != nil {
		h.writeJSONResponse(w, model.SetupResponse{
			Success: false,
			Message: err.Error(),
		}, http.StatusBadRequest)
		return
	}

	h.writeJSONResponse(w, model.SetupResponse{
		Success: true,
		Message: h.localizeMessage(r, "messages.config_saved"),
	}, http.StatusOK)
}

func (h *SetupHandlers) GetConfigHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		h.writeJSONResponse(w, model.SetupResponse{
			Success: false,
			Message: h.localizeMessage(r, "messages.errors.method_not_allowed"),
		}, http.StatusMethodNotAllowed)
		return
	}

	cfg, err := h.setupService.GetSetupConfig()
	if err != nil {
		h.writeJSONResponse(w, model.SetupResponse{
			Success: false,
			Message: h.localizeMessage(r, "messages.failed_get_configuration"),
		}, http.StatusInternalServerError)
		return
	}

	safeCfg := *cfg
	safeCfg.Database.SuperPassword = ""
	safeCfg.Database.AppPassword = ""
	safeCfg.Redis.Password = ""
	safeCfg.Redis.AdminPassword = ""
	safeCfg.SMTP.Password = ""
	safeCfg.AdminUser.Password = ""

	h.writeJSONResponse(w, model.SetupResponse{
		Success: true,
		Data:    safeCfg,
	}, http.StatusOK)
}

func (h *SetupHandlers) TestConnectionsHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		h.writeJSONResponse(w, model.SetupResponse{
			Success: false,
			Message: h.localizeMessage(r, "messages.errors.method_not_allowed"),
		}, http.StatusMethodNotAllowed)
		return
	}

	var cfg model.SetupConfig
	if err := json.NewDecoder(r.Body).Decode(&cfg); err != nil {
		h.writeJSONResponse(w, model.SetupResponse{
			Success: false,
			Message: h.localizeMessage(r, "messages.errors.invalid_json"),
		}, http.StatusBadRequest)
		return
	}

	results, err := h.setupService.TestConnections(&cfg)
	if err != nil {
		h.writeJSONResponse(w, model.SetupResponse{
			Success: false,
			Message: err.Error(),
		}, http.StatusInternalServerError)
		return
	}

	h.translateConnectionResults(r, results)

	h.writeJSONResponse(w, model.SetupResponse{
		Success: true,
		Data:    results,
	}, http.StatusOK)
}

func (h *SetupHandlers) GenerateConfigHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		h.writeJSONResponse(w, model.SetupResponse{
			Success: false,
			Message: h.localizeMessage(r, "messages.errors.method_not_allowed"),
		}, http.StatusMethodNotAllowed)
		return
	}

	cfg, err := h.setupService.GetSetupConfig()
	if err != nil {
		h.writeJSONResponse(w, model.SetupResponse{
			Success: false,
			Message: h.localizeMessage(r, "messages.failed_get_configuration"),
		}, http.StatusInternalServerError)
		return
	}

	if err := h.setupService.GenerateConfigFiles(cfg); err != nil {
		h.writeJSONResponse(w, model.SetupResponse{
			Success: false,
			Message: err.Error(),
		}, http.StatusInternalServerError)
		return
	}

	outputPath, err := h.setupService.GetOutputDirPath()
	if err != nil {
		log.Printf("Warning: failed to get output directory path: %v", err)
		outputPath = "./output" // fallback to relative path
	}

	h.writeJSONResponse(w, model.SetupResponse{
		Success: true,
		Message: h.localizeMessage(r, "messages.configuration_files_generated_successfully"),
		Data: map[string]interface{}{
			"output_path": outputPath,
		},
	}, http.StatusOK)
}

func (h *SetupHandlers) CompleteSetupHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		h.writeJSONResponse(w, model.SetupResponse{
			Success: false,
			Message: h.localizeMessage(r, "messages.errors.method_not_allowed"),
		}, http.StatusMethodNotAllowed)
		return
	}

	completed, err := h.setupService.IsSetupCompleted()
	if err != nil {
		h.writeJSONResponse(w, model.SetupResponse{
			Success: false,
			Message: h.localizeMessage(r, "messages.errors.failed_check_status"),
		}, http.StatusInternalServerError)
		return
	}

	if completed {
		h.writeJSONResponse(w, model.SetupResponse{
			Success: true,
			Message: h.localizeMessage(r, "messages.setup_already_completed"),
		}, http.StatusOK)
		return
	}

	if err := h.setupService.CompleteSetup(); err != nil {
		h.writeJSONResponse(w, model.SetupResponse{
			Success: false,
			Message: err.Error(),
		}, http.StatusInternalServerError)
		return
	}

	h.writeJSONResponse(w, model.SetupResponse{
		Success: true,
		Message: h.localizeMessage(r, "messages.setup_completed"),
	}, http.StatusOK)
}

func (h *SetupHandlers) ValidateConfigHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		h.writeJSONResponse(w, model.SetupResponse{
			Success: false,
			Message: h.localizeMessage(r, "messages.errors.method_not_allowed"),
		}, http.StatusMethodNotAllowed)
		return
	}

	var cfg model.SetupConfig
	if err := json.NewDecoder(r.Body).Decode(&cfg); err != nil {
		h.writeJSONResponse(w, model.SetupResponse{
			Success: false,
			Message: h.localizeMessage(r, "messages.errors.invalid_json"),
		}, http.StatusBadRequest)
		return
	}

	validator := services.NewValidatorService()
	errors := validator.ValidateConfig(&cfg)

	if len(errors) > 0 {
		h.translateValidationErrors(r, errors)
		h.writeJSONResponse(w, model.SetupResponse{
			Success: false,
			Message: h.localizeMessage(r, "messages.configuration_validation_failed"),
			Errors:  errors,
		}, http.StatusBadRequest)
		return
	}

	h.writeJSONResponse(w, model.SetupResponse{
		Success: true,
		Message: h.localizeMessage(r, "messages.configuration_is_valid"),
	}, http.StatusOK)
}

func (h *SetupHandlers) writeJSONResponse(w http.ResponseWriter, response model.SetupResponse, statusCode int) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(statusCode)
	if err := json.NewEncoder(w).Encode(response); err != nil {
		log.Printf("Warning: failed to encode JSON response: %v", err)
	}
}

func (h *SetupHandlers) UploadGeoFileHandler(w http.ResponseWriter, r *http.Request) {
	maxSize := int64(100 * 1024 * 1024) // 100MB
	r.Body = http.MaxBytesReader(w, r.Body, maxSize)

	if err := r.ParseMultipartForm(maxSize); err != nil {
		log.Printf("Failed to parse multipart form: %v", err)
		h.writeJSONResponse(w, model.SetupResponse{
			Success: false,
			Message: h.localizeMessage(r, "messages.file_too_large_or_invalid_form_data"),
		}, http.StatusBadRequest)
		return
	}

	file, handler, err := r.FormFile("geo_file")
	if err != nil {
		log.Printf("Failed to get form file: %v", err)
		h.writeJSONResponse(w, model.SetupResponse{
			Success: false,
			Message: h.localizeMessage(r, "messages.no_file_uploaded_or_invalid_file_field"),
		}, http.StatusBadRequest)
		return
	}
	defer file.Close()

	if !strings.HasSuffix(strings.ToLower(handler.Filename), ".mmdb") {
		h.writeJSONResponse(w, model.SetupResponse{
			Success: false,
			Message: h.localizeMessage(r, "messages.invalid_file_type_mmdb"),
		}, http.StatusBadRequest)
		return
	}

	if handler.Size > maxSize {
		h.writeJSONResponse(w, model.SetupResponse{
			Success: false,
			Message: h.localizeMessage(r, "messages.file_too_large_max_100mb"),
		}, http.StatusBadRequest)
		return
	}

	tempDir := filepath.Join("./data", "temp")
	if err := os.MkdirAll(tempDir, 0755); err != nil {
		log.Printf("Failed to create temp directory: %v", err)
		h.writeJSONResponse(w, model.SetupResponse{
			Success: false,
			Message: h.localizeMessage(r, "messages.failed_create_upload_directory"),
		}, http.StatusInternalServerError)
		return
	}

	destPath := filepath.Join(tempDir, "GeoLite2-City.mmdb")
	destFile, err := os.Create(destPath)
	if err != nil {
		log.Printf("Failed to create destination file: %v", err)
		h.writeJSONResponse(w, model.SetupResponse{
			Success: false,
			Message: h.localizeMessage(r, "messages.failed_create_destination_file"),
		}, http.StatusInternalServerError)
		return
	}
	defer destFile.Close()

	bytesWritten, err := io.Copy(destFile, file)
	if err != nil {
		log.Printf("Failed to copy file: %v", err)
		os.Remove(destPath)
		h.writeJSONResponse(w, model.SetupResponse{
			Success: false,
			Message: h.localizeMessage(r, "messages.failed_save_file"),
		}, http.StatusInternalServerError)
		return
	}

	log.Printf("GeoIP file uploaded to temp directory: %s (%d bytes)", destPath, bytesWritten)

	h.writeJSONResponse(w, model.SetupResponse{
		Success: true,
		Message: h.localizeMessage(r, "messages.geoip_file_uploaded_successfully"),
		Data: map[string]interface{}{
			"filename":      "GeoLite2-City.mmdb",
			"size":          bytesWritten,
			"original_name": handler.Filename,
			"temp_path":     destPath,
		},
	}, http.StatusOK)
}

func (h *SetupHandlers) CheckGeoFileStatusHandler(w http.ResponseWriter, r *http.Request) {
	tempFilePath := filepath.Join("./data", "temp", "GeoLite2-City.mmdb")

	fileExists := false
	var fileSize int64 = 0
	var fileName string = ""

	if fileInfo, err := os.Stat(tempFilePath); err == nil {
		fileExists = true
		fileSize = fileInfo.Size()
		fileName = "GeoLite2-City.mmdb"
	}

	h.writeJSONResponse(w, model.SetupResponse{
		Success: true,
		Message: "GeoIP file status checked",
		Data: map[string]interface{}{
			"exists":    fileExists,
			"file_name": fileName,
			"file_size": fileSize,
			"temp_path": tempFilePath,
		},
	}, http.StatusOK)
}


func validateJWTKeyFile(keyBytes []byte) error {
	block, _ := pem.Decode(keyBytes)
	if block == nil {
		return fmt.Errorf("invalid PEM format")
	}

	switch block.Type {
	case "PRIVATE KEY":
		_, err := x509.ParsePKCS8PrivateKey(block.Bytes)
		if err != nil {
			return fmt.Errorf("invalid PKCS#8 private key: %w", err)
		}
		return nil

	case "RSA PRIVATE KEY":
		_, err := x509.ParsePKCS1PrivateKey(block.Bytes)
		if err != nil {
			return fmt.Errorf("invalid PKCS#1 RSA private key: %w", err)
		}
		return nil

	default:
		return fmt.Errorf("unsupported PEM block type: %s. Expected 'PRIVATE KEY' (PKCS#8) or 'RSA PRIVATE KEY' (PKCS#1)", block.Type)
	}
}

func (h *SetupHandlers) GetCurrentCertPathsHandler(w http.ResponseWriter, r *http.Request) {
	response := map[string]interface{}{
		"success": true,
		"data": map[string]string{
			"cert_path": h.certPath,
			"key_path":  h.keyPath,
		},
	}

	w.Header().Set("Content-Type", "application/json")
	if err := json.NewEncoder(w).Encode(response); err != nil {
		http.Error(w, "Failed to encode response", http.StatusInternalServerError)
		return
	}
}

func (h *SetupHandlers) renderUnauthorizedPage(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "text/plain; charset=utf-8")
	w.WriteHeader(http.StatusUnauthorized)

	localizer := h.getLocalizerFromContext(r)
	message := localizer.MustLocalize("messages.unauthorized_setup_token_required", nil, nil)
	_, err := fmt.Fprintf(w, message)
	if err != nil {
		log.Printf("Warning: failed to write unauthorized page: %v", err)
	}
}

func (h *SetupHandlers) renderSetupPage(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "text/html")
	w.WriteHeader(http.StatusOK)

	localizer := h.getLocalizerFromContext(r)
	pageTitle := localizer.MustLocalize("setup.page_title", nil, nil)
	loadingMessage := localizer.MustLocalize("messages.loading_setup_interface", nil, nil)

	_, err := fmt.Fprintf(w, `<!DOCTYPE html>
<html>
<head>
    <title>%s</title>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <link rel="icon" type="image/x-icon" href="/static/favicon.ico">
    <link rel="icon" type="image/png" href="/static/logo-icon.png">
    <link rel="stylesheet" href="/static/styles.css?v=1.2">
</head>
<body>
    <div id="app">
        <h1>BakLab Setup</h1>
        <p>%s</p>
    </div>
    <script type="module" src="/static/app.js?v=1.2"></script>
</body>
</html>`, pageTitle, loadingMessage)
	if err != nil {
		log.Printf("Warning: failed to write setup page: %v", err)
	}
}

