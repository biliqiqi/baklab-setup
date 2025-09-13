package main

import (
	"context"
	"crypto/tls"
	"flag"
	"fmt"
	"log"
	"net/http"
	"os"
	"os/signal"
	"path/filepath"
	"runtime"
	"strings"
	"syscall"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"github.com/go-chi/cors"
	"golang.org/x/text/language"

	"github.com/biliqiqi/baklab-setup/internal/i18n"
	"github.com/biliqiqi/baklab-setup/internal/services"
	"github.com/biliqiqi/baklab-setup/internal/storage"
	"github.com/biliqiqi/baklab-setup/internal/web"
)

var (
	port     = flag.String("port", "8443", "HTTPS port to run the setup server on")
	dataDir  = flag.String("data", "./data", "Directory to store setup data")
	staticDir = flag.String("static", "./static", "Directory containing static files")
	
	// 强制要求的 HTTPS 参数
	certFile = flag.String("cert", "", "TLS certificate file path (REQUIRED)")
	keyFile  = flag.String("key", "", "TLS private key file path (REQUIRED)")
	domain   = flag.String("domain", "", "Domain name for HTTPS access (REQUIRED)")
	
	// 安全选项
	timeout  = flag.Duration("timeout", 30*time.Minute, "Maximum setup session duration")
)

