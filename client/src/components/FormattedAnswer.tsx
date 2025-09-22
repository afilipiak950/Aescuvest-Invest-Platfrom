interface FormattedAnswerProps {
  text: string;
  className?: string;
}

export function FormattedAnswer({ text, className = "" }: FormattedAnswerProps) {
  if (!text) return <p className={className}>No analysis available</p>;

  // Split text into paragraphs
  const paragraphs = text.split(/\n\s*\n/);
  
  const formatParagraph = (paragraph: string, index: number) => {
    // Handle bullet points
    if (paragraph.includes('•') || paragraph.includes('-') || paragraph.includes('*')) {
      const lines = paragraph.split('\n').filter(line => line.trim());
      const bulletPoints = lines.filter(line => 
        line.trim().startsWith('•') || 
        line.trim().startsWith('-') || 
        line.trim().startsWith('*') ||
        line.match(/^\d+\./)
      );
      
      if (bulletPoints.length > 0) {
        return (
          <div key={index} className="space-y-1">
            {lines.map((line, lineIndex) => {
              const trimmedLine = line.trim();
              if (trimmedLine.startsWith('•') || trimmedLine.startsWith('-') || trimmedLine.startsWith('*')) {
                return (
                  <div key={lineIndex} className="flex items-start gap-2">
                    <span className="text-green-400 text-xs mt-1">•</span>
                    <span className={`text-gray-300 text-sm leading-relaxed flex-1 ${className}`}>
                      {trimmedLine.replace(/^[•\-*]\s*/, '')}
                    </span>
                  </div>
                );
              } else if (trimmedLine.match(/^\d+\./)) {
                const number = trimmedLine.match(/^(\d+)\./)?.[1];
                return (
                  <div key={lineIndex} className="flex items-start gap-2">
                    <span className="text-green-400 text-xs mt-1 font-medium">{number}.</span>
                    <span className={`text-gray-300 text-sm leading-relaxed flex-1 ${className}`}>
                      {trimmedLine.replace(/^\d+\.\s*/, '')}
                    </span>
                  </div>
                );
              } else if (trimmedLine) {
                return (
                  <p key={lineIndex} className={`text-gray-300 text-sm leading-relaxed mb-2 ${className}`}>
                    {trimmedLine}
                  </p>
                );
              }
              return null;
            })}
          </div>
        );
      }
    }

    // Handle questions and answers within the text
    if (paragraph.includes('?:')) {
      const parts = paragraph.split('?:');
      if (parts.length === 2) {
        return (
          <div key={index} className="space-y-2">
            <h6 className="text-green-400 text-sm font-medium">
              {parts[0].trim()}?
            </h6>
            <p className={`text-gray-300 text-sm leading-relaxed ml-4 ${className}`}>
              {parts[1].trim()}
            </p>
          </div>
        );
      }
    }

    // Regular paragraph with better line breaks
    const lines = paragraph.split('\n').filter(line => line.trim());
    if (lines.length > 1) {
      return (
        <div key={index} className="space-y-2">
          {lines.map((line, lineIndex) => (
            <p key={lineIndex} className={`text-gray-300 text-sm leading-relaxed ${className}`}>
              {line.trim()}
            </p>
          ))}
        </div>
      );
    }

    // Single paragraph
    return (
      <p key={index} className={`text-gray-300 text-sm leading-relaxed ${className}`}>
        {paragraph.trim()}
      </p>
    );
  };

  return (
    <div className="space-y-3">
      {paragraphs.map((paragraph, index) => formatParagraph(paragraph, index))}
    </div>
  );
}