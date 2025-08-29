import React from 'react';
import { formatBusinessText } from '@/utils/textFormatter';

interface FormattedContentProps {
  content: string | null | undefined;
  className?: string;
  variant?: 'default' | 'large' | 'small';
}

export function FormattedContent({ content, className = '', variant = 'default' }: FormattedContentProps) {
  const formattedText = formatBusinessText(content);
  
  if (!formattedText || formattedText === 'No information available') {
    return (
      <div className={`text-gray-400 italic ${className}`}>
        No information available
      </div>
    );
  }

  // Split text into paragraphs for better rendering
  const paragraphs = formattedText.split('\n\n').filter(p => p.trim());
  
  const baseClasses = variant === 'large' 
    ? 'text-base leading-relaxed' 
    : variant === 'small'
    ? 'text-sm leading-normal'
    : 'text-sm leading-relaxed';

  return (
    <div className={`${baseClasses} ${className}`}>
      {paragraphs.map((paragraph, index) => {
        // Check if paragraph contains bullet points
        if (paragraph.includes('•')) {
          const items = paragraph.split('\n').filter(item => item.trim());
          return (
            <div key={index} className={index > 0 ? 'mt-4' : ''}>
              {items.map((item, itemIndex) => {
                const trimmedItem = item.trim();
                
                // Check if this is actually a bullet point (starts with •) 
                // and not a subheading that happens to contain • or end with :
                if (trimmedItem.startsWith('•') && !trimmedItem.match(/^[^:]+:\s*$/)) {
                  return (
                    <div key={itemIndex} className="flex items-start mb-2">
                      <span className="text-primary mt-1 mr-3 flex-shrink-0">•</span>
                      <span className="text-gray-300">{trimmedItem.replace(/^•\s*/, '').trim()}</span>
                    </div>
                  );
                } else if (trimmedItem.endsWith(':') && !trimmedItem.startsWith('•')) {
                  // This is a subheading - render as bold heading
                  return (
                    <h4 key={itemIndex} className="font-semibold text-gray-200 mb-2 mt-4">
                      {trimmedItem}
                    </h4>
                  );
                } else {
                  // Regular text content
                  return (
                    <div key={itemIndex} className="text-gray-300 mb-2">
                      {trimmedItem}
                    </div>
                  );
                }
              })}
            </div>
          );
        } else {
          // Check if this is a standalone subheading
          const trimmedParagraph = paragraph.trim();
          if (trimmedParagraph.endsWith(':') && trimmedParagraph.split('\n').length === 1) {
            return (
              <h4 key={index} className={`font-semibold text-gray-200 mb-2 ${index > 0 ? 'mt-4' : ''}`}>
                {trimmedParagraph}
              </h4>
            );
          } else {
            // Regular paragraph
            return (
              <p key={index} className={`text-gray-300 ${index > 0 ? 'mt-4' : ''}`}>
                {trimmedParagraph}
              </p>
            );
          }
        }
      })}
    </div>
  );
}

interface SectionHeaderProps {
  title: string;
  subtitle?: string;
  icon?: React.ReactNode;
  className?: string;
}

export function SectionHeader({ title, subtitle, icon, className = '' }: SectionHeaderProps) {
  return (
    <div className={`mb-6 ${className}`}>
      <h3 className="text-xl font-bold text-white mb-2 flex items-center">
        {icon && <span className="mr-3">{icon}</span>}
        {title}
      </h3>
      {subtitle && (
        <p className="text-gray-400 text-sm">{subtitle}</p>
      )}
      <div className="h-px bg-gradient-to-r from-primary/50 to-transparent mt-3"></div>
    </div>
  );
}

interface InfoGridProps {
  items: Array<{
    label: string;
    content: string | null | undefined;
    className?: string;
  }>;
  columns?: 1 | 2 | 3;
}

export function InfoGrid({ items, columns = 2 }: InfoGridProps) {
  const gridClass = columns === 1 
    ? 'grid-cols-1' 
    : columns === 3 
    ? 'grid-cols-1 md:grid-cols-3' 
    : 'grid-cols-1 md:grid-cols-2';

  return (
    <div className={`grid ${gridClass} gap-6`}>
      {items.map((item, index) => (
        <div key={index} className={item.className || ''}>
          <h4 className="font-semibold text-gray-200 mb-3">{item.label}</h4>
          <FormattedContent content={item.content} variant="small" />
        </div>
      ))}
    </div>
  );
}