import fs from "node:fs/promises"
import path from "node:path"
import vm from "node:vm"
import { spawn } from "node:child_process"
import { fileURLToPath } from "node:url"

const toolDir = path.dirname(fileURLToPath(import.meta.url))
const siteDir = path.resolve(toolDir, "..")
const outputDir = path.join(siteDir, "videos", "processed")
const reportPath = path.join(siteDir, "outputs", "processed-video-report.json")
const force = process.argv.includes("--force")
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

const sourcePaths = context.window.PERCEPTION_SOURCE_VIDEO_PATHS
const experiment = context.window.PERCEPTION_EXPERIMENT

if (!sourcePaths || Object.keys(sourcePaths).length !== experiment.slots.length) {
  throw new Error(`原始视频路径数量不是 ${experiment.slots.length}`)
}

function run(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd: siteDir })
    let stdout = ""
    let stderr = ""
    child.stdout.on("data", (chunk) => { stdout += chunk })
    child.stderr.on("data", (chunk) => { stderr += chunk })
    child.on("error", reject)
    child.on("close", (code) => {
      if (code === 0) resolve({ stdout, stderr })
      else reject(new Error(`${command} 退出码 ${code}\n${stderr.slice(-2000)}`))
    })
  })
}

function frameRate(value) {
  const parts = String(value || "0/1").split("/").map(Number)
  return parts[1] ? parts[0] / parts[1] : 0
}

async function probe(filePath) {
  const result = await run("ffprobe", [
    "-v", "error",
    "-select_streams", "v:0",
    "-count_frames",
    "-show_entries", "stream=width,height,avg_frame_rate,nb_read_frames,duration",
    "-of", "json",
    filePath
  ])
  const stream = JSON.parse(result.stdout).streams?.[0]
  if (!stream) throw new Error(`无法读取视频 ${filePath}`)
  const fps = frameRate(stream.avg_frame_rate)
  const frames = Number(stream.nb_read_frames)
  if (!fps || !frames) throw new Error(`无法读取帧率或帧数 ${filePath}`)
  return {
    width: Number(stream.width),
    height: Number(stream.height),
    fps,
    frames,
    last_frame_end_seconds: Number((frames / fps).toFixed(6))
  }
}

async function detectCrop(filePath) {
  const result = await run("ffmpeg", [
    "-hide_banner", "-i", filePath,
    "-vf", "cropdetect=20:2:0",
    "-an", "-f", "null", "-"
  ])
  const matches = Array.from(result.stderr.matchAll(/crop=(\d+):(\d+):(\d+):(\d+)/g), (match) => match.slice(1).map(Number))
  if (!matches.length) throw new Error(`没有检测到有效画面 ${filePath}`)
  const counts = new Map()
  matches.forEach((crop) => {
    const key = crop.join(":")
    counts.set(key, (counts.get(key) || 0) + 1)
  })
  const selected = Array.from(counts.entries()).sort((a, b) => b[1] - a[1])[0][0]
  return selected.split(":").map(Number)
}

async function mapLimit(items, limit, worker) {
  const results = new Array(items.length)
  let cursor = 0
  async function next() {
    while (cursor < items.length) {
      const index = cursor
      cursor += 1
      results[index] = await worker(items[index], index)
    }
  }
  await Promise.all(Array.from({ length: limit }, next))
  return results
}

const entries = Object.entries(sourcePaths).map(([slotId, relativePath]) => ({
  slot_id: slotId,
  source_relative_path: relativePath,
  source_absolute_path: path.resolve(siteDir, relativePath),
  output_relative_path: `videos/processed/${slotId.toLowerCase()}.mp4`,
  output_absolute_path: path.join(outputDir, `${slotId.toLowerCase()}.mp4`)
}))

console.log(`分析原始视频 ${entries.length} 段`)
const sourceInfo = await mapLimit(entries, 4, async (entry, index) => {
  const [probeInfo, crop] = await Promise.all([
    probe(entry.source_absolute_path),
    detectCrop(entry.source_absolute_path)
  ])
  console.log(`分析 ${index + 1}/${entries.length} ${entry.slot_id}`)
  return { ...entry, source: probeInfo, crop }
})

const sourceById = new Map(sourceInfo.map((entry) => [entry.slot_id, entry]))
const targetDurations = new Map()
const pairRecords = []

