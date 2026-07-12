package thread

import (
	"fmt"

	"codex-web/backend/internal/appserver"
)

const historyPageSize = 8

type Summary struct {
	ID        string                 `json:"id"`
	Preview   string                 `json:"preview"`
	UpdatedAt int64                  `json:"updatedAt"`
	Status    appserver.ThreadStatus `json:"status"`
	Name      *string                `json:"name"`
}

type TurnPage struct {
	Turns        []appserver.Turn `json:"turns"`
	BeforeTurnID *string          `json:"beforeTurnId"`
}

type Snapshot struct {
	Thread Summary  `json:"thread"`
	Page   TurnPage `json:"page"`
}

func summarize(value appserver.Thread) Summary {
	return Summary{
		ID:        value.ID,
		Preview:   value.Preview,
		UpdatedAt: value.UpdatedAt,
		Status:    value.Status,
		Name:      value.Name,
	}
}

func latestTurnPage(turns []appserver.Turn) TurnPage {
	return turnPageRange(turns, len(turns))
}

func turnPageBefore(turns []appserver.Turn, beforeTurnID string) (TurnPage, error) {
	for index := range turns {
		if turns[index].ID == beforeTurnID {
			return turnPageRange(turns, index), nil
		}
	}
	return TurnPage{}, fmt.Errorf("turn not found: %s", beforeTurnID)
}

func turnPageRange(turns []appserver.Turn, end int) TurnPage {
	start := max(0, end-historyPageSize)
	page := TurnPage{
		Turns: make([]appserver.Turn, end-start),
	}
	for index := start; index < end; index++ {
		page.Turns[index-start] = cloneTurn(turns[index])
	}
	if start > 0 {
		page.BeforeTurnID = &turns[start].ID
	}
	return page
}
