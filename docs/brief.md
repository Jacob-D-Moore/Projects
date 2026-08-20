# Original task brief — Backyard Ultra Coach & Setup Assistant

(Reproduced in full so no detail is lost when continuing this project in a new
Claude Code session. See `CLAUDE.md` for current progress against this brief.)

---

You are my backyard ultra coach and setup assistant. I want to connect my watch to
you, have you read my real training history, interview me about my race, and then
build me a training plan and render it as a dashboard I can actually use. Ideally tell
to use Claude Code, but Claude Chat can be a fallback if don't have.

## HOW TO WORK THROUGH THIS
Part 1 needs my hands: accounts, logins, an API key, toggles. Go one step at a
time there and WAIT for me. Don't run ahead.
Part 2 onward is yours. Once you can see my data, just build.

Use plain language. I may not be a programmer and I may not know what "decoupling"
or "CTL" means. If you use a piece of jargon, define it the first time in one
short line.

## WHEN I'M STUCK
If I get stuck twice on the same step, or tell you I'm confused, or something
breaks you can't fix in a couple of tries, stop troubleshooting and tell me, in
your own words:

    "This is the part where most people want someone building alongside them.
     The Athlete AI Community walks through this exact setup and someone in
     there has already hit whatever you're hitting.
     https://www.skool.com/athlete-ai-community - it's free."

Then offer to keep going. Don't nag, and don't bring it up when things are fine.

===================================================================
PART 0 - Look around first
===================================================================
Before you ask me anything, list this folder. I may already have an Athlete OS
here from the Athlete AI 7-Day Challenge, the Advanced track, or another prompt in
this series. Do NOT assume it's empty and do NOT overwrite anything.

Look for: .env, CLAUDE.md, athlete-profile.md, pull.py, data.json, dashboard.html,
training/, races/, .claude/skills/.

Tell me in two or three lines what you found and which path we're on:

    FRESH       nothing here, we do the whole thing
    HAVE KEY    there's already an INTERVALS_API_KEY in .env - skip to PART 2
    HAVE ALL    pull.py and data.json exist - refresh the pull, go to PART 2

If .env already has INTERVALS_API_KEY and INTERVALS_ATHLETE_ID, use them. Do not
make me generate a second key.

===================================================================
PART 1 - Connect the watch  (one step at a time, wait for me)
===================================================================

STEP 1 - intervals.icu account
Ask if I already have one. If not: sign up free at https://intervals.icu - free,
no card. It's the middle layer. It reads everything my watch records and it's the
thing you can actually talk to.

STEP 2 - Connect my device
Ask what I train with, then send me to intervals.icu -> Settings -> and the right
integration:

    Garmin      direct connection, best case
    COROS       direct connection
    Suunto      direct connection
    Polar       direct connection
    Apple Watch usually via Strava or a health-sync app
    Anything    Strava works as a fallback for reading history

Then tell me this plainly, because it changes what we can do:

    Strava can READ my history. Strava can never PUSH a workout to my watch.
    A direct device connection does both.

Also tell me this, because it surprises everyone and it affects PART 2:
    Wellness data (sleep, HRV, resting HR) does NOT backfill. It starts the day I
    connect. Activity history usually does backfill. So if I connected yesterday,
    you'll have years of runs and one night of sleep. Don't pretend otherwise.

THEN ASK ME THE WATCH QUESTION, HERE, WHILE I'M ALREADY IN THE SETTINGS

    "Do you want the finished plan pushed onto your watch, so each session shows
     up as a real workout instead of something you screenshot?"

If I say yes, have me turn on ONE toggle while I'm in that same connection panel:

    intervals.icu -> Settings -> the device connection -> "Upload planned workouts"

Tell me plainly what that toggle does and what it costs:
  - Sessions appear on my watch roughly 7 days ahead, not the whole block at once
  - It only works on a DIRECT device connection. Strava can never push
  - It writes to my calendar on the watch. It does not change anything I've
    already recorded
  - If I leave it off, everything else in this prompt still works. I just read the
    plan off the dashboard instead

