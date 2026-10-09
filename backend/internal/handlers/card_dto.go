package handlers

import (
	"strconv"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgtype"
)

// numericToFloat converts a pgtype.Numeric to *float64 for JSON responses.
func numericToFloat(n pgtype.Numeric) *float64 {
	if !n.Valid {
		return nil
	}
	f, err := n.Float64Value()
	if err != nil || !f.Valid {
		return nil
	}
	return &f.Float64
}

// floatToNumeric converts an optional request float into a pgtype.Numeric.
// pgtype.Numeric.Scan doesn't accept float64 directly, only strings/ints/etc,
// so the value is formatted first.
func floatToNumeric(f *float64) pgtype.Numeric {
	if f == nil {
		return pgtype.Numeric{Valid: false}
	}
	var n pgtype.Numeric
	if err := n.Scan(strconv.FormatFloat(*f, 'f', -1, 64)); err != nil {
		return pgtype.Numeric{Valid: false}
	}
	return n
}

func uuidPtrToPgtype(id *string) (pgtype.UUID, error) {
	if id == nil || *id == "" {
		return pgtype.UUID{Valid: false}, nil
	}
	var u pgtype.UUID
	if err := u.Scan(*id); err != nil {
		return pgtype.UUID{}, err
	}
	return u, nil
}

func pgUUIDToStringPtr(u pgtype.UUID) *string {
	if !u.Valid {
		return nil
	}
	s := uuid.UUID(u.Bytes).String()
	return &s
}
