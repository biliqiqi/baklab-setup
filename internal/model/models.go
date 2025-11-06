package model

import "time"

type SetupStatus string

const (
	StatusPending    SetupStatus = "pending"
	StatusInProgress SetupStatus = "in_progress"
	StatusCompleted  SetupStatus = "completed"
	StatusDisabled   SetupStatus = "disabled"
)

type SetupState struct {
	Status      SetupStatus `json:"status"`
	CurrentStep string      `json:"current_step,omitempty"`
	Progress    int         `json:"progress"` // 0-100
	Message     string      `json:"message,omitempty"`
	CompletedAt *time.Time  `json:"completed_at,omitempty"`
	CreatedAt   time.Time   `json:"created_at"`
	UpdatedAt   time.Time   `json:"updated_at"`
}

type DatabaseConfig struct {
	ServiceType string `json:"service_type" validate:"required,oneof=docker external"` // "docker" for docker compose, "external" for external service
	Host        string `json:"host" validate:"required"`
	Port        int    `json:"port" validate:"required,min=1,max=65535"`
	Name        string `json:"name" validate:"required"`
	SuperUser     string `json:"super_user"`
	SuperPassword string `json:"super_password"`
	AppUser     string `json:"app_user" validate:"required"`
	AppPassword string `json:"app_password" validate:"required"`
}

type RedisConfig struct {
	ServiceType string `json:"service_type" validate:"required,oneof=docker external"` // "docker" for docker compose, "external" for external service
	Host        string `json:"host" validate:"required"`
	Port        int    `json:"port" validate:"required,min=1,max=65535"`
	User        string `json:"user"`
	Password    string `json:"password" validate:"required"`
	AdminPassword string `json:"admin_password"`
}

type SMTPConfig struct {
	Server   string `json:"server" validate:"required"`
	Port     int    `json:"port" validate:"required,min=1,max=65535"`
	User     string `json:"user" validate:"required"`
	Password string `json:"password" validate:"required"`
	Sender   string `json:"sender" validate:"required,email"`
}

type GoAccessConfig struct {
	Enabled          bool   `json:"enabled"`
	GeoDBPath        string `json:"geo_db_path"`
	HasGeoFile       bool   `json:"has_geo_file"`
	GeoTempPath      string `json:"geo_file_temp_path"`
	OriginalFileName string `json:"original_file_name"`
	FileSize         int64  `json:"file_size"`
}

type SSLConfig struct {
	Enabled      bool   `json:"enabled"`
	CertPath     string `json:"cert_path" validate:"required_if=Enabled true"`
	KeyPath      string `json:"key_path" validate:"required_if=Enabled true"`
	UseSetupCert bool   `json:"use_setup_cert"`
}

type OAuthConfig struct {
	GoogleEnabled  bool   `json:"google_enabled"`
	GoogleClientID string `json:"google_client_id" validate:"required_if=GoogleEnabled true"`
	GoogleSecret   string `json:"google_client_secret" validate:"required_if=GoogleEnabled true"`
	GithubEnabled  bool   `json:"github_enabled"`
	GithubClientID string `json:"github_client_id" validate:"required_if=GithubEnabled true"`
	GithubSecret   string `json:"github_client_secret" validate:"required_if=GithubEnabled true"`
	FrontendOrigin string `json:"frontend_origin"`
}

type AppConfig struct {
	DomainName        string      `json:"domain_name" validate:"required"`
	StaticHostName    string      `json:"static_host_name" validate:"required"`
	BrandName         string      `json:"brand_name" validate:"required"`
	DefaultLang       string      `json:"default_lang" validate:"required"`
	Version           string      `json:"version"`
	Debug             bool        `json:"debug"`
	CORSAllowOrigins  []string    `json:"cors_allow_origins"`
	JWTKeyFilePath    string      `json:"jwt_key_file_path"`
	JWTKeyFromFile    bool        `json:"jwt_key_from_file"`
	HasJWTKeyFile     bool        `json:"has_jwt_key_file"`
	JWTKeyTempPath    string      `json:"jwt_key_temp_path"`
	OAuth             OAuthConfig `json:"oauth"`
	CloudflareSiteKey string      `json:"cloudflare_site_key"`
	CloudflareSecret  string      `json:"cloudflare_secret"`
	SSREnabled          bool     `json:"ssr_enabled"`
	FrontendScripts     []string `json:"frontend_scripts"`
	FrontendStyles      []string `json:"frontend_styles"`
	FrontendContainerId string   `json:"frontend_container_id" validate:"required_if=SSREnabled true"`
}

type AdminUserConfig struct {
	Username string `json:"username" validate:"required,min=3,max=50"`
	Email    string `json:"email" validate:"required,email"`
	Password string `json:"password" validate:"required,min=8"`
}

type RevisionMode struct {
	Enabled       bool      `json:"enabled"`
	ImportedAt    time.Time `json:"imported_at,omitempty"`
	ModifiedSteps []string  `json:"modified_steps,omitempty"`
}

type SetupConfig struct {
	Database     DatabaseConfig  `json:"database"`
	Redis        RedisConfig     `json:"redis"`
	SMTP         SMTPConfig      `json:"smtp"`
	App          AppConfig       `json:"app"`
	OAuth        OAuthConfig     `json:"oauth"`
	AdminUser    AdminUserConfig `json:"admin_user"`
	GoAccess     GoAccessConfig  `json:"goaccess"`
	SSL          SSLConfig       `json:"ssl"`
	CurrentStep  string          `json:"current_step,omitempty"`
	RevisionMode RevisionMode    `json:"revision_mode,omitempty"`
}

func (sc *SetupConfig) HasGeoFile() bool {
	return sc.GoAccess.HasGeoFile
}

type SetupToken struct {
	Token     string    `json:"token"`
	ExpiresAt time.Time `json:"expires_at"`
	IPAddress string    `json:"ip_address"`
	Used      bool      `json:"used"`
	CreatedAt time.Time `json:"created_at"`
}

type ConnectionTestResult struct {
	Service  string    `json:"service"`
	Success  bool      `json:"success"`
	Message  string    `json:"message,omitempty"`
	TestedAt time.Time `json:"tested_at"`
}

type ValidationError struct {
	Field   string `json:"field"`
	Message string `json:"message"`
}

type SetupResponse struct {
	Success bool              `json:"success"`
	Message string            `json:"message,omitempty"`
	Data    interface{}       `json:"data,omitempty"`
	Errors  []ValidationError `json:"errors,omitempty"`
}