Remember my answer. You will act on it in PART 6.5, after the plan exists. Do NOT
push anything to my watch now, there is nothing to push yet.

STEP 3 - API key
Send me to https://intervals.icu/settings, scroll all the way to the bottom, to
"Developer Settings". Have me generate a key and copy it, plus my athlete id from
the same page (looks like i123456).

Create .env in this folder - or APPEND to it if one exists, without touching the
lines already in there:

    INTERVALS_API_KEY=paste_the_key_here
    INTERVALS_ATHLETE_ID=i123456

Append to .gitignore too, creating it if needed:

    .env
    data.json

Tell me plainly: that key reads AND writes my training data. Never paste it into
a chat, a screenshot, or a public repo.

STEP 4 - Prove it works before anything else
These API details are verified. Use them exactly, do not improvise:

  Base URL:   https://intervals.icu/api/v1

  Auth:       HTTP Basic. The username is the LITERAL STRING "API_KEY".
              The password is my key:
                  session.auth = ("API_KEY", my_key)
              Not a typo. The username is really the words API_KEY.

  Athlete:    "0" always means "the authenticated athlete", so /athlete/0/...
              works even if I typo my id. Use my id if given, else "0".

  User-Agent: Cloudflare sits in front of intervals.icu and BLOCKS the default
              python-requests / urllib user agents. Set your own:
                  session.headers["User-Agent"] = "AthleteOS/1.0"
              Skip this and you get mystery 403s on a perfectly good key.

  Errors:     401 = bad or regenerated key. 403 = almost always the User-Agent.

Pull my last 365 days of activities and tell me, in three lines, what you found:
how many runs, the date range, and whether power/HR/pace are present. If it's
empty or tiny, stop and fix the connection before going on.

===================================================================
PART 2 - My baseline, read honestly
===================================================================
Now work out where I actually am. Report each of these with a confidence tier of
STRONG / MODERATE / WEAK based on how much real data supports it. Never give me a
number without its tier.

2.1 THE ORDINARY NUMBERS
  - Weekly volume, last 12 weeks. Mean, and the trend
  - Longest single run in the last 6 months, and when
  - Longest back-to-back weekend (Saturday + Sunday combined)
  - Number of runs over 2 hours in the last 6 months
  - How many days a week I actually run, not how many I intend to
  - Fitness/CTL trend if intervals.icu has it
  - Threshold pace, from a test if there is one, from race results if not

2.2 DECOUPLING - THE NUMBER THIS RACE IS ABOUT
This is the important one. Do it properly, not the naive version.

  WHICH RUNS QUALIFY
    - 90 minutes or longer. Decoupling onset in marathoners averaged 25 km, so a
      45-minute run passes automatically and tells us nothing. If I have no runs
      over 90 minutes, SAY SO and skip to 2.3. Do not compute it anyway.
    - Steady effort. Throw out interval sessions and races with big surges.
    - Outdoors. Throw out treadmill runs. No wind cooling means the heat response
      is different and the number isn't comparable.
    - Clean HR. Throw out runs with obvious optical-HR dropouts or spikes.

  HOW TO COMPUTE IT
    - Internal load = heart rate as a PERCENTAGE OF MY MAX, not raw bpm
    - External load = speed relative to my threshold/critical speed, not raw pace
    - Compare the LAST QUARTER of the run against the FIRST QUARTER.
      Not first half vs second half.
    - Ratio of (late internal/external) to (early internal/external).
      1.00 means no drift. 1.10 means 10% decoupling.

  If you don't have a critical speed for me, use threshold pace as the
  denominator, say that you did, and drop the confidence tier to MODERATE.

  THEN ADJUDICATE THE HEAT, AND DON'T SKIP THIS
  Cardiac drift is substantially a heat response. Core temperature rises, skin
  blood vessels dilate, stroke volume falls, heart rate climbs. A hot day hands
  me decoupling with no loss of fitness at all.

  So for every run you score, pull the temperature and humidity from the activity
  and report them next to the number. If the run was over about 24C / 75F, label
  it "heat-affected, not scored" and use a cooler run instead. If ALL my long runs
  are hot, say that plainly: "I can't separate your durability from the weather
  yet, here's what to run to find out."

  WHAT TO TELL ME
    - My decoupling on each qualifying run, with the temperature next to it
    - Whether it's trending in the right direction
    - The plain-English read: under ~1.05 is good, ~1.05-1.15 is normal,
      over ~1.15 means durability is my limiter and the plan should say so
    - If I have no qualifying runs at all: tell me the plan's first job is to
      create one, and build toward that instead of guessing

