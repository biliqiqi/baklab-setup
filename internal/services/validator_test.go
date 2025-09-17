package services

import (
	"testing"

	"github.com/biliqiqi/baklab-setup/internal/model"
)

func TestDomainValidation(t *testing.T) {
	validator := NewValidatorService()

	testCases := []struct {
		domain   string
		expected bool
		name     string
	}{
		// Valid domains
		{"staging-32194.baklab.app", true, "Subdomain with hyphens and numbers"},
		{"example.com", true, "Simple domain"},
		{"sub.example.com", true, "Single subdomain"},
		{"test-123.staging.app.com", true, "Multi-level with hyphens"},
		{"localhost", true, "Special case localhost"},
		{"a.b.c.d.com", true, "Deep nesting with single characters"},
		{"valid123.test456.domain789.org", true, "Complex valid domain with numbers"},
		{"api.v1.service.example.com", true, "API subdomain with version"},
		{"cdn-assets.production.myapp.io", true, "CDN subdomain with hyphens"},
		{"db1.region-us-east.cluster.aws.com", true, "AWS-style complex domain"},

		// Invalid domains
		{"invalid", false, "No TLD"},
		{"-invalid.com", false, "Starts with hyphen"},
		{"invalid-.com", false, "Ends with hyphen"},
		{"", false, "Empty domain"},
		{".com", false, "Starts with dot"},
		{"example.", false, "Ends with dot"},
		{"example..com", false, "Double dots"},
		{"example.c", false, "TLD too short"},
		{"exam ple.com", false, "Contains space"},
		{"example.com.", false, "Trailing dot"},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			// Test the domain regex directly
			isValid := domainRegex.MatchString(tc.domain)
			if isValid != tc.expected {
				t.Errorf("domainRegex.MatchString(%q) = %v, expected %v", tc.domain, isValid, tc.expected)
			}

			// Test through the validator service
			cfg := model.AppConfig{DomainName: tc.domain}
			errors := validator.validateAppConfig(cfg)

			hasDomainError := false
			for _, err := range errors {
				if err.Field == "app.domain_name" {
					hasDomainError = true
					break
				}
			}

			if tc.expected && hasDomainError {
				t.Errorf("validateAppConfig(%q) returned domain error, but domain should be valid", tc.domain)
			}
			if !tc.expected && !hasDomainError && tc.domain != "" {
				t.Errorf("validateAppConfig(%q) did not return domain error, but domain should be invalid", tc.domain)
			}
		})
	}
}

func TestValidateAppConfigDomainField(t *testing.T) {
	validator := NewValidatorService()

	testCases := []struct {
		config   model.AppConfig
		expected bool
		name     string
	}{
		{
			config: model.AppConfig{
				DomainName:  "staging-32194.baklab.app",
				BrandName:   "Test Brand",
				AdminEmail:  "admin@example.com",
				DefaultLang: "en",
			},
			expected: true,
			name:     "Valid config with staging domain",
		},
		{
			config: model.AppConfig{
				DomainName:  "invalid-domain",
				BrandName:   "Test Brand",
				AdminEmail:  "admin@example.com",
				DefaultLang: "en",
			},
			expected: false,
			name:     "Invalid domain without TLD",
		},
		{
			config: model.AppConfig{
				DomainName:  "localhost",
				BrandName:   "Test Brand",
				AdminEmail:  "admin@example.com",
				DefaultLang: "en",
			},
			expected: true,
			name:     "Valid config with localhost",
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			errors := validator.validateAppConfig(tc.config)

			hasDomainError := false
			for _, err := range errors {
				if err.Field == "app.domain_name" {
					hasDomainError = true
					break
				}
			}

			if tc.expected && hasDomainError {
				t.Errorf("validateAppConfig returned domain error for valid config: %v", errors)
			}
			if !tc.expected && !hasDomainError {
				t.Errorf("validateAppConfig should have returned domain error for invalid config")
			}
		})
	}
}

