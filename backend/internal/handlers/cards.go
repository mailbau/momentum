package handlers

import (
	"errors"
	"net/http"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgtype"
	sqlcgen "github.com/mailbau/momentum/backend/internal/db/sqlc"
	"github.com/mailbau/momentum/backend/internal/httpx"
	"github.com/mailbau/momentum/backend/internal/middleware"
)

type CardHandler struct {
	q *sqlcgen.Queries
}

func NewCardHandler(q *sqlcgen.Queries) *CardHandler {
	return &CardHandler{q: q}
}

// ---- Shared DTOs ----

type cardSummary struct {
	ID           string   `json:"id"`
	CourseID     string   `json:"course_id"`
	CourseCode   string   `json:"course_code"`
	CourseName   string   `json:"course_name"`
	StrategyID   *string  `json:"strategy_id"`
	StrategyName *string  `json:"strategy_name"`
	Title        string   `json:"title"`
	Description  string   `json:"description"`
	Stage        string   `json:"stage"`
	Position     float64  `json:"position"`
	Difficulty   string   `json:"difficulty"`
	Priority     string   `json:"priority"`
	PreTest      *float64 `json:"pre_test"`
	PostTest     *float64 `json:"post_test"`
	Rating       *int16   `json:"rating"`
	CreatedAt    string   `json:"created_at"`
}

func toCardSummary(row sqlcgen.ListActiveCardsRow) cardSummary {
	return cardSummary{
		ID:           row.ID.String(),
		CourseID:     row.CourseID.String(),
		CourseCode:   row.CourseCode,
		CourseName:   row.CourseName,
		StrategyID:   pgUUIDToStringPtr(row.StrategyID),
		StrategyName: row.StrategyName,
		Title:        row.Title,
		Description:  row.Description,
		Stage:        string(row.Stage),
		Position:     row.Position,
		Difficulty:   string(row.Difficulty),
		Priority:     string(row.Priority),
		PreTest:      numericToFloat(row.PreTest),
		PostTest:     numericToFloat(row.PostTest),
		Rating:       row.Rating,
		CreatedAt:    row.CreatedAt.Time.Format(time.RFC3339),
	}
}

// ---- GET /api/board ----

func (h *CardHandler) GetBoard(w http.ResponseWriter, r *http.Request) {
	rows, err := h.q.ListActiveCards(r.Context(), middleware.UserID(r))
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, "failed to load board")
		return
	}

	stages := map[string][]cardSummary{
		"planning":     {},
		"monitoring":   {},
		"controlling":  {},
		"reflection":   {},
	}
	for _, row := range rows {
		stages[string(row.Stage)] = append(stages[string(row.Stage)], toCardSummary(row))
	}
	httpx.JSON(w, http.StatusOK, stages)
}

// ---- POST /api/cards ----

type createCardRequest struct {
	CourseID string `json:"course_id"`
	Title    string `json:"title"`
}

func (h *CardHandler) CreateCard(w http.ResponseWriter, r *http.Request) {
	var req createCardRequest
	if err := httpx.Decode(r, &req); err != nil {
		httpx.Error(w, http.StatusBadRequest, "invalid request body")
		return
	}
	req.Title = strings.TrimSpace(req.Title)
	if req.Title == "" {
		httpx.Error(w, http.StatusBadRequest, "title is required")
		return
	}
	courseID, err := uuid.Parse(req.CourseID)
	if err != nil {
		httpx.Error(w, http.StatusBadRequest, "invalid course_id")
		return
	}

	userID := middleware.UserID(r)
	nextPos, err := h.q.NextPositionInStage(r.Context(), sqlcgen.NextPositionInStageParams{
		UserID: userID,
		Stage:  sqlcgen.SrlStagePlanning,
	})
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, "failed to compute position")
		return
	}

	card, err := h.q.CreateCard(r.Context(), sqlcgen.CreateCardParams{
		UserID:   userID,
		CourseID: courseID,
		Title:    req.Title,
		Position: nextPos,
	})
	if err != nil {
		var pgErr *pgconn.PgError
		if errors.As(err, &pgErr) && pgErr.Code == "23503" {
			httpx.Error(w, http.StatusBadRequest, "course not found")
			return
		}
		httpx.Error(w, http.StatusInternalServerError, "failed to create card")
		return
	}

	_ = h.q.CreateEvent(r.Context(), sqlcgen.CreateEventParams{
		UserID: pgtype.UUID{Bytes: userID, Valid: true},
		CardID: pgtype.UUID{Bytes: card.ID, Valid: true},
		Type:   "card_created",
		Data:   []byte(`{}`),
	})

	httpx.JSON(w, http.StatusCreated, map[string]string{"id": card.ID.String()})
}

// ---- PATCH /api/cards/{id}/move ----

type moveCardRequest struct {
	Stage    string  `json:"stage"`
	Position float64 `json:"position"`
}

var validStages = map[string]sqlcgen.SrlStage{
	"planning":    sqlcgen.SrlStagePlanning,
	"monitoring":  sqlcgen.SrlStageMonitoring,
	"controlling": sqlcgen.SrlStageControlling,
	"reflection":  sqlcgen.SrlStageReflection,
}