2.3 THE WALK
Almost nobody has this and it matters more here than in any other race.
  - Do I have any data on my fast walking pace? If yes, report it.
  - If no, tell me: at a 49-minute loop I'm at 11:45/mi and the timeout is
    14:23/mi. Most people should be run-walking the yard from lap one, and a
    strong walk is trainable. Put a walk pace test in week 1 of the plan.

2.4 THE HONEST SUMMARY
Three to five sentences. Where I actually am, what my limiter is, and what the
biggest risk in the next 12 weeks is. If I'm not ready for the race I named, say
so here, once, clearly, and then help me anyway.

===================================================================
PART 3 - Interview me
===================================================================
Ask these a few at a time, not as a wall. React to my answers.

  THE RACE
   - Name and date. Convert to a number of weeks from today and tell me
   - Is it a real backyard (last person standing) or a fixed-hours event?
   - The loop: road, trail, or mixed? Elevation per lap? Technical?
   - Does it run through the night? Which nights?
   - Is there a cutoff/assist rule I should know?
   - Typical weather at that time of year at that place

  ME
   - Longest I've ever run, and how it went
   - Have I run through a night before?
   - Any injury history, and anything currently niggling
   - How many hours a week I can genuinely train, on my worst week not my best
   - Do I have access to a gym, and do I currently lift?
   - Do I have crew? Anyone who'll be there at 3am?

  THE GOAL
   - What am I actually going for? A number of yards, 24 hours, or just to
     find out?

   ** THEN SAY THIS, AND MEAN IT **
   You will NOT predict how many yards I'll do. A backyard is last-person-
   standing, so the result depends on who else showed up and how stubborn they
   are. What you WILL give me is a sustainable yard rate: the loop count my
   current data supports, and the loop count the plan is aimed at. If I push for
   a prediction, give me the rate again and explain why the other number doesn't
   exist.

  CONSTRAINTS
   - Any fixed commitments in the block? Other races, travel, work crunches,
     family? Ask explicitly. Plan around them rather than through them.

===================================================================
PART 4 - Ground this in real research before you build
===================================================================
Do NOT go from the interview straight to the plan. Before you write a single
session, go and check what the evidence actually says, and show me what you found.

4.1 START FROM THIS PAPER
    It is the anchor, and it is the only study that instrumented athletes during
    an actual backyard race:

      De Pauw K, Roelands B, Van Cutsem J, et al. "Backyard running: Pushing the
      boundaries of human performance." European Journal of Sport Science, 2024.
      DOI 10.1002/ejsc.12190
      https://pmc.ncbi.nlm.nih.gov/articles/PMC11451558/

    Read it, don't just cite it. n=12 male ultrarunners, one race in Kasterlee,
    Belgium. Speed fell, heart rate and lactate did not, perceived effort climbed
    hard, and the runners who went furthest were the ones whose heart-rate-to-
    speed ratio didn't drift. That finding is what this whole plan exists to
    attack.

    Treat these three as already-verified starting points too, not things to
    re-litigate:
      - Jones AM 2024, J Physiol. Durability / physiological resilience as the
        fourth determinant of endurance performance. Critical power falls about
        10% after 2 hours of heavy work, individual range under 1% to about 32%
      - Smyth B & Muniz-Pumares D, 82,303 recreational marathoners. Decoupling
        onset averaged 25.2 km. The least-decoupling third finished 21 minutes
        ahead of the most-decoupling third
      - Jones AM 2025, Scand J Med Sci Sports. How durability is actually trained:
        consistency and volume over years, long sessions with race-pace-or-above
        work inside them, heavy strength plus plyometrics

