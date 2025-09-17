package storage

import (
	"encoding/json"
	"fmt"
	"log"
	"os"
	"path/filepath"
	"sync"
	"time"

	"github.com/biliqiqi/baklab-setup/internal/model"
)

// JSONStorage JSON文件存储实现
type JSONStorage struct {
	dataDir string
	mu      sync.RWMutex
}

// NewJSONStorage 创建JSON存储实例
func NewJSONStorage(dataDir string) *JSONStorage {
	// 确保数据目录存在
	if err := os.MkdirAll(dataDir, 0755); err != nil {
		log.Printf("Warning: failed to create data directory %s: %v", dataDir, err)
	}

	return &JSONStorage{
		dataDir: dataDir,
	}
}

// GetSetupState 获取setup状态
func (s *JSONStorage) GetSetupState() (*model.SetupState, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	filePath := filepath.Join(s.dataDir, "setup-state.json")

	// 如果文件不存在，返回默认状态
	if _, err := os.Stat(filePath); os.IsNotExist(err) {
		return &model.SetupState{
			Status:    model.StatusPending,
			Progress:  0,
			CreatedAt: time.Now(),
			UpdatedAt: time.Now(),
		}, nil
	}

	data, err := os.ReadFile(filePath)
	if err != nil {
		return nil, fmt.Errorf("failed to read setup state: %w", err)
	}

	var state model.SetupState
	if err := json.Unmarshal(data, &state); err != nil {
		return nil, fmt.Errorf("failed to unmarshal setup state: %w", err)
	}

	return &state, nil
}

// SaveSetupState 保存setup状态
func (s *JSONStorage) SaveSetupState(state *model.SetupState) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	state.UpdatedAt = time.Now()

	data, err := json.MarshalIndent(state, "", "  ")
	if err != nil {
		return fmt.Errorf("failed to marshal setup state: %w", err)
	}

	filePath := filepath.Join(s.dataDir, "setup-state.json")
	if err := os.WriteFile(filePath, data, 0644); err != nil {
		return fmt.Errorf("failed to write setup state: %w", err)
	}

	return nil
}

// GetSetupConfig 获取setup配置
func (s *JSONStorage) GetSetupConfig() (*model.SetupConfig, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	filePath := filepath.Join(s.dataDir, "config-draft.json")

	if _, err := os.Stat(filePath); os.IsNotExist(err) {
		return &model.SetupConfig{}, nil
	}

	data, err := os.ReadFile(filePath)
	if err != nil {
		return nil, fmt.Errorf("failed to read setup config: %w", err)
	}

	var cfg model.SetupConfig
	if err := json.Unmarshal(data, &cfg); err != nil {
		return nil, fmt.Errorf("failed to unmarshal setup config: %w", err)
	}

	return &cfg, nil
}

// SaveSetupConfig 保存setup配置
func (s *JSONStorage) SaveSetupConfig(cfg *model.SetupConfig) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	data, err := json.MarshalIndent(cfg, "", "  ")
	if err != nil {
		return fmt.Errorf("failed to marshal setup config: %w", err)
	}

	filePath := filepath.Join(s.dataDir, "config-draft.json")
	if err := os.WriteFile(filePath, data, 0644); err != nil {
		return fmt.Errorf("failed to write setup config: %w", err)
	}

	return nil
}

// GetSetupToken 获取setup令牌
func (s *JSONStorage) GetSetupToken() (*model.SetupToken, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	filePath := filepath.Join(s.dataDir, "tokens.json")

	if _, err := os.Stat(filePath); os.IsNotExist(err) {
		return nil, fmt.Errorf("setup token not found")
	}

	data, err := os.ReadFile(filePath)
	if err != nil {
		return nil, fmt.Errorf("failed to read setup token: %w", err)
	}

	var token model.SetupToken
	if err := json.Unmarshal(data, &token); err != nil {
		return nil, fmt.Errorf("failed to unmarshal setup token: %w", err)
	}

	return &token, nil
}

// SaveSetupToken 保存setup令牌
func (s *JSONStorage) SaveSetupToken(token *model.SetupToken) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	data, err := json.MarshalIndent(token, "", "  ")
	if err != nil {
		return fmt.Errorf("failed to marshal setup token: %w", err)
	}

	filePath := filepath.Join(s.dataDir, "tokens.json")
	if err := os.WriteFile(filePath, data, 0644); err != nil {
		return fmt.Errorf("failed to write setup token: %w", err)
	}

	return nil
}

// IsSetupCompleted 检查setup是否已完成
func (s *JSONStorage) IsSetupCompleted() (bool, error) {
	state, err := s.GetSetupState()
	if err != nil {
		return false, err
	}

	return state.Status == model.StatusCompleted, nil
}

// MarkSetupCompleted 标记setup为已完成
func (s *JSONStorage) MarkSetupCompleted() error {
	state, err := s.GetSetupState()
	if err != nil {
		return err
	}

	now := time.Now()
	state.Status = model.StatusCompleted
	state.Progress = 100
	state.CompletedAt = &now
	state.Message = "Setup completed successfully" // Note: This is an internal message

	return s.SaveSetupState(state)
}

// CleanupTempFiles 清理临时文件
func (s *JSONStorage) CleanupTempFiles() error {
	tempFiles := []string{"config-draft.json", "tokens.json"}

	for _, filename := range tempFiles {
		filePath := filepath.Join(s.dataDir, filename)
		if err := os.Remove(filePath); err != nil && !os.IsNotExist(err) {
			return fmt.Errorf("failed to remove %s: %w", filename, err)
		}
	}

	return nil
}

// ResetSetupState 重置setup状态，清理所有相关文件
func (s *JSONStorage) ResetSetupState() error {
	s.mu.Lock()
	defer s.mu.Unlock()

	// 清理所有setup相关文件
	filesToRemove := []string{
		"setup-state.json",
		"config-draft.json",
		"tokens.json",
	}

	for _, filename := range filesToRemove {
		filePath := filepath.Join(s.dataDir, filename)
		if err := os.Remove(filePath); err != nil && !os.IsNotExist(err) {
			log.Printf("Warning: failed to remove %s: %v", filename, err)
		}
	}

	log.Printf("Setup state has been reset")
	return nil
}
