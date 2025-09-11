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
				DomainName:    "staging-32194.baklab.app",
				BrandName:     "Test Brand",
				AdminEmail:    "admin@example.com",
				DefaultLang:   "en",
			},
			expected: true,
			name:     "Valid config with staging domain",
		},
		{
			config: model.AppConfig{
				DomainName:    "invalid-domain",
				BrandName:     "Test Brand",
				AdminEmail:    "admin@example.com",
				DefaultLang:   "en",
			},
			expected: false,
			name:     "Invalid domain without TLD",
		},
		{
			config: model.AppConfig{
				DomainName:    "localhost",
				BrandName:     "Test Brand",
				AdminEmail:    "admin@example.com",
				DefaultLang:   "en",
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