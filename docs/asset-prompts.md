# Festify Visual Assets — Generation Prompts

Every prompt below is written for **Gemini image generation (Nano Banana)** for stills and **Veo** for video. **Each one is fully self-contained** — copy just the prompt block you need and paste it in directly.

**Direction: genuine anime key-visual art, not cartoon.** Think official anime movie poster / concert-anime key visual — the kind of art you'd see promoting a Makoto Shinkai film or an idol-anime concert arc (Your Name, K-On!, Love Live, Oshi no Ko). Detailed, refined character proportions and facial features — not simplified or cartoon-rounded. Painterly, richly rendered backgrounds with real atmospheric depth (not flat shapes). Cinematic, dramatic, composed expressions — determined, focused, joyful in a grounded way — never exaggerated cartoon mugging, no gag-comedy faces, no chibi proportions, no comic "impact star"/sweat-drop symbols. Fine detailed linework and soft cel-shaded gradient shading (not flat poster-color blocks). This is premium anime illustration, the kind studios actually release as official art, not a simplified sticker style.

## The shared visual world (already baked into every prompt below)

- **Art style:** official anime key-visual illustration — detailed character art with anime-style eyes/proportions rendered at a mature, refined level (not chibi, not super-deformed), painterly backgrounds with real depth and atmospheric perspective, soft cel-shaded gradients rather than flat poster color.
- **Lighting/palette:** stage lighting in electric violet (#6C4DFF), hot pink (#FF3D8A), and warm amber-orange (#FF7A29) against a warm near-black night (#16101F) — rendered as actual light sources with soft bloom/glow, the way anime studios render neon and stage lighting.
- **Setting:** an Indian college campus fest at night — Indian character designs, Indian campus architecture cues, fest banners, where relevant.
- **Mood:** composed and cinematic, not comedic or exaggerated — even the comedy-category piece should read as "a warm, genuine moment," not slapstick.
- **Never:** cartoon/chibi proportions, exaggerated gag expressions, comic-strip symbols (stars, sweat-drops, motion lines used as jokes), flat sticker-style color, photorealism, 3D render, or readable text/logos in frame.

---

## 1. Homepage hero video (the big one)

**Placement:** Full-bleed looping background video behind the homepage hero headline, muted/autoplay, ~8–15 second seamless loop. File goes at `frontend/public/media/hero-stage-loop.mp4`.

**Veo prompt:**
> An official anime key-visual scene rendered as a short animated loop, in the style of a concert-anime movie poster coming to life. An Indian college fest stage at night, painted with rich painterly detail and real atmospheric depth. Electric violet and hot-pink stage lights sweep across the scene with soft cinematic bloom, warm amber backlight rim-lighting the scene from behind, fine detailed light rays and drifting haze. Camera does a slow, deliberate push-in, building like the opening shot of an anime film. Refined anime linework, soft cel-shaded gradient lighting — not flat cartoon color. No exaggerated or comic elements. No readable text or logos anywhere in frame. 16:9, seamless loop, richly saturated violet/pink/amber against near-black.

**Alt option (calmer, better for headline text contrast):**
> An official anime key-visual background painting, cinematic and atmospheric: an Indian college fest stage at night, painterly rendered with real depth and soft light bloom. Electric violet and hot-pink light beams sweep slowly through drifting haze in the lower two-thirds of frame, warm amber glow from stage-truss silhouettes. The upper third of frame is mostly dark open sky, left open for text overlay. Gentle ambient animation only — light sweeps, haze drifts. Refined anime rendering, not flat cartoon style. No text or logos rendered in the image. 16:9, seamless loop.

---

## 2. Category cover photos (event cards, search filters)

One illustration per category, used as the fallback/hero image for that category's event cards. All in the same refined anime key-visual style, featuring Indian college-age characters rendered with real detail and composed, cinematic expressions.

**Hackathon**
> Official anime key-visual illustration: an Indian college student character at a laptop at 2am, a focused, determined expression rendered with real anime-style detail (not exaggerated), laptop screen glow lighting their face in cool blue-white against violet and hot-pink ambient light from string-lights along the wall behind them. Energy drink cans and a sketch-covered notebook nearby, whiteboard diagrams softly out of focus in the background. Painterly rendering, soft cel-shaded gradients, cinematic depth of field. No cartoon exaggeration. 3:2.

**Cultural (fest/dance)**
> Official anime key-visual illustration: an Indian college student character mid-motion in a traditional-fusion dance costume on an outdoor night stage, fabric flowing with graceful, detailed motion rendering, dramatic violet and hot-pink spotlights crossing the stage with soft bloom, warm amber haze. Composed, focused performance expression — dignified, not exaggerated. Dynamic but refined low-angle composition. Painterly background depth, soft cel-shaded gradient lighting. 3:2.

**Music (DJ/concert night)**
> Official anime key-visual illustration: an Indian college student character at a DJ booth, one hand on the mixer, a focused and confident expression rendered with anime-style detail and restraint, violet-and-hot-pink stage lighting rig behind them with soft glow bloom, warm amber haze, crowd silhouettes with raised hands softly rendered in the foreground. Painterly depth, refined linework, cinematic lighting. 3:2.

**Sports**
> Official anime key-visual illustration, sports-anime style: an Indian college athlete character mid-sprint or mid-jump on a floodlit night track, dynamic but anatomically grounded motion, a determined and composed expression, warm-amber floodlight wash with violet-and-pink string lights along the sidelines rendered softly in the background. Refined anime sports-poster energy — dramatic, not cartoonish. Painterly rendering, soft cel-shaded gradients. 3:2.

**Talk (keynote/panel)**
> Official anime key-visual illustration: an Indian college student character mid-gesture on an auditorium stage, a composed, confident expression, warm amber spotlight on them with violet ambient wash on the curtains behind, audience silhouettes softly rendered in the foreground. Calm, dignified energy. Painterly background depth, refined anime linework and soft cel-shaded gradients. 3:2.

**Workshop**
> Official anime key-visual illustration: an Indian college student character focused over a workbench — robotics parts, circuitry, or craft materials in front of them, a quiet, concentrated expression rendered with real anime-style detail, warm amber task lighting mixed with violet ambient room light. Painterly rendering, soft cel-shaded gradients, no cartoon exaggeration. 3:2.

**Party**
> Official anime key-visual illustration: a wide cinematic shot of Indian college student characters dancing at an indoor fest, rendered with graceful detailed motion rather than cartoon energy, hot-pink and violet light washing over the scene with soft bloom, confetti caught mid-air by the light. One character in the foreground with a genuine, warm smile — composed, not exaggerated. Painterly depth, refined anime rendering. 3:2.

**Comedy**
> Official anime key-visual illustration: an Indian college student character mid-sentence on a small stage, a warm, genuine expression — not an exaggerated gag face — under a single amber spotlight, violet ambient light on the back wall, audience silhouettes softly rendered in the foreground reacting warmly. Intimate, small-venue mood, refined anime rendering, no comic symbols. 3:2.

**Theatre**
> Official anime key-visual illustration: an Indian college student character in a dramatic costume mid-scene on stage, strong theatrical side-lighting in violet and warm amber with soft cinematic bloom casting graceful shadows, minimal set pieces, audience silhouettes softly rendered in the very foreground. A held, dignified dramatic pose. Painterly rendering, refined linework, soft cel-shaded gradients. 3:2.

---

## 3. Login page background

**Placement:** Ambient background behind the login/onboarding form (`LoginPage.jsx`).

**Prompt:**
> Official anime key-visual background painting: a wide establishing shot of an Indian college campus quad at night during a fest, rendered the way an anime film's establishing shot looks — richly painterly, real atmospheric depth. Fest banners and string lights strung between buildings, a stage visible in the mid-distance lit in violet and hot-pink with soft bloom, a few small, softly rendered student-character silhouettes walking in the foreground, warm amber building windows lit in the background. Calm and cinematic rather than high-energy, wide-angle composition with open negative space on one side for a login form to sit on top of. Refined anime background art, no cartoon style, no readable text or logos. 16:9.

---

## 4. Organizer dashboard hero banner

**Placement:** Top banner on the organizer dashboard (`OrgPages.jsx`) — behind-the-scenes control energy, not the attendee view.

**Prompt:**
> Official anime key-visual illustration: an Indian college student character backstage in a fest-crew t-shirt, headset on, one hand on a walkie-talkie, a calm, confident expression rendered with real anime-style detail and restraint, stage lighting rig glowing violet and hot-pink with soft bloom visible behind them through a gap in the curtain, warm amber work-light nearby, faint atmospheric haze. Painterly rendering, refined linework, cinematic depth. No cartoon exaggeration. 21:9 wide banner crop.

---

## 5. Empty states & micro-moments

**Empty wishlist / empty ticket wallet:**
> A quiet, minimal anime-style illustration: a single string-light bulb strand coiled on a dark warm-black surface, one bulb glowing softly violet with a delicate, realistic light-bloom shine — no cartoon sparkle symbol. A calm image suggesting "nothing here yet, but it's about to light up." Refined rendering, soft gradient glow, lots of negative dark space left open for text overlay. No text or logos in frame. Square 1:1.

**Ticket purchase success / confirmation moment:**
> Official anime key-visual illustration: an Indian college student character's hand holding up a glowing phone showing a ticket/QR screen, a warm, genuine expression softly visible or out of focus behind, gentle realistic light bloom around the phone screen (no comic sparkle symbols), violet and hot-pink ambient light from an out-of-focus fest scene behind them at night. A quiet, satisfying "got the ticket" moment rendered with cinematic restraint. Painterly depth, refined anime rendering. No readable UI text actually rendered — just implied screen glow. 4:5 portrait.

---

## 6. Optional: short video loops for event detail pages

**Placement:** A muted, looping ambient video (3–6 sec) at the top of `EventDetailPage.jsx`, ideally one per major category, otherwise reuse the homepage hero loop.

**Veo prompt — dance/cultural variant:**
> An official anime key-visual animation loop: an Indian college student character mid-dance on an outdoor night stage, fabric and hair animated with graceful, detailed motion, electric violet and hot-pink stage lighting sweeping across them with soft cinematic bloom, warm amber backlight, drifting haze. First and last frame match closely enough to loop seamlessly. Refined anime rendering, painterly depth, no cartoon exaggeration. No text or logos. 16:9.

**Veo prompt — DJ/music variant:**
> An official anime key-visual animation loop: an Indian college student character at a DJ booth, hand animated moving across the mixer with subtle, controlled motion, violet and hot-pink stage lighting pulsing with soft bloom, warm amber haze drifting behind. First and last frame match closely enough to loop seamlessly. Refined anime rendering, painterly depth. No text or logos. 16:9.

**Veo prompt — crowd/atmosphere variant:**
> An official anime key-visual animation loop: a cinematic shot of softly rendered Indian college student character silhouettes with hands raised at a night fest, electric violet and hot-pink sweeping stage lighting with soft bloom, warm amber backlight, confetti animated drifting through the beams. First and last frame match closely enough to loop seamlessly. Refined anime rendering, painterly depth, no cartoon exaggeration. No text or logos. 16:9.

---

## Where generated files go in the codebase

- Homepage hero video → `frontend/public/media/hero-stage-loop.mp4`
- Category illustrations → `frontend/public/media/categories/{category-slug}.jpg` (e.g. `hackathon.jpg`, `cultural.jpg`) — then swap `HERO_BACKGROUND_IMAGE` and the Unsplash fallback URLs in `mockData.js` / `domain/index.jsx` to point at these once real event cover images exist per-event.
- Login background → `frontend/public/media/login-bg.jpg`
- Organizer banner → `frontend/public/media/org-dashboard-hero.jpg`
- Event detail loops → `frontend/public/media/event-loops/{category-slug}.mp4`

Drop generated files at those paths (create the folders if they don't exist) and the `<video>`/`<img>` tags already wired up in the homepage will pick them up automatically — no code change needed there.
