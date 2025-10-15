package services

import (
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"log"
	"os"
	"strings"
	"time"

	"github.com/biliqiqi/baklab-setup/internal/model"
	"github.com/biliqiqi/baklab-setup/internal/storage"
)

type SetupService struct {
	storage   *storage.JSONStorage
	validator *ValidatorService
	generator *GeneratorService
}

func NewSetupService(storage *storage.JSONStorage) *SetupService {
	return &SetupService{
		storage:   storage,
		validator: NewValidatorService(),
		generator: NewGeneratorService(),
	}
}

func (s *SetupService) InitializeSetup(ipAddress string) (*model.SetupToken, error) {
	// completed, err := s.storage.IsSetupCompleted()
	// if err != nil {
	//     return nil, fmt.Errorf("failed to check setup status: %w", err)
	// }
	//
	// if completed {
	//     return nil, fmt.Errorf("setup has already been completed")
	// }

	token, err := s.generateSetupToken(ipAddress)
	if err != nil {
		return nil, fmt.Errorf("failed to generate setup token: %w", err)
	}

	if err := s.storage.SaveSetupToken(token); err != nil {
		return nil, fmt.Errorf("failed to save setup token: %w", err)
	}

	state := &model.SetupState{
		Status:      model.StatusPending,
		CurrentStep: "initialization",
		Progress:    0,
		Message:     "Setup initialized successfully", // Note: This is an internal message
		CreatedAt:   time.Now(),
		UpdatedAt:   time.Now(),
	}

	if err := s.storage.SaveSetupState(state); err != nil {
		return nil, fmt.Errorf("failed to save setup state: %w", err)
	}

	return token, nil
}

func (s *SetupService) GetSetupStatus() (*model.SetupState, error) {
	return s.storage.GetSetupState()
}

func (s *SetupService) ValidateSetupToken(tokenStr string, ipAddress string) error {
	token, err := s.storage.GetSetupToken()
	if err != nil {
		return fmt.Errorf("failed to get setup token: %w", err)
	}

	if token.Token != tokenStr {
		return fmt.Errorf("invalid setup token")
	}

	if time.Now().After(token.ExpiresAt) {
		return fmt.Errorf("setup token has expired")
	}


	if token.IPAddress == "0.0.0.0" {
		token.IPAddress = ipAddress
		if err := s.storage.SaveSetupToken(token); err != nil {
			return fmt.Errorf("failed to bind token to IP: %w", err)
		}
	} else if token.IPAddress != ipAddress {
		return fmt.Errorf("setup token can only be used from IP: %s", token.IPAddress)
	}

	return nil
}

func (s *SetupService) MarkTokenAsUsed(tokenStr string) error {
	token, err := s.storage.GetSetupToken()
	if err != nil {
		return fmt.Errorf("failed to get setup token: %w", err)
	}

	if token.Token == tokenStr {
		token.Used = true
		return s.storage.SaveSetupToken(token)
	}

	return fmt.Errorf("token not found")
}

func (s *SetupService) SaveConfiguration(cfg *model.SetupConfig) error {
	if errors := s.validator.ValidateConfig(cfg); len(errors) > 0 {
		return fmt.Errorf("configuration validation failed: %d errors", len(errors))
	}

	if err := s.updateSetupProgress("configuration", 25, "Configuration saved"); err != nil {
		return err
	}

	return s.storage.SaveSetupConfig(cfg)
}

func (s *SetupService) TestConnections(cfg *model.SetupConfig) ([]model.ConnectionTestResult, error) {
	if err := s.updateSetupProgress("connection-test", 50, "Testing connections..."); err != nil {
		return nil, err
	}

	results := s.validator.TestAllConnections(cfg)

	hasFailures := false
	for _, result := range results {
		if !result.Success {
			hasFailures = true
			break
		}
	}

	if hasFailures {
		if err := s.updateSetupProgress("connection-test", 50, "Some connection tests failed"); err != nil {
			log.Printf("Warning: failed to update setup progress: %v", err)
		}
	} else {
		if err := s.updateSetupProgress("connection-test", 75, "All connection tests passed"); err != nil {
			log.Printf("Warning: failed to update setup progress: %v", err)
		}
	}

	return results, nil
}