func TestValidateDatabasePassword(t *testing.T) {
	tests := []struct {
		name     string
		password string
		want     bool
	}{
		{
			name:     "too short - 6 chars",
			password: "123456",
			want:     false,
		},
		{
			name:     "too short - 8 chars, only numbers",
			password: "12345678",
			want:     false,
		},
		{
			name:     "12 chars but only lowercase letters",
			password: "abcdefghijkl",
			want:     false,
		},
		{
			name:     "12 chars but only uppercase letters",
			password: "ABCDEFGHIJKL",
			want:     false,
		},
		{
			name:     "12 chars but only 2 types (lowercase + numbers)",
			password: "abcdefghijk1",
			want:     false,
		},
		{
			name:     "valid - 3 types (lowercase + uppercase + numbers)",
			password: "Abcdefghijk1",
			want:     true,
		},
		{
			name:     "valid - 3 types (lowercase + numbers + special)",
			password: "abcdefghijk1!",
			want:     true,
		},
		{
			name:     "valid - 3 types (uppercase + numbers + special)",
			password: "ABCDEFGHIJK1!",
			want:     true,
		},
		{
			name:     "valid - 4 types (all types)",
			password: "Abcdefghijk!",
			want:     true,
		},
		{
			name:     "valid - readable password with 4 types",
			password: "MyPassword123!",
			want:     true,
		},
		{
			name:     "valid - database password example",
			password: "DatabasePass1!",
			want:     true,
		},
		{
			name:     "valid - Redis password example",
			password: "RedisSecure2@",
			want:     true,
		},
		{
			name:     "too long - over 64 chars",
			password: "VeryLongPasswordThatExceedsTheMaximumLengthLimitOf64Characters12!",
			want:     false,
		},
		{
			name:     "too short but valid types",
			password: "Short1!",
			want:     false,
		},
		{
			name:     "contains invalid characters",
			password: "ValidPassword1中",
			want:     false,
		},
		{
			name:     "exactly 12 chars with 3 types",
			password: "Password123!",
			want:     true,
		},
		{
			name:     "exactly 64 chars with 4 types",
			password: "VeryLongPasswordButStillValidWithExactly64CharactersTotal1!",
			want:     true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := validateDatabasePassword(tt.password); got != tt.want {
				t.Errorf("validateDatabasePassword(%q) = %v, want %v", tt.password, got, tt.want)
			}
		})
	}
}

func TestValidateUserPassword(t *testing.T) {
	tests := []struct {
		name     string
		password string
		want     bool
	}{
		{
			name:     "valid user password - all 4 types required",
			password: "MyPassword123!",
			want:     true,
		},
		{
			name:     "invalid - missing uppercase",
			password: "mypassword123!",
			want:     false,
		},
		{
			name:     "invalid - missing lowercase",
			password: "MYPASSWORD123!",
			want:     false,
		},
		{
			name:     "invalid - missing numbers",
			password: "MyPassword!",
			want:     false,
		},
		{
			name:     "invalid - missing special chars",
			password: "MyPassword123",
			want:     false,
		},
		{
			name:     "valid - minimum requirements met",
			password: "Abcdefghijk1!",
			want:     true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := validatePassword(tt.password); got != tt.want {
				t.Errorf("validatePassword(%q) = %v, want %v", tt.password, got, tt.want)
			}
		})
	}
}

func TestValidatorService_ValidateConfig_PasswordValidation(t *testing.T) {
	validator := NewValidatorService()

	tests := []struct {
		name           string
		dbPassword     string
		redisPassword  string
		wantErrors     int
		wantDBError    bool
		wantRedisError bool
	}{
		{
			name:           "valid passwords",
			dbPassword:     "DatabasePass1!",
			redisPassword:  "RedisSecure2@",
			wantErrors:     0,
			wantDBError:    false,
			wantRedisError: false,
		},
		{
			name:           "invalid database password - too weak",
			dbPassword:     "weakpass",
			redisPassword:  "RedisSecure2@",
			wantErrors:     1,
			wantDBError:    true,
			wantRedisError: false,
		},
		{
			name:           "invalid Redis password - too weak",
			dbPassword:     "DatabasePass1!",
			redisPassword:  "weak",
			wantErrors:     1,
			wantDBError:    false,
			wantRedisError: true,
		},
		{
			name:           "both passwords invalid",
			dbPassword:     "weak",
			redisPassword:  "alsoweak",
			wantErrors:     2,
			wantDBError:    true,
			wantRedisError: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			cfg := &model.SetupConfig{
				Database: model.DatabaseConfig{
					ServiceType:   "docker",
					Host:          "localhost",
					Port:          5432,
					Name:          "testdb",
					SuperUser:     "postgres",
					SuperPassword: "PostgresSuper123!",
					AppUser:       "testuser",
					AppPassword:   tt.dbPassword,
				},
				Redis: model.RedisConfig{
					ServiceType:   "docker",
					Host:          "localhost",
					Port:          6379,
					Password:      tt.redisPassword,
					AdminPassword: "RedisAdmin123!",
				},
				SMTP: model.SMTPConfig{
					Server:   "smtp.test.com",
					Port:     587,
					User:     "test@test.com",
					Password: "SmtpPassword123!",
					Sender:   "test@test.com",
				},
				App: model.AppConfig{
					DomainName:  "test.com",
					BrandName:   "Test",
					AdminEmail:  "admin@test.com",
					DefaultLang: "en",
				},
				AdminUser: model.AdminUserConfig{
					Username: "admin",
					Email:    "admin@test.com",
					Password: "AdminPassword123!",
				},
			}

			errors := validator.ValidateConfig(cfg)

			if len(errors) != tt.wantErrors {
				t.Errorf("ValidateConfig() returned %d errors, want %d", len(errors), tt.wantErrors)
				for _, err := range errors {
					t.Logf("Error: %s - %s", err.Field, err.Message)
				}
				return
			}

			// 检查具体的错误类型
			hasDBError := false
			hasRedisError := false
			for _, err := range errors {
				if err.Field == "database.app_password" {
					hasDBError = true
				}
				if err.Field == "redis.password" {
					hasRedisError = true
				}
			}

			if hasDBError != tt.wantDBError {
				t.Errorf("Expected database password error: %v, got: %v", tt.wantDBError, hasDBError)
			}
			if hasRedisError != tt.wantRedisError {
				t.Errorf("Expected Redis password error: %v, got: %v", tt.wantRedisError, hasRedisError)
			}
		})
	}
}

