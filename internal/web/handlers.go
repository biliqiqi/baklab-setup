package web

import (
	"crypto/rand"
	"crypto/x509"
	"encoding/hex"
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
	"github.com/go-chi/chi/v5"
	"golang.org/x/text/language"
)

// SetupHandlers Web处理程序
type SetupHandlers struct {
	setupService *services.SetupService
	i18nManager  *i18n.I18nManager
}

// NewSetupHandlers 创建处理程序实例
func NewSetupHandlers(setupService *services.SetupService, i18nManager *i18n.I18nManager) *SetupHandlers {
	return &SetupHandlers{
		setupService: setupService,
		i18nManager:  i18nManager,
	}
}

// getLocalizerFromContext 从请求上下文获取localizer
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

// localizeMessage 本地化消息
func (h *SetupHandlers) localizeMessage(r *http.Request, messageKey string, data ...interface{}) string {
	localizer := h.getLocalizerFromContext(r)
	if len(data) > 0 {
		return localizer.LocalTpl(messageKey, data...)
	}
	return localizer.LocalTpl(messageKey)
}

// IndexHandler 主页处理程序
func (h *SetupHandlers) IndexHandler(w http.ResponseWriter, r *http.Request) {
	// 检查是否有有效的token
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

// InitializeHandler 初始化setup
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

// StatusHandler 获取setup状态
func (h *SetupHandlers) StatusHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
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

	// 只返回基本状态信息，不包含敏感数据
	safeState := map[string]interface{}{
		"status":       state.Status,
		"current_step": state.CurrentStep,
		"progress":     state.Progress,
		"message":      state.Message,
		"updated_at":   state.UpdatedAt,
	}

	h.writeJSONResponse(w, model.SetupResponse{
		Success: true,
		Data:    safeState,
	}, http.StatusOK)
}

// SaveConfigHandler 保存配置
func (h *SetupHandlers) SaveConfigHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var cfg model.SetupConfig
	if err := json.NewDecoder(r.Body).Decode(&cfg); err != nil {
		h.writeJSONResponse(w, model.SetupResponse{
			Success: false,
			Message: "Invalid JSON format",
		}, http.StatusBadRequest)
		return
	}

	// 创建验证器并验证配置
	validator := services.NewValidatorService()
	errors := validator.ValidateConfig(&cfg)

	if len(errors) > 0 {
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

// GetConfigHandler 获取保存的配置
func (h *SetupHandlers) GetConfigHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
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
	safeCfg.Database.Password = ""
	safeCfg.Redis.Password = ""
	safeCfg.SMTP.Password = ""
	safeCfg.AdminUser.Password = ""
	safeCfg.App.SessionSecret = ""
	safeCfg.App.CSRFSecret = ""

	h.writeJSONResponse(w, model.SetupResponse{
		Success: true,
		Data:    safeCfg,
	}, http.StatusOK)
}

// TestConnectionsHandler 测试连接
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
	for i, result := range results {
		if strings.HasPrefix(result.Message, "key:") {
			messageKey := strings.TrimPrefix(result.Message, "key:")
			results[i].Message = h.localizeMessage(r, messageKey)
		}
	}

	h.writeJSONResponse(w, model.SetupResponse{
		Success: true,
		Data:    results,
	}, http.StatusOK)
}

// GenerateConfigHandler 生成配置文件
func (h *SetupHandlers) GenerateConfigHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
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

	h.writeJSONResponse(w, model.SetupResponse{
		Success: true,
		Message: h.localizeMessage(r, "messages.configuration_files_generated_successfully"),
	}, http.StatusOK)
}

// CompleteSetupHandler 完成setup
func (h *SetupHandlers) CompleteSetupHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
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