func (s *SetupService) GenerateConfigFiles(cfg *model.SetupConfig) error {
	if err := s.generator.ClearOutputDir(); err != nil {
		return fmt.Errorf("failed to clear output directory: %w", err)
	}

	if err := s.updateSetupProgress("generation", 90, "Generating configuration files..."); err != nil {
		return err
	}

	if err := s.generator.GenerateEnvFile(cfg); err != nil {
		return fmt.Errorf("failed to generate .env file: %w", err)
	}

	if err := s.generator.GenerateDockerConfig(cfg); err != nil {
		return fmt.Errorf("failed to generate docker config: %w", err)
	}

	if err := s.generator.SaveSetupConfiguration(cfg); err != nil {
		return fmt.Errorf("failed to save setup configuration: %w", err)
	}

	if err := s.generator.HandleJWTKeyFile(cfg); err != nil {
		return fmt.Errorf("failed to handle JWT key file: %w", err)
	}

	return nil
}

func (s *SetupService) GetOutputDirPath() (string, error) {
	return s.generator.GetAbsoluteOutputDir()
}

func (s *SetupService) HealthCheckServices() ([]model.ConnectionTestResult, error) {
	if err := s.updateSetupProgress("health-check", 98, "Performing service health checks..."); err != nil {
		return nil, err
	}

	cfg, err := s.storage.GetSetupConfig()
	if err != nil {
		return nil, fmt.Errorf("failed to get configuration: %w", err)
	}

	results := s.validator.TestAllConnections(cfg)

	hasFailures := false
	for _, result := range results {
		if !result.Success {
			hasFailures = true
			break
		}
	}

	if hasFailures {
		if err := s.updateSetupProgress("health-check", 98, "Some services failed health check"); err != nil {
			log.Printf("Warning: failed to update setup progress: %v", err)
		}
	} else {
		if err := s.updateSetupProgress("health-check", 99, "All services are healthy"); err != nil {
			log.Printf("Warning: failed to update setup progress: %v", err)
		}
	}

	return results, nil
}

func (s *SetupService) CompleteSetup() error {
	if err := s.invalidateAllTokens(); err != nil {
		log.Printf("Warning: failed to invalidate tokens: %v", err)
		return fmt.Errorf("setup completed but failed to invalidate tokens: %w", err)
	}

	if err := s.updateSetupProgress("completed", 100, "Setup completed successfully - tokens invalidated"); err != nil { // Note: This is an internal message
		log.Printf("Warning: failed to update setup progress: %v", err)
	}

	log.Printf("Setup completed successfully - all tokens have been invalidated")
	return nil
}

func (s *SetupService) IsSetupCompleted() (bool, error) {
	return s.storage.IsSetupCompleted()
}

func (s *SetupService) generateSetupToken(ipAddress string) (*model.SetupToken, error) {
	bytes := make([]byte, 32)
	if _, err := rand.Read(bytes); err != nil {
		return nil, fmt.Errorf("failed to generate random token: %w", err)
	}

	token := &model.SetupToken{
		Token:     hex.EncodeToString(bytes),
		ExpiresAt: time.Now().Add(8 * time.Hour),
		IPAddress: ipAddress,
		Used:      false,
		CreatedAt: time.Now(),
	}

	return token, nil
}

func (s *SetupService) updateSetupProgress(step string, progress int, message string) error {
	state, err := s.storage.GetSetupState()
	if err != nil {
		return err
	}

	state.Status = model.StatusInProgress
	state.CurrentStep = step
	state.Progress = progress
	state.Message = message

	return s.storage.SaveSetupState(state)
}

