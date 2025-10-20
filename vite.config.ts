import { defineConfig, loadEnv } from "vite";
import dyadComponentTagger from "@dyad-sh/react-vite-component-tagger";
import react from "@vitejs/plugin-react-swc";
import path from "path";
// Removed: import { fetchCreatedAssets } from "./api/getCreatedAssets";
import projectDetailsHandler from "./api/project-details"; // Import the new handler
// Removed: import type { VercelRequest, VercelResponse } from '@vercel/node'; // Import Vercel types for emulation

// Removed: Regex for the new asset snapshot endpoint
// const assetSnapshotRegex = /^\/api\/v1\/asset\/([^\/]+)\/snapshot\/([^\/]+)$/;

export default defineConfig(({ mode }) => {
  // Carrega as variáveis de ambiente do arquivo .env apropriado (ex: .env.local)
  // O terceiro parâmetro '' garante que todas as variáveis sejam carregadas, não apenas as com prefixo VITE_
  process.env = { ...process.env, ...loadEnv(mode, process.cwd(), '') };

  return {
    server: {
      host: "::",
      port: 8080,
    },
    plugins: [
      dyadComponentTagger(),
      react(),
      // Custom plugin to emulate Vercel serverless functions in development
      {
        name: 'vite-plugin-vercel-api-emulator',
        configureServer(server) {
          server.middlewares.use(async (req, res, next) => {
            // --- Emulate /api/project-details ---
            if (req.url === '/api/project-details') {
              const mockRequest: { method?: string; body: any } = {
                method: req.method,
                body: await getRequestBody(req), // Parse body for POST requests
              };

              const mockResponse: { status: (code: number) => any; json: (data: any) => void } = {
                status: (statusCode: number) => {
                  res.statusCode = statusCode;
                  return mockResponse;
                },
                json: (data: any) => {
                  res.setHeader('Content-Type', 'application/json');
                  res.end(JSON.stringify(data));
                },
                // Removed send and setHeader methods as they are handled by status/json
              };

              try { // ADDED TRY-CATCH BLOCK HERE
                await projectDetailsHandler(mockRequest, mockResponse);
              } catch (error) {
                console.error("Error in API emulator for /api/project-details:", error);
                const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred.';
                // Ensure a response is sent even if the handler fails
                if (!res.headersSent) {
                  res.statusCode = 500;
                  res.setHeader('Content-Type', 'application/json');
                  res.end(JSON.stringify({ error: errorMessage }));
                }
              }
              return;
            }
            next(); // Pass to the next middleware if the URL doesn't match
          });
        }
      }
    ],
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
    define: {
      'global': 'window',
    }
  };
});

// Helper function to parse request body for emulation
async function getRequestBody(req: any): Promise<any> {
  return new Promise((resolve) => {
    if (req.method === 'POST' || req.method === 'PUT' || req.method === 'PATCH') {
      let body = '';
      req.on('data', (chunk: string) => {
        body += chunk;
      });
      req.on('end', () => {
        try {
          resolve(JSON.parse(body));
        } catch (e) {
          resolve(body); // Return raw body if not JSON
        }
      });
    } else {
      resolve(undefined);
    }
  });
}