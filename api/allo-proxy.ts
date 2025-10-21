import type { VercelRequest, VercelResponse } from '@vercel/node';

const ALLO_API_URL = "https://analytics-api.allo.info";

export default async function handler(
  request: VercelRequest,
  response: VercelResponse,
) {
  const { url: targetUrl } = request.query;

  if (!targetUrl || typeof targetUrl !== 'string') {
    return response.status(400).json({ error: 'Missing or invalid target URL parameter.' });
  }

  // Ensure the target URL starts with the Allo API base URL for security
  if (!targetUrl.startsWith(ALLO_API_URL)) {
    return response.status(403).json({ error: 'Access denied: Target URL must be an Allo API endpoint.' });
  }

  try {
    console.log(`[Allo Proxy] Forwarding request to: ${targetUrl}`);
    
    // Acessa os cabeçalhos de forma segura, usando um objeto vazio como fallback
    const headers = request.headers || {};
    
    // Forward the request from server to server
    const proxyResponse = await fetch(targetUrl, {
      method: request.method,
      headers: {
        // Forward necessary headers, but exclude host/origin headers
        'Content-Type': headers['content-type'] || 'application/json',
      },
      body: request.body ? JSON.stringify(request.body) : undefined,
    });

    // Forward the status code and headers
    response.status(proxyResponse.status);
    
    // Forward content type header
    const contentType = proxyResponse.headers.get('content-type');
    if (contentType) {
        response.setHeader('Content-Type', contentType);
    }

    // Stream the response body back to the client
    const data = await proxyResponse.json();
    return response.json(data);

  } catch (error) {
    console.error("Error in Allo API proxy handler:", error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred.';
    return response.status(500).json({ error: `Proxy failed: ${errorMessage}` });
  }
}