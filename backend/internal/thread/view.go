package thread

import "codex-web/backend/internal/appserver"

type Summary struct {
	ID        string                 `json:"id"`
	Preview   string                 `json:"preview"`
	UpdatedAt int64                  `json:"updatedAt"`
	Status    appserver.ThreadStatus `json:"status"`
	Name      *string                `json:"name"`
}

type TurnPage struct {
	Turns      []appserver.Turn `json:"turns"`
	NextCursor *string          `json:"nextCursor"`
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

func turnPage(response appserver.ThreadTurnsListResponse) TurnPage {
	page := TurnPage{
		Turns:      make([]appserver.Turn, len(response.Data)),
		NextCursor: response.NextCursor,
	}
	for index := range response.Data {
		page.Turns[len(response.Data)-1-index] = cloneTurn(response.Data[index])
	}
	return page
}

func cloneTurnPage(turns []appserver.Turn, nextCursor *string) TurnPage {
	page := TurnPage{
		Turns:      make([]appserver.Turn, len(turns)),
		NextCursor: nextCursor,
	}
	for index := range turns {
		page.Turns[index] = cloneTurn(turns[index])
	}
	return page
}
