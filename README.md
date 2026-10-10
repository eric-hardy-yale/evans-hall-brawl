# Yale SOM Virtual: Evans Hall, Floors 1 and 2

A first-person walk-through of the 1st and 2nd floors of Edward P. Evans Hall (Yale School of Management), built with React, Vite, three.js, and @react-three/fiber.

Floor 1 (courtyard level) has the Bekenstein Atrium and main entrance, the 350-seat Zhang Auditorium, a Dining Commons, a café, a student commons, and the Shen Courtyard lawn you can walk out onto. Floor 2 has the blue classroom drums you can walk into, the curvy glass cloister around the courtyard, Ross Library on the west side, the Beinecke Terrace Room and its outdoor terrace on the east side, the small glass meeting rooms, and paintings above the stairwells.

**Walk it in your browser:** https://zlisto.github.io/yale_som_virtual/

## Run it locally

```bash
npm install
npm run dev
```

Open http://localhost:5173 and click **Click to walk in**.

**Keyboard + mouse** (works like a PC shooter):

| Key | Action |
| --- | --- |
| W A S D / arrows | walk |
| Mouse | look |
| Shift | sprint |
| Space | jump |
| C | crouch |
| M | toggle map |
| 1 / 2 | go to floor 1 / 2 (via the nearest stairwell) |
| B | brawl mode on/off (cartoon knife fight; off when the page loads) |
| Esc | pause |

**Changing floors:** walk into any stairwell door (the openings with paintings above them) to take the stairs to the other floor, or press **1** / **2**, or click the **Floor** button under the map toggle.

**Phone / tablet:** tap **Tap to walk in**. The left-thumb joystick walks (push it all the way to sprint), dragging anywhere else looks around, and there are on-screen jump and pause buttons. On a laptop, click **Use on-screen joystick** to try the phone controls. WASD still works in that mode.

## How it's built

- `src/layout.js`: the floor plan in meters (+x east, -z north). It holds the drums, library, Beinecke, stairs, meeting rooms, wall colliders, and room lookup. Each classroom faces the courtyard, with the whiteboard and podium on the inner side and stadium-seating rows (32 cm risers) stepping up toward the outer wall; its two doors are at the front corners. You climb the center-aisle steps one riser at a time.
- `src/ground.js`: the floor 1 plan (5 m below floor 2, level with the courtyard lawn): walls, the raked auditorium, dining, café, commons, and its own collision, floor height and room lookup.
- `src/GroundFloor.jsx`: the floor 1 meshes.
- `src/levels.js`: the two floors and the stairwell doors that connect them.
- `src/parts.jsx`: shared mesh helpers (instanced boxes, planes, wall strips).
- `src/World.jsx`: all the floor 2 meshes.
- `src/brawl.js`: brawl mode switch. `Labubu.jsx`, `LabubuCrowd.jsx` (four precomputed poses per seated student) and `Professor.jsx` read it every frame.
- `src/GroundDetails.jsx`: floor 1 people, fixtures and signage. Walls use instanced boxes and the drums use partial cylinders.
- `src/textures.js`: procedural canvas textures (carpet, navy drum glass, wood slats, mural, signs, stairwell paintings).
- `src/Player.jsx`: walking (pointer lock or touch), jump/crouch, circle-vs-wall collision.
- `src/TouchControls.jsx`: on-screen joystick, drag-to-look, jump and pause buttons.
- `src/Minimap.jsx`: the black-and-pink map in the corner.
- `src/Labubu.jsx`: a customizable Labubu built from primitives: `fur`, `expression` (grin / happy / surprised / sleepy / mischief), `shirt` ('yale', 'stripes', or any color), `pants`, `overalls`, `hat`, `sitting`, `anim`.
- `src/LabubuParty.jsx`: the crew playing in the courtyard plus Labubus in meetings in every glass room.
- `src/slides.js`: lecture slides for eight Fall 2026 MBA courses (MGT 409, 404, 403, 887, 402, 538, 800, 541) on the classroom screens and meeting-room monitors.
- `src/LabubuCrowd.jsx`: 30 seated Labubu students per classroom, drawn with shared instanced meshes.
- `src/Professor.jsx` + `src/Faculty.jsx`: cartoon Hogwarts professors teaching each class (Dumbledore, McGonagall, Trelawney, Slughorn, Snape, Lockhart, Moody, Flitwick), plus Hagrid in the courtyard.
- `src/HandsomeDan.jsx`: Handsome Dan touring a loop of 1000 randomly chosen classrooms (blue dot on the map).

The floor 2 layout is estimated from the wayfinding plan posted on the floor, so room sizes are approximate. Floor 1 is not based on a floor plan: the Zhang Auditorium, Bekenstein Atrium and Shen Courtyard are real Evans Hall spaces, but where they sit, and the dining commons, café, student commons and kitchen, are a plausible guess. The Stair G painting comes from a photo; the other stairwell paintings are made up.

Made for MGT 409: AI Foundations for Managers, Lecture 13.