func main() {
	flag.Parse()

	// 验证必需的 HTTPS 参数
	if *certFile == "" {
		log.Fatal("TLS certificate file is required. Use -cert flag.")
	}
	if *keyFile == "" {
		log.Fatal("TLS private key file is required. Use -key flag.")
	}
	if *domain == "" {
		log.Fatal("Domain name is required. Use -domain flag.")
	}

	// 验证证书文件
	certPath := *certFile
	keyPath := *keyFile
	
	if _, err := os.Stat(certPath); os.IsNotExist(err) {
		log.Fatalf("Certificate file not found: %s", certPath)
	}
	
	if _, err := os.Stat(keyPath); os.IsNotExist(err) {
		log.Fatalf("Private key file not found: %s", keyPath)
	}

	log.Printf("Starting BakLab HTTPS-Only Setup Service")
	log.Printf("Data directory: %s", *dataDir)
	log.Printf("Domain: %s", *domain)
	log.Printf("Certificate: %s", certPath)
	log.Printf("Private key: %s", keyPath)
	log.Printf("HTTPS port: %s", *port)

	// 初始化存储
	jsonStorage := storage.NewJSONStorage(*dataDir)

	// 初始化服务
	setupService := services.NewSetupService(jsonStorage)

	// 初始化i18n管理器
	i18nManager := i18n.NewI18nManager(language.English)

	// 创建处理器
	handlers := web.NewSetupHandlers(setupService, i18nManager)
	middlewares := web.NewSetupMiddleware(setupService)

	// 设置路由
	r := chi.NewRouter()

	// 全局中间件
	r.Use(middleware.Logger)
	r.Use(middleware.Recoverer)
	r.Use(middleware.RequestID)
	r.Use(middleware.RealIP)

	// 严格的基于域名的 CORS 配置
	r.Use(setupStrictCORS(*domain, *port))

	// HTTPS 安全头和 CSP 配置
	r.Use(setupSecurityHeaders(*domain))

	// setup阶段禁用缓存
	r.Use(middleware.NoCache)

	// i18n中间件
	r.Use(web.I18nMiddleware)

	// 静态文件服务
	workDir, _ := os.Getwd()
	staticPath := filepath.Join(workDir, *staticDir)
	FileServer(r, "/static", http.Dir(staticPath))

	// API路由（需要认证）
	r.Route("/api", func(r chi.Router) {
		r.Use(middlewares.SetupAuth)

		r.Post("/initialize", handlers.InitializeHandler)
		r.Get("/status", handlers.StatusHandler)
		r.Post("/config", handlers.SaveConfigHandler)
		r.Get("/config", handlers.GetConfigHandler)
		r.Post("/validate", handlers.ValidateConfigHandler)
		r.Post("/test-connections", handlers.TestConnectionsHandler)
		r.Post("/generate", handlers.GenerateConfigHandler)

		// 文件上传路由
		r.Post("/upload/geo-file", handlers.UploadGeoFileHandler)
		r.Post("/upload/jwt-key-file", handlers.UploadJWTKeyFileHandler)

		// 部署相关路由
		r.Post("/deploy", handlers.StartDeploymentHandler)
		r.Get("/deploy/status", handlers.DeploymentStatusHandler)
		r.Get("/deploy/logs/{deploymentId}", handlers.DeploymentLogsHandler)

		r.Post("/complete", handlers.CompleteSetupHandler)
	})

	// 主页路由
	r.Get("/", handlers.IndexHandler)

	// 生成访问令牌
	clientIP := "0.0.0.0" // 允许任何IP，由令牌控制访问
	token, err := setupService.InitializeSetup(clientIP)
	if err != nil {
		log.Fatalf("Failed to initialize setup: %v", err)
	}

	// 构造安全的访问URL
	accessURL := fmt.Sprintf("https://%s:%s?token=%s", *domain, *port, token.Token)
	
	// 输出访问信息
	fmt.Println(strings.Repeat("=", 80))
	fmt.Printf("BakLab HTTPS-Only Setup Service Started\n")
	fmt.Printf("One-time Access URL:\n")
	fmt.Printf("   %s\n", accessURL)
	fmt.Printf("Token expires at: %s\n", token.ExpiresAt.Format("2006-01-02 15:04:05"))
	fmt.Printf("Authorized domain: %s\n", *domain)
	fmt.Printf("WARNING: This URL can only be used ONCE!\n")
	fmt.Printf("WARNING: Service will auto-close after setup completion\n")
	fmt.Println(strings.Repeat("=", 80))

	// 启动 HTTPS 服务器
	server := &http.Server{
		Addr:    fmt.Sprintf(":%s", *port),
		Handler: r,
		TLSConfig: &tls.Config{
			MinVersion: tls.VersionTLS12,
			CipherSuites: []uint16{
				tls.TLS_ECDHE_RSA_WITH_AES_128_GCM_SHA256,   // Required for HTTP/2
				tls.TLS_ECDHE_ECDSA_WITH_AES_128_GCM_SHA256, // Required for HTTP/2
				tls.TLS_ECDHE_RSA_WITH_AES_256_GCM_SHA384,
				tls.TLS_ECDHE_RSA_WITH_CHACHA20_POLY1305,
				tls.TLS_ECDHE_ECDSA_WITH_AES_256_GCM_SHA384,
				tls.TLS_ECDHE_ECDSA_WITH_CHACHA20_POLY1305,
			},
			PreferServerCipherSuites: true,
		},
	}

	// 优雅关闭处理
	go func() {
		// 监听中断信号
		sigint := make(chan os.Signal, 1)
		signal.Notify(sigint, os.Interrupt, syscall.SIGTERM)
		<-sigint

		log.Println("Received interrupt signal, shutting down...")

		// 优雅关闭服务器
		shutdownCtx, shutdownCancel := context.WithTimeout(context.Background(), 30*time.Second)
		defer shutdownCancel()

		if err := server.Shutdown(shutdownCtx); err != nil {
			log.Printf("Server shutdown error: %v", err)
		}
	}()

	// 设置全局超时
	go func() {
		time.Sleep(*timeout)
		log.Printf("Setup timeout (%v) reached, shutting down...", *timeout)
		cleanupSensitiveData(*dataDir)
		server.Shutdown(context.Background())
	}()

	log.Printf("Press Ctrl+C to stop the server")

	if err := server.ListenAndServeTLS(certPath, keyPath); err != nil && err != http.ErrServerClosed {
		log.Fatalf("HTTPS server failed to start: %v", err)
	}

	log.Println("Setup server stopped")
}

