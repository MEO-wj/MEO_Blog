package config

import (
	"bufio"
	"os"
	"path/filepath"
	"strings"
)

type Config struct {
	AppEnv        string
	ServerAddr    string
	DatabaseURL   string
	RedisAddr     string
	RedisPassword string
	CorsOrigins   string
	JWTSecret     string
	GitHubToken   string
	AdminPassword string
	AdminSequence string
	UploadDir     string
}

func Load() *Config {
	loadLocalEnv()

	return &Config{
		AppEnv:        getEnv("APP_ENV", "development"),
		ServerAddr:    getEnv("SERVER_ADDR", ":8080"),
		DatabaseURL:   getEnv("DATABASE_URL", "postgres://meo:change_me@localhost:5432/meo_blog?sslmode=disable"),
		RedisAddr:     getEnv("REDIS_ADDR", "localhost:6379"),
		RedisPassword: getEnv("REDIS_PASSWORD", ""),
		CorsOrigins:   getEnv("CORS_ORIGINS", "http://localhost:5173,http://localhost:5174,http://localhost:3000"),
		JWTSecret:     getEnv("JWT_SECRET", "dev-secret-change-me"),
		GitHubToken:   getEnv("GITHUB_TOKEN", ""),
		AdminPassword: getEnv("ADMIN_PASSWORD", ""),
		AdminSequence: getEnv("ADMIN_SEQUENCE", ""),
		UploadDir:     getEnv("UPLOAD_DIR", "./uploads"),
	}
}

func getEnv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

func loadLocalEnv() {
	wd, err := os.Getwd()
	if err != nil {
		return
	}

	for {
		loadEnvFile(filepath.Join(wd, ".env"))

		parent := filepath.Dir(wd)
		if parent == wd {
			return
		}
		wd = parent
	}
}

func loadEnvFile(path string) {
	file, err := os.Open(path)
	if err != nil {
		return
	}
	defer file.Close()

	scanner := bufio.NewScanner(file)
	for scanner.Scan() {
		key, value, ok := parseEnvLine(scanner.Text())
		if !ok || os.Getenv(key) != "" {
			continue
		}
		_ = os.Setenv(key, value)
	}
}

func parseEnvLine(line string) (string, string, bool) {
	trimmed := strings.TrimSpace(line)
	if trimmed == "" || strings.HasPrefix(trimmed, "#") {
		return "", "", false
	}

	trimmed = strings.TrimPrefix(trimmed, "export ")
	key, value, found := strings.Cut(trimmed, "=")
	if !found {
		return "", "", false
	}

	key = strings.TrimSpace(key)
	if key == "" {
		return "", "", false
	}

	value = strings.TrimSpace(value)
	if len(value) >= 2 {
		quote := value[0]
		if (quote == '"' || quote == '\'') && value[len(value)-1] == quote {
			value = value[1 : len(value)-1]
		}
	}

	return key, value, true
}
