import type { Analysis, Deal } from "./types";
import { BUSINESS_TYPE_LABELS } from "./multiples";
import { eur } from "./format";

export interface LoiInput {
  buyerName: string;
  buyerEntity?: string;
  closingDate: string; // ISO date
  earnestMoney: number;
  dueDiligenceDays: number;
  financingContingency: boolean;
}

export function defaultLoiInput(): LoiInput {
  const closing = new Date();
  closing.setDate(closing.getDate() + 60);
  return {
    buyerName: "",
    buyerEntity: "",
    closingDate: closing.toISOString().slice(0, 10),
    earnestMoney: 5000,
    dueDiligenceDays: 30,
    financingContingency: true,
  };
}

export function generateLoi(deal: Deal, analysis: Analysis, l: LoiInput): string {
  const offer = analysis.offer.suggestedOffer;
  const lines: string[] = [];

  lines.push(`LETTER OF INTENT`);
  lines.push(``);
  lines.push(`Date: ${new Date().toLocaleDateString("en-IE")}`);
  lines.push(``);
  lines.push(`Re: Proposed acquisition of ${deal.name} (${BUSINESS_TYPE_LABELS[deal.businessType]}, ${deal.location})`);
  lines.push(``);
  lines.push(
    `This non-binding Letter of Intent ("LOI") sets forth the principal terms under which ${l.buyerEntity || l.buyerName || "the Buyer"} ("Buyer") proposes to acquire the assets and ongoing operations of ${deal.name} ("Seller").`,
  );
  lines.push(``);
  lines.push(`1. PURCHASE PRICE`);
  lines.push(
    `   Buyer offers a total purchase price of ${eur(offer)}, payable at closing in immediately available funds, subject to the conditions below.`,
  );
  lines.push(``);
  lines.push(`2. STRUCTURE`);
  lines.push(
    `   The transaction is contemplated as an asset purchase, including all furniture, fixtures, equipment, inventory, customer lists, goodwill, and assignable contracts. Excluded liabilities will be defined in the definitive agreement.`,
  );
  lines.push(``);
  lines.push(`3. EARNEST MONEY DEPOSIT`);
  lines.push(
    `   Upon execution of this LOI, Buyer shall deposit ${eur(l.earnestMoney)} into escrow, applicable to the purchase price at closing or refundable should Buyer terminate during the due diligence period.`,
  );
  lines.push(``);
  lines.push(`4. DUE DILIGENCE`);
  lines.push(
    `   Buyer shall have ${l.dueDiligenceDays} days from the date of this LOI to complete financial, legal, and operational due diligence. Seller shall provide reasonable access to records, staff, premises, and the lease agreement.`,
  );
  lines.push(``);
  lines.push(`5. CLOSING`);
  lines.push(
    `   The parties shall target a closing date of ${new Date(l.closingDate).toLocaleDateString("en-IE")}, subject to satisfaction of all closing conditions.`,
  );
  lines.push(``);
  if (l.financingContingency) {
    lines.push(`6. FINANCING CONTINGENCY`);
    lines.push(
      `   Closing is contingent on Buyer obtaining acquisition financing on commercially reasonable terms.`,
    );
    lines.push(``);
  }
  lines.push(`7. EXCLUSIVITY`);
  lines.push(
    `   For 45 days following execution of this LOI, Seller agrees not to solicit, entertain, or accept any competing offers regarding the sale of the business.`,
  );
  lines.push(``);
  lines.push(`8. CONFIDENTIALITY`);
  lines.push(
    `   The existence and terms of this LOI, and all information exchanged between the parties, shall be treated as strictly confidential.`,
  );
  lines.push(``);
  lines.push(`9. NON-BINDING`);
  lines.push(
    `   Except for sections 7 (Exclusivity) and 8 (Confidentiality), this LOI is non-binding and creates no obligation to consummate the transaction. A binding agreement will arise only upon execution of a definitive Asset Purchase Agreement.`,
  );
  lines.push(``);
  lines.push(``);
  lines.push(`Buyer: ${l.buyerName || "_________________________"}`);
  if (l.buyerEntity) lines.push(`Entity: ${l.buyerEntity}`);
  lines.push(``);
  lines.push(`Seller: _________________________`);
  return lines.join("\n");
}
