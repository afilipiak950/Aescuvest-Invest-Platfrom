import React, { useState, useRef, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { motion, AnimatePresence } from 'framer-motion';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import PageHeader from '@/components/layout/page-header';
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
  Star,
  Globe,
  Building2,
  Award,
  Briefcase
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';

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
    portfolioDeals: number;
  };
  responseTime?: number;
  confidence?: 'High' | 'Medium' | 'Low';
  queryType?: 'simple' | 'complex' | 'analytical' | 'cross-document';
}

interface SmartSuggestion {
  id: string;
  text: string;
  category: 'financial' | 'legal' | 'clinical' | 'commercial' | 'market' | 'regulatory' | 'general';
  icon: any;
  priority: number;
}

interface PerformanceMetrics {
  averageResponseTime: number;
  totalQueries: number;
  cacheHitRate: number;
  portfolioEmbeddingCoverage: number;
  conversationLength: number;
  successRate: number;
}

// Helper function to get icon for category
function getIconForCategory(category: string) {
  switch (category) {
    case 'financial': return DollarSign;
    case 'legal': return Shield;
    case 'clinical': return Award;
    case 'commercial': return Briefcase;
    case 'market': return TrendingUp;
    case 'regulatory': return Shield;
    default: return Lightbulb;
  }
}

