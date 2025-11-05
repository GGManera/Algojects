import { VercelRequest, VercelResponse } from '@vercel/node';

// Constants for the Form Structure table
let CODA_FORM_STRUCTURE_COLUMN_JSON: string; 

interface CodaRow {
  id: string; // Coda's internal row ID
  values: {
    [key: string]: string; // Use index signature since the key is dynamic
  };
}

// Fallback structure if the Coda cell is empty
const FALLBACK_FORM_STRUCTURE = {
  "form_id": "algojects_feedback_master",
  "version": "1.3",
  "feedback_version": "v1",
  "authorized_wallet": process.env.VITE_FEEDBACK_ADMIN_WALLET || "ADMIN_WALLET_NOT_SET",
  "project_wallet": process.env.VITE_FEEDBACK_PROJECT_WALLET || "PROJECT_WALLET_NOT_SET",
  "hash_verification_required": true,
  "metadata": {
    "created_at": "2025-11-05T00:00:00Z",
    "updated_at": "2025-11-05T00:00:00Z",
    "description": "AlgoJects dynamic feedback schema. Master JSON for FormStructure stored in Coda."
  },
  "governance": {
    "enabled": true,
    "threshold_min_responses": 100,
    "reward_eligibility": {
      "min_posts": 2,
      "min_balance_algo": 1,
      "reward_amount_algo": 1
    },
    "versioning_policy": "questions_reach_threshold_then_archive_in_next_version"
  },
  "modules": [
    {
      "id": "general",
      "title": "General Feedback (Investor Experience)",
      "description": "Universal module shown to all users. Focus: navigation, clarity and basic UX.",
      "questions": [
        {
          "id": "home_accessibility",
          "type": "rating",
          "question": "How easy was it to find and access the main page with all projects and statistics?",
          "scale": 5,
          "required": true
        },
        {
          "id": "project_page_access",
          "type": "rating",
          "question": "How easy was it to access a project's page and see its reviews?",
          "scale": 5,
          "required": true
        },
        {
          "id": "user_profile_access",
          "type": "rating",
          "question": "How easy was it to access user profile pages?",
          "scale": 5,
          "required": true
        },
        {
          "id": "navigation_continuity",
          "type": "single_choice",
          "question": "Did you perceive the navigation as continuous across columns (main → project → profile) rather than separate pages?",
          "options": ["Yes", "Somewhat", "No"],
          "required": true
        },
        {
          "id": "navigation_continuity_explain",
          "type": "text",
          "depends_on": "navigation_continuity",
          "condition": "No",
          "question": "What would make the navigation more intuitive for you?",
          "required": false
        },
        {
          "id": "post_structure_understanding",
          "type": "single_choice",
          "question": "Did you understand the structure: reviews contain comments, and comments contain replies (no infinite rabbit holes)?",
          "options": ["Yes", "Somewhat", "No"],
          "required": true
        },
        {
          "id": "post_structure_rating",
          "type": "rating",
          "depends_on": "post_structure_understanding",
          "condition": "Yes",
          "question": "How clear and organized did you find this structure?",
          "scale": 5,
          "required": false
        },
        {
          "id": "platform_purpose_clarity",
          "type": "rating",
          "question": "How clearly did you understand the purpose of AlgoJects within the first minutes of use?",
          "scale": 5,
          "required": true
        },
        {
          "id": "explore_more",
          "type": "rating",
          "question": "After browsing, how motivated did you feel to explore more projects on the platform?",
          "scale": 5,
          "required": false
        },
        {
          "id": "general_issues",
          "type": "text",
          "question": "Did anything confuse you or block you from using the platform better? (short answer)",
          "required": false
        },
        {
          "id": "general_overall",
          "type": "rating",
          "question": "Overall, how satisfied are you with navigation and structure?",
          "scale": 5,
          "required": true
        },
        {
          "id": "general_comments",
          "type": "text",
          "question": "Any additional general comments or suggestions?",
          "required": false
        }
      ]
    },
    {
      "id": "contributor",
      "title": "Contributor / Creator Feedback",
      "description": "Shown to users who created or edited project pages (contributors or project creators).",
      "questions": [
        {
          "id": "project_creation_intuitiveness",
          "type": "rating",
          "question": "How intuitive was the process to create a new project page?",
          "scale": 5,
          "required": true
        },
        {
          "id": "notes_section",
          "type": "rating",
          "question": "How useful did you find the 'notes' section to describe the project?",
          "scale": 5,
          "required": false
        },
        {
          "id": "metadata_fields_clarity",
          "type": "single_choice",
          "question": "Were metadata fields (website, Asset ID, creator wallet/domain) clear to you?",
          "options": ["Yes", "Somewhat", "No"],
          "required": true
        },
        {
          "id": "metadata_display_rating",
          "type": "rating",
          "question": "How clear was the display of metadata on the project page after creation?",
          "scale": 5,
          "required": false
        },
        {
          "id": "metadata_editing_experience",
          "type": "rating",
          "question": "How easy was it to edit project metadata after creation?",
          "scale": 5,
          "required": false
        },
        {
          "id": "data_propagation_delay",
          "type": "single_choice",
          "question": "Did you experience delay after saving data (propagation time)?",
          "options": ["No delay", "Slight delay (acceptable)", "Noticeable delay (inconvenient)"],
          "required": false
        },
        {
          "id": "contributor_value",
          "type": "single_choice",
          "question": "Did you feel the act of creating a project page was valuable for the ecosystem?",
          "options": ["Yes", "Somewhat", "No"],
          "required": false
        },
        {
          "id": "contributor_additional_feedback",
          "type": "text",
          "question": "Any suggestions to improve the project creation/editing flow?",
          "required": false
        }
      ]
    },
    {
      "id": "writer",
      "title": "Writer Feedback",
      "description": "Shown to users who have created posts (reviews) or comments/replies.",
      "questions": [
        {
          "id": "domain_requirement_understanding",
          "type": "single_choice",
          "question": "Did you already have an NF Domain before writing, or did the platform guide you to create one?",
          "options": ["I already had one", "I created one after platform guidance", "I didn't understand this requirement"],
          "required": true
        },
        {
          "id": "posting_speed",
          "type": "rating",
          "question": "How fast was the publishing interaction (wallet tx time, confirmation)?",
          "scale": 5,
          "required": true
        },
        {
          "id": "fee_understanding",
          "type": "single_choice",
          "question": "Did you understand that the fee you paid goes to the AlgoJects protocol?",
          "options": ["Yes, clearly", "Not really", "I didn’t notice"],
          "required": true
        },
        {
          "id": "reward_model_clarity",
          "type": "single_choice",
          "question": "Did you understand the reward split for posts, comments and replies (e.g., comment split between post author and protocol)?",
          "options": ["Yes", "Partially", "No"],
          "required": true
        },
        {
          "id": "writer_usability",
          "type": "rating",
          "question": "Overall, how would you rate the writing and posting experience?",
          "scale": 5,
          "required": true
        },
        {
          "id": "writer_general_feedback",
          "type": "text",
          "question": "Any feedback about your writing/posting experience (UX, costs, domain flow)?",
          "required": false
        }
      ]
    },
    {
      "id": "curator",
      "title": "Curator Feedback",
      "description": "Shown to users who performed curations (likes/endorsements). Includes perception about Curator Index and reward flows.",
      "questions": [
        {
          "id": "like_interaction_understanding",
          "type": "single_choice",
          "question": "When you give a like, did you understand it triggers a transaction that sends ALGO directly to the author (not to the platform)?",
          "options": ["Yes", "Partially", "No"],
          "required": true
        },
        {
          "id": "like_agreement",
          "type": "single_choice",
          "question": "Do you agree with the model where likes send value directly to authors and the platform receives nothing from those likes?",
          "options": ["Agree", "Neutral", "Disagree"],
          "required": true
        },
        {
          "id": "curator_index_clarity",
          "type": "rating",
          "question": "How clear is the concept of the Curator Index (CIX) which weights curator influence based on predictiveness, diversity and activity?",
          "scale": 5,
          "required": true
        },
        {
          "id": "curator_index_fairness",
          "type": "rating",
          "question": "Do you consider the Curator Index approach (predictive power + diversity + activity - manipulation penalty) fair?",
          "scale": 5,
          "required": true
        },
        {
          "id": "curator_model_changes",
          "type": "single_choice",
          "question": "Would you support the platform taking a small fee on each like (e.g., 10%) to redistribute to top curators and platform sustainability?",
          "options": ["Yes", "Maybe", "No"],
          "required": true
        },
        {
          "id": "curator_diversity_check",
          "type": "single_choice",
          "question": "Do you think a curators' influence should be reduced if they only curate a single project or few authors?",
          "options": ["Yes", "Neutral", "No"],
          "required": true
        },
        {
          "id": "curator_activity_check",
          "type": "single_choice",
          "question": "Should curators who are inactive for a long period have reduced influence?",
          "options": ["Yes", "Neutral", "No"],
          "required": true
        },
        {
          "id": "curator_additional_feedback",
          "type": "text",
          "question": "Any feedback about curation, CIX or reward dynamics?",
          "required": false
        }
      ]
    }
  ],
  "rendering_rules": {
    "unconnected_user": {
      "show_modules": ["general"],
      "explainers": {
        "investor_mode": "You can browse projects without connecting your wallet. To interact (post/like/create) you'll need to connect a wallet."
      }
    },
    "connected_user": {
      "detect_roles_via_onchain": true,
      "role_module_map": {
        "created_project": "contributor",
        "created_post": "writer",
        "gave_like": "curator"
      }
    }
  },
  "audit": {
    "last_edit": {
      "hash": null,
      "txid": null,
      "editor_wallet": null,
      "timestamp": null
    }
  }
};


