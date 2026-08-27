import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { cn } from '@/lib/utils'

type MarkdownViewerProps = {
  content: string
  className?: string
}

export function MarkdownViewer({ content, className }: MarkdownViewerProps) {
  return (
    <article className={cn('min-w-0 break-words text-sm leading-7', className)}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: ({ children }) => <h1 className='mb-4 text-2xl font-bold'>{children}</h1>,
          h2: ({ children }) => <h2 className='mt-7 mb-3 text-xl font-semibold'>{children}</h2>,
          h3: ({ children }) => <h3 className='mt-5 mb-2 text-lg font-semibold'>{children}</h3>,
          p: ({ children }) => <p className='my-3'>{children}</p>,
          ul: ({ children }) => <ul className='my-3 list-disc space-y-1 ps-6'>{children}</ul>,
          ol: ({ children }) => <ol className='my-3 list-decimal space-y-1 ps-6'>{children}</ol>,
          blockquote: ({ children }) => (
            <blockquote className='my-4 border-s-4 ps-4 text-muted-foreground'>{children}</blockquote>
          ),
          table: ({ children }) => (
            <div className='my-4 overflow-x-auto rounded-md border'>
              <table className='w-full border-collapse text-start text-sm'>{children}</table>
            </div>
          ),
          th: ({ children }) => <th className='border-b bg-muted px-3 py-2 font-medium'>{children}</th>,
          td: ({ children }) => <td className='border-b px-3 py-2 align-top'>{children}</td>,
          code: ({ children, className: codeClassName }) =>
            codeClassName ? (
              <code className={codeClassName}>{children}</code>
            ) : (
              <code className='rounded bg-muted px-1.5 py-0.5 font-mono text-xs'>{children}</code>
            ),
          pre: ({ children }) => (
            <pre className='my-4 overflow-x-auto rounded-lg bg-muted p-4 font-mono text-xs leading-6'>
              {children}
            </pre>
          ),
          a: ({ children, href }) => (
            <a href={href} target='_blank' rel='noreferrer' className='text-primary underline'>
              {children}
            </a>
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </article>
  )
}
