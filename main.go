package main

import (
	"context"
	"flag"
	"fmt"
	"log"
	"net/http"
	"os"
	"os/signal"
	"path/filepath"
	"strings"
	"syscall"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"github.com/go-chi/cors"

	"github.com/biliqiqi/baklab-setup/internal/services"
	"github.com/biliqiqi/baklab-setup/internal/storage"
	"github.com/biliqiqi/baklab-setup/internal/web"
)

var (
	port      = flag.String("port", "8080", "Port to run the setup server on")
	dataDir   = flag.String("data", "./data", "Directory to store setup data")
	staticDir = flag.String("static", "./static", "Directory containing static files")
)

func main() {
	flag.Parse()

	log.Printf("Starting BakLab Setup Service...")
	log.Printf("Data directory: %s", *dataDir)
	log.Printf("Server will run on port %s", *port)

	// 初始化存储
	jsonStorage := storage.NewJSONStorage(*dataDir)

	// 初始化服务
	setupService := services.NewSetupService(jsonStorage)

	// 创建处理器
	handlers := web.NewSetupHandlers(setupService)
	middlewares := web.NewSetupMiddleware(setupService)

	// 设置路由
	r := chi.NewRouter()

	// 全局中间件
	r.Use(middleware.Logger)
	r.Use(middleware.Recoverer)
	r.Use(middleware.RequestID)
	r.Use(middleware.RealIP)

	// CORS中间件（setup阶段比较宽松）
	r.Use(cors.Handler(cors.Options{
		AllowedOrigins:   []string{"*"},
		AllowedMethods:   []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
		AllowedHeaders:   []string{"*"},
		ExposedHeaders:   []string{"Link"},
		AllowCredentials: true,
		MaxAge:           300,
	}))

	// 安全头
	r.Use(middleware.SetHeader("X-Content-Type-Options", "nosniff"))
	r.Use(middleware.SetHeader("X-Frame-Options", "DENY"))
	r.Use(middleware.SetHeader("X-XSS-Protection", "1; mode=block"))

	// setup阶段禁用缓存
	r.Use(middleware.NoCache)

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

		// 部署相关路由
		r.Post("/deploy", handlers.StartDeploymentHandler)
		r.Get("/deploy/status", handlers.DeploymentStatusHandler)
		r.Get("/deploy/logs/{deploymentId}", handlers.DeploymentLogsHandler)

		r.Post("/complete", handlers.CompleteSetupHandler)
	})

	// 主页路由
	r.Get("/", handlers.IndexHandler)

	// 启动服务器
	server := &http.Server{
		Addr:    fmt.Sprintf(":%s", *port),
		Handler: r,
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

	log.Printf("Setup server running on http://localhost:%s", *port)
	log.Printf("Access the setup interface at http://localhost:%s", *port)
	log.Printf("Press Ctrl+C to stop the server")

	if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
		log.Fatalf("Server failed to start: %v", err)
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
