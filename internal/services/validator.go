package services

import (
	"context"
	"crypto/tls"
	"database/sql"
	"fmt"
	"log"
	"net"
	"net/smtp"
	"net/url"
	"regexp"
	"strconv"
	"strings"
	"time"
	"unicode/utf8"

	"github.com/biliqiqi/baklab-setup/internal/model"
	_ "github.com/lib/pq" // PostgreSQL driver
	"github.com/redis/go-redis/v9"
)

// ValidatorService 配置验证服务
type ValidatorService struct{}

// NewValidatorService 创建验证服务实例
func NewValidatorService() *ValidatorService {
	return &ValidatorService{}
}

// 验证正则表达式
var (
	// 主机名或IP地址
	hostRegex = regexp.MustCompile(`^[a-zA-Z0-9.-]+$`)

	// 数据库名称和用户名（以字母开头，只包含字母、数字、下划线）
	dbNameRegex = regexp.MustCompile(`^[a-zA-Z][a-zA-Z0-9_]*$`)

	// 域名格式 - 支持多级域名和子域名
	domainRegex = regexp.MustCompile(`^([a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}$|^localhost$`)

	// 品牌名称校验已移除字符类型限制，只保留长度验证

	// 用户名格式（与主项目保持一致：开头和结尾必须是字母数字，中间可以有字母、数字、点、下划线、连字符）
	usernameRegex = regexp.MustCompile(`^[a-zA-Z0-9][a-zA-Z0-9._-]+[a-zA-Z0-9]$`)

	// 电子邮箱格式
	emailRegex = regexp.MustCompile(`^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$`)

	// URL格式（用于CORS）
	urlRegex = regexp.MustCompile(`^https?://[a-zA-Z0-9.-]+(?::[0-9]+)?(?:/.*)?$`)
)

// 密码验证规则（与主项目保持一致）
var (
	// 密码格式：12-64位，只允许字母、数字和特定特殊字符
	passwordFormatRegex = regexp.MustCompile(`^[A-Za-z\d!@#$%^&*]{12,64}$`)
	// 必须包含小写字母
	passwordLowerRegex = regexp.MustCompile(`[a-z]`)
	// 必须包含大写字母
	passwordUpperRegex = regexp.MustCompile(`[A-Z]`)
	// 必须包含数字
	passwordDigitRegex = regexp.MustCompile(`\d`)
	// 必须包含特殊字符
	passwordSpecialRegex = regexp.MustCompile(`[!@#$%^&*]`)
)

// validatePassword 验证密码（与主项目model/user.go的ValidPassword保持一致）
func validatePassword(pwd string) bool {
	pwdBytes := []byte(pwd)

	// 检查格式、长度和字符集
	if !passwordFormatRegex.Match(pwdBytes) {
		return false
	}

	// 检查必须包含的字符类型
	return passwordLowerRegex.Match(pwdBytes) &&
		passwordUpperRegex.Match(pwdBytes) &&
		passwordDigitRegex.Match(pwdBytes) &&
		passwordSpecialRegex.Match(pwdBytes)
}

// validateDatabasePassword 验证数据库/Redis密码（比用户密码稍微宽松）
func validateDatabasePassword(pwd string) bool {
	pwdBytes := []byte(pwd)

	// 检查格式、长度和字符集
	if !passwordFormatRegex.Match(pwdBytes) {
		return false
	}

	// 至少包含3种字符类型
	typeCount := 0
	if passwordLowerRegex.Match(pwdBytes) {
		typeCount++
	}
	if passwordUpperRegex.Match(pwdBytes) {
		typeCount++
	}
	if passwordDigitRegex.Match(pwdBytes) {
		typeCount++
	}
	if passwordSpecialRegex.Match(pwdBytes) {
		typeCount++
	}

	return typeCount >= 3
}

// validateExternalServicePassword 验证外部服务密码（更宽松的规则，遵循PostgreSQL/Redis规范）
func validateExternalServicePassword(pwd string) bool {
	// 外部服务密码验证：只检查基本要求
	// 1. 不能为空
	// 2. 长度在1-128字符之间（PostgreSQL和Redis都支持这个范围）
	// 3. 不包含不安全字符
	if pwd == "" {
		return false
	}

	// PostgreSQL和Redis密码长度限制
	if len(pwd) < 1 || len(pwd) > 128 {
		return false
	}

	// 不能包含控制字符和不可打印字符
	for _, char := range pwd {
		if char < 32 || char == 127 {
			return false
		}
	}

	return true
}

