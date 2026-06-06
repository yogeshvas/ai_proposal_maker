// Words that produce misleading or zero results on Unsplash
const BANNED = new Set([
    // abstract jargon
    "enterprise", "roi", "digital", "data", "fabric", "integration",
    "real-time", "workflow", "pricing", "transformation", "diagram",
    "architecture", "analytics", "visibility", "platform", "solution",
    "automation", "engagement", "ecosystem", "infrastructure", "deployment",
    "scalable", "unified", "centralized", "omnichannel", "conversational",
    // content/publishing words that pull in books and media results
    "content", "framework", "book", "fuel", "guide", "creator",
    "marketing", "brand", "story", "storytelling", "ideas",
    // medical (insurance ≠ health insurance)
    "doctor", "doctors", "medical", "health", "hospital", "clinic",
    "stethoscope", "nurse", "physician", "healthcare", "medicine",
    "patient", "treatment",
    // proper nouns / brand names that produce 0 results (not in substitutions)
    "prudential", "marichi", "zambia", "zambian",
    "hubspot", "twilio", "zendesk", "freshworks",
    // other noise words
    "unlimited", "generate", "how", "for", "the", "and", "with",
    "via", "across", "through", "using", "based", "driven",
]);

// Remap industry jargon → stock-photo-friendly visual terms
const SUBSTITUTIONS: Record<string, string> = {
    // insurance
    insurance:       "financial advisor",
    policyholder:    "customer",
    policyholders:   "customers",
    policy:          "contract",
    policies:        "contracts",
    claim:           "customer support",
    claims:          "customer support",
    premium:         "payment",
    premiums:        "payments",
    renewal:         "handshake",
    renewals:        "handshakes",
    // product / platform names → visual context
    whatsapp:        "mobile conversation",
    salesforce:      "sales team",
    crm:             "sales laptop",
    erp:             "office software",
    // messaging / chat
    messaging:       "mobile phone",
    chatbot:         "phone screen",
    broadcast:       "team communication",
    conversation:    "people talking",
    // general jargon
    onboarding:      "welcome",
    fintech:         "finance",
    reminders:       "notification",
    compliance:      "documents",
    africa:          "office",
    african:         "business",
    campaign:        "marketing",
    leads:           "sales",
    lead:            "sales",
    pipeline:        "sales team",
    dashboard:       "screen",
    screen:          "laptop",
};

// Generic safe fallbacks when query is too vague or empty
const FALLBACKS = [
    "business meeting",
    "office teamwork",
    "customer service",
    "financial advisor",
    "professional workspace",
];

let fallbackIndex = 0;

export const sanitizeImageQuery = (query: string): string => {
    const words = query.toLowerCase().replace(/[,;]/g, " ").split(/\s+/);

    const substituted = words
        .map(word => SUBSTITUTIONS[word] ?? word)
        .join(" ")
        .split(/\s+/);

    const cleaned = substituted
        .filter(word => word.length > 1 && !BANNED.has(word))
        .slice(0, 3)
        .join(" ");

    if (!cleaned || cleaned.length < 3) {
        // rotate through fallbacks so repeated empty queries get different images
        return FALLBACKS[fallbackIndex++ % FALLBACKS.length] ?? "business meeting";
    }

    return cleaned;
};
