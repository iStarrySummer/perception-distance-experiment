import fs from "node:fs/promises"
import path from "node:path"
import vm from "node:vm"
import { spawn } from "node:child_process"
import { fileURLToPath } from "node:url"

const toolDir = path.dirname(fileURLToPath(import.meta.url))
const siteDir = path.resolve(toolDir, "..")
const outputDir = path.join(siteDir, "videos", "posters")
const context = { window: {} }

vm.runInNewContext(
  await fs.readFile(path.join(siteDir, "data", "video-paths.js"), "utf8"),
  context,
  { filename: "video-paths.js" }
)
vm.runInNewContext(
  await fs.readFile(path.join(siteDir, "data", "experiment-spec.js"), "utf8"),
  context,
  { filename: "experiment-spec.js" }
)

const experiment = context.window.PERCEPTION_EXPERIMENT

function run(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd: siteDir })
    let stderr = ""
    child.stderr.on("data", (chunk) => { stderr += chunk })
    child.on("error", reject)
    child.on("close", (code) => {
      if (code === 0) resolve()
      else reject(new Error(`${command} 退出码 ${code}\n${stderr.slice(-2000)}`))
    })
  })
}

async function mapLimit(items, limit, worker) {
  let cursor = 0
  async function next() {
    while (cursor < items.length) {
      const index = cursor
      cursor += 1
      await worker(items[index], index)
    }
  }
  await Promise.all(Array.from({ length: limit }, next))
}

await fs.mkdir(outputDir, { recursive: true })

await mapLimit(experiment.slots, 6, async (slot, index) => {
  const input = path.resolve(siteDir, slot.path)
  const output = path.join(outputDir, `${slot.slot_id.toLowerCase()}.jpg`)
  await run("ffmpeg", [
    "-y", "-hide_banner", "-loglevel", "error",
    "-i", input,
    "-vf", "select=eq(n\\,0)",
    "-frames:v", "1",
    "-q:v", "3",
    output
  ])
  console.log(`生成 ${index + 1}/${experiment.slots.length} ${slot.slot_id}`)
})

console.log(`完成 ${experiment.slots.length} 个首帧封面`)