// TestDatabaseConnection 验证数据库配置格式
func (v *ValidatorService) TestDatabaseConnection(cfg model.DatabaseConfig) model.ConnectionTestResult {
	result := model.ConnectionTestResult{
		Service:  "database",
		TestedAt: time.Now(),
	}

	// 验证必填字段
	if cfg.Host == "" {
		result.Success = false
		result.Message = "key:validation.database.host_required"
		return result
	}

	if cfg.Port <= 0 || cfg.Port > 65535 {
		result.Success = false
		result.Message = "key:validation.database.port_invalid"
		return result
	}

	if cfg.Name == "" {
		result.Success = false
		result.Message = "key:validation.database.name_required"
		return result
	}

	// 外部服务模式下不需要超级用户验证
	if cfg.ServiceType == "docker" {
		if cfg.SuperUser == "" {
			result.Success = false
			result.Message = "key:validation.database.super_user_required"
			return result
		}

		if cfg.SuperPassword == "" {
			result.Success = false
			result.Message = "key:validation.database.super_password_required"
			return result
		}
	}

	if cfg.AppUser == "" {
		result.Success = false
		result.Message = "key:validation.database.app_user_required"
		return result
	}

	if cfg.AppPassword == "" {
		result.Success = false
		result.Message = "key:validation.database.app_password_required"
		return result
	}

	// Docker模式下跳过连接测试，因为服务还未启动
	if cfg.ServiceType == "docker" {
		result.Success = true
		result.Message = "key:messages.database_config_validated"
		return result
	}

	// 外部服务模式下进行实际连接测试
	// 构建连接字符串并尝试实际连接（对用户名和密码进行URL编码）
	encodedUser := url.QueryEscape(cfg.AppUser)
	encodedPassword := url.QueryEscape(cfg.AppPassword)
	dsn := fmt.Sprintf("postgres://%s:%s@%s:%d/%s?sslmode=disable",
		encodedUser, encodedPassword, cfg.Host, cfg.Port, cfg.Name)

	// 打开数据库连接
	db, err := sql.Open("postgres", dsn)
	if err != nil {
		result.Success = false
		result.Message = "key:validation.database.config_invalid"
		return result
	}
	defer db.Close()

	// 尝试实际连接（Ping）
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	if err := db.PingContext(ctx); err != nil {
		result.Success = false
		result.Message = "key:validation.database.connection_failed"
		return result
	}

	result.Success = true
	result.Message = "key:messages.database_connection_successful"
	return result
}

// TestRedisConnection 验证Redis配置格式
func (v *ValidatorService) TestRedisConnection(cfg model.RedisConfig) model.ConnectionTestResult {
	result := model.ConnectionTestResult{
		Service:  "redis",
		TestedAt: time.Now(),
	}

	// 验证必填字段
	if cfg.Host == "" {
		result.Success = false
		result.Message = "key:validation.redis.host_required"
		return result
	}

	if cfg.Port <= 0 || cfg.Port > 65535 {
		result.Success = false
		result.Message = "key:validation.redis.port_invalid"
		return result
	}

	// Docker模式下跳过连接测试，因为服务还未启动
	if cfg.ServiceType == "docker" {
		result.Success = true
		result.Message = "key:messages.redis_config_validated"
		return result
	}

	// 外部服务模式下进行实际连接测试
	// 构建Redis连接选项
	opts := &redis.Options{
		Addr:     net.JoinHostPort(cfg.Host, strconv.Itoa(cfg.Port)),
		Password: cfg.Password,
		DB:       0, // 默认使用数据库0
	}

	// 如果有用户名，设置用户名
	if cfg.User != "" {
		opts.Username = cfg.User
	}

	// 创建Redis客户端
	client := redis.NewClient(opts)
	defer client.Close()

	// 尝试连接（设置10秒超时）
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	// Ping Redis服务器
	if err := client.Ping(ctx).Err(); err != nil {
		result.Success = false
		result.Message = "key:validation.redis.connection_failed"
		return result
	}

	result.Success = true
	result.Message = "key:messages.redis_connection_successful"
	return result
}

