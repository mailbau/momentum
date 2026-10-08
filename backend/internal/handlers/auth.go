package handlers

import (
	"context"
	"errors"
	"net/http"
	"regexp"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgtype"
	"github.com/mailbau/momentum/backend/internal/auth"
	"github.com/mailbau/momentum/backend/internal/config"
	sqlcgen "github.com/mailbau/momentum/backend/internal/db/sqlc"
	"github.com/mailbau/momentum/backend/internal/httpx"
	"github.com/mailbau/momentum/backend/internal/middleware"
)

type AuthHandler struct {
	q   *sqlcgen.Queries
	cfg config.Config
}

func NewAuthHandler(q *sqlcgen.Queries, cfg config.Config) *AuthHandler {
	return &AuthHandler{q: q, cfg: cfg}
}

var usernameRe = regexp.MustCompile(`^[a-zA-Z0-9_]{3,32}$`)

// ---- Register ----

type registerRequest struct {
	FirstName string `json:"first_name"`
	LastName  string `json:"last_name"`
	Email     string `json:"email"`
	Username  string `json:"username"`
	Password  string `json:"password"`
}

func (h *AuthHandler) Register(w http.ResponseWriter, r *http.Request) {
	var req registerRequest
	if err := httpx.Decode(r, &req); err != nil {
		httpx.Error(w, http.StatusBadRequest, "invalid request body")
		return
	}
	req.Email = strings.TrimSpace(strings.ToLower(req.Email))
	req.Username = strings.TrimSpace(req.Username)

	if req.FirstName == "" || req.LastName == "" || req.Email == "" || req.Username == "" || req.Password == "" {
		httpx.Error(w, http.StatusBadRequest, "all fields are required")
		return
	}
	if !usernameRe.MatchString(req.Username) {
		httpx.Error(w, http.StatusBadRequest, "username must be 3-32 characters, letters/numbers/underscore only")
		return
	}
	if msg := validatePassword(req.Password); msg != "" {
		httpx.Error(w, http.StatusBadRequest, msg)
		return
	}

	hash, err := auth.HashPassword(req.Password)
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, "failed to process password")
		return
	}

	user, err := h.q.CreateUser(r.Context(), sqlcgen.CreateUserParams{
		Email:        req.Email,
		Username:     req.Username,
		PasswordHash: hash,
		FirstName:    req.FirstName,
		LastName:     req.LastName,
		Role:         sqlcgen.UserRoleStudent,
		ProgramID:    pgtype.UUID{Valid: false},
	})
	if err != nil {
		var pgErr *pgconn.PgError
		if errors.As(err, &pgErr) && pgErr.Code == "23505" { // unique_violation
			httpx.Error(w, http.StatusConflict, "email or username already in use")
			return
		}
		httpx.Error(w, http.StatusInternalServerError, "failed to create user")
		return
	}

	_ = h.q.CreateEvent(r.Context(), sqlcgen.CreateEventParams{
		UserID: pgtype.UUID{Bytes: user.ID, Valid: true},
		Type:   "user_registered",
		Data:   []byte(`{}`),
	})

	httpx.JSON(w, http.StatusCreated, map[string]string{"message": "registered successfully"})
}

// ---- Login ----

type loginRequest struct {
	Identifier string `json:"identifier"` // email or username
	Password   string `json:"password"`
}

type loginResponse struct {
	AccessToken string     `json:"access_token"`
	User        userPublic `json:"user"`
}

type userPublic struct {
	ID        string `json:"id"`
	Email     string `json:"email"`
	Username  string `json:"username"`
	FirstName string `json:"first_name"`
	LastName  string `json:"last_name"`
	Role      string `json:"role"`
	Onboarded bool   `json:"onboarded"`
}

func toPublic(u sqlcgen.User) userPublic {
	return userPublic{
		ID:        u.ID.String(),
		Email:     u.Email,
		Username:  u.Username,
		FirstName: u.FirstName,
		LastName:  u.LastName,
		Role:      string(u.Role),
		Onboarded: u.OnboardedAt.Valid,
	}
}

