import fs from "node:fs/promises"
import path from "node:path"
import { fileURLToPath } from "node:url"

const toolDir = path.dirname(fileURLToPath(import.meta.url))
const siteDir = path.resolve(toolDir, "..")
const defaultSourceRoot = "/Users/a1/Desktop/projects/个性化/七人物_视频页面素材包/videos"
const sourceRootIndex = process.argv.indexOf("--source-root")
const sourceRoot = path.resolve(sourceRootIndex >= 0 ? process.argv[sourceRootIndex + 1] : defaultSourceRoot)
const defaultSupplementRoot = "/Users/a1/Desktop/projects/个性化/AI5_AI6_最终视频素材/videos"
const supplementRootIndex = process.argv.indexOf("--supplement-root")
const supplementRoot = path.resolve(supplementRootIndex >= 0 ? process.argv[supplementRootIndex + 1] : defaultSupplementRoot)
const destinationRoot = path.join(siteDir, "videos", "source")
const manifestPath = path.join(siteDir, "data", "source-video-manifest.json")
const videoExtensions = new Set([".mp4", ".mov", ".m4v", ".webm"])
const people = ["Sheldon", "Leonard", "Howard", "AI-1", "AI-3", "AI-4", "AI-5", "AI-6", "AI-7"]
const roles = [
  { directory: "reference_gt", expected: 3, label: "reference" },
  { directory: "candidate_faceswap", expected: 10, label: "candidate" }
]

async function videoFiles(directory) {
  const entries = await fs.readdir(directory, { withFileTypes: true })
  return entries
    .filter((entry) => entry.isFile() && videoExtensions.has(path.extname(entry.name).toLowerCase()))
    .map((entry) => entry.name)
    .sort((left, right) => left.localeCompare(right, "en"))
}

const records = []
for (const person of people) {
  for (const role of roles) {
    const personSourceRoot = ["AI-5", "AI-6"].includes(person) ? supplementRoot : sourceRoot
    const sourceDirectory = path.join(personSourceRoot, person, role.directory)
    const destinationDirectory = path.join(destinationRoot, person, role.directory)
    const files = await videoFiles(sourceDirectory)
    if (files.length !== role.expected) {
      throw new Error(`${person}/${role.directory} 应为 ${role.expected} 条视频，当前为 ${files.length}`)
    }
    await fs.mkdir(destinationDirectory, { recursive: true })
    for (let index = 0; index < files.length; index += 1) {
      const filename = files[index]
      const sourceAbsolutePath = path.join(sourceDirectory, filename)
      const localAbsolutePath = path.join(destinationDirectory, filename)
      await fs.copyFile(sourceAbsolutePath, localAbsolutePath)
      const info = await fs.stat(localAbsolutePath)
      records.push({
        person,
        role: role.label,
        index: index + 1,
        filename,
        source_absolute_path: sourceAbsolutePath,
        local_relative_path: path.relative(siteDir, localAbsolutePath).split(path.sep).join("/"),
        size_bytes: info.size
      })
    }
  }
}

await fs.mkdir(path.dirname(manifestPath), { recursive: true })
await fs.writeFile(manifestPath, JSON.stringify({
  schema_version: 1,
  generated_at: new Date().toISOString(),
  source_roots: [sourceRoot, supplementRoot],
  people,
  totals: {
    people: people.length,
    reference_videos: records.filter((record) => record.role === "reference").length,
    candidate_videos: records.filter((record) => record.role === "candidate").length,
    videos: records.length
  },
  records
}, null, 2) + "\n", "utf8")

console.log(`人物 ${people.length}`)
console.log(`参考视频 ${records.filter((record) => record.role === "reference").length}`)
console.log(`候选视频 ${records.filter((record) => record.role === "candidate").length}`)
console.log(`输出 ${manifestPath}`)
