(function () {
  "use strict"

  var storageKey = "perception-distance-experiment:state:v1"
  var alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"

  function participantId() {
    var values = new Uint32Array(6)
    if (window.crypto && window.crypto.getRandomValues) {
      window.crypto.getRandomValues(values)
    } else {
      for (var index = 0; index < values.length; index += 1) values[index] = Math.floor(Math.random() * 100000)
    }
    return "P-" + Array.from(values).map(function (value) {
      return alphabet[value % alphabet.length]
    }).join("")
  }

  function fresh(fingerprint) {
    return {
      version: 1,
      fingerprint: fingerprint || "",
      participantId: participantId(),
      screen: "intro",
      groupIndex: 0,
      questionIndex: 0,
      presentation: null,
      answers: [],
      playbackRate: 2,
      playbackRateCustomized: false,
      questionStartedAt: null,
      startedAt: null,
      completedAt: null
    }
  }

  function read(fingerprint) {
    try {
      var parsed = JSON.parse(localStorage.getItem(storageKey) || "null")
      if (!parsed || parsed.version !== 1 || parsed.fingerprint !== fingerprint) return fresh(fingerprint)
      if (!Array.isArray(parsed.answers)) parsed.answers = []
      if ([0.75, 1, 1.5, 2].indexOf(Number(parsed.playbackRate)) === -1) parsed.playbackRate = 2
      if (parsed.playbackRateCustomized !== true) {
        parsed.playbackRate = 2
        parsed.playbackRateCustomized = false
      }
      return parsed
    } catch (error) {
      return fresh(fingerprint)
    }
  }

  function write(state) {
    try {
      localStorage.setItem(storageKey, JSON.stringify(state))
      return true
    } catch (error) {
      return false
    }
  }

  function reset(fingerprint) {
    var state = fresh(fingerprint)
    write(state)
    return state
  }

  window.PerceptionStore = {
    read: read,
    write: write,
    reset: reset
  }
}())