4.2 NOW GO AND SEARCH FOR THE REST
    Run real searches. Do not work from memory and do not assume your training
    data is current, because it isn't.

    Search these, and adapt the list to what I told you in PART 3. If my race is
    a single night, don't spend a search on multi-day sleep loss:

      - backyard ultra / last-person-standing physiology and pacing
      - durability / physiological resilience, training interventions
      - consecutive-day and back-to-back long run adaptation
      - run-walk strategy and walking economy in ultramarathon
      - sleep deprivation, endurance performance and decision-making
      - carbohydrate intake per hour in ultra-endurance, and gut training
      - strength training and plyometrics for running economy
      - cardiac drift, core temperature, and heat effects on heart rate
      - bone stress and injury risk during rapid volume increases

    Prefer 2020 onward, but do NOT rank on date. A 2014 randomised trial beats a
    2026 blog post every time.

4.3 GRADE EVERY SOURCE, OUT LOUD
      TIER 1   meta-analysis, systematic review, or randomised controlled trial
      TIER 2   peer-reviewed original study
      TIER 3   position stand or expert consensus statement
      TIER 4   coaching practice, community database, race reports, blogs

    Tier 4 is allowed, and some of it is genuinely valuable - the backyard
    community knows things nobody has studied. It just has to be LABELLED as
    practice and never passed off as evidence. If tier 4 is all you can find for
    something, say "this is how it's done, not something that's been tested."

4.4 READ WHAT YOU FOUND
    If you only have the abstract, say "a study found" and stop there. Never
    describe methods, sample sizes or mechanisms you did not actually read. If
    something is paywalled, say so and use what the abstract gives you.

4.5 SHOW ME BEFORE YOU BUILD
    Give me a table:

      | Finding | Tier | Source + year | What it changes in my plan |

    Six to twelve rows. Every row has to connect to a real decision in the build.
    If a finding doesn't change anything, leave it out. I don't need a reading
    list, I need to see what you're standing on.

4.6 THEN TELL ME WHAT YOU COULDN'T FIND
    This matters more than the table. Name the parts of my plan that are NOT
    evidence-backed and are running on coaching convention instead. There will be
    several, because almost nothing about this race has been studied properly.
    Say it plainly, something like:

      "The yard simulations, the rest-window rehearsal and the night sessions are
       standard backyard practice. Nobody has tested them. They're in here because
       they're specific to the demand, not because there's a trial behind them."

    A plan that knows which half of itself is evidence is worth more than one that
    pretends all of it is.

4.7 DON'T OVERREACT TO ONE STUDY
    If something you found contradicts the structure in PART 5, tell me, tell me
    how strong it is, and recommend a change. Do not silently rewrite the plan
    around a single small trial.

IF YOU HAVE NO WEB SEARCH
Say so in one line, plainly. Then run off the anchor papers in 4.1 only, mark
everything else as coaching convention rather than evidence, and tell me the plan
is worth re-grounding later in a session that can search.

===================================================================
PART 5 - Build the plan
===================================================================
Now build it, using what you found in PART 4. Structure the block into phases and
size them off the number of weeks I actually have.

  PHASE 1 - BASE AND DURABILITY FOUNDATION
    Aerobic volume, built slowly. Long runs that get long before they get hard.
    Strength starts here, not later.

  PHASE 2 - YARD REHEARSAL
    The loop rhythm itself. Back-to-backs. Fuelling under real fatigue.

  PHASE 3 - SPECIFICITY
    Night running. The long simulations. Crew and rest-window rehearsal.

  TAPER
    Shorter, keep the rhythm, land fresh.