func (h *AuthHandler) Login(w http.ResponseWriter, r *http.Request) {
	var req loginRequest
	if err := httpx.Decode(r, &req); err != nil {
		httpx.Error(w, http.StatusBadRequest, "invalid request body")
		return
	}
	identifier := strings.TrimSpace(strings.ToLower(req.Identifier))

	user, err := h.q.GetUserByEmailOrUsername(r.Context(), identifier)
	if err != nil {
		httpx.Error(w, http.StatusUnauthorized, "invalid credentials")
		return
	}
	if !auth.CheckPassword(user.PasswordHash, req.Password) {
		httpx.Error(w, http.StatusUnauthorized, "invalid credentials")
		return
	}

	if err := h.issueSession(w, r.Context(), user); err != nil {
		httpx.Error(w, http.StatusInternalServerError, "failed to start session")
		return
	}

	_ = h.q.CreateEvent(r.Context(), sqlcgen.CreateEventParams{
		UserID: pgtype.UUID{Bytes: user.ID, Valid: true},
		Type:   "login",
		Data:   []byte(`{}`),
	})

	accessToken, _ := auth.NewAccessToken(h.cfg.JWTAccessSecret, h.cfg.AccessTokenTTL, user.ID, string(user.Role))
	httpx.JSON(w, http.StatusOK, loginResponse{AccessToken: accessToken, User: toPublic(user)})
}

// issueSession creates a refresh token row and sets it as an httpOnly cookie.
func (h *AuthHandler) issueSession(w http.ResponseWriter, ctx context.Context, user sqlcgen.User) error {
	raw, hash, err := auth.NewRefreshToken()
	if err != nil {
		return err
	}
	expiresAt := time.Now().Add(h.cfg.RefreshTokenTTL)
	if _, err := h.q.CreateRefreshToken(ctx, sqlcgen.CreateRefreshTokenParams{
		UserID:    user.ID,
		TokenHash: hash,
		ExpiresAt: pgtype.Timestamptz{Time: expiresAt, Valid: true},
	}); err != nil {
		return err
	}
	auth.SetRefreshCookie(w, raw, h.cfg.RefreshTokenTTL, h.cfg.CookieDomain, h.cfg.CookieSecure)
	return nil
}

// ---- Refresh ----

func (h *AuthHandler) Refresh(w http.ResponseWriter, r *http.Request) {
	cookie, err := r.Cookie(auth.RefreshCookieName)
	if err != nil || cookie.Value == "" {
		httpx.Error(w, http.StatusUnauthorized, "missing refresh token")
		return
	}
	hash := auth.HashRefreshToken(cookie.Value)

	stored, err := h.q.GetRefreshToken(r.Context(), hash)
	if err != nil {
		httpx.Error(w, http.StatusUnauthorized, "invalid or expired session")
		return
	}

	user, err := h.q.GetUserByID(r.Context(), stored.UserID)
	if err != nil {
		httpx.Error(w, http.StatusUnauthorized, "user not found")
		return
	}

	// Rotate: revoke old token, issue a new one.
	_ = h.q.RevokeRefreshToken(r.Context(), hash)
	if err := h.issueSession(w, r.Context(), user); err != nil {
		httpx.Error(w, http.StatusInternalServerError, "failed to refresh session")
		return
	}

	accessToken, _ := auth.NewAccessToken(h.cfg.JWTAccessSecret, h.cfg.AccessTokenTTL, user.ID, string(user.Role))
	httpx.JSON(w, http.StatusOK, map[string]string{"access_token": accessToken})
}

// ---- Logout ----

func (h *AuthHandler) Logout(w http.ResponseWriter, r *http.Request) {
	if cookie, err := r.Cookie(auth.RefreshCookieName); err == nil && cookie.Value != "" {
		hash := auth.HashRefreshToken(cookie.Value)
		_ = h.q.RevokeRefreshToken(r.Context(), hash)
	}
	auth.ClearRefreshCookie(w, h.cfg.CookieDomain, h.cfg.CookieSecure)

	if uid := middleware.UserID(r); uid != uuid.Nil {
		_ = h.q.CreateEvent(r.Context(), sqlcgen.CreateEventParams{
			UserID: pgtype.UUID{Bytes: uid, Valid: true},
			Type:   "logout",
			Data:   []byte(`{}`),
		})
	}
	httpx.JSON(w, http.StatusOK, map[string]string{"message": "logged out"})
}

// ---- Me ----

