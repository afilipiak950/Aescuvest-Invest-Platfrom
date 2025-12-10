import { WebSocketServer, WebSocket } from 'ws';
import { Server } from 'http';

interface JobProgress {
  jobId: string | number;
  jobType?: string;
  progress: number;
  status: string;
  currentStep: string;
  documentName?: string;
  error?: string;
}

class WebSocketManager {
  private wss: WebSocketServer | null = null;
  private clients: Map<WebSocket, { dealId?: number; lastPong?: number }> = new Map();
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private readonly HEARTBEAT_INTERVAL = 10000; // 10 seconds - keeps connections alive during long operations
  private readonly PONG_TIMEOUT = 30000; // 30 seconds - disconnect if no response

  initialize(server: Server) {
    this.wss = new WebSocketServer({ 
      server, 
      path: '/ws'
    });

    this.wss.on('connection', (ws: WebSocket, req: any) => {
      console.log('📡 WebSocket client connected');
      
      // Store client with metadata and last pong time
      this.clients.set(ws, { lastPong: Date.now() });
      
      // Handle pong responses from client
      ws.on('pong', () => {
        const clientData = this.clients.get(ws);
        if (clientData) {
          clientData.lastPong = Date.now();
          this.clients.set(ws, clientData);
        }
      });

      ws.on('message', (message: string) => {
        try {
          const data = JSON.parse(message);
          if (data.type === 'subscribe' && data.dealId) {
            // Subscribe client to deal updates
            const clientData = this.clients.get(ws);
            if (clientData) {
              clientData.dealId = data.dealId;
              this.clients.set(ws, clientData);
              console.log(`📡 Client subscribed to deal ${data.dealId} (type: ${typeof data.dealId}) - now ${this.clients.size} active subscriptions`);
            }
          }
        } catch (error) {
          console.error('Error parsing WebSocket message:', error);
        }
      });

      ws.on('close', () => {
        console.log('📡 WebSocket client disconnected');
        this.clients.delete(ws);
      });

      ws.on('error', (error) => {
        console.error('WebSocket error:', error);
        this.clients.delete(ws);
      });
    });

    console.log('📡 WebSocket manager initialized for background job progress tracking');
    
    // Start heartbeat to keep connections alive during long operations
    this.startHeartbeat();
  }

