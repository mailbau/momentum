package router

import (
	"net/http"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/mailbau/momentum/backend/internal/config"
	sqlcgen "github.com/mailbau/momentum/backend/internal/db/sqlc"
	"github.com/mailbau/momentum/backend/internal/handlers"
	"github.com/mailbau/momentum/backend/internal/middleware"
)

func New(pool *pgxpool.Pool, cfg config.Config, corsOrigin string) http.Handler {
	q := sqlcgen.New(pool)
	authH := handlers.NewAuthHandler(q, cfg)
	requireAuth := middleware.RequireAuth(cfg.JWTAccessSecret)

	mux := http.NewServeMux()
	mux.HandleFunc("GET /healthz", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.Write([]byte(`{"status":"ok"}`))
	})

	// Public auth routes
	mux.HandleFunc("POST /api/auth/register", authH.Register)
	mux.HandleFunc("POST /api/auth/login", authH.Login)
	mux.HandleFunc("POST /api/auth/refresh", authH.Refresh)

	// Authenticated routes
	mux.Handle("POST /api/auth/logout", requireAuth(http.HandlerFunc(authH.Logout)))
	mux.Handle("GET /api/me", requireAuth(http.HandlerFunc(authH.Me)))
	mux.Handle("PATCH /api/me", requireAuth(http.HandlerFunc(authH.UpdateMe)))
	mux.Handle("PUT /api/me/password", requireAuth(http.HandlerFunc(authH.UpdatePassword)))
	mux.Handle("POST /api/me/onboarded", requireAuth(http.HandlerFunc(authH.MarkOnboarded)))

	// Admin routes (role check chained after auth)
	mux.Handle("GET /api/admin/ping", requireAuth(middleware.RequireAdmin(http.HandlerFunc(handlers.AdminPing))))

	var handler http.Handler = mux
	handler = middleware.CORS(corsOrigin)(handler)
	handler = middleware.Logging(handler)
	return handler
}