/**
 * Generic Coda API caller for the feedback system.
 */
export async function callCodaApi<T>(method: string, path: string, body?: any): Promise<T> {
  // Use dedicated feedback keys (NON-VITE_ prefixed for security)
  const CODA_API_KEY = process.env.CODA_FEEDBACK_API_KEY;
  // Standardize DOC_ID to use VITE_ prefix for consistency with other IDs
  const CODA_DOC_ID = process.env.VITE_CODA_FEEDBACK_DOC_ID;

  if (!CODA_API_KEY || !CODA_DOC_ID) {
    throw new Error('Coda Feedback API keys or IDs are not configured. Please check environment variables (CODA_FEEDBACK_API_KEY/VITE_CODA_FEEDBACK_DOC_ID).');
  }

  const url = `https://coda.io/apis/v1/docs/${CODA_DOC_ID}${path}`;
  const headers = {
    'Authorization': `Bearer ${CODA_API_KEY}`,
    'Content-Type': 'application/json',
  };
  const stringifiedBody = body ? JSON.stringify(body) : undefined;

  const response = await fetch(url, {
    method,
    headers,
    body: stringifiedBody,
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`Coda API Error (${method} ${path}): ${response.status} - ${errorText}`);
    throw new Error(`Coda API responded with status ${response.status}: ${errorText}`);
  }

  return response.json() as Promise<T>;
}

