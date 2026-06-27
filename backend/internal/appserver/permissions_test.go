package appserver

import "testing"

func TestAgentPermissionsMatchExtensionModes(t *testing.T) {
	tests := []struct {
		name              string
		mode              string
		wantSandbox       string
		wantSandboxType   string
		wantApproval      any
		wantReviewer      string
		wantWritableRoots int
	}{
		{
			name:            "full access",
			mode:            "full-access",
			wantSandbox:     "danger-full-access",
			wantSandboxType: "dangerFullAccess",
			wantApproval:    "never",
			wantReviewer:    "user",
		},
		{
			name:            "read only",
			mode:            "read-only",
			wantSandbox:     "read-only",
			wantSandboxType: "readOnly",
			wantApproval:    "on-request",
			wantReviewer:    "user",
		},
		{
			name:              "auto",
			mode:              "auto",
			wantSandbox:       "workspace-write",
			wantSandboxType:   "workspaceWrite",
			wantApproval:      "on-request",
			wantReviewer:      "user",
			wantWritableRoots: 1,
		},
		{
			name:              "granular",
			mode:              "granular",
			wantSandbox:       "workspace-write",
			wantSandboxType:   "workspaceWrite",
			wantApproval:      "granular",
			wantReviewer:      "user",
			wantWritableRoots: 1,
		},
		{
			name:              "guardian approvals",
			mode:              "guardian-approvals",
			wantSandbox:       "workspace-write",
			wantSandboxType:   "workspaceWrite",
			wantApproval:      "on-request",
			wantReviewer:      "auto_review",
			wantWritableRoots: 1,
		},
		{
			name:              "empty uses default sandboxed permissions",
			mode:              "",
			wantSandbox:       "workspace-write",
			wantSandboxType:   "workspaceWrite",
			wantApproval:      "on-request",
			wantReviewer:      "user",
			wantWritableRoots: 1,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := agentPermissions(tt.mode, "/root/my_code")
			if got.Sandbox != tt.wantSandbox {
				t.Fatalf("sandbox = %q, want %q", got.Sandbox, tt.wantSandbox)
			}
			if got.SandboxPolicy["type"] != tt.wantSandboxType {
				t.Fatalf("sandboxPolicy.type = %q, want %q", got.SandboxPolicy["type"], tt.wantSandboxType)
			}
			if got.ApprovalsReviewer != tt.wantReviewer {
				t.Fatalf("reviewer = %q, want %q", got.ApprovalsReviewer, tt.wantReviewer)
			}
			if tt.wantApproval == "granular" {
				policy, ok := got.ApprovalPolicy.(map[string]any)
				if !ok || policy["granular"] == nil {
					t.Fatalf("approvalPolicy = %#v, want granular object", got.ApprovalPolicy)
				}
			} else if got.ApprovalPolicy != tt.wantApproval {
				t.Fatalf("approvalPolicy = %#v, want %#v", got.ApprovalPolicy, tt.wantApproval)
			}
			if tt.wantWritableRoots > 0 {
				roots, ok := got.SandboxPolicy["writableRoots"].([]string)
				if !ok || len(roots) != tt.wantWritableRoots || roots[0] != "/root/my_code" {
					t.Fatalf("writableRoots = %#v", got.SandboxPolicy["writableRoots"])
				}
			}
		})
	}
}
