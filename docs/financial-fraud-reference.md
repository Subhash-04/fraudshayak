# Financial cybercrime complaint collection reference — India

Research reviewed: 28 October 2026. This is an application collection guide, not a certified copy of the live NCRP form or legal advice.

## Sources and verification limits

1. [NCRP complainant checklist](https://www.cybercrime.gov.in/Webform/Crime_AuthoLogin.aspx?rnt=5): official search-index excerpts. Direct page retrieval was blocked. The excerpt specifies incident date/time, a narrative of at least 200 characters, identity document, financial transaction details, and relevant evidence.
2. [MHA citizen manual](https://www.cybercrime.gov.in/UploadMedia/MHA-CitizenManualReportOtherCyberCrime-v10.pdf): 2019 historical manual, official search-index excerpts. Do not treat its category list as exhaustive/current.
3. [I4C FAQ](https://i4c.mha.gov.in/FAQ.aspx): official search-index excerpts. Describes 1930 and completing the formal portal complaint within 24 hours of helpline acknowledgement.
4. [L&T Finance cybercrime reporting guide](https://www.ltfinance.com/docs/default-source/default-document-library/risk-control/cybercrime_reporting.pdf?sfvrsn=b5ae3d8_1): full document retrieved and read. Secondary corroboration of seven financial subcategories and the login/OTP/captcha/preview/submit workflow.
5. [NCRP educational categories](https://www.cybercrime.gov.in/Webform/video-category.aspx): official search-index excerpts. These are learning labels, not proof of live form dropdown options.

The machine-readable companion is `artifacts/api-server/src/fraud/knowledge/financial-fraud.json`. The app exposes it through “Download sourced reference file” in the category checklist. Agents use that same file, rather than a separately maintained category list.

## Common details to prepare

- Full complainant name, contact number, state/district and address/PIN code.
- Incident date/time and a chronological factual account: first contact, promise/threat, action taken, transfer, discovery and follow-up.
- Whether money was actually lost. For each affected transaction: bank/wallet/merchant, amount, date/time, payment method and exact reference/UTR.
- Masked account/wallet identifiers in this app. Provide full identifiers only on the official portal if requested.
- Known suspect phone, email, URL, handle, displayed name and beneficiary details. Unknown suspect details must not be fabricated or delay urgent reporting.
- Original messages, receipts, statements, screenshots, call records and other relevant evidence.
- Bank/provider report details; prior 1930/portal acknowledgement, if any.
- Keep a national ID ready for the official portal. Do not put ID documents/numbers, OTPs, passwords, PINs, CVVs, full card numbers or wallet seed phrases in the chat.
- Review and explicitly confirm the recorded facts before a draft is generated. Approve the draft separately after reading it.

The indexed portal checklist mentions identity images up to 5 MB and evidence up to 10 MB each. Confirm current portal file-type and size rules. Do not change or pad a UTR to an assumed fixed length.

## Payment/reporting categories and additional collection questions

The following seven reporting subcategories are corroborated by the L&T guide. Confirm the exact wording/options on the live portal.

| Reporting subcategory | Additional details to collect |
|---|---|
| UPI Related Frauds | UPI app; send/collect/QR/mandate; recipient UPI/displayed name; reason given for paying; whether the user approved the transfer. Never ask for a UPI PIN. |
| Internet Banking Related Fraud | Internet/mobile banking or NEFT/RTGS/IMPS/AEPS channel; beneficiary details; device/account access; user authorization and alerts. |
| Debit/Credit Card Fraud/SIM Swap Fraud | Card last four digits only; ATM/POS/online/contactless channel; merchant/location; whether card remained with victim; lost/stolen/blocked status; SIM/network changes. |
| E-Wallet Related Fraud | Wallet provider and masked identifier; unauthorized debit/takeover/refund mechanism; recipient wallet/merchant. |
| Business Email Compromise/Email Takeover | Organization and impersonated/compromised email; discovery time; altered invoice/payment instructions; verification attempts; original emails with full headers and invoices. |
| Demat/Depository Fraud | Broker/depository participant; masked trading/demat identifier; securities and quantities; disputed trades/transfers; contract notes, alerts and instructions; broker report. |
| Fraud Call/Vishing | Claimed identity; call number/handle/time; request/promise/threat; actions performed; beneficiary and payment channel. |

## Scam scenarios: do not confuse these with payment channels

| Scenario | Additional details | Mapping caution |
|---|---|---|
| Fake investment/trading/crypto scheme | Platform/URL/app/adviser/group; promised returns; each deposit; withdrawal refusal and extra-fee demands; chats/receipts and beneficiary | Demat only for actual securities-account activity; otherwise use the applicable financial/payment route. Never collect private keys. |
| Fake job/task/recruitment | Employer/recruiter/platform; contact method; offered job/task; recruitment/training/registration/withdrawal fees; offers/instructions/receipts | Job scam is a scenario, not a verified financial-dropdown label. |
| Loan-app/advance-fee scam | Lender/app/agent; requested, received and repaid amounts; charges; contact access; threats and messages | Select financial/payment route; report threats as applicable. |
| Remote-access scam | App/device, installation time, caller instructions, permissions, affected accounts and containment steps | Remote access is the method, not the payment route. |
| OTP/social engineering | Claimed purpose/service; contact identifiers; account impact; SIM/network changes | Record that a code was shared, never the code itself. |
| Phishing | Sender/domain/URL; types of data/permissions exposed; affected accounts and security actions | Do not reopen malicious links or repeat secret values. |
| Online purchase/marketplace | Seller/platform/order; item and date; payment, delivery/refund promise; what arrived; contact/dispute attempts; reason deception is suspected | An ordinary service dispute is not automatically criminal fraud. |
| Mistaken payment | Accident versus deception; recipient; bank reversal/dispute reference and response | Prefer bank/payment-provider dispute support unless deception/unauthorized activity is suspected. |
| Other suspected financial fraud | Mechanism; first contact; promise/threat; app/phone/URL/handle; known beneficiary | Keep uncertainty explicit; do not force a category. |

These additional questions are application collection recommendations, not claimed government-mandatory fields. “Unknown”, “not available”, “none” and “provide on portal” are valid explicit answers for supplemental information. Missing official transaction details must be completed on the portal if required.

## Draft and filing pack

The pack contains complainant details, the factual narrative, provisional category, transaction schedule, category-specific answers, evidence index and official filing instructions. It is not an FIR, government document or proof of submission.

1. For a recent unauthorized loss, contact the bank's verified fraud channel and call **1930 immediately**. Do not wait to complete the app.
2. Open [the official NCRP website](https://www.cybercrime.gov.in/), confirm the current category and follow its reporting flow.
3. Register/login and complete OTP/captcha yourself, on that website only.
4. Transfer the reviewed facts and each transaction. Upload original evidence/identity documents where the portal requests them.
5. Read the declaration, preview and submit yourself.
6. Save the official acknowledgement and submitted complaint PDF. A reference typed into this app remains user-reported and unverified.
7. If the initial report was through 1930, follow I4C/SMS instructions to complete the formal portal complaint within 24 hours using the acknowledgement.

No authorised automatic NCRP submission or live status integration has been established for this app. Never manufacture an acknowledgement, submission success, frozen funds or recovery.
