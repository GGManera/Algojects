import { ProjectDetailsEntry, ProjectMetadata } from '../../api/project-details';
import algosdk from 'algosdk';
import { PROTOCOL_ADDRESS } from './social'; // Import PROTOCOL_ADDRESS

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

const MICRO_ALGOS_PER_ALGO = 1_000_000;
const SUGGESTION_REWARD_MICRO_ALGOS = 100_000; // 0.1 ALGO

/**
 * Handles the group transaction for thanking the contributor and claiming the project.
 * This function executes the transactions and then updates Coda.
 */
export async function thankContributorAndClaimProject(
  projectId: string,
  projectName: string,
  contributorAddress: string,
  totalRewardAlgos: number,
  contributorShare: number, // percentage 0-100
  newWhitelistedEditors: string,
  initialMetadata: ProjectMetadata,
  activeAddress: string,
  transactionSigner: algosdk.TransactionSigner,
  algodClient: algosdk.Algodv2
): Promise<void> {
  const atc = new algosdk.AtomicTransactionComposer();
  const suggestedParams = await algodClient.getTransactionParams().do();

  const totalRewardMicroAlgos = Math.round(totalRewardAlgos * MICRO_ALGOS_PER_ALGO);
  const contributorAmountMicroAlgos = Math.round(totalRewardMicroAlgos * (contributorShare / 100));
  const algojectsAmountMicroAlgos = totalRewardMicroAlgos - contributorAmountMicroAlgos;

  const txnsToSign: TransactionDisplayItem[] = [];

  // 1. Payment to Contributor
  if (contributorAmountMicroAlgos > 0) {
    const paymentToContributorTxn = algosdk.makePaymentTxnWithSuggestedParamsFromObject({
      sender: activeAddress,
      receiver: contributorAddress,
      amount: contributorAmountMicroAlgos,
      suggestedParams,
      note: new TextEncoder().encode(`Thanks for adding ${projectName} to AlgoJects! Here's your reward.`),
    });
    atc.addTransaction({ txn: paymentToContributorTxn, signer: transactionSigner });
    txnsToSign.push({ type: 'pay', from: activeAddress, to: contributorAddress, amount: contributorAmountMicroAlgos, role: 'Contributor Reward' });
  }

  // 2. Payment to AlgoJects (Protocol) for the remaining share
  if (algojectsAmountMicroAlgos > 0) {
    const paymentToProtocolTxn = algosdk.makePaymentTxnWithSuggestedParamsFromObject({
      sender: activeAddress,
      receiver: PROTOCOL_ADDRESS,
      amount: algojectsAmountMicroAlgos,
      suggestedParams,
      note: new TextEncoder().encode(`Claim fee for Project ${projectId}`),
    });
    atc.addTransaction({ txn: paymentToProtocolTxn, signer: transactionSigner });
    txnsToSign.push({ type: 'pay', from: activeAddress, to: PROTOCOL_ADDRESS, amount: algojectsAmountMicroAlgos, role: 'Protocol Fee' });
  }

  // 3. Data Transaction to Protocol (0 ALGO) to record the claim
  // Tag format: CLAIM.[Project ID].[Contributor Address]
  const claimTag = `CLAIM.${projectId}.${contributorAddress}`;
  const dataTxn = algosdk.makePaymentTxnWithSuggestedParamsFromObject({
    sender: activeAddress,
    receiver: PROTOCOL_ADDRESS,
    amount: 0,
    suggestedParams,
    note: new TextEncoder().encode(claimTag),
  });
  atc.addTransaction({ txn: dataTxn, signer: transactionSigner });
  txnsToSign.push({ type: 'pay', from: activeAddress, to: PROTOCOL_ADDRESS, amount: 0, note: claimTag, role: 'Claim Data' });


  // Execute the group transaction
  console.log(`[Coda Client] Sending group transaction for claiming Project ${projectId}...`);
  await atc.execute(algodClient, 4);
  console.log(`[Coda Client] Group transaction confirmed. Updating Coda metadata.`);

  // 4. Update Coda Metadata
  const updatedMetadata = initialMetadata.filter(item => item.type !== 'whitelisted-editors' && item.type !== 'is-claimed');
  
  // Add updated/new metadata items
  updatedMetadata.push({ title: 'Whitelisted Editors', value: newWhitelistedEditors, type: 'whitelisted-editors' });
  updatedMetadata.push({ title: 'Is Claimed', value: 'true', type: 'is-claimed' });
  
  // Ensure is-creator-added is set to true since the creator is claiming
  const isCreatorAddedIndex = updatedMetadata.findIndex(item => item.type === 'is-creator-added');
  if (isCreatorAddedIndex !== -1) {
    updatedMetadata[isCreatorAddedIndex] = { ...updatedMetadata[isCreatorAddedIndex], value: 'true' };
  } else {
    updatedMetadata.push({ title: 'Is Creator Added', value: 'true', type: 'is-creator-added' });
  }

  // Ensure added-by-address is set to the contributor's address (it should already be, but confirm)
  const addedByAddressIndex = updatedMetadata.findIndex(item => item.type === 'added-by-address');
  if (addedByAddressIndex === -1) {
    updatedMetadata.push({ title: 'Added By Address', value: contributorAddress, type: 'added-by-address' });
  }

  await updateProjectDetailsClient(
    projectId,
    updatedMetadata,
    activeAddress,
    transactionSigner,
    algodClient
  );
}

/**
 * Handles the group transaction for accepting a metadata suggestion, rewarding the proposer,
 * and updating the project metadata in Coda.
 */
export async function acceptMetadataSuggestionAndReward(
  projectId: string,
  proposerAddress: string,
  suggestionTxId: string,
  finalMetadata: ProjectMetadata,
  activeAddress: string,
  transactionSigner: algosdk.TransactionSigner,
  algodClient: algosdk.Algodv2
): Promise<void> {
  const atc = new algosdk.AtomicTransactionComposer();
  const suggestedParams = await algodClient.getTransactionParams().do();

  // 1. Payment to Proposer (0.1 ALGO reward)
  const paymentToProposerTxn = algosdk.makePaymentTxnWithSuggestedParamsFromObject({
    sender: activeAddress,
    receiver: proposerAddress,
    amount: SUGGESTION_REWARD_MICRO_ALGOS,
    suggestedParams,
    note: new TextEncoder().encode(`Reward for accepted metadata suggestion (TX: ${suggestionTxId.substring(0, 10)}...)`),
  });
  atc.addTransaction({ txn: paymentToProposerTxn, signer: transactionSigner });

  // 2. Data Transaction to Protocol (0 ALGO) to record the acceptance
  // Tag format: ACCEPT.[Project ID].[Suggestion TXID]
  const acceptTag = `ACCEPT.${projectId}.${suggestionTxId}`;
  const dataTxn = algosdk.makePaymentTxnWithSuggestedParamsFromObject({
    sender: activeAddress,
    receiver: PROTOCOL_ADDRESS,
    amount: 0,
    suggestedParams,
    note: new TextEncoder().encode(acceptTag),
  });
  atc.addTransaction({ txn: dataTxn, signer: transactionSigner });

  // Execute the group transaction
  console.log(`[Coda Client] Sending group transaction for accepting suggestion for Project ${projectId}...`);
  await atc.execute(algodClient, 4);
  console.log(`[Coda Client] Group transaction confirmed. Updating Coda metadata.`);

  // 3. Update Coda Metadata (using the final merged metadata)
  await updateProjectDetailsClient(
    projectId,
    finalMetadata,
    activeAddress,
    transactionSigner,
    algodClient
  );
}