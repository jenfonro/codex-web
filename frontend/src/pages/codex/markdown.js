"use strict";

(function defineCodexMarkdown(global) {
  const MarkdownIt = global.markdownit;
  if (!MarkdownIt) {
    throw new Error("markdown-it is required before CodexMarkdown");
  }

  const markdown = MarkdownIt({
    breaks: false,
    html: false,
    linkify: true,
    typographer: false,
  });

  const defaultLinkOpen = markdown.renderer.rules.link_open || renderToken;
  markdown.renderer.rules.link_open = (tokens, index, options, env, renderer) => {
    const token = tokens[index];
    token.attrSet("target", "_blank");
    token.attrSet("rel", "noopener noreferrer");
    return defaultLinkOpen(tokens, index, options, env, renderer);
  };

  function renderToken(tokens, index, options, env, renderer) {
    return renderer.renderToken(tokens, index, options);
  }

  function render(text, options = {}) {
    const source = String(text || "");
    const variant = options.variant ? ` codex-markdown-${options.variant}` : "";
    const body = markdown.render(source);
    return `<div class="codex-markdown${variant}">${body}</div>`;
  }

  global.CodexMarkdown = {
    render,
  };
})(window);
