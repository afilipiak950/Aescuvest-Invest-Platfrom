import React from 'react';

/**
 * Comprehensive Component Validation System
 * 
 * This utility prevents undefined component errors by:
 * 1. Validating component existence before rendering
 * 2. Providing fallback components for missing references
 * 3. Logging detailed error information for debugging
 */

interface ComponentValidationProps {
  component: React.ComponentType<any> | undefined;
  fallbackComponent?: React.ComponentType<any>;
  componentName: string;
  props?: any;
  children?: React.ReactNode;
}

/**
 * Safe Component Renderer
 * Validates component existence and provides fallback
 */
export function SafeComponentRenderer({ 
  component: Component, 
  fallbackComponent: FallbackComponent,
  componentName,
  props = {},
  children 
}: ComponentValidationProps) {
  // Check if component is defined
  if (!Component || typeof Component !== 'function') {
    console.error(`⚠️ COMPONENT VALIDATION ERROR: ${componentName} is not defined or not a valid component`);
    console.error(`Component type:`, typeof Component);
    console.error(`Component value:`, Component);
    
    // Use fallback component if provided
    if (FallbackComponent) {
      console.warn(`🔄 Using fallback component for ${componentName}`);
      return <FallbackComponent {...props}>{children}</FallbackComponent>;
    }
    
    // Default fallback
    return (
      <div className="bg-red-900/20 border border-red-500/30 rounded-lg p-4 text-center">
        <div className="text-red-400 mb-2">Component Error</div>
        <div className="text-gray-300 text-sm">
          The component "{componentName}" is not available. This has been logged for debugging.
        </div>
      </div>
    );
  }
  
  // Render the component safely
  try {
    return <Component {...props}>{children}</Component>;
  } catch (error) {
    console.error(`⚠️ COMPONENT RENDER ERROR: Failed to render ${componentName}:`, error);
    
    return (
      <div className="bg-red-900/20 border border-red-500/30 rounded-lg p-4 text-center">
        <div className="text-red-400 mb-2">Render Error</div>
        <div className="text-gray-300 text-sm">
          The component "{componentName}" failed to render. Error logged for debugging.
        </div>
      </div>
    );
  }
}

/**
 * Component Existence Validator
 * Checks if a component is properly defined before use
 */
export function validateComponent(component: any, componentName: string): boolean {
  const isValid = component && typeof component === 'function';
  
  if (!isValid) {
    console.error(`⚠️ VALIDATION FAILED: ${componentName} is not a valid component`);
    console.error(`Type: ${typeof component}, Value:`, component);
  }
  
  return isValid;
}

/**
 * Batch Component Validator
 * Validates multiple components at once
 */
export function validateComponents(components: Record<string, any>): Record<string, boolean> {
  const results: Record<string, boolean> = {};
  
  Object.entries(components).forEach(([name, component]) => {
    results[name] = validateComponent(component, name);
  });
  
  const failedComponents = Object.entries(results)
    .filter(([_, isValid]) => !isValid)
    .map(([name]) => name);
  
  if (failedComponents.length > 0) {
    console.error(`⚠️ BATCH VALIDATION FAILED: The following components are invalid:`, failedComponents);
  }
  
  return results;
}

/**
 * Runtime Component Monitor
 * Monitors for undefined component references during runtime
 */
export class ComponentMonitor {
  private static instance: ComponentMonitor;
  private errorLog: Array<{ component: string; error: string; timestamp: Date }> = [];
  
  static getInstance(): ComponentMonitor {
    if (!ComponentMonitor.instance) {
      ComponentMonitor.instance = new ComponentMonitor();
    }
    return ComponentMonitor.instance;
  }
  
  logError(componentName: string, error: string) {
    const entry = {
      component: componentName,
      error,
      timestamp: new Date()
    };
    
    this.errorLog.push(entry);
    console.error(`🚨 COMPONENT MONITOR: ${componentName} error logged:`, entry);
    
    // Keep only last 50 errors to prevent memory leaks
    if (this.errorLog.length > 50) {
      this.errorLog = this.errorLog.slice(-50);
    }
  }
  
  getErrorHistory(): Array<{ component: string; error: string; timestamp: Date }> {
    return [...this.errorLog];
  }
  
  clearHistory() {
    this.errorLog = [];
    console.log('🧹 Component error history cleared');
  }
}

// Initialize global component monitor
export const componentMonitor = ComponentMonitor.getInstance();

/**
 * Default Fallback Components
 */
export const DefaultFallbacks = {
  AnalysisProgress: ({ agentType = 'Unknown' }: { agentType?: string }) => (
    <div className="bg-gray-900/20 border border-gray-500/30 rounded-lg p-4 text-center">
      <div className="text-gray-400 mb-2">{agentType} Analysis</div>
      <div className="text-gray-300 text-sm">
        Analysis functionality is integrated into the main workflow
      </div>
    </div>
  ),
  
  AnalysisButton: ({ analysisType = 'Analysis' }: { analysisType?: string }) => (
    <div className="bg-gray-900/20 border border-gray-500/30 rounded-lg p-3 text-center">
      <div className="text-gray-400 text-sm">
        {analysisType} functionality integrated into main workflow
      </div>
    </div>
  ),
  
  QuestionsSection: ({ sectionType = 'Analysis' }: { sectionType?: string }) => (
    <div className="bg-gray-900/20 border border-gray-500/30 rounded-lg p-6 text-center">
      <div className="text-gray-400 mb-2">{sectionType} Section</div>
      <div className="text-gray-300 text-sm">
        This section is being restructured. Use the tabs above to view results.
      </div>
    </div>
  )
};