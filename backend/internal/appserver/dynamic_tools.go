package appserver

import "strings"

func dynamicToolText(success bool, text string) map[string]any {
	return map[string]any{
		"success": success,
		"contentItems": []map[string]any{{
			"type": "inputText",
			"text": text,
		}},
	}
}

func displayDynamicToolName(namespace, tool string) string {
	namespace = strings.TrimSpace(namespace)
	tool = strings.TrimSpace(tool)
	if namespace != "" && tool != "" {
		return namespace + "." + tool
	}
	if tool != "" {
		return tool
	}
	return "unknown"
}
