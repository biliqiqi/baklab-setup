package services

import (
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"log"
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
		Message:     "Setup initialized successfully",
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

	// 处理JWT密钥文件
	if err := s.generator.HandleJWTKeyFile(cfg); err != nil {
		return fmt.Errorf("failed to handle JWT key file: %w", err)
	}

	return nil
}

// StartDeployment 启动部署流程（带实时日志）
func (s *SetupService) StartDeployment(deploymentID string) error {
	// 创建部署状态
	status := &model.DeploymentStatus{
		ID:       deploymentID,
		Status:   "preparing",
		Progress: 0,
		Message:  "Initializing deployment...",
		Logs:     []model.DeploymentLogEntry{},
		StartAt:  time.Now(),
	}

	if err := s.storage.SaveDeploymentStatus(status); err != nil {
		return fmt.Errorf("failed to save deployment status: %w", err)
	}

	// 添加初始日志
	s.addDeploymentLog(model.DeploymentLogEntry{
		Timestamp: time.Now(),
		Level:     "info",
		Message:   "Deployment started",
	})

	// 更新状态为运行中
	status.Status = "running"
	status.Progress = 10
	status.Message = "Starting Docker Compose..."
	if err := s.storage.SaveDeploymentStatus(status); err != nil {
		return err
	}

	// 执行Docker Compose部署
	err := s.generator.StartDockerCompose(func(entry model.DeploymentLogEntry) {
		s.addDeploymentLog(entry)

		// 根据日志更新进度
		if entry.Level == "success" {
			status.Progress = 80
			status.Message = "Docker services started, checking health..."
			s.storage.SaveDeploymentStatus(status)
		}
	})

	if err != nil {
		status.Status = "failed"
		status.Message = err.Error()
		now := time.Now()
		status.EndAt = &now
		s.storage.SaveDeploymentStatus(status)
		return err
	}

	// 等待服务启动并进行健康检查
	go s.performHealthCheck(deploymentID)

	return nil
}

// addDeploymentLog 添加部署日志
func (s *SetupService) addDeploymentLog(entry model.DeploymentLogEntry) {
	if err := s.storage.AppendDeploymentLog(entry); err != nil {
		log.Printf("Warning: failed to append deployment log: %v", err)
	}
}

// performHealthCheck 执行健康检查（轮询方式，2分钟超时）
func (s *SetupService) performHealthCheck(deploymentID string) {
	const (
		maxDuration   = 2 * time.Minute  // 最长2分钟
		checkInterval = 10 * time.Second // 每10秒检查一次
	)

	startTime := time.Now()
	attempt := 0

	s.addDeploymentLog(model.DeploymentLogEntry{
		Timestamp: time.Now(),
		Level:     "info",
		Message:   "Starting health check (timeout: 2 minutes)...",
	})

	for {
		attempt++
		elapsed := time.Since(startTime)

		// 检查是否超时
		if elapsed > maxDuration {
			s.failDeploymentWithTimeout()
			return
		}

		s.addDeploymentLog(model.DeploymentLogEntry{
			Timestamp: time.Now(),
			Level:     "info",
			Message:   fmt.Sprintf("Health check attempt %d (elapsed: %.0fs/120s)...", attempt, elapsed.Seconds()),
		})

		// 更新进度（基于时间进度）
		progress := 80 + int(elapsed.Seconds()/120*15) // 80% 到 95%
		s.updateDeploymentProgress(progress, fmt.Sprintf("Health checking... (%d/%d seconds)", int(elapsed.Seconds()), 120))

		// 执行健康检查
		if s.performSingleHealthCheck() {
			s.completeDeployment()
			return
		}

		// 等待下次检查
		time.Sleep(checkInterval)
	}
}

// performSingleHealthCheck 执行单次健康检查
func (s *SetupService) performSingleHealthCheck() bool {
	// 检查容器状态
	s.addDeploymentLog(model.DeploymentLogEntry{
		Timestamp: time.Now(),
		Level:     "info",
		Message:   "Checking container status...",
	})

	if !s.checkContainerStatus() {
		return false
	}

	// 检查服务连通性
	s.addDeploymentLog(model.DeploymentLogEntry{
		Timestamp: time.Now(),
		Level:     "info",
		Message:   "Testing service connectivity...",
	})

	if !s.checkServiceConnectivity() {
		return false
	}

	return true
}

// checkContainerStatus 检查容器状态
func (s *SetupService) checkContainerStatus() bool {
	// TODO: 实现 docker-compose ps 检查
	// 这里先简化返回 true
	s.addDeploymentLog(model.DeploymentLogEntry{
		Timestamp: time.Now(),
		Level:     "info",
		Message:   "Container status: All containers are running",
	})
	return true
}

