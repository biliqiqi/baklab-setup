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

type SetupMiddleware struct {
	setupService *services.SetupService
	devMode      bool
	logFile      *os.File
}

func NewSetupMiddleware(setupService *services.SetupService, devMode bool) *SetupMiddleware {
	logDir := "./logs"
	if err := os.MkdirAll(logDir, 0755); err != nil {
		log.Printf("Warning: failed to create log directory: %v", err)
	}

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

func (m *SetupMiddleware) SetupAuth(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		m.logAPIAccess(r)

		if m.devMode {
			next.ServeHTTP(w, r)
			return
		}

		if strings.HasPrefix(r.URL.Path, "/static/") || r.URL.Path == "/" {
			next.ServeHTTP(w, r)
			return
		}


		token := r.Header.Get("Setup-Token")
		if token == "" {
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

		clientIP := getClientIP(r)

		if err := m.setupService.ValidateSetupToken(token, clientIP); err != nil {
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


		next.ServeHTTP(w, r)
	})
}

func writeJSONResponse(w http.ResponseWriter, response model.SetupResponse, statusCode int) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(statusCode)
	var jsonBytes []byte
	if len(response.Errors) > 0 {
		jsonBytes = []byte(`{"success":false,"message":"` + response.Message + `","errors":[]}`)
	} else {
		jsonBytes = []byte(`{"success":` + boolToString(response.Success) + `,"message":"` + response.Message + `"}`)
	}
	if _, err := w.Write(jsonBytes); err != nil {
		_ = err
	}
}

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
		lang := GetAcceptLang(r)
		ctx := context.WithValue(r.Context(), MiddlewareI18nLangKey, lang)
		next.ServeHTTP(w, r.WithContext(ctx))
	})
}

// GetAcceptLang determines the preferred language from request headers and cookies
func GetAcceptLang(r *http.Request) language.Tag {
	xLang := r.Header.Get("X-Language")
	cookieLang, _ := r.Cookie("lang")
	acceptLangs := r.Header.Get("Accept-Language")

	var langTags []language.Tag

	if xLang != "" {
		if xLangTag, err := language.Parse(xLang); err == nil {
			langTags = append(langTags, xLangTag)
		}
	}

	if cookieLang != nil {
		if cookieLangTag, err := language.Parse(cookieLang.Value); err == nil {
			langTags = append(langTags, cookieLangTag)
		}
	}

	if acceptLangTags, _, err := language.ParseAcceptLanguage(acceptLangs); err == nil {
		langTags = append(langTags, acceptLangTags...)
	}

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

func (m *SetupMiddleware) logAPIAccess(r *http.Request) {
	clientIP := getClientIP(r)
	message := fmt.Sprintf("[SETUP-ACCESS] %s %s from %s UA:%s",
		r.Method, r.URL.Path, clientIP, r.UserAgent())

	log.Print(message)
	m.writeToLogFile(message)
}

func (m *SetupMiddleware) logSecurityEvent(r *http.Request, event, details string) {
	clientIP := getClientIP(r)
	message := fmt.Sprintf("[SETUP-SECURITY] %s: %s from %s %s UA:%s",
		event, details, clientIP, r.URL.Path, r.UserAgent())

	log.Print(message)
	m.writeToLogFile(message)
}

func (m *SetupMiddleware) writeToLogFile(message string) {
	if m.logFile != nil {
		timestamp := time.Now().Format("2006-01-02 15:04:05")
		logLine := fmt.Sprintf("%s %s\n", timestamp, message)
		if _, err := m.logFile.WriteString(logLine); err != nil {
			log.Printf("Warning: failed to write to log file: %v", err)
		}
	}
}

func getClientIP(r *http.Request) string {
	if xff := r.Header.Get("X-Forwarded-For"); xff != "" {
		ips := strings.Split(xff, ",")
		return strings.TrimSpace(ips[0])
	}

	if xri := r.Header.Get("X-Real-IP"); xri != "" {
		return strings.TrimSpace(xri)
	}

	ip := r.RemoteAddr
	if colon := strings.LastIndex(ip, ":"); colon != -1 {
		ip = ip[:colon]
	}

	return ip
}
