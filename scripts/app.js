(function () {
  "use strict"

  var data = window.PERCEPTION_EXPERIMENT || {
    preview_mode: true,
    ready: false,
    fingerprint: "missing-data",
    groups: [],
    totals: { groups: 0, questions: 0, slots: 0, missing_paths: 0 }
  }
  var app = document.getElementById("app")
  var sessionLabel = document.getElementById("session-label")
  var state = window.PerceptionStore.read(data.fingerprint || "")
  var advancing = false
  var videoPreloadCache = new Map()

  if (data.groups.length && !state.presentation) {
    state.presentation = makePresentation()
    window.PerceptionStore.write(state)
  }

  function escapeHtml(value) {
    return String(value === undefined || value === null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;")
  }

  function hashSeed(value) {
    var hash = 2166136261
    var text = String(value)
    for (var index = 0; index < text.length; index += 1) {
      hash ^= text.charCodeAt(index)
      hash = Math.imul(hash, 16777619)
    }
    return hash >>> 0
  }

  function randomGenerator(seed) {
    var value = seed >>> 0
    return function () {
      value += 0x6D2B79F5
      var output = value
      output = Math.imul(output ^ output >>> 15, output | 1)
      output ^= output + Math.imul(output ^ output >>> 7, output | 61)
      return ((output ^ output >>> 14) >>> 0) / 4294967296
    }
  }

  function shuffle(values, random) {
    var result = values.slice()
    for (var index = result.length - 1; index > 0; index -= 1) {
      var other = Math.floor(random() * (index + 1))
      var current = result[index]
      result[index] = result[other]
      result[other] = current
    }
    return result
  }

  function makePresentation() {
    var random = randomGenerator(hashSeed(String(data.seed) + ":" + state.participantId))
    var groupOrder = shuffle(data.groups.map(function (group) { return group.id }), random)
    var questionOrder = {}
    var positions = {}
    var allQuestions = []

    data.groups.forEach(function (group) {
      questionOrder[group.id] = shuffle(group.questions.map(function (question) { return question.id }), random)
      allQuestions = allQuestions.concat(group.questions)
    })

    var targetOnLeftPlan = shuffle(allQuestions.map(function (_, index) {
      return index < Math.floor(allQuestions.length / 2)
    }), random)

    allQuestions.forEach(function (question, index) {
      var target = question.candidate_slots.find(function (slot) {
        return slot.member_id === question.target_member_id
      })
      var distractor = question.candidate_slots.find(function (slot) {
        return slot.member_id !== question.target_member_id
      })
      positions[question.id] = targetOnLeftPlan[index]
        ? { A: target.slot_id, B: distractor.slot_id, correct: "A" }
        : { A: distractor.slot_id, B: target.slot_id, correct: "B" }
    })

    return {
      seed: data.seed,
      participant_seed: hashSeed(String(data.seed) + ":" + state.participantId),
      group_order: groupOrder,
      question_order: questionOrder,
      positions: positions
    }
  }

  function groupById(id) {
    return data.groups.find(function (group) { return group.id === id }) || null
  }

  function currentGroup() {
    if (!state.presentation) return data.groups[0] || null
    return groupById(state.presentation.group_order[state.groupIndex])
  }

  function currentQuestion() {
    var group = currentGroup()
    if (!group || !state.presentation) return null
    var order = state.presentation.question_order[group.id] || []
    var id = order[state.questionIndex]
    return group.questions.find(function (question) { return question.id === id }) || null
  }

  function slotById(group, id) {
    var result = null
    group.members.some(function (member) {
      var slots = group.references[member.id].concat(group.candidates[member.id])
      result = slots.find(function (slot) { return slot.slot_id === id }) || null
      return Boolean(result)
    })
    return result
  }

  function renderShell() {
    sessionLabel.innerHTML = "匿名编号 <strong>" + escapeHtml(state.participantId) + "</strong>"
  }

  function render() {
    advancing = false
    renderShell()
    if (state.screen === "transition") renderTransition()
    else if (state.screen === "question") renderQuestion()
    else if (state.screen === "complete") renderComplete()
    else renderIntro()
    app.focus({ preventScroll: true })
  }

  function renderIntro() {
    var preview = data.preview_mode
      ? "<div class=\"app-preview-note\"><strong>页面结构预览</strong><span>视频路径填写后再固定正式题单</span></div>"
      : ""
    app.innerHTML = "<section class=\"app-intro app-enter\">" +
      "<div class=\"app-intro__main app-card\">" +
        "<div><span class=\"app-kicker t-meta\">Experiment 01</span>" +
        "<h1 class=\"t-display\">本次实验共 " + data.groups.length + " 组</h1></div>" +
        "<p>每组请选择与上方参考视频在表情和头部运动上更接近的候选视频</p>" +
        "<div class=\"app-metrics\">" + metric(data.groups.length, "组") + metric(data.totals.questions, "道题") + metric("A/B", "二选一") + "</div>" +
        "<section class=\"app-tips\" aria-labelledby=\"tips-title\"><h2 class=\"t-heading\" id=\"tips-title\">温馨提示</h2>" +
          "<div class=\"app-tip\"><span class=\"app-tip__number\">1</span><p>默认播放速度为 2 倍速，可以自行调整</p></div>" +
          "<div class=\"app-tip\"><span class=\"app-tip__number\">2</span><p>两个候选视频均播放完成后，才可以进入下一题</p></div>" +
        "</section>" +
        preview +
        "<div class=\"app-actions\"><button class=\"app-btn app-btn--primary\" id=\"start-button\"" + (data.ready || data.preview_mode ? "" : " disabled") + ">开始实验 →</button></div>" +
      "</div>" +
    "</section>"

    document.getElementById("start-button").addEventListener("click", function () {
      state.startedAt = state.startedAt || new Date().toISOString()
      state.screen = "question"
      state.groupIndex = 0
      state.questionIndex = 0
      state.questionStartedAt = null
      saveAndRender()
    })
  }

  function metric(value, label) {
    return "<div class=\"app-metric\"><strong>" + value + "</strong><span>" + label + "</span></div>"
  }

  function renderTransition() {
    app.innerHTML = "<section class=\"app-transition app-enter\">" +
      "<span class=\"app-group-number\">" + (state.groupIndex + 1) + "</span>" +
      "<span class=\"app-kicker t-meta\">实验组 " + (state.groupIndex + 1) + " / " + data.groups.length + "</span>" +
      "<h1 class=\"t-display\">准备完成本组判断</h1>" +
      "<p>本组共 10 道题，每题先看三个参考视频，再选择候选 A 或 B</p>" +
      "<button class=\"app-btn app-btn--primary\" id=\"enter-group\">进入本组 →</button>" +
    "</section>"
    document.getElementById("enter-group").addEventListener("click", function () {
      state.screen = "question"
      state.questionIndex = 0
      state.questionStartedAt = null
      saveAndRender()
    })
  }

  function pageHead() {
    var width = Math.min(100, state.answers.length / data.totals.questions * 100)
    return "<div class=\"app-page-head\"><div><span class=\"app-kicker t-meta\">实验组 " + (state.groupIndex + 1) + " / " + data.groups.length + "</span>" +
      "<h1 class=\"t-heading\">人物动作判断</h1></div>" +
      "<div class=\"app-page-tools\">" + playbackRateControl() +
      "<div class=\"app-progress-group\"><div class=\"app-progress-copy t-meta\"><span>总进度</span><strong>" + state.answers.length + " / " + data.totals.questions + "</strong></div>" +
      "<div class=\"app-progress\"><span style=\"width:" + width.toFixed(2) + "%\"></span></div></div></div></div>"
  }

  function playbackRateControl() {
    var rates = [0.75, 1, 1.5, 2]
    return "<div class=\"app-speed-control\" aria-label=\"统一播放速度\"><span class=\"t-meta\">播放速度</span><div class=\"app-speed-options\">" + rates.map(function (rate) {
      var active = Number(state.playbackRate) === rate
      return "<button class=\"app-speed-button" + (active ? " is-active" : "") + "\" type=\"button\" data-playback-rate=\"" + rate + "\" aria-pressed=\"" + active + "\">" + rate + "×</button>"
    }).join("") + "</div></div>"
  }

  function media(slot, label, className, dataName) {
    if (slot.path) {
      var poster = slot.path.replace("videos/processed/", "videos/posters/").replace(/\.mp4$/i, ".jpg")
      return "<video class=\"app-video " + className + "\" muted playsinline preload=\"auto\" poster=\"" + escapeHtml(poster) + "\" aria-busy=\"true\" aria-label=\"" + escapeHtml(label) + "\" data-" + dataName + "=\"" + escapeHtml(slot.slot_id) + "\" src=\"" + escapeHtml(slot.path) + "\"></video>"
    }
    return "<div class=\"app-video-placeholder " + className + "\" role=\"img\" aria-label=\"" + escapeHtml(label) + "等待填写\" data-" + dataName + "=\"" + escapeHtml(slot.slot_id) + "\">" +
      "<span>等待视频</span></div>"
  }

  function applyPlaybackRate(video) {
    var rate = Number(state.playbackRate) || 1
    video.defaultPlaybackRate = rate
    video.playbackRate = rate
    video.addEventListener("ratechange", function () {
      var currentRate = Number(state.playbackRate) || 1
      if (video.playbackRate !== currentRate) video.playbackRate = currentRate
    })
  }

  function bindPlaybackRateControls() {
    Array.from(document.querySelectorAll("[data-playback-rate]")).forEach(function (button) {
      button.addEventListener("click", function () {
        state.playbackRate = Number(button.dataset.playbackRate)
        state.playbackRateCustomized = true
        window.PerceptionStore.write(state)
        Array.from(document.querySelectorAll("video")).forEach(function (video) {
          video.defaultPlaybackRate = state.playbackRate
          video.playbackRate = state.playbackRate
        })
        Array.from(document.querySelectorAll("[data-playback-rate]")).forEach(function (item) {
          var active = Number(item.dataset.playbackRate) === state.playbackRate
          item.classList.toggle("is-active", active)
          item.setAttribute("aria-pressed", String(active))
        })
      })
    })
  }

  function preloadQuestionWindow(group) {
    var paths = new Set()
    var order = state.presentation.question_order[group.id] || []
    for (var offset = 1; offset <= 3; offset += 1) {
      var nextId = order[state.questionIndex + offset]
      var nextQuestion = group.questions.find(function (question) { return question.id === nextId })
      if (!nextQuestion) continue
      nextQuestion.reference_slots.forEach(function (slot) { if (slot.path) paths.add(slot.path) })
      var nextPosition = state.presentation.positions[nextQuestion.id]
      ;[slotById(group, nextPosition.A), slotById(group, nextPosition.B)].forEach(function (slot) {
        if (slot && slot.path) paths.add(slot.path)
      })
    }

    var container = document.getElementById("video-preload-cache")
    if (!container) {
      container = document.createElement("div")
      container.id = "video-preload-cache"
      container.className = "app-preload-cache"
      container.setAttribute("aria-hidden", "true")
      document.body.appendChild(container)
    }

    paths.forEach(function (path) {
      if (videoPreloadCache.has(path)) return
      var video = document.createElement("video")
      video.className = "app-preload-video"
      video.preload = "auto"
      video.muted = true
      video.playsInline = true
      video.src = path
      container.appendChild(video)
      video.load()
      videoPreloadCache.set(path, video)
    })
  }

  function clearVideoPreloads() {
    videoPreloadCache.forEach(function (video) {
      video.removeAttribute("src")
      video.load()
      video.remove()
    })
    videoPreloadCache.clear()
    var container = document.getElementById("video-preload-cache")
    if (container) container.remove()
  }

  function prepareCurrentVideo(video) {
    video.controls = false
    function revealControls() {
      video.controls = true
      video.classList.add("is-ready")
      video.setAttribute("aria-busy", "false")
    }
    video.addEventListener("canplaythrough", revealControls, { once: true })
    video.addEventListener("error", revealControls, { once: true })
    applyPlaybackRate(video)
    video.load()
    if (video.readyState >= 4) revealControls()
  }

  function requireCompletePlayback(video, completedCandidates, updateNextButton) {
    var slotId = video.dataset.candidateSlot
    var progress = video.closest(".app-candidate-media").querySelector("[data-watch-progress]")
    var furthestTime = 0
    var seekTolerance = 0.15
    var correctingSeek = false

    function updateWatchProgress(value) {
      var percentage = Math.max(0, Math.min(100, Math.round(value)))
      progress.style.setProperty("--watch-progress", percentage)
      progress.textContent = percentage + "%"
      progress.setAttribute("aria-label", "已播放 " + percentage + "%")
    }

    video.addEventListener("loadedmetadata", function () {
      furthestTime = Math.min(furthestTime, Number(video.duration) || 0)
      updateWatchProgress(0)
    })

    video.addEventListener("timeupdate", function () {
      if (correctingSeek || completedCandidates.has(slotId)) return
      if (!video.seeking) furthestTime = Math.max(furthestTime, video.currentTime)
      if (video.duration) updateWatchProgress(furthestTime / video.duration * 100)
    })

    video.addEventListener("seeking", function () {
      if (completedCandidates.has(slotId) || correctingSeek) return
      if (video.currentTime > furthestTime + seekTolerance) {
        correctingSeek = true
        video.currentTime = furthestTime
        window.setTimeout(function () { correctingSeek = false }, 0)
      }
    })

    video.addEventListener("ended", function () {
      var duration = Number(video.duration) || 0
      if (duration > 0 && furthestTime >= duration - seekTolerance) {
        completedCandidates.add(slotId)
        updateWatchProgress(100)
        video.closest(".app-candidate-card").classList.add("is-watched")
        updateNextButton()
      }
    })
  }

  function renderQuestion() {
    var group = currentGroup()
    var question = currentQuestion()
    if (!group || !question) {
      finishGroup()
      return
    }
    var position = state.presentation.positions[question.id]
    var candidateA = slotById(group, position.A)
    var candidateB = slotById(group, position.B)
    var selectedChoice = null
    var completedCandidates = new Set()

    if (!state.questionStartedAt) {
      state.questionStartedAt = Date.now()
      window.PerceptionStore.write(state)
    }

    app.innerHTML = "<section class=\"app-question-page app-enter\">" +
      pageHead() +
      "<section class=\"app-reference-collection app-card\" aria-labelledby=\"reference-title\">" +
        "<header class=\"app-section-head\"><div><span class=\"app-kicker t-meta\">参考视频</span><h2 class=\"t-heading\" id=\"reference-title\">观察同一目标的表情和头部运动</h2></div>" +
        "<strong class=\"app-question-count\">第 " + (state.questionIndex + 1) + " / 10 题</strong></header>" +
        "<div class=\"app-reference-grid\">" + question.reference_slots.map(function (slot, index) {
          return "<article class=\"app-reference-item\"><span class=\"t-label\">参考 " + (index + 1) + "</span>" +
            media(slot, "参考视频 " + (index + 1), "app-reference-video", "reference-slot") + "</article>"
        }).join("") + "</div>" +
      "</section>" +
      "<section class=\"app-candidate-zone\" id=\"candidate-zone\">" +
        "<header class=\"app-section-head app-candidate-head\"><div><span class=\"app-kicker t-meta\">候选视频</span><h2 class=\"t-heading\">只比较表情和头部运动，哪一个候选项更接近上方参考</h2>" +
        "<p class=\"app-heading-notes\"><small>（可以针对性地寻找相同头部朝向的视频作为参考）</small><small>（候选视频均观看完毕才能切换至下一题）</small></p></div></header>" +
        "<div class=\"app-candidate-grid\">" + candidateCard("A", candidateA) + candidateCard("B", candidateB) + "</div>" +
        "<div class=\"app-question-actions\"><button class=\"app-btn app-btn--primary\" id=\"next-question\" disabled>" + nextLabel() + "</button></div>" +
      "</section>" +
    "</section>"

    Array.from(app.querySelectorAll("video")).forEach(function (video) {
      prepareCurrentVideo(video)
    })
    preloadQuestionWindow(group)
    bindPlaybackRateControls()
    var nextButton = document.getElementById("next-question")
    function updateNextButton() {
      nextButton.disabled = !selectedChoice || completedCandidates.size < 2
    }
    Array.from(document.querySelectorAll(".app-candidate-video")).forEach(function (video) {
      requireCompletePlayback(video, completedCandidates, updateNextButton)
    })
    Array.from(document.querySelectorAll("[data-choice]")).forEach(function (button) {
      button.addEventListener("click", function () {
        if (advancing) return
        selectedChoice = button.dataset.choice
        Array.from(document.querySelectorAll("[data-choice]")).forEach(function (item) {
          var selected = item.dataset.choice === selectedChoice
          item.classList.toggle("is-selected", selected)
          item.closest(".app-candidate-card").classList.toggle("is-selected", selected)
          item.closest(".app-candidate-card").classList.remove("app-choice-pulse")
        })
        var card = button.closest(".app-candidate-card")
        window.requestAnimationFrame(function () { card.classList.add("app-choice-pulse") })
        updateNextButton()
      })
    })

    nextButton.addEventListener("click", function () {
      if (advancing || !selectedChoice || completedCandidates.size < 2) return
      advancing = true
      nextButton.disabled = true
      recordAnswer(group, question, candidateA, candidateB, position.correct, selectedChoice)
      document.getElementById("candidate-zone").classList.add("is-leaving")
      window.setTimeout(function () {
        if (state.questionIndex >= 10) finishGroup()
        else render()
      }, 280)
    })
  }

  function candidateCard(position, slot) {
    return "<article class=\"app-candidate-card app-card\">" +
      "<header><span class=\"t-label\">候选视频</span><strong class=\"app-video-key\">" + position + "</strong></header>" +
      "<div class=\"app-candidate-media\">" + media(slot, "候选视频 " + position, "app-candidate-video", "candidate-slot") +
      "<span class=\"app-watch-progress\" data-watch-progress=\"" + escapeHtml(slot.slot_id) + "\" style=\"--watch-progress:0\" aria-label=\"已播放 0%\">0%</span></div>" +
      "<button class=\"app-choice\" data-choice=\"" + position + "\">选择 " + position + "</button>" +
    "</article>"
  }

  function nextLabel() {
    if (state.groupIndex === data.groups.length - 1 && state.questionIndex === 9) return "完成实验 →"
    if (state.questionIndex === 9) return "完成本组 →"
    return "下一题 →"
  }

  function recordAnswer(group, question, candidateA, candidateB, correctPosition, choice) {
    var responseTime = Math.max(0, Date.now() - Number(state.questionStartedAt || Date.now()))
    state.answers.push({
      anonymous_participant_id: state.participantId,
      answer_order: state.answers.length + 1,
      presented_group_order: state.groupIndex + 1,
      group_id: group.id,
      condition: group.condition,
      condition_label: group.condition_label,
      pair_member_1: group.members[0].admin_label,
      pair_member_2: group.members[1].admin_label,
      question_id: question.id,
      base_question_order: question.base_order,
      target_member: question.target_admin_label,
      reference_slot_1: question.reference_slots[0].slot_id,
      reference_path_1: question.reference_slots[0].path,
      reference_slot_2: question.reference_slots[1].slot_id,
      reference_path_2: question.reference_slots[1].path,
      reference_slot_3: question.reference_slots[2].slot_id,
      reference_path_3: question.reference_slots[2].path,
      a_member: candidateA.member_admin_label,
      a_slot: candidateA.slot_id,
      a_path: candidateA.path,
      b_member: candidateB.member_admin_label,
      b_slot: candidateB.slot_id,
      b_path: candidateB.path,
      correct_answer_position: correctPosition,
      participant_choice: choice,
      is_correct: choice === correctPosition,
      response_time_ms: responseTime,
      answered_at: new Date().toISOString()
    })
    state.questionIndex += 1
    state.questionStartedAt = null
    window.PerceptionStore.write(state)
  }

  function finishGroup() {
    clearVideoPreloads()
    if (state.groupIndex < data.groups.length - 1) {
      state.groupIndex += 1
      state.questionIndex = 0
      state.questionStartedAt = null
      state.screen = "transition"
    } else {
      state.screen = "complete"
      state.completedAt = state.completedAt || new Date().toISOString()
    }
    window.PerceptionStore.write(state)
    render()
  }

  function renderComplete() {
    var submission = state.cloudSubmission || { status: "idle" }
    app.innerHTML = "<section class=\"app-complete app-enter\">" +
      "<canvas class=\"app-fireworks\" id=\"fireworks\" aria-hidden=\"true\"></canvas>" +
      "<span class=\"app-complete__icon\">✓</span>" +
      "<h1 class=\"t-display\">" + data.totals.questions + " 道题已全部完成</h1>" +
      "<p>系统会自动保存本次作答数据</p>" +
      "<div class=\"app-cloud-status" + cloudStatusClass(submission.status) + "\" id=\"cloud-status\" aria-live=\"polite\">" + cloudStatusText(submission.status) + "</div>" +
      "<div class=\"app-actions\"><button class=\"app-btn app-btn--primary\" id=\"retry-upload\"" + (submission.status === "failed" ? "" : " hidden") + ">重新保存</button>" +
      "<button class=\"app-btn app-btn--secondary\" id=\"export-button\">下载 CSV 备份</button></div>" +
      "<small class=\"t-meta\" id=\"export-status\" aria-live=\"polite\"></small>" +
    "</section>"
    document.getElementById("export-button").addEventListener("click", exportCsv)
    document.getElementById("retry-upload").addEventListener("click", submitCompletedExperiment)
    startFireworks()
    if (submission.status !== "success" && submission.status !== "uploading") submitCompletedExperiment()
  }

  function cloudStatusClass(status) {
    if (status === "success") return " is-success"
    if (status === "failed" || status === "not_configured") return " is-error"
    return ""
  }

  function cloudStatusText(status) {
    if (status === "uploading") return "正在保存实验数据…"
    if (status === "success") return "实验数据已成功保存"
    if (status === "failed") return "自动保存失败，请点击重新保存"
    if (status === "not_configured") return "云端保存尚未启用，请先下载 CSV 备份"
    return "正在准备保存实验数据…"
  }

  function updateCloudStatus() {
    var element = document.getElementById("cloud-status")
    var retry = document.getElementById("retry-upload")
    if (!element || !retry) return
    var status = state.cloudSubmission.status
    element.className = "app-cloud-status" + cloudStatusClass(status)
    element.textContent = cloudStatusText(status)
    retry.hidden = status !== "failed"
  }

  function submitCompletedExperiment() {
    if (!window.PerceptionCloud || !window.PerceptionCloud.isConfigured()) {
      state.cloudSubmission.status = "not_configured"
      state.cloudSubmission.lastError = "cloud_not_configured"
      window.PerceptionStore.write(state)
      updateCloudStatus()
      return
    }
    if (state.answers.length !== data.totals.questions) {
      state.cloudSubmission.status = "failed"
      state.cloudSubmission.lastError = "answer_count_mismatch"
      window.PerceptionStore.write(state)
      updateCloudStatus()
      return
    }

    state.cloudSubmission.status = "uploading"
    state.cloudSubmission.attemptCount = Number(state.cloudSubmission.attemptCount || 0) + 1
    state.cloudSubmission.lastError = null
    window.PerceptionStore.write(state)
    updateCloudStatus()

    window.PerceptionCloud.submit({
      participantId: state.participantId,
      submissionId: state.participantId + "-" + data.fingerprint,
      fingerprint: data.fingerprint,
      seed: data.seed,
      startedAt: state.startedAt,
      completedAt: state.completedAt,
      groupCount: data.totals.groups,
      questionCount: data.totals.questions,
      answers: state.answers
    }).then(function (result) {
      state.cloudSubmission.status = "success"
      state.cloudSubmission.receiptId = result.receiptId || null
      state.cloudSubmission.submittedAt = new Date().toISOString()
      state.cloudSubmission.lastError = null
      window.PerceptionStore.write(state)
      updateCloudStatus()
    }).catch(function (error) {
      state.cloudSubmission.status = "failed"
      state.cloudSubmission.lastError = error && error.message ? error.message : "upload_failed"
      window.PerceptionStore.write(state)
      updateCloudStatus()
    })
  }

  function startFireworks() {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return
    var canvas = document.getElementById("fireworks")
    if (!canvas) return
    var context = canvas.getContext("2d")
    var particles = []
    var colors = ["#ff4f87", "#ffb020", "#40c9a2", "#5b7cfa", "#9b5de5", "#ffffff"]
    var startedAt = performance.now()
    var lastBurstAt = -500
    var duration = 7000

    function resize() {
      var ratio = Math.min(window.devicePixelRatio || 1, 2)
      canvas.width = Math.round(window.innerWidth * ratio)
      canvas.height = Math.round(window.innerHeight * ratio)
      canvas.style.width = window.innerWidth + "px"
      canvas.style.height = window.innerHeight + "px"
      context.setTransform(ratio, 0, 0, ratio, 0, 0)
    }

    function burst() {
      var x = window.innerWidth * (0.15 + Math.random() * 0.7)
      var y = window.innerHeight * (0.12 + Math.random() * 0.45)
      var color = colors[Math.floor(Math.random() * colors.length)]
      var amount = 34 + Math.floor(Math.random() * 18)
      for (var index = 0; index < amount; index += 1) {
        var angle = Math.PI * 2 * index / amount + Math.random() * 0.14
        var speed = 1.7 + Math.random() * 3.7
        particles.push({
          x: x,
          y: y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          life: 1,
          color: color,
          size: 1.8 + Math.random() * 2.2
        })
      }
    }

    function animate(now) {
      var elapsed = now - startedAt
      if (elapsed < duration && now - lastBurstAt > 460) {
        burst()
        lastBurstAt = now
      }
      context.clearRect(0, 0, window.innerWidth, window.innerHeight)
      particles = particles.filter(function (particle) {
        particle.x += particle.vx
        particle.y += particle.vy
        particle.vy += 0.045
        particle.vx *= 0.992
        particle.life -= 0.012
        if (particle.life <= 0) return false
        context.globalAlpha = particle.life
        context.fillStyle = particle.color
        context.beginPath()
        context.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2)
        context.fill()
        return true
      })
      context.globalAlpha = 1
      if (elapsed < duration || particles.length) window.requestAnimationFrame(animate)
      else canvas.remove()
    }

    resize()
    window.addEventListener("resize", resize, { once: true })
    window.requestAnimationFrame(animate)
  }

  function csvCell(value) {
    var text = String(value === undefined || value === null ? "" : value)
    return /[",\r\n]/.test(text) ? "\"" + text.replace(/"/g, "\"\"") + "\"" : text
  }

  function exportCsv() {
    var columns = [
      "anonymous_participant_id", "answer_order", "presented_group_order", "group_id", "condition", "condition_label",
      "pair_member_1", "pair_member_2", "question_id", "base_question_order", "target_member",
      "reference_slot_1", "reference_path_1", "reference_slot_2", "reference_path_2", "reference_slot_3", "reference_path_3",
      "a_member", "a_slot", "a_path", "b_member", "b_slot", "b_path", "correct_answer_position",
      "participant_choice", "is_correct", "response_time_ms", "answered_at"
    ]
    var rows = [columns.join(",")].concat(state.answers.map(function (answer) {
      return columns.map(function (column) { return csvCell(answer[column]) }).join(",")
    }))
    var blob = new Blob(["\ufeff" + rows.join("\r\n")], { type: "text/csv;charset=utf-8" })
    var link = document.createElement("a")
    link.href = URL.createObjectURL(blob)
    link.download = "perception_distance_experiment_" + state.participantId + ".csv"
    document.body.appendChild(link)
    link.click()
    link.remove()
    window.setTimeout(function () { URL.revokeObjectURL(link.href) }, 1000)
    document.getElementById("export-status").textContent = "CSV 已导出"
  }

  function saveAndRender() {
    window.PerceptionStore.write(state)
    render()
  }

  render()
}())
