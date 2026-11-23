# Reflection – GR Check

**Author:** Nicolo Ruiz · **Assignment:** 4.2 AI-Powered Web Application · **Live app:** https://gr-check-woad.vercel.app

## What worked well
I come from 20 years in finance, with no coding or technology background. Working with Claude as a guide and Claude Code as the builder let me take a real business problem from idea to a live, tested web app. The structured path helped most: validate the idea, write the PRD, design the spec, and only then build. Writing the spec first meant Claude Code built what I actually pictured, not what it guessed. Each step ended in a small, reviewed commit, so I always knew what had changed and could check it in the browser myself.

## What surprised me and what went wrong
The biggest surprise was how fast business tools can now be built with AI: a working GR verification app with 181 automated tests, CI and a live URL in a matter of days. It was not easy, though. The hardest part was conceptualising: turning the picture in my head into precise rules the AI could follow.

Several things went wrong, and each one taught me something:
- **The AI misjudged "today's date."** In testing, the model treated a future-dated receipt as valid. I moved all date validation into code (spec v2.1). The lesson: let AI read and judge documents, but keep calculations and dates in deterministic code.
- **The school API key ran out of credit** after only US$0.14. I switched to my own OpenRouter key and compared models. Gemini Flash read my handwritten test receipt correctly at about ₱0.31 per check, much cheaper than the first model.
- **The demo would have broken after 29 November** because sample dates moved daily while my test photo's date did not. Fixing it taught me to think about how the marker or a user will see the app later, not just today.
- Smaller issues, like a configuration file that didn't download, showed me why checking every step matters.

## Where my finance expertise made the difference
The AI was a capable builder, but my domain knowledge had the final say on judgement, and I instructed the tool according to how the workflow really runs. Interviews with two credit officers and a credit manager confirmed the core problem: GR issues are found too late (at the due date, after it, or at 120+ days when the credit limit is already maxed). My review then changed the spec several times (v1 to v2.3):
- a **stamp is optional** but a signature is required, and **QR-code GRs** need no signature;
- the authorised recipient is the **person named in the PO**;
- **amount filters** so the credit team chases high-value invoices first;
- the **"verify first" rule**: no chasing until an unverified GR has been checked;
- every follow-up is **owned by the credit team** and routed to the right party.

## What I would do differently
I want to return to this project and enhance it, giving more thought to how it would work in a real credit team so it becomes more effective in practice. Next time I would also commit after every reviewed step (to keep each change separate) and set up my own API key and budget from the start.

## Would I use it in real life?
Yes. I would like to pilot it in a real scenario, with a small credit team, using dummy data first and then real documents only with proper privacy safeguards. A pilot would show what needs improving: accuracy on real-world GRs, bulk verification (already logged as GitHub issue #1), and integration with existing systems.

## Looking ahead
Completing this assignment has left me feeling **empowered to take action** and use more AI in both my work and my personal life. A week ago, building a working web app was outside what I thought I could do. Now I know that a finance professional who understands the problem deeply can work with AI to build the solution. I believe AI will be a **game changer** in how I work, and this project has given me the confidence to keep improving and adapting to these new ways of working.