// TestSMTPConnection 测试SMTP连接
func (v *ValidatorService) TestSMTPConnection(cfg model.SMTPConfig) model.ConnectionTestResult {
	result := model.ConnectionTestResult{
		Service:  "smtp",
		TestedAt: time.Now(),
	}

	// 构建SMTP地址
	address := net.JoinHostPort(cfg.Server, strconv.Itoa(cfg.Port))

	// 建立连接
	client, err := smtp.Dial(address)
	if err != nil {
		result.Success = false
		result.Message = "key:validation.smtp.connection_failed"
		return result
	}

	// 使用更安全的连接关闭方式
	var connectionClosed bool
	defer func() {
		if !connectionClosed {
			if err := client.Close(); err != nil {
				// 忽略 "use of closed network connection" 错误，这是正常的
				if !strings.Contains(err.Error(), "use of closed network connection") {
					log.Printf("Warning: failed to close SMTP connection: %v", err)
				}
			}
		}
	}()

	// 检查并启动 STARTTLS
	if ok, _ := client.Extension("STARTTLS"); ok {
		tlsConfig := &tls.Config{
			ServerName: cfg.Server,
		}
		if err := client.StartTLS(tlsConfig); err != nil {
			connectionClosed = true
			result.Success = false
			result.Message = "key:validation.smtp.tls_failed"
			return result
		}
	}

	// 测试认证
	if cfg.User != "" && cfg.Password != "" {
		// 首先尝试 PLAIN 认证
		auth := smtp.PlainAuth("", cfg.User, cfg.Password, cfg.Server)
		if err := client.Auth(auth); err != nil {
			log.Printf("PLAIN auth failed: %v, trying to close connection gracefully", err)
			// PLAIN 认证失败时，连接可能已经被服务器关闭
			connectionClosed = true
			result.Success = false
			result.Message = "key:validation.smtp.auth_failed"
			return result
		}
	}

	result.Success = true
	result.Message = "key:messages.smtp_connection_successful"
	return result
}

// ValidateConfig 递增验证配置（根据当前步骤只验证已提交的部分）
func (v *ValidatorService) ValidateConfig(cfg *model.SetupConfig) []model.ValidationError {
	var errors []model.ValidationError

	// 定义步骤顺序（与前端步骤顺序保持一致）
	stepOrder := []string{"welcome", "database", "redis", "smtp", "app", "ssl", "admin", "oauth", "goaccess", "frontend", "review", "config_complete"}
	currentStepIndex := -1

	// 找到当前步骤的索引
	for i, step := range stepOrder {
		if step == cfg.CurrentStep {
			currentStepIndex = i
			break
		}
	}

	// 如果没找到当前步骤，默认验证所有（向后兼容）
	if currentStepIndex == -1 {
		currentStepIndex = len(stepOrder) - 1
	}

	// 根据步骤递增验证
	if currentStepIndex >= 1 { // database
		errors = append(errors, v.validateDatabaseConfig(cfg.Database)...)
	}

	if currentStepIndex >= 2 { // redis
		errors = append(errors, v.validateRedisConfig(cfg.Redis)...)
	}

	if currentStepIndex >= 3 { // smtp
		errors = append(errors, v.validateSMTPConfig(cfg.SMTP)...)
	}

	if currentStepIndex >= 4 { // app
		errors = append(errors, v.validateAppConfig(cfg.App)...)
	}

	if currentStepIndex >= 5 { // ssl
		errors = append(errors, v.validateSSLConfig(cfg.SSL)...)
	}

	if currentStepIndex >= 6 { // admin
		errors = append(errors, v.validateAdminUserConfig(cfg.AdminUser)...)
	}

	if currentStepIndex >= 7 { // oauth
		errors = append(errors, v.validateOAuthConfig(cfg.OAuth)...)
	}

	// goaccess 不需要强制验证，跳过

	if currentStepIndex >= 9 { // frontend
		errors = append(errors, v.validateFrontendConfig(cfg.App)...)
	}

	return errors
}

