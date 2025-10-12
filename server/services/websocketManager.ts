import { WebSocketServer, WebSocket } from 'ws';
import { Server } from 'http';

interface JobProgress {
  jobId: string | number;
  progress: number;
  status: string;
  currentStep: string;
  documentName?: string;
  error?: string;
}

class WebSocketManager {
  private wss: WebSocketServer | null = null;
  private clients: Map<WebSocket, { dealId?: number }> = new Map();

  initialize(server: Server) {
    this.wss = new WebSocketServer({ 
      server, 
      path: '/ws'
    });

    this.wss.on('connection', (ws: WebSocket, req: any) => {
      console.log('📡 WebSocket client connected');
      
      // Store client with metadata
      this.clients.set(ws, {});

      ws.on('message', (message: string) => {
        try {
          const data = JSON.parse(message);
          if (data.type === 'subscribe' && data.dealId) {
            // Subscribe client to deal updates
            const clientData = this.clients.get(ws);
            if (clientData) {
              clientData.dealId = data.dealId;
              this.clients.set(ws, clientData);
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
    this.clients.forEach((clientData, ws) => {
      if (ws.readyState === WebSocket.OPEN) {
        // Send to all clients or filter by dealId
        if (!dealId || clientData.dealId === dealId) {
          ws.send(message);
          sentCount++;
        }
      }
    });

    console.log(`📡 Broadcast ${type}: sent to ${sentCount} clients`);
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