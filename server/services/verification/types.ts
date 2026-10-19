export type VerificationStatusResult = 'VALID' | 'INVALID' | 'CATCH_ALL';

export interface VerificationResult {
  email: string;
  status: VerificationStatusResult;
}

/**
 * Contract every email-verification vendor integration must implement.
 *
 * Why an interface instead of one hardcoded provider: verification vendors
 * price very differently by volume/feature (e.g. NeverBounce vs ZeroBounce vs
 * BounceBan), and different tiers of leads may warrant different vendors
 * (cheap bulk sanity-check vs a premium catch-all-resolving check for
 * high-value accounts). Adding a new vendor should only ever require adding
 * one new file in `./providers/` plus a `case` in `index.ts`'s factory —
 * nothing else in the codebase should need to change.
 */
export interface VerificationProvider {
  /** Stable machine name, used for env var selection and logging. */
  readonly name: string;

  /** True when this provider has the credentials it needs to make real API calls. */
  isConfigured(): boolean;

  /** Submit a batch of emails for verification. Returns a vendor job id. */
  submitBulkJob(emails: string[]): Promise<string>;

  /** Poll a previously submitted job. `isComplete: false` means "keep polling". */
  getBulkJobResults(
    jobId: string,
    originalEmails: string[]
  ): Promise<{ isComplete: boolean; results: VerificationResult[] }>;
}
