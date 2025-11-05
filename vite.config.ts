import { defineConfig, loadEnv } from "vite";
import dyadComponentTagger from "@dyad-sh/react-vite-component-tagger";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import projectDetailsHandler from "./api/project-details";
import alloProxyHandler from "./api/allo-proxy";
import formStructureHandler from "./api/form-structure"; // NEW
import formResponsesHandler from "./api/form-responses"; // NEW
import generateHashHandler from "./api/generate-hash"; // NEW
import verifyTxHandler from "./api/verify-tx"; // NEW
import type { VercelRequest, VercelResponse } from '@vercel/node';

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

            const requestBody = await getRequestBody(req);
            
            const url = new URL(req.url || '/', `http://${req.headers.host}`);
            const query: { [key: string]: string | string[] } = {};
            url.searchParams.forEach((value, key) => {
                query[key] = value;
            });

            const mockRequest: VercelRequest = {
                ...req,
                query,
                cookies: {},
                body: requestBody,
            } as VercelRequest;

            const mockResponse = createMockResponse(res);

            const apiMap: { [key: string]: (req: VercelRequest, res: VercelResponse) => Promise<void> } = {
                '/api/project-details': projectDetailsHandler,
                '/api/allo-proxy': alloProxyHandler,
                '/api/form-structure': formStructureHandler, // NEW
                '/api/form-responses': formResponsesHandler, // NEW
                '/api/generate-hash': generateHashHandler, // NEW
                '/api/verify-tx': verifyTxHandler, // NEW
            };

            for (const endpoint in apiMap) {
                if (req.url?.startsWith(endpoint)) {
                    try {
                        await apiMap[endpoint](mockRequest, mockResponse);
                    } catch (error) {
                        console.error(`Error in API emulator for ${endpoint}:`, error);
                        const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred.';
                        if (!res.headersSent) {
                            res.statusCode = 500;
                            res.setHeader('Content-Type', 'application/json');
                            res.end(JSON.stringify({ error: errorMessage }));
                        }
                    }
                    return;
                }
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