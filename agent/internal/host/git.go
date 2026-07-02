package host

import (
	"context"
	"fmt"
	"os/exec"
	"path/filepath"
	"strconv"
	"strings"
)

func (s *Service) GitWorker(ctx context.Context, method string, params map[string]any) (any, error) {
	switch method {
	case "stable-metadata":
		return s.gitStableMetadata(ctx, params)
	case "watch-repo", "unwatch-repo", "invalidate-untracked-paths-cache", "invalidate-stable-metadata", "dispose-git-init-watch":
		return map[string]any{"success": true}, nil
	case "current-branch":
		branch, _ := s.gitCurrentBranch(ctx, params)
		return map[string]any{"branch": nullableString(branch)}, nil
	case "upstream-branch":
		upstream, _ := s.gitOutput(ctx, gitCWD(params), "rev-parse", "--abbrev-ref", "--symbolic-full-name", "@{u}")
		return map[string]any{"upstreamBranch": nullableString(upstream)}, nil
	case "branch-ahead-count":
		count := s.gitAheadCount(ctx, params)
		return map[string]any{"commitsAhead": count}, nil
	case "default-branch":
		return map[string]any{"defaultBranch": nullableString(s.gitDefaultBranch(ctx, params))}, nil
	case "base-branch":
		return map[string]any{"baseBranch": nullableString(s.gitDefaultBranch(ctx, params))}, nil
	case "recent-branches", "search-branches":
		return map[string]any{"branches": s.gitBranches(ctx, params)}, nil
	case "branch-commits":
		return map[string]any{"commits": []any{}}, nil
	case "nearest-ancestor-branch":
		return map[string]any{"branch": nullableString(s.gitDefaultBranch(ctx, params))}, nil
	case "branch-metadata":
		return s.gitBranchMetadata(ctx, params), nil
	case "status-summary":
		return s.gitStatusSummary(ctx, params), nil
	case "branch-diff-stats":
		summary, err := s.gitReviewSummary(ctx, params)
		if err != nil {
			return map[string]any{"type": "error", "error": err.Error()}, nil
		}
		return map[string]any{
			"type":      "success",
			"additions": sumIntField(summary, "additions"),
			"deletions": sumIntField(summary, "deletions"),
			"files":     summary["files"],
		}, nil
	case "review-summary", "review-path-summary":
		return s.gitReviewSummary(ctx, params)
	case "review-patch":
		diff, err := s.gitReviewPatch(ctx, params)
		if err != nil {
			return map[string]any{"diff": map[string]any{"type": "error", "error": err.Error()}}, nil
		}
		return map[string]any{"diff": map[string]any{"type": "success", "unifiedDiff": diff}}, nil
	case "review-diff":
		return s.gitReviewDiff(ctx, params)
	case "review-search":
		return s.gitReviewSearch(ctx, params)
	case "tracked-uncommitted-changes":
		return map[string]any{"type": "success", "files": []any{}}, nil
	case "index-info":
		return map[string]any{"hasStagedChanges": s.gitHasStagedChanges(ctx, params)}, nil
	case "submodule-paths":
		return map[string]any{"paths": []any{}}, nil
	case "git-origins":
		return map[string]any{"origins": []any{}}, nil
	case "config-value":
		return map[string]any{"value": nil}, nil
	case "set-config-value", "set-worktree-owner-thread", "restore-worktree":
		return map[string]any{"success": false}, nil
	case "list-worktrees", "codex-worktrees":
		return map[string]any{"worktrees": []any{}}, nil
	case "resolve-worktree-for-thread", "move-thread-to-local", "move-thread-to-worktree", "apply-review-section-changes", "apply-changes", "commit":
		return nil, fmt.Errorf("Unknown method: %s", method)
	default:
		return nil, fmt.Errorf("Unknown method: %s", method)
	}
}

