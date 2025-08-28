import { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import PageHeader from '@/components/layout/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  Bot, 
  MessageSquare, 
  Send, 
  Loader2, 
  Search, 
  Globe, 
  TrendingUp, 
  Building2,
  FileText,
  BarChart3,
  Database,
  Zap,
  Sparkles,
  Brain,
  Square,
  History,
  Lightbulb,
  Star,
  Gauge,
  Users,
  Target,
  Award,
  Briefcase
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import { cn } from '@/lib/utils';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

interface PerformanceMetrics {
  averageResponseTime: number;
  cacheHitRate: number;
  totalQueries: number;
  successRate: number;
}

export default function GlobalAIAssistant() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [selectedContext, setSelectedContext] = useState<string>('all');
  const [showMetrics, setShowMetrics] = useState(false);
  const [performanceMetrics, setPerformanceMetrics] = useState<PerformanceMetrics | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Enhanced example queries for global assistant
  const exampleQueries = [
    "What are the latest trends in HealthTech venture capital?",
    "Compare the investment landscape between European and US startups",
    "Analyze the regulatory environment for medical devices in 2025",
    "What are the key success factors for Series A fundraising?",
    "Give me insights on AI companies in our portfolio",
    "What's the average burn rate for SaaS companies?",
    "Search for recent FDA approvals in digital health",
    "Explain the current market conditions for biotech IPOs",
    "What are the top 5 risks in early-stage investing?",
    "Benchmark our portfolio performance against industry standards"
  ];

  // Context options for the assistant
  const contextOptions = [
    { value: 'all', label: '🌐 All Data & Web Search', description: 'Full access to portfolio, web, and general knowledge' },
    { value: 'portfolio', label: '📊 Portfolio Only', description: 'Focus on deals and companies in our portfolio' },
    { value: 'market', label: '📈 Market Research', description: 'Market trends, competitors, and industry analysis' },
    { value: 'regulatory', label: '⚖️ Regulatory & Legal', description: 'Regulatory environment and legal considerations' },
    { value: 'financial', label: '💰 Financial Analysis', description: 'Financial metrics, valuations, and projections' }
  ];

  // Fetch performance metrics
  const { data: metricsData } = useQuery({
    queryKey: ['/api/ai-assistant/metrics'],
    queryFn: async () => {
      const response = await fetch('/api/ai-assistant/metrics');
      return response.json();
    },
    staleTime: 1000 * 30, // 30 seconds
    refetchInterval: 1000 * 30,
  });

  useEffect(() => {
    if (metricsData?.metrics) {
      setPerformanceMetrics(metricsData.metrics);
    }
  }, [metricsData]);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Send message mutation
  const sendMessageMutation = useMutation({
    mutationFn: async ({ message, context }: { message: string; context: string }) => {
      const userMessage: Message = {
        id: Date.now().toString(),
        role: 'user',
        content: message,
        timestamp: new Date(),
      };

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: '',
        timestamp: new Date(),
      };

      setMessages(prev => [...prev, userMessage, assistantMessage]);
      setIsStreaming(true);

      try {
        const response = await fetch('/api/ai-assistant/global', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            message: message.trim(),
            context,
            conversationHistory: messages.slice(-10).map(m => ({
              role: m.role,
              content: m.content
            }))
          }),
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const reader = response.body?.getReader();
        if (!reader) throw new Error('No response body');

        let fullResponse = '';
        
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = new TextDecoder().decode(value);
          const lines = chunk.split('\n');

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const data = line.slice(6);
              if (data === '[DONE]') return;
              
              try {
                const parsed = JSON.parse(data);
                if (parsed.content) {
                  fullResponse += parsed.content;
                  setMessages(prev => prev.map(msg => 
                    msg.id === assistantMessage.id 
                      ? { ...msg, content: fullResponse }
                      : msg
                  ));
                }
              } catch (e) {
                console.warn('Failed to parse chunk:', data);
              }
            }
          }
        }

        return fullResponse;
      } finally {
        setIsStreaming(false);
      }
    },
    onError: (error: any) => {
      console.error('❌ Global AI Assistant error:', error);
      setIsStreaming(false);
      
      // Update the last assistant message with error
      setMessages(prev => 
        prev.map((msg, index) => 
          index === prev.length - 1 && msg.role === 'assistant'
            ? { ...msg, content: `I apologize, but I encountered an error: ${error.message || 'Unknown error'}. Please try again.` }
            : msg
        )
      );
      
      toast({
        title: "Assistant Error",
        description: error.message || "Failed to get response from AI assistant",
        variant: "destructive",
      });
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isStreaming) return;

    const message = input.trim();
    setInput('');
    
    sendMessageMutation.mutate({
      message,
      context: selectedContext
    });
  };

  const handleExampleQuery = (query: string) => {
    if (isStreaming) return;
    setInput(query);
    setTimeout(() => {
      sendMessageMutation.mutate({
        message: query,
        context: selectedContext
      });
      setInput('');
    }, 100);
  };

  const stopProcessing = () => {
    setIsStreaming(false);
    // Update last message to indicate it was stopped
    setMessages(prev => 
      prev.map((msg, index) => 
        index === prev.length - 1 && msg.role === 'assistant' && !msg.content
          ? { ...msg, content: '*Response stopped by user*' }
          : msg
      )
    );
  };

  const clearConversation = () => {
    setMessages([]);
    toast({
      title: "Conversation Cleared",
      description: "All messages have been removed.",
    });
  };

  return (
    <div className="w-full h-full px-1 sm:px-2 pt-0 pb-0 overflow-auto">
      <PageHeader 
        title="Aescuvest AI Assistant" 
        description="Your intelligent investment analysis companion with access to portfolio data, market research, and global insights."
      />
      
      {/* Context Selection and Controls */}
      <div className="mb-3 sm:mb-4 lg:mb-6 grid grid-cols-1 lg:grid-cols-3 gap-2 sm:gap-3 lg:gap-4">
        <Card className="lg:col-span-2 bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 border-blue-200 dark:border-blue-800">
          <CardContent className="pt-3 sm:pt-4 lg:pt-6 pb-3 sm:pb-4 lg:pb-6">
            <div className="flex items-end gap-2 sm:gap-3 lg:gap-4">
              <div className="flex-1">
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 block">
                  AI Context & Scope
                </label>
                <Select value={selectedContext} onValueChange={setSelectedContext}>
                  <SelectTrigger className="bg-white/80 dark:bg-gray-800/80 border-blue-200 dark:border-blue-700 h-10">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {contextOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        <div>
                          <div className="font-medium">{option.label}</div>
                          <div className="text-xs text-muted-foreground">{option.description}</div>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowMetrics(!showMetrics)}
                  className="whitespace-nowrap h-10"
                >
                  <Gauge className="h-4 w-4 mr-1" />
                  Metrics
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={clearConversation}
                  disabled={messages.length === 0}
                  className="whitespace-nowrap h-10"
                >
                  <History className="h-4 w-4 mr-1" />
                  Clear
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Stats Overview */}
        <Card className="bg-gradient-to-br from-green-50 to-blue-50 dark:from-green-900/20 dark:to-blue-900/20 border-green-200 dark:border-green-800">
          <CardContent className="pt-3 sm:pt-4 lg:pt-6 pb-3 sm:pb-4 lg:pb-6">
            <div className="text-center">
              <Brain className="h-8 w-8 text-green-600 mx-auto mb-2" />
              <div className="text-2xl font-bold text-green-900 dark:text-green-100">
                {messages.filter(m => m.role === 'assistant').length}
              </div>
              <div className="text-xs text-green-700 dark:text-green-300">AI Responses</div>
              <div className="text-xs text-muted-foreground mt-1">This Session</div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Performance Metrics Dashboard */}
      {showMetrics && performanceMetrics && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
          className="mb-3 sm:mb-4 lg:mb-6"
        >
          <Card className="bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 border-purple-200 dark:border-purple-800">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Zap className="h-5 w-5 text-purple-600" />
                  Global AI Assistant Performance
                </CardTitle>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowMetrics(false)}
                >
                  Hide
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2 sm:gap-3 lg:gap-4">
                <div className="text-center p-2 sm:p-3 lg:p-4 bg-white dark:bg-gray-800 rounded-lg shadow-sm">
                  <Zap className="h-6 w-6 text-yellow-500 mx-auto mb-2" />
                  <div className="text-xs text-gray-600 dark:text-gray-400 mb-1">Average Response</div>
                  <div className="font-bold text-xl text-gray-900 dark:text-gray-100">
                    {performanceMetrics.averageResponseTime?.toFixed(0) || 0}ms
                  </div>
                </div>
                
                <div className="text-center p-2 sm:p-3 lg:p-4 bg-white dark:bg-gray-800 rounded-lg shadow-sm">
                  <BarChart3 className="h-6 w-6 text-green-500 mx-auto mb-2" />
                  <div className="text-xs text-gray-600 dark:text-gray-400 mb-1">Success Rate</div>
                  <div className="font-bold text-xl text-gray-900 dark:text-gray-100">
                    {(performanceMetrics.successRate * 100)?.toFixed(1) || 0}%
                  </div>
                </div>
                
                <div className="text-center p-2 sm:p-3 lg:p-4 bg-white dark:bg-gray-800 rounded-lg shadow-sm">
                  <Target className="h-6 w-6 text-blue-500 mx-auto mb-2" />
                  <div className="text-xs text-gray-600 dark:text-gray-400 mb-1">Total Queries</div>
                  <div className="font-bold text-xl text-gray-900 dark:text-gray-100">
                    {performanceMetrics.totalQueries || 0}
                  </div>
                </div>
                
                <div className="text-center p-2 sm:p-3 lg:p-4 bg-white dark:bg-gray-800 rounded-lg shadow-sm">
                  <Database className="h-6 w-6 text-purple-500 mx-auto mb-2" />
                  <div className="text-xs text-gray-600 dark:text-gray-400 mb-1">Cache Hit Rate</div>
                  <div className="font-bold text-xl text-gray-900 dark:text-gray-100">
                    {(performanceMetrics.cacheHitRate * 100)?.toFixed(1) || 0}%
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Main Chat Interface */}
      <Card className="bg-gradient-to-br from-white to-blue-50/30 dark:from-gray-900 dark:to-blue-900/10 border-2 border-blue-200 dark:border-blue-900 shadow-xl flex-1 flex flex-col">
        <CardContent className="flex-1 flex flex-col p-0 relative">
          {/* Chat Messages - Scrollable Area */}
          <div className="flex-1 overflow-hidden">
            <ScrollArea className="h-full">
              <div className="pl-[40px] pr-[40px] pt-[248px] pb-4">
            <AnimatePresence>
              {messages.length === 0 ? (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="text-center py-20"
                >
                  <div className="bg-gradient-to-br from-blue-500 to-purple-600 p-6 rounded-full shadow-lg mx-auto mb-6 w-fit">
                    <Bot className="h-12 w-12 text-white" />
                  </div>
                  <h3 className="text-2xl font-bold mb-4 bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                    Global Investment Intelligence Ready
                  </h3>
                  <p className="text-muted-foreground mb-8 max-w-2xl mx-auto">
                    Your AI assistant with comprehensive access to portfolio data, market research, web search, 
                    and global investment intelligence. Ask anything from specific deal analysis to general market trends.
                  </p>
                  
                  {/* Example Queries Grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3 max-w-4xl mx-auto">
                    {exampleQueries.slice(0, 6).map((query, idx) => (
                      <Button
                        key={idx}
                        variant="outline"
                        size="sm"
                        onClick={() => handleExampleQuery(query)}
                        className="text-sm p-2 sm:p-3 h-auto text-left hover:bg-blue-50 dark:hover:bg-blue-900/30 border-blue-200 dark:border-blue-800"
                      >
                        <Sparkles className="h-4 w-4 mr-2 flex-shrink-0 text-blue-500" />
                        <span className="truncate">{query}</span>
                      </Button>
                    ))}
                  </div>
                </motion.div>
              ) : (
                <div className="space-y-3 sm:space-y-4 lg:space-y-6">
                  {messages.map((message) => (
                    <motion.div
                      key={message.id}
                      initial={{ opacity: 0, x: message.role === 'user' ? 20 : -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      className={cn(
                        "flex gap-2 sm:gap-3 lg:gap-4",
                        message.role === 'user' ? 'justify-end' : 'justify-start'
                      )}
                    >
                      {message.role === 'assistant' && (
                        <div className="bg-gradient-to-br from-blue-500 to-purple-600 p-3 rounded-lg shadow-md flex-shrink-0">
                          <Bot className="h-5 w-5 text-white" />
                        </div>
                      )}
                      <div
                        className={cn(
                          "max-w-[90%] sm:max-w-[85%] rounded-lg p-3 sm:p-4 shadow-sm",
                          message.role === 'user'
                            ? 'bg-gradient-to-r from-blue-500 to-purple-600 text-white'
                            : 'bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700'
                        )}
                      >
                        {message.content ? (
                          message.role === 'assistant' ? (
                            <div className="prose prose-sm max-w-none dark:prose-invert">
                              <ReactMarkdown 
                                remarkPlugins={[remarkGfm]}
                                components={{
                                  h1: ({ children }) => <h1 className="text-lg font-bold text-blue-900 dark:text-blue-100 mb-3">{children}</h1>,
                                  h2: ({ children }) => <h2 className="text-base font-semibold text-gray-800 dark:text-gray-200 mb-2 border-b border-gray-200 dark:border-gray-600 pb-1">{children}</h2>,
                                  h3: ({ children }) => <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{children}</h3>,
                                  p: ({ children }) => <p className="text-sm leading-relaxed mb-3 text-gray-700 dark:text-gray-300">{children}</p>,
                                  ul: ({ children }) => <ul className="text-sm list-disc pl-5 mb-3 space-y-1">{children}</ul>,
                                  ol: ({ children }) => <ol className="text-sm list-decimal pl-5 mb-3 space-y-1">{children}</ol>,
                                  li: ({ children }) => <li className="text-gray-700 dark:text-gray-300">{children}</li>,
                                  strong: ({ children }) => <strong className="font-semibold text-blue-900 dark:text-blue-200">{children}</strong>,
                                  em: ({ children }) => <em className="italic text-gray-600 dark:text-gray-400">{children}</em>,
                                  blockquote: ({ children }) => (
                                    <blockquote className="border-l-4 border-blue-500 pl-4 italic text-gray-600 dark:text-gray-400 bg-blue-50 dark:bg-blue-900/20 p-3 rounded-r mb-3">
                                      {children}
                                    </blockquote>
                                  ),
                                  code: ({ children }) => (
                                    <code className="bg-gray-100 dark:bg-gray-700 px-1.5 py-0.5 rounded text-xs font-mono">
                                      {children}
                                    </code>
                                  ),
                                  table: ({ children }) => (
                                    <div className="overflow-x-auto mb-4">
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
                        <div className="bg-gray-200 dark:bg-gray-700 p-3 rounded-lg flex-shrink-0">
                          <MessageSquare className="h-5 w-5" />
                        </div>
                      )}
                    </motion.div>
                  ))}
                  <div ref={messagesEndRef} />
                </div>
              )}
              </AnimatePresence>
              </div>
            </ScrollArea>
          </div>

          {/* Input Form - Fixed at Bottom */}
          <div className="border-t border-gray-200 dark:border-gray-700 bg-white/95 dark:bg-gray-900/95 backdrop-blur">
            <form onSubmit={handleSubmit} className="flex gap-2 sm:gap-3 p-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask about investments, market trends, regulatory updates, or any general business questions..."
                className="pl-10 pr-4 bg-white/90 dark:bg-gray-900/90 backdrop-blur border-blue-200 dark:border-blue-900 focus:border-blue-500 h-10 sm:h-11 lg:h-12 text-sm sm:text-base"
                disabled={isStreaming}
              />
            </div>
            
            {/* Stop/Send buttons */}
            {isStreaming ? (
              <Button
                type="button"
                onClick={stopProcessing}
                variant="destructive"
                className="bg-red-500 hover:bg-red-600 text-white shadow-lg h-10 sm:h-11 lg:h-12 px-3 sm:px-4"
                title="Stop AI processing"
              >
                <Square className="h-4 w-4" />
              </Button>
            ) : (
              <Button
                type="submit"
                disabled={!input.trim()}
                className="bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white shadow-lg h-10 sm:h-11 lg:h-12 px-4 sm:px-5 lg:px-6"
              >
                <Send className="h-4 w-4" />
              </Button>
            )}
            </form>
          </div>

        </CardContent>
      </Card>
    </div>
  );
}