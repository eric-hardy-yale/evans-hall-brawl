// Brawl mode: everyone pulls a knife and goes at the nearest Labubu. Off at load; toggle with B.
// Components read BRAWL.on inside useFrame, so flipping it never re-renders the scene.
export const BRAWL = { on: false }

export const toggleBrawl = () => (BRAWL.on = !BRAWL.on)

