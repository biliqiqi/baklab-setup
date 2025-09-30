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

	frontendDistPath := "./frontend/dist"
	_, err := os.Stat(frontendDistPath)
	frontendFilesExist := err == nil

	if cfg.Frontend.Built && frontendFilesExist {
		if err := s.updateSetupProgress("frontend_copy", 95, "Copying frontend files..."); err != nil {
			return err
		}

		if err := s.generator.CopyFrontendToOutput(); err != nil {
			return fmt.Errorf("failed to copy frontend files to output: %w", err)
		}
		log.Printf("Frontend files copied to output directory")
	} else {
		log.Printf("Frontend build skipped - files not built or missing")
		if err := s.updateSetupProgress("frontend_skip", 95, "Frontend build skipped (optional)"); err != nil {
			return err
		}
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

func (s *SetupService) BuildFrontendWithStream(cfg *model.SetupConfig, outputChan chan<- string) error {
	if err := s.generator.BuildFrontendWithStream(cfg, outputChan); err != nil {
		return err
	}

	cfg.Frontend.Built = true
	cfg.Frontend.BuildTime = time.Now()

	if len(cfg.App.FrontendScripts) > 0 || len(cfg.App.FrontendStyles) > 0 {
		log.Printf("Saving extracted frontend assets: %d scripts, %d styles",
			len(cfg.App.FrontendScripts), len(cfg.App.FrontendStyles))
	}

	if err := s.SaveConfiguration(cfg); err != nil {
		log.Printf("Warning: failed to save frontend assets and build status: %v", err)
		return err
	}

	outputChan <- "Frontend assets saved to configuration"
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
		log.Printf("Imported sanitized configuration - passwords and secrets need to be re-entered")
	}

	validationErrors := s.validator.ValidateConfig(&cfg)
	if len(validationErrors) > 0 {
		log.Printf("Imported configuration has %d validation warnings (will be addressed during setup):", len(validationErrors))
		for _, err := range validationErrors {
			log.Printf("  - %s: %s", err.Field, err.Message)
		}
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
