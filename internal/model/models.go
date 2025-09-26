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
	// 超级用户配置 (仅Docker模式需要，用于初始化数据库容器)
	SuperUser     string `json:"super_user"`
	SuperPassword string `json:"super_password"`
	// 应用用户配置
	AppUser     string `json:"app_user" validate:"required"`
	AppPassword string `json:"app_password" validate:"required"`
}

// RedisConfig Redis配置
type RedisConfig struct {
	ServiceType string `json:"service_type" validate:"required,oneof=docker external"` // "docker" for docker compose, "external" for external service
	Host        string `json:"host" validate:"required"`
	Port        int    `json:"port" validate:"required,min=1,max=65535"`
	User        string `json:"user"`
	Password    string `json:"password" validate:"required"`
	// 管理密码配置 (仅Docker模式需要，用于CLI管理)
	AdminPassword string `json:"admin_password"`
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
	Enabled          bool   `json:"enabled"`
	GeoDBPath        string `json:"geo_db_path"`
	HasGeoFile       bool   `json:"has_geo_file"`       // 标记是否已上传GeoIP文件
	GeoTempPath      string `json:"geo_file_temp_path"` // GeoIP临时文件路径
	OriginalFileName string `json:"original_file_name"` // 原始文件名
	FileSize         int64  `json:"file_size"`          // 文件大小
}

// FrontendConfig 前端构建配置
type FrontendConfig struct {
	Built     bool      `json:"built"`               // 是否已构建
	BuildTime time.Time `json:"build_time,omitempty"` // 构建时间
	BuildLogs []string  `json:"build_logs,omitempty"` // 构建日志
}

// SSLConfig SSL证书配置
type SSLConfig struct {
	Enabled      bool   `json:"enabled"`                                       // 是否启用HTTPS
	CertPath     string `json:"cert_path" validate:"required_if=Enabled true"` // 证书文件路径（启用HTTPS时必须）
	KeyPath      string `json:"key_path" validate:"required_if=Enabled true"`  // 私钥文件路径（启用HTTPS时必须）
	UseSetupCert bool   `json:"use_setup_cert"`                                // 是否使用设置程序的证书
}

// OAuthConfig OAuth第三方登录配置
type OAuthConfig struct {
	GoogleEnabled  bool   `json:"google_enabled"`                                                 // 是否启用Google OAuth
	GoogleClientID string `json:"google_client_id" validate:"required_if=GoogleEnabled true"`     // Google客户端ID
	GoogleSecret   string `json:"google_client_secret" validate:"required_if=GoogleEnabled true"` // Google客户端密钥
	GithubEnabled  bool   `json:"github_enabled"`                                                 // 是否启用GitHub OAuth
	GithubClientID string `json:"github_client_id" validate:"required_if=GithubEnabled true"`     // GitHub客户端ID
	GithubSecret   string `json:"github_client_secret" validate:"required_if=GithubEnabled true"` // GitHub客户端密钥
	FrontendOrigin string `json:"frontend_origin"`                                                // 前端源地址，用于OAuth重定向
}

// AppConfig 应用配置
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
	JWTKeyTempPath    string      `json:"jwt_key_temp_path"` // 临时文件路径，用于配置生成时复制文件
	OAuth             OAuthConfig `json:"oauth"`             // 第三方登录配置
	CloudflareSiteKey string      `json:"cloudflare_site_key"`
	CloudflareSecret  string      `json:"cloudflare_secret"`
	// 服务端渲染配置
	SSREnabled          bool     `json:"ssr_enabled"`
	FrontendScripts     []string `json:"frontend_scripts"`
	FrontendStyles      []string `json:"frontend_styles"`
	FrontendContainerId string   `json:"frontend_container_id" validate:"required_if=SSREnabled true"`
}

// AdminUserConfig 管理员用户配置
type AdminUserConfig struct {
	Username string `json:"username" validate:"required,min=3,max=50"`
	Email    string `json:"email" validate:"required,email"`
	Password string `json:"password" validate:"required,min=8"`
}

// RevisionMode 修订模式状态
type RevisionMode struct {
	Enabled       bool      `json:"enabled"`
	ImportedAt    time.Time `json:"imported_at,omitempty"`
	ModifiedSteps []string  `json:"modified_steps,omitempty"`
}

// SetupConfig 完整的setup配置
type SetupConfig struct {
	Database     DatabaseConfig  `json:"database"`
	Redis        RedisConfig     `json:"redis"`
	SMTP         SMTPConfig      `json:"smtp"`
	App          AppConfig       `json:"app"`
	OAuth        OAuthConfig     `json:"oauth"` // 第三方登录配置
	AdminUser    AdminUserConfig `json:"admin_user"`
	GoAccess     GoAccessConfig  `json:"goaccess"`
	SSL          SSLConfig       `json:"ssl"`
	Frontend     FrontendConfig  `json:"frontend"`
	CurrentStep  string          `json:"current_step,omitempty"`  // 当前步骤，用于递增验证
	RevisionMode RevisionMode    `json:"revision_mode,omitempty"` // 修订模式状态
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
	Service  string    `json:"service"`
	Success  bool      `json:"success"`
	Message  string    `json:"message,omitempty"`
	TestedAt time.Time `json:"tested_at"`
}

// ValidationError 验证错误
type ValidationError struct {
	Field   string `json:"field"`
	Message string `json:"message"`
}

// SetupResponse 通用API响应
type SetupResponse struct {
	Success bool              `json:"success"`
	Message string            `json:"message,omitempty"`
	Data    interface{}       `json:"data,omitempty"`
	Errors  []ValidationError `json:"errors,omitempty"`
}
