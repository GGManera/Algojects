import { FormStructure } from '../src/lib/feedback-api';

const BASE_FORM_STRUCTURE_TEMPLATE = {
  "form_id": "algojects_feedback_master",
  "version": "1.0",
  "feedback_version": "v1",
  "authorized_wallet": process.env.FEEDBACK_ADMIN_WALLET || "ADMIN_WALLET_NOT_SET",
  "project_wallet": process.env.FEEDBACK_PROJECT_WALLET || "PROJECT_WALLET_NOT_SET",
  "hash_verification_required": true,
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
      "timestamp": null,
    }
  },
};

export const FALLBACK_FORM_STRUCTURE_EN: FormStructure = {
    ...BASE_FORM_STRUCTURE_TEMPLATE,
    "metadata": {
        "created_at": "2025-11-05T00:00:00Z",
        "updated_at": "2025-11-05T00:00:00Z",
        "description": "AlgoJects dynamic feedback schema. Master JSON for FormStructure stored in Coda (English)."
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
                    "options": [
                        { "id": "yes", "label": "Yes" },
                        { "id": "somewhat", "label": "Somewhat" },
                        { "id": "no", "label": "No" }
                    ],
                    "required": true
                },
                {
                    "id": "navigation_continuity_explain",
                    "type": "text",
                    "depends_on": "navigation_continuity",
                    "condition": "no",
                    "question": "What would make the navigation more intuitive for you?",
                    "required": false
                },
                {
                    "id": "post_structure_understanding",
                    "type": "single_choice",
                    "question": "Did you understand the structure: reviews contain comments, and comments contain replies (no infinite rabbit holes)?",
                    "options": [
                        { "id": "yes", "label": "Yes" },
                        { "id": "somewhat", "label": "Somewhat" },
                        { "id": "no", "label": "No" }
                    ],
                    "required": true
                },
                {
                    "id": "post_structure_rating",
                    "type": "rating",
                    "depends_on": "post_structure_understanding",
                    "condition": "yes",
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
                    "options": [
                        { "id": "yes", "label": "Yes" },
                        { "id": "somewhat", "label": "Somewhat" },
                        { "id": "no", "label": "No" }
                    ],
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
                    "options": [
                        { "id": "no_delay", "label": "No delay" },
                        { "id": "slight_delay", "label": "Slight delay (acceptable)" },
                        { "id": "noticeable_delay", "label": "Noticeable delay (inconvenient)" }
                    ],
                    "required": false
                },
                {
                    "id": "contributor_value",
                    "type": "single_choice",
                    "question": "Did you feel the act of creating a project page was valuable for the ecosystem?",
                    "options": [
                        { "id": "yes", "label": "Yes" },
                        { "id": "somewhat", "label": "Somewhat" },
                        { "id": "no", "label": "No" }
                    ],
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
                    "options": [
                        { "id": "had_one", "label": "I already had one" },
                        { "id": "created_one", "label": "I created one after platform guidance" },
                        { "id": "didnt_understand", "label": "I didn't understand this requirement" }
                    ],
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
                    "options": [
                        { "id": "yes_clearly", "label": "Yes, clearly" },
                        { "id": "not_really", "label": "Not really" },
                        { "id": "didnt_notice", "label": "I didn’t notice" }
                    ],
                    "required": true
                },
                {
                    "id": "reward_model_clarity",
                    "type": "single_choice",
                    "question": "Did you understand the reward split for posts, comments and replies (e.g., comment split between post author and protocol)?",
                    "options": [
                        { "id": "yes", "label": "Yes" },
                        { "id": "partially", "label": "Partially" },
                        { "id": "no", "label": "No" }
                    ],
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
                    "options": [
                        { "id": "yes", "label": "Yes" },
                        { "id": "partially", "label": "Partially" },
                        { "id": "no", "label": "No" }
                    ],
                    "required": true
                },
                {
                    "id": "like_agreement",
                    "type": "single_choice",
                    "question": "Do you agree with the model where likes send value directly to authors and the platform receives nothing from those likes?",
                    "options": [
                        { "id": "agree", "label": "Agree" },
                        { "id": "neutral", "label": "Neutral" },
                        { "id": "disagree", "label": "Disagree" }
                    ],
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
                    "options": [
                        { "id": "yes", "label": "Yes" },
                        { "id": "maybe", "label": "Maybe" },
                        { "id": "no", "label": "No" }
                    ],
                    "required": true
                },
                {
                    "id": "curator_diversity_check",
                    "type": "single_choice",
                    "question": "Do you think a curators' influence should be reduced if they only curate a single project or few authors?",
                    "options": [
                        { "id": "yes", "label": "Yes" },
                        { "id": "neutral", "label": "Neutral" },
                        { "id": "no", "label": "No" }
                    ],
                    "required": true
                },
                {
                    "id": "curator_activity_check",
                    "type": "single_choice",
                    "question": "Should curators who are inactive for a long period have reduced influence?",
                    "options": [
                        { "id": "yes", "label": "Yes" },
                        { "id": "neutral", "label": "Neutral" },
                        { "id": "no", "label": "No" }
                    ],
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
    ]
} as FormStructure;

