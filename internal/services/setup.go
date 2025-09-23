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

// SetupService setup核心服务
type SetupService struct {
	storage   *storage.JSONStorage
	validator *ValidatorService
	generator *GeneratorService
}

// NewSetupService 创建setup服务实例
func NewSetupService(storage *storage.JSONStorage) *SetupService {
	return &SetupService{
		storage:   storage,
		validator: NewValidatorService(),
		generator: NewGeneratorService(),
	}
}

// InitializeSetup 初始化setup（允许重复执行）
func (s *SetupService) InitializeSetup(ipAddress string) (*model.SetupToken, error) {
	// 注释：移除完成状态检查，允许重复初始化
	// completed, err := s.storage.IsSetupCompleted()
	// if err != nil {
	//     return nil, fmt.Errorf("failed to check setup status: %w", err)
	// }
	//
	// if completed {
	//     return nil, fmt.Errorf("setup has already been completed")
	// }

	// 生成访问令牌
	token, err := s.generateSetupToken(ipAddress)
	if err != nil {
		return nil, fmt.Errorf("failed to generate setup token: %w", err)
	}

	// 保存令牌
	if err := s.storage.SaveSetupToken(token); err != nil {
		return nil, fmt.Errorf("failed to save setup token: %w", err)
	}

	// 初始化setup状态
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

// GetSetupStatus 获取setup状态
func (s *SetupService) GetSetupStatus() (*model.SetupState, error) {
	return s.storage.GetSetupState()
}

// ValidateSetupToken 验证setup令牌
func (s *SetupService) ValidateSetupToken(tokenStr string, ipAddress string) error {
	token, err := s.storage.GetSetupToken()
	if err != nil {
		return fmt.Errorf("failed to get setup token: %w", err)
	}

	// 检查令牌是否匹配
	if token.Token != tokenStr {
		return fmt.Errorf("invalid setup token")
	}

	// 检查是否已过期
	if time.Now().After(token.ExpiresAt) {
		return fmt.Errorf("setup token has expired")
	}

	// 在整个setup流程中，不检查Used状态
	// Token只在部署成功或手动完成setup后才会失效

	// 检查IP地址绑定
	if token.IPAddress == "0.0.0.0" {
		// 首次使用时绑定IP地址
		token.IPAddress = ipAddress
		if err := s.storage.SaveSetupToken(token); err != nil {
			return fmt.Errorf("failed to bind token to IP: %w", err)
		}
	} else if token.IPAddress != ipAddress {
		return fmt.Errorf("setup token can only be used from IP: %s", token.IPAddress)
	}

	return nil
}

// MarkTokenAsUsed 标记token为已使用（用于非只读操作）
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

// SaveConfiguration 保存配置
func (s *SetupService) SaveConfiguration(cfg *model.SetupConfig) error {
	// 验证配置
	if errors := s.validator.ValidateConfig(cfg); len(errors) > 0 {
		return fmt.Errorf("configuration validation failed: %d errors", len(errors))
	}

	// 更新状态
	if err := s.updateSetupProgress("configuration", 25, "Configuration saved"); err != nil {
		return err
	}

	// 保存配置
	return s.storage.SaveSetupConfig(cfg)
}

// TestConnections 测试连接
func (s *SetupService) TestConnections(cfg *model.SetupConfig) ([]model.ConnectionTestResult, error) {
	// 更新状态
	if err := s.updateSetupProgress("connection-test", 50, "Testing connections..."); err != nil {
		return nil, err
	}

	// 执行连接测试
	results := s.validator.TestAllConnections(cfg)

	// 检查是否有失败的连接
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

// GenerateConfigFiles 生成配置文件
func (s *SetupService) GenerateConfigFiles(cfg *model.SetupConfig) error {
	// 清空配置目录，避免旧文件残留
	if err := s.generator.ClearOutputDir(); err != nil {
		return fmt.Errorf("failed to clear output directory: %w", err)
	}

	// 更新状态
	if err := s.updateSetupProgress("generation", 90, "Generating configuration files..."); err != nil {
		return err
	}

	// 生成.env文件
	if err := s.generator.GenerateEnvFile(cfg); err != nil {
		return fmt.Errorf("failed to generate .env file: %w", err)
	}

	// 生成Docker配置文件
	if err := s.generator.GenerateDockerConfig(cfg); err != nil {
		return fmt.Errorf("failed to generate docker config: %w", err)
	}

	// 保存完整的配置到.baklab-setup目录
	if err := s.generator.SaveSetupConfiguration(cfg); err != nil {
		return fmt.Errorf("failed to save setup configuration: %w", err)
	}

	// 处理JWT密钥文件
	if err := s.generator.HandleJWTKeyFile(cfg); err != nil {
		return fmt.Errorf("failed to handle JWT key file: %w", err)
	}

	// 处理前端构建文件
	// 检查前端构建文件是否存在
	frontendDistPath := "./frontend/dist"
	_, err := os.Stat(frontendDistPath)
	frontendFilesExist := err == nil

	if cfg.Frontend.Built && frontendFilesExist {
		// 前端已经构建过，直接复制到输出目录
		if err := s.updateSetupProgress("frontend_copy", 95, "Copying frontend files..."); err != nil {
			return err
		}

		if err := s.generator.CopyFrontendToOutput(); err != nil {
			return fmt.Errorf("failed to copy frontend files to output: %w", err)
		}
	} else {
		// 前端未构建或构建文件不存在，需要先构建再复制
		var message string
		if !cfg.Frontend.Built {
			message = "Building frontend..."
		} else {
			message = "Frontend files missing, rebuilding..."
		}

		if err := s.updateSetupProgress("frontend_build", 95, message); err != nil {
			return err
		}

		if err := s.generator.BuildFrontend(cfg); err != nil {
			return fmt.Errorf("failed to build frontend: %w", err)
		}

		// 复制前端构建文件到输出目录
		if err := s.generator.CopyFrontendToOutput(); err != nil {
			return fmt.Errorf("failed to copy frontend files to output: %w", err)
		}

		// 更新前端构建状态
		cfg.Frontend.Built = true
		cfg.Frontend.BuildTime = time.Now()

		// 保存提取的前端资源到配置中
		if len(cfg.App.FrontendScripts) > 0 || len(cfg.App.FrontendStyles) > 0 {
			log.Printf("Saving extracted frontend assets: %d scripts, %d styles",
				len(cfg.App.FrontendScripts), len(cfg.App.FrontendStyles))
		}

		if err := s.SaveConfiguration(cfg); err != nil {
			log.Printf("Warning: failed to save frontend build status: %v", err)
		}
	}

	return nil
}

// GetOutputDirPath 获取输出目录的绝对路径
func (s *SetupService) GetOutputDirPath() (string, error) {
	return s.generator.GetAbsoluteOutputDir()
}

// HealthCheckServices 健康检查已部署的服务
func (s *SetupService) HealthCheckServices() ([]model.ConnectionTestResult, error) {
	// 更新状态
	if err := s.updateSetupProgress("health-check", 98, "Performing service health checks..."); err != nil {
		return nil, err
	}

	// 获取配置
	cfg, err := s.storage.GetSetupConfig()
	if err != nil {
		return nil, fmt.Errorf("failed to get configuration: %w", err)
	}

	// 执行真实的连接测试
	results := s.validator.TestAllConnections(cfg)

	// 检查是否有失败的服务
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

// CompleteSetup 完成setup（手动完成时失效token）
func (s *SetupService) CompleteSetup() error {
	// 手动完成setup时，失效所有token
	if err := s.invalidateAllTokens(); err != nil {
		log.Printf("Warning: failed to invalidate tokens: %v", err)
		return fmt.Errorf("setup completed but failed to invalidate tokens: %w", err)
	}

	// 更新setup状态为已完成
	if err := s.updateSetupProgress("completed", 100, "Setup completed successfully - tokens invalidated"); err != nil { // Note: This is an internal message
		log.Printf("Warning: failed to update setup progress: %v", err)
	}

	log.Printf("Setup completed successfully - all tokens have been invalidated")
	return nil
}

// IsSetupCompleted 检查setup是否已完成
func (s *SetupService) IsSetupCompleted() (bool, error) {
	return s.storage.IsSetupCompleted()
}

// generateSetupToken 生成setup令牌
func (s *SetupService) generateSetupToken(ipAddress string) (*model.SetupToken, error) {
	// 生成32字节随机令牌
	bytes := make([]byte, 32)
	if _, err := rand.Read(bytes); err != nil {
		return nil, fmt.Errorf("failed to generate random token: %w", err)
	}

	token := &model.SetupToken{
		Token:     hex.EncodeToString(bytes),
		ExpiresAt: time.Now().Add(8 * time.Hour), // 8小时过期，足够完成整个setup流程
		IPAddress: ipAddress,                     // 绑定IP地址
		Used:      false,                         // 初始未使用
		CreatedAt: time.Now(),
	}

	return token, nil
}

// updateSetupProgress 更新setup进度
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

// invalidateAllTokens 失效所有令牌
func (s *SetupService) invalidateAllTokens() error {
	token, err := s.storage.GetSetupToken()
	if err != nil {
		// 如果令牌不存在，认为已经清理完成
		return nil
	}

	// 将令牌标记为已使用并过期
	token.Used = true
	token.ExpiresAt = time.Now().Add(-1 * time.Hour) // 设置为过期

	return s.storage.SaveSetupToken(token)
}

// GetSetupConfig 获取保存的配置
func (s *SetupService) GetSetupConfig() (*model.SetupConfig, error) {
	return s.storage.GetSetupConfig()
}

// ResetSetup 重置setup状态，允许重新运行
func (s *SetupService) ResetSetup() error {
	if err := s.storage.ResetSetupState(); err != nil {
		return fmt.Errorf("failed to reset setup state: %w", err)
	}

	return nil
}

// BuildFrontendWithStream 构建前端并流式输出
func (s *SetupService) BuildFrontendWithStream(cfg *model.SetupConfig, outputChan chan<- string) error {
	// 执行构建
	if err := s.generator.BuildFrontendWithStream(cfg, outputChan); err != nil {
		return err
	}

	// 构建成功后，保存提取的前端资源到配置中
	cfg.Frontend.Built = true
	cfg.Frontend.BuildTime = time.Now()

	// 保存提取的前端资源到配置中
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

// ImportConfiguration 导入配置文件
func (s *SetupService) ImportConfiguration(configData []byte) (*model.SetupConfig, error) {
	var cfg model.SetupConfig
	if err := json.Unmarshal(configData, &cfg); err != nil {
		return nil, fmt.Errorf("failed to parse configuration: %w", err)
	}

	// 检查是否包含敏感信息清理的标记
	sanitizedImport := s.isSanitizedConfig(&cfg)

	// 标记为修订模式
	cfg.RevisionMode.Enabled = true
	cfg.RevisionMode.ImportedAt = time.Now()

	if sanitizedImport {
		cfg.RevisionMode.ModifiedSteps = append(cfg.RevisionMode.ModifiedSteps,
			"NOTICE: Passwords and secrets need to be re-entered")
		log.Printf("Imported sanitized configuration - passwords and secrets need to be re-entered")
	}

	// 复用现有校验器进行格式校验，但允许部分字段缺失
	// 对于导入的配置，校验错误只作为警告记录，不阻止导入
	validationErrors := s.validator.ValidateConfig(&cfg)
	if len(validationErrors) > 0 {
		log.Printf("Imported configuration has %d validation warnings (will be addressed during setup):", len(validationErrors))
		for _, err := range validationErrors {
			log.Printf("  - %s: %s", err.Field, err.Message)
		}
		// 将警告信息添加到修订步骤中
		cfg.RevisionMode.ModifiedSteps = append(cfg.RevisionMode.ModifiedSteps,
			fmt.Sprintf("VALIDATION_WARNINGS: %d fields need attention", len(validationErrors)))
	}

	// 保存导入的配置
	if err := s.storage.SaveSetupConfig(&cfg); err != nil {
		return nil, fmt.Errorf("failed to save imported configuration: %w", err)
	}

	// 更新状态
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
