package thread

import (
	"bufio"
	"encoding/json"
	"os"
	"path/filepath"
	"strings"

	"codex-web/backend/internal/appserver"
)

type sessionLine struct {
	Type    string          `json:"type"`
	Payload json.RawMessage `json:"payload"`
}

type sessionTurnContext struct {
	TurnID string `json:"turn_id"`
}

type sessionEvent struct {
	Type        string `json:"type"`
	TurnID      string `json:"turn_id"`
	Message     string `json:"message"`
	StartedAt   *int64 `json:"started_at"`
	CompletedAt *int64 `json:"completed_at"`
	DurationMs  *int64 `json:"duration_ms"`
}

type sessionResponseItem struct {
	Type     string           `json:"type"`
	ID       string           `json:"id"`
	Role     string           `json:"role"`
	Content  []sessionContent `json:"content"`
	Phase    *string          `json:"phase"`
	Metadata sessionTurn      `json:"internal_chat_message_metadata_passthrough"`
}

type sessionTurn struct {
	TurnID string `json:"turn_id"`
}

type sessionContent struct {
	Type string `json:"type"`
	Text string `json:"text"`
}

type jsonlTurnBuilder struct {
	turn  appserver.Turn
	seen  bool
	index int
}

func needsSessionJSONLFallback(turns []appserver.Turn) bool {
	if len(turns) == 0 {
		return false
	}
	for _, turn := range turns {
		if turn.ItemsView == "notLoaded" || len(turn.Items) == 0 {
			return true
		}
	}
	return false
}

func loadTurnsFromSessionJSONL(codexHome, threadID string) ([]appserver.Turn, error) {
	path, err := findSessionJSONL(codexHome, threadID)
	if err != nil || path == "" {
		return nil, err
	}
	return parseSessionJSONL(path)
}

func findSessionJSONL(codexHome, threadID string) (string, error) {
	root := filepath.Join(codexHome, "sessions")
	suffix := "-" + threadID + ".jsonl"
	var match string
	err := filepath.WalkDir(root, func(path string, entry os.DirEntry, err error) error {
		if err != nil || entry.IsDir() {
			return nil
		}
		if strings.HasSuffix(entry.Name(), suffix) {
			match = path
			return filepath.SkipAll
		}
		return nil
	})
	return match, err
}

func parseSessionJSONL(path string) ([]appserver.Turn, error) {
	file, err := os.Open(path)
	if err != nil {
		return nil, err
	}
	defer file.Close()

	builders := map[string]*jsonlTurnBuilder{}
	var order []string
	currentTurnID := ""

	scanner := bufio.NewScanner(file)
	buffer := make([]byte, 0, 64*1024)
	scanner.Buffer(buffer, 8*1024*1024)
	for scanner.Scan() {
		var line sessionLine
		if err := json.Unmarshal(scanner.Bytes(), &line); err != nil {
			continue
		}
		switch line.Type {
		case "turn_context":
			var payload sessionTurnContext
			if json.Unmarshal(line.Payload, &payload) == nil && payload.TurnID != "" {
				currentTurnID = payload.TurnID
				ensureJSONLTurn(builders, &order, payload.TurnID)
			}
		case "event_msg":
			var payload sessionEvent
			if json.Unmarshal(line.Payload, &payload) != nil {
				continue
			}
			if payload.TurnID != "" {
				currentTurnID = payload.TurnID
			}
			applySessionEvent(builders, &order, currentTurnID, payload)
		case "response_item":
			var payload sessionResponseItem
			if json.Unmarshal(line.Payload, &payload) != nil {
				continue
			}
			turnID := payload.Metadata.TurnID
			if turnID == "" {
				turnID = currentTurnID
			}
			if turnID == "" {
				continue
			}
			currentTurnID = turnID
			applySessionResponseItem(builders, &order, turnID, payload)
		}
	}
	if err := scanner.Err(); err != nil {
		return nil, err
	}

	turns := make([]appserver.Turn, 0, len(order))
	for _, turnID := range order {
		builder := builders[turnID]
		if builder == nil || !builder.seen {
			continue
		}
		turns = append(turns, builder.turn)
	}
	return turns, nil
}

func applySessionEvent(builders map[string]*jsonlTurnBuilder, order *[]string, turnID string, payload sessionEvent) {
	if turnID == "" {
		return
	}
	builder := ensureJSONLTurn(builders, order, turnID)
	switch payload.Type {
	case "task_started":
		builder.turn.Status = "inProgress"
		builder.turn.StartedAt = payload.StartedAt
	case "task_complete":
		builder.turn.Status = "completed"
		builder.turn.CompletedAt = payload.CompletedAt
		builder.turn.DurationMs = payload.DurationMs
	case "user_message":
		if strings.TrimSpace(payload.Message) == "" {
			return
		}
		builder.turn.Items = append(builder.turn.Items, encodeJSON(userMessageItemFromSession(turnID, builder.index, payload.Message)))
		builder.index++
		builder.seen = true
	}
}

func applySessionResponseItem(builders map[string]*jsonlTurnBuilder, order *[]string, turnID string, payload sessionResponseItem) {
	if payload.Type != "message" || payload.Role != "assistant" {
		return
	}
	text := textFromSessionContent(payload.Content, "output_text")
	if strings.TrimSpace(text) == "" {
		return
	}
	builder := ensureJSONLTurn(builders, order, turnID)
	builder.turn.Items = append(builder.turn.Items, encodeJSON(agentMessageItemFromSession(turnID, builder.index, payload.ID, text, payload.Phase)))
	builder.index++
	builder.seen = true
}

func ensureJSONLTurn(builders map[string]*jsonlTurnBuilder, order *[]string, turnID string) *jsonlTurnBuilder {
	if builder := builders[turnID]; builder != nil {
		return builder
	}
	builder := &jsonlTurnBuilder{
		turn: appserver.Turn{
			ID:        turnID,
			ItemsView: "full",
			Status:    "completed",
		},
	}
	builders[turnID] = builder
	*order = append(*order, turnID)
	return builder
}

func userMessageItemFromSession(turnID string, index int, text string) map[string]any {
	return map[string]any{
		"type":     "userMessage",
		"id":       turnID + "-user-" + intToString(index),
		"clientId": nil,
		"content": []any{
			map[string]any{"type": "text", "text": text, "text_elements": []any{}},
		},
	}
}

func agentMessageItemFromSession(turnID string, index int, id string, text string, phase *string) map[string]any {
	if id == "" {
		id = turnID + "-assistant-" + intToString(index)
	}
	return map[string]any{
		"type":           "agentMessage",
		"id":             id,
		"text":           text,
		"phase":          phase,
		"memoryCitation": nil,
	}
}

func textFromSessionContent(content []sessionContent, contentType string) string {
	var parts []string
	for _, part := range content {
		if part.Type == contentType && part.Text != "" {
			parts = append(parts, part.Text)
		}
	}
	return strings.Join(parts, "\n")
}

func intToString(value int) string {
	const digits = "0123456789"
	if value == 0 {
		return "0"
	}
	var out [20]byte
	index := len(out)
	for value > 0 {
		index--
		out[index] = digits[value%10]
		value /= 10
	}
	return string(out[index:])
}
