// src/components/MarkdownView.jsx
import ReactMarkdown from 'react-markdown';

export default function MarkdownView({ content, className }) {
  if (!content) return null;
  return (
    <div className={className ? `markdown-view ${className}` : 'markdown-view'}>
      <ReactMarkdown
        components={{
          a: ({ ...props }) => (
            <a {...props} target="_blank" rel="noopener noreferrer" />
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}