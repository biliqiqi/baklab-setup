package web

import (
	"net/http"
	"strings"

	"github.com/biliqiqi/baklab-setup/internal/model"
	"github.com/biliqiqi/baklab-setup/internal/services"
)

// SetupMiddleware setup中间件
type SetupMiddleware struct {
	setupService *services.SetupService
}

// NewSetupMiddleware 创建中间件实例
func NewSetupMiddleware(setupService *services.SetupService) *SetupMiddleware {
	return &SetupMiddleware{
		setupService: setupService,
	}
}

// SetupAuth setup认证中间件
func (m *SetupMiddleware) SetupAuth(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// 跳过静态文件和首页
		if strings.HasPrefix(r.URL.Path, "/static/") || r.URL.Path == "/" {
			next.ServeHTTP(w, r)
			return
		}

		// 跳过初始化和状态检查接口
		if r.URL.Path == "/api/initialize" || r.URL.Path == "/api/status" {
			next.ServeHTTP(w, r)
			return
		}

		// 注释：移除完成状态检查，允许重复执行

		// 验证setup令牌
		token := r.Header.Get("Setup-Token")
		if token == "" {
			// 也检查URL参数（用于初始访问）
			token = r.URL.Query().Get("token")
		}

		if token == "" {
			writeJSONResponse(w, model.SetupResponse{
				Success: false,
				Message: "Setup token is required",
			}, http.StatusUnauthorized)
			return
		}

		// 获取客户端IP
		clientIP := getClientIP(r)

		// 验证令牌
		if err := m.setupService.ValidateSetupToken(token, clientIP); err != nil {
			writeJSONResponse(w, model.SetupResponse{
				Success: false,
				Message: "Invalid or expired setup token",
			}, http.StatusUnauthorized)
			return
		}

		// 令牌在整个setup过程中可以重复使用，只在setup完成后才失效

		next.ServeHTTP(w, r)
	})
}


// writeJSONResponse 写入JSON响应（中间件专用）
func writeJSONResponse(w http.ResponseWriter, response model.SetupResponse, statusCode int) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(statusCode)
	// 简单的JSON序列化，避免导入encoding/json
	var jsonBytes []byte
	if len(response.Errors) > 0 {
		jsonBytes = []byte(`{"success":false,"message":"` + response.Message + `","errors":[]}`)
	} else {
		jsonBytes = []byte(`{"success":` + boolToString(response.Success) + `,"message":"` + response.Message + `"}`)
	}
	if _, err := w.Write(jsonBytes); err != nil {
		// 这里不能使用log包，因为可能会递归调用
		// 静默忽略错误，因为响应已经开始写入
		_ = err // 显式忽略错误以满足staticcheck
	}
}

// boolToString 布尔值转字符串
func boolToString(b bool) string {
	if b {
		return "true"
	}
	return "false"
}