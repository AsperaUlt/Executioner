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
      message: "Create a task to update the execution queue.",
      error: "",
    },
    quickAccess: {
      items: [],
    },
    music: {
      current: null,
      queue: [],
    },
    audio: {
      status: "idle",
      query: "",
      submittedQuery: "",
      suggestions: [],
      results: [],
      currentTrack: null,
      playbackUrl: "",
      lyricText: "",
      error: "",
      message: "Search for a track to start the Audio MVP.",
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
