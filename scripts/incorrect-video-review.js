(function () {
  "use strict"

  var stats = window.PERCEPTION_INCORRECT_STATS
  var experiment = window.PERCEPTION_EXPERIMENT
  var sourcePaths = window.PERCEPTION_SOURCE_VIDEO_PATHS || {}
  var summaryGrid = document.getElementById("summary-grid")
  var groupSummary = document.getElementById("group-summary")
  var reviewMode = document.getElementById("review-mode")
  var groupFilter = document.getElementById("group-filter")
  var minimumFilter = document.getElementById("minimum-filter")
  var playbackRate = document.getElementById("playback-rate")
  var visibleCount = document.getElementById("visible-count")
  var issueList = document.getElementById("issue-list")

  function escapeHtml(value) {
    return String(value === undefined || value === null ? "" : value)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#039;")
  }

  function groupById(id) {
    return experiment.groups.find(function (group) { return group.id === id })
  }

  function questionById(id) {
    var group = groupById(id.split("-")[0])
    return group && group.questions.find(function (question) { return question.id === id })
  }

  function sourcePath(slot) {
    return sourcePaths[slot.slot_id] || ""
  }

  function lazyVideo(slot, label, cardClass) {
    return "<article class=\"video-card " + cardClass + "\"><header><strong>" + escapeHtml(label) + "</strong><span>" + escapeHtml(slot.member_admin_label) + "</span></header>" +
      "<video controls muted playsinline preload=\"none\" data-src=\"" + escapeHtml(sourcePath(slot)) + "\"></video></article>"
  }

  function renderSummary() {
    var cards = [
      ["参与者", stats.participant_count],
      ["总判断", stats.response_count],
      ["错误记录", stats.total_incorrect],
      ["有错题目", stats.incorrect_question_count + " / " + stats.question_count]
    ]
    summaryGrid.innerHTML = cards.map(function (card) {
      return "<article class=\"summary-card\"><span>" + card[0] + "</span><strong>" + card[1] + "</strong></article>"
    }).join("")

    renderGroupSummary()
    updateGroupOptions()
  }

  function relevantGroups() {
    var mode = reviewMode.value
    return stats.groups.filter(function (group) {
      var definition = groupById(group.group_id)
      if (mode === "real-incorrect") return definition.condition === "real_far"
      if (mode === "ai-correct") return definition.condition !== "real_far"
      return true
    })
  }

  function renderGroupSummary() {
    var correctMode = reviewMode.value === "ai-correct"
    groupSummary.innerHTML = relevantGroups().map(function (group) {
      var count = correctMode ? group.correct : group.incorrect
      var rate = count / group.total * 100
      return "<article class=\"group-card" + (correctMode ? " is-correct-mode" : "") + "\"><span>" + escapeHtml(group.group_id + " · " + group.pair_member_1 + " vs " + group.pair_member_2) + "</span>" +
        "<strong>" + rate.toFixed(1) + "%</strong><small>" + count + " / " + group.total + (correctMode ? " 次答对" : " 次答错") + "</small></article>"
    }).join("")
  }

  function updateGroupOptions() {
    groupFilter.innerHTML = "<option value=\"all\">全部</option>" + relevantGroups().map(function (group) {
      return "<option value=\"" + escapeHtml(group.group_id) + "\">" + escapeHtml(group.group_id + " · " + group.pair_member_1 + " vs " + group.pair_member_2) + "</option>"
    }).join("")
  }

  function renderQuestion(item, correctMode) {
    var group = groupById(item.group_id)
    var question = questionById(item.question_id)
    var target = question.candidate_slots.find(function (slot) { return slot.member_id === question.target_member_id })
    var distractor = question.candidate_slots.find(function (slot) { return slot.member_id !== question.target_member_id })
    var count = correctMode ? item.correct : item.incorrect
    var rate = count / item.total * 100
    return "<article class=\"issue-card" + (correctMode ? " is-correct-mode" : "") + " data-group=\"" + escapeHtml(item.group_id) + "\">" +
      "<header class=\"issue-head\"><div class=\"issue-title\"><span>" + escapeHtml(item.question_id + " · " + item.pair_member_1 + " vs " + item.pair_member_2) + "</span>" +
      "<h2>目标人物：" + escapeHtml(item.target_member) + "</h2></div>" +
      "<div class=\"issue-rate\"><strong>" + count + " / " + item.total + "</strong><span>" + (correctMode ? "答对率 " : "答错率 ") + rate.toFixed(1) + "%</span></div></header>" +
      "<details><summary>查看 5 个未裁剪原始视频</summary><div class=\"issue-content\">" +
      "<div class=\"issue-actions\"><button type=\"button\" data-play>同时播放</button><button type=\"button\" data-pause>全部暂停</button><button type=\"button\" data-reset>全部归零</button></div>" +
      "<div class=\"reference-grid\">" + question.reference_slots.map(function (slot, index) { return lazyVideo(slot, "参考 " + (index + 1), "is-reference") }).join("") + "</div>" +
      "<div class=\"candidate-grid\">" + lazyVideo(target, "应选视频", "is-correct") + lazyVideo(distractor, "容易被错选", "is-distractor") + "</div>" +
      "</div></details></article>"
  }

  function applyFilters() {
    var mode = reviewMode.value
    var correctMode = mode === "ai-correct"
    var group = groupFilter.value
    var minimum = Number(minimumFilter.value)
    var questions = stats.questions.filter(function (item) {
      var definition = groupById(item.group_id)
      var conditionMatch = mode === "real-incorrect"
        ? definition.condition === "real_far"
        : mode === "ai-correct" ? definition.condition !== "real_far" : true
      var count = correctMode ? item.correct : item.incorrect
      return conditionMatch && count >= minimum && (group === "all" || item.group_id === group)
    })
    questions.sort(function (left, right) {
      var leftCount = correctMode ? left.correct : left.incorrect
      var rightCount = correctMode ? right.correct : right.incorrect
      if (rightCount !== leftCount) return rightCount - leftCount
      return left.question_id.localeCompare(right.question_id)
    })
    visibleCount.textContent = "当前 " + questions.length + " 道题"
    issueList.innerHTML = questions.length ? questions.map(function (item) { return renderQuestion(item, correctMode) }).join("") : "<div class=\"empty-state\">当前筛选条件下没有题目</div>"
  }

  function loadVideos(details) {
    Array.from(details.querySelectorAll("video[data-src]")).forEach(function (video) {
      if (!video.src) video.src = video.dataset.src
      video.defaultPlaybackRate = Number(playbackRate.value) || 1
      video.playbackRate = Number(playbackRate.value) || 1
    })
  }

  function cardVideos(target) {
    var card = target.closest(".issue-card")
    return card ? Array.from(card.querySelectorAll("video")) : []
  }

  document.addEventListener("toggle", function (event) {
    if (event.target.matches("details") && event.target.open) loadVideos(event.target)
  }, true)

  document.addEventListener("click", function (event) {
    if (event.target.matches("[data-play]")) cardVideos(event.target).forEach(function (video) { video.play().catch(function () {}) })
    if (event.target.matches("[data-pause]")) cardVideos(event.target).forEach(function (video) { video.pause() })
    if (event.target.matches("[data-reset]")) cardVideos(event.target).forEach(function (video) { video.pause(); video.currentTime = 0 })
  })

  playbackRate.addEventListener("change", function () {
    Array.from(document.querySelectorAll("video[src]")).forEach(function (video) {
      video.defaultPlaybackRate = Number(playbackRate.value) || 1
      video.playbackRate = Number(playbackRate.value) || 1
    })
  })
  groupFilter.addEventListener("change", applyFilters)
  minimumFilter.addEventListener("change", applyFilters)
  reviewMode.addEventListener("change", function () {
    updateGroupOptions()
    renderGroupSummary()
    applyFilters()
  })

  if (!stats || !experiment) {
    issueList.innerHTML = "<div class=\"incorrect-error\">数据加载失败</div>"
    return
  }
  renderSummary()
  applyFilters()
}())