func (s *Service) gitStableMetadata(ctx context.Context, params map[string]any) (any, error) {
	cwd := gitCWD(params)
	root, err := s.gitOutput(ctx, cwd, "rev-parse", "--show-toplevel")
	if err != nil || root == "" {
		return nil, nil
	}
	commonDir, err := s.gitOutput(ctx, root, "rev-parse", "--git-common-dir")
	if err != nil {
		return nil, nil
	}
	if commonDir != "" && !filepath.IsAbs(commonDir) {
		commonDir = filepath.Clean(filepath.Join(root, commonDir))
	}
	return map[string]any{"commonDir": commonDir, "root": root}, nil
}

func (s *Service) gitCurrentBranch(ctx context.Context, params map[string]any) (string, error) {
	branch, err := s.gitOutput(ctx, gitCWD(params), "branch", "--show-current")
	if err == nil && branch != "" {
		return branch, nil
	}
	return s.gitOutput(ctx, gitCWD(params), "rev-parse", "--abbrev-ref", "HEAD")
}

func (s *Service) gitDefaultBranch(ctx context.Context, params map[string]any) string {
	cwd := gitCWD(params)
	for _, ref := range []string{"origin/HEAD", "main", "master"} {
		out, err := s.gitOutput(ctx, cwd, "rev-parse", "--abbrev-ref", ref)
		if err != nil || out == "" {
			continue
		}
		out = strings.TrimPrefix(out, "origin/")
		if out != "HEAD" {
			return out
		}
	}
	return ""
}

func (s *Service) gitAheadCount(ctx context.Context, params map[string]any) int {
	cwd := gitCWD(params)
	out, err := s.gitOutput(ctx, cwd, "rev-list", "--count", "@{u}..HEAD")
	if err != nil {
		return 0
	}
	count, _ := strconv.Atoi(strings.TrimSpace(out))
	return count
}

func (s *Service) gitBranches(ctx context.Context, params map[string]any) []map[string]any {
	limit := IntAny(params["limit"])
	if limit <= 0 {
		limit = 30
	}
	out, err := s.gitOutput(ctx, gitCWD(params), "for-each-ref", "--sort=-committerdate", "--format=%(refname:short)", "refs/heads")
	if err != nil {
		return []map[string]any{}
	}
	lines := strings.Split(out, "\n")
	branches := make([]map[string]any, 0, minInt(len(lines), limit))
	for _, line := range lines {
		name := strings.TrimSpace(line)
		if name == "" {
			continue
		}
		branches = append(branches, map[string]any{"name": name})
		if len(branches) >= limit {
			break
		}
	}
	return branches
}

func (s *Service) gitBranchMetadata(ctx context.Context, params map[string]any) map[string]any {
	metadata, _ := s.gitStableMetadata(ctx, params)
	var root string
	if m, ok := metadata.(map[string]any); ok {
		root = StrAny(m["root"])
	}
	branch, _ := s.gitCurrentBranch(ctx, params)
	defaultBranch := s.gitDefaultBranch(ctx, params)
	upstream, _ := s.gitOutput(ctx, gitCWD(params), "rev-parse", "--abbrev-ref", "--symbolic-full-name", "@{u}")
	return map[string]any{
		"currentBranch":  nullableString(branch),
		"defaultBranch":  nullableString(defaultBranch),
		"baseBranch":     nullableString(defaultBranch),
		"upstreamBranch": nullableString(upstream),
		"gitRoot":        nullableString(root),
	}
}

