(function () {
  "use strict"

  var people = [
    { id: "sheldon", label: "Sheldon", prefix: "G1-SHELDON" },
    { id: "leonard", label: "Leonard", prefix: "G1-LEONARD" },
    { id: "howard", label: "Howard", prefix: "G2-HOWARD" },
    { id: "ai-1", label: "AI-1", prefix: "G4-AI1" },
    { id: "ai-3", label: "AI-3", prefix: "G4-AI3" },
    { id: "ai-4", label: "AI-4", prefix: "G5-AI4" },
    { id: "ai-7", label: "AI-7", prefix: "G5-AI7" }
  ]
  var paths = window.PERCEPTION_SOURCE_VIDEO_PATHS || {}
  var main = document.getElementById("review-main")
  var nav = document.getElementById("review-nav")
  var rateControl = document.getElementById("playback-rate")

  function escapeHtml(value) {
    return String(value === undefined || value === null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;")
  }

  function slotId(prefix, role, number) {
    return prefix + "-" + role + "-" + String(number).padStart(2, "0")
  }

  function originalName(path) {
    return decodeURIComponent(String(path).split("/").pop() || path)
  }

  function personSlots(person) {
    var result = []
    for (var reference = 1; reference <= 3; reference += 1) {
      var referenceId = slotId(person.prefix, "REF", reference)
      result.push({ id: referenceId, label: "参考 " + reference, role: "reference", path: paths[referenceId] || "" })
    }
    for (var candidate = 1; candidate <= 10; candidate += 1) {
      var candidateId = slotId(person.prefix, "CAND", candidate)
      result.push({ id: candidateId, label: "候选 " + candidate, role: "candidate", path: paths[candidateId] || "" })
    }
    return result
  }

  function videoCard(slot) {
    if (!slot.path) {
      return "<article class=\"video-card\"><header><strong>" + escapeHtml(slot.label) + "</strong><small>路径缺失</small></header></article>"
    }
    return "<article class=\"video-card" + (slot.role === "reference" ? " is-reference" : "") + "\">" +
      "<header><strong>" + escapeHtml(slot.label) + "</strong><small title=\"" + escapeHtml(originalName(slot.path)) + "\">" + escapeHtml(originalName(slot.path)) + "</small></header>" +
      "<video controls muted playsinline preload=\"metadata\" src=\"" + escapeHtml(slot.path) + "\" data-original-video=\"" + escapeHtml(slot.id) + "\"></video>" +
    "</article>"
  }

  function render() {
    nav.innerHTML = people.map(function (person) {
      return "<a href=\"#" + person.id + "\">" + escapeHtml(person.label) + "</a>"
    }).join("")

    main.innerHTML = people.map(function (person) {
      var slots = personSlots(person)
      return "<section class=\"person-section\" id=\"" + person.id + "\">" +
        "<header class=\"person-head\"><div><h2>" + escapeHtml(person.label) + "</h2><p>3 个参考视频 · 10 个候选视频</p></div>" +
        "<div class=\"person-actions\"><button type=\"button\" data-play-person=\"" + person.id + "\">同时播放</button>" +
        "<button type=\"button\" data-pause-person=\"" + person.id + "\">全部暂停</button>" +
        "<button type=\"button\" data-reset-person=\"" + person.id + "\">全部归零</button></div></header>" +
        "<div class=\"video-grid\">" + slots.map(videoCard).join("") + "</div>" +
      "</section>"
    }).join("")
    applyRate()
  }

  function videosFor(personId) {
    return Array.from(document.querySelectorAll("#" + personId + " video"))
  }

  function applyRate() {
    var rate = Number(rateControl.value) || 1
    Array.from(document.querySelectorAll("video")).forEach(function (video) {
      video.defaultPlaybackRate = rate
      video.playbackRate = rate
    })
  }

  rateControl.addEventListener("change", applyRate)
  document.addEventListener("click", function (event) {
    var play = event.target.closest("[data-play-person]")
    var pause = event.target.closest("[data-pause-person]")
    var reset = event.target.closest("[data-reset-person]")
    if (play) videosFor(play.dataset.playPerson).forEach(function (video) { video.play().catch(function () {}) })
    if (pause) videosFor(pause.dataset.pausePerson).forEach(function (video) { video.pause() })
    if (reset) videosFor(reset.dataset.resetPerson).forEach(function (video) { video.pause(); video.currentTime = 0 })
  })

  render()
}())
