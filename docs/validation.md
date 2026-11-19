# Idea Validation – GR Check (working name)

> AI assistant that helps credit officers find invoices that are **blocked from payment** because the Goods Receipt (GR) is missing or wasn't acknowledged by the authorised recipient, and flags it **within days of delivery** instead of after the invoice goes overdue.

**Author:** Nicolo Ruiz · Framework: course 7-Step Validation

---

## 1. Define the Problem
*Test: a real, specific pain point exists that people actively try to solve.*

Many invoices more than 60 days overdue are not "late" because the customer refuses to pay. They are **not yet eligible for payment**. In the Philippines, the customer's AP will only process an invoice when three conditions are met:

1. **Goods Receipt (GR)** acknowledged by the customer's **authorised recipient** (in practice, the person named in the Purchase Order)
2. **Proof of Delivery (POD)** document
3. **No dispute** on the invoice

Condition 1 fails most often:
- **Mixed GR formats:** stamped paper delivery receipts, electronic acknowledgements in the customer's own system, or both.
- **Unknown authorised signer:** customers rarely share a list; the supplier finds out the GR is invalid **only when AP rejects the invoice**.
- **Third-party courier deliveries:** the courier's POD proves arrival, but **nobody checks whether a valid GR was obtained**.

**Business impact (domain experience, 20 years in finance):** overdue receivables create a **bottleneck in the order-to-cash cycle**. When the customer orders again, the order is **blocked by credit control** because of the overdue balance. A paperwork gap therefore turns into **delayed or lost sales**, even though the customer is willing and able to pay.

**People actively try to solve it today:** with Excel trackers, SOA follow-ups, POD reviews and calls to logistics. All of it is manual and reactive.

**User interviews (3 credit professionals, anonymised):**

| Interviewee | When they find out about a missing or invalid GR |
|---|---|
| Credit Officer 1 | Only when the customer replies to the **Statement of Account (SOA)**, usually just before the **due date** |
| Credit Officer 2 | Only when the invoice is **already overdue** and she sees the POD was **done incorrectly** |
| Credit Manager | Only when it's at its worst: aging **above 120 days** and the **credit limit is already maxed out** |

**Key insight:** all three discover GR problems **reactively and late**. None can check GR validity soon after delivery, when it's still easy to fix.

