interface FormattedAnswerProps {
  text: string;
  className?: string;
}

export function FormattedAnswer({ text, className = "" }: FormattedAnswerProps) {
  if (!text) return <p className={className}>No analysis available</p>;

  const formatText = (text: string): JSX.Element[] => {
    // Clean the text
    const cleanText = text.trim();
    
    // Split into sentences - look for periods followed by space and capital letter
    let sentences = cleanText.split(/\.(?=\s+[A-Z])/);
    
    // If that doesn't work well, try other sentence endings
    if (sentences.length === 1) {
      sentences = cleanText.split(/[.!?]+(?=\s+[A-Z])/);
    }
    
    // If still one big block, split by length
    if (sentences.length === 1 && cleanText.length > 200) {
      const words = cleanText.split(' ');
      sentences = [];
      let currentSentence = '';
      
      for (const word of words) {
        if (currentSentence.length + word.length > 200 && currentSentence.length > 0) {
          sentences.push(currentSentence.trim());
          currentSentence = word;
        } else {
          currentSentence += (currentSentence ? ' ' : '') + word;
        }
      }
      if (currentSentence) {
        sentences.push(currentSentence.trim());
      }
    }

    const elements: JSX.Element[] = [];
    
    sentences.forEach((sentence, index) => {
      const trimmedSentence = sentence.trim();
      if (!trimmedSentence) return;
      
      // Add back the period if it was removed during splitting
      const finalSentence = trimmedSentence.endsWith('.') || trimmedSentence.endsWith('!') || trimmedSentence.endsWith('?') 
        ? trimmedSentence 
        : trimmedSentence + '.';
      
      // Check if this looks like a question
      if (finalSentence.includes('?') && finalSentence.length < 150) {
        elements.push(
          <div key={`question-${index}`} className="mb-3">
            <h6 className="text-green-400 text-sm font-medium mb-1">
              {finalSentence}
            </h6>
          </div>
        );
      }
      // Check if this is a short sentence (likely a key point)
      else if (finalSentence.length < 100) {
        elements.push(
          <p key={`short-${index}`} className={`text-gray-300 text-sm leading-relaxed mb-2 font-medium ${className}`}>
            {finalSentence}
          </p>
        );
      }
      // Long sentence - break into readable paragraph
      else {
        elements.push(
          <p key={`long-${index}`} className={`text-gray-300 text-sm leading-relaxed mb-3 ${className}`}>
            {finalSentence}
          </p>
        );
      }
    });

    return elements;
  };

  // First check if we have explicit paragraphs (separated by double newlines)
  const paragraphs = text.split(/\n\s*\n/).filter(p => p.trim());
  
  if (paragraphs.length > 1) {
    // Handle multiple paragraphs
    return (
      <div className="space-y-4">
        {paragraphs.map((paragraph, index) => (
          <div key={index} className="space-y-2">
            {formatText(paragraph)}
          </div>
        ))}
      </div>
    );
  }
  
  // Handle single block of text
  return (
    <div className="space-y-2">
      {formatText(text)}
    </div>
  );
}