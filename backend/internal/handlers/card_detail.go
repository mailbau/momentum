package handlers

import (
	"net/http"
	"time"

	"github.com/google/uuid"
	sqlcgen "github.com/mailbau/momentum/backend/internal/db/sqlc"
	"github.com/mailbau/momentum/backend/internal/httpx"
	"github.com/mailbau/momentum/backend/internal/middleware"
)

type checklistItemDTO struct {
	ID       string `json:"id"`
	Text     string `json:"text"`
	Done     bool   `json:"done"`
	Position float64 `json:"position"`
}

type linkDTO struct {
	ID    string `json:"id"`
	URL   string `json:"url"`
	Label string `json:"label"`
}

type cardDetail struct {
	cardSummary
	PriorKnowledge   string              `json:"prior_knowledge"`
	Notes            string              `json:"notes"`
	ArchivedAt       *string             `json:"archived_at"`
	ArchiveReason    *string             `json:"archive_reason"`
	Checklist        []checklistItemDTO  `json:"checklist"`
	Links            []linkDTO           `json:"links"`
	StudyMinutes     float64             `json:"study_minutes"`
	TimerRunning     bool                `json:"timer_running"`
}

// GET /api/cards/{id}
func (h *CardHandler) GetCardDetail(w http.ResponseWriter, r *http.Request) {
	cardID, err := uuid.Parse(r.PathValue("id"))
	if err != nil {
		httpx.Error(w, http.StatusBadRequest, "invalid card id")
		return
	}
	userID := middleware.UserID(r)

	detail, err := h.buildCardDetail(r, cardID, userID)
	if err != nil {
		httpx.Error(w, http.StatusNotFound, "card not found")
		return
	}
	httpx.JSON(w, http.StatusOK, detail)
}

func (h *CardHandler) buildCardDetail(r *http.Request, cardID, userID uuid.UUID) (cardDetail, error) {
	card, err := h.q.GetCardWithCourse(r.Context(), sqlcgen.GetCardWithCourseParams{ID: cardID, UserID: userID})
	if err != nil {
		return cardDetail{}, err
	}

	ids := []uuid.UUID{card.ID}

	checklistRows, err := h.q.ListChecklistItemsByCardIDs(r.Context(), ids)
	if err != nil {
		return cardDetail{}, err
	}
	linkRows, err := h.q.ListLinksByCardIDs(r.Context(), ids)
	if err != nil {
		return cardDetail{}, err
	}
	minutesRows, err := h.q.TotalStudyMinutesByCardIDs(r.Context(), ids)
	if err != nil {
		return cardDetail{}, err
	}

	checklist := make([]checklistItemDTO, 0, len(checklistRows))
	for _, c := range checklistRows {
		checklist = append(checklist, checklistItemDTO{ID: c.ID.String(), Text: c.Text, Done: c.Done, Position: c.Position})
	}
	links := make([]linkDTO, 0, len(linkRows))
	for _, l := range linkRows {
		links = append(links, linkDTO{ID: l.ID.String(), URL: l.Url, Label: l.Label})
	}
	var minutes float64
	if len(minutesRows) > 0 {
		minutes = minutesRows[0].Minutes
	}

	active, err := h.q.GetActiveStudySession(r.Context(), middleware.UserID(r))
	timerRunning := err == nil && active.CardID == card.ID

	var archivedAt *string
	if card.ArchivedAt.Valid {
		s := card.ArchivedAt.Time.Format(time.RFC3339)
		archivedAt = &s
	}

	return cardDetail{
		cardSummary: cardSummary{
			ID:           card.ID.String(),
			CourseID:     card.CourseID.String(),
			CourseCode:   card.CourseCode,
			CourseName:   card.CourseName,
			StrategyID:   pgUUIDToStringPtr(card.StrategyID),
			StrategyName: card.StrategyName,
			Title:        card.Title,
			Description:  card.Description,
			Stage:        string(card.Stage),
			Position:     card.Position,
			Difficulty:   string(card.Difficulty),
			Priority:     string(card.Priority),
			PreTest:      numericToFloat(card.PreTest),
			PostTest:     numericToFloat(card.PostTest),
			Rating:       card.Rating,
			CreatedAt:    card.CreatedAt.Time.Format(time.RFC3339),
		},
		PriorKnowledge: card.PriorKnowledge,
		Notes:          card.Notes,
		ArchivedAt:     archivedAt,
		ArchiveReason:  card.ArchiveReason,
		Checklist:      checklist,
		Links:          links,
		StudyMinutes:   minutes,
		TimerRunning:   timerRunning,
	}, nil
}

// ---- PATCH /api/cards/{id} ----
//
// Stage gating (mirrors the thesis UX, enforced here so the API can't be
// bypassed even if the UI allows it):
//   - prior_knowledge: planning only
//   - pre_test:        everywhere except reflection
//   - post_test, notes: controlling or reflection only
//   - rating:          reflection only
// A locked field is rejected only if the request tries to change it; the
// same value silently passing through (e.g. unmodified form state) is fine.

