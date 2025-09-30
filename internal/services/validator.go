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

type ValidatorService struct{}

func NewValidatorService() *ValidatorService {
	return &ValidatorService{}
}

var (
	hostRegex = regexp.MustCompile(`^[a-zA-Z0-9.-]+$`)

	dbNameRegex = regexp.MustCompile(`^[a-zA-Z][a-zA-Z0-9_]*$`)

	domainRegex = regexp.MustCompile(`^([a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}$|^localhost$`)


	usernameRegex = regexp.MustCompile(`^[a-zA-Z0-9][a-zA-Z0-9._-]+[a-zA-Z0-9]$`)

	emailRegex = regexp.MustCompile(`^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$`)

	urlRegex = regexp.MustCompile(`^https?://[a-zA-Z0-9.-]+(?::[0-9]+)?(?:/.*)?$`)
)

var (
	passwordFormatRegex = regexp.MustCompile(`^[A-Za-z\d!@#$%^&*]{12,64}$`)
	// 必须包含小写字母
	passwordLowerRegex = regexp.MustCompile(`[a-z]`)
	// 必须包含大写字母
	passwordUpperRegex = regexp.MustCompile(`[A-Z]`)
	passwordDigitRegex = regexp.MustCompile(`\d`)
	// 必须包含特殊字符
	passwordSpecialRegex = regexp.MustCompile(`[!@#$%^&*]`)
)

func validatePassword(pwd string) bool {
	pwdBytes := []byte(pwd)

	if !passwordFormatRegex.Match(pwdBytes) {
		return false
	}

	return passwordLowerRegex.Match(pwdBytes) &&
		passwordUpperRegex.Match(pwdBytes) &&
		passwordDigitRegex.Match(pwdBytes) &&
		passwordSpecialRegex.Match(pwdBytes)
}