  /**
   * Start heartbeat mechanism to keep WebSocket connections alive
   * Critical for long-running agent operations (1000+ docs)
   */
  private startHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }

    this.heartbeatInterval = setInterval(() => {
      const now = Date.now();
      let activeCount = 0;
      let terminatedCount = 0;

      this.clients.forEach((clientData, ws) => {
        if (ws.readyState === WebSocket.OPEN) {
          // Check if client has responded to previous pings
          const lastPong = clientData.lastPong || now;
          if (now - lastPong > this.PONG_TIMEOUT) {
            console.log('⚠️ WebSocket client timed out, terminating connection');
            ws.terminate();
            this.clients.delete(ws);
            terminatedCount++;
            return;
          }

          // Send ping to keep connection alive
          try {
            ws.ping();
            activeCount++;
          } catch (error) {
            console.error('❌ Error sending WebSocket ping:', error);
            this.clients.delete(ws);
          }
        } else {
          // Clean up dead connections
          this.clients.delete(ws);
        }
      });

      if (activeCount > 0) {
        console.log(`💓 WebSocket heartbeat: ${activeCount} active connections`);
      }
      if (terminatedCount > 0) {
        console.log(`🧹 WebSocket cleanup: ${terminatedCount} timed-out connections terminated`);
      }
    }, this.HEARTBEAT_INTERVAL);

    console.log(`💓 WebSocket heartbeat started (interval: ${this.HEARTBEAT_INTERVAL / 1000}s)`);
  }

  // Generic broadcast method for any message type
  broadcast(type: string, data: any, dealId?: number) {
    if (!this.wss) {
      console.log('❌ WebSocket server not initialized');
      return;
    }

    const message = JSON.stringify({
      type,
      data
    });

    let sentCount = 0;
    let skippedCount = 0;
    console.log(`📡 Broadcasting ${type} to clients (target dealId: ${dealId}, type: ${typeof dealId})`);
    
    this.clients.forEach((clientData, ws) => {
      console.log(`  - Client dealId: ${clientData.dealId} (type: ${typeof clientData.dealId}), readyState: ${ws.readyState}`);
      if (ws.readyState === WebSocket.OPEN) {
        // Send to all clients or filter by dealId
        // CRITICAL: Ensure type comparison works (both should be numbers)
        const shouldSend = !dealId || clientData.dealId === dealId;
        if (shouldSend) {
          ws.send(message);
          sentCount++;
          console.log(`  ✅ SENT to client (dealId match: ${clientData.dealId} === ${dealId})`);
        } else {
          skippedCount++;
          console.log(`  ⏭️ SKIPPED client (dealId mismatch: ${clientData.dealId} !== ${dealId})`);
        }
      }
    });

    console.log(`📡 Broadcast ${type}: sent to ${sentCount} clients, skipped ${skippedCount}`);
  }

  broadcastJobProgress(progress: JobProgress, dealId?: number) {
    if (!this.wss) {
      console.log('❌ WebSocket server not initialized');
      return;
    }

    const message = JSON.stringify({
      type: 'job_progress',
      data: progress
    });

    let sentCount = 0;
    this.clients.forEach((clientData, ws) => {
      if (ws.readyState === WebSocket.OPEN) {
        // Send to all clients or filter by dealId
        if (!dealId || clientData.dealId === dealId) {
          ws.send(message);
          sentCount++;
        }
      }
    });

    console.log(`📡 Broadcasted job progress to ${sentCount} clients for job ${progress.jobId}`);
  }

  broadcastJobComplete(jobId: number, result: any, dealId?: number) {
    if (!this.wss) return;

    const message = JSON.stringify({
      type: 'job_complete',
      data: { jobId, result }
    });

    this.clients.forEach((clientData, ws) => {
      if (ws.readyState === WebSocket.OPEN) {
        if (!dealId || clientData.dealId === dealId) {
          ws.send(message);
        }
      }
    });
  }

  broadcastJobCancellation(jobId: number, dealId?: number) {
    if (!this.wss) return;

    const message = JSON.stringify({
      type: 'job_cancelled',
      data: { jobId, dealId }
    });

    this.clients.forEach((clientData, ws) => {
      if (ws.readyState === WebSocket.OPEN) {
        if (!dealId || clientData.dealId === dealId) {
          ws.send(message);
        }
      }
    });

    console.log(`📡 Broadcasted job cancellation for job ${jobId} to clients`);
  }

  /**
   * Broadcast to specific room (EXACTLY like Clinical agent expects)
   */
  broadcastToRoom(room: string, eventType: string, data: any) {
    if (!this.wss) {
      console.log('❌ WebSocket server not initialized');
      return;
    }

    const message = JSON.stringify({
      type: eventType,
      data: data
    });

    // Extract dealId from room format "deal-{dealId}"
    const dealIdMatch = room.match(/deal-(\d+)/);
    const dealId = dealIdMatch ? parseInt(dealIdMatch[1]) : null;

    let sentCount = 0;
    this.clients.forEach((clientData, ws) => {
      if (ws.readyState === WebSocket.OPEN) {
        // Send to all clients or filter by dealId
        if (!dealId || clientData.dealId === dealId) {
          ws.send(message);
          sentCount++;
        }
      }
    });

    console.log(`📡 Broadcasted to room ${room} (${eventType}): ${sentCount} clients`);
  }

  getActiveConnections(): number {
    return this.clients.size;
  }

  // Production safety: Cleanup WebSocket connections
  cleanup() {
    // Stop heartbeat
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
    
    if (this.wss) {
      console.log('🧹 Closing WebSocket server...');
      
      // Close all active connections gracefully
      this.clients.forEach((_, ws) => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.close(1000, 'Server shutdown');
        }
      });
      
      this.wss.close();
      this.clients.clear();
    }
  }
  
  // Handle process termination for production deployments
  initializeShutdownHandlers() {
    const cleanup = () => {
      console.log('🛑 WebSocket graceful shutdown initiated...');
      this.cleanup();
    };
    
    process.on('SIGTERM', cleanup);
    process.on('SIGINT', cleanup);
    process.on('SIGUSR2', cleanup); // Nodemon restart
  }
}

export const websocketManager = new WebSocketManager();