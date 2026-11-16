(function () {
  "use strict"
  var loginPanel = document.getElementById("login-panel")
  var dashboard = document.getElementById("dashboard")
  var loginForm = document.getElementById("login-form")
  var keyInput = document.getElementById("admin-key")
  var loginStatus = document.getElementById("login-status")
  var dashboardStatus = document.getElementById("dashboard-status")
  var logoutButton = document.getElementById("logout-button")
  var refreshButton = document.getElementById("refresh-button")
  var apiBaseUrl = (window.PERCEPTION_CLOUD && window.PERCEPTION_CLOUD.apiBaseUrl || "").replace(/\/$/, "")
  var adminKey = sessionStorage.getItem("perception-admin-key") || ""

  function api(path, options) {
    if (!apiBaseUrl) return Promise.reject(new Error("云端接口尚未配置"))
    var settings = options || {}
    settings.headers = Object.assign({}, settings.headers, { authorization: "Bearer " + adminKey })
    return fetch(apiBaseUrl + path, settings).then(function (response) {
      if (settings.raw && response.ok) return response
      return response.json().catch(function () { return {} }).then(function (body) {
        if (!response.ok) throw new Error(body.error || "请求失败")
        return body
      })
    })
  }

  function showLogin(message) {
    loginPanel.hidden = false
    dashboard.hidden = true
    logoutButton.hidden = true
    loginStatus.textContent = message || ""
  }

  function formatBytes(value) {
    if (value < 1024) return value + " B"
    return (value / 1024).toFixed(1) + " KB"
  }

  function participantFromKey(key) {
    var parts = String(key).split("/")
    return parts.length > 1 ? parts[1] : "—"
  }

  function versionFromKey(key) {
    var match = String(key).match(/perception-distance-e1-v\d+(?:-[a-z]+(?:-[a-z]+)*)?/i)
    return match ? match[0] : "旧版本"
  }

  function loadDashboard() {
    dashboardStatus.textContent = "正在读取数据…"
    return api("/api/admin/submissions").then(function (result) {
      loginPanel.hidden = true
      dashboard.hidden = false
      logoutButton.hidden = false
      document.getElementById("submission-count").textContent = result.count
      document.getElementById("submission-list").innerHTML = result.items.map(function (item) {
        return "<tr><td>" + participantFromKey(item.key) + "</td><td>" + versionFromKey(item.key) + "</td><td>" + new Date(item.uploaded).toLocaleString("zh-CN") + "</td><td>" + formatBytes(item.size) + "</td>" +
          "<td><button class=\"admin-download\" data-key=\"" + item.key.replace(/&/g, "&amp;").replace(/\"/g, "&quot;") + "\">下载 CSV</button></td></tr>"
      }).join("") || "<tr><td colspan=\"5\">暂未收到数据</td></tr>"
      dashboardStatus.textContent = ""
      Array.from(document.querySelectorAll("[data-key]")).forEach(function (button) {
        button.addEventListener("click", function () { downloadCsv(button.dataset.key) })
      })
    }).catch(function (error) {
      sessionStorage.removeItem("perception-admin-key")
      adminKey = ""
      showLogin(error.message)
    })
  }

  function downloadCsv(key) {
    dashboardStatus.textContent = "正在下载…"
    api("/api/admin/download?key=" + encodeURIComponent(key), { raw: true }).then(function (response) { return response.blob() }).then(function (blob) {
      var link = document.createElement("a")
      link.href = URL.createObjectURL(blob)
      link.download = key.split("/").pop()
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.setTimeout(function () { URL.revokeObjectURL(link.href) }, 1000)
      dashboardStatus.textContent = "CSV 已下载"
    }).catch(function (error) { dashboardStatus.textContent = error.message })
  }

  loginForm.addEventListener("submit", function (event) {
    event.preventDefault()
    adminKey = keyInput.value.trim()
    sessionStorage.setItem("perception-admin-key", adminKey)
    loadDashboard()
  })
  refreshButton.addEventListener("click", loadDashboard)
  logoutButton.addEventListener("click", function () {
    sessionStorage.removeItem("perception-admin-key")
    adminKey = ""
    keyInput.value = ""
    showLogin("")
  })
  if (adminKey) loadDashboard()
  else showLogin("")
}())
