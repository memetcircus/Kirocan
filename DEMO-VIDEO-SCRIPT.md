# KiroCan Demo Video Script

**Target duration:** 2:30–3:00 minutes  
**Format:** Screen recording + iPhone footage of MX Creative Console  
**Voiceover:** Akif (recorded separately or live)

---

## Scene 1 — Introduction (0:00–0:20)

**Show:** KiroCan ghost animation GIF or the console with ghost walking  
**Narration:**

> Hi, I'm Akif. This is KiroCan — a physical AI coding companion that turns the Logitech MX Creative Console into a hardware controller for Kiro IDE.
>
> The problem is simple: when you're deep in code, switching between your keyboard and mouse to interact with Kiro breaks your flow. KiroCan gives you dedicated physical buttons for the actions you use most.

---

## Scene 2 — Architecture Overview (0:20–0:40)

**Show:** Quick diagram (README architecture diagram or a simple slide)  
**Narration:**

> Here's how it works. The MX Creative Console runs a C# plugin that talks to a local Node.js bridge over HTTP. The bridge then controls Kiro through Win32 keyboard simulation — no API keys, no cloud, everything runs locally on your machine.

---

## Scene 3 — Ghost Animation Demo (0:40–1:10)

**Show:** iPhone filming the console buttons + screen showing Kiro working  
**Narration:**

> The highlight feature is the ghost animation. When Kiro starts working, a 30-frame animated ghost walks across all 9 LCD buttons, turning them into a single 360-by-360 pixel canvas.
>
> Watch — I'll press a prompt button... and there it goes. The ghost walks while Kiro thinks.
>
> It also reacts to context health. As the context window fills up, the ghost gets worried. And when it's critical — the ghost catches fire. This gives you a real-time physical indicator of your context budget.

**Action:** Press "Explain" or any prompt button, show ghost animation starting, then show worried/fire variants if possible.

---

## Scene 4 — Button Features Demo (1:10–1:50)

**Show:** iPhone on console + screen recording of Kiro  
**Narration:**

> KiroCan has three pages of buttons. Page one has snippet qualifiers — things like "Be Honest", "Keep Short", "No Tests" — that append text to your chat without sending.
>
> Page two has utility controls. New Session, Inline Chat, Screenshot to Chat, Screen Record, Paste to Kiro, and even a Git Commit button.
>
> Page three has prompt commands — Explain, Refactor, Fix Bug, Write Tests — each sends a full prompt to Kiro with one press.

**Action:** Show pressing a few buttons on each page, show the effect in Kiro.

---

## Scene 5 — How Kiro Was Used (1:50–2:20)

**Show:** Screen recording browsing .kiro/specs in the repo  
**Narration:**

> This entire project was built using Kiro's spec-driven workflow. I started with requirements in EARS pattern, then Kiro generated a technical design with architecture diagrams and correctness properties.
>
> From there, 18 implementation tasks were created and I worked through them one by one with Kiro — the same tool this project is designed to control.
>
> The project also uses Kiro hooks for its own state detection — when Kiro starts or stops working, a hook notifies the bridge, which triggers the ghost animation. So KiroCan is literally powered by Kiro features.

**Action:** Scroll through specs, show hooks files briefly.

---

## Scene 6 — Closing (2:20–2:45)

**Show:** Console with ghost animation running, then idle state with button labels visible  
**Narration:**

> KiroCan makes AI-assisted coding more tactile and more fun. No more alt-tabbing to stop generation, no more copy-paste workflows — just press a button.
>
> Everything is open source, runs fully offline, and installs with a single command. Check out the repo link in the description.
>
> Thanks for watching.

---

## Production Notes

- Keep cuts tight — aim for ~3 seconds per shot max during button demos
- iPhone footage: film the console at a slight angle so LCD screens are visible
- Screen recording: have Kiro open with a real project, not an empty workspace
- For ghost animation scene: have bridge running + trigger a real Kiro task
- For context health variants: you may need to manually hit the bridge endpoint to simulate worried/critical states if you can't fill context naturally in 3 minutes
