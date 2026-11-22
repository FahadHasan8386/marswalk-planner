
import React from "react";

// Convert Gemini's Markdown response into readable React elements.

function normalizeMarkdown(text) {
  return String(text || "")
    .replace(/\r\n/g, "\n")
    // Remove escaped Markdown characters returned by some model responses.
    .replace(/\\([*_#`])/g, "$1")
    // Recover headings and numbered lists when Gemini places them
    // on the same line as the preceding paragraph.
    .replace(/[ \t]+(?=#{1,3}\s)/g, "\n")
    .replace(/[ \t]+(?=\d+\.\s)/g, "\n")
    .trim();
}

function renderInline(text, keyPrefix = "inline") {
  const pattern =
    /(\*\*[^*]+?\*\*|__.+?__|`[^`]+?`|\*[^*\n]+?\*|_[^_\n]+?_)/g;

  const parts = String(text).split(pattern);

  return parts.map((part, index) => {
    const key = `${keyPrefix}-${index}`;

    if (
      (part.startsWith("**") && part.endsWith("**")) ||
      (part.startsWith("__") && part.endsWith("__"))
    ) {
      return (
        <strong key={key} className="font-bold text-white">
          {part.slice(2, -2)}
        </strong>
      );
    }

    if (
      part.startsWith("`") &&
      part.endsWith("`")
    ) {
      return (
        <code
          key={key}
          className="rounded bg-slate-800 px-1.5 py-0.5 font-mono text-purple-300"
        >
          {part.slice(1, -1)}
        </code>
      );
    }

    if (
      (part.startsWith("*") && part.endsWith("*")) ||
      (part.startsWith("_") && part.endsWith("_"))
    ) {
      return (
        <em key={key} className="italic text-slate-300">
          {part.slice(1, -1)}
        </em>
      );
    }

    return part;
  });
}

function MarkdownContent({ content }) {
  const lines = normalizeMarkdown(content).split("\n");
  const blocks = [];

  let paragraph = [];
  let index = 0;

  const flushParagraph = () => {
    if (!paragraph.length) return;

    blocks.push({
      type: "paragraph",
      content: paragraph.join(" "),
      key: `paragraph-${index++}`,
    });

    paragraph = [];
  };

  while (index < lines.length) {
    const line = lines[index].trim();

    if (!line) {
      flushParagraph();
      index++;
      continue;
    }

    const heading = line.match(/^(#{1,3})\s+(.+)$/);

    if (heading) {
      flushParagraph();

      blocks.push({
        type: "heading",
        level: heading[1].length,
        content: heading[2],
        key: `heading-${index}`,
      });

      index++;
      continue;
    }

    if (/^([-*_])\1{2,}$/.test(line)) {
      flushParagraph();

      blocks.push({
        type: "divider",
        key: `divider-${index}`,
      });

      index++;
      continue;
    }

    const ordered = line.match(/^(\d+)\.\s+(.+)$/);

    if (ordered) {
      flushParagraph();

      const items = [];

      while (index < lines.length) {
        const match = lines[index].trim().match(/^\d+\.\s+(.+)$/);

        if (!match) break;

        items.push(match[1]);
        index++;
      }

      blocks.push({
        type: "ordered-list",
        items,
        key: `ordered-${index}`,
      });

      continue;
    }

    const unordered = line.match(/^[-*]\s+(.+)$/);

    if (unordered) {
      flushParagraph();

      const items = [];

      while (index < lines.length) {
        const match = lines[index].trim().match(/^[-*]\s+(.+)$/);

        if (!match) break;

        items.push(match[1]);
        index++;
      }

      blocks.push({
        type: "unordered-list",
        items,
        key: `unordered-${index}`,
      });

      continue;
    }

    paragraph.push(line);
    index++;
  }

  flushParagraph();

  return (
    <div className="space-y-5">
      {blocks.map((block) => {
        if (block.type === "heading") {
          const HeadingTag = `h${block.level}`;

          return (
            <HeadingTag
              key={block.key}
              className={
                block.level === 1
                  ? "border-b border-white/10 pb-3 text-2xl font-bold text-white"
                  : block.level === 2
                  ? "text-lg font-bold text-purple-300"
                  : "text-base font-semibold text-slate-200"
              }
            >
              {renderInline(block.content, block.key)}
            </HeadingTag>
          );
        }

        if (block.type === "paragraph") {
          return (
            <p
              key={block.key}
              className="text-sm leading-7 text-slate-300 md:text-base"
            >
              {renderInline(block.content, block.key)}
            </p>
          );
        }

        if (block.type === "ordered-list") {
          return (
            <ol
              key={block.key}
              className="list-decimal space-y-3 pl-6 text-sm leading-7 text-slate-300 md:text-base"
            >
              {block.items.map((item, itemIndex) => (
                <li key={itemIndex} className="pl-2 marker:text-purple-400">
                  {renderInline(item, `${block.key}-${itemIndex}`)}
                </li>
              ))}
            </ol>
          );
        }

        if (block.type === "unordered-list") {
          return (
            <ul
              key={block.key}
              className="list-disc space-y-2 pl-6 text-sm leading-7 text-slate-300 md:text-base"
            >
              {block.items.map((item, itemIndex) => (
                <li key={itemIndex} className="pl-2 marker:text-purple-400">
                  {renderInline(item, `${block.key}-${itemIndex}`)}
                </li>
              ))}
            </ul>
          );
        }

        if (block.type === "divider") {
          return (
            <hr
              key={block.key}
              className="border-white/10"
            />
          );
        }

        return null;
      })}
    </div>
  );
}

// --------------------------------------------------
// GEMINI REPORT COMPONENT
// --------------------------------------------------

export default function GeminiReport({
  explanation,
  loading = false,
  error = "",
}) {
  return (
    <section className="overflow-hidden rounded-2xl border border-purple-400/20 bg-slate-900/80 shadow-xl shadow-purple-950/10">

      {/* HEADER */}

      <div className="border-b border-purple-400/10 bg-gradient-to-r from-purple-500/10 via-slate-900 to-indigo-500/10 p-5 md:p-6">

        <div className="flex flex-wrap items-center justify-between gap-4">

          <div className="flex items-center gap-3">

            <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-purple-400/20 bg-purple-500/10 text-2xl">
              ✦
            </div>

            <div>
              <p className="text-xs font-bold uppercase tracking-[0.25em] text-purple-400">
                MARSWALK INTELLIGENCE
              </p>

              <h2 className="mt-1 text-xl font-bold text-white md:text-2xl">
                Gemini Mission Analysis
              </h2>

              <p className="mt-1 text-xs text-slate-400">
                AI-powered interpretation of rover mission results
              </p>
            </div>

          </div>

          <span className="rounded-full border border-purple-400/30 bg-purple-400/10 px-3 py-1.5 text-xs font-semibold text-purple-300">
            GEMINI AI
          </span>

        </div>

      </div>

      {/* REPORT BODY */}

      <div className="p-5 md:p-7">

        {loading && (
          <div className="flex items-center gap-3 rounded-xl border border-purple-400/10 bg-slate-950 p-5 text-slate-300">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-purple-400 border-t-transparent" />
            <div>
              <p className="font-semibold text-white">
                Analyzing mission telemetry
              </p>
              <p className="mt-1 text-xs text-slate-400">
                Gemini is preparing your mission report...
              </p>
            </div>
          </div>
        )}

        {!loading && error && (
          <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-5">
            <p className="font-semibold text-red-300">
              Gemini explanation unavailable
            </p>
            <p className="mt-2 text-sm leading-6 text-slate-300">
              {error}
            </p>
            <p className="mt-3 text-xs text-slate-400">
              Your calculated mission results remain available.
            </p>
          </div>
        )}

        {!loading && explanation && (
          <MarkdownContent content={explanation} />
        )}

        {!loading && !error && !explanation && (
          <p className="text-sm text-slate-400">
            Gemini analysis will appear here after mission calculation.
          </p>
        )}

      </div>

      {/* FOOTER */}

      <div className="border-t border-white/5 bg-slate-950/50 px-5 py-3 md:px-7">
        <p className="text-xs leading-5 text-slate-500">
          AI-generated interpretation of calculated simulation data.
          Mission feasibility remains determined by the Python engineering model.
        </p>
      </div>

    </section>
  );
}