func (s *Service) gitStatusSummary(ctx context.Context, params map[string]any) map[string]any {
	out, err := s.gitOutput(ctx, gitCWD(params), "status", "--porcelain=v1")
	if err != nil {
		return map[string]any{"type": "error", "error": err.Error()}
	}
	counts := map[string]int{"staged": 0, "unstaged": 0, "untracked": 0}
	for _, line := range strings.Split(out, "\n") {
		if strings.TrimSpace(line) == "" {
			continue
		}
		if strings.HasPrefix(line, "??") {
			counts["untracked"]++
			continue
		}
		if len(line) >= 2 {
			if line[0] != ' ' {
				counts["staged"]++
			}
			if line[1] != ' ' {
				counts["unstaged"]++
			}
		}
	}
	return map[string]any{
		"type":        "success",
		"stageCounts": counts,
		"hasChanges":  counts["staged"]+counts["unstaged"]+counts["untracked"] > 0,
	}
}

func (s *Service) gitReviewSummary(ctx context.Context, params map[string]any) (map[string]any, error) {
	args := gitDiffArgs(params, "--numstat")
	out, err := s.gitOutput(ctx, gitCWD(params), args...)
	if err != nil {
		return nil, err
	}
	files := []map[string]any{}
	for _, line := range strings.Split(out, "\n") {
		fields := strings.Fields(line)
		if len(fields) < 3 {
			continue
		}
		path := strings.Join(fields[2:], " ")
		files = append(files, map[string]any{
			"path":       path,
			"gitPath":    path,
			"additions":  parseGitNumstat(fields[0]),
			"deletions":  parseGitNumstat(fields[1]),
			"changeType": "modified",
		})
	}
	if shouldIncludeUntracked(params) {
		for _, path := range s.gitUntrackedFiles(ctx, params) {
			files = append(files, map[string]any{
				"path":       path,
				"gitPath":    path,
				"additions":  0,
				"deletions":  0,
				"changeType": "untracked",
			})
		}
	}
	stageCounts := s.gitStatusSummary(ctx, params)["stageCounts"]
	return map[string]any{"type": "success", "files": files, "stageCounts": stageCounts}, nil
}

func (s *Service) gitReviewPatch(ctx context.Context, params map[string]any) (string, error) {
	return s.gitOutput(ctx, gitCWD(params), gitDiffArgs(params, "--patch")...)
}

func (s *Service) gitReviewDiff(ctx context.Context, params map[string]any) (map[string]any, error) {
	files := fileParams(params["files"])
	out := make([]map[string]any, 0, len(files))
	for _, file := range files {
		args := append(gitDiffArgs(params, "--patch"), "--", file.Path)
		diff, err := s.gitOutput(ctx, gitCWD(params), args...)
		if err != nil {
			return nil, err
		}
		out = append(out, map[string]any{"path": file.Path, "gitPath": file.Path, "unifiedDiff": diff})
	}
	return map[string]any{"type": "success", "files": out}, nil
}

func (s *Service) gitReviewSearch(ctx context.Context, params map[string]any) (map[string]any, error) {
	query := strings.TrimSpace(StrAny(params["query"]))
	if query == "" {
		return map[string]any{"matches": []any{}}, nil
	}
	diff, err := s.gitReviewPatch(ctx, params)
	if err != nil {
		return nil, err
	}
	matches := []map[string]any{}
	for _, line := range strings.Split(diff, "\n") {
		if strings.Contains(strings.ToLower(line), strings.ToLower(query)) {
			matches = append(matches, map[string]any{"line": line})
			if len(matches) >= 50 {
				break
			}
		}
	}
	return map[string]any{"matches": matches}, nil
}

func (s *Service) gitHasStagedChanges(ctx context.Context, params map[string]any) bool {
	out, err := s.gitOutput(ctx, gitCWD(params), "diff", "--cached", "--name-only")
	return err == nil && strings.TrimSpace(out) != ""
}

func (s *Service) gitUntrackedFiles(ctx context.Context, params map[string]any) []string {
	out, err := s.gitOutput(ctx, gitCWD(params), "ls-files", "--others", "--exclude-standard")
	if err != nil {
		return nil
	}
	return uniqueStrings(strings.Split(out, "\n"))
}