// FileServer 静态文件服务器
func FileServer(r chi.Router, path string, root http.FileSystem) {
	if path != "/" && path[len(path)-1] != '/' {
		r.Get(path, http.RedirectHandler(path+"/", http.StatusMovedPermanently).ServeHTTP)
		path += "/"
	}
	path += "*"

	r.Get(path, func(w http.ResponseWriter, r *http.Request) {
		rctx := chi.RouteContext(r.Context())
		pathPrefix := strings.TrimSuffix(rctx.RoutePattern(), "/*")
		fs := http.StripPrefix(pathPrefix, http.FileServer(root))
		fs.ServeHTTP(w, r)
	})
}

// setupStrictCORS 配置严格的基于域名的 CORS
func setupStrictCORS(domain, port string) func(http.Handler) http.Handler {
	// 仅允许指定域名的 HTTPS 访问
	allowedOrigins := []string{
		fmt.Sprintf("https://%s:%s", domain, port),
		fmt.Sprintf("https://%s", domain), // 支持不带端口的访问
	}
	
	return cors.Handler(cors.Options{
		AllowedOrigins: allowedOrigins,
		AllowedMethods: []string{
			"GET", "POST", "PUT", "DELETE", "OPTIONS",
		},
		AllowedHeaders: []string{
			"Accept",
			"Accept-Language",
			"Content-Type",
			"Content-Language",
			"Origin",
			"Setup-Token",     // 自定义认证头
			"X-Language",      // i18n 头
			"X-Requested-With",
			"Authorization",
		},
		ExposedHeaders: []string{
			"Setup-Token-Status", // 令牌状态信息
		},
		AllowCredentials: false, // 禁用凭据，提高安全性
		MaxAge:           300,
	})
}

// setupSecurityHeaders 配置 HTTPS 安全头和 CSP
func setupSecurityHeaders(domain string) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			// CSP 策略 - 严格限制资源加载
			cspDirectives := []string{
				"default-src 'self'",
				fmt.Sprintf("connect-src 'self' https://%s", domain),
				"script-src 'self' 'unsafe-inline'", // setup 阶段允许内联脚本
				"style-src 'self' 'unsafe-inline'",  // setup 阶段允许内联样式
				"img-src 'self' data:",
				"font-src 'self'",
				"frame-ancestors 'none'", // 禁止在框架中加载
				"base-uri 'self'",
				"form-action 'self'",
			}
			w.Header().Set("Content-Security-Policy", strings.Join(cspDirectives, "; "))
			
			// HTTPS 安全头
			w.Header().Set("Strict-Transport-Security", "max-age=31536000; includeSubDomains; preload")
			w.Header().Set("X-Content-Type-Options", "nosniff")
			w.Header().Set("X-Frame-Options", "DENY")
			w.Header().Set("X-XSS-Protection", "1; mode=block")
			w.Header().Set("Referrer-Policy", "strict-origin-when-cross-origin")
			w.Header().Set("Permissions-Policy", "geolocation=(), microphone=(), camera=()")
			
			// 禁止缓存敏感页面
			w.Header().Set("Cache-Control", "no-cache, no-store, must-revalidate")
			w.Header().Set("Pragma", "no-cache")
			w.Header().Set("Expires", "0")
			
			next.ServeHTTP(w, r)
		})
	}
}

// cleanupSensitiveData 清理敏感数据
func cleanupSensitiveData(dataDir string) {
	log.Println("Starting security cleanup...")
	
	// 清理令牌文件
	sensitiveFiles := []string{
		"setup-token.json",
		"setup-config.json",
		"setup-state.json",
	}
	
	for _, file := range sensitiveFiles {
		filePath := filepath.Join(dataDir, file)
		if err := os.Remove(filePath); err != nil {
			log.Printf("Warning: failed to remove %s: %v", file, err)
		} else {
			log.Printf("Removed sensitive file: %s", file)
		}
	}
	
	// 强制垃圾回收清理内存
	runtime.GC()
	log.Println("Security cleanup completed")
}
