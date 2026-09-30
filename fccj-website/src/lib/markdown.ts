import { Marked } from 'marked';
import { escapeHtml, safeUrl } from './security';

// Markdown renderer for admin-authored content. Raw HTML is escaped (never
// passed through) and link/image URLs are restricted to safe schemes, so even
// a compromised editor account cannot inject script into public pages.
const md = new Marked({ gfm: true, async: false });
md.use({
  renderer: {
    html(token) {
      return escapeHtml(token.text);
    },
    link(token) {
      const text = this.parser.parseInline(token.tokens);
      const href = safeUrl(token.href);
      if (!href) return text;
      const external = /^https?:/i.test(href);
      const title = token.title ? ` title="${escapeHtml(token.title)}"` : '';
      return `<a href="${escapeHtml(href)}"${title}${external ? ' target="_blank" rel="noopener noreferrer"' : ''}>${text}</a>`;
    },
    image(token) {
      const src = safeUrl(token.href);
      if (!src) return '';
      return `<img src="${escapeHtml(src)}" alt="${escapeHtml(token.text ?? '')}" loading="lazy">`;
    },
  },
});

export function renderMarkdown(src: string | null | undefined): string {
  return md.parse(src ?? '') as string;
}
