(function () {
  "use strict"

  var storageKey = "perception-distance-experiment:state:v2"
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

  function attemptId(attemptNumber) {
    var values = new Uint32Array(3)
    if (window.crypto && window.crypto.getRandomValues) {
      window.crypto.getRandomValues(values)
    } else {
      for (var index = 0; index < values.length; index += 1) values[index] = Math.floor(Math.random() * 100000)
    }
    var token = Array.from(values).map(function (value) {
      return alphabet[value % alphabet.length]
    }).join("")
    return "A" + attemptNumber + "-" + Date.now().toString(36).toUpperCase() + "-" + token
  }

  function fresh(fingerprint, existingParticipantId, nextAttemptNumber) {
    var number = Math.max(1, Number(nextAttemptNumber) || 1)
    return {
      version: 1,
      fingerprint: fingerprint || "",
      participantId: existingParticipantId || participantId(),
      attemptNumber: number,
      attemptId: attemptId(number),
      screen: "intro",
      groupIndex: 0,
      questionIndex: 0,
      presentation: null,
      answers: [],
      playbackRate: 2,
      playbackRateCustomized: false,
      questionStartedAt: null,
      startedAt: null,
      completedAt: null,
      cloudSubmission: {
        status: "idle",
        attemptCount: 0,
        receiptId: null,
        submittedAt: null,
        lastError: null
      }
    }
  }

  function read(fingerprint) {
    try {
      var parsed = JSON.parse(localStorage.getItem(storageKey) || "null")
      if (!parsed || parsed.version !== 1 || parsed.fingerprint !== fingerprint) return fresh(fingerprint)
      var migrated = false
      if (!Array.isArray(parsed.answers)) parsed.answers = []
      if (!Number.isInteger(parsed.attemptNumber) || parsed.attemptNumber < 1) {
        parsed.attemptNumber = 1
        migrated = true
      }
      if (!parsed.attemptId) {
        parsed.attemptId = attemptId(parsed.attemptNumber)
        migrated = true
      }
      if (!parsed.cloudSubmission || typeof parsed.cloudSubmission !== "object") {
        parsed.cloudSubmission = fresh(fingerprint).cloudSubmission
        migrated = true
      }
      if ([0.75, 1, 1.5, 2].indexOf(Number(parsed.playbackRate)) === -1) parsed.playbackRate = 2
      if (parsed.playbackRateCustomized !== true) {
        parsed.playbackRate = 2
        parsed.playbackRateCustomized = false
      }
      if (migrated) write(parsed)
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

  function repeat(fingerprint, currentState) {
    var state = fresh(
      fingerprint,
      currentState && currentState.participantId,
      Number(currentState && currentState.attemptNumber || 1) + 1
    )
    write(state)
    return state
  }

  window.PerceptionStore = {
    read: read,
    write: write,
    reset: reset,
    repeat: repeat
  }
}())