// ValidateConfigHandler 验证配置
func (h *SetupHandlers) ValidateConfigHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var cfg model.SetupConfig
	if err := json.NewDecoder(r.Body).Decode(&cfg); err != nil {
		h.writeJSONResponse(w, model.SetupResponse{
			Success: false,
			Message: "Invalid JSON format",
		}, http.StatusBadRequest)
		return
	}

	// 创建验证器并验证配置
	validator := services.NewValidatorService()
	errors := validator.ValidateConfig(&cfg)

	if len(errors) > 0 {
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


// writeJSONResponse 写入JSON响应
func (h *SetupHandlers) writeJSONResponse(w http.ResponseWriter, response model.SetupResponse, statusCode int) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(statusCode)
	if err := json.NewEncoder(w).Encode(response); err != nil {
		log.Printf("Warning: failed to encode JSON response: %v", err)
	}
}

// StartDeploymentHandler 启动部署
func (h *SetupHandlers) StartDeploymentHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	// 生成部署ID
	deploymentID, err := generateDeploymentID()
	if err != nil {
		h.writeJSONResponse(w, model.SetupResponse{
			Success: false,
			Message: h.localizeMessage(r, "messages.failed_generate_deployment_id"),
		}, http.StatusInternalServerError)
		return
	}

	// 启动部署（异步）
	go func() {
		if err := h.setupService.StartDeployment(deploymentID); err != nil {
			log.Printf("Deployment failed: %v", err)
		}
	}()

	h.writeJSONResponse(w, model.SetupResponse{
		Success: true,
		Message: h.localizeMessage(r, "messages.deployment_started"),
		Data: map[string]interface{}{
			"deployment_id": deploymentID,
		},
	}, http.StatusOK)
}

// DeploymentStatusHandler 获取部署状态
func (h *SetupHandlers) DeploymentStatusHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	status, err := h.setupService.GetDeploymentStatus()
	if err != nil {
		h.writeJSONResponse(w, model.SetupResponse{
			Success: false,
			Message: h.localizeMessage(r, "messages.failed_get_deployment_status"),
		}, http.StatusInternalServerError)
		return
	}

	h.writeJSONResponse(w, model.SetupResponse{
		Success: true,
		Data:    status,
	}, http.StatusOK)
}

