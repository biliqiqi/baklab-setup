package web

import (
	"context"
	"fmt"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/biliqiqi/baklab-setup/internal/model"
	"github.com/biliqiqi/baklab-setup/internal/services"
	"golang.org/x/text/language"
)

// SetupMiddleware setup中间件
type SetupMiddleware struct {
	setupService *services.SetupService
	devMode      bool
	logFile      *os.File
}

// NewSetupMiddleware 创建中间件实例
func NewSetupMiddleware(setupService *services.SetupService, devMode bool) *SetupMiddleware {
	// 创建日志目录
	logDir := "./logs"
	if err := os.MkdirAll(logDir, 0755); err != nil {
		log.Printf("Warning: failed to create log directory: %v", err)
	}

	// 创建日志文件
	logPath := filepath.Join(logDir, fmt.Sprintf("setup_%s.log", time.Now().Format("2006-01-02")))
	logFile, err := os.OpenFile(logPath, os.O_CREATE|os.O_WRONLY|os.O_APPEND, 0644)
	if err != nil {
		log.Printf("Warning: failed to open log file: %v", err)
		logFile = nil
	}

	return &SetupMiddleware{
		setupService: setupService,
		devMode:      devMode,
		logFile:      logFile,
	}
}

// SetupAuth setup认证中间件
func (m *SetupMiddleware) SetupAuth(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// 记录所有API访问
		m.logAPIAccess(r)

		// 开发模式下跳过token验证
		if m.devMode {
			next.ServeHTTP(w, r)
			return
		}

		// 只跳过静态文件和首页
		if strings.HasPrefix(r.URL.Path, "/static/") || r.URL.Path == "/" {
			next.ServeHTTP(w, r)
			return
		}

		// 所有API接口都需要token验证，移除之前跳过的接口

		// 验证setup令牌
		token := r.Header.Get("Setup-Token")
		if token == "" {
			// 也检查URL参数（用于初始访问）
			token = r.URL.Query().Get("token")
		}

		if token == "" {
			m.logSecurityEvent(r, "missing_token", "no_token_provided")
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
			// 安全截取token前8位用于日志
			tokenPrefix := token
			if len(token) > 8 {
				tokenPrefix = token[:8] + "..."
			}
			m.logSecurityEvent(r, "token_validation_failed", tokenPrefix)
			writeJSONResponse(w, model.SetupResponse{
				Success: false,
				Message: "Invalid or expired setup token",
			}, http.StatusUnauthorized)
			return
		}

		// Token在整个setup流程中保持有效，不提前标记为已使用

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

// MiddlewareCtxKey context key type for middleware
type MiddlewareCtxKey string

const (
	MiddlewareI18nLangKey MiddlewareCtxKey = "i18n_lang"
)

// I18nMiddleware creates middleware for handling request-level internationalization
func I18nMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// Detect language from request and store in context
		lang := GetAcceptLang(r)
		ctx := context.WithValue(r.Context(), MiddlewareI18nLangKey, lang)
		next.ServeHTTP(w, r.WithContext(ctx))
	})
}

// GetAcceptLang determines the preferred language from request headers and cookies
func GetAcceptLang(r *http.Request) language.Tag {
	// Priority: X-Language header > lang cookie > Accept-Language header
	xLang := r.Header.Get("X-Language")
	cookieLang, _ := r.Cookie("lang")
	acceptLangs := r.Header.Get("Accept-Language")

	var langTags []language.Tag
	
	// Highest priority: X-Language header (for frontend language switching)
	if xLang != "" {
		if xLangTag, err := language.Parse(xLang); err == nil {
			langTags = append(langTags, xLangTag)
		}
	}
	
	// Second priority: lang cookie
	if cookieLang != nil {
		if cookieLangTag, err := language.Parse(cookieLang.Value); err == nil {
			langTags = append(langTags, cookieLangTag)
		}
	}

	// Third priority: Accept-Language header
	if acceptLangTags, _, err := language.ParseAcceptLanguage(acceptLangs); err == nil {
		langTags = append(langTags, acceptLangTags...)
	}

	// Match against supported languages
	matcher := language.NewMatcher([]language.Tag{
		language.English,
		language.SimplifiedChinese,
	})
	
	if len(langTags) == 0 {
		return language.English
	}

	tag, _, _ := matcher.Match(langTags...)
	return tag
}

// GetLangFromContext extracts the language tag from request context  
func GetLangFromContext(r *http.Request) language.Tag {
	if lang, ok := r.Context().Value(MiddlewareI18nLangKey).(language.Tag); ok {
		return lang
	}
	return language.English
}

// logAPIAccess 记录API访问日志
func (m *SetupMiddleware) logAPIAccess(r *http.Request) {
	clientIP := getClientIP(r)
	message := fmt.Sprintf("[SETUP-ACCESS] %s %s from %s UA:%s", 
		r.Method, r.URL.Path, clientIP, r.UserAgent())
	
	// 同时输出到控制台和文件
	log.Print(message)
	m.writeToLogFile(message)
}

// logSecurityEvent 记录安全事件
func (m *SetupMiddleware) logSecurityEvent(r *http.Request, event, details string) {
	clientIP := getClientIP(r)
	message := fmt.Sprintf("[SETUP-SECURITY] %s: %s from %s %s UA:%s", 
		event, details, clientIP, r.URL.Path, r.UserAgent())
	
	// 同时输出到控制台和文件
	log.Print(message)
	m.writeToLogFile(message)
}

// writeToLogFile 写入日志文件
func (m *SetupMiddleware) writeToLogFile(message string) {
	if m.logFile != nil {
		timestamp := time.Now().Format("2006-01-02 15:04:05")
		logLine := fmt.Sprintf("%s %s\n", timestamp, message)
		if _, err := m.logFile.WriteString(logLine); err != nil {
			log.Printf("Warning: failed to write to log file: %v", err)
		}
	}
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
