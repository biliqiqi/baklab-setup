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
	certFile   = flag.String("cert", "", "TLS certificate file path (REQUIRED)")
	keyFile    = flag.String("key", "", "TLS private key file path (REQUIRED)")
	domain     = flag.String("domain", "", "Domain name for HTTPS access (REQUIRED)")
	
	configFile = flag.String("config", "", "Import existing config.json file for revision")
	timeout = flag.Duration("timeout", 30*time.Minute, "Maximum setup session duration")
	port      = flag.String("port", "8443", "HTTPS port to run the setup server on")
	dataDir   = flag.String("data", "./data", "Directory to store setup data")
	staticDir = flag.String("static", "./static", "Directory containing static files")
)

func main() {
	flag.Parse()

	devMode := os.Getenv("BAKLAB_DEV_MODE") == "true" || os.Getenv("BAKLAB_DEV") == "1"
	if devMode {
		log.Printf("Development mode enabled (environment variable detected)")
	}

	if *certFile == "" {
		log.Fatal("TLS certificate file is required. Use -cert flag.")
	}
	if *keyFile == "" {
		log.Fatal("TLS private key file is required. Use -key flag.")
	}
	if *domain == "" {
		log.Fatal("Domain name is required. Use -domain flag.")
	}

	certPath, err := filepath.Abs(*certFile)
	if err != nil {
		log.Fatalf("Failed to get absolute path for certificate: %v", err)
	}
	keyPath, err := filepath.Abs(*keyFile)
	if err != nil {
		log.Fatalf("Failed to get absolute path for private key: %v", err)
	}

	if _, err := os.Stat(certPath); os.IsNotExist(err) {
		log.Fatalf("Certificate file not found: %s", certPath)
	}

	if _, err := os.Stat(keyPath); os.IsNotExist(err) {
		log.Fatalf("Private key file not found: %s", keyPath)
	}


	jsonStorage := storage.NewJSONStorage(*dataDir)

	setupService := services.NewSetupService(jsonStorage)

	if *configFile != "" {
		if err := importConfigFile(setupService, *configFile); err != nil {
			log.Fatalf("Failed to import config file: %v", err)
		}
	}

	i18nManager := i18n.NewI18nManager(language.English)

	handlers := web.NewSetupHandlers(setupService, i18nManager, devMode, certPath, keyPath)
	middlewares := web.NewSetupMiddleware(setupService, devMode)

	r := chi.NewRouter()

	r.Use(middleware.Logger)
	r.Use(middleware.Recoverer)
	r.Use(middleware.RequestID)
	r.Use(middleware.RealIP)

	r.Use(setupStrictCORS(*domain, *port))

	r.Use(setupSecurityHeaders(*domain))

	r.Use(middleware.NoCache)

	r.Use(web.I18nMiddleware)

	workDir, _ := os.Getwd()
	staticPath := filepath.Join(workDir, *staticDir)
	FileServer(r, "/static", http.Dir(staticPath))

	r.Route("/api", func(r chi.Router) {
		r.Use(middlewares.SetupAuth)

		r.Post("/initialize", handlers.InitializeHandler)
		r.Get("/status", handlers.StatusHandler)
		r.Post("/config", handlers.SaveConfigHandler)
		r.Get("/config", handlers.GetConfigHandler)
		r.Post("/validate", handlers.ValidateConfigHandler)
		r.Post("/test-connections", handlers.TestConnectionsHandler)
		r.Post("/generate", handlers.GenerateConfigHandler)
		r.Get("/current-cert-paths", handlers.GetCurrentCertPathsHandler)

		r.Post("/upload/geo-file", handlers.UploadGeoFileHandler)
		r.Get("/geo-file/status", handlers.CheckGeoFileStatusHandler)


		r.Post("/complete", handlers.CompleteSetupHandler)
	})

	r.Get("/", handlers.IndexHandler)

	clientIP := "0.0.0.0"
	token, err := setupService.InitializeSetup(clientIP)
	if err != nil {
		log.Fatalf("Failed to initialize setup: %v", err)
	}

	accessURL := fmt.Sprintf("https://%s:%s?token=%s", *domain, *port, token.Token)

	fmt.Printf("BakLab HTTPS-Only Setup Service Started\n")
	fmt.Printf("\nOne-time Access URL:\n")
	fmt.Printf("   %s\n\n", accessURL)
	fmt.Printf("Token expires at: %s\n", token.ExpiresAt.Format("2006-01-02 15:04:05"))
	fmt.Printf("Authorized domain: %s\n", *domain)
	fmt.Printf("WARNING: This URL can only be used ONCE!\n")
	fmt.Printf("WARNING: Service will auto-close after setup completion\n")

	server := &http.Server{
		Addr:    fmt.Sprintf(":%s", *port),
		Handler: r,
		TLSConfig: &tls.Config{
			MinVersion: tls.VersionTLS12,
			CipherSuites: []uint16{
				tls.TLS_ECDHE_RSA_WITH_AES_128_GCM_SHA256,
				tls.TLS_ECDHE_ECDSA_WITH_AES_128_GCM_SHA256,
				tls.TLS_ECDHE_RSA_WITH_AES_256_GCM_SHA384,
				tls.TLS_ECDHE_RSA_WITH_CHACHA20_POLY1305,
				tls.TLS_ECDHE_ECDSA_WITH_AES_256_GCM_SHA384,
				tls.TLS_ECDHE_ECDSA_WITH_CHACHA20_POLY1305,
			},
			PreferServerCipherSuites: true,
		},
	}

	go func() {
		sigint := make(chan os.Signal, 1)
		signal.Notify(sigint, os.Interrupt, syscall.SIGTERM)
		<-sigint

		log.Println("Received interrupt signal, shutting down...")

		shutdownCtx, shutdownCancel := context.WithTimeout(context.Background(), 30*time.Second)
		defer shutdownCancel()

		if err := server.Shutdown(shutdownCtx); err != nil {
			log.Printf("Server shutdown error: %v", err)
		}
	}()

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

func setupStrictCORS(domain, port string) func(http.Handler) http.Handler {
	allowedOrigins := []string{
		fmt.Sprintf("https://%s:%s", domain, port),
		fmt.Sprintf("https://%s", domain),
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
			"Setup-Token",
			"X-Language",
			"X-Requested-With",
			"Authorization",
		},
		ExposedHeaders: []string{
			"Setup-Token-Status",
		},
		AllowCredentials: false,
		MaxAge:           300,
	})
}

