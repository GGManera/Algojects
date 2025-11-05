import type { VercelRequest, VercelResponse } from '@vercel/node';
import { fetchFormStructureFromCoda } from './feedback-coda-utils';
import { retryFetch } from '../src/utils/api';
import { TextDecoder } from 'util'; // Node.js utility for decoding

const INDEXER_URL = "https://mainnet-idx.algonode.cloud";

export default async function handler(
  request: VercelRequest,
  response: VercelResponse,
) {
  if (request.method !== 'GET') {
    return response.status(405).json({ error: 'Method Not Allowed' });
  }

  const { txid } = request.query;
  const { hash: expectedHash, newJsonDraft } = request.body; // Expecting hash and new JSON draft in the body

  if (!txid || typeof txid !== 'string' || !expectedHash || !newJsonDraft) {
    return response.status(400).json({ error: 'Missing txid, expectedHash, or newJsonDraft.' });
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
      return response.status(404).json({ error: `Transaction ${txid} not found or Indexer error.` });
    }
    const txData = await txResponse.json();
    const transaction = txData.transaction;

    // 2. Basic checks
    const sender = transaction.sender;
    const noteBase64 = transaction.note;
    const receiver = transaction['payment-transaction']?.receiver;

    if (sender !== ADMIN_WALLET) {
      return response.status(403).json({ error: 'Transaction sender does not match authorized_wallet.' });
    }
    
    // Check if it's a payment transaction to the project wallet or self-transfer (if project wallet is admin wallet)
    if (transaction['tx-type'] !== 'pay' || (receiver !== PROJECT_WALLET && receiver !== ADMIN_WALLET)) {
        return response.status(400).json({ error: 'Transaction must be a payment to the project wallet or a self-transfer by the admin.' });
    }

    // 3. Verify hash in note
    if (!noteBase64) {
      return response.status(400).json({ error: 'Transaction note is missing.' });
    }
    
    const noteBytes = Buffer.from(noteBase64, 'base64');
    const noteText = new TextDecoder('utf-8').decode(noteBytes);
    
    // The note should contain the hash exactly, possibly with some prefix/suffix
    if (!noteText.includes(expectedHash)) {
      console.log(`Expected Hash: ${expectedHash}`);
      console.log(`Note Content: ${noteText}`);
      return response.status(400).json({ error: 'Transaction note does not contain the expected hash.' });
    }

    // 4. Transaction is verified. Now update Coda.
    
    // Fetch current structure to get the rowId
    const { rowId } = await fetchFormStructureFromCoda();
    
    // Call the internal PUT endpoint to update the Coda cell
    const updateResponse = await fetch(`${request.headers.origin}/api/form-structure`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
            newJsonString: JSON.stringify(newJsonDraft, Object.keys(newJsonDraft).sort(), 2), // Re-normalize before sending to Coda
            rowId 
        }),
    });

    if (!updateResponse.ok) {
        const updateError = await updateResponse.json();
        throw new Error(`Failed to update Coda after TX verification: ${updateError.error}`);
    }
    
    // 5. Update audit log within the JSON draft before saving (this is handled by the PUT body above)
    // We need to ensure the JSON draft passed to this endpoint already has the updated audit log fields.
    
    return response.status(200).json({ 
        message: 'Transaction verified and Form Structure updated successfully.',
        txid: txid,
        sender: sender,
        note: noteText
    });

  } catch (error) {
    console.error("Error in verify-tx handler:", error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred.';
    return response.status(500).json({ error: errorMessage });
  }
}