import fs from "node:fs"
import path from "node:path"
import vm from "node:vm"
import { fileURLToPath } from "node:url"

const toolDir = path.dirname(fileURLToPath(import.meta.url))
const siteDir = path.resolve(toolDir, "..")
const allowEmpty = process.argv.includes("--allow-empty")
const context = { window: {} }

vm.runInNewContext(
  fs.readFileSync(path.join(siteDir, "data/video-paths.js"), "utf8"),
  context,
  { filename: "video-paths.js" }
)
vm.runInNewContext(
  fs.readFileSync(path.join(siteDir, "data/experiment-spec.js"), "utf8"),
  context,
  { filename: "experiment-spec.js" }
)

const data = context.window.PERCEPTION_EXPERIMENT
const sourcePaths = context.window.PERCEPTION_SOURCE_VIDEO_PATHS || {}
const sourceDirections = context.window.PERCEPTION_SOURCE_VIDEO_DIRECTIONS || {}
const errors = []
const ids = data.slots.map((slot) => slot.slot_id)
const duplicateIds = ids.filter((id, index) => ids.indexOf(id) !== index)
const expectedPairs = [
  ["Sheldon", "Leonard"],
  ["Leonard", "Howard"],
  ["Howard", "Sheldon"],
  ["AI-1", "AI-3"],
  ["AI-4", "AI-6"],
  ["AI-5", "AI-7"]
]

function orientation(slot) {
  return sourceDirections[slot.slot_id] || path.basename(sourcePaths[slot.slot_id] || "").split("_")[0]
}

if (data.groups.length !== 6) errors.push(`实验组数量应为 6，当前为 ${data.groups.length}`)
if (data.totals.questions !== 60) errors.push(`题目数量应为 60，当前为 ${data.totals.questions}`)
if (data.slots.length !== 156) errors.push(`视频站位应为 156，当前为 ${data.slots.length}`)
if (Object.keys(sourcePaths).length !== 156) errors.push(`原始视频路径应为 156 个站位，当前为 ${Object.keys(sourcePaths).length}`)
if (new Set(Object.values(sourcePaths)).size !== 117) errors.push(`不同原始视频应为 117 个，当前为 ${new Set(Object.values(sourcePaths)).size}`)
if (duplicateIds.length) errors.push(`存在重复站位 ${Array.from(new Set(duplicateIds)).join(", ")}`)

data.groups.forEach((group, groupIndex) => {
  const actualPair = group.members.map((member) => member.admin_label)
  if (actualPair.join("|") !== expectedPairs[groupIndex].join("|")) {
    errors.push(`${group.id} 人物组合应为 ${expectedPairs[groupIndex].join(" 与 ")}，当前为 ${actualPair.join(" 与 ")}`)
  }
  if (group.questions.length !== 10) errors.push(`${group.id} 题目数量不是 10`)
  const targetCounts = Object.fromEntries(group.members.map((member) => [member.id, 0]))
  group.questions.forEach((question) => {
    targetCounts[question.target_member_id] += 1
    if (question.reference_slots.length !== 3) errors.push(`${question.id} 参考视频不是 3 个`)
    if (question.candidate_slots.length !== 2) errors.push(`${question.id} 候选视频不是 2 个`)
    if (question.candidate_slots[0].member_id === question.candidate_slots[1].member_id) {
      errors.push(`${question.id} 两个候选来自同一人物`)
    }
    const orientations = question.candidate_slots.map(orientation)
    if (orientations[0] !== orientations[1]) {
      errors.push(`${question.id} 两个候选朝向不同：${orientations.join(" 与 ")}`)
    }
  })
  Object.entries(targetCounts).forEach(([member, count]) => {
    if (count !== 5) errors.push(`${group.id} 的 ${member} 目标题数应为 5，当前为 ${count}`)
  })
  group.members.forEach((member) => {
    if (group.references[member.id].length !== 3) errors.push(`${group.id} 的 ${member.id} 参考站位不是 3 个`)
    if (group.candidates[member.id].length !== 10) errors.push(`${group.id} 的 ${member.id} 候选站位不是 10 个`)
    const referenceDirections = group.references[member.id].map(orientation)
    if (referenceDirections.join(",") !== "left,front,right") {
      errors.push(`${group.id} 的 ${member.id} 参考视频不是左、正中、右顺序`)
    }
    const memberSources = group.references[member.id].concat(group.candidates[member.id]).map((slot) => sourcePaths[slot.slot_id])
    if (new Set(memberSources).size !== 13) errors.push(`${group.id} 的 ${member.id} 参考和候选视频存在重复`)
  })
})

const missing = data.slots.filter((slot) => !slot.path)
const missingFiles = data.slots.filter((slot) => slot.path && !fs.existsSync(path.resolve(siteDir, slot.path)))
const missingPosters = data.slots.filter((slot) => {
  if (!slot.path) return false
  const posterPath = slot.path.replace("videos/processed/", "videos/posters/").replace(/\.mp4$/i, ".jpg")
  return !fs.existsSync(path.resolve(siteDir, posterPath))
})

if (!allowEmpty && missing.length) errors.push(`仍有 ${missing.length} 个视频路径未填写`)
if (missingFiles.length) errors.push(`有 ${missingFiles.length} 个视频文件不存在`)
if (missingPosters.length) errors.push(`有 ${missingPosters.length} 个视频首帧封面不存在`)

console.log(`实验组 ${data.groups.length}`)
console.log(`题目 ${data.totals.questions}`)
console.log(`视频站位 ${data.slots.length}`)
console.log(`不同原始视频 ${new Set(Object.values(sourcePaths)).size}`)
console.log(`未填写路径 ${missing.length}`)
console.log(`不存在文件 ${missingFiles.length}`)
console.log(`不存在首帧封面 ${missingPosters.length}`)

if (errors.length) {
  errors.forEach((error) => console.error(`错误 ${error}`))
  process.exitCode = 1
} else {
  console.log("站位结构检查通过")
}