// validateDatabaseConfig 验证数据库配置
func (v *ValidatorService) validateDatabaseConfig(cfg model.DatabaseConfig) []model.ValidationError {
	var errors []model.ValidationError

	// ServiceType验证
	if cfg.ServiceType != "docker" && cfg.ServiceType != "external" {
		errors = append(errors, model.ValidationError{
			Field:   "database.service_type",
			Message: "key:validation.database.service_type_error",
		})
	}

	// Host验证 - docker模式下强制localhost
	if cfg.ServiceType == "docker" {
		if cfg.Host != "localhost" {
			errors = append(errors, model.ValidationError{
				Field:   "database.host",
				Message: "key:validation.database.host_docker_error",
			})
		}
	} else {
		// external模式下需要验证host
		if cfg.Host == "" {
			errors = append(errors, model.ValidationError{
				Field:   "database.host",
				Message: "key:validation.database.host_required",
			})
		} else if !hostRegex.MatchString(cfg.Host) {
			errors = append(errors, model.ValidationError{
				Field:   "database.host",
				Message: "key:validation.database.host_error",
			})
		}
	}

	// Port验证
	if cfg.Port <= 0 || cfg.Port > 65535 {
		errors = append(errors, model.ValidationError{
			Field:   "database.port",
			Message: "key:validation.database.port_invalid",
		})
	}

	// Database name验证
	if cfg.Name == "" {
		errors = append(errors, model.ValidationError{
			Field:   "database.name",
			Message: "key:validation.database.name_required",
		})
	} else if len(cfg.Name) > 63 {
		errors = append(errors, model.ValidationError{
			Field:   "database.name",
			Message: "key:validation.database.name_error",
		})
	} else if !dbNameRegex.MatchString(cfg.Name) {
		errors = append(errors, model.ValidationError{
			Field:   "database.name",
			Message: "key:validation.database.name_error",
		})
	}

	// 超级用户验证 - 仅Docker模式需要（用于初始化数据库容器）
	if cfg.ServiceType == "docker" {
		if cfg.SuperUser == "" {
			errors = append(errors, model.ValidationError{
				Field:   "database.super_user",
				Message: "key:validation.database.super_user_required",
			})
		} else if len(cfg.SuperUser) > 63 {
			errors = append(errors, model.ValidationError{
				Field:   "database.super_user",
				Message: "key:validation.database.super_user_error",
			})
		} else if !dbNameRegex.MatchString(cfg.SuperUser) {
			errors = append(errors, model.ValidationError{
				Field:   "database.super_user",
				Message: "key:validation.database.super_user_error",
			})
		}
	}

	// 应用用户验证
	if cfg.AppUser == "" {
		errors = append(errors, model.ValidationError{
			Field:   "database.app_user",
			Message: "key:validation.database.app_user_required",
		})
	} else if cfg.ServiceType == "docker" {
		// Docker模式使用严格的用户名验证
		if len(cfg.AppUser) > 63 {
			errors = append(errors, model.ValidationError{
				Field:   "database.app_user",
				Message: "key:validation.database.app_user_error",
			})
		} else if !dbNameRegex.MatchString(cfg.AppUser) {
			errors = append(errors, model.ValidationError{
				Field:   "database.app_user",
				Message: "key:validation.database.app_user_error",
			})
		}
	} else {
		// 外部服务模式使用宽松的用户名验证
		if len(cfg.AppUser) > 128 {
			errors = append(errors, model.ValidationError{
				Field:   "database.app_user",
				Message: "key:validation.database.app_user_external_error",
			})
		}
	}

	// 超级用户密码验证 - 仅Docker模式需要（用于初始化数据库容器）
	if cfg.ServiceType == "docker" {
		if cfg.SuperPassword == "" {
			errors = append(errors, model.ValidationError{
				Field:   "database.super_password",
				Message: "key:validation.database.super_password_required",
			})
		} else if !validateDatabasePassword(cfg.SuperPassword) {
			errors = append(errors, model.ValidationError{
				Field:   "database.super_password",
				Message: "key:validation.database.super_password_error",
			})
		}
	}

	// 应用用户密码验证
	if cfg.AppPassword == "" {
		errors = append(errors, model.ValidationError{
			Field:   "database.app_password",
			Message: "key:validation.database.app_password_required",
		})
	} else {
		// 根据服务类型使用不同的密码验证规则
		var passwordValid bool
		var errorMessage string

		if cfg.ServiceType == "docker" {
			// Docker模式使用严格的密码规则
			passwordValid = validateDatabasePassword(cfg.AppPassword)
			errorMessage = "key:validation.database.app_password_error"
		} else {
			// 外部服务使用宽松的密码规则
			passwordValid = validateExternalServicePassword(cfg.AppPassword)
			errorMessage = "key:validation.database.app_password_external_error"
		}

		if !passwordValid {
			errors = append(errors, model.ValidationError{
				Field:   "database.app_password",
				Message: errorMessage,
			})
		}
	}

	// 验证用户名不能重复 - 仅Docker模式需要检查
	if cfg.ServiceType == "docker" && cfg.SuperUser != "" && cfg.AppUser != "" && cfg.SuperUser == cfg.AppUser {
		errors = append(errors, model.ValidationError{
			Field:   "database.app_user",
			Message: "key:validation.database.username_duplicate_error",
		})
	}

	// 验证密码不能重复 - 仅Docker模式需要检查
	if cfg.ServiceType == "docker" && cfg.SuperPassword != "" && cfg.AppPassword != "" && cfg.SuperPassword == cfg.AppPassword {
		errors = append(errors, model.ValidationError{
			Field:   "database.app_password",
			Message: "key:validation.database.password_duplicate_error",
		})
	}

	return errors
}

