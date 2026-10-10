// Who you can walk up to and chat with (the AI avatars served by backend/).
// Professor.jsx adds a root to TALKABLES when it has a talkId; Player.jsx raycasts against them.
export const TALKABLES = new Set()

export const PEOPLE_INFO = {
  zaman: { name: 'Prof. Tauhid Zaman', course: 'MGT 409 · AI Foundations for Managers', room: 'Classroom 2200' },
}

// who you are chatting with right now (the professor turns to face you)
export const TALKING = { id: null }
