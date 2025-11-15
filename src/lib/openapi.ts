import { OpenAPIRegistry, OpenApiGeneratorV3 } from '@asteasolutions/zod-to-openapi';

// Create a global registry for all OpenAPI schemas and routes
export const registry = new OpenAPIRegistry();

// Generate the OpenAPI document
export function generateOpenApiDocument() {
  const generator = new OpenApiGeneratorV3(registry.definitions);

  return generator.generateDocument({
    openapi: '3.0.0',
    info: {
      title: 'Express Call Campaign API',
      version: '1.0.0',
      description: 'API for managing call campaigns, schedules, and tasks',
    },
    servers: [
      {
        url: 'http://localhost:3000',
        description: 'Development server',
      },
    ],
  });
}