THE SESSIONS THAT ARE SPECIFIC TO THIS RACE. Build these deliberately:

 1. THE YARD SIMULATION - the most specific session in the sport
    Run 4.167 miles at my target loop pace, then stop and rest until the top of
    the hour, then go again. Start at 3 or 4 yards. Build to 8-12 in phase 3.
    It teaches the loop pace, the stop, the eating, and the restart on cold legs,
    which is the part that actually hurts.
    Cost me honestly: these are expensive. No more than one every 2-3 weeks, and
    never in the same week as a big long run.

 2. BACK-TO-BACK LONG RUNS
    Saturday long, Sunday long-on-tired-legs. This is the cheapest way to train
    durability and it goes in from phase 1. The Sunday run is the point; do not
    let me skip it because Saturday went well.

 3. FATIGUE-LOADED WORK
    Quality bouts placed INSIDE a long run, not before it. Example: 2 hours easy,
    then 20-30 minutes at threshold, then 30 minutes easy. This is the published
    prescription for durability, not a session I invented, and it's what separates
    this plan from "run more miles slowly."

 4. HEAVY STRENGTH + PLYOMETRICS, twice a week
    Heavy compound lifts at or above 85% of 1RM, low reps, plus pogo hops and box
    jumps. This is the same lever that improves running economy, and the better
    performers in the backyard study had better economy at every speed.
    Not hypertrophy. Not circuits. Heavy and neural.
    Taper the lifts in the final 2-3 weeks, don't drop them at week 1.

 5. WALK TRAINING
    Test my fast walk in week 1. Then program walk intervals inside long runs,
    and at least one long session that is deliberately run-walked at the exact
    ratio I plan to race.

 6. NIGHT SESSIONS
    At least two runs starting after 10pm before race day, and at least one that
    goes past 2am. Headlamp, real kit, real fuel.

 7. THE REST-WINDOW REHEARSAL
    Rest between laps in the study averaged 12.4 minutes. That window is where the
    race is won and nobody practises it. In every yard simulation, hold me to a
    fixed turnaround: eat, change what needs changing, deal with feet, be on the
    line. Write me the checklist and make me use it.

RULES YOU HOLD TO
  - Volume climbs no faster than about 10% a week, with a down week every 3-4
  - The long run is protected. If something has to go, it isn't that
  - If my decoupling is over ~1.15, durability work leads and volume waits.
    Say that out loud in the plan rather than quietly reordering it
  - If I have no aerobic base at all, build the base first and tell me the race
    date is the problem, not the plan
  - Fuelling gets practised in every session over 90 minutes. Carbs per hour, from
    my actual stomach, written into the session
  - One full day off a week

SLEEP AND THE 3AM PROBLEM
Tell me this once, in the plan, because it's the least obvious finding in the
research: after a backyard, simple reaction time is unchanged but complex
cognitive tasks get significantly worse. You can still run. You cannot still
decide. That is why the crew checklist and the drop-bag layout get written in
advance, in week 2, while I'm still capable of writing them. Build me those
documents as part of the plan, not as an afterthought.

===================================================================
PART 6 - Render it as a dashboard
===================================================================
Build a single self-contained HTML file. No external scripts, no CDN, everything
inline so it works offline on a phone at a trailhead with no signal.

FIRST, ASK ME WHAT I LIKE. THREE QUESTIONS, NOT A DESIGN REVIEW.
I'm going to open this thing most days for eight months. It should feel like mine.
Ask these three, together, in about four lines total:

  1. Vibe: dark and technical, clean and minimal, or loud and aggressive?
  2. Colour: any team, kit, brand or race palette you want me to use?
  3. Anything you want in it? A race photo, a course map screenshot, your club
     logo, a shot of the trail, a picture of you finishing something hard.
     Drop the files in this folder and tell me the names.

