package web

import (
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/oodzchen/baklab/setup/internal/config"
	"github.com/oodzchen/baklab/setup/internal/services"
)

// SetupHandlers Web处理程序
type SetupHandlers struct {
	setupService *services.SetupService
}

// NewSetupHandlers 创建处理程序实例
func NewSetupHandlers(setupService *services.SetupService) *SetupHandlers {
	return &SetupHandlers{
		setupService: setupService,
	}
}

// IndexHandler 主页处理程序
func (h *SetupHandlers) IndexHandler(w http.ResponseWriter, r *http.Request) {
	// 检查setup是否已完成
	completed, err := h.setupService.IsSetupCompleted()
	if err != nil {
		http.Error(w, "Failed to check setup status", http.StatusInternalServerError)
		return
	}

	if completed {
		h.writeJSONResponse(w, config.SetupResponse{
			Success: false,
			Message: "Setup has already been completed",
		}, http.StatusForbidden)
		return
	}

	// 返回setup界面
	w.Header().Set("Content-Type", "text/html")
	w.WriteHeader(http.StatusOK)
	
	// 这里应该返回HTML页面，暂时返回简单提示
	_, err = fmt.Fprintf(w, `<!DOCTYPE html>
<html>
<head>
    <title>Baklab Setup</title>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <link rel="stylesheet" href="/static/styles.css?v=1.2">
</head>
<body>
    <div id="app">
        <h1>Baklab Setup</h1>
        <p>Loading setup interface...</p>
    </div>
    <script src="/static/i18n.js?v=1.0"></script>
    <script src="/static/app.js?v=1.2"></script>
</body>
</html>`)
	if err != nil {
		log.Printf("Warning: failed to write HTML response: %v", err)
	}
}

// InitializeHandler 初始化setup
func (h *SetupHandlers) InitializeHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	// 获取客户端IP地址  
	clientIP := getClientIP(r)
	
	// 初始化setup
	token, err := h.setupService.InitializeSetup(clientIP)
	if err != nil {
		h.writeJSONResponse(w, config.SetupResponse{
			Success: false,
			Message: err.Error(),
		}, http.StatusBadRequest)
		return
	}

	h.writeJSONResponse(w, config.SetupResponse{
		Success: true,
		Message: "Setup initialized successfully",
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
		h.writeJSONResponse(w, config.SetupResponse{
			Success: false,
			Message: "Failed to get setup status",
		}, http.StatusInternalServerError)
		return
	}

	h.writeJSONResponse(w, config.SetupResponse{
		Success: true,
		Data:    state,
	}, http.StatusOK)
}

