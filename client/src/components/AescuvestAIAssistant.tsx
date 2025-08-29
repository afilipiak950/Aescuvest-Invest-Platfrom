import React, { useState, useRef, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { motion, AnimatePresence } from 'framer-motion';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
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
  CheckCircle2,
  TrendingUp,
  AlertTriangle,
  Square,
  Zap,
  Clock,
  Target,
  Lightbulb,
  Gauge,
  Brain,
  BarChart3,
  Users,
  Shield,
  DollarSign,
  Eye,
  History,
  Star
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
  responseTime?: number;
  confidence?: 'High' | 'Medium' | 'Low';
  queryType?: 'simple' | 'complex' | 'analytical' | 'cross-document';
}

interface SmartSuggestion {
  id: string;
  text: string;
  category: 'financial' | 'legal' | 'clinical' | 'commercial' | 'general';
  icon: any;
  priority: number;
}

interface PerformanceMetrics {
  averageResponseTime: number;
  totalQueries: number;
  cacheHitRate: number;
  dealEmbeddingCoverage: number;
  conversationLength: number;
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
  const [showSuggestions, setShowSuggestions] = useState(true);
  const [showMetrics, setShowMetrics] = useState(false);
  const [smartSuggestions, setSmartSuggestions] = useState<SmartSuggestion[]>([]);
  const [performanceMetrics, setPerformanceMetrics] = useState<PerformanceMetrics | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

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

  // Fetch smart suggestions
  const { data: suggestions } = useQuery({
    queryKey: ['/api/deals', dealId, 'ai-assistant/suggestions'],
    queryFn: async () => {
      const response = await fetch(`/api/deals/${dealId}/ai-assistant/suggestions`);
      if (!response.ok) return generateDefaultSuggestions();
      return response.json();
    },
    enabled: !!dealId && isContextLoaded
  });

  // Fetch performance metrics
  const { data: metrics } = useQuery({
    queryKey: ['/api/deals', dealId, 'ai-assistant/metrics'],
    queryFn: async () => {
      const response = await fetch(`/api/deals/${dealId}/ai-assistant/metrics`);
      if (!response.ok) throw new Error('Failed to fetch performance metrics');
      return response.json();
    },
    enabled: !!dealId && showMetrics,
    refetchInterval: 5000 // Update every 5 seconds when visible
  });

  // Generate default smart suggestions
  const generateDefaultSuggestions = (): SmartSuggestion[] => [
    {
      id: '1',
      text: "What is the company's primary business model and revenue streams?",
      category: 'general',
      icon: DollarSign,
      priority: 1
    },
    {
      id: '2', 
      text: "Analyze the competitive landscape and market positioning",
      category: 'commercial',
      icon: Target,
      priority: 2
    },
    {
      id: '3',
      text: "Assess the key regulatory risks and compliance requirements", 
      category: 'legal',
      icon: Shield,
      priority: 3
    },
    {
      id: '4',
      text: "Evaluate the financial projections and path to profitability",
      category: 'financial', 
      icon: TrendingUp,
      priority: 4
    },
    {
      id: '5',
      text: "Review the management team capabilities and track record",
      category: 'general',
      icon: Users,
      priority: 5
    }
  ];
  
  // Update smart suggestions when data changes
  useEffect(() => {
    if (suggestions) {
      setSmartSuggestions(suggestions);
    } else {
      setSmartSuggestions(generateDefaultSuggestions());
    }
  }, [suggestions]);

  // Update performance metrics
  useEffect(() => {
    if (metrics) {
      setPerformanceMetrics(metrics);
    }
  }, [metrics]);

