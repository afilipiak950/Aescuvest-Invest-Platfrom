import { useEffect, useRef, useState, useCallback } from 'react';

interface JobProgress {
  jobId: string | number;
  jobType?: string;
  progress: number;
  status: string;
  currentStep: string;
  documentName?: string;
  error?: string;
}

interface UseWebSocketProgressOptions {
  dealId?: string | null;
  enabled?: boolean;
  onProgress?: (progress: JobProgress) => void;
  onComplete?: (progress: JobProgress) => void;
  onError?: (error: string) => void;
}

export function useWebSocketProgress(options: UseWebSocketProgressOptions = {}) {
  const { dealId, enabled = true, onProgress, onComplete, onError } = options;
  const [latestProgress, setLatestProgress] = useState<JobProgress | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout>();
  const reconnectAttemptsRef = useRef(0);
  const maxReconnectAttempts = 5;

  const connect = useCallback(() => {
    if (!enabled || !dealId) {
      return;
    }

    // Don't reconnect if already connected
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      return;
    }

    try {
      // Create WebSocket connection
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}/ws`;
      
      console.log(`📡 Connecting to WebSocket: ${wsUrl}`);
      const ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        console.log('✅ WebSocket connected');
        setIsConnected(true);
        reconnectAttemptsRef.current = 0;

        // Subscribe to deal updates
        if (dealId) {
          ws.send(JSON.stringify({
            type: 'subscribe',
            dealId: parseInt(dealId)
          }));
          console.log(`📡 Subscribed to deal ${dealId} updates`);
        }
      };

      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          console.log('📨 WebSocket message received:', message);

          if (message.type === 'job_progress') {
            const progress = message.data as JobProgress;
            setLatestProgress(progress);
            
            // Call progress callback
            onProgress?.(progress);

            // Check for completion
            if (progress.status === 'completed' && progress.progress === 100) {
              console.log('✅ Job completed via WebSocket');
              onComplete?.(progress);
            } else if (progress.status === 'failed') {
              console.log('❌ Job failed via WebSocket');
              onError?.(progress.error || 'Job failed');
            }
          }
        } catch (error) {
          console.error('❌ Error parsing WebSocket message:', error);
        }
      };

      ws.onerror = (error) => {
        console.error('❌ WebSocket error:', error);
        setIsConnected(false);
      };

      ws.onclose = () => {
        console.log('📡 WebSocket disconnected');
        setIsConnected(false);
        wsRef.current = null;

        // Attempt reconnection with exponential backoff
        if (enabled && reconnectAttemptsRef.current < maxReconnectAttempts) {
          reconnectAttemptsRef.current += 1;
          const delay = Math.min(1000 * Math.pow(2, reconnectAttemptsRef.current - 1), 10000);
          console.log(`🔄 Reconnecting in ${delay}ms (attempt ${reconnectAttemptsRef.current}/${maxReconnectAttempts})`);
          
          reconnectTimeoutRef.current = setTimeout(() => {
            connect();
          }, delay);
        }
      };

      wsRef.current = ws;
    } catch (error) {
      console.error('❌ Failed to create WebSocket connection:', error);
      setIsConnected(false);
    }
  }, [dealId, enabled, onProgress, onComplete, onError]);

  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }

    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }

    setIsConnected(false);
    setLatestProgress(null);
  }, []);

  // Connect/disconnect based on enabled state and dealId
  useEffect(() => {
    if (enabled && dealId) {
      connect();
    } else {
      disconnect();
    }

    return () => {
      disconnect();
    };
  }, [enabled, dealId, connect, disconnect]);

  return {
    isConnected,
    latestProgress,
    disconnect
  };
}
