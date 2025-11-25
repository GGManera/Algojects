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
        // Read body only on error to log it, then throw a new Error with the content
        const errorBody = await response.text(); // Consume the body here
        const errorMessage = `Failed to fetch after ${i + 1} attempts: ${response.status} - ${errorBody}`;
        console.warn(`Fetch attempt ${i + 1} failed: ${errorMessage}. Retrying...`);
        if (i < retries - 1) {
          await new Promise(res => setTimeout(res, delay));
        } else {
          throw new Error(errorMessage); // Throw the error with the consumed body content
        }
      }
      // If OK, return a clone of the response object to ensure the original body is not disturbed
      return response.clone(); 
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