func (s *SetupService) invalidateAllTokens() error {
	token, err := s.storage.GetSetupToken()
	if err != nil {
		return nil
	}

	token.Used = true
	token.ExpiresAt = time.Now().Add(-1 * time.Hour)

	return s.storage.SaveSetupToken(token)
}

func (s *SetupService) GetSetupConfig() (*model.SetupConfig, error) {
	return s.storage.GetSetupConfig()
}

func (s *SetupService) ResetSetup() error {
	if err := s.storage.ResetSetupState(); err != nil {
		return fmt.Errorf("failed to reset setup state: %w", err)
	}

	return nil
}


func (s *SetupService) ImportConfiguration(configData []byte) (*model.SetupConfig, error) {
	var cfg model.SetupConfig
	if err := json.Unmarshal(configData, &cfg); err != nil {
		return nil, fmt.Errorf("failed to parse configuration: %w", err)
	}

	sanitizedImport := s.isSanitizedConfig(&cfg)

	cfg.RevisionMode.Enabled = true
	cfg.RevisionMode.ImportedAt = time.Now()

	if sanitizedImport {
		cfg.RevisionMode.ModifiedSteps = append(cfg.RevisionMode.ModifiedSteps,
			"NOTICE: Passwords and secrets need to be re-entered")
	}

	validationErrors := s.validator.ValidateConfig(&cfg)
	if len(validationErrors) > 0 {
		cfg.RevisionMode.ModifiedSteps = append(cfg.RevisionMode.ModifiedSteps,
			fmt.Sprintf("VALIDATION_WARNINGS: %d fields need attention", len(validationErrors)))
	}

	if err := s.storage.SaveSetupConfig(&cfg); err != nil {
		return nil, fmt.Errorf("failed to save imported configuration: %w", err)
	}

	statusMsg := "Configuration imported successfully"
	if sanitizedImport {
		statusMsg = "Sanitized configuration imported - passwords required"
	}
	if err := s.updateSetupProgress("import", 25, statusMsg); err != nil {
		log.Printf("Warning: failed to update setup progress: %v", err)
	}

	return &cfg, nil
}

// isSanitizedConfig checks if the configuration has been sanitized (passwords removed)
func (s *SetupService) isSanitizedConfig(cfg *model.SetupConfig) bool {
	// Check for security notice in modified steps
	for _, step := range cfg.RevisionMode.ModifiedSteps {
		if strings.Contains(step, "SECURITY_NOTICE") {
			return true
		}
	}

	// Check if critical passwords are empty (likely sanitized)
	return cfg.Database.AppPassword == "" &&
		   cfg.Redis.Password == "" &&
		   cfg.AdminUser.Password == ""
}

