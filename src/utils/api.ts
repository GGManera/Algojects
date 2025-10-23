export async function retryFetch(
  input: RequestInfo | URL,
  init?: RequestInit,
  retries: number = 5, // Increased default retries from 3 to 5
  delay: number = 2000 // 2 seconds
): Promise<Response> {
  for (let i = 0; i < retries; i++) {
    try {
      const response = await fetch(input, init);
      if (!response.ok) {
        const errorText = await response.text();
        console.warn(`Fetch attempt ${i + 1} failed with status ${response.status}: ${errorText}. Retrying...`);
        if (i < retries - 1) {
          await new Promise(res => setTimeout(res, delay));
        } else {
          throw new Error(`Failed to fetch after ${retries} attempts: ${response.status} - ${errorText}`);
        }
      }
      return response;
    } catch (error) {
      console.error(`Fetch attempt ${i + 1} caught an error:`, error);
      if (i < retries - 1) {
        await new Promise(res => setTimeout(res, delay));
      } else {
        throw new Error(`Failed to fetch after ${retries} attempts: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }
  }
  throw new Error("Retry logic failed to complete."); // Should not be reached
}