// validateRedisConfig 验证Redis配置
func (v *ValidatorService) validateRedisConfig(cfg model.RedisConfig) []model.ValidationError {
	var errors []model.ValidationError

	// ServiceType验证
	if cfg.ServiceType != "docker" && cfg.ServiceType != "external" {
		errors = append(errors, model.ValidationError{
			Field:   "redis.service_type",
			Message: "key:validation.redis.service_type_error",
		})
	}

	// Host验证 - docker模式下强制localhost
	if cfg.ServiceType == "docker" {
		if cfg.Host != "localhost" {
			errors = append(errors, model.ValidationError{
				Field:   "redis.host",
				Message: "key:validation.redis.host_docker_error",
			})
		}
	} else {
		// external模式下需要验证host
		if cfg.Host == "" {
			errors = append(errors, model.ValidationError{
				Field:   "redis.host",
				Message: "key:validation.redis.host_required",
			})
		} else if !hostRegex.MatchString(cfg.Host) {
			errors = append(errors, model.ValidationError{
				Field:   "redis.host",
				Message: "key:validation.redis.host_error",
			})
		}
	}

	// Port验证
	if cfg.Port <= 0 || cfg.Port > 65535 {
		errors = append(errors, model.ValidationError{
			Field:   "redis.port",
			Message: "key:validation.redis.port_invalid",
		})
	}

	// Password验证
	if cfg.Password == "" {
		errors = append(errors, model.ValidationError{
			Field:   "redis.password",
			Message: "key:validation.redis.password_required",
		})
	} else {
		// 根据服务类型使用不同的密码验证规则
		var passwordValid bool
		var errorMessage string

		if cfg.ServiceType == "docker" {
			// Docker模式使用严格的密码规则
			passwordValid = validateDatabasePassword(cfg.Password)
			errorMessage = "key:validation.redis.password_error"
		} else {
			// 外部服务使用宽松的密码规则
			passwordValid = validateExternalServicePassword(cfg.Password)
			errorMessage = "key:validation.redis.password_external_error"
		}

		if !passwordValid {
			errors = append(errors, model.ValidationError{
				Field:   "redis.password",
				Message: errorMessage,
			})
		}
	}

	// User验证 - Docker模式下必需且禁止使用'default'用户名
	if cfg.ServiceType == "docker" {
		// Docker模式下必须提供用户名
		if cfg.User == "" {
			errors = append(errors, model.ValidationError{
				Field:   "redis.user",
				Message: "key:validation.redis.user_required",
			})
		} else if cfg.User == "default" {
			errors = append(errors, model.ValidationError{
				Field:   "redis.user",
				Message: "key:validation.redis.user_default_forbidden",
			})
		} else {
			// 验证用户名格式（字母、数字、下划线、连字符）
			userRegex := regexp.MustCompile(`^[a-zA-Z0-9_-]+$`)
			if !userRegex.MatchString(cfg.User) {
				errors = append(errors, model.ValidationError{
					Field:   "redis.user",
					Message: "key:validation.redis.user_format_error",
				})
			} else if len(cfg.User) > 128 {
				errors = append(errors, model.ValidationError{
					Field:   "redis.user",
					Message: "key:validation.redis.user_length_error",
				})
			}
		}
	} else {
		// 外部模式下用户名可选，允许使用"default"，但如果提供了就需要验证格式
		if cfg.User != "" {
			// 外部模式下允许"default"用户名，兼容旧版Redis
			userRegex := regexp.MustCompile(`^[a-zA-Z0-9_-]+$`)
			if !userRegex.MatchString(cfg.User) {
				errors = append(errors, model.ValidationError{
					Field:   "redis.user",
					Message: "key:validation.redis.user_format_error",
				})
			} else if len(cfg.User) > 128 {
				errors = append(errors, model.ValidationError{
					Field:   "redis.user",
					Message: "key:validation.redis.user_length_error",
				})
			}
		}
	}

	// AdminPassword验证（仅Docker模式需要）
	if cfg.ServiceType == "docker" {
		if cfg.AdminPassword == "" {
			errors = append(errors, model.ValidationError{
				Field:   "redis.admin_password",
				Message: "key:validation.redis.admin_password_required",
			})
		} else {
			// Docker模式的管理密码使用严格验证
			if !validateDatabasePassword(cfg.AdminPassword) {
				errors = append(errors, model.ValidationError{
					Field:   "redis.admin_password",
					Message: "key:validation.redis.admin_password_error",
				})
			}
		}
	}

	return errors
}

