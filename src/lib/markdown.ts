/**
 * Minimal Markdown → safe HTML for Insight bodies.
 * Headings, paragraphs, emphasis, links, lists, tables, inline/fenced code.
 * react-markdown / remark are not in deps; keep this tiny and deterministic.
 */

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function inlineFormat(text: string): string {
  let s = escapeHtml(text);
  s = s.replace(/`([^`]+)`/g, "<code>$1</code>");
  s = s.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  s = s.replace(/(^|[^*])\*([^*]+)\*(?![*])/g, "$1<em>$2</em>");
  s = s.replace(/_([^_]+)_/g, "<em>$1</em>");
  s = s.replace(
    /\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g,
    '<a href="$2" rel="noopener noreferrer" target="_blank">$1</a>',
  );
  return s;
}

function splitRow(line: string): string[] {
  const trimmed = line.trim().replace(/^\|/, "").replace(/\|$/, "");
  return trimmed.split("|").map((c) => c.trim());
}

function isSeparatorRow(line: string): boolean {
  const cells = splitRow(line);
  return cells.length > 0 && cells.every((c) => /^:?-{3,}:?$/.test(c));
}

function isTableRow(line: string): boolean {
  const t = line.trim();
  return t.includes("|") && !t.startsWith("```");
}

export function renderMarkdownToHtml(md: string): string {
  const lines = md.replace(/\r\n/g, "\n").split("\n");
  const out: string[] = [];
  let i = 0;
  let inCode = false;
  let codeLang = "";
  let codeBuf: string[] = [];
  let listType: "ul" | "ol" | null = null;

  const closeList = () => {
    if (listType) {
      out.push(`</${listType}>`);
      listType = null;
    }
  };

  while (i < lines.length) {
    const line = lines[i];

    if (inCode) {
      if (line.startsWith("```")) {
        out.push(
          `<pre><code${codeLang ? ` class="language-${escapeHtml(codeLang)}"` : ""}>${escapeHtml(codeBuf.join("\n"))}</code></pre>`,
        );
        inCode = false;
        codeBuf = [];
        codeLang = "";
      } else {
        codeBuf.push(line);
      }
      i += 1;
      continue;
    }

    const fence = line.match(/^```(\w*)\s*$/);
    if (fence) {
      closeList();
      inCode = true;
      codeLang = fence[1] || "";
      codeBuf = [];
      i += 1;
      continue;
    }

    if (!line.trim()) {
      closeList();
      i += 1;
      continue;
    }

    // GFM table: header + separator + body rows
    if (
      isTableRow(line) &&
      i + 1 < lines.length &&
      isSeparatorRow(lines[i + 1])
    ) {
      closeList();
      const header = splitRow(line);
      i += 2;
      const body: string[][] = [];
      while (i < lines.length && isTableRow(lines[i]) && lines[i].trim()) {
        if (isSeparatorRow(lines[i])) {
          i += 1;
          continue;
        }
        body.push(splitRow(lines[i]));
        i += 1;
      }
      const thead =
        "<thead><tr>" +
        header.map((c) => `<th>${inlineFormat(c)}</th>`).join("") +
        "</tr></thead>";
      const tbody =
        "<tbody>" +
        body
          .map(
            (row) =>
              "<tr>" +
              row.map((c) => `<td>${inlineFormat(c)}</td>`).join("") +
              "</tr>",
          )
          .join("") +
        "</tbody>";
      out.push(`<div class="table-wrap"><table>${thead}${tbody}</table></div>`);
      continue;
    }

    const heading = line.match(/^(#{1,4})\s+(.+)$/);
    if (heading) {
      closeList();
      const level = heading[1].length;
      out.push(`<h${level}>${inlineFormat(heading[2].trim())}</h${level}>`);
      i += 1;
      continue;
    }

    const ul = line.match(/^[-*]\s+(.+)$/);
    if (ul) {
      if (listType !== "ul") {
        closeList();
        listType = "ul";
        out.push("<ul>");
      }
      out.push(`<li>${inlineFormat(ul[1])}</li>`);
      i += 1;
      continue;
    }

    const ol = line.match(/^\d+\.\s+(.+)$/);
    if (ol) {
      if (listType !== "ol") {
        closeList();
        listType = "ol";
        out.push("<ol>");
      }
      out.push(`<li>${inlineFormat(ol[1])}</li>`);
      i += 1;
      continue;
    }

    closeList();
    const para: string[] = [line];
    i += 1;
    while (i < lines.length) {
      const next = lines[i];
      if (!next.trim()) break;
      if (/^(#{1,4})\s+/.test(next)) break;
      if (/^```/.test(next)) break;
      if (/^[-*]\s+/.test(next)) break;
      if (/^\d+\.\s+/.test(next)) break;
      if (isTableRow(next) && i + 1 < lines.length && isSeparatorRow(lines[i + 1])) break;
      para.push(next);
      i += 1;
    }
    out.push(`<p>${inlineFormat(para.join(" "))}</p>`);
  }

  closeList();
  if (inCode) {
    out.push(
      `<pre><code${codeLang ? ` class="language-${escapeHtml(codeLang)}"` : ""}>${escapeHtml(codeBuf.join("\n"))}</code></pre>`,
    );
  }
  return out.join("\n");
}
