import React from 'react';
import { formatBusinessText } from '@/utils/textFormatter';

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
  const formattedText = formatBusinessText(content);
  
  if (!formattedText || formattedText === 'No information available') {
    return (
      <div className={`text-gray-400 italic ${className}`}>
        No information available
      </div>
    );
  }

  // Split text into sections and format professionally
  const lines = formattedText.split('\n').filter(line => line.trim());
  
  const baseClasses = variant === 'large' 
    ? 'text-base leading-relaxed' 
    : variant === 'small'
    ? 'text-sm leading-normal'
    : 'text-sm leading-relaxed';

  return (
    <div className={`${baseClasses} ${className} space-y-3`}>
      {lines.map((line, index) => {
        const trimmedLine = line.trim();
        
        // Check if this is a heading/subheading (ends with colon and not a bullet point)
        if (trimmedLine.endsWith(':') && !trimmedLine.startsWith('•') && !trimmedLine.startsWith('-')) {
          return (
            <h4 key={index} className="font-semibold text-gray-200 mb-2 mt-4 border-b border-gray-600 pb-1">
              {trimmedLine}
            </h4>
          );
        }
        
        // Check if this is a bullet point
        if (trimmedLine.startsWith('•') || trimmedLine.startsWith('-') || trimmedLine.match(/^\d+\./)) {
          const bulletText = trimmedLine.replace(/^[•\-]\s*/, '').replace(/^\d+\.\s*/, '');
          return (
            <div key={index} className="flex items-start mb-2">
              <span className="text-primary mt-1 mr-3 flex-shrink-0">•</span>
              <span className="text-gray-300">{bulletText}</span>
            </div>
          );
        }
        
        // Regular paragraph text
        return (
          <p key={index} className="text-gray-300 leading-relaxed">
            {trimmedLine}
          </p>
        );
      })}
    </div>
  );
}

// Enhanced InfoGrid component with better formatting
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