func setupSecurityHeaders(domain string) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			cspDirectives := []string{
				"default-src 'self'",
				fmt.Sprintf("connect-src 'self' https://%s", domain),
				"script-src 'self' 'unsafe-inline'",
				"style-src 'self' 'unsafe-inline'",
				"img-src 'self' data:",
				"font-src 'self'",
				"frame-ancestors 'none'",
				"base-uri 'self'",
				"form-action 'self'",
			}
			w.Header().Set("Content-Security-Policy", strings.Join(cspDirectives, "; "))

			w.Header().Set("Strict-Transport-Security", "max-age=31536000; includeSubDomains; preload")
			w.Header().Set("X-Content-Type-Options", "nosniff")
			w.Header().Set("X-Frame-Options", "DENY")
			w.Header().Set("X-XSS-Protection", "1; mode=block")
			w.Header().Set("Referrer-Policy", "strict-origin-when-cross-origin")
			w.Header().Set("Permissions-Policy", "geolocation=(), microphone=(), camera=()")

			w.Header().Set("Cache-Control", "no-cache, no-store, must-revalidate")
			w.Header().Set("Pragma", "no-cache")
			w.Header().Set("Expires", "0")

			next.ServeHTTP(w, r)
		})
	}
}

func cleanupSensitiveData(dataDir string) {
	log.Println("Starting security cleanup...")

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

	runtime.GC()
	log.Println("Security cleanup completed")
}

func importConfigFile(setupService *services.SetupService, configPath string) error {
	if _, err := os.Stat(configPath); os.IsNotExist(err) {
		return fmt.Errorf("config file not found: %s", configPath)
	}

	configData, err := os.ReadFile(configPath)
	if err != nil {
		return fmt.Errorf("failed to read config file: %w", err)
	}

	_, err = setupService.ImportConfiguration(configData)
	if err != nil {
		return fmt.Errorf("failed to import configuration: %w", err)
	}

	return nil
}
