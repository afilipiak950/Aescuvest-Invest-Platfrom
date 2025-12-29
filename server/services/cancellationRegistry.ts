/**
 * In-Memory Cancellation Registry
 * 
 * Provides instant cancellation detection for background jobs without
 * requiring database reads. This is the authoritative source for
 * cancellation status during job execution.
 * 
 * Thread-safe singleton pattern ensures consistency across all workers.
 */

class CancellationRegistry {
  private cancelledJobs: Set<string> = new Set();
  private static instance: CancellationRegistry;

  private constructor() {}

  static getInstance(): CancellationRegistry {
    if (!CancellationRegistry.instance) {
      CancellationRegistry.instance = new CancellationRegistry();
    }
    return CancellationRegistry.instance;
  }

  /**
   * Mark a job as cancelled. Called by cancel endpoints.
   */
  cancel(jobId: string): void {
    this.cancelledJobs.add(jobId);
    console.log(`🛑 CancellationRegistry: Job ${jobId} marked as cancelled`);
  }

  /**
   * Mark multiple jobs as cancelled. Called by bulk cancel endpoints.
   */
  cancelMultiple(jobIds: string[]): void {
    for (const jobId of jobIds) {
      this.cancelledJobs.add(jobId);
    }
    console.log(`🛑 CancellationRegistry: ${jobIds.length} jobs marked as cancelled`);
  }

  /**
   * Check if a job is cancelled. O(1) lookup, no DB required.
   */
  isCancelled(jobId: string): boolean {
    return this.cancelledJobs.has(jobId);
  }

  /**
   * Remove a job from the registry (cleanup after job fully terminates).
   * Optional - jobs auto-expire, but this helps with memory.
   */
  cleanup(jobId: string): void {
    this.cancelledJobs.delete(jobId);
  }

  /**
   * Cleanup old entries periodically. Call with job IDs that are
   * confirmed complete/failed/cancelled in the database.
   */
  cleanupMultiple(jobIds: string[]): void {
    for (const jobId of jobIds) {
      this.cancelledJobs.delete(jobId);
    }
  }

  /**
   * Get count of tracked cancellations (for debugging).
   */
  size(): number {
    return this.cancelledJobs.size;
  }

  /**
   * Clear all cancellations (for testing/reset).
   */
  clear(): void {
    this.cancelledJobs.clear();
  }
}

export const cancellationRegistry = CancellationRegistry.getInstance();