func validateDatabasePassword(pwd string) bool {
	pwdBytes := []byte(pwd)

	if !passwordFormatRegex.Match(pwdBytes) {
		return false
	}

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

func validateExternalServicePassword(pwd string) bool {
	// 1. 不能为空
	if pwd == "" {
		return false
	}

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

func (v *ValidatorService) TestDatabaseConnection(cfg model.DatabaseConfig) model.ConnectionTestResult {
	result := model.ConnectionTestResult{
		Service:  "database",
		TestedAt: time.Now(),
	}

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

	if cfg.ServiceType == "docker" {
		result.Success = true
		result.Message = "key:messages.database_config_validated"
		return result
	}

	encodedUser := url.QueryEscape(cfg.AppUser)
	encodedPassword := url.QueryEscape(cfg.AppPassword)
	dsn := fmt.Sprintf("postgres://%s:%s@%s:%d/%s?sslmode=disable",
		encodedUser, encodedPassword, cfg.Host, cfg.Port, cfg.Name)

	db, err := sql.Open("postgres", dsn)
	if err != nil {
		result.Success = false
		result.Message = "key:validation.database.config_invalid"
		return result
	}
	defer db.Close()

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

func (v *ValidatorService) TestRedisConnection(cfg model.RedisConfig) model.ConnectionTestResult {
	result := model.ConnectionTestResult{
		Service:  "redis",
		TestedAt: time.Now(),
	}

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

	if cfg.ServiceType == "docker" {
		result.Success = true
		result.Message = "key:messages.redis_config_validated"
		return result
	}

	opts := &redis.Options{
		Addr:     net.JoinHostPort(cfg.Host, strconv.Itoa(cfg.Port)),
		Password: cfg.Password,
		DB:       0,
	}

	if cfg.User != "" {
		opts.Username = cfg.User
	}

	client := redis.NewClient(opts)
	defer client.Close()

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	if err := client.Ping(ctx).Err(); err != nil {
		result.Success = false
		result.Message = "key:validation.redis.connection_failed"
		return result
	}

	result.Success = true
	result.Message = "key:messages.redis_connection_successful"
	return result
}

func (v *ValidatorService) TestSMTPConnection(cfg model.SMTPConfig) model.ConnectionTestResult {
	result := model.ConnectionTestResult{
		Service:  "smtp",
		TestedAt: time.Now(),
	}

	address := net.JoinHostPort(cfg.Server, strconv.Itoa(cfg.Port))

	client, err := smtp.Dial(address)
	if err != nil {
		result.Success = false
		result.Message = "key:validation.smtp.connection_failed"
		return result
	}

	var connectionClosed bool
	defer func() {
		if !connectionClosed {
			if err := client.Close(); err != nil {
				if !strings.Contains(err.Error(), "use of closed network connection") {
					log.Printf("Warning: failed to close SMTP connection: %v", err)
				}
			}
		}
	}()

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

	if cfg.User != "" && cfg.Password != "" {
		auth := smtp.PlainAuth("", cfg.User, cfg.Password, cfg.Server)
		if err := client.Auth(auth); err != nil {
			log.Printf("PLAIN auth failed: %v, trying to close connection gracefully", err)
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

func (v *ValidatorService) ValidateConfig(cfg *model.SetupConfig) []model.ValidationError {
	var errors []model.ValidationError

	stepOrder := []string{"welcome", "database", "redis", "smtp", "app", "ssl", "admin", "oauth", "goaccess", "review", "config_complete"}
	currentStepIndex := -1

	// 找到当前步骤的索引
	for i, step := range stepOrder {
		if step == cfg.CurrentStep {
			currentStepIndex = i
			break
		}
	}

	if currentStepIndex == -1 {
		currentStepIndex = len(stepOrder) - 1
	}

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

	if cfg.App.SSREnabled {
		errors = append(errors, v.validateFrontendConfig(cfg.App)...)
	}

	return errors
}

func (v *ValidatorService) validateDatabaseConfig(cfg model.DatabaseConfig) []model.ValidationError {
	var errors []model.ValidationError

	if cfg.ServiceType != "docker" && cfg.ServiceType != "external" {
		errors = append(errors, model.ValidationError{
			Field:   "database.service_type",
			Message: "key:validation.database.service_type_error",
		})
	}

	if cfg.ServiceType == "docker" {
		if cfg.Host != "localhost" {
			errors = append(errors, model.ValidationError{
				Field:   "database.host",
				Message: "key:validation.database.host_docker_error",
			})
		}
	} else {
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

	if cfg.Port <= 0 || cfg.Port > 65535 {
		errors = append(errors, model.ValidationError{
			Field:   "database.port",
			Message: "key:validation.database.port_invalid",
		})
	}

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

	if cfg.AppUser == "" {
		errors = append(errors, model.ValidationError{
			Field:   "database.app_user",
			Message: "key:validation.database.app_user_required",
		})
	} else if cfg.ServiceType == "docker" {
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
		if len(cfg.AppUser) > 128 {
			errors = append(errors, model.ValidationError{
				Field:   "database.app_user",
				Message: "key:validation.database.app_user_external_error",
			})
		}
	}

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

	if cfg.AppPassword == "" {
		errors = append(errors, model.ValidationError{
			Field:   "database.app_password",
			Message: "key:validation.database.app_password_required",
		})
	} else {
		var passwordValid bool
		var errorMessage string

		if cfg.ServiceType == "docker" {
			passwordValid = validateDatabasePassword(cfg.AppPassword)
			errorMessage = "key:validation.database.app_password_error"
		} else {
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

	if cfg.ServiceType == "docker" && cfg.SuperUser != "" && cfg.AppUser != "" && cfg.SuperUser == cfg.AppUser {
		errors = append(errors, model.ValidationError{
			Field:   "database.app_user",
			Message: "key:validation.database.username_duplicate_error",
		})
	}

	if cfg.ServiceType == "docker" && cfg.SuperPassword != "" && cfg.AppPassword != "" && cfg.SuperPassword == cfg.AppPassword {
		errors = append(errors, model.ValidationError{
			Field:   "database.app_password",
			Message: "key:validation.database.password_duplicate_error",
		})
	}

	return errors
}

func (v *ValidatorService) validateRedisConfig(cfg model.RedisConfig) []model.ValidationError {
	var errors []model.ValidationError

	if cfg.ServiceType != "docker" && cfg.ServiceType != "external" {
		errors = append(errors, model.ValidationError{
			Field:   "redis.service_type",
			Message: "key:validation.redis.service_type_error",
		})
	}

	if cfg.ServiceType == "docker" {
		if cfg.Host != "localhost" {
			errors = append(errors, model.ValidationError{
				Field:   "redis.host",
				Message: "key:validation.redis.host_docker_error",
			})
		}
	} else {
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

	if cfg.Port <= 0 || cfg.Port > 65535 {
		errors = append(errors, model.ValidationError{
			Field:   "redis.port",
			Message: "key:validation.redis.port_invalid",
		})
	}

	if cfg.Password == "" {
		errors = append(errors, model.ValidationError{
			Field:   "redis.password",
			Message: "key:validation.redis.password_required",
		})
	} else {
		var passwordValid bool
		var errorMessage string

		if cfg.ServiceType == "docker" {
			passwordValid = validateDatabasePassword(cfg.Password)
			errorMessage = "key:validation.redis.password_error"
		} else {
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

	if cfg.ServiceType == "docker" {
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
		if cfg.User != "" {
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

	if cfg.ServiceType == "docker" {
		if cfg.AdminPassword == "" {
			errors = append(errors, model.ValidationError{
				Field:   "redis.admin_password",
				Message: "key:validation.redis.admin_password_required",
			})
		} else {
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

func (v *ValidatorService) validateSMTPConfig(cfg model.SMTPConfig) []model.ValidationError {
	var errors []model.ValidationError

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

	if cfg.Port <= 0 || cfg.Port > 65535 {
		errors = append(errors, model.ValidationError{
			Field:   "smtp.port",
			Message: "key:validation.smtp.port_invalid",
		})
	}

	if cfg.User == "" {
		errors = append(errors, model.ValidationError{
			Field:   "smtp.user",
			Message: "key:validation.smtp.user_required",
		})
	}

	if cfg.Password == "" {
		errors = append(errors, model.ValidationError{
			Field:   "smtp.password",
			Message: "key:validation.smtp.password_required",
		})
	}

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

func (v *ValidatorService) validateAppConfig(cfg model.AppConfig) []model.ValidationError {
	var errors []model.ValidationError

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

	if cfg.StaticHostName == "" {
		errors = append(errors, model.ValidationError{
			Field:   "app.static_host_name",
			Message: "key:validation.app.static_host_required",
		})
	} else {
		staticHostRegex := regexp.MustCompile(`^([a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}(:[0-9]{1,5})?$|^localhost(:[0-9]{1,5})?$`)
		if !staticHostRegex.MatchString(cfg.StaticHostName) {
			errors = append(errors, model.ValidationError{
				Field:   "app.static_host_name",
				Message: "key:validation.app.static_host_error",
			})
		}
	}

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

	for i, origin := range cfg.CORSAllowOrigins {
		origin = strings.TrimSpace(origin)
		if origin != "" && !urlRegex.MatchString(origin) {
			errors = append(errors, model.ValidationError{
				Field:   fmt.Sprintf("app.cors_allow_origins[%d]", i),
				Message: "key:validation.app.cors_error",
			})
		}
	}

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

func (v *ValidatorService) validateOAuthConfig(cfg model.OAuthConfig) []model.ValidationError {
	var errors []model.ValidationError

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

func (v *ValidatorService) validateAdminUserConfig(cfg model.AdminUserConfig) []model.ValidationError {
	var errors []model.ValidationError

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

func (v *ValidatorService) TestAllConnections(cfg *model.SetupConfig) []model.ConnectionTestResult {
	var results []model.ConnectionTestResult

	results = append(results, v.TestDatabaseConnection(cfg.Database))

	results = append(results, v.TestRedisConnection(cfg.Redis))

	if cfg.SMTP.Server != "" {
		results = append(results, v.TestSMTPConnection(cfg.SMTP))
	}

	return results
}

func (v *ValidatorService) validateSSLConfig(cfg model.SSLConfig) []model.ValidationError {
	var errors []model.ValidationError

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

func (v *ValidatorService) validateFrontendConfig(cfg model.AppConfig) []model.ValidationError {
	var errors []model.ValidationError

	if cfg.SSREnabled {
		if len(cfg.FrontendScripts) > 0 {
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

		if len(cfg.FrontendStyles) > 0 {
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

