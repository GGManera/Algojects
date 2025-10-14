import { ProjectDetailsEntry, ProjectMetadata } from '../../api/project-details'; // Import ProjectMetadata
import algosdk from 'algosdk'; // Import algosdk

export async function fetchProjectDetailsClient(): Promise<ProjectDetailsEntry[]> {
  const response = await fetch('/api/project-details', {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error || `Failed to fetch project details: ${response.status}`);
  }

  const data = await response.json();
  return data.projectDetails;
}

export async function updateProjectDetailsClient(
  projectId: string, 
  projectMetadata: ProjectMetadata, // Now takes the full metadata array
  activeAddress: string, // NEW: Active wallet address
  transactionSigner: algosdk.TransactionSigner, // NEW: Transaction signer
  algodClient: algosdk.Algodv2 // NEW: Algod client
): Promise<void> {
  // 1. Create and send an arbitrary transaction for proof of ownership
  const atc = new algosdk.AtomicTransactionComposer();
  const suggestedParams = await algodClient.getTransactionParams().do();

  const proofTxn = algosdk.makePaymentTxnWithSuggestedParamsFromObject({
    sender: activeAddress,
    receiver: activeAddress, // Send to self
    amount: 0, // 0 ALGO
    suggestedParams,
    note: new TextEncoder().encode(`Coda Interaction Proof for Project ${projectId}`),
  });

  atc.addTransaction({ txn: proofTxn, signer: transactionSigner });

  console.log(`[Coda Client] Sending proof transaction for Project ${projectId}...`);
  await atc.execute(algodClient, 4); // Wait for 4 rounds for confirmation
  console.log(`[Coda Client] Proof transaction confirmed for Project ${projectId}. Proceeding with Coda update.`);

  // 2. Proceed with the Coda API call
  const response = await fetch('/api/project-details', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ projectId, projectMetadata }), // Pass projectMetadata directly
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error || `Failed to update project details: ${response.status}`);
  }
}