import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

type Props = {
  content: string
  className?: string
}

export function StreamingMarkdown({ content, className }: Props) {
  return (
    <div
      className={`prose prose-invert prose-sm max-w-none prose-p:my-2 prose-headings:my-3 ${className ?? ''}`}
    >
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
    </div>
  )
}
