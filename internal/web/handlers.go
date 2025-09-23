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
	"time"

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
		// Get language from context (set by middleware)
		if lang, ok := r.Context().Value(MiddlewareI18nLangKey).(language.Tag); ok {
			return h.i18nManager.GetLocalizer(lang)
		}
		// Fallback: get language from request directly
		lang := GetAcceptLang(r)
		return h.i18nManager.GetLocalizer(lang)
	}
	// Return English localizer as fallback when i18nManager is not available
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
	// 开发模式下跳过token验证
	if h.devMode {
		// 渲染主页
		h.renderSetupPage(w, r)
		return
	}

	// 生产模式下检查token
	token := r.Header.Get("Setup-Token")
	if token == "" {
		token = r.URL.Query().Get("token")
	}

	// 如果没有token，返回未授权页面
	if token == "" {
		h.renderUnauthorizedPage(w, r)
		return
	}

	// 验证token有效性
	clientIP := getClientIP(r)
	if err := h.setupService.ValidateSetupToken(token, clientIP); err != nil {
		h.renderUnauthorizedPage(w, r)
		return
	}

	// 检查setup是否已完成
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

	// 返回setup界面
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

	// 获取客户端IP地址
	clientIP := getClientIP(r)

	// 初始化setup
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

	// 检查是否有导入的配置
	var revisionMode map[string]interface{}
	if cfg, err := h.setupService.GetSetupConfig(); err == nil && cfg.RevisionMode.Enabled {
		revisionMode = map[string]interface{}{
			"enabled":        cfg.RevisionMode.Enabled,
			"imported_at":    cfg.RevisionMode.ImportedAt,
			"modified_steps": cfg.RevisionMode.ModifiedSteps,
		}
	}

	// 只返回基本状态信息，不包含敏感数据
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

	// 先获取现有配置，保留已有的状态（如前端构建状态）
	existingCfg, err := h.setupService.GetSetupConfig()
	if err != nil {
		h.writeJSONResponse(w, model.SetupResponse{
			Success: false,
			Message: "Failed to get existing configuration",
		}, http.StatusInternalServerError)
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

	// 保留现有的前端构建状态
	cfg.Frontend = existingCfg.Frontend

	// 创建验证器并验证配置
	validator := services.NewValidatorService()
	errors := validator.ValidateConfig(&cfg)

	if len(errors) > 0 {
		// Translate validation error messages
		h.translateValidationErrors(r, errors)
		h.writeJSONResponse(w, model.SetupResponse{
			Success: false,
			Message: h.localizeMessage(r, "messages.configuration_validation_failed"),
			Errors:  errors,
		}, http.StatusBadRequest)
		return
	}

	// 保存配置
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

	// 不返回敏感信息
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

	// 测试连接
	results, err := h.setupService.TestConnections(&cfg)
	if err != nil {
		h.writeJSONResponse(w, model.SetupResponse{
			Success: false,
			Message: err.Error(),
		}, http.StatusInternalServerError)
		return
	}

	// 翻译带key:前缀的消息
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

	// 获取保存的配置
	cfg, err := h.setupService.GetSetupConfig()
	if err != nil {
		h.writeJSONResponse(w, model.SetupResponse{
			Success: false,
			Message: h.localizeMessage(r, "messages.failed_get_configuration"),
		}, http.StatusInternalServerError)
		return
	}

	// 生成配置文件
	if err := h.setupService.GenerateConfigFiles(cfg); err != nil {
		h.writeJSONResponse(w, model.SetupResponse{
			Success: false,
			Message: err.Error(),
		}, http.StatusInternalServerError)
		return
	}

	// 获取输出目录的绝对路径
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

	// 检查setup是否已经完成（幂等性保护）
	completed, err := h.setupService.IsSetupCompleted()
	if err != nil {
		h.writeJSONResponse(w, model.SetupResponse{
			Success: false,
			Message: h.localizeMessage(r, "messages.errors.failed_check_status"),
		}, http.StatusInternalServerError)
		return
	}

	if completed {
		// 如果已经完成，直接返回成功（幂等性）
		h.writeJSONResponse(w, model.SetupResponse{
			Success: true,
			Message: h.localizeMessage(r, "messages.setup_already_completed"),
		}, http.StatusOK)
		return
	}

	// 完成setup
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

	// 创建验证器并验证配置
	validator := services.NewValidatorService()
	errors := validator.ValidateConfig(&cfg)

	if len(errors) > 0 {
		// Translate validation error messages
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
	// 限制请求体大小为100MB
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

	// 验证文件扩展名
	if !strings.HasSuffix(strings.ToLower(handler.Filename), ".mmdb") {
		h.writeJSONResponse(w, model.SetupResponse{
			Success: false,
			Message: h.localizeMessage(r, "messages.invalid_file_type_mmdb"),
		}, http.StatusBadRequest)
		return
	}

	// 验证文件大小
	if handler.Size > maxSize {
		h.writeJSONResponse(w, model.SetupResponse{
			Success: false,
			Message: h.localizeMessage(r, "messages.file_too_large_max_100mb"),
		}, http.StatusBadRequest)
		return
	}

	// 使用临时目录存储上传的文件，避免配置生成时被清空
	tempDir := filepath.Join("./data", "temp")
	if err := os.MkdirAll(tempDir, 0755); err != nil {
		log.Printf("Failed to create temp directory: %v", err)
		h.writeJSONResponse(w, model.SetupResponse{
			Success: false,
			Message: h.localizeMessage(r, "messages.failed_create_upload_directory"),
		}, http.StatusInternalServerError)
		return
	}

	// 保存文件为 GeoLite2-City.mmdb 在临时目录
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

	// 复制文件内容
	bytesWritten, err := io.Copy(destFile, file)
	if err != nil {
		log.Printf("Failed to copy file: %v", err)
		// 删除不完整的文件
		os.Remove(destPath)
		h.writeJSONResponse(w, model.SetupResponse{
			Success: false,
			Message: h.localizeMessage(r, "messages.failed_save_file"),
		}, http.StatusInternalServerError)
		return
	}

	log.Printf("GeoIP file uploaded to temp directory: %s (%d bytes)", destPath, bytesWritten)

	// 返回成功响应
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

// UploadJWTKeyFileHandler 处理 JWT key 文件上传 (已注释：改为自动生成JWT密钥)
/*
func (h *SetupHandlers) UploadJWTKeyFileHandler(w http.ResponseWriter, r *http.Request) {
	// 限制请求体大小为10MB（JWT key 文件通常很小）
	maxSize := int64(10 * 1024 * 1024) // 10MB
	r.Body = http.MaxBytesReader(w, r.Body, maxSize)

	if err := r.ParseMultipartForm(maxSize); err != nil {
		log.Printf("Failed to parse multipart form: %v", err)
		h.writeJSONResponse(w, model.SetupResponse{
			Success: false,
			Message: h.localizeMessage(r, "messages.file_too_large_or_invalid_form_data"),
		}, http.StatusBadRequest)
		return
	}

	file, handler, err := r.FormFile("jwt_key_file")
	if err != nil {
		log.Printf("Failed to get form file: %v", err)
		h.writeJSONResponse(w, model.SetupResponse{
			Success: false,
			Message: h.localizeMessage(r, "messages.no_file_uploaded_or_invalid_file_field"),
		}, http.StatusBadRequest)
		return
	}
	defer file.Close()

	// 验证文件扩展名 (只支持 .pem 格式，符合 BakLab JWT 模块要求)
	filename := strings.ToLower(handler.Filename)
	if !strings.HasSuffix(filename, ".pem") {
		h.writeJSONResponse(w, model.SetupResponse{
			Success: false,
			Message: h.localizeMessage(r, "messages.invalid_file_type_pem"),
		}, http.StatusBadRequest)
		return
	}

	// 验证文件大小
	if handler.Size > maxSize {
		h.writeJSONResponse(w, model.SetupResponse{
			Success: false,
			Message: h.localizeMessage(r, "messages.file_too_large_max_10mb"),
		}, http.StatusBadRequest)
		return
	}

	// 使用临时目录存储上传的文件，避免配置生成时被清空
	tempDir := filepath.Join("./data", "temp")
	if err := os.MkdirAll(tempDir, 0755); err != nil {
		log.Printf("Failed to create temp directory: %v", err)
		h.writeJSONResponse(w, model.SetupResponse{
			Success: false,
			Message: h.localizeMessage(r, "messages.failed_create_upload_directory"),
		}, http.StatusInternalServerError)
		return
	}

	// 使用原始文件名保存到临时目录
	destPath := filepath.Join(tempDir, handler.Filename)
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

	// 读取文件内容进行验证
	fileContent, err := io.ReadAll(file)
	if err != nil {
		log.Printf("Failed to read JWT key file: %v", err)
		h.writeJSONResponse(w, model.SetupResponse{
			Success: false,
			Message: h.localizeMessage(r, "messages.failed_read_file"),
		}, http.StatusInternalServerError)
		return
	}

	// 验证 PEM 格式
	if err := validateJWTKeyFile(fileContent); err != nil {
		log.Printf("Invalid JWT key file: %v", err)
		h.writeJSONResponse(w, model.SetupResponse{
			Success: false,
			Message: h.localizeMessage(r, "messages.invalid_jwt_key_file", "error", err.Error()),
		}, http.StatusBadRequest)
		return
	}

	// 写入文件
	bytesWritten, err := destFile.Write(fileContent)
	if err != nil {
		log.Printf("Failed to write JWT key file: %v", err)
		// 删除不完整的文件
		os.Remove(destPath)
		h.writeJSONResponse(w, model.SetupResponse{
			Success: false,
			Message: h.localizeMessage(r, "messages.failed_save_file"),
		}, http.StatusInternalServerError)
		return
	}

	log.Printf("JWT key file uploaded to temp directory: %s (%d bytes)", destPath, bytesWritten)

	// 返回成功响应
	h.writeJSONResponse(w, model.SetupResponse{
		Success: true,
		Message: h.localizeMessage(r, "messages.jwt_key_file_uploaded_successfully"),
		Data: map[string]interface{}{
			"filename":      handler.Filename,
			"size":          bytesWritten,
			"original_name": handler.Filename,
			"temp_path":     destPath,
		},
	}, http.StatusOK)
}
*/

// validateJWTKeyFile 验证 JWT 私钥文件格式
// 支持 RSA 和 Ed25519 私钥，格式要求与 BakLab JWT 模块一致
func validateJWTKeyFile(keyBytes []byte) error {
	block, _ := pem.Decode(keyBytes)
	if block == nil {
		return fmt.Errorf("invalid PEM format")
	}

	switch block.Type {
	case "PRIVATE KEY":
		// PKCS#8 format - 支持 RSA 和 Ed25519
		_, err := x509.ParsePKCS8PrivateKey(block.Bytes)
		if err != nil {
			return fmt.Errorf("invalid PKCS#8 private key: %w", err)
		}
		return nil

	case "RSA PRIVATE KEY":
		// PKCS#1 format - 仅支持 RSA
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

	// 获取翻译的页面标题和加载消息
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
    <script src="/static/i18n.js?v=1.0"></script>
    <script type="module" src="/static/app.js?v=1.2"></script>
</body>
</html>`, pageTitle, loadingMessage)
	if err != nil {
		log.Printf("Warning: failed to write setup page: %v", err)
	}
}

// BuildFrontendHandler 构建前端
func (h *SetupHandlers) BuildFrontendHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		h.writeJSONResponse(w, model.SetupResponse{
			Success: false,
			Message: "Method not allowed",
		}, http.StatusMethodNotAllowed)
		return
	}

	// 获取当前配置
	cfg, err := h.setupService.GetSetupConfig()
	if err != nil {
		h.writeJSONResponse(w, model.SetupResponse{
			Success: false,
			Message: h.localizeMessage(r, "messages.failed_get_config"),
		}, http.StatusInternalServerError)
		return
	}

	// 创建生成器服务并构建前端
	generator := services.NewGeneratorService()
	if err := generator.BuildFrontend(cfg); err != nil {
		h.writeJSONResponse(w, model.SetupResponse{
			Success: false,
			Message: h.localizeMessage(r, "setup.frontend.build_failed") + ": " + err.Error(),
		}, http.StatusInternalServerError)
		return
	}

	// 更新前端构建状态
	cfg.Frontend.Built = true
	cfg.Frontend.BuildTime = time.Now()
	if err := h.setupService.SaveConfiguration(cfg); err != nil {
		log.Printf("Warning: failed to save frontend build status: %v", err)
	}

	h.writeJSONResponse(w, model.SetupResponse{
		Success: true,
		Message: h.localizeMessage(r, "messages.frontend_build_success"),
		Data: map[string]interface{}{
			"built":      true,
			"build_time": cfg.Frontend.BuildTime,
		},
	}, http.StatusOK)
}

// GetFrontendStatusHandler 获取前端构建状态
func (h *SetupHandlers) GetFrontendStatusHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		h.writeJSONResponse(w, model.SetupResponse{
			Success: false,
			Message: "Method not allowed",
		}, http.StatusMethodNotAllowed)
		return
	}

	// 验证令牌（生产模式）
	if !h.devMode {
		token := r.Header.Get("Setup-Token")
		if token == "" {
			token = r.URL.Query().Get("token")
		}

		if token == "" {
			h.writeJSONResponse(w, model.SetupResponse{
				Success: false,
				Message: "Token required",
			}, http.StatusUnauthorized)
			return
		}

		clientIP := getClientIP(r)
		if err := h.setupService.ValidateSetupToken(token, clientIP); err != nil {
			h.writeJSONResponse(w, model.SetupResponse{
				Success: false,
				Message: "Invalid token",
			}, http.StatusUnauthorized)
			return
		}
	}

	cfg, err := h.setupService.GetSetupConfig()
	if err != nil {
		// 如果配置不存在，返回默认状态
		h.writeJSONResponse(w, model.SetupResponse{
			Success: true,
			Data: map[string]interface{}{
				"built":      false,
				"build_time": nil,
				"build_logs": "",
				"env_vars":   map[string]string{},
			},
		}, http.StatusOK)
		return
	}

	// 生成前端环境变量预览
	generator := services.NewGeneratorService()
	envVars := generator.GenerateFrontendEnvVars(cfg)

	envMap := make(map[string]string)
	for _, env := range envVars {
		parts := strings.SplitN(env, "=", 2)
		if len(parts) == 2 {
			envMap[parts[0]] = parts[1]
		}
	}

	// 检查前端构建文件是否真实存在
	frontendDistPath := "./frontend/dist"
	_, err = os.Stat(frontendDistPath)
	frontendFilesExist := err == nil

	// 实际构建状态 = 配置中的状态 AND 文件实际存在
	actualBuiltStatus := cfg.Frontend.Built && frontendFilesExist

	// 获取构建资源的绝对路径信息
	var buildArtifacts map[string]interface{}
	if frontendFilesExist {
		buildArtifacts = h.getBuildArtifactsInfo(frontendDistPath)
	} else {
		buildArtifacts = map[string]interface{}{
			"dist_path": "",
			"assets":    []interface{}{},
		}
	}

	// 如果配置显示已构建但文件不存在，自动修正配置状态
	if cfg.Frontend.Built && !frontendFilesExist {
		cfg.Frontend.Built = false
		// 尝试保存修正后的配置（如果失败也不影响状态返回）
		if saveErr := h.setupService.SaveConfiguration(cfg); saveErr != nil {
			log.Printf("Warning: failed to update frontend build status: %v", saveErr)
		}
		actualBuiltStatus = false
	}

	h.writeJSONResponse(w, model.SetupResponse{
		Success: true,
		Data: map[string]interface{}{
			"built":           actualBuiltStatus,
			"build_time":      cfg.Frontend.BuildTime,
			"build_logs":      cfg.Frontend.BuildLogs,
			"env_vars":        envMap,
			"build_artifacts": buildArtifacts,
		},
	}, http.StatusOK)
}

// StreamFrontendBuildHandler 处理前端构建的Server-Sent Events流
func (h *SetupHandlers) StreamFrontendBuildHandler(w http.ResponseWriter, r *http.Request) {
	// 从URL参数获取token进行验证
	token := r.URL.Query().Get("token")
	if token == "" {
		w.WriteHeader(http.StatusUnauthorized)
		fmt.Fprintf(w, "event: error\ndata: Token required\n\n")
		return
	}

	// 验证令牌
	clientIP := getClientIP(r)
	if err := h.setupService.ValidateSetupToken(token, clientIP); err != nil {
		w.WriteHeader(http.StatusUnauthorized)
		fmt.Fprintf(w, "event: error\ndata: Invalid token\n\n")
		return
	}

	// 获取配置（在设置SSE headers之前）
	cfg, err := h.setupService.GetSetupConfig()
	if err != nil {
		// 如果配置不存在，无法进行构建
		w.Header().Set("Content-Type", "text/plain; charset=utf-8")
		w.WriteHeader(http.StatusBadRequest)
		fmt.Fprintf(w, "Configuration not found. Please complete the setup steps first.")
		return
	}

	// 设置SSE headers
	w.Header().Set("Content-Type", "text/event-stream; charset=utf-8")
	w.Header().Set("Cache-Control", "no-cache")
	w.Header().Set("Connection", "keep-alive")
	w.Header().Set("Access-Control-Allow-Origin", "*")

	// 发送初始连接确认
	fmt.Fprintf(w, "event: connected\ndata: Connection established\n\n")
	if f, ok := w.(http.Flusher); ok {
		f.Flush()
	}

	// 创建输出通道
	outputChan := make(chan string, 100)
	errorChan := make(chan error, 1)

	// 启动构建
	go func() {
		defer close(outputChan)
		defer close(errorChan)

		if err := h.setupService.BuildFrontendWithStream(cfg, outputChan); err != nil {
			errorChan <- err
		}
	}()

	// 流式发送输出
	for {
		select {
		case output, ok := <-outputChan:
			if !ok {
				// 构建完成，更新状态
				cfg.Frontend.Built = true
				cfg.Frontend.BuildTime = time.Now()
				if err := h.setupService.SaveConfiguration(cfg); err != nil {
					log.Printf("Warning: failed to save frontend build status: %v", err)
				}

				fmt.Fprintf(w, "event: complete\ndata: Build completed successfully\n\n")
				if f, ok := w.(http.Flusher); ok {
					f.Flush()
				}
				return
			}
			// 发送输出
			fmt.Fprintf(w, "event: output\ndata: %s\n\n", output)
			if f, ok := w.(http.Flusher); ok {
				f.Flush()
			}
		case err := <-errorChan:
			if err != nil {
				fmt.Fprintf(w, "event: error\ndata: %v\n\n", err)
				if f, ok := w.(http.Flusher); ok {
					f.Flush()
				}
				return
			}
		case <-r.Context().Done():
			// 客户端断开连接
			return
		}
	}
}

// ExtractFrontendAssetsHandler 实时从构建文件中提取前端资源
func (h *SetupHandlers) ExtractFrontendAssetsHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		h.writeJSONResponse(w, model.SetupResponse{
			Success: false,
			Message: h.localizeMessage(r, "messages.errors.method_not_allowed"),
		}, http.StatusMethodNotAllowed)
		return
	}

	// 验证令牌
	clientIP := getClientIP(r)
	tokenStr := r.Header.Get("Setup-Token")
	if err := h.setupService.ValidateSetupToken(tokenStr, clientIP); err != nil {
		h.writeJSONResponse(w, model.SetupResponse{
			Success: false,
			Message: h.localizeMessage(r, "messages.errors.invalid_token"),
		}, http.StatusUnauthorized)
		return
	}

	// 创建临时配置对象用于提取资源
	tempCfg := &model.SetupConfig{
		App: model.AppConfig{
			FrontendScripts: []string{},
			FrontendStyles:  []string{},
		},
	}

	// 使用generator service从构建文件中提取资源
	generator := services.NewGeneratorService()
	if err := generator.ExtractFrontendAssets(tempCfg); err != nil {
		h.writeJSONResponse(w, model.SetupResponse{
			Success: false,
			Message: fmt.Sprintf("Failed to extract frontend assets: %v", err),
		}, http.StatusInternalServerError)
		return
	}

	// 返回提取的资源
	h.writeJSONResponse(w, model.SetupResponse{
		Success: true,
		Message: h.localizeMessage(r, "messages.frontend_assets_extracted"),
		Data: map[string]interface{}{
			"frontend_scripts": tempCfg.App.FrontendScripts,
			"frontend_styles":  tempCfg.App.FrontendStyles,
		},
	}, http.StatusOK)
}

// getBuildArtifactsInfo 获取构建产物的绝对路径信息
func (h *SetupHandlers) getBuildArtifactsInfo(frontendDistPath string) map[string]interface{} {
	// 获取绝对路径
	absDistPath, err := filepath.Abs(frontendDistPath)
	if err != nil {
		log.Printf("Warning: failed to get absolute path for %s: %v", frontendDistPath, err)
		absDistPath = frontendDistPath
	}

	assets := []map[string]interface{}{}

	// 遍历构建目录，收集重要的构建产物信息
	err = filepath.Walk(frontendDistPath, func(path string, info os.FileInfo, err error) error {
		if err != nil {
			return nil // 忽略错误，继续遍历
		}

		// 只收集重要的文件类型
		if info.IsDir() {
			return nil
		}

		ext := strings.ToLower(filepath.Ext(info.Name()))
		if ext == ".js" || ext == ".css" || ext == ".html" || ext == ".map" || ext == ".json" {
			absPath, pathErr := filepath.Abs(path)
			if pathErr != nil {
				absPath = path
			}

			// 计算相对于dist目录的路径
			relPath, relErr := filepath.Rel(frontendDistPath, path)
			if relErr != nil {
				relPath = info.Name()
			}

			assets = append(assets, map[string]interface{}{
				"name":         info.Name(),
				"relative_path": relPath,
				"absolute_path": absPath,
				"size":         info.Size(),
				"type":         ext,
				"modified":     info.ModTime(),
			})
		}

		return nil
	})

	if err != nil {
		log.Printf("Warning: failed to walk frontend dist directory: %v", err)
	}

	return map[string]interface{}{
		"dist_path": absDistPath,
		"assets":    assets,
	}
}
