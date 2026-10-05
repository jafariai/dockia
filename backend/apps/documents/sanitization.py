"""Server-side HTML sanitization.

This is the first line of defense for the preview system. We strip all
active content (scripts, event handlers, javascript: URLs, embedded frames)
and keep only presentational markup. The frontend additionally renders the
result inside a `sandbox`-ed iframe with a strict CSP, so even a sanitizer
miss cannot execute script on the platform origin.
"""
import re

import bleach
from bleach.css_sanitizer import CSSSanitizer

# The authoritative security boundary is bleach's html5lib-based allowlist below
# (it strips every non-allowlisted tag, drops event handlers, and blocks
# javascript:/data: URLs regardless of how the markup is nested or malformed).
# The two regexes here are a best-effort COSMETIC pre-pass only: bleach keeps the
# inner *text* of a stripped tag, so without this a <script>/<style> body would
# remain as inert-but-ugly source in the preview. They are not relied on for
# safety, so their known fragility on nested/malformed input is acceptable.
_DANGEROUS_BLOCKS = re.compile(
    r"<\s*(script|style|noscript|template|svg|math|iframe|object|embed|form)\b[^>]*>.*?"
    r"<\s*/\s*\1\s*>",
    re.IGNORECASE | re.DOTALL,
)
_DANGEROUS_VOID = re.compile(
    r"<\s*/?\s*(script|style|iframe|object|embed|form)\b[^>]*>", re.IGNORECASE
)

# Presentational + structural tags commonly produced by doc generators.
ALLOWED_TAGS = [
    "a", "abbr", "address", "article", "aside", "b", "blockquote", "br",
    "caption", "code", "col", "colgroup", "dd", "details", "div", "dl", "dt",
    "em", "figcaption", "figure", "footer", "h1", "h2", "h3", "h4", "h5", "h6",
    "header", "hr", "i", "img", "kbd", "li", "main", "mark", "nav", "ol", "p",
    "pre", "q", "s", "section", "small", "span", "strong", "sub",
    "summary", "sup", "table", "tbody", "td", "tfoot", "th", "thead", "time",
    "tr", "u", "ul", "wbr",
    # NB: <style> is intentionally NOT allowed. bleach's css_sanitizer only
    # cleans the inline style="" attribute, not the body of a <style> element,
    # so allowing the tag would let arbitrary (unsanitized) CSS through. Inline
    # style="" attributes remain supported and ARE sanitized (see below).
]

ALLOWED_ATTRIBUTES = {
    "*": ["class", "id", "style", "title", "lang", "dir", "role"],
    "a": ["href", "name", "target", "rel"],
    "img": ["src", "alt", "width", "height", "loading"],
    "td": ["colspan", "rowspan", "align", "valign"],
    "th": ["colspan", "rowspan", "align", "valign", "scope"],
    "col": ["span", "width"],
    "time": ["datetime"],
}

ALLOWED_PROTOCOLS = ["http", "https", "mailto"]

# CSS properties permitted inside style="" — layout/typography only.
_CSS_SANITIZER = CSSSanitizer(
    allowed_css_properties=[
        "color", "background-color", "background", "font", "font-size",
        "font-family", "font-weight", "font-style", "text-align", "text-decoration",
        "line-height", "margin", "margin-top", "margin-bottom", "margin-left",
        "margin-right", "padding", "padding-top", "padding-bottom", "padding-left",
        "padding-right", "border", "border-top", "border-bottom", "border-left",
        "border-right", "border-radius", "border-color", "border-width",
        "border-style", "width", "height", "max-width", "min-width", "display",
        "vertical-align", "white-space", "overflow", "list-style", "list-style-type",
        "table-layout", "border-collapse", "border-spacing", "letter-spacing",
        "word-break", "text-transform", "opacity", "box-shadow",
    ]
)


def sanitize_html(raw_html: str) -> str:
    """Return a sanitized copy of *raw_html* safe to render in preview."""
    # 1) Drop dangerous blocks entirely (tag + contents) before tag-level cleaning.
    raw_html = _DANGEROUS_BLOCKS.sub("", raw_html)
    raw_html = _DANGEROUS_VOID.sub("", raw_html)
    # 2) Tag/attribute allowlisting + CSS sanitization.
    cleaned = bleach.clean(
        raw_html,
        tags=ALLOWED_TAGS,
        attributes=ALLOWED_ATTRIBUTES,
        protocols=ALLOWED_PROTOCOLS,
        css_sanitizer=_CSS_SANITIZER,
        strip=True,           # drop disallowed tags instead of escaping them
        strip_comments=True,
    )
    cleaned = cleaned.replace('target="_blank"', 'target="_blank" rel="noopener noreferrer"')
    return cleaned