// validateSMTPConfig 验证SMTP配置
func (v *ValidatorService) validateSMTPConfig(cfg model.SMTPConfig) []model.ValidationError {
	var errors []model.ValidationError

	// SMTP服务器验证
	if cfg.Server == "" {
		errors = append(errors, model.ValidationError{
			Field:   "smtp.server",
			Message: "key:validation.smtp.server_required",
		})
	} else if !hostRegex.MatchString(cfg.Server) {
		errors = append(errors, model.ValidationError{
			Field:   "smtp.server",
			Message: "key:validation.smtp.server_invalid",
		})
	}

	// 端口验证
	if cfg.Port <= 0 || cfg.Port > 65535 {
		errors = append(errors, model.ValidationError{
			Field:   "smtp.port",
			Message: "key:validation.smtp.port_invalid",
		})
	}

	// 用户名验证
	if cfg.User == "" {
		errors = append(errors, model.ValidationError{
			Field:   "smtp.user",
			Message: "key:validation.smtp.user_required",
		})
	}

	// 密码验证
	if cfg.Password == "" {
		errors = append(errors, model.ValidationError{
			Field:   "smtp.password",
			Message: "key:validation.smtp.password_required",
		})
	}

	// 发件人邮箱验证
	if cfg.Sender == "" {
		errors = append(errors, model.ValidationError{
			Field:   "smtp.sender",
			Message: "key:validation.smtp.sender_required",
		})
	} else if !emailRegex.MatchString(cfg.Sender) {
		errors = append(errors, model.ValidationError{
			Field:   "smtp.sender",
			Message: "key:validation.smtp.sender_invalid",
		})
	}

	return errors
}

