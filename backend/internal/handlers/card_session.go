package handlers

import (
	"net/http"

	"github.com/google/uuid"
	sqlcgen "github.com/mailbau/momentum/backend/internal/db/sqlc"
	"github.com/mailbau/momentum/backend/internal/httpx"
	"github.com/mailbau/momentum/backend/internal/middleware"
)

// POST /api/cards/{id}/sessions/start
func (h *CardHandler) StartSession(w http.ResponseWriter, r *http.Request) {
	cardID, err := uuid.Parse(r.PathValue("id"))
	if err != nil {
		httpx.Error(w, http.StatusBadRequest, "invalid card id")
		return
	}
	userID := middleware.UserID(r)

	card, err := h.q.GetCard(r.Context(), sqlcgen.GetCardParams{ID: cardID, UserID: userID})
	if err != nil {
		httpx.Error(w, http.StatusNotFound, "card not found")
		return
	}
	if card.Stage == sqlcgen.SrlStageReflection {
		httpx.Error(w, http.StatusBadRequest, "timer is disabled in Reflection")
		return
	}

	// The unique partial index on study_sessions enforces one open session
	// per user at the DB level, but stop any dangling one first so the
	// student doesn't get a confusing constraint-violation error.
	_ = h.q.StopStudySession(r.Context(), userID)

	session, err := h.q.StartStudySession(r.Context(), sqlcgen.StartStudySessionParams{UserID: userID, CardID: cardID})
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, "failed to start timer")
		return
	}
	httpx.JSON(w, http.StatusCreated, map[string]string{"session_id": session.ID.String()})
}

// POST /api/sessions/stop
func (h *CardHandler) StopSession(w http.ResponseWriter, r *http.Request) {
	userID := middleware.UserID(r)
	if err := h.q.StopStudySession(r.Context(), userID); err != nil {
		httpx.Error(w, http.StatusInternalServerError, "failed to stop timer")
		return
	}
	httpx.JSON(w, http.StatusOK, map[string]string{"message": "timer stopped"})
}

// GET /api/sessions/active
func (h *CardHandler) ActiveSession(w http.ResponseWriter, r *http.Request) {
	userID := middleware.UserID(r)
	session, err := h.q.GetActiveStudySession(r.Context(), userID)
	if err != nil {
		httpx.JSON(w, http.StatusOK, map[string]any{"active": false})
		return
	}
	httpx.JSON(w, http.StatusOK, map[string]any{
		"active":     true,
		"card_id":    session.CardID.String(),
		"started_at": session.StartedAt.Time,
	})
}
