/**
 * Shared assertion harness for the `*:verify` scripts.
 *
 * `db:verify`, `auth:verify` and `profile:verify` all need the same
 * section/assert/report loop, so it lives here once. The scripts themselves
 * only declare assertions.
 */

export type Assertion = {
  description: string;
  test: () => boolean | Promise<boolean>;
};

export class VerifyHarness {
  private readonly sections: Array<{ title: string; assertions: Assertion[] }> = [];

  section(title: string, assertions: Assertion[]): this {
    this.sections.push({ title, assertions });
    return this;
  }

  /**
   * Run every assertion and print the per-section report, returning the counts.
   *
   * Scripts that add results after the static assertions (the live database
   * checks in `db:verify`) collect them and call `report()` themselves.
   */
  async runCollecting(): Promise<{ passed: number; failed: number }> {
    let passed = 0;
    let failed = 0;

    for (const group of this.sections) {
      console.log(`\n${group.title}`);

      for (const assertion of group.assertions) {
        let ok = false;
        let failureReason = "";

        try {
          ok = await assertion.test();
        } catch (error) {
          failureReason = ` (threw: ${error instanceof Error ? error.message : String(error)})`;
        }

        if (ok) {
          passed += 1;
          console.log(`  ✓ ${assertion.description}`);
        } else {
          failed += 1;
          console.log(`  ✗ ${assertion.description}${failureReason}`);
        }
      }
    }

    return { passed, failed };
  }

  /** Print the summary line and exit non-zero when anything failed. */
  report(passed: number, failed: number): never {
    console.log(`\n${failed === 0 ? "PASS" : "FAIL"} — ${passed}/${passed + failed} checks passed`);
    return process.exit(failed === 0 ? 0 : 1);
  }

  /** Run every assertion, print the report, and exit. */
  async run(): Promise<never> {
    const { passed, failed } = await this.runCollecting();
    return this.report(passed, failed);
  }
}

/** Validate a Mongoose document in memory — no database round-trip required. */
export async function isValid<TDocument>(
  model: { new (input: TDocument): { validate: () => Promise<unknown> } },
  input: Record<string, unknown>,
): Promise<boolean> {
  const document = new model(input as unknown as TDocument);
  try {
    await document.validate();
    return true;
  } catch {
    return false;
  }
}

/** Serialize a document the way an API response would. */
export function jsonOf(document: { toJSON: () => unknown }): Record<string, unknown> {
  return document.toJSON() as unknown as Record<string, unknown>;
}
