export interface ProposalData {
    productName: string;
    productDescription: string;

    companyName: string;
    companyDescription: string;

    industry: string;
    subIndustry: string;
    subSubIndustry: string;

    clientContext: string;

    painPoint: string[];

    metaData: MetaData;
}

export interface MetaData {
    clientName: string;
    region: string;
    targetAudience: string;
    companySize: string;
    budgetRange: string;
    proposalType: string;
    expectedOutcome: string;
    brandTone: string;
    presentationTheme: string;
    language: string;
}

export interface deckPlannerAgentData {

}