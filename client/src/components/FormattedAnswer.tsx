interface FormattedAnswerProps {
  text: string;
  className?: string;
}

export function FormattedAnswer({ text, className = "" }: FormattedAnswerProps) {
  if (!text) return <p className={className}>No analysis available</p>;

  const enhanceTextWithFormatting = (text: string): JSX.Element => {
    // Bold key-value pairs and labels
    let enhancedText = text
      // Bold labels like "Trial:", "Study:", "Device:", etc.
      .replace(/^([A-Z][\w\s\-/()]+):\s*/gm, '<strong>$1:</strong> ')
      // Bold clinical terms at sentence start
      .replace(/\b(Trial|Study|Design|Phase|Population|Endpoint|Enrollment|Location|Regulatory|Device|Safety|Efficacy|Approval|FDA|EMA|Clinical|Patient|Subject)(\s+[^:]*?):/gi, '<strong>$1$2:</strong>')
      // Emphasize numbers, percentages, dates
      .replace(/(\b\d{1,3}(,\d{3})*(\.\d+)?%?\b|\b(N=|n=)?\d+\b|\b20\d{2}\b|\bK\d+\b)/g, '<span class="font-semibold text-white">$1</span>');

    return (
      <span 
        dangerouslySetInnerHTML={{ 
          __html: enhancedText 
        }} 
      />
    );
  };

  const formatTextToBullets = (text: string): JSX.Element[] => {
    const cleanText = text.trim();
    
    // Split into sentences using multiple patterns
    let sentences = cleanText.split(/[.!?]+\s+(?=[A-Z])/);
    
    // If we get one big block, try splitting by common clinical phrases
    if (sentences.length === 1 && cleanText.length > 200) {
      sentences = cleanText.split(/\.\s+(?=The\s|It\s|This\s|A\s|An\s|Additionally|Furthermore|Moreover|However|Nevertheless)/);
    }
    
    // If still one block, split by length at logical points
    if (sentences.length === 1 && cleanText.length > 200) {
      const words = cleanText.split(' ');
      sentences = [];
      let current = '';
      
      for (const word of words) {
        if (current.length + word.length > 150 && current.includes(',')) {
          sentences.push(current.trim());
          current = word;
        } else {
          current += (current ? ' ' : '') + word;
        }
      }
      if (current) sentences.push(current.trim());
    }

    return sentences
      .filter(sentence => sentence.trim().length > 10)
      .map((sentence, index) => {
        const trimmed = sentence.trim();
        // Add period if missing
        const finalSentence = trimmed.endsWith('.') || trimmed.endsWith('!') || trimmed.endsWith('?') 
          ? trimmed 
          : trimmed + '.';

        return (
          <div key={index} className="flex items-start gap-2 mb-2">
            <span className="text-cyan-400 mt-1 text-xs">•</span>
            <div className={`text-gray-300 text-sm leading-relaxed flex-1 ${className}`}>
              {enhanceTextWithFormatting(finalSentence)}
            </div>
          </div>
        );
      });
  };

  // Check if text already has explicit formatting (bullets, numbers, etc.)
  const hasExistingFormat = /^[\s]*[-•*]\s|^\s*\d+\.\s|^\s*[a-zA-Z]\.\s/m.test(text);
  
  if (hasExistingFormat) {
    // Preserve existing format but enhance with bold/emphasis
    const lines = text.split('\n').filter(line => line.trim());
    return (
      <div className="space-y-1">
        {lines.map((line, index) => {
          const trimmed = line.trim();
          if (trimmed.match(/^[-•*]\s/) || trimmed.match(/^\d+\.\s/)) {
            return (
              <div key={index} className="flex items-start gap-2">
                <span className="text-cyan-400 mt-1 text-xs">•</span>
                <div className={`text-gray-300 text-sm leading-relaxed flex-1 ${className}`}>
                  {enhanceTextWithFormatting(trimmed.replace(/^[-•*\d.]\s*/, ''))}
                </div>
              </div>
            );
          }
          return (
            <div key={index} className={`text-gray-300 text-sm leading-relaxed mb-2 ${className}`}>
              {enhanceTextWithFormatting(trimmed)}
            </div>
          );
        })}
      </div>
    );
  }

  // Auto-convert plain prose to bullets
  const elements = formatTextToBullets(text);
  
  return (
    <div className="space-y-1">
      {elements}
    </div>
  );
}