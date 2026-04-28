export type BusinessType =
  | "restaurant"
  | "bar"
  | "cafe"
  | "gym"
  | "salon"
  | "retail"
  | "laundromat"
  | "auto_shop"
  | "other";

export type PipelineStatus =
  | "lead"
  | "evaluating"
  | "negotiating"
  | "under_contract"
  | "closed"
  | "passed";

export type Priority = "low" | "medium" | "high";

export interface DealInput {
  // Identity
  name: string;
  businessType: BusinessType;
  location: string;
  notes?: string;

  // Financials (annual, in EUR)
  revenue: number;
  rent: number;
  laborCost: number;
  cogs: number;
  utilities: number;
  otherExpenses: number;
  ownerSalary?: number; // adjustment add-back if owner-operator

  // Deal terms
  askingPrice: number;

  // Qualitative (0-10 user-estimated; defaults applied if missing)
  locationQuality?: number; // 0-10
  growthPotential?: number; // 0-10
  ownerDependency?: number; // 0-10 (10 = totally dependent on owner)
  seasonality?: number; // 0-10 (10 = highly seasonal)
}

export interface Deal extends DealInput {
  id: string;
  createdAt: string;
  status: PipelineStatus;
  priority: Priority;
  attachments?: Attachment[];
  aiNarrative?: AINarrative;
}

export type AIVerdict = "pursue" | "negotiate_hard" | "pass";

export interface AINegotiationPoint {
  point: string;
  leverage: string;
}

export interface AINarrative {
  thesis: string;
  verdict: AIVerdict;
  key_concerns: string[];
  negotiation_playbook: AINegotiationPoint[];
  due_diligence_checklist: string[];
  generatedAt: string;
}

export interface Attachment {
  id: string;
  name: string;
  type: string;
  size: number;
  dataUrl: string; // base64 data URL
  addedAt: string;
}

export interface Financials {
  revenue: number;
  totalExpenses: number;
  netProfit: number;
  ebitda: number;
  margin: number; // 0-1
  rentRatio: number; // 0-1
  laborRatio: number; // 0-1
  cogsRatio: number; // 0-1
}

export type RiskSeverity = "low" | "medium" | "high" | "critical";

export interface RiskFlag {
  code: string;
  label: string;
  severity: RiskSeverity;
  detail: string;
}

export interface ScoreBreakdown {
  profitability: number; // 0-100
  risk: number; // 0-100
  location: number; // 0-100
  growth: number; // 0-100
  priceFairness: number; // 0-100
  total: number; // 0-100
}

export interface ROI {
  paybackYears: number;
  yearlyReturnPct: number; // 0-1
  threeYearReturn: number; // total cash flow over 3 years (assuming flat)
}

export interface Offer {
  fairValue: number;
  suggestedOffer: number;
  walkAwayPrice: number;
  industryMultiple: number;
}

export interface Analysis {
  financials: Financials;
  score: ScoreBreakdown;
  risks: RiskFlag[];
  roi: ROI;
  offer: Offer;
  insights: string[];
}
