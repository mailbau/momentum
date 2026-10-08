package middleware

import (
	"context"
	"net/http"
	"strings"

	"github.com/google/uuid"
	"github.com/mailbau/momentum/backend/internal/auth"
	"github.com/mailbau/momentum/backend/internal/httpx"
)

type contextKey string

const (
	ctxUserID contextKey = "userID"
	ctxRole   contextKey = "role"
)

// RequireAuth validates the Bearer access token and stashes the user id/role
// in the request context. Handlers read them with UserID(r) / Role(r).
func RequireAuth(accessSecret string) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			header := r.Header.Get("Authorization")
			if !strings.HasPrefix(header, "Bearer ") {
				httpx.Error(w, http.StatusUnauthorized, "missing bearer token")
				return
			}
			token := strings.TrimPrefix(header, "Bearer ")

			claims, err := auth.ParseAccessToken(accessSecret, token)
			if err != nil {
				httpx.Error(w, http.StatusUnauthorized, "invalid or expired token")
				return
			}

			ctx := context.WithValue(r.Context(), ctxUserID, claims.UserID)
			ctx = context.WithValue(ctx, ctxRole, claims.Role)
			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}

// RequireAdmin must be chained after RequireAuth.
func RequireAdmin(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if Role(r) != "admin" {
			httpx.Error(w, http.StatusForbidden, "admin access required")
			return
		}
		next.ServeHTTP(w, r)
	})
}

func UserID(r *http.Request) uuid.UUID {
	v, _ := r.Context().Value(ctxUserID).(uuid.UUID)
	return v
}

func Role(r *http.Request) string {
	v, _ := r.Context().Value(ctxRole).(string)
	return v
}
