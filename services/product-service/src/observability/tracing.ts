import { getNodeAutoInstrumentations } from "@opentelemetry/auto-instrumentations-node";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
import { Resource } from "@opentelemetry/resources";
import { NodeSDK } from "@opentelemetry/sdk-node";
import {
  ATTR_SERVICE_INSTANCE_ID,
  ATTR_SERVICE_NAME,
} from "@opentelemetry/semantic-conventions";

let sdk: NodeSDK | null = null;

export async function initializeTracing(): Promise<void> {
  if (sdk) {
    return;
  }

  const endpoint =
    process.env.OTEL_EXPORTER_OTLP_ENDPOINT ?? "http://localhost:4318";
  const instanceId =
    process.env.INSTANCE_ID ?? `product-service-${process.pid}`;

  sdk = new NodeSDK({
    resource: new Resource({
      [ATTR_SERVICE_NAME]: "product-service",
      [ATTR_SERVICE_INSTANCE_ID]: instanceId,
    }),
    traceExporter: new OTLPTraceExporter({
      url: `${endpoint}/v1/traces`,
    }),
    instrumentations: [getNodeAutoInstrumentations()],
  });

  await sdk.start();

  const shutdown = async () => {
    if (!sdk) {
      return;
    }

    await sdk.shutdown();
    sdk = null;
  };

  process.once("SIGTERM", () => void shutdown());
  process.once("SIGINT", () => void shutdown());
}