func TestValidatorService_ValidateDatabaseConfig_Password(t *testing.T) {
	validator := NewValidatorService()

	tests := []struct {
		name   string
		config model.DatabaseConfig
		want   int // number of errors expected
	}{
		{
			name: "valid config",
			config: model.DatabaseConfig{
				ServiceType:   "docker",
				Host:          "localhost",
				Port:          5432,
				Name:          "baklab",
				SuperUser:     "postgres",
				SuperPassword: "PostgresSuper123!",
				AppUser:       "baklab",
				AppPassword:   "DatabasePass123!",
			},
			want: 0,
		},
		{
			name: "weak password",
			config: model.DatabaseConfig{
				ServiceType:   "docker",
				Host:          "localhost",
				Port:          5432,
				Name:          "baklab",
				SuperUser:     "postgres",
				SuperPassword: "PostgresSuper123!",
				AppUser:       "baklab",
				AppPassword:   "weak",
			},
			want: 1,
		},
		{
			name: "empty password",
			config: model.DatabaseConfig{
				ServiceType:   "docker",
				Host:          "localhost",
				Port:          5432,
				Name:          "baklab",
				SuperUser:     "postgres",
				SuperPassword: "PostgresSuper123!",
				AppUser:       "baklab",
				AppPassword:   "",
			},
			want: 1,
		},
		{
			name: "password with only 2 character types",
			config: model.DatabaseConfig{
				ServiceType:   "docker",
				Host:          "localhost",
				Port:          5432,
				Name:          "baklab",
				SuperUser:     "postgres",
				SuperPassword: "PostgresSuper123!",
				AppUser:       "baklab",
				AppPassword:   "password123456",
			},
			want: 1,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			errors := validator.validateDatabaseConfig(tt.config)
			if len(errors) != tt.want {
				t.Errorf("validateDatabaseConfig() returned %d errors, want %d", len(errors), tt.want)
				for _, err := range errors {
					t.Logf("Error: %s - %s", err.Field, err.Message)
				}
			}
		})
	}
}

func TestValidatorService_ValidateRedisConfig_Password(t *testing.T) {
	validator := NewValidatorService()

	tests := []struct {
		name   string
		config model.RedisConfig
		want   int // number of errors expected
	}{
		{
			name: "valid config",
			config: model.RedisConfig{
				ServiceType:   "docker",
				Host:          "localhost",
				Port:          6379,
				Password:      "RedisSecure123!",
				AdminPassword: "RedisAdmin123!",
			},
			want: 0,
		},
		{
			name: "weak password",
			config: model.RedisConfig{
				ServiceType:   "docker",
				Host:          "localhost",
				Port:          6379,
				Password:      "weak",
				AdminPassword: "RedisAdmin123!",
			},
			want: 1,
		},
		{
			name: "empty password",
			config: model.RedisConfig{
				ServiceType:   "docker",
				Host:          "localhost",
				Port:          6379,
				Password:      "",
				AdminPassword: "RedisAdmin123!",
			},
			want: 1,
		},
		{
			name: "password with only 2 character types",
			config: model.RedisConfig{
				ServiceType:   "docker",
				Host:          "localhost",
				Port:          6379,
				Password:      "password123456",
				AdminPassword: "RedisAdmin123!",
			},
			want: 1,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			errors := validator.validateRedisConfig(tt.config)
			if len(errors) != tt.want {
				t.Errorf("validateRedisConfig() returned %d errors, want %d", len(errors), tt.want)
				for _, err := range errors {
					t.Logf("Error: %s - %s", err.Field, err.Message)
				}
			}
		})
	}
}