// DeploymentLogsHandler SSE流式输出部署日志
func (h *SetupHandlers) DeploymentLogsHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	// 获取部署ID
	deploymentID := chi.URLParam(r, "deploymentId")
	if deploymentID == "" {
		http.Error(w, h.localizeMessage(r, "messages.deployment_id_required"), http.StatusBadRequest)
		return
	}

	// 设置SSE头
	w.Header().Set("Content-Type", "text/event-stream")
	w.Header().Set("Cache-Control", "no-cache")
	w.Header().Set("Connection", "keep-alive")
	w.Header().Set("Access-Control-Allow-Origin", "*")

	flusher, ok := w.(http.Flusher)
	if !ok {
		http.Error(w, h.localizeMessage(r, "messages.streaming_unsupported"), http.StatusInternalServerError)
		return
	}

	// 发送初始连接事件
	fmt.Fprintf(w, "data: {\"type\":\"connected\",\"message\":\"Log stream connected\"}\n\n")
	flusher.Flush()

	// 获取当前状态和日志
	status, err := h.setupService.GetDeploymentStatus()
	if err != nil {
		fmt.Fprintf(w, "data: {\"type\":\"error\",\"message\":\"Failed to get deployment status\"}\n\n")
		flusher.Flush()
		return
	}

	// 发送现有日志
	for _, entry := range status.Logs {
		logData := map[string]interface{}{
			"type":      "log",
			"timestamp": entry.Timestamp.Format(time.RFC3339),
			"level":     entry.Level,
			"message":   entry.Message,
		}
		logJSON, _ := json.Marshal(logData)
		fmt.Fprintf(w, "data: %s\n\n", logJSON)
		flusher.Flush()
	}

	// 发送状态更新
	statusData := map[string]interface{}{
		"type":     "status",
		"status":   status.Status,
		"progress": status.Progress,
		"message":  status.Message,
	}
	statusJSON, _ := json.Marshal(statusData)
	fmt.Fprintf(w, "data: %s\n\n", statusJSON)
	flusher.Flush()

	// 如果部署已完成，关闭连接
	if status.Status == "completed" || status.Status == "failed" || status.Status == "timeout" {
		fmt.Fprintf(w, "data: {\"type\":\"finished\"}\n\n")
		flusher.Flush()
		return
	}

	// 轮询更新（简化实现）
	ticker := time.NewTicker(2 * time.Second)
	defer ticker.Stop()

	lastLogCount := len(status.Logs)

	for {
		select {
		case <-ticker.C:
			currentStatus, err := h.setupService.GetDeploymentStatus()
			if err != nil {
				continue
			}

			// 发送新日志
			if len(currentStatus.Logs) > lastLogCount {
				for i := lastLogCount; i < len(currentStatus.Logs); i++ {
					entry := currentStatus.Logs[i]
					logData := map[string]interface{}{
						"type":      "log",
						"timestamp": entry.Timestamp.Format(time.RFC3339),
						"level":     entry.Level,
						"message":   entry.Message,
					}
					logJSON, _ := json.Marshal(logData)
					fmt.Fprintf(w, "data: %s\n\n", logJSON)
				}
				lastLogCount = len(currentStatus.Logs)
			}

			// 发送状态更新
			if currentStatus.Status != status.Status || currentStatus.Progress != status.Progress {
				statusData := map[string]interface{}{
					"type":     "status",
					"status":   currentStatus.Status,
					"progress": currentStatus.Progress,
					"message":  currentStatus.Message,
				}
				statusJSON, _ := json.Marshal(statusData)
				fmt.Fprintf(w, "data: %s\n\n", statusJSON)
				status = currentStatus
			}

			flusher.Flush()

			// 如果部署完成，结束流
			if currentStatus.Status == "completed" || currentStatus.Status == "failed" || currentStatus.Status == "timeout" {
				fmt.Fprintf(w, "data: {\"type\":\"finished\"}\n\n")
				flusher.Flush()
				return
			}

		case <-r.Context().Done():
			return
		}
	}
}

// UploadGeoFileHandler 处理 GeoIP 数据库文件上传
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

// UploadJWTKeyFileHandler 处理 JWT key 文件上传
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

// generateDeploymentID 生成部署ID
func generateDeploymentID() (string, error) {
	bytes := make([]byte, 8)
	if _, err := rand.Read(bytes); err != nil {
		return "", err
	}
	return hex.EncodeToString(bytes), nil
}

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

// renderUnauthorizedPage 渲染未授权页面
func (h *SetupHandlers) renderUnauthorizedPage(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "text/plain")
	w.WriteHeader(http.StatusUnauthorized)

	_, err := fmt.Fprintf(w, "Unauthorized: Valid setup token required")
	if err != nil {
		log.Printf("Warning: failed to write unauthorized page: %v", err)
	}
}

// renderSetupPage 渲染setup界面
func (h *SetupHandlers) renderSetupPage(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "text/html")
	w.WriteHeader(http.StatusOK)

	_, err := fmt.Fprintf(w, `<!DOCTYPE html>
<html>
<head>
    <title>BakLab Setup</title>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <link rel="icon" type="image/x-icon" href="/static/favicon.ico">
    <link rel="icon" type="image/png" href="/static/logo-icon.png">
    <link rel="stylesheet" href="/static/styles.css?v=1.2">
</head>
<body>
    <div id="app">
        <h1>BakLab Setup</h1>
        <p>Loading setup interface...</p>
    </div>
    <script src="/static/i18n.js?v=1.0"></script>
    <script src="/static/app.js?v=1.2"></script>
</body>
</html>`)
	if err != nil {
		log.Printf("Warning: failed to write setup page: %v", err)
	}
}