func (s *Service) gitOutput(ctx context.Context, cwd string, args ...string) (string, error) {
	if cwd == "" {
		cwd = s.rootDir
	}
	dir, err := SafePath(s.rootDir, cwd)
	if err != nil {
		return "", err
	}
	cmdArgs := append([]string{"-C", dir}, args...)
	cmd := exec.CommandContext(ctx, "git", cmdArgs...)
	output, err := cmd.CombinedOutput()
	text := strings.TrimSpace(string(output))
	if err != nil {
		return "", fmt.Errorf("git %s: %s", strings.Join(args, " "), text)
	}
	return text, nil
}

func gitCWD(params map[string]any) string {
	return FirstString(StrAny(params["cwd"]), StrAny(params["repositoryRoot"]), StrAny(params["root"]), StrAny(params["workspaceRoot"]), StrAny(params["localCwd"]))
}

func gitDiffArgs(params map[string]any, mode string) []string {
	source := strings.TrimSpace(StrAny(params["source"]))
	target := strings.TrimSpace(StrAny(params["target"]))
	base := strings.TrimSpace(StrAny(params["base"]))
	head := strings.TrimSpace(StrAny(params["head"]))
	args := []string{"diff"}
	if mode != "" {
		args = append(args, mode)
	}
	switch source {
	case "staged", "index":
		args = append(args, "--cached")
	case "commit":
		if target != "" {
			args = append(args, target+"^!")
		} else if base != "" && head != "" {
			args = append(args, base+".."+head)
		}
	default:
		if base != "" && head != "" {
			args = append(args, base+".."+head)
		} else if target != "" {
			args = append(args, target)
		}
	}
	files := fileParams(params["files"])
	if len(files) > 0 {
		args = append(args, "--")
		for _, file := range files {
			args = append(args, file.Path)
		}
	}
	return args
}

type gitFileParam struct {
	Path string
}

func fileParams(value any) []gitFileParam {
	items, ok := value.([]any)
	if !ok {
		return nil
	}
	out := make([]gitFileParam, 0, len(items))
	for _, item := range items {
		switch v := item.(type) {
		case string:
			if strings.TrimSpace(v) != "" {
				out = append(out, gitFileParam{Path: strings.TrimSpace(v)})
			}
		case map[string]any:
			path := FirstString(StrAny(v["path"]), StrAny(v["gitPath"]))
			if path != "" {
				out = append(out, gitFileParam{Path: path})
			}
		}
	}
	return out
}

func shouldIncludeUntracked(params map[string]any) bool {
	source := strings.TrimSpace(StrAny(params["source"]))
	if source == "staged" || source == "index" || source == "commit" {
		return false
	}
	if value, ok := params["includeUntrackedFiles"].(bool); ok {
		return value
	}
	return source == "" || source == "unstaged" || source == "working-tree"
}

func parseGitNumstat(value string) int {
	n, err := strconv.Atoi(strings.TrimSpace(value))
	if err != nil {
		return 0
	}
	return n
}

func sumIntField(summary map[string]any, field string) int {
	files, ok := summary["files"].([]map[string]any)
	if !ok {
		rawFiles, ok := summary["files"].([]any)
		if !ok {
			return 0
		}
		total := 0
		for _, item := range rawFiles {
			if file, ok := item.(map[string]any); ok {
				total += IntAny(file[field])
			}
		}
		return total
	}
	total := 0
	for _, file := range files {
		total += IntAny(file[field])
	}
	return total
}

func nullableString(value string) any {
	value = strings.TrimSpace(value)
	if value == "" {
		return nil
	}
	return value
}

func minInt(a, b int) int {
	if a < b {
		return a
	}
	return b
}

func uniqueStrings(values []string) []string {
	out := make([]string, 0, len(values))
	seen := map[string]bool{}
	for _, value := range values {
		value = strings.TrimSpace(value)
		if value == "" || seen[value] {
			continue
		}
		seen[value] = true
		out = append(out, value)
	}
	return out
}
