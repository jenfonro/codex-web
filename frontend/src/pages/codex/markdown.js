"use strict";

(function defineCodexMarkdown(global) {
  const MarkdownIt = global.markdownit;
  if (!MarkdownIt) {
    throw new Error("markdown-it is required before CodexMarkdown");
  }

  const classNames = {
    markdownRoot: "_markdownRoot_lzkx4_428",
    markdownContent: "_markdownContent_lzkx4_60",
    paragraph: "_paragraph_lzkx4_82",
    heading: "_heading_lzkx4_107",
    heading1: "_heading1_lzkx4_113",
    heading2: "_heading2_lzkx4_117",
    heading3: "_heading3_lzkx4_121",
    heading4: "_heading4_lzkx4_122",
    heading5: "_heading5_lzkx4_127",
    heading6: "_heading6_lzkx4_128",
    list: "_list_lzkx4_133",
    unorderedList: "_unorderedList_lzkx4_147",
    orderedList: "_orderedList_lzkx4_159",
    taskList: "_taskList_lzkx4_163",
    listItem: "_listItem_lzkx4_168",
    taskListItem: "_taskListItem_lzkx4_199",
    blockquote: "_blockquote_lzkx4_222",
    horizontalRule: "_horizontalRule_lzkx4_263",
    tableContainer: "_tableContainer_lzkx4_275",
    tableWrapper: "_tableWrapper_lzkx4_282",
    table: "_table_lzkx4_275",
    tableRow: "_tableRow_lzkx4_322",
    tableCell: "_tableCell_lzkx4_322",
    tableHeaderCell: "_tableHeaderCell_lzkx4_326",
    tableBody: "_tableBody_lzkx4_360",
    codeBlock: "_codeBlock_lzkx4_364",
    codeBlockPlaceholder: "_codeBlockPlaceholder_lzkx4_371",
    inlineMarkdown: "_inlineMarkdown_lzkx4_385",
  };

  const markdown = MarkdownIt({
    breaks: false,
    html: false,
    linkify: true,
    typographer: false,
  });

  markdown.core.ruler.after("inline", "codex_task_lists", markTaskLists);
  installRendererRules(markdown.renderer);

  function installRendererRules(renderer) {
    renderer.rules.paragraph_open = openWithClass(classNames.paragraph);
    renderer.rules.heading_open = (tokens, index, options, env, activeRenderer) => {
      const token = tokens[index];
      const level = token.tag.replace("h", "");
      token.attrJoin("class", `${classNames.heading} ${classNames[`heading${level}`] || ""}`.trim());
      return activeRenderer.renderToken(tokens, index, options);
    };
    renderer.rules.bullet_list_open = openWithClass(`${classNames.list} ${classNames.unorderedList}`);
    renderer.rules.ordered_list_open = openWithClass(`${classNames.list} ${classNames.orderedList}`);
    renderer.rules.list_item_open = openWithClass(classNames.listItem);
    renderer.rules.blockquote_open = openWithClass(classNames.blockquote);
    renderer.rules.hr = (tokens, index, options, env, activeRenderer) => {
      tokens[index].attrJoin("class", classNames.horizontalRule);
      return activeRenderer.renderToken(tokens, index, options);
    };
    renderer.rules.table_open = (tokens, index, options, env, activeRenderer) => {
      tokens[index].attrJoin("class", classNames.table);
      return `<div class="${classNames.tableContainer}"><div class="${classNames.tableWrapper}">${activeRenderer.renderToken(tokens, index, options)}`;
    };
    renderer.rules.table_close = (tokens, index, options, env, activeRenderer) => {
      return `${activeRenderer.renderToken(tokens, index, options)}</div></div>`;
    };
    renderer.rules.tbody_open = openWithClass(classNames.tableBody);
    renderer.rules.tr_open = openWithClass(classNames.tableRow);
    renderer.rules.th_open = openWithClass(classNames.tableHeaderCell);
    renderer.rules.td_open = openWithClass(classNames.tableCell);
    renderer.rules.code_inline = (tokens, index) => {
      return `<code class="${classNames.inlineMarkdown}">${markdown.utils.escapeHtml(tokens[index].content)}</code>`;
    };
    renderer.rules.fence = renderCodeBlock;
    renderer.rules.code_block = renderCodeBlock;
    renderer.rules.codex_task_checkbox = (tokens, index) => {
      const checked = tokens[index].meta?.checked ? " checked" : "";
      return `<input class="codex-markdown-task-checkbox" type="checkbox" disabled${checked}>`;
    };
  }

  const defaultLinkOpen = markdown.renderer.rules.link_open || renderToken;
  markdown.renderer.rules.link_open = (tokens, index, options, env, renderer) => {
    const token = tokens[index];
    token.attrJoin("class", "codex-markdown-link");
    token.attrSet("target", "_blank");
    token.attrSet("rel", "noopener noreferrer");
    return defaultLinkOpen(tokens, index, options, env, renderer);
  };

  function openWithClass(className) {
    return (tokens, index, options, env, renderer) => {
      tokens[index].attrJoin("class", className);
      return renderer.renderToken(tokens, index, options);
    };
  }

  function renderCodeBlock(tokens, index) {
    const token = tokens[index];
    const language = codeFenceLanguage(token.info || "");
    const languageClass = language ? ` class="language-${markdown.utils.escapeHtml(language)}"` : "";
    const code = markdown.utils.escapeHtml(token.content);
    return `<div class="${classNames.codeBlock}"><pre class="${classNames.codeBlockPlaceholder}"><code${languageClass}>${code}</code></pre></div>\n`;
  }

  function codeFenceLanguage(info) {
    return String(info || "").trim().split(/\s+/)[0].replace(/[^\w-]/g, "");
  }

  function renderToken(tokens, index, options, env, renderer) {
    return renderer.renderToken(tokens, index, options);
  }

  function markTaskLists(state) {
    for (let index = 0; index < state.tokens.length; index += 1) {
      const listOpen = state.tokens[index];
      if (listOpen.type !== "bullet_list_open") continue;
      let hasTaskItem = false;
      const listLevel = listOpen.level;
      for (let itemIndex = index + 1; itemIndex < state.tokens.length; itemIndex += 1) {
        const token = state.tokens[itemIndex];
        if (token.type === "bullet_list_close" && token.level === listLevel) break;
        if (token.type !== "list_item_open") continue;
        const inline = firstInlineChild(state.tokens, itemIndex);
        if (!inline) continue;
        const match = inline.content.match(/^\[( |x|X)\]\s+/);
        if (!match) continue;
        hasTaskItem = true;
        token.attrJoin("class", classNames.taskListItem);
        inline.content = inline.content.slice(match[0].length);
        if (inline.children?.length) {
          trimTaskMarkerFromInlineChildren(inline.children, match[0].length);
          const checkbox = new state.Token("codex_task_checkbox", "", 0);
          checkbox.meta = { checked: match[1].toLowerCase() === "x" };
          inline.children.unshift(checkbox);
        }
      }
      if (hasTaskItem) listOpen.attrJoin("class", classNames.taskList);
    }
  }

  function firstInlineChild(tokens, listItemIndex) {
    const itemLevel = tokens[listItemIndex].level;
    for (let index = listItemIndex + 1; index < tokens.length; index += 1) {
      const token = tokens[index];
      if (token.type === "list_item_close" && token.level === itemLevel) return null;
      if (token.type === "inline") return token;
    }
    return null;
  }

  function trimTaskMarkerFromInlineChildren(children, length) {
    let remaining = length;
    for (const child of children) {
      if (remaining <= 0) return;
      if (child.type !== "text") continue;
      const cut = Math.min(remaining, child.content.length);
      child.content = child.content.slice(cut);
      remaining -= cut;
    }
  }

  function render(text, options = {}) {
    const source = String(text || "");
    const variant = options.variant ? ` codex-markdown-${options.variant}` : "";
    const body = markdown.render(source);
    return `<div class="codex-markdown ${classNames.markdownRoot} ${classNames.markdownContent}${variant}">${body}</div>`;
  }

  global.CodexMarkdown = {
    classNames,
    render,
  };
})(window);
