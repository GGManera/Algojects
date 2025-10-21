import { defineConfig, loadEnv } from "vite";
import dyadComponentTagger from "@dyad-sh/react-vite-component-tagger";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import projectDetailsHandler from "./api/project-details";
import alloProxyHandler from "./api/allo-proxy"; // Import the new proxy handler
import type { VercelRequest, VercelResponse } from '@vercel/node'; // Import Vercel types for emulation

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
            
            // Helper to create mock VercelResponse
            const createMockResponse = (res: any): VercelResponse => ({
                ...res,
                status: (statusCode: number) => {
                  res.statusCode = statusCode;
                  return createMockResponse(res);
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
            } as VercelResponse);

            // --- Emulate /api/project-details ---
            if (req.url === '/api/project-details') {
              const mockRequest: VercelRequest = {
                ...req,
                query: {},
                cookies: {},
                body: await getRequestBody(req),
              } as VercelRequest;

              const mockResponse = createMockResponse(res);

              try {
                await projectDetailsHandler(mockRequest, mockResponse);
              } catch (error) {
                console.error("Error in API emulator for /api/project-details:", error);
                const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred.';
                if (!res.headersSent) {
                  res.statusCode = 500;
                  res.setHeader('Content-Type', 'application/json');
                  res.end(JSON.stringify({ error: errorMessage }));
                }
              }
              return;
            }
            
            // --- Emulate /api/allo-proxy ---
            if (req.url?.startsWith('/api/allo-proxy')) {
                const url = new URL(req.url, `http://${req.headers.host}`);
                const query: { [key: string]: string | string[] } = {};
                url.searchParams.forEach((value, key) => {
                    query[key] = value;
                });

                const mockRequest: VercelRequest = {
                    ...req,
                    query,
                    cookies: {},
                    body: await getRequestBody(req),
                } as VercelRequest;

                const mockResponse = createMockResponse(res);

                try {
                    await alloProxyHandler(mockRequest, mockResponse);
                } catch (error) {
                    console.error("Error in API emulator for /api/allo-proxy:", error);
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