export default function GlobalAIAssistant() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isExpanded, setIsExpanded] = useState(true);
  const [isStreaming, setIsStreaming] = useState(false);
  const [isContextLoaded, setIsContextLoaded] = useState(false);
  const [isPreloading, setIsPreloading] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(true);
  const [showMetrics, setShowMetrics] = useState(false);
  const [selectedContext, setSelectedContext] = useState<string>('all');
  // Generate default smart suggestions based on context
  const generateDefaultSuggestions = (): SmartSuggestion[] => {
    return [
      {
        id: '1',
        text: "What are the latest trends in HealthTech venture capital?",
        category: 'market' as const,
        icon: TrendingUp,
        priority: 1
      },
      {
        id: '2', 
        text: "Analyze the regulatory environment for medical devices in 2025",
        category: 'regulatory' as const,
        icon: Shield,
        priority: 2
      },
      {
        id: '3',
        text: "Compare our portfolio performance against industry benchmarks",
        category: 'financial' as const,
        icon: BarChart3,
        priority: 3
      },
      {
        id: '4',
        text: "What are the key success factors for Series A fundraising?",
        category: 'financial' as const,
        icon: Target,
        priority: 4
      }
    ];
  };

  const [smartSuggestions, setSmartSuggestions] = useState<SmartSuggestion[]>(generateDefaultSuggestions());
  const [performanceMetrics, setPerformanceMetrics] = useState<PerformanceMetrics | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const { toast } = useToast();

  // Context options for the assistant
  const contextOptions = [
    { value: 'all', label: '🌐 All Data & Web Search', description: 'Full access to portfolio, web, and general knowledge' },
    { value: 'portfolio', label: '📊 Portfolio Only', description: 'Focus on deals and companies in our portfolio' },
    { value: 'market', label: '📈 Market Research', description: 'Market trends, competitors, and industry analysis' },
    { value: 'regulatory', label: '⚖️ Regulatory & Legal', description: 'Regulatory environment and legal considerations' },
    { value: 'financial', label: '💰 Financial Analysis', description: 'Financial metrics, valuations, and projections' }
  ];

  // Fetch global context stats
  const { data: contextStats, isLoading: statsLoading } = useQuery({
    queryKey: ['/api/ai-assistant/global/stats'],
    queryFn: async () => {
      const response = await fetch('/api/ai-assistant/global/stats');
      if (!response.ok) throw new Error('Failed to fetch global AI context stats');
      return response.json();
    }
  });

  // Fetch smart suggestions based on context
  const { data: suggestions } = useQuery({
    queryKey: ['/api/ai-assistant/global/suggestions', selectedContext],
    queryFn: async () => {
      const response = await fetch(`/api/ai-assistant/global/suggestions?context=${selectedContext}`);
      if (!response.ok) return { suggestions: [] };
      return response.json();
    },
    enabled: isContextLoaded
  });

  // Fetch performance metrics
  const { data: metrics } = useQuery({
    queryKey: ['/api/ai-assistant/metrics'],
    queryFn: async () => {
      const response = await fetch('/api/ai-assistant/metrics');
      if (!response.ok) throw new Error('Failed to fetch performance metrics');
      return response.json();
    },
    enabled: showMetrics,
    refetchInterval: 5000 // Update every 5 seconds when visible
  });

  
  // Update smart suggestions when data changes
  useEffect(() => {
    if (suggestions?.suggestions && Array.isArray(suggestions.suggestions)) {
      // Map API suggestions to ensure they have valid icons
      const validSuggestions = suggestions.suggestions.map((suggestion: any) => ({
        ...suggestion,
        icon: getIconForCategory(suggestion.category || 'general')
      }));
      setSmartSuggestions(validSuggestions);
    } else {
      // Keep existing suggestions if API fails
      if (smartSuggestions.length === 0) {
        setSmartSuggestions(generateDefaultSuggestions());
      }
    }
  }, [suggestions, selectedContext]);

  // Update performance metrics
  useEffect(() => {
    if (metrics?.metrics) {
      setPerformanceMetrics(metrics.metrics);
    }
  }, [metrics]);

  // Pre-load context when component mounts for instant responses
  useEffect(() => {
    if (!isContextLoaded) {
      // Immediately mark as loading started
      setIsPreloading(true);
      
      // Set a hard timeout to guarantee we exit loading state
      const timeout = setTimeout(() => {
        console.log('⚡ Global AI Assistant ready (timeout fallback)');
        setIsPreloading(false);
        setIsContextLoaded(true);
      }, 2000); // 2 seconds for better UX
      
      // Pre-load context in the background
      fetch('/api/ai-assistant/global/preload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ context: selectedContext })
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
          console.log('🚀 Global AI Assistant context pre-loaded:', data.contextStats);
        }
      })
      .catch(err => {
        console.error('Failed to pre-load global context:', err);
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
  }, [selectedContext]); // Reload when context changes

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
    sendQueryMutation.mutate({ message: queryText, context: selectedContext });
  };

  const sendQueryMutation = useMutation({
    mutationFn: async ({ message, context }: { message: string; context: string }) => {
      // Create new AbortController for this request
      abortControllerRef.current = new AbortController();
      
      // Add user message immediately  
      const userId = `user-${Date.now()}`;
      const userMessage: Message = {
        id: userId,
        role: 'user',
        content: message,
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
        console.log(`🚀 FETCH STARTING - Global AI query to backend: "${message}" with context: ${context}`);
        
        const response = await fetch('/api/ai-assistant/global', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            message,
            context,
            conversationHistory: messages.slice(-10).map(m => ({
              role: m.role,
              content: m.content
            }))
          }),
          signal: abortControllerRef.current.signal
        }).catch(err => {
          console.error('🔥 FETCH FAILED:', err);
          throw err;
        });
        
        console.log('📡 Response received:', response.status, response.statusText);
        
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
                if (data === '[DONE]') continue;
                
                if (data) {
                  try {
                    const parsed = JSON.parse(data);
                    if (parsed.content) {
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
        console.error('🛑 Global AI Assistant request failed:', error);
        
        // Handle abort vs other errors
        if (error.name === 'AbortError') {
          console.log('✅ Request cancelled by user');
        } else {
          console.error('❌ Critical Global AI Assistant error:', error);
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
      sendQueryMutation.mutate({ message: query, context: selectedContext });
    }
  };

  // Example queries - enhanced for analyst-quality responses
  const exampleQueries = [
    "Provide comprehensive market analysis for healthcare technology trends in 2025",
    "Analyze regulatory pathways and key milestones across our portfolio sectors",
    "Compare investment returns and performance metrics across portfolio companies",
    "Identify emerging opportunities in AI and digital health markets", 
    "Assess critical risks and compliance requirements in our investment sectors",
    "Benchmark our portfolio against industry standards and competitors",
    "Quantify addressable market opportunities in key healthcare segments",
    "Evaluate management team capabilities across portfolio companies"
  ];

  const handleExampleQuery = (query: string) => {
    console.log('🎯 Example query clicked:', query);
    
    // Force clear any stuck state
    setIsStreaming(false);
    setIsPreloading(false);
    setIsContextLoaded(true);
    setIsExpanded(true);
    
    // Directly submit without setting input first
    console.log('🚀 Direct submission of example query');
    sendQueryMutation.mutate({ message: query, context: selectedContext });
  };

  // Stop function to cancel ongoing AI processing
  const stopProcessing = () => {
    console.log('🛑 Stopping Global AI Assistant processing...');
    
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
    
    console.log('✅ Global AI Assistant processing stopped');
  };

  const clearConversation = () => {
    setMessages([]);
    toast({
      title: "Conversation Cleared",
      description: "All messages have been removed.",
    });
  };

  return (
    <div className="w-full h-screen flex flex-col p-2 overflow-hidden">
      <div className="flex-shrink-0 mb-3">
        <PageHeader 
          title="Aescuvest AI Assistant" 
          description="Your intelligent investment analysis companion with access to portfolio data, market research, and global insights."
        />
      </div>
      
      {/* Context Selection and Controls */}
      <div className="mb-2 grid grid-cols-1 lg:grid-cols-3 gap-2 flex-shrink-0">
        <Card className="lg:col-span-2 bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 border-blue-200 dark:border-blue-800">
          <CardContent className="p-3">
            <div className="flex items-end gap-2">
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
          <CardContent className="p-3">
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
          className="mb-2 flex-shrink-0"
        >
          <Card className="bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 border-purple-200 dark:border-purple-800">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <Zap className="h-4 w-4 text-purple-600" />
                  Performance
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
            <CardContent className="pt-0">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                <div className="text-center p-2 bg-white dark:bg-gray-800 rounded-lg shadow-sm">
                  <Zap className="h-4 w-4 text-yellow-500 mx-auto mb-1" />
                  <div className="text-xs text-gray-600 dark:text-gray-400 mb-1">Response</div>
                  <div className="font-bold text-lg text-gray-900 dark:text-gray-100">
                    {performanceMetrics.averageResponseTime?.toFixed(0) || 0}ms
                  </div>
                </div>
                
                <div className="text-center p-2 bg-white dark:bg-gray-800 rounded-lg shadow-sm">
                  <BarChart3 className="h-4 w-4 text-green-500 mx-auto mb-1" />
                  <div className="text-xs text-gray-600 dark:text-gray-400 mb-1">Success</div>
                  <div className="font-bold text-lg text-gray-900 dark:text-gray-100">
                    {(performanceMetrics.successRate * 100)?.toFixed(1) || 0}%
                  </div>
                </div>
                
                <div className="text-center p-2 bg-white dark:bg-gray-800 rounded-lg shadow-sm">
                  <Target className="h-4 w-4 text-blue-500 mx-auto mb-1" />
                  <div className="text-xs text-gray-600 dark:text-gray-400 mb-1">Queries</div>
                  <div className="font-bold text-lg text-gray-900 dark:text-gray-100">
                    {performanceMetrics.totalQueries || 0}
                  </div>
                </div>
                
                <div className="text-center p-2 bg-white dark:bg-gray-800 rounded-lg shadow-sm">
                  <Database className="h-4 w-4 text-purple-500 mx-auto mb-1" />
                  <div className="text-xs text-gray-600 dark:text-gray-400 mb-1">Cache</div>
                  <div className="font-bold text-lg text-gray-900 dark:text-gray-100">
                    {(performanceMetrics.cacheHitRate * 100)?.toFixed(1) || 0}%
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Main Chat Interface */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="flex-1 flex flex-col min-h-0"
      >
        <Card className="relative overflow-hidden border-2 border-blue-200 dark:border-blue-900 bg-gradient-to-br from-blue-50/50 via-white to-purple-50/50 dark:from-gray-900 dark:via-gray-800 dark:to-blue-900/20 flex-1 flex flex-col min-h-0">
          {/* Animated background effect */}
          <div className="absolute inset-0 opacity-10">
            <div className="absolute inset-0 bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 animate-gradient-x" />
          </div>
          
          <CardHeader className="relative z-10 flex-shrink-0 pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="relative">
                  <div className="absolute inset-0 bg-blue-500 blur-lg opacity-50 animate-pulse" />
                  <div className="relative bg-gradient-to-br from-blue-500 to-purple-600 p-2 rounded-lg shadow-lg">
                    <BrainCircuit className="h-5 w-5 text-white" />
                  </div>
                </div>
                <div>
                  <CardTitle className="text-xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                    Global AI Assistant
                  </CardTitle>
                  <p className="text-xs text-muted-foreground">
                    {isPreloading ? (
                      <span className="flex items-center gap-1">
                        <Loader2 className="h-3 w-3 animate-spin" />
                        Loading global context...
                      </span>
                    ) : isContextLoaded ? (
                      <span className="text-green-600 flex items-center gap-1">
                        <TrendingUp className="h-3 w-3" />
                        Ready - Global investment intelligence
                      </span>
                    ) : (
                      'Elite global investment analysis with comprehensive portfolio and market access'
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
                className="flex flex-wrap gap-1 mt-2"
              >
                <Badge variant="secondary" className="bg-blue-100 dark:bg-blue-900/50">
                  <FileText className="h-3 w-3 mr-1" />
                  {contextStats.stats.documentsLoaded || 0} Documents
                </Badge>
                <Badge variant="secondary" className="bg-purple-100 dark:bg-purple-900/50">
                  <Bot className="h-3 w-3 mr-1" />
                  {contextStats.stats.agentAnalyses || 0} Agent Analyses
                </Badge>
                <Badge variant="secondary" className="bg-green-100 dark:bg-green-900/50">
                  <Building2 className="h-3 w-3 mr-1" />
                  {contextStats.stats.portfolioDeals || 0} Portfolio Deals
                </Badge>
                <Badge variant="secondary" className="bg-orange-100 dark:bg-orange-900/50">
                  <Database className="h-3 w-3 mr-1" />
                  {((contextStats.stats.totalContextSize || 0) / 1024 / 1024).toFixed(1)}MB Context
                </Badge>
                {contextStats.stats.hasCompanyInfo && (
                  <Badge variant="secondary" className="bg-pink-100 dark:bg-pink-900/50">
                    <CheckCircle2 className="h-3 w-3 mr-1" />
                    Global Intel Loaded
                  </Badge>
                )}
              </motion.div>
            )}
          </CardHeader>

          <CardContent className="relative z-10 flex-1 flex flex-col p-0 min-h-0">
            <AnimatePresence>
              {isExpanded && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: '100%', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.3 }}
                  className="flex-1 flex flex-col min-h-0"
                >
                  {/* Messages Area */}
                  <div className="flex-1 min-h-0">
                    <ScrollArea className="h-full">
                      <div className="px-4 py-4">
                        <AnimatePresence>
                          {messages.length === 0 ? (
                            <motion.div
                              initial={{ opacity: 0 }}
                              animate={{ opacity: 1 }}
                              className="text-center py-8"
                            >
                              <div className="bg-gradient-to-br from-blue-500 to-purple-600 p-4 rounded-full shadow-lg mx-auto mb-4 w-fit">
                                <Bot className="h-8 w-8 text-white" />
                              </div>
                              <h3 className="text-xl font-bold mb-3 bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                                Global Investment Intelligence Ready
                              </h3>
                              <p className="text-muted-foreground mb-4 max-w-2xl mx-auto text-sm">
                                Your AI assistant with comprehensive access to portfolio data, market research, web search, 
                                and global investment intelligence. Ask anything from specific deal analysis to general market trends.
                              </p>
                              
                              {/* Smart Suggestions */}
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-w-4xl mx-auto">
                                {(smartSuggestions || []).slice(0, 6).map((suggestion) => (
                                  <Button
                                    key={suggestion.id}
                                    variant="outline"
                                    size="sm"
                                    onClick={() => handleSuggestionClick(suggestion)}
                                    className="text-xs p-2 h-auto text-left hover:bg-blue-50 dark:hover:bg-blue-900/30 border-blue-200 dark:border-blue-800"
                                  >
                                    {suggestion.icon ? (
                                      <suggestion.icon className="h-3 w-3 mr-2 flex-shrink-0 text-blue-500" />
                                    ) : (
                                      <Lightbulb className="h-3 w-3 mr-2 flex-shrink-0 text-blue-500" />
                                    )}
                                    <span className="truncate">{suggestion.text}</span>
                                  </Button>
                                ))}
                              </div>
                            </motion.div>
                          ) : (
                            <div className="space-y-3">
                              {messages.map((message) => (
                                <motion.div
                                  key={message.id}
                                  initial={{ opacity: 0, x: message.role === 'user' ? 20 : -20 }}
                                  animate={{ opacity: 1, x: 0 }}
                                  className={cn(
                                    "flex gap-2",
                                    message.role === 'user' ? 'justify-end' : 'justify-start'
                                  )}
                                >
                                  {message.role === 'assistant' && (
                                    <div className="bg-gradient-to-br from-blue-500 to-purple-600 p-2 rounded-lg shadow-md flex-shrink-0">
                                      <Bot className="h-4 w-4 text-white" />
                                    </div>
                                  )}
                                  <div
                                    className={cn(
                                      "max-w-[85%] rounded-lg p-3 shadow-sm",
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
                                        <span className="text-xs text-muted-foreground">Thinking...</span>
                                      </div>
                                    )}
                                  </div>
                                  {message.role === 'user' && (
                                    <div className="bg-gray-200 dark:bg-gray-700 p-2 rounded-lg flex-shrink-0">
                                      <MessageSquare className="h-4 w-4" />
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
                  <div className="border-t border-gray-200 dark:border-gray-700 bg-white/95 dark:bg-gray-900/95 backdrop-blur flex-shrink-0">
                    <form onSubmit={handleSubmit} className="flex gap-2 p-3">
                      <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          value={input}
                          onChange={(e) => setInput(e.target.value)}
                          placeholder={`Ask me anything about ${contextOptions.find(c => c.value === selectedContext)?.label.replace(/🌐|📊|📈|⚖️|💰/g, '').trim() || 'investments'}...`}
                          className="pl-10 pr-4 py-2 bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 focus:border-blue-500 dark:focus:border-blue-400"
                          disabled={isStreaming}
                        />
                      </div>
                      <div className="flex gap-2">
                        {isStreaming ? (
                          <Button
                            type="button"
                            variant="outline"
                            onClick={stopProcessing}
                            className="hover:bg-red-50 dark:hover:bg-red-900/20 border-red-200 dark:border-red-800"
                          >
                            <Square className="h-4 w-4 mr-1" />
                            Stop
                          </Button>
                        ) : (
                          <Button
                            type="submit"
                            disabled={!input.trim() || isStreaming}
                            className="bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white border-0"
                          >
                            <Send className="h-4 w-4 mr-1" />
                            Send
                          </Button>
                        )}
                      </div>
                    </form>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}