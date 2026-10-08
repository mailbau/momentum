package handlers

import "net/http"

// Ping is a minimal admin-only route used to verify the role middleware.
// Real admin endpoints (courses, strategies, users, activity) land in M5.
func AdminPing(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	w.Write([]byte(`{"message":"pong"}`))
}
