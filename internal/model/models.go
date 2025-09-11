package model

import "time"

// SetupStatus 表示setup的状态
type SetupStatus string

const (
	StatusPending    SetupStatus = "pending"
	StatusInProgress SetupStatus = "in_progress"
	StatusCompleted  SetupStatus = "completed"
	StatusDisabled   SetupStatus = "disabled"
)

// SetupState 存储setup的当前状态
type SetupState struct {
	Status      SetupStatus `json:"status"`
	CurrentStep string      `json:"current_step,omitempty"`
	Progress    int         `json:"progress"` // 0-100
	Message     string      `json:"message,omitempty"`
	CompletedAt *time.Time  `json:"completed_at,omitempty"`
	CreatedAt   time.Time   `json:"created_at"`
	UpdatedAt   time.Time   `json:"updated_at"`
}

// DatabaseConfig 数据库配置
type DatabaseConfig struct {
	ServiceType string `json:"service_type" validate:"required,oneof=docker external"` // "docker" for docker compose, "external" for external service
	Host        string `json:"host" validate:"required"`
	Port        int    `json:"port" validate:"required,min=1,max=65535"`
	Name        string `json:"name" validate:"required"`
	User        string `json:"user" validate:"required"`
	Password    string `json:"password" validate:"required"`
}

// RedisConfig Redis配置
type RedisConfig struct {
	ServiceType string `json:"service_type" validate:"required,oneof=docker external"` // "docker" for docker compose, "external" for external service
	Host        string `json:"host" validate:"required"`
	Port        int    `json:"port" validate:"required,min=1,max=65535"`
	User        string `json:"user"`
	Password    string `json:"password" validate:"required"`
}

// SMTPConfig SMTP配置
type SMTPConfig struct {
	Server   string `json:"server" validate:"required"`
	Port     int    `json:"port" validate:"required,min=1,max=65535"`
	User     string `json:"user" validate:"required"`
	Password string `json:"password" validate:"required"`
	Sender   string `json:"sender" validate:"required,email"`
}

// GoAccessConfig GoAccess配置
type GoAccessConfig struct {
	Enabled    bool   `json:"enabled"`
	GeoDBPath  string `json:"geo_db_path"`
	HasGeoFile bool   `json:"has_geo_file"`
}

// AppConfig 应用配置
type AppConfig struct {
	DomainName        string   `json:"domain_name" validate:"required"`
	BrandName         string   `json:"brand_name" validate:"required"`
	AdminEmail        string   `json:"admin_email" validate:"required,email"`
	DefaultLang       string   `json:"default_lang" validate:"required"`
	Version           string   `json:"version"`
	Debug             bool     `json:"debug"`
	CORSAllowOrigins  []string `json:"cors_allow_origins"`
	SessionSecret     string   `json:"session_secret"`
	CSRFSecret        string   `json:"csrf_secret"`
	JWTSecret         string   `json:"jwt_secret"`
	GoogleClientID    string   `json:"google_client_id"`
	GoogleSecret      string   `json:"google_client_secret"`
	GithubClientID    string   `json:"github_client_id"`
	GithubSecret      string   `json:"github_client_secret"`
	CloudflareSiteKey string   `json:"cloudflare_site_key"`
	CloudflareSecret  string   `json:"cloudflare_secret"`
}

// AdminUserConfig 管理员用户配置
type AdminUserConfig struct {
	Username string `json:"username" validate:"required,min=3,max=50"`
	Email    string `json:"email" validate:"required,email"`
	Password string `json:"password" validate:"required,min=8"`
}

// SetupConfig 完整的setup配置
type SetupConfig struct {
	Database  DatabaseConfig  `json:"database"`
	Redis     RedisConfig     `json:"redis"`
	SMTP      SMTPConfig      `json:"smtp"`
	App       AppConfig       `json:"app"`
	AdminUser AdminUserConfig `json:"admin_user"`
	GoAccess  GoAccessConfig  `json:"goaccess"`
}

// SetupToken 访问令牌
type SetupToken struct {
	Token     string    `json:"token"`
	ExpiresAt time.Time `json:"expires_at"`
	IPAddress string    `json:"ip_address"`
	Used      bool      `json:"used"`
	CreatedAt time.Time `json:"created_at"`
}

// ConnectionTestResult 连接测试结果
type ConnectionTestResult struct {
	Service   string `json:"service"`
	Success   bool   `json:"success"`
	Message   string `json:"message,omitempty"`
	TestedAt  time.Time `json:"tested_at"`
}

// ValidationError 验证错误
type ValidationError struct {
	Field   string `json:"field"`
	Message string `json:"message"`
}

// DeploymentStatus 部署状态
type DeploymentStatus struct {
	ID       string     `json:"id"`
	Status   string     `json:"status"` // "preparing", "running", "completed", "failed"
	Progress int        `json:"progress"`
	Message  string     `json:"message"`
	Logs     []DeploymentLogEntry `json:"logs"`
	StartAt  time.Time  `json:"start_at"`
	EndAt    *time.Time `json:"end_at,omitempty"`
}

// DeploymentLogEntry 部署日志条目
type DeploymentLogEntry struct {
	Timestamp time.Time `json:"timestamp"`
	Level     string    `json:"level"` // "info", "cmd", "stdout", "stderr", "success", "error"
	Message   string    `json:"message"`
}

// SetupResponse 通用API响应
type SetupResponse struct {
	Success bool                   `json:"success"`
	Message string                 `json:"message,omitempty"`
	Data    interface{}            `json:"data,omitempty"`
	Errors  []ValidationError      `json:"errors,omitempty"`
}