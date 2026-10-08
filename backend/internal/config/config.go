package config

import (
	"os"
	"time"

	"github.com/joho/godotenv"
)

type Config struct {
	Port              string
	DatabaseURL       string
	JWTAccessSecret   string
	JWTRefreshSecret  string
	AccessTokenTTL    time.Duration
	RefreshTokenTTL   time.Duration
	CookieDomain      string
	CookieSecure      bool
}

func Load() Config {
	// .env is optional (e.g. in production envs are injected directly)
	_ = godotenv.Load()

	return Config{
		Port:             getenv("PORT", "8080"),
		DatabaseURL:      getenv("DATABASE_URL", ""),
		JWTAccessSecret:  getenv("JWT_ACCESS_SECRET", ""),
		JWTRefreshSecret: getenv("JWT_REFRESH_SECRET", ""),
		AccessTokenTTL:   getDuration("ACCESS_TOKEN_TTL", 15*time.Minute),
		RefreshTokenTTL:  getDuration("REFRESH_TOKEN_TTL", 30*24*time.Hour),
		CookieDomain:     getenv("COOKIE_DOMAIN", "localhost"),
		CookieSecure:     getenv("COOKIE_SECURE", "false") == "true",
	}
}

func getenv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

func getDuration(key string, fallback time.Duration) time.Duration {
	if v := os.Getenv(key); v != "" {
		if d, err := time.ParseDuration(v); err == nil {
			return d
		}
	}
	return fallback
}