  // Pre-load context when component mounts for instant responses
  useEffect(() => {
    if (dealId && !isContextLoaded) {
      // Immediately mark as loading started
      setIsPreloading(true);
      
      // Set a hard timeout to guarantee we exit loading state
      const timeout = setTimeout(() => {
        console.log('⚡ AI Assistant ready (timeout fallback)');
        setIsPreloading(false);
        setIsContextLoaded(true);
      }, 2000); // Reduced to 2 seconds for better UX
      
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
          return null;
        }
        return res.json();
      })
      .then(data => {
        if (data && data.success) {
          console.log('🚀 AI Assistant context pre-loaded:', data.contextStats);
        }
      })
      .catch(err => {
        console.error('Failed to pre-load context:', err);
      })
      .finally(() => {
        // Always clear loading state
        clearTimeout(timeout);
        setIsPreloading(false);
        setIsContextLoaded(true);
      });
      
      // Cleanup function
      return () => {
        clearTimeout(timeout);
      };
    }
  }, [dealId]); // Simplified dependencies to prevent re-runs

  // Mutation for sending queries
  // Handle smart suggestion click
  const handleSuggestionClick = (suggestion: SmartSuggestion) => {
    setInput(suggestion.text);
    setShowSuggestions(false);
    // Auto-submit the suggestion
    setTimeout(() => {
      handleSendMessage(suggestion.text);
    }, 100);
  };

  // Handle sending messages with enhanced tracking
  const handleSendMessage = async (messageText?: string) => {
    const queryText = messageText || input;
    if (!queryText.trim() || isStreaming) return;

    console.log('🚀 handleSendMessage called with:', queryText);
    setInput('');
    setShowSuggestions(false);
    
    // Send query - the mutation will handle adding messages
    sendQueryMutation.mutate(queryText);
  };

  const sendQueryMutation = useMutation({
    mutationFn: async (query: string) => {
      // Create new AbortController for this request
      abortControllerRef.current = new AbortController();
      
      // Add user message immediately  
      const userId = `user-${Date.now()}`;
      const userMessage: Message = {
        id: userId,
        role: 'user',
        content: query,
        timestamp: new Date()
      };
      setMessages(prev => [...prev, userMessage]);
      setIsStreaming(true);
      console.log('🔄 Starting stream for message:', userId);

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

      try {
        // Stream the response with abort signal
        console.log(`🚀 FETCH STARTING - AI query to backend: "${query}" for deal ${dealId}`);
        console.log('🔍 Fetch URL:', `/api/deals/${dealId}/ai-assistant/stream`);
        console.log('📦 Request body:', JSON.stringify({ query }));
        console.log('🎯 AbortController exists:', !!abortControllerRef.current);
        
        const response = await fetch(`/api/deals/${dealId}/ai-assistant/stream`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query }),
          signal: abortControllerRef.current.signal
        }).catch(err => {
          console.error('🔥 FETCH FAILED:', err);
          throw err;
        });
        
        console.log('📡 Response received:', response.status, response.statusText);
        console.log('📡 Response content-type:', response.headers.get('content-type'));
        
        // Check if we got a streaming response
        const contentType = response.headers.get('content-type');
        if (!contentType?.includes('text/event-stream')) {
          console.error('❌ Not a streaming response! Got:', contentType);
          // Try to read the body to see what we got
          const text = await response.text();
          console.error('❌ Response body:', text);
          throw new Error('Invalid response - expected streaming but got: ' + contentType);
        }
        
        if (!response.ok) throw new Error(`Failed to send query: ${response.status} ${response.statusText}`);

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
        abortControllerRef.current = null;
      } catch (error: any) {
        console.error('🛑 AI Assistant request failed:', error);
        console.error('Error details:', {
          name: error.name,
          message: error.message,
          stack: error.stack
        });
        
        // Handle abort vs other errors
        if (error.name === 'AbortError') {
          console.log('✅ Request cancelled by user');
        } else {
          console.error('❌ Critical AI Assistant error:', error);
          // Show error to user
          setMessages(prev => prev.map(msg => 
            msg.id === assistantId 
              ? { ...msg, content: `Error: ${error.message}. Please try again.` }
              : msg
          ));
        }
        
        // Clean up state in all cases
        setIsStreaming(false);
        abortControllerRef.current = null;
        
        // Don't remove messages on error - show the error instead
        if (error.name === 'AbortError') {
          // Remove incomplete assistant messages on abort
          setMessages(prev => {
            const filteredMessages = prev.filter(msg => {
              return msg.role === 'user' || (msg.role === 'assistant' && msg.content.trim());
            });
            return filteredMessages;
          });
        }
        
        throw error; // Re-throw so mutation can handle it
      }
    }
  });

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (input.trim() && !isStreaming) {
      // Force clear any stuck state
      setIsPreloading(false);
      setIsContextLoaded(true);
      setIsStreaming(false);
      
      const query = input;
      setInput('');
      setIsExpanded(true);
      sendQueryMutation.mutate(query);
    }
  };

  // Example queries - enhanced for analyst-quality responses
  const exampleQueries = [
    "Provide a comprehensive financial analysis including revenue projections, burn rate, and path to profitability",
    "Analyze the regulatory pathway and key milestones for FDA approval or CE marking",
    "Assess the intellectual property portfolio and competitive positioning",
    "Evaluate the clinical data quality and statistical significance of key endpoints", 
    "Identify critical legal and compliance risks with severity assessment",
    "Compare our investment thesis against competitive landscape analysis",
    "Quantify the total addressable market and revenue opportunity",
    "Assess management team capabilities and track record"
  ];

  const handleExampleQuery = (query: string) => {
    console.log('🎯 Example query clicked:', query);
    console.log('📊 Current state:', { isStreaming, isPreloading, isContextLoaded });
    
    // Force clear any stuck state
    setIsStreaming(false);
    setIsPreloading(false);
    setIsContextLoaded(true);
    setIsExpanded(true);
    
    // Directly submit without setting input first
    console.log('🚀 Direct submission of example query');
    sendQueryMutation.mutate(query);
  };

  // Stop function to cancel ongoing AI processing
  const stopProcessing = () => {
    console.log('🛑 Stopping AI Assistant processing...');
    
    // Abort the ongoing request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    
    // Reset streaming state immediately
    setIsStreaming(false);
    
    // Remove any incomplete assistant messages (messages without content)
    setMessages(prev => {
      const filteredMessages = prev.filter(msg => {
        // Keep user messages and complete assistant messages
        return msg.role === 'user' || (msg.role === 'assistant' && msg.content.trim());
      });
      return filteredMessages;
    });
    
    console.log('✅ AI Assistant processing stopped');
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
                    <span className="text-green-600 flex items-center gap-1">
                      <TrendingUp className="h-3 w-3" />
                      Ready - Institutional-grade analysis
                    </span>
                  ) : (
                    'Elite investment analysis with Wall Street-quality reporting and comprehensive due diligence insights'
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
                      <h3 className="text-lg font-semibold mb-2">Investment Analysis Ready!</h3>
                      <p className="text-sm text-muted-foreground mb-4">
                        Elite institutional-grade analysis with access to 1,300+ documents, agent reports, and RAG-powered insights
                      </p>
                      <div className="flex flex-wrap gap-2 justify-center">
                        {exampleQueries.slice(0, 3).map((query, idx) => (
                          <Button
                            key={idx}
                            variant="outline"
                            size="sm"
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              console.log('📱 Button clicked for query:', query);
                              handleExampleQuery(query);
                            }}
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
                              "max-w-[85%] rounded-lg p-4 shadow-sm",
                              message.role === 'user'
                                ? 'bg-blue-500 text-white'
                                : 'bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700'
                            )}
                          >
                            {message.content ? (
                              message.role === 'assistant' ? (
                                <div className="prose prose-sm max-w-none dark:prose-invert">
                                  <ReactMarkdown 
                                    remarkPlugins={[remarkGfm]}
                                    components={{
                                      h1: ({ children }) => <h1 className="text-lg font-bold text-blue-900 dark:text-blue-100 mb-2">{children}</h1>,
                                      h2: ({ children }) => <h2 className="text-base font-semibold text-gray-800 dark:text-gray-200 mb-2 border-b border-gray-200 dark:border-gray-600 pb-1">{children}</h2>,
                                      h3: ({ children }) => <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{children}</h3>,
                                      p: ({ children }) => <p className="text-sm leading-relaxed mb-2 text-gray-700 dark:text-gray-300">{children}</p>,
                                      ul: ({ children }) => <ul className="text-sm list-disc pl-4 mb-2 space-y-1">{children}</ul>,
                                      ol: ({ children }) => <ol className="text-sm list-decimal pl-4 mb-2 space-y-1">{children}</ol>,
                                      li: ({ children }) => <li className="text-gray-700 dark:text-gray-300">{children}</li>,
                                      strong: ({ children }) => <strong className="font-semibold text-blue-900 dark:text-blue-200">{children}</strong>,
                                      em: ({ children }) => <em className="italic text-gray-600 dark:text-gray-400">{children}</em>,
                                      code: ({ children }) => (
                                        <code className="bg-gray-100 dark:bg-gray-700 px-1 py-0.5 rounded text-xs font-mono">
                                          {children}
                                        </code>
                                      ),
                                      blockquote: ({ children }) => (
                                        <blockquote className="border-l-4 border-blue-500 pl-4 italic text-gray-600 dark:text-gray-400 bg-blue-50 dark:bg-blue-900/20 p-3 rounded-r">
                                          {children}
                                        </blockquote>
                                      ),
                                      table: ({ children }) => (
                                        <div className="overflow-x-auto">
                                          <table className="min-w-full border border-gray-200 dark:border-gray-700">
                                            {children}
                                          </table>
                                        </div>
                                      ),
                                      th: ({ children }) => (
                                        <th className="border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 px-3 py-2 text-left text-xs font-semibold text-gray-900 dark:text-gray-100">
                                          {children}
                                        </th>
                                      ),
                                      td: ({ children }) => (
                                        <td className="border border-gray-200 dark:border-gray-700 px-3 py-2 text-xs text-gray-700 dark:text-gray-300">
                                          {children}
                                        </td>
                                      )
                                    }}
                                  >
                                    {message.content}
                                  </ReactMarkdown>
                                </div>
                              ) : (
                                <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                              )
                            ) : (
                              <div className="flex items-center gap-2">
                                <Loader2 className="h-4 w-4 animate-spin" />
                                <span className="text-xs text-muted-foreground">Generating response...</span>
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

          {/* Revolutionary Smart Suggestions - HIDDEN */}
          {false && showSuggestions && smartSuggestions.length > 0 && messages.length === 0 && (
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-4 space-y-3"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Lightbulb className="h-4 w-4 text-yellow-500" />
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Smart Investment Analysis Suggestions</span>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowSuggestions(false)}
                  className="text-xs"
                >
                  Hide
                </Button>
              </div>
              
              <div className="grid grid-cols-1 gap-2 max-h-40 overflow-y-auto">
                {smartSuggestions.slice(0, 6).map((suggestion) => {
                  const IconComponent = suggestion.icon;
                  const categoryColor = {
                    financial: 'bg-green-100 text-green-800 border-green-200',
                    legal: 'bg-red-100 text-red-800 border-red-200', 
                    clinical: 'bg-blue-100 text-blue-800 border-blue-200',
                    commercial: 'bg-purple-100 text-purple-800 border-purple-200',
                    general: 'bg-gray-100 text-gray-800 border-gray-200'
                  }[suggestion.category];
                  
                  return (
                    <motion.button
                      key={suggestion.id}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => handleSuggestionClick(suggestion)}
                      className={cn(
                        "w-full text-left p-3 rounded-lg border-2 transition-all duration-200 hover:shadow-md",
                        categoryColor,
                        "hover:bg-opacity-80"
                      )}
                    >
                      <div className="flex items-start gap-3">
                        <IconComponent className="h-4 w-4 mt-0.5 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium leading-tight">{suggestion.text}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <Badge variant="outline" className="text-xs">
                              {suggestion.category}
                            </Badge>
                            <Star className="h-3 w-3 text-yellow-400 fill-current" />
                          </div>
                        </div>
                      </div>
                    </motion.button>
                  );
                })}
              </div>
            </motion.div>
          )}

          {/* Performance Metrics Dashboard */}
          {showMetrics && performanceMetrics && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="mb-4 p-4 bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 rounded-lg border border-blue-200 dark:border-blue-800"
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Gauge className="h-4 w-4 text-blue-600" />
                  <span className="text-sm font-medium text-gray-800 dark:text-gray-200">AI Performance Metrics</span>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowMetrics(false)}
                  className="text-xs"
                >
                  Hide
                </Button>
              </div>
              
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="text-center p-3 bg-white dark:bg-gray-800 rounded-lg shadow-sm">
                  <Zap className="h-5 w-5 text-yellow-500 mx-auto mb-1" />
                  <div className="text-xs text-gray-600 dark:text-gray-400">Avg Response</div>
                  <div className="font-bold text-lg text-gray-900 dark:text-gray-100">
                    {performanceMetrics.averageResponseTime?.toFixed(0) || 0}ms
                  </div>
                </div>
                
                <div className="text-center p-3 bg-white dark:bg-gray-800 rounded-lg shadow-sm">
                  <BarChart3 className="h-5 w-5 text-green-500 mx-auto mb-1" />
                  <div className="text-xs text-gray-600 dark:text-gray-400">Cache Hit Rate</div>
                  <div className="font-bold text-lg text-gray-900 dark:text-gray-100">
                    {(performanceMetrics.cacheHitRate * 100)?.toFixed(1) || 0}%
                  </div>
                </div>
                
                <div className="text-center p-3 bg-white dark:bg-gray-800 rounded-lg shadow-sm">
                  <Database className="h-5 w-5 text-blue-500 mx-auto mb-1" />
                  <div className="text-xs text-gray-600 dark:text-gray-400">Embedding Coverage</div>
                  <div className="font-bold text-lg text-gray-900 dark:text-gray-100">
                    {performanceMetrics.dealEmbeddingCoverage?.toFixed(1) || 0}%
                  </div>
                </div>
                
                <div className="text-center p-3 bg-white dark:bg-gray-800 rounded-lg shadow-sm">
                  <History className="h-5 w-5 text-purple-500 mx-auto mb-1" />
                  <div className="text-xs text-gray-600 dark:text-gray-400">Conversation</div>
                  <div className="font-bold text-lg text-gray-900 dark:text-gray-100">
                    {performanceMetrics.conversationLength || 0} msg
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {/* Input Area */}
          <form onSubmit={handleSubmit} className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={
                  isPreloading 
                    ? "Loading AI context (max 2 seconds)..." 
                    : "Request institutional-grade analysis: financial projections, regulatory pathway, IP assessment, clinical data..."
                }
                className="pl-10 pr-4 bg-white/90 dark:bg-gray-900/90 backdrop-blur border-blue-200 dark:border-blue-900 focus:border-blue-500"
                disabled={isStreaming}
              />
            </div>
            
            {/* Stop button when streaming */}
            {isStreaming && (
              <Button
                type="button"
                onClick={stopProcessing}
                variant="destructive"
                className="bg-red-500 hover:bg-red-600 text-white shadow-lg"
                title="Stop AI processing"
              >
                <Square className="h-4 w-4" />
              </Button>
            )}
            
            {/* Send button */}
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
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    console.log('📱 Suggestion button clicked:', query);
                    handleExampleQuery(query);
                  }}
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