func (h *CardHandler) MoveCard(w http.ResponseWriter, r *http.Request) {
	cardID, err := uuid.Parse(r.PathValue("id"))
	if err != nil {
		httpx.Error(w, http.StatusBadRequest, "invalid card id")
		return
	}
	var req moveCardRequest
	if err := httpx.Decode(r, &req); err != nil {
		httpx.Error(w, http.StatusBadRequest, "invalid request body")
		return
	}
	stage, ok := validStages[req.Stage]
	if !ok {
		httpx.Error(w, http.StatusBadRequest, "invalid stage")
		return
	}

	userID := middleware.UserID(r)
	existing, err := h.q.GetCard(r.Context(), sqlcgen.GetCardParams{ID: cardID, UserID: userID})
	if err != nil {
		httpx.Error(w, http.StatusNotFound, "card not found")
		return
	}

	updated, err := h.q.MoveCard(r.Context(), sqlcgen.MoveCardParams{
		ID:       cardID,
		UserID:   userID,
		Stage:    stage,
		Position: req.Position,
	})
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, "failed to move card")
		return
	}

	if existing.Stage != stage {
		_ = h.q.CreateEvent(r.Context(), sqlcgen.CreateEventParams{
			UserID: pgtype.UUID{Bytes: userID, Valid: true},
			CardID: pgtype.UUID{Bytes: cardID, Valid: true},
			Type:   "card_moved",
			Data:   []byte(`{"from":"` + string(existing.Stage) + `","to":"` + string(stage) + `"}`),
		})
	}

	httpx.JSON(w, http.StatusOK, map[string]string{"id": updated.ID.String(), "stage": string(updated.Stage)})
}

// ---- Archive / Restore / Delete ----

type archiveCardRequest struct {
	Reason string `json:"reason"`
}

func (h *CardHandler) ArchiveCard(w http.ResponseWriter, r *http.Request) {
	cardID, err := uuid.Parse(r.PathValue("id"))
	if err != nil {
		httpx.Error(w, http.StatusBadRequest, "invalid card id")
		return
	}
	var req archiveCardRequest
	if err := httpx.Decode(r, &req); err != nil {
		httpx.Error(w, http.StatusBadRequest, "invalid request body")
		return
	}
	req.Reason = strings.TrimSpace(req.Reason)
	if req.Reason == "" {
		httpx.Error(w, http.StatusBadRequest, "a reason is required to archive a card")
		return
	}

	userID := middleware.UserID(r)
	if err := h.q.ArchiveCard(r.Context(), sqlcgen.ArchiveCardParams{
		ID: cardID, UserID: userID, ArchiveReason: &req.Reason,
	}); err != nil {
		httpx.Error(w, http.StatusInternalServerError, "failed to archive card")
		return
	}
	_ = h.q.CreateEvent(r.Context(), sqlcgen.CreateEventParams{
		UserID: pgtype.UUID{Bytes: userID, Valid: true},
		CardID: pgtype.UUID{Bytes: cardID, Valid: true},
		Type:   "card_archived",
		Data:   []byte(`{}`),
	})
	httpx.JSON(w, http.StatusOK, map[string]string{"message": "card archived"})
}

func (h *CardHandler) RestoreCard(w http.ResponseWriter, r *http.Request) {
	cardID, err := uuid.Parse(r.PathValue("id"))
	if err != nil {
		httpx.Error(w, http.StatusBadRequest, "invalid card id")
		return
	}
	userID := middleware.UserID(r)
	if err := h.q.RestoreCard(r.Context(), sqlcgen.RestoreCardParams{ID: cardID, UserID: userID}); err != nil {
		httpx.Error(w, http.StatusInternalServerError, "failed to restore card")
		return
	}
	httpx.JSON(w, http.StatusOK, map[string]string{"message": "card restored"})
}

func (h *CardHandler) DeleteCard(w http.ResponseWriter, r *http.Request) {
	cardID, err := uuid.Parse(r.PathValue("id"))
	if err != nil {
		httpx.Error(w, http.StatusBadRequest, "invalid card id")
		return
	}
	userID := middleware.UserID(r)

	active, err := h.q.GetActiveStudySession(r.Context(), userID)
	if err == nil && active.CardID == cardID {
		httpx.Error(w, http.StatusConflict, "stop the study timer before deleting this card")
		return
	}

	if err := h.q.DeleteCard(r.Context(), sqlcgen.DeleteCardParams{ID: cardID, UserID: userID}); err != nil {
		httpx.Error(w, http.StatusInternalServerError, "failed to delete card")
		return
	}
	httpx.JSON(w, http.StatusOK, map[string]string{"message": "card deleted"})
}

func (h *CardHandler) ListArchived(w http.ResponseWriter, r *http.Request) {
	rows, err := h.q.ListArchivedCards(r.Context(), middleware.UserID(r))
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, "failed to load archived cards")
		return
	}
	out := make([]map[string]any, 0, len(rows))
	for _, c := range rows {
		out = append(out, map[string]any{
			"id":             c.ID.String(),
			"title":          c.Title,
			"archive_reason": c.ArchiveReason,
			"archived_at":    c.ArchivedAt.Time.Format(time.RFC3339),
		})
	}
	httpx.JSON(w, http.StatusOK, out)
}
