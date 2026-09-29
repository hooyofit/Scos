# ADR-0003: Status Semantics — S0–S7, E0–E5 and Capability Maturity Are Independent Scales

**Status:** Accepted (Stage 2.1 clarification, 2026-09-28)
**Supersedes:** none (clarifies the Stage 1 schema against a Stage 2 ambiguity)

## Context

The Stage 2 loading instructions contained an ambiguity: they specified
`living_status: "Not yet documented"` and `capability_maturity: "S0"`. The
Stage 1 schema defines S0–S7 as capability/living-status states and a separate
maturity scale for capability maturity. Using a free-text string in an enum
field (or an S-code in the maturity field) would corrupt the evidence
architecture. The Stage 2 build therefore applied the schema-compatible
mapping, and this record makes that decision explicit and permanent.

## Decision

1. **S0–S7 represent capability/living-status states.**
2. **S0 means "Unknown / not yet documented".** It is the *absence of a
   living-status assessment*, not a finding. It must never be read as proof
   that a capability is historically absent, no longer practiced, or
   disproven. The UI label for S0 is "Unknown / not yet documented", and the
   capability detail page states this explicitly.
3. **E0–E5 represent evidence levels** and are fully independent from S0–S7.
   Evidence describes *what has been verified*; living status describes *the
   state of the practice*. Neither scale implies the other.
4. **capability_maturity is a separate field** (L0–L9 scale) and remains
   `null` until a defined maturity assessment has actually been performed.
   No inventory record carries a maturity value by default.
5. **An E0/S0 record means:** the capability is an inventory subject —
   identified for research — with no verified evidence and no living-status
   assessment yet. Presence in the inventory is not a claim that the
   capability works, was universal, is currently practiced, or should be
   revived.
6. **No enum is ever replaced by free text.** If a value is unknown, the
   enum's zero-code (E0, S0) or `null` is used, and the display layer renders
   "Not yet documented".

## Consequences

- Positive: the evidence architecture stays machine-checkable (enums remain
  closed sets; tests can assert them).
- Positive: the distinction between inventory, evidence, verification and
  current practice is enforced in data, not just in prose.
- None of the 240 capability records change as a result of this ADR; they
  already carry `living_status: "S0"` and `capability_maturity: null`.