// validateAppConfig 验证应用配置
func (v *ValidatorService) validateAppConfig(cfg model.AppConfig) []model.ValidationError {
	var errors []model.ValidationError

	// Domain name验证
	if cfg.DomainName == "" {
		errors = append(errors, model.ValidationError{
			Field:   "app.domain_name",
			Message: "key:validation.app.domain_required",
		})
	} else if !domainRegex.MatchString(cfg.DomainName) {
		errors = append(errors, model.ValidationError{
			Field:   "app.domain_name",
			Message: "key:validation.app.domain_error",
		})
	}

	// Static host name验证
	if cfg.StaticHostName == "" {
		errors = append(errors, model.ValidationError{
			Field:   "app.static_host_name",
			Message: "key:validation.app.static_host_required",
		})
	} else {
		// 验证静态主机名格式（域名或域名:端口）
		staticHostRegex := regexp.MustCompile(`^([a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}(:[0-9]{1,5})?$|^localhost(:[0-9]{1,5})?$`)
		if !staticHostRegex.MatchString(cfg.StaticHostName) {
			errors = append(errors, model.ValidationError{
				Field:   "app.static_host_name",
				Message: "key:validation.app.static_host_error",
			})
		}
	}

	// Brand name验证 - 只验证长度，支持所有Unicode字符
	if cfg.BrandName == "" {
		errors = append(errors, model.ValidationError{
			Field:   "app.brand_name",
			Message: "key:validation.app.brand_required",
		})
	} else if utf8.RuneCountInString(cfg.BrandName) < 2 || utf8.RuneCountInString(cfg.BrandName) > 50 {
		errors = append(errors, model.ValidationError{
			Field:   "app.brand_name",
			Message: "key:validation.app.brand_error",
		})
	}

	// CORS origins验证
	for i, origin := range cfg.CORSAllowOrigins {
		origin = strings.TrimSpace(origin)
		if origin != "" && !urlRegex.MatchString(origin) {
			errors = append(errors, model.ValidationError{
				Field:   fmt.Sprintf("app.cors_allow_origins[%d]", i),
				Message: "key:validation.app.cors_error",
			})
		}
	}

	// Default language验证
	validLangs := map[string]bool{"en": true, "zh-Hans": true, "zh-Hant": true, "ja": true}
	if cfg.DefaultLang == "" {
		errors = append(errors, model.ValidationError{
			Field:   "app.default_lang",
			Message: "key:validation.app.language_required",
		})
	} else if !validLangs[cfg.DefaultLang] {
		errors = append(errors, model.ValidationError{
			Field:   "app.default_lang",
			Message: "key:validation.app.language_error",
		})
	}


	return errors
}

// validateOAuthConfig 验证OAuth配置
func (v *ValidatorService) validateOAuthConfig(cfg model.OAuthConfig) []model.ValidationError {
	var errors []model.ValidationError

	// Google OAuth验证
	if cfg.GoogleEnabled {
		if cfg.GoogleClientID == "" {
			errors = append(errors, model.ValidationError{
				Field:   "oauth.google_client_id",
				Message: "key:validation.oauth.google_client_id_required",
			})
		}
		if cfg.GoogleSecret == "" {
			errors = append(errors, model.ValidationError{
				Field:   "oauth.google_client_secret",
				Message: "key:validation.oauth.google_client_secret_required",
			})
		}
	}

	// GitHub OAuth验证
	if cfg.GithubEnabled {
		if cfg.GithubClientID == "" {
			errors = append(errors, model.ValidationError{
				Field:   "oauth.github_client_id",
				Message: "key:validation.oauth.github_client_id_required",
			})
		}
		if cfg.GithubSecret == "" {
			errors = append(errors, model.ValidationError{
				Field:   "oauth.github_client_secret",
				Message: "key:validation.oauth.github_client_secret_required",
			})
		}
	}

	return errors
}

// validateAdminUserConfig 验证管理员用户配置
func (v *ValidatorService) validateAdminUserConfig(cfg model.AdminUserConfig) []model.ValidationError {
	var errors []model.ValidationError

	// Username验证（与主项目规则完全一致）
	if cfg.Username == "" {
		errors = append(errors, model.ValidationError{
			Field:   "admin_user.username",
			Message: "key:validation.admin.username_required",
		})
	} else if len(cfg.Username) < 4 || len(cfg.Username) > 20 {
		errors = append(errors, model.ValidationError{
			Field:   "admin_user.username",
			Message: "key:validation.admin.username_error",
		})
	} else if !usernameRegex.MatchString(cfg.Username) {
		errors = append(errors, model.ValidationError{
			Field:   "admin_user.username",
			Message: "key:validation.admin.username_error",
		})
	}

	// Email验证
	if cfg.Email == "" {
		errors = append(errors, model.ValidationError{
			Field:   "admin_user.email",
			Message: "key:validation.admin.email_required",
		})
	} else if !emailRegex.MatchString(cfg.Email) {
		errors = append(errors, model.ValidationError{
			Field:   "admin_user.email",
			Message: "key:validation.admin.email_error",
		})
	}

	// Password验证（与主项目规则完全一致）
	if cfg.Password == "" {
		errors = append(errors, model.ValidationError{
			Field:   "admin_user.password",
			Message: "key:validation.admin.password_required",
		})
	} else if !validatePassword(cfg.Password) {
		errors = append(errors, model.ValidationError{
			Field:   "admin_user.password",
			Message: "key:validation.admin.password_error",
		})
	}

	return errors
}

