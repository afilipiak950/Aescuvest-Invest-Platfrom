// 🔍 DEBUG MODULE FOR 413 ERRORS
import { Request, Response, NextFunction } from 'express';

export const debug413Middleware = (req: Request, res: Response, next: NextFunction) => {
  // Log ALL requests to track what's happening
  const timestamp = new Date().toISOString();
  const contentLength = req.headers['content-length'] || 'unknown';
  const contentType = req.headers['content-type'] || 'unknown';
  
  console.log(`
🔍 [${timestamp}] REQUEST DEBUG:
- Path: ${req.path}
- Method: ${req.method}
- Content-Length: ${contentLength}
- Content-Type: ${contentType}
- User-Agent: ${req.headers['user-agent']}
- Host: ${req.headers['host']}
- Origin: ${req.headers['origin']}
- Environment: ${process.env.NODE_ENV}
- Platform: ${process.env.K_SERVICE ? 'Cloud Run' : process.env.REPL_ID ? 'Replit' : 'Unknown'}
`);

  // For upload routes, add extra debugging
  if (req.path.includes('upload') || req.path.includes('data-room')) {
    console.log('📦 UPLOAD ROUTE DETECTED - Special handling active');
    
    // Check if body parsers are active (they shouldn't be)
    if ((req as any).body && Object.keys((req as any).body).length > 0) {
      console.error('❌ WARNING: Body parser is active on upload route!');
    }
    
    // Check content length against various limits
    const contentLengthNum = parseInt(contentLength as string) || 0;
    const limits = [
      { name: '32MB (Cloud Run default)', size: 32 * 1024 * 1024 },
      { name: '100MB', size: 100 * 1024 * 1024 },
      { name: '500MB', size: 500 * 1024 * 1024 },
      { name: '1GB', size: 1024 * 1024 * 1024 }
    ];
    
    limits.forEach(limit => {
      if (contentLengthNum > limit.size) {
        console.warn(`⚠️ File exceeds ${limit.name}: ${contentLengthNum} > ${limit.size}`);
      }
    });
  }
  
  // Track response to catch 413 errors
  const originalSend = res.send;
  res.send = function(data: any) {
    if (res.statusCode === 413) {
      console.error(`
🚨 413 ERROR CAUGHT:
- Path: ${req.path}
- Content-Length: ${contentLength}
- Response: ${data}
- Stack: ${new Error().stack}
`);
    }
    return originalSend.call(this, data);
  };
  
  next();
};

export const bypass413Middleware = (req: Request, res: Response, next: NextFunction) => {
  // For upload routes, attempt to bypass all limits
  if (req.path.includes('upload') || req.path.includes('data-room')) {
    // Remove content-length header to bypass some checks
    // delete req.headers['content-length'];
    
    // Set request size to unlimited
    (req as any).maxRequestSize = Infinity;
    
    // Disable all timeouts
    req.setTimeout(0);
    res.setTimeout(0);
    
    console.log('🔧 413 BYPASS: Removed limits for upload route');
  }
  
  next();
};