func (s *SetupService) ImportFromOutputDir(outputDir string) (*model.SetupConfig, error) {
	configPath := fmt.Sprintf("%s/.baklab-setup/config.json", outputDir)
	envPath := fmt.Sprintf("%s/.env.production", outputDir)

	log.Printf("Reading config from: %s", configPath)
	configData, err := os.ReadFile(configPath)
	if err != nil {
		return nil, fmt.Errorf("failed to read config.json: %w", err)
	}

	cfg, err := s.ImportConfiguration(configData)
	if err != nil {
		return nil, fmt.Errorf("failed to import base configuration: %w", err)
	}

	log.Printf("Reading .env from: %s", envPath)
	envVars, err := parseEnvFile(envPath)
	if err != nil {
		return nil, fmt.Errorf("failed to parse .env file: %w", err)
	}

	log.Printf("Parsed %d environment variables", len(envVars))

	cfg.Database.SuperPassword = envVars["PG_PASSWORD"]
	cfg.Database.AppPassword = envVars["APP_DB_PASSWORD"]
	cfg.Redis.Password = envVars["REDIS_PASSWORD"]
	cfg.Redis.AdminPassword = envVars["REDISCLI_AUTH"]
	cfg.SMTP.Password = envVars["SMTP_PASSWORD"]
	cfg.AdminUser.Password = envVars["SUPER_PASSWORD"]
	cfg.OAuth.GoogleSecret = envVars["GOOGLE_CLIENT_SECRET"]
	cfg.OAuth.GithubSecret = envVars["GITHUB_CLIENT_SECRET"]
	cfg.App.OAuth.GoogleSecret = envVars["GOOGLE_CLIENT_SECRET"]
	cfg.App.OAuth.GithubSecret = envVars["GITHUB_CLIENT_SECRET"]
	cfg.App.CloudflareSecret = envVars["CLOUDFLARE_SECRET"]

	log.Printf("Populated passwords: DB_App=%v, Redis=%v, Admin=%v",
		cfg.Database.AppPassword != "",
		cfg.Redis.Password != "",
		cfg.AdminUser.Password != "")

	geoipPath := fmt.Sprintf("%s/geoip/GeoLite2-City.mmdb", outputDir)
	if fileInfo, err := os.Stat(geoipPath); err == nil {
		tempDir := "./data/temp"
		if err := os.MkdirAll(tempDir, 0755); err != nil {
			log.Printf("Warning: failed to create temp directory for GeoIP: %v", err)
		} else {
			tempGeoipPath := fmt.Sprintf("%s/GeoLite2-City.mmdb", tempDir)
			if err := copyFile(geoipPath, tempGeoipPath); err != nil {
				log.Printf("Warning: failed to copy GeoIP file to temp: %v", err)
			} else {
				cfg.GoAccess.HasGeoFile = true
				cfg.GoAccess.GeoDBPath = "./geoip/GeoLite2-City.mmdb"
				cfg.GoAccess.GeoTempPath = tempGeoipPath
				cfg.GoAccess.OriginalFileName = "GeoLite2-City.mmdb"
				cfg.GoAccess.FileSize = fileInfo.Size()
				log.Printf("Copied GeoIP file to temp directory: %s (%d bytes)", tempGeoipPath, fileInfo.Size())
			}
		}
	}

	jwtKeyPath := fmt.Sprintf("%s/keys/jwt-private.pem", outputDir)
	if _, err := os.Stat(jwtKeyPath); err == nil {
		cfg.App.JWTKeyFilePath = jwtKeyPath
		cfg.App.JWTKeyFromFile = true
		cfg.App.HasJWTKeyFile = true
		log.Printf("Found JWT key file at: %s", jwtKeyPath)
	}

	cfg.RevisionMode.ModifiedSteps = []string{
		"Imported from previous output directory with full configuration",
	}

	if err := s.storage.SaveSetupConfig(cfg); err != nil {
		return nil, fmt.Errorf("failed to save imported configuration: %w", err)
	}

	if err := s.updateSetupProgress("import", 25, "Configuration imported from output directory"); err != nil {
		log.Printf("Warning: failed to update setup progress: %v", err)
	}

	log.Printf("Successfully imported configuration from output directory")
	return cfg, nil
}

func parseEnvFile(envPath string) (map[string]string, error) {
	content, err := os.ReadFile(envPath)
	if err != nil {
		return nil, err
	}

	envVars := make(map[string]string)
	lines := strings.Split(string(content), "\n")

	for _, line := range lines {
		line = strings.TrimSpace(line)
		if line == "" || strings.HasPrefix(line, "#") {
			continue
		}

		parts := strings.SplitN(line, "=", 2)
		if len(parts) != 2 {
			continue
		}

		key := strings.TrimSpace(parts[0])
		value := strings.TrimSpace(parts[1])
		value = strings.Trim(value, "'\"")

		envVars[key] = value
	}

	return envVars, nil
}

func copyFile(src, dst string) error {
	sourceFile, err := os.Open(src)
	if err != nil {
		return err
	}
	defer sourceFile.Close()

	destFile, err := os.Create(dst)
	if err != nil {
		return err
	}
	defer destFile.Close()

	_, err = destFile.ReadFrom(sourceFile)
	return err
}
