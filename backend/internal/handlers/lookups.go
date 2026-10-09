package handlers

import (
	"net/http"

	sqlcgen "github.com/mailbau/momentum/backend/internal/db/sqlc"
	"github.com/mailbau/momentum/backend/internal/httpx"
)

type LookupHandler struct {
	q *sqlcgen.Queries
}

func NewLookupHandler(q *sqlcgen.Queries) *LookupHandler {
	return &LookupHandler{q: q}
}

func (lh *LookupHandler) ListCourses(w http.ResponseWriter, r *http.Request) {
	rows, err := lh.q.ListCourses(r.Context())
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, "failed to load courses")
		return
	}
	out := make([]map[string]string, 0, len(rows))
	for _, c := range rows {
		out = append(out, map[string]string{"id": c.ID.String(), "code": c.Code, "name": c.Name})
	}
	httpx.JSON(w, http.StatusOK, out)
}

func (lh *LookupHandler) ListStrategies(w http.ResponseWriter, r *http.Request) {
	rows, err := lh.q.ListStrategies(r.Context())
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, "failed to load strategies")
		return
	}
	out := make([]map[string]string, 0, len(rows))
	for _, s := range rows {
		out = append(out, map[string]string{"id": s.ID.String(), "name": s.Name, "description": s.Description})
	}
	httpx.JSON(w, http.StatusOK, out)
}