experiment.groups.forEach((group) => {
  group.questions.forEach((question) => {
    const ids = question.candidate_slots.map((slot) => slot.slot_id)
    const sources = ids.map((id) => sourceById.get(id).source)
    const targetDuration = Math.min(...sources.map((source) => source.last_frame_end_seconds))
    const targetFrames = Math.round(targetDuration * 25)
    ids.forEach((id) => targetDurations.set(id, targetDuration))
    pairRecords.push({
      question_id: question.id,
      candidate_slots: ids,
      source_frames: sources.map((source) => source.frames),
      source_frame_rates: sources.map((source) => source.fps),
      source_durations_seconds: sources.map((source) => source.last_frame_end_seconds),
      target_frames: targetFrames,
      target_duration_seconds: Number(targetDuration.toFixed(6))
    })
  })
})

await fs.mkdir(outputDir, { recursive: true })
console.log(`生成处理后视频 ${sourceInfo.length} 段`)

await mapLimit(sourceInfo, 4, async (entry, index) => {
  if (!force) {
    try {
      await fs.access(entry.output_absolute_path)
      console.log(`跳过 ${index + 1}/${sourceInfo.length} ${entry.slot_id}`)
      return
    } catch (error) {}
  }

  const [cropWidth, cropHeight, cropX, cropY] = entry.crop
  const filters = [
    `crop=${cropWidth}:${cropHeight}:${cropX}:${cropY}`,
    "setsar=1"
  ]
  const trimDuration = targetDurations.get(entry.slot_id)
  if (trimDuration) filters.push(`trim=end=${trimDuration}`)
  filters.push("setpts=PTS-STARTPTS", "fps=25")

  await run("ffmpeg", [
    "-y", "-hide_banner", "-loglevel", "error",
    "-i", entry.source_absolute_path,
    "-an",
    "-vf", filters.join(","),
    "-c:v", "libx264",
    "-preset", "medium",
    "-crf", "18",
    "-pix_fmt", "yuv420p",
    "-movflags", "+faststart",
    entry.output_absolute_path
  ])
  console.log(`生成 ${index + 1}/${sourceInfo.length} ${entry.slot_id}`)
})

console.log("验证处理结果")
const verified = await mapLimit(sourceInfo, 6, async (entry) => {
  const output = await probe(entry.output_absolute_path)
  const expectedDuration = targetDurations.get(entry.slot_id) || entry.source.last_frame_end_seconds
  const expectedFrames = Math.round(expectedDuration * 25)
  if (output.width !== entry.crop[0] || output.height !== entry.crop[1]) {
    throw new Error(`${entry.slot_id} 输出尺寸 ${output.width}×${output.height}，预期 ${entry.crop[0]}×${entry.crop[1]}`)
  }
  if (output.frames !== expectedFrames) throw new Error(`${entry.slot_id} 输出帧数 ${output.frames}，预期 ${expectedFrames}`)
  return {
    slot_id: entry.slot_id,
    source_relative_path: entry.source_relative_path,
    output_relative_path: entry.output_relative_path,
    crop: entry.crop.join(":"),
    source_frames: entry.source.frames,
    source_frame_rate: entry.source.fps,
    source_last_frame_end_seconds: entry.source.last_frame_end_seconds,
    output_frames: output.frames,
    output_duration_seconds: output.last_frame_end_seconds,
    width: output.width,
    height: output.height
  }
})

pairRecords.forEach((pair) => {
  const outputs = pair.candidate_slots.map((id) => verified.find((item) => item.slot_id === id))
  if (outputs[0].output_frames !== outputs[1].output_frames) {
    throw new Error(`${pair.question_id} 两个候选视频帧数不同`)
  }
})

await fs.mkdir(path.dirname(reportPath), { recursive: true })
await fs.writeFile(reportPath, JSON.stringify({
  generated_at: new Date().toISOString(),
  source_video_count: sourceInfo.length,
  output_video_count: verified.length,
  frame_rate: 25,
  output_size: "cropped-native",
  candidate_pairs: pairRecords,
  videos: verified
}, null, 2) + "\n")

console.log(`完成 ${verified.length} 段视频，候选配对 ${pairRecords.length} 组`)
console.log(`报告 ${reportPath}`)
