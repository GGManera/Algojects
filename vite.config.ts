import { defineConfig, loadEnv } from "vite";
import dyadComponentTagger from "@dyad-sh/react-vite-component-tagger";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import projectDetailsHandler from "./api/project-details"; // Import the new handler
import type { VercelRequest, VercelResponse } from '@vercel/node'; // Import Vercel types for emulation

// Regex for the new asset snapshot endpoint
const assetSnapshotRegex = /^\/api\/v1\/asset\/([^\/]+)\/snapshot\/([^\/]+)$/;

// Mock implementation for the asset snapshot handler (since the real one is missing)
// This mock returns a hardcoded list of holders for testing purposes.
async function mockAssetSnapshotHandler(
  request: VercelRequest,
  response: VercelResponse,
) {
  const assetId = request.query.assetId as string;
  const round = request.query.round as string;

  if (!assetId || !round) {
    return response.status(400).json({ error: 'Missing assetId or round.' });
  }

  // --- MOCK DATA FOR TESTING ---
  // Replace this with actual Indexer/Allo.info logic if implemented later
  const mockHolders = [
    // Example addresses that might be writers in the social data
    { address: "WRITER_ADDRESS_1", amount: 1000000000 }, // 1000 units
    { address: "WRITER_ADDRESS_2", amount: 500000000 },  // 500 units
    { address: "I373USOJRKPCZCO25D5XBWVEEBQCG575LX6TL7J5RANO726FI3J7R4XMKQ", amount: 1000000 }, // Protocol
    { address: "4242424242424242424242424242424242424242424242424242424242", amount: 100000000 }, // Another example
  ];
  // --- END MOCK DATA ---

  // Filter mock holders based on the requested assetId (for realism, though mock is static)
  // In a real implementation, this would be fetched from the Indexer/Allo.info
  
  return response.status(200).json({
    assetId: parseInt(assetId),
    round: parseInt(round),
    holders: mockHolders,
  });
}


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
              const mockRequest: VercelRequest = {
                ...req, // Spread existing request properties
                query: {}, // Add query property
                cookies: {}, // Add cookies property
                body: await getRequestBody(req), // Parse body for POST requests
              } as VercelRequest; // Cast to VercelRequest

              const mockResponse: VercelResponse = {
                ...res, // Spread existing response properties
                status: (statusCode: number) => {
                  res.statusCode = statusCode;
                  return mockResponse;
                },
                json: (data: any) => {
                  res.setHeader('Content-Type', 'application/json');
                  res.end(JSON.stringify(data));
                },
                send: (data: string) => {
                  res.end(data);
                },
                setHeader: (name: string, value: string | string[]) => {
                  res.setHeader(name, value);
                },
                // Add other VercelResponse methods if needed by the handler
              } as VercelResponse;

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
            
            // --- Emulate /api/v1/asset/[assetId]/snapshot/[round] ---
            const assetSnapshotMatch = req.url?.match(assetSnapshotRegex);
            if (assetSnapshotMatch) {
              const assetId = assetSnapshotMatch[1];
              const round = assetSnapshotMatch[2];

              const mockRequest: VercelRequest = {
                ...req,
                query: { assetId, round }, // Populate query with path params
                cookies: {},
                body: await getRequestBody(req),
              } as VercelRequest;

              const mockResponse: VercelResponse = {
                ...res,
                status: (statusCode: number) => {
                  res.statusCode = statusCode;
                  return mockResponse;
                },
                json: (data: any) => {
                  res.setHeader('Content-Type', 'application/json');
                  res.end(JSON.stringify(data));
                },
                send: (data: string) => {
                  res.end(data);
                },
                setHeader: (name: string, value: string | string[]) => {
                  res.setHeader(name, value);
                },
              } as VercelResponse;

              try {
                await mockAssetSnapshotHandler(mockRequest, mockResponse);
              } catch (error) {
                console.error("Error in API emulator for /api/v1/asset/[assetId]/snapshot/[round]:", error);
                const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred.';
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