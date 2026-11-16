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
    var participantSeed = String(data.seed) + ":" + state.participantId + ":" + state.attemptId
    var random = randomGenerator(hashSeed(participantSeed))
    var groupOrder = shuffle(data.groups.map(function (group) { return group.id }), random)
    var questionOrder = {}
    var positions = {}

    data.groups.forEach(function (group) {
      questionOrder[group.id] = shuffle(group.questions.map(function (question) { return question.id }), random)
      var targetOnLeftPlan = shuffle(group.questions.map(function (_, index) {
        return index < Math.floor(group.questions.length / 2)
      }), random)
      group.questions.forEach(function (question, index) {
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
    })

    var presentation = {
      seed: data.seed,
      participant_seed: hashSeed(participantSeed),
      group_order: groupOrder,
      question_order: questionOrder,
      positions: positions
    }
    auditPresentation(presentation)
    return presentation
  }

  function auditPresentation(presentation) {
    data.groups.forEach(function (group) {
      var correctA = 0
      var correctB = 0
      var candidateSlots = new Set()
      var targetCounts = {}
      group.questions.forEach(function (question) {
        var position = presentation.positions[question.id]
        if (!position) throw new Error("题目位置缺失 " + question.id)
        if (position.correct === "A") correctA += 1
        if (position.correct === "B") correctB += 1
        candidateSlots.add(position.A)
        candidateSlots.add(position.B)
        targetCounts[question.target_member_id] = (targetCounts[question.target_member_id] || 0) + 1
      })
      if (correctA !== 5 || correctB !== 5) throw new Error(group.id + " 的 A/B 位置不平衡")
      if (candidateSlots.size !== 20) throw new Error(group.id + " 的候选视频发生重复")
      group.members.forEach(function (member) {
        if (targetCounts[member.id] !== 5) throw new Error(group.id + " 的目标人物次数不平衡")
      })
    })
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
    sessionLabel.innerHTML = "匿名编号 <strong>" + escapeHtml(state.participantId) + "</strong> · 第 " + state.attemptNumber + " 次"
  }

  function render() {
    advancing = false
    document.body.classList.toggle("app-on-intro", state.screen !== "transition" && state.screen !== "question" && state.screen !== "complete")
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
      "<header class=\"app-intro-hero\"><h1 class=\"t-display\">人物动作感知实验</h1>" +
        "<p>根据人物的头部运动和表情，选出更适合扮演参考人物的候选人</p></header>" +
      "<div class=\"app-intro-grid\">" +
        introCard("实验组成", data.groups.length + " 组实验｜3 组真人剧｜3 组 AI 剧｜每组 10 题") +
        introCard("参考视频", "同一人物的左视角、正中视角、右视角原始视频") +
        introCard("候选视频", "候选 A 与 B 分别来自目标人物和干扰人物，均采用统一换脸处理，位置随机排列") +
      "</div>" +
      "<section class=\"app-judging app-card\" aria-labelledby=\"judging-title\">" +
        "<h2 class=\"t-display\" id=\"judging-title\">判断任务</h2>" +
        "<p class=\"app-judging__lead\">选出更适合扮演上方参考人物的候选人</p>" +
        "<div class=\"app-judging__rules\"><span>只比较头部运动和表情</span><span>不参考眼睛大小、脸型等身份外观</span><span>优先比较相同头部朝向的视频</span></div>" +
      "</section>" +
      "<div class=\"app-step-grid\">" +
        stepCard("Step 1", "对照视频", "依次播放两个候选视频，优先对照相同头部朝向的参考视频，无法判断时再查看其他朝向") +
        stepCard("Step 2", "头部运动", "比较头部转动方向、转动幅度和转动速度") +
        stepCard("Step 3", "表情变化", "比较表情强度，重点观察眉毛、嘴唇和鼻子，注意皱眉与挑眉") +
      "</div>" +
      "<section class=\"app-intro-tips app-card\" aria-labelledby=\"tips-title\"><h2 class=\"t-heading\" id=\"tips-title\">温馨提示</h2>" +
        "<div><span>默认 2 倍速播放，可以自行调整</span><span>两个候选视频均播放完毕后才能进入下一题</span><span>可以反复播放视频</span></div>" +
      "</section>" +
      preview +
      "<div class=\"app-intro-actions\"><button class=\"app-btn app-btn--primary\" id=\"start-button\"" + (data.ready || data.preview_mode ? "" : " disabled") + ">开始实验</button></div>" +
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

  function introCard(title, body) {
    return "<article class=\"app-intro-card app-card\"><h2 class=\"t-heading\">" + escapeHtml(title) + "</h2><p>" + escapeHtml(body) + "</p></article>"
  }

  function stepCard(number, title, body) {
    return "<article class=\"app-step-card app-card\"><h2 class=\"t-heading\"><span>" + escapeHtml(number) + "</span> " + escapeHtml(title) + "</h2><p>" + escapeHtml(body) + "</p></article>"
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
    return "<div class=\"app-page-head\"><div><span class=\"app-kicker t-meta\">实验组 " + (state.groupIndex + 1) + " / " + data.groups.length + " · 第 " + (state.questionIndex + 1) + " / 10 题</span>" +
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
      "<div class=\"app-question-layout\">" +
        "<aside class=\"app-judge-panel app-card\" aria-labelledby=\"judge-title\">" +
          "<div class=\"app-judge-intro\"><h2 class=\"t-display\" id=\"judge-title\">判断任务</h2>" +
          "<p class=\"app-judge-lead\">选出最适合扮演上方参考人物的候选人</p></div>" +
          "<p class=\"app-judge-rule\">只比较头部运动和表情，不参考眼睛大小、脸型等身份外观</p>" +
          judgeStep("1", "Step 1 对照视频", "播放一个候选视频 → 查看相同头部朝向的参考视频 → 再查看另一个候选视频；无法判断时，再依次查看其他朝向的参考视频") +
          judgeStep("2", "Step 2 头部运动", "比较头部转动幅度和速度") +
          judgeStep("3", "Step 3 表情变化", "比较表情强度，重点观察眉毛、嘴唇和鼻子；注意皱眉、挑眉和嘴部变化") +
          "<p class=\"app-judge-limit\">候选 A、B 均观看完毕后才能进入下一题</p>" +
        "</aside>" +
        "<div class=\"app-question-content\">" +
          "<section class=\"app-reference-collection app-card\" aria-labelledby=\"reference-title\">" +
            "<header class=\"app-section-head\"><div><span class=\"app-kicker t-meta\">参考视频</span><h2 class=\"t-heading\" id=\"reference-title\">观察同一目标的表情和头部运动</h2></div></header>" +
            "<div class=\"app-reference-grid\">" + question.reference_slots.map(function (slot, index) {
              var referenceLabels = ["左侧参考", "正面参考", "右侧参考"]
              return "<article class=\"app-reference-item\"><span class=\"t-label\">" + referenceLabels[index] + "</span>" +
                media(slot, referenceLabels[index], "app-reference-video", "reference-slot") + "</article>"
            }).join("") + "</div>" +
          "</section>" +
          "<section class=\"app-candidate-zone\" id=\"candidate-zone\">" +
            "<header class=\"app-section-head app-candidate-head\"><div><span class=\"app-kicker t-meta\">候选视频</span><h2 class=\"t-heading\">选择更接近上方参考人物的候选视频</h2></div></header>" +
            "<div class=\"app-candidate-grid\">" + candidateCard("A", candidateA) + candidateCard("B", candidateB) + "</div>" +
            "<div class=\"app-question-actions\"><p id=\"question-status\">请完整观看候选 A 和候选 B</p><button class=\"app-btn app-btn--primary\" id=\"next-question\" disabled>" + nextLabel() + "</button></div>" +
          "</section>" +
        "</div>" +
      "</div>" +
    "</section>"

    Array.from(app.querySelectorAll("video")).forEach(function (video) {
      prepareCurrentVideo(video)
    })
    preloadQuestionWindow(group)
    bindPlaybackRateControls()
    var nextButton = document.getElementById("next-question")
    var questionStatus = document.getElementById("question-status")
    function updateNextButton() {
      nextButton.disabled = !selectedChoice || completedCandidates.size < 2
      if (completedCandidates.size < 2) questionStatus.textContent = "请完整观看候选 A 和候选 B"
      else if (!selectedChoice) questionStatus.textContent = "候选视频已观看完毕，请选择 A 或 B"
      else questionStatus.textContent = "已完成观看和选择，可以进入下一题"
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

  function judgeStep(number, title, body) {
    return "<section class=\"app-judge-step\"><h3><span>" + escapeHtml(number) + "</span>" + escapeHtml(title) + "</h3><p>" + escapeHtml(body) + "</p></section>"
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
      "<button class=\"app-btn app-btn--secondary\" id=\"export-button\">下载 CSV 备份</button>" +
      "<button class=\"app-btn app-btn--secondary\" id=\"repeat-button\"" + (submission.status === "success" ? "" : " disabled") + ">再做一次</button></div>" +
      "<small class=\"t-meta\" id=\"export-status\" aria-live=\"polite\"></small>" +
    "</section>"
    document.getElementById("export-button").addEventListener("click", exportCsv)
    document.getElementById("retry-upload").addEventListener("click", submitCompletedExperiment)
    document.getElementById("repeat-button").addEventListener("click", repeatExperiment)
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
    var repeat = document.getElementById("repeat-button")
    if (!element || !retry || !repeat) return
    var status = state.cloudSubmission.status
    element.className = "app-cloud-status" + cloudStatusClass(status)
    element.textContent = cloudStatusText(status)
    retry.hidden = status !== "failed"
    repeat.disabled = status !== "success"
  }

  function repeatExperiment() {
    if (state.cloudSubmission.status !== "success") return
    clearVideoPreloads()
    state = window.PerceptionStore.repeat(data.fingerprint || "", state)
    state.presentation = makePresentation()
    window.PerceptionStore.write(state)
    window.scrollTo({ top: 0, behavior: "smooth" })
    render()
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
      submissionId: state.participantId + "-" + data.fingerprint + "-" + state.attemptId,
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
    link.download = "perception_distance_experiment_" + state.participantId + "_" + data.fingerprint + "_" + state.attemptId + ".csv"
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
