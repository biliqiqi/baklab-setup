package main

import (
	"context"
	"crypto/tls"
	"crypto/x509"
	"embed"
	"encoding/pem"
	"flag"
	"fmt"
	"io/fs"
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
	"golang.org/x/crypto/acme/autocert"
	"golang.org/x/text/language"

	"github.com/biliqiqi/baklab-setup/internal/i18n"
	"github.com/biliqiqi/baklab-setup/internal/services"
	"github.com/biliqiqi/baklab-setup/internal/storage"
	"github.com/biliqiqi/baklab-setup/internal/web"
)

//go:embed static/dist
var staticFS embed.FS

//go:embed templates
var templatesFS embed.FS

var (
	certFile   = flag.String("cert", "", "TLS certificate file path (required unless -auto-cert is used)")
	keyFile    = flag.String("key", "", "TLS private key file path (required unless -auto-cert is used)")
	domain     = flag.String("domain", "", "Domain name for HTTPS access (REQUIRED)")
	autoCert   = flag.Bool("auto-cert", false, "Automatically obtain and renew SSL certificates from Let's Encrypt")
	cacheDir   = flag.String("cache-dir", "./cert-cache", "Directory to cache auto-generated certificates")

	configFile    = flag.String("config", "", "Import sanitized config.json file (passwords removed, safe to share)")
	inputDir      = flag.String("input", "", "Import from previous output directory (includes passwords and sensitive data)")
	outputDir     = flag.String("output", "", "Specify output directory for generated files (optional, defaults to auto-generated path)")
	timeout       = flag.Duration("timeout", 30*time.Minute, "Maximum setup session duration")
	port          = flag.String("port", "8443", "HTTPS port to run the setup server on")
	dataDir       = flag.String("data", "./data", "Directory to store setup data")
	regen         = flag.Bool("regen", false, "Regenerate all config files in-place from existing configuration (requires -input)")
	reverseProxy  = flag.String("reverse-proxy", "", "Override reverse proxy type: 'caddy' or 'nginx' (optional, only used with -regen)")
)

