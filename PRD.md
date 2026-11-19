# PRD – GR Check (v1)

**Author:** Nicolo Ruiz · **Course:** Week 4 Graded Assignment 4.2 · **Status:** Draft v1

## Problem
Credit officers at Philippine B2B suppliers carry invoices that are 60+ days overdue because they are **not payment-eligible**: the Goods Receipt (GR) is missing or wasn't acknowledged by the customer's authorised recipient (the person named in the PO). The problem is worst for **third-party courier deliveries**, where nobody checks the GR. It is usually discovered only when the customer's AP rejects the invoice. Meanwhile, the customer's **new orders are blocked by credit control** because of the overdue balance, so a paperwork gap becomes lost sales. With 1,000+ customers, manual tracking fails.

## Target user
Credit officer at a Philippine B2B supplier managing 1,000+ customer accounts.

## Goal
Help the credit officer **find and fix GR blockers early**, so that invoices become payment-eligible before they age past 60 days.

## Core user flow
1. Upload an **invoice register (CSV)**.
2. See a dashboard of **payment readiness**, the **blocked 60+ invoices** and the **courier-delivered invoices with no GR**.
3. Open an invoice and upload its **GR document** (paper scan/photo or e-acknowledgement screenshot).
4. The AI returns a **verdict** with reasons and a **draft follow-up message**.

## MVP features (must have)
| # | Feature | Logic |
|---|---|---|
| F1 | CSV upload + validation (invoice no., customer, PO no., PO-named recipient, DR no., due date, amount, delivery mode, GR/POD/dispute status) | Code |
| F2 | Readiness dashboard: days overdue, 3-condition check, blocked 60+ list grouped by blocker, **early warning for any invoice with no verified GR 7 days after delivery** (courier deliveries ranked first) | Code |
| F3 | **AI GR verification:** extract signer name, date, DR/PO reference, stamp presence and acknowledgement type → compare with the PO-named recipient → **Valid / Invalid / Needs review** + reasons | **AI (vision)** |
| F4 | **AI follow-up draft:** message to the right party (customer receiving, courier or internal sales) based on the blocker | **AI (text)** |

## Out of scope (v1)
ERP/accounting integration · real customer data · reading PO PDFs automatically · bulk verification of many documents at once · payment processing · user accounts (optional)

## Success metrics
- AI verdict correct on **≥ 8 of 10** dummy GR test documents
- Blocked 60+ invoices identified in **under 1 minute** (vs. hours manually)
- GR problems detected **within 7 days of delivery**, instead of at due date or 120+ days (the current situation reported by 3 interviewed credit professionals)
- Positive feedback from 2–3 credit officers on usefulness

## Technical approach
Next.js + Tailwind · Vercel AI SDK with **OpenRouter** (vision-capable model) · API key in environment variables only · deployed on Vercel with GitHub Actions CI · dummy data only

## Risks
AI misreads handwriting or stamps → show extracted fields and a confidence level; "Needs review" sends the case to a human. PO-named recipient may not always be the authorised signer → allow manual override.

## v2 ideas (GitHub issue)
Bulk GR verification · auto-extract the recipient from PO PDFs · email/ERP integration · learn each customer's GR rules over time
