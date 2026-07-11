package appserver

import (
	"bytes"
	"encoding/json"
	"io"
	"strings"
	"testing"
	"time"
)

func TestClientHandleLineDeliversResponse(t *testing.T) {
	client := New(Config{})
	ch := make(chan rpcResult, 1)
	client.pending[`"req-1"`] = ch

	client.handleLine([]byte(`{"id":"req-1","result":{"ok":true}}`))

	select {
	case result := <-ch:
		if result.err != nil {
			t.Fatalf("response error = %v", result.err)
		}
		var body map[string]bool
		if err := json.Unmarshal(result.result, &body); err != nil {
			t.Fatalf("decode response: %v", err)
		}
		if !body["ok"] {
			t.Fatalf("response body = %#v, want ok=true", body)
		}
	case <-time.After(time.Second):
		t.Fatalf("response was not delivered")
	}
}

func TestClientHandleLinePublishesNotification(t *testing.T) {
	client := New(Config{})
	events, unsubscribe := client.Subscribe()
	defer unsubscribe()

	client.handleLine([]byte(`{"method":"thread/status/changed","params":{"threadId":"thread-1","status":{"type":"idle"}}}`))

	select {
	case event := <-events:
		var params ThreadStatusChangedNotification
		if err := json.Unmarshal(event.Params, &params); err != nil {
			t.Fatalf("decode notification params: %v", err)
		}
		if event.Method != "thread/status/changed" || params.ThreadID != "thread-1" {
			t.Fatalf("notification = %#v", event)
		}
	case <-time.After(time.Second):
		t.Fatalf("notification was not published")
	}
}

func TestClientHandleLineRejectsServerRequest(t *testing.T) {
	client := New(Config{})
	stdin := &captureWriteCloser{}
	client.stdin = stdin

	client.handleLine([]byte(`{"id":"server-1","method":"item/commandExecution/requestApproval","params":{"threadId":"thread-1","turnId":"turn-1","itemId":"command-1","startedAtMs":1000,"approvalId":null,"environmentId":null,"reason":null,"networkApprovalContext":null,"command":"git status","cwd":"/workspace","commandActions":[],"proposedExecpolicyAmendment":null,"proposedNetworkPolicyAmendments":null}}`))

	written := stdin.String()
	if !strings.Contains(written, `"id":"server-1"`) || !strings.Contains(written, `"unsupported server request: item/commandExecution/requestApproval"`) {
		t.Fatalf("reject reply = %q", written)
	}
}

func TestThreadStartResponseDecodesExperimentalFields(t *testing.T) {
	var response ThreadStartResponse
	err := json.Unmarshal([]byte(`{
		"thread":{"id":"thread-1","extra":null,"sessionId":"thread-1","forkedFromId":null,"parentThreadId":null,"preview":"","ephemeral":false,"historyMode":"legacy","modelProvider":"openai","createdAt":1,"updatedAt":1,"recencyAt":null,"status":{"type":"idle"},"path":null,"cwd":"/workspace","cliVersion":"0.144.1","source":"appServer","threadSource":"codexWeb","agentNickname":null,"agentRole":null,"gitInfo":null,"name":null,"turns":[]},
		"model":"gpt-5.5","modelProvider":"openai","serviceTier":null,"cwd":"/workspace",
		"runtimeWorkspaceRoots":["/workspace"],"instructionSources":["/root/.codex/AGENTS.md"],
		"approvalPolicy":"on-request","approvalsReviewer":"user","sandbox":{"type":"workspaceWrite"},
		"activePermissionProfile":{"id":":workspace","extends":null},"reasoningEffort":"high","multiAgentMode":"explicitRequestOnly"
	}`), &response)
	if err != nil {
		t.Fatalf("decode thread/start response: %v", err)
	}
	if len(response.RuntimeWorkspaceRoots) != 1 || string(response.ActivePermissionProfile) != `{"id":":workspace","extends":null}` || string(response.MultiAgentMode) != `"explicitRequestOnly"` {
		t.Fatalf("thread/start response = %#v", response)
	}
}

func TestThreadResumeResponseDecodesInitialTurnsPage(t *testing.T) {
	var response ThreadResumeResponse
	err := json.Unmarshal([]byte(`{
		"thread":{"id":"thread-1","extra":null,"sessionId":"thread-1","forkedFromId":null,"parentThreadId":null,"preview":"","ephemeral":false,"historyMode":"legacy","modelProvider":"openai","createdAt":1,"updatedAt":1,"recencyAt":null,"status":{"type":"idle"},"path":null,"cwd":"/workspace","cliVersion":"0.144.1","source":"appServer","threadSource":null,"agentNickname":null,"agentRole":null,"gitInfo":null,"name":null,"turns":[]},
		"model":"gpt-5.5","modelProvider":"openai","serviceTier":null,"cwd":"/workspace",
		"runtimeWorkspaceRoots":[],"instructionSources":[],"approvalPolicy":"on-request","approvalsReviewer":"user",
		"sandbox":{"type":"workspaceWrite"},"activePermissionProfile":null,"reasoningEffort":null,
		"multiAgentMode":"explicitRequestOnly","initialTurnsPage":{"data":[],"nextCursor":null,"backwardsCursor":null}
	}`), &response)
	if err != nil {
		t.Fatalf("decode thread/resume response: %v", err)
	}
	if string(response.InitialTurnsPage) != `{"data":[],"nextCursor":null,"backwardsCursor":null}` {
		t.Fatalf("initialTurnsPage = %s", response.InitialTurnsPage)
	}
}

type captureWriteCloser struct {
	bytes.Buffer
}

func (c *captureWriteCloser) Close() error {
	return nil
}

var _ io.WriteCloser = (*captureWriteCloser)(nil)
