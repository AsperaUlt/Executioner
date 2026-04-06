(function attachState(global) {
  const defaultState = {
    summary: {
      greeting: null,
      focusScore: null,
      songsPlayed: null,
      focusMinutes: null,
      tasksCompleted: null,
      tasksClosed: null,
    },
    stats: {
      taskEfficiency: null,
      deepWorkHours: [],
      insights: [],
    },
    accessDeck: {
      items: [],
    },
    tasks: [],
    taskCurrent: null,
    taskNext: null,
    taskCompleted: {
      items: [],
    },
    taskStream: {
      items: [],
    },
    taskUi: {
      status: "idle",
      message: "Add a task to update the queue.",
      error: "",
    },
    quickAccess: {
      items: [],
    },
    music: {
      current: null,
      queue: [],
    },
    musicBrowser: {
      status: "idle",
      query: "",
      submittedQuery: "",
      showSuggestions: false,
      activeSuggestionIndex: -1,
      suggestions: [],
      results: [],
      currentTrack: null,
      playbackUrl: "",
      lyricText: "",
      error: "",
      message: "Type a track, artist, or album to load results.",
      isSearching: false,
      isSuggesting: false,
      isResolving: false,
    },
  };

  function createState() {
    return structuredClone(defaultState);
  }

  function mergeData(state, payload) {
    if (!payload || typeof payload !== "object") {
      return state;
    }

    return {
      ...state,
      ...payload,
      summary: { ...state.summary, ...payload.summary },
      stats: { ...state.stats, ...payload.stats },
      accessDeck: { ...state.accessDeck, ...payload.accessDeck },
      taskCompleted: { ...state.taskCompleted, ...payload.taskCompleted },
      taskStream: { ...state.taskStream, ...payload.taskStream },
      quickAccess: { ...state.quickAccess, ...payload.quickAccess },
      music: { ...state.music, ...payload.music },
    };
  }

  global.VibeState = {
    createState,
    mergeData,
  };
})(window);
