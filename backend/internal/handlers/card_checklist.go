package handlers

import (
	"net/http"
	"strings"

	"github.com/google/uuid"
	sqlcgen "github.com/mailbau/momentum/backend/internal/db/sqlc"
	"github.com/mailbau/momentum/backend/internal/httpx"
	"github.com/mailbau/momentum/backend/internal/middleware"
)

// ownsCard confirms the signed-in user owns the given card before letting
// them touch its checklist items or links (those tables only key off card_id,
// so this is the IDOR guard).
func (h *CardHandler) ownsCard(r *http.Request, cardID uuid.UUID) bool {
	_, err := h.q.GetCard(r.Context(), sqlcgen.GetCardParams{ID: cardID, UserID: middleware.UserID(r)})
	return err == nil
}

// ---- Checklist ----

type createChecklistItemRequest struct {
	Text string `json:"text"`
}

func (h *CardHandler) CreateChecklistItem(w http.ResponseWriter, r *http.Request) {
	cardID, err := uuid.Parse(r.PathValue("id"))
	if err != nil || !h.ownsCard(r, cardID) {
		httpx.Error(w, http.StatusNotFound, "card not found")
		return
	}
	var req createChecklistItemRequest
	if err := httpx.Decode(r, &req); err != nil {
		httpx.Error(w, http.StatusBadRequest, "invalid request body")
		return
	}
	req.Text = strings.TrimSpace(req.Text)
	if req.Text == "" {
		httpx.Error(w, http.StatusBadRequest, "text is required")
		return
	}

	pos, err := h.q.NextChecklistPosition(r.Context(), cardID)
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, "failed to add checklist item")
		return
	}
	item, err := h.q.CreateChecklistItem(r.Context(), sqlcgen.CreateChecklistItemParams{
		CardID: cardID, Text: req.Text, Position: pos,
	})
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, "failed to add checklist item")
		return
	}
	httpx.JSON(w, http.StatusCreated, checklistItemDTO{ID: item.ID.String(), Text: item.Text, Done: item.Done, Position: item.Position})
}

type updateChecklistItemRequest struct {
	Text string `json:"text"`
	Done bool   `json:"done"`
}

func (h *CardHandler) UpdateChecklistItem(w http.ResponseWriter, r *http.Request) {
	cardID, err := uuid.Parse(r.PathValue("id"))
	if err != nil || !h.ownsCard(r, cardID) {
		httpx.Error(w, http.StatusNotFound, "card not found")
		return
	}
	itemID, err := uuid.Parse(r.PathValue("itemId"))
	if err != nil {
		httpx.Error(w, http.StatusBadRequest, "invalid item id")
		return
	}
	var req updateChecklistItemRequest
	if err := httpx.Decode(r, &req); err != nil {
		httpx.Error(w, http.StatusBadRequest, "invalid request body")
		return
	}

	item, err := h.q.UpdateChecklistItem(r.Context(), sqlcgen.UpdateChecklistItemParams{
		ID: itemID, Text: req.Text, Done: req.Done,
	})
	if err != nil {
		httpx.Error(w, http.StatusNotFound, "checklist item not found")
		return
	}
	httpx.JSON(w, http.StatusOK, checklistItemDTO{ID: item.ID.String(), Text: item.Text, Done: item.Done, Position: item.Position})
}

func (h *CardHandler) DeleteChecklistItem(w http.ResponseWriter, r *http.Request) {
	cardID, err := uuid.Parse(r.PathValue("id"))
	if err != nil || !h.ownsCard(r, cardID) {
		httpx.Error(w, http.StatusNotFound, "card not found")
		return
	}
	itemID, err := uuid.Parse(r.PathValue("itemId"))
	if err != nil {
		httpx.Error(w, http.StatusBadRequest, "invalid item id")
		return
	}
	if err := h.q.DeleteChecklistItem(r.Context(), itemID); err != nil {
		httpx.Error(w, http.StatusInternalServerError, "failed to delete checklist item")
		return
	}
	httpx.JSON(w, http.StatusOK, map[string]string{"message": "deleted"})
}

// ---- Links ----

type createLinkRequest struct {
	URL   string `json:"url"`
	Label string `json:"label"`
}

func (h *CardHandler) CreateLink(w http.ResponseWriter, r *http.Request) {
	cardID, err := uuid.Parse(r.PathValue("id"))
	if err != nil || !h.ownsCard(r, cardID) {
		httpx.Error(w, http.StatusNotFound, "card not found")
		return
	}
	var req createLinkRequest
	if err := httpx.Decode(r, &req); err != nil {
		httpx.Error(w, http.StatusBadRequest, "invalid request body")
		return
	}
	req.URL = strings.TrimSpace(req.URL)
	if req.URL == "" || !strings.HasPrefix(req.URL, "http") {
		httpx.Error(w, http.StatusBadRequest, "a valid url is required")
		return
	}

	link, err := h.q.CreateCardLink(r.Context(), sqlcgen.CreateCardLinkParams{
		CardID: cardID, Url: req.URL, Label: req.Label,
	})
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, "failed to add link")
		return
	}
	httpx.JSON(w, http.StatusCreated, linkDTO{ID: link.ID.String(), URL: link.Url, Label: link.Label})
}

func (h *CardHandler) DeleteLink(w http.ResponseWriter, r *http.Request) {
	cardID, err := uuid.Parse(r.PathValue("id"))
	if err != nil || !h.ownsCard(r, cardID) {
		httpx.Error(w, http.StatusNotFound, "card not found")
		return
	}
	linkID, err := uuid.Parse(r.PathValue("linkId"))
	if err != nil {
		httpx.Error(w, http.StatusBadRequest, "invalid link id")
		return
	}
	if err := h.q.DeleteCardLink(r.Context(), linkID); err != nil {
		httpx.Error(w, http.StatusInternalServerError, "failed to delete link")
		return
	}
	httpx.JSON(w, http.StatusOK, map[string]string{"message": "deleted"})
}
