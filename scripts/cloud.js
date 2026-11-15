(function () {
  "use strict"

  function config() {
    return window.PERCEPTION_CLOUD || { enabled: false, apiBaseUrl: "" }
  }

  function isConfigured() {
    var current = config()
    return current.enabled === true && /^https:\/\//.test(current.apiBaseUrl || "")
  }

  function submit(payload) {
    if (!isConfigured()) return Promise.reject(new Error("cloud_not_configured"))
    return fetch(config().apiBaseUrl.replace(/\/$/, "") + "/api/submissions", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload)
    }).then(function (response) {
      return response.json().catch(function () { return {} }).then(function (body) {
        if (!response.ok) throw new Error(body.error || "upload_failed")
        return body
      })
    })
  }

  window.PerceptionCloud = {
    isConfigured: isConfigured,
    submit: submit
  }
}())
