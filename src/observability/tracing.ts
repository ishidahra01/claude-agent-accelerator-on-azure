/**
 * OpenTelemetry tracing integration for Azure Application Insights
 */

import { trace, context, SpanStatusCode } from '@opentelemetry/api';
import { NodeTracerProvider } from '@opentelemetry/sdk-trace-node';
import { Resource } from '@opentelemetry/resources';
import { ATTR_SERVICE_NAME, ATTR_SERVICE_VERSION } from '@opentelemetry/semantic-conventions';
import { SimpleSpanProcessor } from '@opentelemetry/sdk-trace-base';
import { useAzureMonitor } from '@azure/monitor-opentelemetry';

let tracingInitialized = false;
const tracer = trace.getTracer('azure-resource-analyzer', '1.0.0');

/**
 * Initialize OpenTelemetry tracing with Azure Application Insights
 */
export function initializeTracing(): void {
  if (tracingInitialized) {
    return;
  }

  const enableTracing = process.env.ENABLE_TRACING === 'true';
  const connectionString = process.env.APPLICATIONINSIGHTS_CONNECTION_STRING;

  if (!enableTracing) {
    console.log('Tracing is disabled');
    return;
  }

  if (!connectionString) {
    console.warn('APPLICATIONINSIGHTS_CONNECTION_STRING not set, tracing will not send data');
    return;
  }

  try {
    // Initialize Azure Monitor with OpenTelemetry
    useAzureMonitor({
      azureMonitorExporterOptions: {
        connectionString,
      },
    });

    console.log('OpenTelemetry tracing initialized with Azure Application Insights');
    tracingInitialized = true;
  } catch (error) {
    console.error('Failed to initialize tracing:', error);
  }
}

/**
 * Create a trace span for an operation
 */
export function createSpan(name: string, attributes?: Record<string, any>) {
  return tracer.startSpan(name, {
    attributes: attributes || {},
  });
}

/**
 * Execute function with tracing
 */
export async function withTracing<T>(
  operationName: string,
  fn: () => Promise<T>,
  attributes?: Record<string, any>
): Promise<T> {
  const span = createSpan(operationName, attributes);

  try {
    const result = await fn();
    span.setStatus({ code: SpanStatusCode.OK });
    return result;
  } catch (error) {
    span.setStatus({
      code: SpanStatusCode.ERROR,
      message: error instanceof Error ? error.message : 'Unknown error',
    });
    span.recordException(error as Error);
    throw error;
  } finally {
    span.end();
  }
}

/**
 * Add event to current span
 */
export function recordEvent(name: string, attributes?: Record<string, any>): void {
  const span = trace.getActiveSpan();
  if (span) {
    span.addEvent(name, attributes);
  }
}

/**
 * Add attribute to current span
 */
export function recordAttribute(key: string, value: any): void {
  const span = trace.getActiveSpan();
  if (span) {
    span.setAttribute(key, value);
  }
}