**Supporting evidence:**
- Large customers formalise the rule. Accenture's Philippine supplier guide requires a signed delivery receipt with the **authorised POC name**, signature and delivery date. [Accenture Suppliers Guide – PH](https://accenture.com/content/dam/accenture/final/accenture-com/document-3/Accenture-Suppliers-Guide-To-Invoicing-Accenture-Philippines.pdf)
- Missing POD puts the invoice on hold regardless of actual delivery, and every day adds to DSO. [Podfy](https://podfy-site.pages.dev/guides/pod-invoicing/)
- Aging destroys recoverability: invoices 90 days late are paid in about 70% of cases, and only about 50% after 6 months. [My DSO Manager](https://www.mydsomanager.com/online-help.php?question=7)

## 2. Profile the Target Customer
*Test: a reachable, identifiable group has this problem badly enough to pay.*

| | |
|---|---|
| **User** | Credit officer at a Philippine B2B supplier (distribution or manufacturing) managing **1,000+ customer accounts** |
| **Buyer (who pays)** | Credit Manager / Finance Manager / CFO, who owns DSO, bad-debt provisions and the credit-hold problem |
| **Customer profile** | Small and medium suppliers selling to corporates, modern retail and government, i.e. customers with strict AP document rules; heavy use of 3PL couriers |
| **Why they'd pay** | The problem costs **cash** (higher DSO), **sales** (orders blocked by credit hold) and **write-offs** (old invoices lose recoverability). Recovering even one blocked key account can exceed a year of subscription cost |
| **How to reach them** | Personal network of credit professionals (already used for interviews), LinkedIn finance/credit communities, professional credit and finance associations, accounting-software partners |

## 3. Size the Market
*Test: the opportunity is large enough to build a sustainable business.*

- The Philippines had **1,246,373 business enterprises** in 2023; **Wholesale and Retail Trade** is the largest sector, with **604,313 MSMEs**. [DTI – 2023 MSME Statistics](https://dti.gov.ph/businesses/msmes/msmeresources/msme-statistics)
- Serviceable market: firms large enough to have a credit function, about **109,910 small** and **4,763 medium** establishments, plus large enterprises. [PSA – 2023 ULE](https://rssocar.psa.gov.ph/system/files/attachment-dir/CAR-SSR-2025-26_MSMEs_in_the_Cordillera_2023_ULE.pdf)
- Late payment is widespread: across Asia, over 80% of suppliers report late payments and nearly one third of B2B receivables are overdue. [Atradius Asia 2026](https://atradius.de/newsroom/reports/b2b-payment-practices-trends-in-asia-2026)
**Illustrative sizing (TAM / SAM / SOM):**

| Layer | Definition | Estimate |
|---|---|---|
| **TAM** – total market | All business enterprises in the Philippines (2023) | ~1.25M firms |
| **SAM** – serviceable market | Small + medium firms with a credit function (109,910 + 4,763) | ~115,000 firms |
| **SOM** – obtainable market | **4% adoption** of SAM *(assumption)* | ~4,600 firms |
| **Price** | **PHP 500 per month** entry price *(assumption)*, i.e. PHP 6,000 per year | |
| **Potential revenue** | 4,600 firms × PHP 6,000 | **≈ PHP 27.6M per year** |

The low entry price is deliberate: it lowers the barrier for small credit teams, with room to raise prices later (e.g. tiers for bulk verification or ERP integration). Further upside: other Southeast Asian markets with similar document-based AP rules.

## 4. Map the Competition
*Test: no existing solution fully solves the problem; there's a gap worth filling.*

| Alternative | What it does | Gap |
|---|---|---|
| Excel tracker + manual follow-up | Lists invoices and statuses | Doesn't scale to 1,000+ customers; GR validity never checked |
| Courier POD / tracking portals | Prove the goods arrived | Don't prove a **valid customer GR** by the authorised recipient |
| SOA follow-ups / waiting for AP rejection | Surfaces the problem eventually | Weeks late, after the invoice is overdue |
| AR automation tools (Chaser, Upflow, HighRadius) | Automate payment reminders, dunning, cash application | Reminders don't help when the invoice **isn't payment-eligible**; mostly built for UK/US/EU, priced for mid-market/enterprise |
| ERP / accounting systems | Store invoices and aging | Don't read or validate GR documents |

**Gap:** no tool checks **GR validity against the PO-named recipient** soon after delivery.

## 5. Define Your Edge
*Test: there's a specific reason why you, and this timing, can win.*

- **Why me:** 20 years in finance, with first-hand knowledge of the GR/POD/dispute rules, the order-to-cash impact and how credit teams actually work. I know what a valid GR looks like and what AP rejects.
- **Why now:** affordable **vision-capable AI models** can now read stamped paper scans, handwriting and system screenshots well enough to automate a check that used to need a person to look at every document.
- **Product edge: "Fix eligibility before you chase payment."** Detection moves from *after overdue* to *within 7 days of delivery*, with courier deliveries prioritised and each blocker routed to the right party (customer, courier or internal sales).
- **Low friction:** no ERP integration for the MVP, just a CSV upload and document upload.

## 6. Design a Cheap Test
*Test: people will change their behaviour (and pay) for a solution.*

| Test | How | Pass criteria |
|---|---|---|
| **T1 – AI accuracy** | Create **10 dummy GR documents** (clean, messy handwriting, wrong signer, unsigned, e-acknowledgement screenshot) and run them through the AI check | ≥ 8/10 correct verdicts |
| **T2 – Behaviour change** | Demo the live prototype to the **3 interviewees** using dummy data | ≥ 2 of 3 say they would check GRs at delivery+7 days with this tool instead of waiting for SOA replies or AP rejection |
| **T3 – Willingness to pay** | Ask the Credit Manager: "Would you pilot this for a month? What would you pay per month?" | A pilot commitment or a stated price ≥ PHP 500/month |

All tests use **dummy data and fake GR images only**.

## 7. Stress-Test the Idea
*Test: the risks are known and manageable, or reveal a fatal flaw before you invest.*

| Risk | Severity | Mitigation |
|---|---|---|
| AI misreads handwriting, stamps or poor scans | High | Show the extracted fields and a confidence level; a **"Needs review"** verdict routes to a human; measure with T1 |
| The PO-named person isn't always the authorised signer | Medium | Treated as a working rule (seller's advice); the user can **override the recipient name**; record exceptions per customer (v2) |
| AI says "Valid" but AP still rejects (false confidence) | Medium | Frame the output as **decision support**, not approval; log AP outcomes to improve rules |
| Data privacy: GRs contain names and signatures | Medium | MVP uses dummy data only; no documents stored after the check; production would need privacy-law compliance and consent |
| Adoption: officers won't upload documents one by one | Medium | Prioritise by risk (courier + high value first); v2 bulk upload and email/ERP integration |
| E-acknowledgements live inside customer portals the supplier can't access | Low–Med | Accept screenshots or PDFs exported or emailed by the customer |

**Verdict:** no fatal flaw found. The biggest risk (AI accuracy) is cheap to test first with T1, before building the full app.
