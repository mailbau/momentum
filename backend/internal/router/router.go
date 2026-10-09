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
	cardH := handlers.NewCardHandler(q)
	lookupH := handlers.NewLookupHandler(q)
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

	// Lookups
	mux.Handle("GET /api/courses", requireAuth(http.HandlerFunc(lookupH.ListCourses)))
	mux.Handle("GET /api/strategies", requireAuth(http.HandlerFunc(lookupH.ListStrategies)))

	// Board and cards
	mux.Handle("GET /api/board", requireAuth(http.HandlerFunc(cardH.GetBoard)))
	mux.Handle("POST /api/cards", requireAuth(http.HandlerFunc(cardH.CreateCard)))
	mux.Handle("GET /api/cards/{id}", requireAuth(http.HandlerFunc(cardH.GetCardDetail)))
	mux.Handle("PATCH /api/cards/{id}", requireAuth(http.HandlerFunc(cardH.UpdateCard)))
	mux.Handle("PATCH /api/cards/{id}/move", requireAuth(http.HandlerFunc(cardH.MoveCard)))
	mux.Handle("POST /api/cards/{id}/archive", requireAuth(http.HandlerFunc(cardH.ArchiveCard)))
	mux.Handle("POST /api/cards/{id}/restore", requireAuth(http.HandlerFunc(cardH.RestoreCard)))
	mux.Handle("DELETE /api/cards/{id}", requireAuth(http.HandlerFunc(cardH.DeleteCard)))
	mux.Handle("GET /api/cards/archived", requireAuth(http.HandlerFunc(cardH.ListArchived)))

	mux.Handle("POST /api/cards/{id}/checklist", requireAuth(http.HandlerFunc(cardH.CreateChecklistItem)))
	mux.Handle("PATCH /api/cards/{id}/checklist/{itemId}", requireAuth(http.HandlerFunc(cardH.UpdateChecklistItem)))
	mux.Handle("DELETE /api/cards/{id}/checklist/{itemId}", requireAuth(http.HandlerFunc(cardH.DeleteChecklistItem)))

	mux.Handle("POST /api/cards/{id}/links", requireAuth(http.HandlerFunc(cardH.CreateLink)))
	mux.Handle("DELETE /api/cards/{id}/links/{linkId}", requireAuth(http.HandlerFunc(cardH.DeleteLink)))

	mux.Handle("POST /api/cards/{id}/sessions/start", requireAuth(http.HandlerFunc(cardH.StartSession)))
	mux.Handle("POST /api/sessions/stop", requireAuth(http.HandlerFunc(cardH.StopSession)))
	mux.Handle("GET /api/sessions/active", requireAuth(http.HandlerFunc(cardH.ActiveSession)))

	// Admin routes (role check chained after auth)
	mux.Handle("GET /api/admin/ping", requireAuth(middleware.RequireAdmin(http.HandlerFunc(handlers.AdminPing))))

	var handler http.Handler = mux
	handler = middleware.CORS(corsOrigin)(handler)
	handler = middleware.Logging(handler)
	return handler
}
