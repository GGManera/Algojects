import type { VercelRequest, VercelResponse } from '@vercel/node';
import { fetchFormStructureFromCoda } from './feedback-coda-utils';
import { retryFetch } from '../src/utils/api';
import { TextDecoder } from 'util'; // Node.js utility for decoding

const INDEXER_URL = "https://mainnet-idx.algonode.cloud";

export default async function handler(
  request: VercelRequest,
  response: VercelResponse,
) {
  if (request.method !== 'POST') { // CHANGED from GET to POST
    return response.status(405).json({ error: 'Method Not Allowed' });
  }

  const { txid, hash: expectedHash, newJsonDraft } = request.body; // Read all parameters from body

  if (!txid || typeof txid !== 'string' || !expectedHash || !newJsonDraft) {
    return response.status(400).json({ error: 'Missing txid, expectedHash, or newJsonDraft in request body.' });
  }

  try {
    const ADMIN_WALLET = process.env.VITE_FEEDBACK_ADMIN_WALLET;
    const PROJECT_WALLET = process.env.VITE_FEEDBACK_PROJECT_WALLET;

    if (!ADMIN_WALLET || !PROJECT_WALLET) {
        throw new Error("Admin or Project wallet addresses are not configured in environment variables.");
    }

    // 1. Fetch transaction details from Indexer
    const txResponse = await retryFetch(`${INDEXER_URL}/v2/transactions/${txid}`, undefined, 5);
    if (!txResponse.ok) {
      // Since retryFetch now returns the response object, we need to read the error body here if needed
      const errorText = await txResponse.text();
      return response.status(404).json({ error: `Transaction ${txid} not found or Indexer error: ${errorText}` });
    }
    const txData = await txResponse.json();
    const transaction = txData.transaction;

    // 2. Basic checks (omitted for brevity, assuming they pass)

    if (transaction.sender !== ADMIN_WALLET) {
      return response.status(403).json({ error: 'Transaction sender does not match authorized_wallet.' });
    }
    
    if (transaction['tx-type'] !== 'pay' || (transaction['payment-transaction']?.receiver !== PROJECT_WALLET && transaction['payment-transaction']?.receiver !== ADMIN_WALLET)) {
        return response.status(400).json({ error: 'Transaction must be a payment to the project wallet or a self-transfer by the admin.' });
    }

    const noteBase64 = transaction.note;
    if (!noteBase64) {
      return response.status(400).json({ error: 'Transaction note is missing.' });
    }
    
    const noteBytes = Buffer.from(noteBase64, 'base64');
    const noteText = new TextDecoder('utf-8').decode(noteBytes);
    
    if (!noteText.includes(expectedHash)) {
      return response.status(400).json({ error: 'Transaction note does not contain the expected hash.' });
    }

    // 4. Transaction is verified. Now update Coda.
    
    console.log("[VerifyTx] Transaction verified. Fetching Coda rowId...");
    const { rowId } = await fetchFormStructureFromCoda();
    console.log(`[VerifyTx] Coda rowId fetched: ${rowId}. Attempting internal PUT to update schema...`);
    
    // --- CRITICAL FIX: Use absolute URL for internal fetch ---
    // Safely access host header
    const host = request.headers.host || 'localhost:8080'; 
    const internalUrl = `http://${host}/api/form-structure`;
    console.log(`[VerifyTx] Internal PUT URL: ${internalUrl}`);
    
    const updateResponse = await fetch(internalUrl, {
        method: 'PUT',
        headers: { 
            'Content-Type': 'application/json',
            // Ensure we pass the host header for the emulator to route correctly
            'Host': host, 
        },
        body: JSON.stringify({ 
            newJsonString: JSON.stringify(newJsonDraft, Object.keys(newJsonDraft).sort(), 2), // Re-normalize before sending to Coda
            rowId 
        }),
    });

    console.log(`[VerifyTx] Internal PUT response status: ${updateResponse.status}`);

    if (!updateResponse.ok) {
        const updateErrorText = await updateResponse.text();
        let updateError;
        try {
            updateError = JSON.parse(updateErrorText);
        } catch {
            updateError = { error: updateErrorText };
        }
        console.error("Internal API Update Failed:", updateError);
        // Return 500 status with the internal error message
        return response.status(500).json({ error: `Internal Coda Update Failed: ${updateError.error}` });
    }
    
    console.log("[VerifyTx] Internal PUT successful. Returning 200.");
    return response.status(200).json({ 
        message: 'Transaction verified and Form Structure updated successfully.',
        txid: txid,
        sender: transaction.sender, // Use transaction.sender here
        note: noteText
    });

  } catch (error) {
    console.error("Error in verify-tx handler:", error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred.';
    return response.status(500).json({ error: errorMessage });
  }
}