type updateCardRequest struct {
	Description    *string  `json:"description"`
	StrategyID     *string  `json:"strategy_id"`
	Difficulty     *string  `json:"difficulty"`
	Priority       *string  `json:"priority"`
	PreTest        *float64 `json:"pre_test"`
	PostTest       *float64 `json:"post_test"`
	PriorKnowledge *string  `json:"prior_knowledge"`
	Notes          *string  `json:"notes"`
	Rating         *int16   `json:"rating"`
}

var validDifficulty = map[string]sqlcgen.Difficulty{
	"easy": sqlcgen.DifficultyEasy, "medium": sqlcgen.DifficultyMedium,
	"hard": sqlcgen.DifficultyHard, "expert": sqlcgen.DifficultyExpert,
}
var validPriority = map[string]sqlcgen.Priority{
	"low": sqlcgen.PriorityLow, "medium": sqlcgen.PriorityMedium,
	"high": sqlcgen.PriorityHigh, "critical": sqlcgen.PriorityCritical,
}

func (h *CardHandler) UpdateCard(w http.ResponseWriter, r *http.Request) {
	cardID, err := uuid.Parse(r.PathValue("id"))
	if err != nil {
		httpx.Error(w, http.StatusBadRequest, "invalid card id")
		return
	}
	userID := middleware.UserID(r)

	existing, err := h.q.GetCard(r.Context(), sqlcgen.GetCardParams{ID: cardID, UserID: userID})
	if err != nil {
		httpx.Error(w, http.StatusNotFound, "card not found")
		return
	}

	var req updateCardRequest
	if err := httpx.Decode(r, &req); err != nil {
		httpx.Error(w, http.StatusBadRequest, "invalid request body")
		return
	}

	stage := string(existing.Stage)

	if req.PriorKnowledge != nil && stage != "planning" {
		httpx.Error(w, http.StatusBadRequest, "prior knowledge is only editable in Planning")
		return
	}
	if req.PreTest != nil && stage == "reflection" {
		httpx.Error(w, http.StatusBadRequest, "pre-test is not editable in Reflection")
		return
	}
	if (req.PostTest != nil || req.Notes != nil) && stage != "controlling" && stage != "reflection" {
		httpx.Error(w, http.StatusBadRequest, "post-test and notes are only editable in Controlling or Reflection")
		return
	}
	if req.Rating != nil && stage != "reflection" {
		httpx.Error(w, http.StatusBadRequest, "rating is only editable in Reflection")
		return
	}

	params := sqlcgen.UpdateCardDetailParams{
		ID:             cardID,
		UserID:         userID,
		Description:    existing.Description,
		StrategyID:     existing.StrategyID,
		Difficulty:     existing.Difficulty,
		Priority:       existing.Priority,
		PreTest:        existing.PreTest,
		PostTest:       existing.PostTest,
		PriorKnowledge: existing.PriorKnowledge,
		Notes:          existing.Notes,
		Rating:         existing.Rating,
	}

	if req.Description != nil {
		params.Description = *req.Description
	}
	if req.StrategyID != nil {
		sid, err := uuidPtrToPgtype(req.StrategyID)
		if err != nil {
			httpx.Error(w, http.StatusBadRequest, "invalid strategy_id")
			return
		}
		params.StrategyID = sid
	}
	if req.Difficulty != nil {
		d, ok := validDifficulty[*req.Difficulty]
		if !ok {
			httpx.Error(w, http.StatusBadRequest, "invalid difficulty")
			return
		}
		params.Difficulty = d
	}
	if req.Priority != nil {
		p, ok := validPriority[*req.Priority]
		if !ok {
			httpx.Error(w, http.StatusBadRequest, "invalid priority")
			return
		}
		params.Priority = p
	}
	if req.PreTest != nil {
		params.PreTest = floatToNumeric(req.PreTest)
	}
	if req.PostTest != nil {
		params.PostTest = floatToNumeric(req.PostTest)
	}
	if req.PriorKnowledge != nil {
		params.PriorKnowledge = *req.PriorKnowledge
	}
	if req.Notes != nil {
		params.Notes = *req.Notes
	}
	if req.Rating != nil {
		if *req.Rating < 1 || *req.Rating > 5 {
			httpx.Error(w, http.StatusBadRequest, "rating must be between 1 and 5")
			return
		}
		params.Rating = req.Rating
	}

	if _, err := h.q.UpdateCardDetail(r.Context(), params); err != nil {
		httpx.Error(w, http.StatusInternalServerError, "failed to update card")
		return
	}

	detail, err := h.buildCardDetail(r, cardID, userID)
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, "failed to load card")
		return
	}
	httpx.JSON(w, http.StatusOK, detail)
}