/**
 * Fetches the current Form Structure JSON from Coda.
 * Returns the JSON string and the Coda Row ID of the LATEST version.
 */
export async function fetchFormStructureFromCoda(): Promise<{ jsonString: string; rowId: string }> {
  const CODA_FORM_STRUCTURE_TABLE_ID = process.env.VITE_CODA_FORM_STRUCTURE_TABLE_ID;
  CODA_FORM_STRUCTURE_COLUMN_JSON = process.env.VITE_CODA_FORM_STRUCTURE_COLUMN_ID || '';

  if (!CODA_FORM_STRUCTURE_TABLE_ID || !CODA_FORM_STRUCTURE_COLUMN_JSON) {
    throw new Error('VITE_CODA_FORM_STRUCTURE_TABLE_ID or VITE_CODA_FORM_STRUCTURE_COLUMN_ID is not configured.');
  }

  // Fetch all rows
  const data = await callCodaApi<{ items: CodaRow[] }>('GET', `/tables/${CODA_FORM_STRUCTURE_TABLE_ID}/rows`);

  if (!data.items || data.items.length === 0) {
    // If the table is completely empty, return the fallback structure with a null rowId
    console.warn("[Coda Feedback] Form Structure table is empty. Returning fallback structure.");
    return { jsonString: JSON.stringify(FALLBACK_FORM_STRUCTURE), rowId: 'fallback' };
  }

  let latestVersion = -1;
  let latestRow: CodaRow | null = null;
  let latestJsonString: string | null = null;

  // Iterate through rows to find the one with the highest version number
  for (const row of data.items) {
    const jsonString = row.values[CODA_FORM_STRUCTURE_COLUMN_JSON];
    if (jsonString) {
      try {
        const parsed = JSON.parse(jsonString);
        // Use parseFloat to handle versions like "1.3"
        const version = parseFloat(parsed.version);
        if (!isNaN(version) && version > latestVersion) {
          latestVersion = version;
          latestRow = row;
          latestJsonString = jsonString;
        }
      } catch (e) {
        console.warn(`[Coda Feedback] Failed to parse JSON in row ${row.id}. Skipping.`);
      }
    }
  }

  if (latestRow && latestJsonString) {
    return { jsonString: latestJsonString, rowId: latestRow.id };
  }

  // If no valid JSON was found, return fallback
  console.warn("[Coda Feedback] No valid JSON found in Form Structure table. Returning fallback structure.");
  return { jsonString: JSON.stringify(FALLBACK_FORM_STRUCTURE), rowId: 'fallback' };
}

