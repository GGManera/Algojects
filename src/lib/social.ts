// The protocol wallet that receives all interaction data transactions.
export const PROTOCOL_ADDRESS = "I373USOJRKPCZCO25D5XBWVEEBQCG575LX6TL7J5RANO726FI3J7R4XMKQ";

/**
 * Finds the next available sequential letter ID (a, b, c...).
 * This function assumes single-character IDs.
 */
export const getNextId = (items: { [id: string]: any }): string => {
  const existingIds = Object.keys(items);
  
  if (existingIds.length === 0) {
    return "a";
  }
  
  // Find the highest character code among existing IDs.
  // We start with the char code for 'a' minus one.
  let maxCharCode = 'a'.charCodeAt(0) - 1; 

  existingIds.forEach(id => {
    if (id.length === 1) { // Only consider single-character IDs
      const charCode = id.charCodeAt(0);
      if (charCode > maxCharCode) {
        maxCharCode = charCode;
      }
    }
  });

  // Increment the highest found character code and convert back to a character.
  return String.fromCharCode(maxCharCode + 1);
};

/**
 * Finds the next available sequential letter ID for proposed note edits (a, b, c...).
 */
export const getNextProposedNoteEditId = (proposedEdits: { [id: string]: any }): string => {
  return getNextId(proposedEdits);
};

// Generates the [Hash] part of the identifier.
export const generateHash = (lastRound: number, senderAddress: string): string => {
    const timestamp = Date.now();
    const product = BigInt(lastRound) * BigInt(timestamp);
    const lastDigit = Number(product % 10n);
    // Ensure the index is within the bounds of the address length
    const charIndex = lastDigit < senderAddress.length ? lastDigit : senderAddress.length - 1;
    return senderAddress.charAt(charIndex);
};