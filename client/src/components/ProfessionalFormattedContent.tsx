import { MemoMarkdownRenderer } from './MemoMarkdownRenderer';

interface ProfessionalFormattedContentProps {
  content: string | null | undefined;
  className?: string;
  variant?: 'default' | 'large' | 'small';
}

export function ProfessionalFormattedContent({ 
  content, 
  className = '', 
  variant = 'default' 
}: ProfessionalFormattedContentProps) {
  const variantClasses = variant === 'large' 
    ? 'text-base' 
    : variant === 'small'
    ? 'text-sm'
    : 'text-sm';

  return (
    <MemoMarkdownRenderer 
      content={content}
      className={`${variantClasses} ${className}`}
    />
  );
}

interface InfoGridProps {
  items: Array<{
    label: string;
    content: string | null | undefined;
    className?: string;
  }>;
  columns?: number;
}

export function ProfessionalInfoGrid({ items, columns = 2 }: InfoGridProps) {
  const gridCols = columns === 2 ? 'grid-cols-1 md:grid-cols-2' : 'grid-cols-1';
  
  return (
    <div className={`grid ${gridCols} gap-6`}>
      {items.map((item, index) => (
        <div key={index} className={`space-y-2 ${item.className || ''}`}>
          <h4 className="font-semibold text-gray-200 border-b border-gray-600 pb-1">
            {item.label}
          </h4>
          <ProfessionalFormattedContent 
            content={item.content} 
            variant="small"
          />
        </div>
      ))}
    </div>
  );
}
