package services

import (
	"database/sql"
	"fmt"
	"log"
	"net"
	"net/smtp"
	"regexp"
	"strconv"
	"strings"
	"time"

	"github.com/biliqiqi/baklab-setup/internal/model"
	_ "github.com/lib/pq" // PostgreSQL driver
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
	
	// 品牌名称（字母、数字、空格、连字符、下划线）
	brandNameRegex = regexp.MustCompile(`^[a-zA-Z0-9\s\-_]+$`)
	
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

// TestDatabaseConnection 验证数据库配置格式
func (v *ValidatorService) TestDatabaseConnection(cfg model.DatabaseConfig) model.ConnectionTestResult {
	result := model.ConnectionTestResult{
		Service:  "database",
		TestedAt: time.Now(),
	}
	
	// 验证必填字段
	if cfg.Host == "" {
		result.Success = false
		result.Message = "Database host is required"
		return result
	}
	
	if cfg.Port <= 0 || cfg.Port > 65535 {
		result.Success = false
		result.Message = "Database port must be between 1 and 65535"
		return result
	}
	
	if cfg.Name == "" {
		result.Success = false
		result.Message = "Database name is required"
		return result
	}
	
	if cfg.User == "" {
		result.Success = false
		result.Message = "Database user is required"
		return result
	}
	
	if cfg.Password == "" {
		result.Success = false
		result.Message = "Database password is required"
		return result
	}
	
	// 构建连接字符串进行格式验证
	dsn := fmt.Sprintf("postgres://%s:%s@%s:%d/%s?sslmode=disable",
		cfg.User, cfg.Password, cfg.Host, cfg.Port, cfg.Name)
	
	// 验证DSN格式是否有效（不实际连接）
	_, err := sql.Open("postgres", dsn)
	if err != nil {
		result.Success = false
		result.Message = fmt.Sprintf("Invalid database configuration: %v", err)
		return result
	}
	
	result.Success = true
	result.Message = "Database configuration is valid (connection will be tested after Docker startup)"
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
		result.Message = "Redis host is required"
		return result
	}
	
	if cfg.Port <= 0 || cfg.Port > 65535 {
		result.Success = false
		result.Message = "Redis port must be between 1 and 65535"
		return result
	}
	
	// 验证地址格式
	address := net.JoinHostPort(cfg.Host, strconv.Itoa(cfg.Port))
	if address == "" {
		result.Success = false
		result.Message = "Invalid Redis host/port combination"
		return result
	}
	
	result.Success = true
	result.Message = "Redis configuration is valid (connection will be tested after Docker startup)"
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
		result.Message = fmt.Sprintf("Failed to connect to SMTP server: %v", err)
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
			result.Message = fmt.Sprintf("SMTP authentication failed: %v", err)
			return result
		}
	}
	
	result.Success = true
	result.Message = "SMTP connection successful"
	return result
}

// ValidateConfig 验证完整配置
func (v *ValidatorService) ValidateConfig(cfg *model.SetupConfig) []model.ValidationError {
	var errors []model.ValidationError
	
	// 验证数据库配置
	errors = append(errors, v.validateDatabaseConfig(cfg.Database)...)
	
	// 验证Redis配置
	errors = append(errors, v.validateRedisConfig(cfg.Redis)...)
	
	// 验证应用配置
	errors = append(errors, v.validateAppConfig(cfg.App)...)
	
	// 验证管理员用户配置
	errors = append(errors, v.validateAdminUserConfig(cfg.AdminUser)...)
	
	return errors
}

// validateDatabaseConfig 验证数据库配置
func (v *ValidatorService) validateDatabaseConfig(cfg model.DatabaseConfig) []model.ValidationError {
	var errors []model.ValidationError
	
	// Host验证
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
	
	// User验证
	if cfg.User == "" {
		errors = append(errors, model.ValidationError{
			Field:   "database.user",
			Message: "Database user is required",
		})
	} else if len(cfg.User) > 63 {
		errors = append(errors, model.ValidationError{
			Field:   "database.user",
			Message: "Database user must be 63 characters or less",
		})
	} else if !dbNameRegex.MatchString(cfg.User) {
		errors = append(errors, model.ValidationError{
			Field:   "database.user",
			Message: "Database user must start with a letter and contain only letters, numbers, and underscores",
		})
	}
	
	// Password验证 (数据库密码要求相对宽松)
	if cfg.Password == "" {
		errors = append(errors, model.ValidationError{
			Field:   "database.password",
			Message: "Database password is required",
		})
	} else if len(cfg.Password) < 8 {
		errors = append(errors, model.ValidationError{
			Field:   "database.password",
			Message: "Database password must be at least 8 characters long",
		})
	}
	
	return errors
}

// validateRedisConfig 验证Redis配置
func (v *ValidatorService) validateRedisConfig(cfg model.RedisConfig) []model.ValidationError {
	var errors []model.ValidationError
	
	// Host验证
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
	
	// Port验证
	if cfg.Port <= 0 || cfg.Port > 65535 {
		errors = append(errors, model.ValidationError{
			Field:   "redis.port",
			Message: "Redis port must be between 1 and 65535",
		})
	}
	
	// Password验证（必填）
	if cfg.Password == "" {
		errors = append(errors, model.ValidationError{
			Field:   "redis.password",
			Message: "Redis password is required",
		})
	} else if len(cfg.Password) < 1 {
		errors = append(errors, model.ValidationError{
			Field:   "redis.password",
			Message: "Redis password cannot be empty",
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
	
	// Brand name验证
	if cfg.BrandName == "" {
		errors = append(errors, model.ValidationError{
			Field:   "app.brand_name",
			Message: "Brand name is required",
		})
	} else if len(cfg.BrandName) < 2 || len(cfg.BrandName) > 50 {
		errors = append(errors, model.ValidationError{
			Field:   "app.brand_name",
			Message: "Brand name must be 2-50 characters long",
		})
	} else if !brandNameRegex.MatchString(cfg.BrandName) {
		errors = append(errors, model.ValidationError{
			Field:   "app.brand_name",
			Message: "Brand name must contain only letters, numbers, spaces, hyphens, and underscores",
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