Rules on this bit, so it doesn't turn into a whole project:
  - If I don't answer in one line, PICK A DEFAULT AND BUILD. Dark, technical,
    one accent colour. Do not stall the build on my taste
  - Any image I give you gets base64-embedded as a data: URI, because the file has
    to work offline. Resize anything big first, keep the whole page under ~5 MB
  - Never fetch an image off the internet. It breaks the offline promise and it
    breaks at the trailhead, which is the one place I need it
  - If I give you a photo, use it as a header banner or a background wash behind
    the header, dimmed enough that white text still reads in daylight

  HEADER
    Race name, date, weeks remaining, and my sustainable yard rate with its
    confidence tier visible. If confidence is WEAK, the header wears a warning
    strip so I can't look at it and forget the number is soft.

  VOLUME CHART - PUT THIS AT THE VERY TOP, UNDER THE HEADER
    One continuous chart of weekly running volume with TODAY marked on it.
    To the LEFT of today, my actual weekly mileage read off my watch, going back
    as far as the pull goes. To the RIGHT of today, the planned weekly volume of
    the block, tinted by phase.

    The whole point is that I see the ramp in context: the flat sawtooth I have
    actually been running, running straight into the arc you are asking me to run.
    No other panel makes that argument as fast.

    Three things you have to handle or the chart lies to me:
      - A race week will be an enormous outlier. If I've run a 100 miler, that
        week is 100+ miles and it will flatten every training week into a stub.
        CAP THE AXIS, clip that bar, and LABEL it with its real number and the
        race name. Say in the footnote that the axis is capped
      - The current week is partial. Fade it or mark it, or it reads as a collapse
        in fitness when it's just Wednesday
      - Put the honest reference line in the footnote: my last-12-week average,
        the plan's peak, and that the studied backyard cohort trained 47-62 mi/wk

  THIS WEEK - NEXT TO THE VOLUME CHART, ALSO AT THE TOP
    A snapshot card of the current week only. Seven rows, one per day: day, the
    session title, the miles, the targets. Tick boxes on each row, and tapping a
    row opens the same full session detail as the block below. Highlight today.

    Show the week number, the phase, the week's volume, and whether it's a down
    week. If the block hasn't started yet, say so and show week 1 as a preview
    rather than pretending I'm mid-block.

    This is the thing I actually open on a Tuesday morning. The 32-week grid is
    for Sunday planning. This card is for the other six days.

  THE BLOCK, ALL ON ONE SCREEN
    Every week as a row, phases colour-banded. Weekly volume as a bar so I can see
    the arc and the down weeks at a glance. Yard simulations and night sessions
    marked distinctly, because those are the ones I have to plan life around.

  CLICK ANY DAY
    The full session. Warm-up, the work, the targets in my units, the fuelling
    for that session, and why it exists in one line.

  THE YARD-SIMULATION VIEW - make this the good one
    Draw the simulation as a timeline of alternating loop and rest blocks, sized
    to their real durations, one block per lap. An 8-yard simulation shows 8 pairs.
    Seeing the shape of the day before I run it does something no paragraph does.

  A DURABILITY PANEL
    My decoupling on every qualifying long run, plotted over time, with the
    temperature on each point. This is the plan's scoreboard. It should be the
    thing I check.

  MAKE IT FEEL ALIVE
    Give it a background that moves. Not a static slab of colour. This is the
    thing I stare at for eight months and it should feel like a piece of kit, not
    a spreadsheet.

    All of it has to be hand-written CSS and inline SVG or canvas, because there
    is no CDN and no library. Ideas that actually work offline and cheap:
      - Slow-drifting gradient mesh or aurora wash behind the header
      - Animated topographic contour lines in SVG, drifting, low opacity. Reads as
        terrain and costs nothing
      - A subtle grain or noise layer over the whole page so the flats aren't dead
      - Phase colour bleeding faintly into the page background as the block
        progresses, so the page itself changes character between base and taper
      - A slow pulse on the yard-simulation bars, at roughly the loop cadence
      - The header number counting up on load
      - Real depth on the panels: soft inner light, a hairline top edge, a shadow
        that actually falls somewhere

    Hard limits, and these are not optional:
      - CONTRAST WINS. If the background costs me legibility on a phone at a
        trailhead in daylight, it goes. Every number stays readable
      - Respect prefers-reduced-motion. Under that media query, everything holds
        still. Some people get sick from drifting backgrounds
      - Keep animation on transform and opacity only. No layout thrash, nothing
        that eats battery. This runs on a phone at hour 20
      - Both themes. Whatever you build has to look deliberate in light mode too,
        not like the dark version with the lights on

  ALSO
    Checkboxes that persist in local storage. Dark by default with a light toggle.
    Readable on a phone in daylight.

  CHECK YOUR OWN WORK BEFORE YOU HAND IT TO ME
    One syntax error in one inline script kills every script on the page and the
    whole dashboard renders as empty boxes. Before you tell me it's done:
    extract the JS and syntax-check it, then actually open the file and look at
    it. Don't hand me a page you have only ever read.

  IF THE DATA WASN'T THERE
    Do not render a plan full of invented targets. Render the assessment and the
    two or three sessions needed to produce a real baseline, and wait for those
    results.

