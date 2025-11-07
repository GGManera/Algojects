import type { VercelRequest, VercelResponse } from '@vercel/node';
import { writeFormResponseToCoda } from './feedback-coda-utils.js'; // Adicionado .js

export default async function handler(
  request: VercelRequest,
  response: VercelResponse,
) {
  try {
    if (request.method === 'POST') {
      const { responseData, language } = request.body;
      
      if (!responseData || Object.keys(responseData).length === 0) {
        return response.status(400).json({ error: 'Missing response data in request body.' });
      }
      
      if (language !== 'en' && language !== 'pt') {
        return response.status(400).json({ error: 'Missing or invalid language parameter in request body. Must be "en" or "pt".' });
      }
      
      await writeFormResponseToCoda(responseData, language);
      return response.status(200).json({ message: 'Form response recorded successfully.' });
    } else {
      return response.status(405).json({ error: 'Method Not Allowed' });
    }
  } catch (error) {
    console.error("Error in form-responses handler:", error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred.';
    return response.status(500).json({ error: errorMessage });
  }
}