func (h *AuthHandler) Me(w http.ResponseWriter, r *http.Request) {
	user, err := h.q.GetUserByID(r.Context(), middleware.UserID(r))
	if err != nil {
		httpx.Error(w, http.StatusNotFound, "user not found")
		return
	}
	httpx.JSON(w, http.StatusOK, toPublic(user))
}

type updateMeRequest struct {
	FirstName string `json:"first_name"`
	LastName  string `json:"last_name"`
	Email     string `json:"email"`
	Username  string `json:"username"`
}

func (h *AuthHandler) UpdateMe(w http.ResponseWriter, r *http.Request) {
	var req updateMeRequest
	if err := httpx.Decode(r, &req); err != nil {
		httpx.Error(w, http.StatusBadRequest, "invalid request body")
		return
	}
	req.Email = strings.TrimSpace(strings.ToLower(req.Email))
	req.Username = strings.TrimSpace(req.Username)

	if req.FirstName == "" || req.LastName == "" || req.Email == "" || req.Username == "" {
		httpx.Error(w, http.StatusBadRequest, "all fields are required")
		return
	}
	if !usernameRe.MatchString(req.Username) {
		httpx.Error(w, http.StatusBadRequest, "username must be 3-32 characters, letters/numbers/underscore only")
		return
	}

	user, err := h.q.UpdateUserProfile(r.Context(), sqlcgen.UpdateUserProfileParams{
		ID:        middleware.UserID(r),
		FirstName: req.FirstName,
		LastName:  req.LastName,
		Email:     req.Email,
		Username:  req.Username,
	})
	if err != nil {
		var pgErr *pgconn.PgError
		if errors.As(err, &pgErr) && pgErr.Code == "23505" {
			httpx.Error(w, http.StatusConflict, "email or username already in use")
			return
		}
		httpx.Error(w, http.StatusInternalServerError, "failed to update profile")
		return
	}
	httpx.JSON(w, http.StatusOK, toPublic(user))
}

type updatePasswordRequest struct {
	CurrentPassword string `json:"current_password"`
	NewPassword     string `json:"new_password"`
}

func (h *AuthHandler) UpdatePassword(w http.ResponseWriter, r *http.Request) {
	var req updatePasswordRequest
	if err := httpx.Decode(r, &req); err != nil {
		httpx.Error(w, http.StatusBadRequest, "invalid request body")
		return
	}

	user, err := h.q.GetUserByID(r.Context(), middleware.UserID(r))
	if err != nil {
		httpx.Error(w, http.StatusNotFound, "user not found")
		return
	}
	if !auth.CheckPassword(user.PasswordHash, req.CurrentPassword) {
		httpx.Error(w, http.StatusBadRequest, "current password is incorrect")
		return
	}
	if msg := validatePassword(req.NewPassword); msg != "" {
		httpx.Error(w, http.StatusBadRequest, msg)
		return
	}

	hash, err := auth.HashPassword(req.NewPassword)
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, "failed to process password")
		return
	}
	if err := h.q.UpdateUserPassword(r.Context(), sqlcgen.UpdateUserPasswordParams{
		ID:           user.ID,
		PasswordHash: hash,
	}); err != nil {
		httpx.Error(w, http.StatusInternalServerError, "failed to update password")
		return
	}

	// Log out every other session for safety.
	_ = h.q.RevokeAllUserRefreshTokens(r.Context(), user.ID)
	httpx.JSON(w, http.StatusOK, map[string]string{"message": "password updated"})
}

func (h *AuthHandler) MarkOnboarded(w http.ResponseWriter, r *http.Request) {
	if err := h.q.MarkUserOnboarded(r.Context(), middleware.UserID(r)); err != nil {
		httpx.Error(w, http.StatusInternalServerError, "failed to update")
		return
	}
	httpx.JSON(w, http.StatusOK, map[string]string{"message": "onboarded"})
}

func validatePassword(p string) string {
	if len(p) < 8 {
		return "password must be at least 8 characters long"
	}
	if !regexp.MustCompile(`[A-Z]`).MatchString(p) {
		return "password must contain at least one uppercase letter"
	}
	if !regexp.MustCompile(`[0-9]`).MatchString(p) {
		return "password must contain at least one number"
	}
	return ""
}
