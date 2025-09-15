package services

import (
	"context"
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
	defer func() {
		if err := client.Close(); err != nil {
			log.Printf("Warning: failed to close SMTP connection: %v", err)
		}
	}()

	// 测试认证
	if cfg.User != "" && cfg.Password != "" {
		auth := smtp.PlainAuth("", cfg.User, cfg.Password, cfg.Server)
		if err := client.Auth(auth); err != nil {
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

	// 定义步骤顺序
	stepOrder := []string{"welcome", "database", "redis", "app", "ssl", "goaccess", "admin", "review", "complete"}
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

	if currentStepIndex >= 3 { // app
		errors = append(errors, v.validateAppConfig(cfg.App)...)
	}

	if currentStepIndex >= 4 { // ssl
		errors = append(errors, v.validateSSLConfig(cfg.SSL)...)
	}

	// goaccess 不需要强制验证，跳过

	if currentStepIndex >= 6 { // admin
		errors = append(errors, v.validateAdminUserConfig(cfg.AdminUser)...)
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
			Message: "Database service type must be 'docker' or 'external'",
		})
	}

	// Host验证 - docker模式下强制localhost
	if cfg.ServiceType == "docker" {
		if cfg.Host != "localhost" {
			errors = append(errors, model.ValidationError{
				Field:   "database.host",
				Message: "Database host must be 'localhost' when using docker compose",
			})
		}
	} else {
		// external模式下需要验证host
		if cfg.Host == "" {
			errors = append(errors, model.ValidationError{
				Field:   "database.host",
				Message: "Database host is required",
			})
		} else if !hostRegex.MatchString(cfg.Host) {
			errors = append(errors, model.ValidationError{
				Field:   "database.host",
				Message: "Database host must be a valid hostname or IP address",
			})
		}
	}

	// Port验证
	if cfg.Port <= 0 || cfg.Port > 65535 {
		errors = append(errors, model.ValidationError{
			Field:   "database.port",
			Message: "Database port must be between 1 and 65535",
		})
	}

	// Database name验证
	if cfg.Name == "" {
		errors = append(errors, model.ValidationError{
			Field:   "database.name",
			Message: "Database name is required",
		})
	} else if len(cfg.Name) > 63 {
		errors = append(errors, model.ValidationError{
			Field:   "database.name",
			Message: "Database name must be 63 characters or less",
		})
	} else if !dbNameRegex.MatchString(cfg.Name) {
		errors = append(errors, model.ValidationError{
			Field:   "database.name",
			Message: "Database name must start with a letter and contain only letters, numbers, and underscores",
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
	} else if len(cfg.AppUser) > 63 {
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
	} else if !validateDatabasePassword(cfg.AppPassword) {
		errors = append(errors, model.ValidationError{
			Field:   "database.app_password",
			Message: "key:validation.database.app_password_error",
		})
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
			Message: "Redis service type must be 'docker' or 'external'",
		})
	}

	// Host验证 - docker模式下强制localhost
	if cfg.ServiceType == "docker" {
		if cfg.Host != "localhost" {
			errors = append(errors, model.ValidationError{
				Field:   "redis.host",
				Message: "Redis host must be 'localhost' when using docker compose",
			})
		}
	} else {
		// external模式下需要验证host
		if cfg.Host == "" {
			errors = append(errors, model.ValidationError{
				Field:   "redis.host",
				Message: "Redis host is required",
			})
		} else if !hostRegex.MatchString(cfg.Host) {
			errors = append(errors, model.ValidationError{
				Field:   "redis.host",
				Message: "Redis host must be a valid hostname or IP address",
			})
		}
	}

	// Port验证
	if cfg.Port <= 0 || cfg.Port > 65535 {
		errors = append(errors, model.ValidationError{
			Field:   "redis.port",
			Message: "Redis port must be between 1 and 65535",
		})
	}

	// Password验证（加强要求）
	if cfg.Password == "" {
		errors = append(errors, model.ValidationError{
			Field:   "redis.password",
			Message: "Redis password is required",
		})
	} else if !validateDatabasePassword(cfg.Password) {
		errors = append(errors, model.ValidationError{
			Field:   "redis.password",
			Message: "Redis password must be 12-64 characters with at least 3 types: lowercase, uppercase, numbers, special characters (!@#$%^&*)",
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
			Message: "Domain name is required",
		})
	} else if !domainRegex.MatchString(cfg.DomainName) {
		errors = append(errors, model.ValidationError{
			Field:   "app.domain_name",
			Message: "Domain name must be a valid domain (e.g., example.com) or localhost",
		})
	}

	// Brand name验证 - 只验证长度，支持所有Unicode字符
	if cfg.BrandName == "" {
		errors = append(errors, model.ValidationError{
			Field:   "app.brand_name",
			Message: "Brand name is required",
		})
	} else if utf8.RuneCountInString(cfg.BrandName) < 2 || utf8.RuneCountInString(cfg.BrandName) > 50 {
		errors = append(errors, model.ValidationError{
			Field:   "app.brand_name",
			Message: "Brand name must be 2-50 characters long",
		})
	}

	// Admin email验证
	if cfg.AdminEmail == "" {
		errors = append(errors, model.ValidationError{
			Field:   "app.admin_email",
			Message: "Admin email is required",
		})
	} else if !emailRegex.MatchString(cfg.AdminEmail) {
		errors = append(errors, model.ValidationError{
			Field:   "app.admin_email",
			Message: "Admin email must be a valid email address",
		})
	}

	// CORS origins验证
	for i, origin := range cfg.CORSAllowOrigins {
		origin = strings.TrimSpace(origin)
		if origin != "" && !urlRegex.MatchString(origin) {
			errors = append(errors, model.ValidationError{
				Field:   fmt.Sprintf("app.cors_allow_origins[%d]", i),
				Message: "CORS origin must be a valid HTTP/HTTPS URL",
			})
		}
	}

	// Default language验证
	validLangs := map[string]bool{"en": true, "zh-Hans": true, "zh-Hant": true, "ja": true}
	if cfg.DefaultLang == "" {
		errors = append(errors, model.ValidationError{
			Field:   "app.default_lang",
			Message: "Default language is required",
		})
	} else if !validLangs[cfg.DefaultLang] {
		errors = append(errors, model.ValidationError{
			Field:   "app.default_lang",
			Message: "Default language must be one of: en, zh-Hans, zh-Hant, ja",
		})
	}

	// 验证密钥长度（如果提供的话）
	if cfg.SessionSecret != "" && len(cfg.SessionSecret) < 32 {
		errors = append(errors, model.ValidationError{
			Field:   "app.session_secret",
			Message: "Session secret must be at least 32 characters if provided",
		})
	}
	if cfg.CSRFSecret != "" && len(cfg.CSRFSecret) < 32 {
		errors = append(errors, model.ValidationError{
			Field:   "app.csrf_secret",
			Message: "CSRF secret must be at least 32 characters if provided",
		})
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
			Message: "Admin username is required",
		})
	} else if len(cfg.Username) < 4 || len(cfg.Username) > 20 {
		errors = append(errors, model.ValidationError{
			Field:   "admin_user.username",
			Message: "Username must be 4-20 characters long",
		})
	} else if !usernameRegex.MatchString(cfg.Username) {
		errors = append(errors, model.ValidationError{
			Field:   "admin_user.username",
			Message: "Username must start and end with alphanumeric characters, can contain letters, numbers, dots, underscores, and hyphens",
		})
	}

	// Email验证
	if cfg.Email == "" {
		errors = append(errors, model.ValidationError{
			Field:   "admin_user.email",
			Message: "Admin email is required",
		})
	} else if !emailRegex.MatchString(cfg.Email) {
		errors = append(errors, model.ValidationError{
			Field:   "admin_user.email",
			Message: "Admin email must be a valid email address",
		})
	}

	// Password验证（与主项目规则完全一致）
	if cfg.Password == "" {
		errors = append(errors, model.ValidationError{
			Field:   "admin_user.password",
			Message: "Admin password is required",
		})
	} else if !validatePassword(cfg.Password) {
		errors = append(errors, model.ValidationError{
			Field:   "admin_user.password",
			Message: "Password must be 12-64 characters with lowercase, uppercase, numbers, and special characters (!@#$%^&*)",
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
