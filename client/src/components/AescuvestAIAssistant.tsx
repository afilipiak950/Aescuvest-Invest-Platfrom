import React, { useState, useRef, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Bot, 
  Send, 
  Sparkles, 
  FileText, 
  BrainCircuit, 
  Search,
  Loader2,
  Info,
  ChevronDown,
  ChevronUp,
  MessageSquare,
  Database,
  CheckCircle2
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { queryClient } from '@/lib/queryClient';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  contextStats?: {
    documentsLoaded: number;
    agentAnalyses: number;
    hasCompanyInfo: boolean;
    totalContextSize: number;
  };
}

interface AescuvestAIAssistantProps {
  dealId: number;
  className?: string;
}

export const AescuvestAIAssistant: React.FC<AescuvestAIAssistantProps> = ({ dealId, className }) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isExpanded, setIsExpanded] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [isContextLoaded, setIsContextLoaded] = useState(false);
  const [isPreloading, setIsPreloading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollAreaRef = useRef<HTMLDivElement>(null);

  // Fetch context stats
  const { data: contextStats, isLoading: statsLoading } = useQuery({
    queryKey: ['/api/deals', dealId, 'ai-assistant/stats'],
    queryFn: async () => {
      const response = await fetch(`/api/deals/${dealId}/ai-assistant/stats`);
      if (!response.ok) throw new Error('Failed to fetch AI context stats');
      return response.json();
    },
    enabled: !!dealId
  });
  
  // Pre-load context when component mounts for instant responses
  useEffect(() => {
    if (dealId && !isContextLoaded && !isPreloading) {
      setIsPreloading(true);
      
      // Set a timeout to prevent infinite loading
      const timeout = setTimeout(() => {
        setIsPreloading(false);
        setIsContextLoaded(true); // Mark as loaded even if preload fails
        console.log('⚡ AI Assistant ready (preload timeout)');
      }, 3000);
      
      // Pre-load context in the background
      fetch(`/api/deals/${dealId}/ai-assistant/preload`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      })
      .then(res => {
        // Check if response is HTML (Vite blocking)
        const contentType = res.headers.get('content-type');
        if (contentType && contentType.includes('text/html')) {
          console.warn('Vite blocked preload endpoint, continuing anyway');
          setIsContextLoaded(true);
          return null;
        }
        return res.json();
      })
      .then(data => {
        if (data && data.success) {
          console.log('🚀 AI Assistant context pre-loaded:', data.contextStats);
          setIsContextLoaded(true);
        } else if (data === null) {
          // Vite blocked, but we can still work
          setIsContextLoaded(true);
        }
      })
      .catch(err => {
        console.error('Failed to pre-load context:', err);
        // Mark as loaded anyway to allow usage
        setIsContextLoaded(true);
      })
      .finally(() => {
        clearTimeout(timeout);
        setIsPreloading(false);
      });
    }
  }, [dealId, isContextLoaded, isPreloading]);

  // Mutation for sending queries
  const sendQueryMutation = useMutation({
    mutationFn: async (query: string) => {
      // Add user message immediately
      const userMessage: Message = {
        id: `user-${Date.now()}`,
        role: 'user',
        content: query,
        timestamp: new Date()
      };
      setMessages(prev => [...prev, userMessage]);
      setIsStreaming(true);

      // Create assistant message placeholder
      const assistantId = `assistant-${Date.now()}`;
      const assistantMessage: Message = {
        id: assistantId,
        role: 'assistant',
        content: '',
        timestamp: new Date(),
        contextStats: contextStats?.stats
      };
      setMessages(prev => [...prev, assistantMessage]);

      // Stream the response
      const response = await fetch(`/api/deals/${dealId}/ai-assistant/stream`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query })
      });

      if (!response.ok) throw new Error('Failed to send query');

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (reader) {
        let fullContent = '';
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value);
          const lines = chunk.split('\n');
          
          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const data = line.slice(6);
              if (data) {
                try {
                  const parsed = JSON.parse(data);
                  if (parsed.type === 'content') {
                    fullContent += parsed.content;
                    setMessages(prev => prev.map(msg => 
                      msg.id === assistantId 
                        ? { ...msg, content: fullContent }
                        : msg
                    ));
                  }
                } catch (e) {
                  console.error('Failed to parse SSE data:', e);
                }
              }
            }
          }
        }
      }
      
      setIsStreaming(false);
    }
  });

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (input.trim() && !isStreaming) {
      sendQueryMutation.mutate(input);
      setInput('');
      setIsExpanded(true);
    }
  };

  // Example queries
  const exampleQueries = [
    "What are the key regulatory milestones?",
    "Summarize the financial analysis findings",
    "What are the main IP concerns?",
    "Explain the clinical trial results",
    "What risks were identified by the legal analysis?"
  ];

  const handleExampleQuery = (query: string) => {
    setInput(query);
    setIsExpanded(true);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className={cn("w-full", className)}
    >
      <Card className="relative overflow-hidden border-2 border-blue-200 dark:border-blue-900 bg-gradient-to-br from-blue-50/50 via-white to-purple-50/50 dark:from-gray-900 dark:via-gray-800 dark:to-blue-900/20">
        {/* Animated background effect */}
        <div className="absolute inset-0 opacity-10">
          <div className="absolute inset-0 bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 animate-gradient-x" />
        </div>
        
        <CardHeader className="relative z-10">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="relative">
                <div className="absolute inset-0 bg-blue-500 blur-lg opacity-50 animate-pulse" />
                <div className="relative bg-gradient-to-br from-blue-500 to-purple-600 p-3 rounded-xl shadow-lg">
                  <BrainCircuit className="h-6 w-6 text-white" />
                </div>
              </div>
              <div>
                <CardTitle className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                  Aescuvest AI Assistant
                </CardTitle>
                <p className="text-sm text-muted-foreground">
                  {isPreloading ? (
                    <span className="flex items-center gap-1">
                      <Loader2 className="h-3 w-3 animate-spin" />
                      Loading AI context...
                    </span>
                  ) : isContextLoaded ? (
                    <span className="text-green-600">✓ Ready - Instant responses</span>
                  ) : (
                    'Ultra-intelligent investment analysis powered by complete document context'
                  )}
                </p>
              </div>
            </div>
            
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setIsExpanded(!isExpanded)}
              className="hover:bg-blue-100 dark:hover:bg-blue-900/50"
            >
              {isExpanded ? <ChevronUp /> : <ChevronDown />}
            </Button>
          </div>

          {/* Context Stats */}
          {contextStats?.stats && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex flex-wrap gap-2 mt-4"
            >
              <Badge variant="secondary" className="bg-blue-100 dark:bg-blue-900/50">
                <FileText className="h-3 w-3 mr-1" />
                {contextStats.stats.documentsLoaded} Documents
              </Badge>
              <Badge variant="secondary" className="bg-purple-100 dark:bg-purple-900/50">
                <Bot className="h-3 w-3 mr-1" />
                {contextStats.stats.agentAnalyses} Agent Analyses
              </Badge>
              <Badge variant="secondary" className="bg-green-100 dark:bg-green-900/50">
                <Database className="h-3 w-3 mr-1" />
                {(contextStats.stats.totalContextSize / 1024 / 1024).toFixed(1)}MB Context
              </Badge>
              {contextStats.stats.hasCompanyInfo && (
                <Badge variant="secondary" className="bg-orange-100 dark:bg-orange-900/50">
                  <CheckCircle2 className="h-3 w-3 mr-1" />
                  Company Intel Loaded
                </Badge>
              )}
            </motion.div>
          )}
        </CardHeader>

        <CardContent className="relative z-10">
          <AnimatePresence>
            {isExpanded && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.3 }}
              >
                {/* Messages Area */}
                <ScrollArea className="h-[400px] mb-4 p-4 bg-white/80 dark:bg-gray-900/80 backdrop-blur rounded-lg border border-blue-200 dark:border-blue-900">
                  {messages.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-center">
                      <Sparkles className="h-12 w-12 text-blue-500 mb-4 animate-pulse" />
                      <h3 className="text-lg font-semibold mb-2">Ask me anything!</h3>
                      <p className="text-sm text-muted-foreground mb-4">
                        I have complete access to all OCR text, AI summaries, and agent analyses
                      </p>
                      <div className="flex flex-wrap gap-2 justify-center">
                        {exampleQueries.slice(0, 3).map((query, idx) => (
                          <Button
                            key={idx}
                            variant="outline"
                            size="sm"
                            onClick={() => handleExampleQuery(query)}
                            className="text-xs hover:bg-blue-100 dark:hover:bg-blue-900/50"
                          >
                            {query}
                          </Button>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {messages.map((message) => (
                        <motion.div
                          key={message.id}
                          initial={{ opacity: 0, x: message.role === 'user' ? 20 : -20 }}
                          animate={{ opacity: 1, x: 0 }}
                          className={cn(
                            "flex gap-3",
                            message.role === 'user' ? 'justify-end' : 'justify-start'
                          )}
                        >
                          {message.role === 'assistant' && (
                            <div className="bg-gradient-to-br from-blue-500 to-purple-600 p-2 rounded-lg shadow-md">
                              <Bot className="h-4 w-4 text-white" />
                            </div>
                          )}
                          <div
                            className={cn(
                              "max-w-[80%] rounded-lg p-3 shadow-sm",
                              message.role === 'user'
                                ? 'bg-blue-500 text-white'
                                : 'bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700'
                            )}
                          >
                            {message.content ? (
                              <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                            ) : (
                              <div className="flex items-center gap-2">
                                <Loader2 className="h-4 w-4 animate-spin" />
                                <span className="text-xs text-muted-foreground">Thinking...</span>
                              </div>
                            )}
                          </div>
                          {message.role === 'user' && (
                            <div className="bg-gray-200 dark:bg-gray-700 p-2 rounded-lg">
                              <MessageSquare className="h-4 w-4" />
                            </div>
                          )}
                        </motion.div>
                      ))}
                      <div ref={messagesEndRef} />
                    </div>
                  )}
                </ScrollArea>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Input Area */}
          <form onSubmit={handleSubmit} className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={
                  isPreloading 
                    ? "Loading AI context..." 
                    : isContextLoaded 
                      ? "Ask about documents, analyses, regulatory status, financials, IP, clinical data..."
                      : "Initializing AI Assistant..."
                }
                className="pl-10 pr-4 bg-white/90 dark:bg-gray-900/90 backdrop-blur border-blue-200 dark:border-blue-900 focus:border-blue-500"
                disabled={isStreaming || (isPreloading && !isContextLoaded)}
              />
            </div>
            <Button
              type="submit"
              disabled={!input.trim() || isStreaming}
              className="bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white shadow-lg"
            >
              {isStreaming ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </Button>
          </form>

          {/* Example Queries (when collapsed) */}
          {!isExpanded && (
            <div className="mt-4 flex flex-wrap gap-2">
              <p className="text-xs text-muted-foreground w-full mb-2">Try asking:</p>
              {exampleQueries.slice(0, 2).map((query, idx) => (
                <Button
                  key={idx}
                  variant="outline"
                  size="sm"
                  onClick={() => handleExampleQuery(query)}
                  className="text-xs hover:bg-blue-100 dark:hover:bg-blue-900/50"
                >
                  <Sparkles className="h-3 w-3 mr-1" />
                  {query}
                </Button>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
};