// SaveConfigHandler 保存配置
func (h *SetupHandlers) SaveConfigHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var cfg config.SetupConfig
	if err := json.NewDecoder(r.Body).Decode(&cfg); err != nil {
		h.writeJSONResponse(w, config.SetupResponse{
			Success: false,
			Message: "Invalid JSON format",
		}, http.StatusBadRequest)
		return
	}

	// 创建验证器并验证配置
	validator := services.NewValidatorService()
	errors := validator.ValidateConfig(&cfg)

	if len(errors) > 0 {
		h.writeJSONResponse(w, config.SetupResponse{
			Success: false,
			Message: "Configuration validation failed",
			Errors:  errors,
		}, http.StatusBadRequest)
		return
	}

	// 保存配置
	if err := h.setupService.SaveConfiguration(&cfg); err != nil {
		h.writeJSONResponse(w, config.SetupResponse{
			Success: false,
			Message: err.Error(),
		}, http.StatusBadRequest)
		return
	}

	h.writeJSONResponse(w, config.SetupResponse{
		Success: true,
		Message: "Configuration saved successfully",
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
		h.writeJSONResponse(w, config.SetupResponse{
			Success: false,
			Message: "Failed to get configuration",
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

	h.writeJSONResponse(w, config.SetupResponse{
		Success: true,
		Data:    safeCfg,
	}, http.StatusOK)
}

// TestConnectionsHandler 测试连接
func (h *SetupHandlers) TestConnectionsHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var cfg config.SetupConfig
	if err := json.NewDecoder(r.Body).Decode(&cfg); err != nil {
		h.writeJSONResponse(w, config.SetupResponse{
			Success: false,
			Message: "Invalid JSON format",
		}, http.StatusBadRequest)
		return
	}

	// 测试连接
	results, err := h.setupService.TestConnections(&cfg)
	if err != nil {
		h.writeJSONResponse(w, config.SetupResponse{
			Success: false,
			Message: err.Error(),
		}, http.StatusInternalServerError)
		return
	}

	h.writeJSONResponse(w, config.SetupResponse{
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
		h.writeJSONResponse(w, config.SetupResponse{
			Success: false,
			Message: "Failed to get configuration",
		}, http.StatusInternalServerError)
		return
	}

	// 生成配置文件
	if err := h.setupService.GenerateConfigFiles(cfg); err != nil {
		h.writeJSONResponse(w, config.SetupResponse{
			Success: false,
			Message: err.Error(),
		}, http.StatusInternalServerError)
		return
	}

	h.writeJSONResponse(w, config.SetupResponse{
		Success: true,
		Message: "Configuration files generated successfully",
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
		h.writeJSONResponse(w, config.SetupResponse{
			Success: false,
			Message: err.Error(),
		}, http.StatusInternalServerError)
		return
	}

	h.writeJSONResponse(w, config.SetupResponse{
		Success: true,
		Message: "Setup completed successfully! You can now start the main application.",
	}, http.StatusOK)
}

// ValidateConfigHandler 验证配置
func (h *SetupHandlers) ValidateConfigHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var cfg config.SetupConfig
	if err := json.NewDecoder(r.Body).Decode(&cfg); err != nil {
		h.writeJSONResponse(w, config.SetupResponse{
			Success: false,
			Message: "Invalid JSON format",
		}, http.StatusBadRequest)
		return
	}

	// 创建验证器并验证配置
	validator := services.NewValidatorService()
	errors := validator.ValidateConfig(&cfg)

	if len(errors) > 0 {
		h.writeJSONResponse(w, config.SetupResponse{
			Success: false,
			Message: "Configuration validation failed",
			Errors:  errors,
		}, http.StatusBadRequest)
		return
	}

	h.writeJSONResponse(w, config.SetupResponse{
		Success: true,
		Message: "Configuration is valid",
	}, http.StatusOK)
}

// getClientIP 获取客户端IP地址
func getClientIP(r *http.Request) string {
	// 检查X-Forwarded-For头（代理环境）
	if xff := r.Header.Get("X-Forwarded-For"); xff != "" {
		ips := strings.Split(xff, ",")
		return strings.TrimSpace(ips[0])
	}

	// 检查X-Real-IP头
	if xri := r.Header.Get("X-Real-IP"); xri != "" {
		return strings.TrimSpace(xri)
	}

	// 使用RemoteAddr
	ip := r.RemoteAddr
	if colon := strings.LastIndex(ip, ":"); colon != -1 {
		ip = ip[:colon]
	}

	return ip
}

// writeJSONResponse 写入JSON响应
func (h *SetupHandlers) writeJSONResponse(w http.ResponseWriter, response config.SetupResponse, statusCode int) {
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
		h.writeJSONResponse(w, config.SetupResponse{
			Success: false,
			Message: "Failed to generate deployment ID",
		}, http.StatusInternalServerError)
		return
	}

	// 启动部署（异步）
	go func() {
		if err := h.setupService.StartDeployment(deploymentID); err != nil {
			log.Printf("Deployment failed: %v", err)
		}
	}()

	h.writeJSONResponse(w, config.SetupResponse{
		Success: true,
		Message: "Deployment started",
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
		h.writeJSONResponse(w, config.SetupResponse{
			Success: false,
			Message: "Failed to get deployment status",
		}, http.StatusInternalServerError)
		return
	}

	h.writeJSONResponse(w, config.SetupResponse{
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
		http.Error(w, "Deployment ID required", http.StatusBadRequest)
		return
	}

	// 设置SSE头
	w.Header().Set("Content-Type", "text/event-stream")
	w.Header().Set("Cache-Control", "no-cache")
	w.Header().Set("Connection", "keep-alive")
	w.Header().Set("Access-Control-Allow-Origin", "*")

	flusher, ok := w.(http.Flusher)
	if !ok {
		http.Error(w, "Streaming unsupported", http.StatusInternalServerError)
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

// generateDeploymentID 生成部署ID
func generateDeploymentID() (string, error) {
	bytes := make([]byte, 8)
	if _, err := rand.Read(bytes); err != nil {
		return "", err
	}
	return hex.EncodeToString(bytes), nil
}