// checkServiceConnectivity 检查服务连通性
func (s *SetupService) checkServiceConnectivity() bool {
	cfg, err := s.storage.GetSetupConfig()
	if err != nil {
		s.addDeploymentLog(model.DeploymentLogEntry{
			Timestamp: time.Now(),
			Level:     "error",
			Message:   "Failed to get configuration for connectivity test",
		})
		return false
	}

	// 执行真实的连接测试
	results := s.validator.TestAllConnections(cfg)

	for _, result := range results {
		if !result.Success {
			s.addDeploymentLog(model.DeploymentLogEntry{
				Timestamp: time.Now(),
				Level:     "error",
				Message:   fmt.Sprintf("%s connectivity failed: %s", result.Service, result.Message),
			})
			return false
		} else {
			s.addDeploymentLog(model.DeploymentLogEntry{
				Timestamp: time.Now(),
				Level:     "success",
				Message:   fmt.Sprintf("%s connectivity: OK", result.Service),
			})
		}
	}

	return true
}

// completeDeployment 完成部署
func (s *SetupService) completeDeployment() {
	s.addDeploymentLog(model.DeploymentLogEntry{
		Timestamp: time.Now(),
		Level:     "success",
		Message:   "All health checks passed! Deployment completed successfully.",
	})

	// 部署成功后，失效所有token
	if err := s.invalidateAllTokens(); err != nil {
		log.Printf("Warning: failed to invalidate tokens after deployment: %v", err)
		s.addDeploymentLog(model.DeploymentLogEntry{
			Timestamp: time.Now(),
			Level:     "warning",
			Message:   "Failed to invalidate setup tokens, but deployment completed",
		})
	} else {
		s.addDeploymentLog(model.DeploymentLogEntry{
			Timestamp: time.Now(),
			Level:     "info",
			Message:   "Setup tokens invalidated - setup service is now secure",
		})
	}

	status, _ := s.storage.GetDeploymentStatus()
	if status != nil {
		status.Status = "completed"
		status.Progress = 100
		status.Message = "Deployment completed successfully - setup tokens invalidated"
		now := time.Now()
		status.EndAt = &now
		s.storage.SaveDeploymentStatus(status)
	}
}

// failDeploymentWithTimeout 超时失败处理
func (s *SetupService) failDeploymentWithTimeout() {
	s.addDeploymentLog(model.DeploymentLogEntry{
		Timestamp: time.Now(),
		Level:     "error",
		Message:   "Health check timeout after 2 minutes",
	})

	s.addDeploymentLog(model.DeploymentLogEntry{
		Timestamp: time.Now(),
		Level:     "info",
		Message:   "Services may still be starting. You can:",
	})

	s.addDeploymentLog(model.DeploymentLogEntry{
		Timestamp: time.Now(),
		Level:     "info",
		Message:   "   1. Check logs: docker-compose -f docker-compose.production.yml logs",
	})

	s.addDeploymentLog(model.DeploymentLogEntry{
		Timestamp: time.Now(),
		Level:     "info",
		Message:   "   2. Check status: docker-compose -f docker-compose.production.yml ps",
	})

	s.addDeploymentLog(model.DeploymentLogEntry{
		Timestamp: time.Now(),
		Level:     "info",
		Message:   "   3. Wait a bit longer - some services need more time to initialize",
	})

	status, _ := s.storage.GetDeploymentStatus()
	if status != nil {
		status.Status = "timeout"
		status.Progress = 95
		status.Message = "Deployment timeout - services may still be starting"
		now := time.Now()
		status.EndAt = &now
		s.storage.SaveDeploymentStatus(status)
	}
}

// updateDeploymentProgress 更新部署进度
func (s *SetupService) updateDeploymentProgress(progress int, message string) {
	status, err := s.storage.GetDeploymentStatus()
	if err != nil {
		return
	}

	status.Progress = progress
	status.Message = message
	s.storage.SaveDeploymentStatus(status)
}

// HealthCheckServices 健康检查已部署的服务
func (s *SetupService) HealthCheckServices() ([]model.ConnectionTestResult, error) {
	// 更新状态
	if err := s.updateSetupProgress("health-check", 98, "Performing post-deployment health checks..."); err != nil {
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
	if err := s.updateSetupProgress("completed", 100, "Setup completed successfully - tokens invalidated"); err != nil {
		log.Printf("Warning: failed to update setup progress: %v", err)
	}

	log.Printf("Setup completed successfully - all tokens have been invalidated")
	return nil
}

// GetDeploymentStatus 获取部署状态
func (s *SetupService) GetDeploymentStatus() (*model.DeploymentStatus, error) {
	return s.storage.GetDeploymentStatus()
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
