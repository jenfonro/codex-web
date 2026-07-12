package thread

import "codex-web/backend/internal/appserver"

type Summary struct {
	ID        string                 `json:"id"`
	Preview   string                 `json:"preview"`
	UpdatedAt int64                  `json:"updatedAt"`
	Status    appserver.ThreadStatus `json:"status"`
	Name      *string                `json:"name"`
}

type History struct {
	Turns []appserver.Turn `json:"turns"`
}

type Snapshot struct {
	Thread  Summary `json:"thread"`
	History History `json:"history"`
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

func turnsFromResponse(response appserver.ThreadTurnsListResponse) []appserver.Turn {
	turns := make([]appserver.Turn, len(response.Data))
	for index := range response.Data {
		turns[len(response.Data)-1-index] = cloneTurn(response.Data[index])
	}
	return turns
}

func cloneHistory(turns []appserver.Turn) History {
	history := History{
		Turns: make([]appserver.Turn, len(turns)),
	}
	for index := range turns {
		history.Turns[index] = cloneTurn(turns[index])
	}
	return history
}