/**
 * Creates a new Form Structure JSON row in Coda (POST).
 */
export async function createFormStructureInCoda(newJsonString: string): Promise<void> {
  const CODA_FORM_STRUCTURE_TABLE_ID = process.env.VITE_CODA_FORM_STRUCTURE_TABLE_ID;
  const columnId = process.env.VITE_CODA_FORM_STRUCTURE_COLUMN_ID;

  if (!CODA_FORM_STRUCTURE_TABLE_ID || !columnId) {
    throw new Error('VITE_CODA_FORM_STRUCTURE_TABLE_ID or VITE_CODA_FORM_STRUCTURE_COLUMN_ID is not configured.');
  }

  // We no longer parse newJsonString here. It's already a string containing the JSON.
  // We pass it directly as the value for the Coda cell.
  const cells = [
    { column: columnId, value: newJsonString }, // Pass the JSON string directly
  ];

  const postBody = {
    rows: [
      { cells },
    ],
  };

  console.log("[Coda Feedback] Sending to Coda API with postBody:", JSON.stringify(postBody, null, 2)); // NEW LOG: Log the full postBody

  await callCodaApi('POST', `/tables/${CODA_FORM_STRUCTURE_TABLE_ID}/rows`, postBody);
}

/**
 * Writes a new user response to the Form Responses table.
 */
export async function writeFormResponseToCoda(responseJson: any): Promise<void> {
  const CODA_FORM_RESPONSES_TABLE_ID = process.env.VITE_CODA_FORM_RESPONSES_TABLE_ID;
  const CODA_COLUMN_RESPONSE_JSON = process.env.VITE_CODA_FORM_RESPONSES_COLUMN_ID; // NEW: Use env variable

  if (!CODA_FORM_RESPONSES_TABLE_ID || !CODA_COLUMN_RESPONSE_JSON) {
    // Throw a clear error if the environment variables are missing
    throw new Error('VITE_CODA_FORM_RESPONSES_TABLE_ID or VITE_CODA_FORM_RESPONSES_COLUMN_ID is not configured. Please check .env.local.');
  }

  const postBody = {
    rows: [
      {
        cells: [
          { column: CODA_COLUMN_RESPONSE_JSON, value: JSON.stringify(responseJson) },
        ],
      },
    ],
  };

  await callCodaApi('POST', `/tables/${CODA_FORM_RESPONSES_TABLE_ID}/rows`, postBody);
}