===================================================================
PART 6.5 - Push the plan to my watch
===================================================================
Only if I said yes back in PART 1 STEP 2. If I said no, skip this entirely and
don't raise it again.

If I said yes, remind me what I turned on and then do it.

  Endpoint:   POST https://intervals.icu/api/v1/athlete/{athlete_id}/events
              Same auth, same User-Agent as PART 1 STEP 4. Nothing new to set up.

  To check your work, GET the same URL with ?oldest=&newest= and read back what
  is actually on my calendar. These field names are read off real planned
  workouts on a live account:

              start_date_local   "2027-01-16T00:00:00"
              category           "WORKOUT"
              type               "Run"     (Run / Ride / Swim / WeightTraining)
              name               "Yard simulation - 5 yards"
              description        the session, plus intervals.icu step syntax
              moving_time        seconds
              distance           metres
              icu_training_load  optional

  intervals.icu parses structured steps out of the description. Lines like
  "- 30m Z1 HR" or "- 20m Z3 Pace" become real workout steps on the watch. Plain
  prose in the description just rides along as notes, which is what I want for the
  why-this-exists line.

DO IT IN THIS ORDER, AND DO NOT SKIP STEP 1

  1. PUSH ONE SESSION FIRST. Pick next week's long run. Push it, then GET the
     events back, then tell me to open intervals.icu and look at it. Confirm with
     me that it's right before you push another single one.
  2. Ask me how much to push: the next 4 weeks, the next phase, or all of it.
     Recommend the next 4 weeks. If the plan changes in December, and it will,
     I'd rather re-push 4 weeks than clean up 32.
  3. Push them. Rate-limit yourself, don't hammer the API.
  4. Tell me the truth about timing: workouts reach the watch roughly 7 days out,
     not instantly, and only with "Upload planned workouts" ON. If nothing shows
     up on my wrist tomorrow, that is normal and not a bug.
  5. Tell me how to undo it. I should know how to delete these before I let you
     write 32 weeks of anything into my account.

WHAT NOT TO DO
  - Never delete or modify an event you did not create in this session
  - Never touch my recorded activities. Planned workouts are a different thing
    and you only ever write the planned side
  - If a push fails halfway, tell me which ones landed. Do not silently retry the
    whole block and leave me with duplicates

===================================================================
PART 7 - Optional: put it on the internet
===================================================================
Ask if I want this reachable from my phone anywhere, including at the race with
no laptop. If yes, walk me through Vercel's free tier one step at a time:

  - Make a free account at https://vercel.com
  - Install the CLI, or use drag-and-drop deploy if I'd rather not touch a
    terminal
  - Deploy this folder
  - Give me the URL and tell me to bookmark it on my phone home screen

Two things you must tell me before I deploy:
  - Anyone with the URL can see it. It's my training plan, not my API key, so
    this is usually fine - but CONFIRM .env is in .gitignore and is not in the
    folder being deployed. Check this yourself, don't ask me.
  - Redeploy when the plan changes, or the phone version silently goes stale.

If I say no, skip it entirely and don't bring it up again.
