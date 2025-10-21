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
    
    // Determine headers to forward
    const headers: HeadersInit = {};
    const contentType = request.headers['content-type'];
    if (contentType) {
        headers['Content-Type'] = contentType;
    } else {
        // Default to application/json if not present, as Allo API expects it
        headers['Content-Type'] = 'application/json';
    }

    // Determine body to forward
    let bodyToSend: string | undefined = undefined;
    if (request.method === 'POST' || request.method === 'PUT' || request.method === 'PATCH') {
        // If the body is already parsed (object), stringify it. If it's raw string, use it.
        bodyToSend = typeof request.body === 'object' && request.body !== null ? JSON.stringify(request.body) : request.body;
    }
    
    // Forward the request from server to server
    const proxyResponse = await fetch(targetUrl, {
      method: request.method,
      headers: headers,
      body: bodyToSend,
    });

    // Forward the status code and headers
    response.status(proxyResponse.status);
    
    // Forward content type header
    const responseContentType = proxyResponse.headers.get('content-type');
    if (responseContentType) {
        response.setHeader('Content-Type', responseContentType);
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