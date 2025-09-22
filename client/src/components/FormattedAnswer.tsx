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

  const createStructuredContent = (text: string): JSX.Element => {
    const cleanText = text.trim();
    
    // Split into sentences
    let sentences = cleanText.split(/[.!?]+\s+(?=[A-Z])/);
    
    // If single block, try better splitting
    if (sentences.length === 1 && cleanText.length > 200) {
      sentences = cleanText.split(/\.\s+(?=The\s|It\s|This\s|A\s|An\s|Additionally|Furthermore|Moreover|However|Nevertheless)/);
    }
    
    // Group sentences into topics based on keywords
    const topics: { [key: string]: string[] } = {};
    let currentTopic = 'Overview';
    
    sentences.forEach(sentence => {
      const trimmed = sentence.trim();
      if (!trimmed || trimmed.length < 10) return;
      
      // Detect new topics based on keywords
      const topicKeywords = {
        'Study Design': /study design|trial design|methodology|randomized|blinded|controlled/i,
        'Regulatory Status': /FDA|EMA|regulatory|approval|clearance|510\(k\)|orphan|breakthrough/i,
        'Patient Population': /patient|population|inclusion|exclusion|criteria|subjects|enrollment/i,
        'Endpoints & Outcomes': /endpoint|primary|secondary|outcome|efficacy|measurement/i,
        'Safety & Monitoring': /safety|adverse|monitoring|SAE|serious adverse events|compliance/i,
        'Clinical Data': /accuracy|performance|data|results|analysis|assessment/i,
        'Risk Assessment': /risk|concern|limitation|challenge|issues/i,
        'Recommendations': /recommend|suggest|consider|should|need to|investment/i
      };
      
      // Find matching topic
      let foundTopic = false;
      for (const [topic, regex] of Object.entries(topicKeywords)) {
        if (regex.test(trimmed)) {
          currentTopic = topic;
          foundTopic = true;
          break;
        }
      }
      
      if (!topics[currentTopic]) {
        topics[currentTopic] = [];
      }
      topics[currentTopic].push(trimmed);
    });

    // Render structured content
    return (
      <div className="space-y-4">
        {Object.entries(topics).map(([topic, topicSentences], topicIndex) => {
          if (topicSentences.length === 0) return null;
          
          return (
            <div key={topicIndex} className="space-y-2">
              {/* Topic Heading */}
              <h4 className="text-cyan-400 font-semibold text-sm border-l-2 border-cyan-400 pl-2">
                {topic}
              </h4>
              
              {/* Topic Content */}
              <div className="ml-4 space-y-2">
                {topicSentences.map((sentence, sentenceIndex) => {
                  const finalSentence = sentence.endsWith('.') || sentence.endsWith('!') || sentence.endsWith('?') 
                    ? sentence 
                    : sentence + '.';
                  
                  // Detect if this sentence has sub-points
                  const hasSubPoints = finalSentence.includes(',') && finalSentence.length > 100;
                  
                  if (hasSubPoints) {
                    // Split at commas for sub-bullets
                    const parts = finalSentence.split(',').map(part => part.trim()).filter(part => part.length > 5);
                    const mainPoint = parts[0];
                    const subPoints = parts.slice(1);
                    
                    return (
                      <div key={sentenceIndex} className="space-y-1">
                        {/* Main bullet */}
                        <div className="flex items-start gap-2">
                          <span className="text-green-400 mt-1 text-xs">•</span>
                          <div className={`text-gray-300 text-sm leading-relaxed flex-1 ${className}`}>
                            {enhanceTextWithFormatting(mainPoint)}
                          </div>
                        </div>
                        
                        {/* Sub-bullets */}
                        {subPoints.length > 0 && (
                          <div className="ml-4 space-y-1">
                            {subPoints.map((subPoint, subIndex) => (
                              <div key={subIndex} className="flex items-start gap-2">
                                <span className="text-blue-400 mt-1 text-xs">‣</span>
                                <div className={`text-gray-400 text-xs leading-relaxed flex-1 ${className}`}>
                                  {enhanceTextWithFormatting(subPoint.replace(/\.$/, ''))}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  } else {
                    // Simple bullet
                    return (
                      <div key={sentenceIndex} className="flex items-start gap-2">
                        <span className="text-green-400 mt-1 text-xs">•</span>
                        <div className={`text-gray-300 text-sm leading-relaxed flex-1 ${className}`}>
                          {enhanceTextWithFormatting(finalSentence)}
                        </div>
                      </div>
                    );
                  }
                })}
              </div>
            </div>
          );
        })}
      </div>
    );
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

  // Create structured content with headings and hierarchy
  return createStructuredContent(text);
}