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
                if (item.trim().startsWith('•')) {
                  return (
                    <div key={itemIndex} className="flex items-start mb-2">
                      <span className="text-primary mt-1 mr-3 flex-shrink-0">•</span>
                      <span className="text-gray-300">{item.replace(/^•\s*/, '').trim()}</span>
                    </div>
                  );
                } else {
                  return (
                    <div key={itemIndex} className="text-gray-300 mb-2">
                      {item.trim()}
                    </div>
                  );
                }
              })}
            </div>
          );
        } else {
          // Regular paragraph
          return (
            <p key={index} className={`text-gray-300 ${index > 0 ? 'mt-4' : ''}`}>
              {paragraph.trim()}
            </p>
          );
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