func main() {
	flag.Parse()

	if *regen {
		if err := runRegenMode(); err != nil {
			log.Fatalf("Regeneration failed: %v", err)
		}
		return
	}

	devMode := os.Getenv("BAKLAB_DEV_MODE") == "true" || os.Getenv("BAKLAB_DEV") == "1"
	if devMode {
		log.Printf("Development mode enabled (environment variable detected)")
	}

	if *domain == "" {
		log.Fatal("Domain name is required. Use -domain flag.")
	}

	var certPath, keyPath string
	var certManager *autocert.Manager
	var exportedCertPath, exportedKeyPath string

	if *autoCert {
		if err := os.MkdirAll(*cacheDir, 0700); err != nil {
			log.Fatalf("Failed to create certificate cache directory: %v", err)
		}

		certManager = &autocert.Manager{
			Prompt:      autocert.AcceptTOS,
			HostPolicy:  autocert.HostWhitelist(*domain),
			Cache:       autocert.DirCache(*cacheDir),
		}

		exportDir := filepath.Join(*dataDir, "autocert-export")
		if err := os.MkdirAll(exportDir, 0700); err != nil {
			log.Fatalf("Failed to create autocert export directory: %v", err)
		}

		var err error
		exportedCertPath, err = filepath.Abs(filepath.Join(exportDir, "fullchain.pem"))
		if err != nil {
			log.Fatalf("Failed to get absolute path for exported certificate: %v", err)
		}
		exportedKeyPath, err = filepath.Abs(filepath.Join(exportDir, "privkey.pem"))
		if err != nil {
			log.Fatalf("Failed to get absolute path for exported key: %v", err)
		}

		log.Printf("Auto-cert mode enabled for domain: %s", *domain)
		log.Printf("Certificate cache directory: %s", *cacheDir)
		log.Printf("Exported certificate will be available at: %s", exportedCertPath)
		log.Printf("WARNING: Port 80 must be accessible for Let's Encrypt HTTP-01 challenge")
	} else {
		if *certFile == "" {
			log.Fatal("TLS certificate file is required. Use -cert flag or enable -auto-cert.")
		}
		if *keyFile == "" {
			log.Fatal("TLS private key file is required. Use -key flag or enable -auto-cert.")
		}

		var err error
		certPath, err = filepath.Abs(*certFile)
		if err != nil {
			log.Fatalf("Failed to get absolute path for certificate: %v", err)
		}
		keyPath, err = filepath.Abs(*keyFile)
		if err != nil {
			log.Fatalf("Failed to get absolute path for private key: %v", err)
		}

		if _, err := os.Stat(certPath); os.IsNotExist(err) {
			log.Fatalf("Certificate file not found: %s", certPath)
		}

		if _, err := os.Stat(keyPath); os.IsNotExist(err) {
			log.Fatalf("Private key file not found: %s", keyPath)
		}
	}


	jsonStorage := storage.NewJSONStorage(*dataDir)

	setupService := services.NewSetupService(jsonStorage)
	setupService.SetTemplatesFS(templatesFS)

	if *configFile != "" && *inputDir != "" {
		log.Fatal("Cannot use both -config and -input flags simultaneously. Use -config for sanitized config (no passwords) or -input for full output directory (with passwords)")
	}

	if *configFile != "" {
		if err := importConfigFile(setupService, *configFile); err != nil {
			log.Fatalf("Failed to import config file: %v", err)
		}
	}

	if *inputDir != "" {
		if err := importFromOutputDir(setupService, *inputDir); err != nil {
			log.Fatalf("Failed to import from output directory: %v", err)
		}
	}

	i18nManager := i18n.NewI18nManager(language.English)

	finalCertPath := certPath
	finalKeyPath := keyPath
	if *autoCert {
		finalCertPath = exportedCertPath
		finalKeyPath = exportedKeyPath
	}

	handlers := web.NewSetupHandlers(setupService, i18nManager, devMode, finalCertPath, finalKeyPath)
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

	if *autoCert && certManager != nil {
		r.Handle("/.well-known/acme-challenge/*", certManager.HTTPHandler(nil))
		log.Printf("ACME HTTP-01 challenge handler registered at /.well-known/acme-challenge/")
	}

	staticSubFS, err := fs.Sub(staticFS, "static/dist")
	if err != nil {
		log.Fatalf("Failed to get static/dist subdirectory: %v", err)
	}
	FileServer(r, "/static", http.FS(staticSubFS))

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

	tlsConfig := &tls.Config{
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
	}

	if *autoCert && certManager != nil {
		tlsConfig.GetCertificate = certManager.GetCertificate
	}

	server := &http.Server{
		Addr:      fmt.Sprintf(":%s", *port),
		Handler:   r,
		TLSConfig: tlsConfig,
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
		if err := server.Shutdown(context.Background()); err != nil {
			log.Printf("Error during server shutdown: %v", err)
		}
	}()

	log.Printf("Press Ctrl+C to stop the server")

	var httpServer *http.Server
	if *autoCert && certManager != nil {
		httpServer = &http.Server{
			Addr:    ":80",
			Handler: certManager.HTTPHandler(nil),
		}

		go func() {
			log.Printf("Starting HTTP server on :80 for ACME challenge...")
			if err := httpServer.ListenAndServe(); err != nil && err != http.ErrServerClosed {
				log.Printf("HTTP server error: %v", err)
			}
		}()

		go func() {
			time.Sleep(5 * time.Second)
			if err := exportAutocertCertificate(certManager, *domain, exportedCertPath, exportedKeyPath); err != nil {
				log.Printf("Warning: Failed to export autocert certificate initially: %v", err)
				log.Printf("Certificate will be exported on first successful HTTPS connection")
			}

			ticker := time.NewTicker(24 * time.Hour)
			defer ticker.Stop()
			for range ticker.C {
				if err := exportAutocertCertificate(certManager, *domain, exportedCertPath, exportedKeyPath); err != nil {
					log.Printf("Warning: Failed to refresh exported certificate: %v", err)
				}
			}
		}()

		if err := server.ListenAndServeTLS("", ""); err != nil && err != http.ErrServerClosed {
			log.Fatalf("HTTPS server failed to start: %v", err)
		}

		if httpServer != nil {
			shutdownCtx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
			defer cancel()
			if err := httpServer.Shutdown(shutdownCtx); err != nil {
				log.Printf("Error during HTTP server shutdown: %v", err)
			}
		}
	} else {
		if err := server.ListenAndServeTLS(certPath, keyPath); err != nil && err != http.ErrServerClosed {
			log.Fatalf("HTTPS server failed to start: %v", err)
		}
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

func importFromOutputDir(setupService *services.SetupService, outputDir string) error {
	absPath, err := filepath.Abs(outputDir)
	if err != nil {
		return fmt.Errorf("failed to get absolute path: %w", err)
	}

	if _, err := os.Stat(absPath); os.IsNotExist(err) {
		return fmt.Errorf("output directory not found: %s", absPath)
	}

	_, err = setupService.ImportFromOutputDir(absPath)
	if err != nil {
		return fmt.Errorf("failed to import from output directory: %w", err)
	}

	log.Printf("Successfully imported configuration from: %s", absPath)
	return nil
}

func exportAutocertCertificate(manager *autocert.Manager, domain, certPath, keyPath string) error {
	hello := &tls.ClientHelloInfo{
		ServerName: domain,
	}

	cert, err := manager.GetCertificate(hello)
	if err != nil {
		return fmt.Errorf("failed to get certificate from autocert: %w", err)
	}

	if len(cert.Certificate) == 0 {
		return fmt.Errorf("no certificate found")
	}

	var certPEM []byte
	for _, certDER := range cert.Certificate {
		certPEM = append(certPEM, pem.EncodeToMemory(&pem.Block{
			Type:  "CERTIFICATE",
			Bytes: certDER,
		})...)
	}

	if err := os.WriteFile(certPath, certPEM, 0600); err != nil {
		return fmt.Errorf("failed to write certificate file: %w", err)
	}

	if cert.PrivateKey == nil {
		return fmt.Errorf("no private key found")
	}

	keyDER, err := x509.MarshalPKCS8PrivateKey(cert.PrivateKey)
	if err != nil {
		return fmt.Errorf("failed to marshal private key: %w", err)
	}

	keyPEM := pem.EncodeToMemory(&pem.Block{
		Type:  "PRIVATE KEY",
		Bytes: keyDER,
	})

	if err := os.WriteFile(keyPath, keyPEM, 0600); err != nil {
		return fmt.Errorf("failed to write private key file: %w", err)
	}

	log.Printf("Successfully exported certificate to: %s", certPath)
	log.Printf("Successfully exported private key to: %s", keyPath)
	return nil
}

func runRegenMode() error {
	if *inputDir == "" {
		return fmt.Errorf("-input flag is required when using -regen mode")
	}

	if *reverseProxy != "" && *reverseProxy != "caddy" && *reverseProxy != "nginx" {
		return fmt.Errorf("invalid -reverse-proxy value: %s (must be 'caddy' or 'nginx')", *reverseProxy)
	}

	absInputDir, err := filepath.Abs(*inputDir)
	if err != nil {
		return fmt.Errorf("failed to get absolute path: %w", err)
	}

	var absOutputDir string
	if *outputDir != "" {
		absOutputDir, err = filepath.Abs(*outputDir)
		if err != nil {
			return fmt.Errorf("failed to get absolute path for output: %w", err)
		}

		if _, err := os.Stat(absOutputDir); err == nil {
			return fmt.Errorf("output directory already exists: %s (choose a different path or remove it first)", absOutputDir)
		}
	} else {
		absOutputDir = findAvailableOutputDir(absInputDir)
	}

	log.Printf("Starting regeneration mode...")
	log.Printf("Input directory: %s", absInputDir)
	log.Printf("Output directory: %s", absOutputDir)

	jsonStorage := storage.NewJSONStorage(*dataDir)
	setupService := services.NewSetupService(jsonStorage)
	setupService.SetTemplatesFS(templatesFS)
	setupService.SetOutputDir(absOutputDir)

	cfg, err := setupService.ImportFromOutputDir(absInputDir)
	if err != nil {
		return fmt.Errorf("failed to import configuration: %w", err)
	}

	if *reverseProxy != "" {
		log.Printf("Overriding reverse proxy type: %s -> %s", cfg.ReverseProxy.Type, *reverseProxy)
		cfg.ReverseProxy.Type = *reverseProxy
	}

	log.Printf("Configuration imported successfully")
	log.Printf("Domain: %s", cfg.App.DomainName)
	log.Printf("SSL Enabled: %v", cfg.SSL.Enabled)
	log.Printf("Reverse Proxy: %s", cfg.ReverseProxy.Type)

	if err := setupService.GenerateConfigFiles(cfg); err != nil {
		return fmt.Errorf("failed to generate config files: %w", err)
	}

	log.Printf("========================================")
	log.Printf("Regeneration completed successfully!")
	log.Printf("Input:  %s", absInputDir)
	log.Printf("Output: %s", absOutputDir)
	if absInputDir != absOutputDir {
		log.Printf("NOTE: Output directory differs from input to avoid file conflicts")
	}
	log.Printf("========================================")

	return nil
}

func findAvailableOutputDir(inputDir string) string {
	suffix := 1
	outputDir := fmt.Sprintf("%s-%d", inputDir, suffix)

	for {
		if _, err := os.Stat(outputDir); os.IsNotExist(err) {
			return outputDir
		}
		suffix++
		outputDir = fmt.Sprintf("%s-%d", inputDir, suffix)
	}
}