export const FALLBACK_FORM_STRUCTURE_PT: FormStructure = {
    ...BASE_FORM_STRUCTURE_TEMPLATE,
    "metadata": {
        "created_at": "2025-11-05T00:00:00Z",
        "updated_at": "2025-11-05T00:00:00Z",
        "description": "Esquema de feedback dinâmico AlgoJects. JSON Mestre para FormStructure armazenado no Coda (Português)."
    },
    "rendering_rules": {
        "unconnected_user": {
            "show_modules": ["general"],
            "explainers": {
                "investor_mode": "Você pode navegar pelos projetos sem conectar sua carteira. Para interagir (postar/curtir/criar) você precisará conectar uma carteira."
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
    "modules": [
        {
            "id": "general",
            "title": "Feedback Geral (Experiência do Investidor)",
            "description": "Módulo universal exibido a todos os usuários. Foco: navegação, clareza e UX básica.",
            "questions": [
                {
                    "id": "home_accessibility",
                    "type": "rating",
                    "question": "Qual a facilidade em encontrar e acessar a página principal com todos os projetos e estatísticas?",
                    "scale": 5,
                    "required": true
                },
                {
                    "id": "project_page_access",
                    "type": "rating",
                    "question": "Qual a facilidade em acessar a página de um projeto e ver suas análises (reviews)?",
                    "scale": 5,
                    "required": true
                },
                {
                    "id": "user_profile_access",
                    "type": "rating",
                    "question": "Qual a facilidade em acessar as páginas de perfil dos usuários?",
                    "scale": 5,
                    "required": true
                },
                {
                    "id": "navigation_continuity",
                    "type": "single_choice",
                    "question": "Você percebeu a navegação como contínua entre as colunas (principal → projeto → perfil) em vez de páginas separadas?",
                    "options": [
                        { "id": "yes", "label": "Sim" },
                        { "id": "somewhat", "label": "Mais ou Menos" },
                        { "id": "no", "label": "Não" }
                    ],
                    "required": true
                },
                {
                    "id": "navigation_continuity_explain",
                    "type": "text",
                    "depends_on": "navigation_continuity",
                    "condition": "no",
                    "question": "O que tornaria a navegação mais intuitiva para você?",
                    "required": false
                },
                {
                    "id": "post_structure_understanding",
                    "type": "single_choice",
                    "question": "Você entendeu a estrutura: reviews contêm comentários, e comentários contêm respostas (sem buracos de coelho infinitos)?",
                    "options": [
                        { "id": "yes", "label": "Sim" },
                        { "id": "somewhat", "label": "Mais ou Menos" },
                        { "id": "no", "label": "Não" }
                    ],
                    "required": true
                },
                {
                    "id": "post_structure_rating",
                    "type": "rating",
                    "depends_on": "post_structure_understanding",
                    "condition": "yes",
                    "question": "Quão clara e organizada você achou essa estrutura?",
                    "scale": 5,
                    "required": false
                },
                {
                    "id": "platform_purpose_clarity",
                    "type": "rating",
                    "question": "Quão claramente você entendeu o propósito do AlgoJects nos primeiros minutos de uso?",
                    "scale": 5,
                    "required": true
                },
                {
                    "id": "explore_more",
                    "type": "rating",
                    "question": "Após navegar, quão motivado você se sentiu para explorar mais projetos na plataforma?",
                    "scale": 5,
                    "required": false
                },
                {
                    "id": "general_issues",
                    "type": "text",
                    "question": "Algo te confundiu ou impediu de usar a plataforma melhor? (resposta curta)",
                    "required": false
                },
                {
                    "id": "general_overall",
                    "type": "rating",
                    "question": "No geral, quão satisfeito você está com a navegação e estrutura?",
                    "scale": 5,
                    "required": true
                },
                {
                    "id": "general_comments",
                    "type": "text",
                    "question": "Quaisquer comentários ou sugestões gerais adicionais?",
                    "required": false
                }
            ]
        },
        {
            "id": "contributor",
            "title": "Feedback do Contribuidor / Criador",
            "description": "Exibido para usuários que criaram ou editaram páginas de projeto (contribuidores ou criadores de projeto).",
            "questions": [
                {
                    "id": "project_creation_intuitiveness",
                    "type": "rating",
                    "question": "Quão intuitivo foi o processo para criar uma nova página de projeto?",
                    "scale": 5,
                    "required": true
                },
                {
                    "id": "notes_section",
                    "type": "rating",
                    "question": "Quão útil você achou a seção de 'notas' para descrever o projeto?",
                    "scale": 5,
                    "required": false
                },
                {
                    "id": "metadata_fields_clarity",
                    "type": "single_choice",
                    "question": "Os campos de metadados (website, Asset ID, carteira/domínio do criador) estavam claros para você?",
                    "options": [
                        { "id": "yes", "label": "Sim" },
                        { "id": "somewhat", "label": "Mais ou Menos" },
                        { "id": "no", "label": "Não" }
                    ],
                    "required": true
                },
                {
                    "id": "metadata_display_rating",
                    "type": "rating",
                    "question": "Quão clara foi a exibição dos metadados na página do projeto após a criação?",
                    "scale": 5,
                    "required": false
                },
                {
                    "id": "metadata_editing_experience",
                    "type": "rating",
                    "question": "Qual a facilidade em editar os metadados do projeto após a criação?",
                    "scale": 5,
                    "required": false
                },
                {
                    "id": "data_propagation_delay",
                    "type": "single_choice",
                    "question": "Você experimentou atraso após salvar os dados (tempo de propagação)?",
                    "options": [
                        { "id": "no_delay", "label": "Sem atraso" },
                        { "id": "slight_delay", "label": "Pequeno atraso (aceitável)" },
                        { "id": "noticeable_delay", "label": "Atraso perceptível (inconveniente)" }
                    ],
                    "required": false
                },
                {
                    "id": "contributor_value",
                    "type": "single_choice",
                    "question": "Você sentiu que o ato de criar uma página de projeto foi valioso para o ecossistema?",
                    "options": [
                        { "id": "yes", "label": "Sim" },
                        { "id": "somewhat", "label": "Mais ou Menos" },
                        { "id": "no", "label": "Não" }
                    ],
                    "required": false
                },
                {
                    "id": "contributor_additional_feedback",
                    "type": "text",
                    "question": "Alguma sugestão para melhorar o fluxo de criação/edição de projetos?",
                    "required": false
                }
            ]
        },
        {
            "id": "writer",
            "title": "Feedback do Escritor (Writer)",
            "description": "Exibido para usuários que criaram posts (reviews) ou comentários/respostas.",
            "questions": [
                {
                    "id": "domain_requirement_understanding",
                    "type": "single_choice",
                    "question": "Você já tinha um Domínio NF antes de escrever, ou a plataforma te guiou para criar um?",
                    "options": [
                        { "id": "had_one", "label": "Eu já tinha um" },
                        { "id": "created_one", "label": "Eu criei um após a orientação da plataforma" },
                        { "id": "didnt_understand", "label": "Eu não entendi esse requisito" }
                    ],
                    "required": true
                },
                {
                    "id": "posting_speed",
                    "type": "rating",
                    "question": "Qual a velocidade da interação de publicação (tempo de tx da carteira, confirmação)?",
                    "scale": 5,
                    "required": true
                },
                {
                    "id": "fee_understanding",
                    "type": "single_choice",
                    "question": "Você entendeu que a taxa que você pagou vai para o protocolo AlgoJects?",
                    "options": [
                        { "id": "yes_clearly", "label": "Sim, claramente" },
                        { "id": "not_really", "label": "Na verdade, não" },
                        { "id": "didnt_notice", "label": "Eu não percebi" }
                    ],
                    "required": true
                },
                {
                    "id": "reward_model_clarity",
                    "type": "single_choice",
                    "question": "Você entendeu a divisão da recompensa para posts, comentários e respostas (ex: divisão do comentário entre autor do post e protocolo)?",
                    "options": [
                        { "id": "yes", "label": "Sim" },
                        { "id": "partially", "label": "Parcialmente" },
                        { "id": "no", "label": "Não" }
                    ],
                    "required": true
                },
                {
                    "id": "writer_usability",
                    "type": "rating",
                    "question": "No geral, como você avaliaria a experiência de escrita e postagem?",
                    "scale": 5,
                    "required": true
                },
                {
                    "id": "writer_general_feedback",
                    "type": "text",
                    "question": "Algum feedback sobre sua experiência de escrita/postagem (UX, custos, fluxo de domínio)?",
                    "required": false
                }
            ]
        },
        {
            "id": "curator",
            "title": "Feedback do Curador (Curator)",
            "description": "Exibido para usuários que realizaram curadorias (curtidas/apoios). Inclui percepção sobre o Índice de Curador e fluxos de recompensa.",
            "questions": [
                {
                    "id": "like_interaction_understanding",
                    "type": "single_choice",
                    "question": "Ao dar uma curtida, você entendeu que isso aciona uma transação que envia ALGO diretamente para o autor (não para a plataforma)?",
                    "options": [
                        { "id": "yes", "label": "Sim" },
                        { "id": "partially", "label": "Parcialmente" },
                        { "id": "no", "label": "Não" }
                    ],
                    "required": true
                },
                {
                    "id": "like_agreement",
                    "type": "single_choice",
                    "question": "Você concorda com o modelo onde as curtidas enviam valor diretamente para os autores e a plataforma não recebe nada dessas curtidas?",
                    "options": [
                        { "id": "agree", "label": "Concordo" },
                        { "id": "neutral", "label": "Neutro" },
                        { "id": "disagree", "label": "Discordo" }
                    ],
                    "required": true
                },
                {
                    "id": "curator_index_clarity",
                    "type": "rating",
                    "question": "Quão claro é o conceito do Índice de Curador (CIX) que pondera a influência do curador com base na previsibilidade, diversidade e atividade?",
                    "scale": 5,
                    "required": true
                },
                {
                    "id": "curator_index_fairness",
                    "type": "rating",
                    "question": "Você considera justa a abordagem do Índice de Curador (poder preditivo + diversidade + atividade - penalidade de manipulação)?",
                    "scale": 5,
                    "required": true
                },
                {
                    "id": "curator_model_changes",
                    "type": "single_choice",
                    "question": "Você apoiaria a plataforma a cobrar uma pequena taxa em cada curtida (ex: 10%) para redistribuir aos principais curadores e para a sustentabilidade da plataforma?",
                    "options": [
                        { "id": "yes", "label": "Sim" },
                        { "id": "maybe", "label": "Talvez" },
                        { "id": "no", "label": "Não" }
                    ],
                    "required": true
                },
                {
                    "id": "curator_diversity_check",
                    "type": "single_choice",
                    "question": "Você acha que a influência de um curador deve ser reduzida se ele curar apenas um único projeto ou poucos autores?",
                    "options": [
                        { "id": "yes", "label": "Sim" },
                        { "id": "neutral", "label": "Neutro" },
                        { "id": "no", "label": "Não" }
                    ],
                    "required": true
                },
                {
                    "id": "curator_activity_check",
                    "type": "single_choice",
                    "question": "Curadores inativos por um longo período devem ter sua influência reduzida?",
                    "options": [
                        { "id": "yes", "label": "Sim" },
                        { "id": "neutral", "label": "Neutro" },
                        { "id": "no", "label": "Não" }
                    ],
                    "required": true
                },
                {
                    "id": "curator_additional_feedback",
                    "type": "text",
                    "question": "Algum feedback sobre curadoria, CIX ou dinâmica de recompensa?",
                    "required": false
                }
            ]
        }
    ]
} as FormStructure;