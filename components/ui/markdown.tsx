"use client";

import * as React from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeSanitize from "rehype-sanitize";
import { cn } from "@/lib/utils";

interface MarkdownProps {
  children: string;
  className?: string;
}

export function Markdown({ children, className }: MarkdownProps) {
  return (
    <div className={cn("max-w-none prose-brand", className)}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeSanitize]}
        components={{
          a: ({ node, ...props }) => (
            <a
              {...props}
              target="_blank"
              rel="noopener noreferrer"
              className="text-brand-purple hover:underline break-all"
            />
          ),
        }}
      >
        {children || "—"}
      </ReactMarkdown>
    </div>
  );
}

export function MarkdownHint({ className }: { className?: string }) {
  return (
    <p className={cn("text-xs text-brand-ink/60", className)}>
      You can use Markdown formatting:{" "}
      <span className="font-semibold">bold</span>,{" "}
      <em>italic</em>, - lists,{" "}
      <a href="#" className="text-brand-purple hover:underline" onClick={(e) => e.preventDefault()}>
        links
      </a>
    </p>
  );
}