// TestAllConnections 测试所有连接
func (v *ValidatorService) TestAllConnections(cfg *model.SetupConfig) []model.ConnectionTestResult {
	var results []model.ConnectionTestResult

	// 测试数据库连接
	results = append(results, v.TestDatabaseConnection(cfg.Database))

	// 测试Redis连接
	results = append(results, v.TestRedisConnection(cfg.Redis))

	// 测试SMTP连接（如果配置了）
	if cfg.SMTP.Server != "" {
		results = append(results, v.TestSMTPConnection(cfg.SMTP))
	}

	return results
}

// validateSSLConfig 验证SSL配置
func (v *ValidatorService) validateSSLConfig(cfg model.SSLConfig) []model.ValidationError {
	var errors []model.ValidationError

	// 如果启用SSL，验证证书和私钥路径
	if cfg.Enabled {
		if cfg.CertPath == "" {
			errors = append(errors, model.ValidationError{
				Field:   "ssl.cert_path",
				Message: "key:validation.ssl.cert_path_required",
			})
		}

		if cfg.KeyPath == "" {
			errors = append(errors, model.ValidationError{
				Field:   "ssl.key_path",
				Message: "key:validation.ssl.key_path_required",
			})
		}
	}

	return errors
}

// validateFrontendConfig 验证前端和SSR配置
func (v *ValidatorService) validateFrontendConfig(cfg model.AppConfig) []model.ValidationError {
	var errors []model.ValidationError

	// 服务端渲染配置验证
	if cfg.SSREnabled {
		if len(cfg.FrontendScripts) == 0 {
			errors = append(errors, model.ValidationError{
				Field:   "app.frontend_scripts",
				Message: "key:validation.app.frontend_scripts_required",
			})
		} else {
			// 支持相对路径（以/开头）和绝对URL（以https?://开头）
			urlRegex := regexp.MustCompile(`^(https?://[a-zA-Z0-9.-]+(:[0-9]+)?(/.*)?|/[^/].*\.(js|mjs)(\?.*)?$)`)
			for i, script := range cfg.FrontendScripts {
				if !urlRegex.MatchString(script) {
					errors = append(errors, model.ValidationError{
						Field:   fmt.Sprintf("app.frontend_scripts[%d]", i),
						Message: "key:validation.app.frontend_scripts_error",
					})
				}
			}
		}

		if len(cfg.FrontendStyles) == 0 {
			errors = append(errors, model.ValidationError{
				Field:   "app.frontend_styles",
				Message: "key:validation.app.frontend_styles_required",
			})
		} else {
			// 支持相对路径（以/开头）和绝对URL（以https?://开头）
			urlRegex := regexp.MustCompile(`^(https?://[a-zA-Z0-9.-]+(:[0-9]+)?(/.*)?|/[^/].*\.(css)(\?.*)?$)`)
			for i, style := range cfg.FrontendStyles {
				if !urlRegex.MatchString(style) {
					errors = append(errors, model.ValidationError{
						Field:   fmt.Sprintf("app.frontend_styles[%d]", i),
						Message: "key:validation.app.frontend_styles_error",
					})
				}
			}
		}

		if cfg.FrontendContainerId == "" {
			errors = append(errors, model.ValidationError{
				Field:   "app.frontend_container_id",
				Message: "key:validation.app.frontend_container_id_required",
			})
		}
	}

	return errors
}
