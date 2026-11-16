import fs from "node:fs/promises"
import path from "node:path"
import vm from "node:vm"
import { FileBlob, SpreadsheetFile, Workbook } from "@oai/artifact-tool"
import { fileURLToPath } from "node:url"

const outputDir = new URL("../outputs/", import.meta.url)
const pathContext = { window: {} }
vm.runInNewContext(
  await fs.readFile(new URL("../data/video-paths.js", import.meta.url), "utf8"),
  pathContext,
  { filename: "video-paths.js" }
)
vm.runInNewContext(
  await fs.readFile(new URL("../data/experiment-spec.js", import.meta.url), "utf8"),
  pathContext,
  { filename: "experiment-spec.js" }
)
const videoPaths = pathContext.window.PERCEPTION_VIDEO_PATHS || {}
const experiment = pathContext.window.PERCEPTION_EXPERIMENT
const fontFamily = "Arial"
const groups = experiment.groups.map((group) => ({
  id: group.id,
  condition: group.condition_label,
  members: group.members.map((member) => ({ id: member.id, name: member.admin_label }))
}))

function twoDigits(value) {
  return String(value).padStart(2, "0")
}

function questionIds(groupId, start, end) {
  return Array.from({ length: end - start + 1 }, (_, index) => {
    return `${groupId}-Q${twoDigits(start + index)}`
  }).join(", ")
}

const rows = []
groups.forEach((group) => {
  group.members.forEach((member, memberIndex) => {
    const referenceQuestions = memberIndex === 0
      ? questionIds(group.id, 1, 5)
      : questionIds(group.id, 6, 10)

    for (let index = 1; index <= 3; index += 1) {
      rows.push([
        `${group.id}-${member.id.toUpperCase()}-REF-${twoDigits(index)}`,
        group.id,
        group.condition,
        member.id,
        member.name,
        "参考视频",
        index,
        referenceQuestions,
        "只作为参考，不得作为候选",
        "",
        "",
        "",
        ""
      ])
    }

    for (let index = 1; index <= 10; index += 1) {
      rows.push([
        `${group.id}-${member.id.toUpperCase()}-CAND-${twoDigits(index)}`,
        group.id,
        group.condition,
        member.id,
        member.name,
        "候选视频",
        index,
        `${group.id}-Q${twoDigits(index)}`,
        "同组候选不得重复",
        "",
        "",
        "",
        ""
      ])
    }
  })
})

const firstDataRow = 5
const lastDataRow = firstDataRow + rows.length - 1
const tableRange = `A4:M${lastDataRow}`
const dataRange = `A${firstDataRow}:M${lastDataRow}`
const statusRange = `L${firstDataRow}:L${lastDataRow}`

rows.forEach((row) => {
  const videoPath = videoPaths[row[0]] || ""
  row[9] = videoPath
  row[10] = videoPath ? path.basename(videoPath) : ""
})

const workbook = Workbook.create()
const sheet = workbook.worksheets.add("视频站位")
sheet.showGridLines = false
sheet.tabColor = "#1F4E78"

sheet.getRange("A1").values = [["实验一视频站位表"]]
sheet.getRange("A2").values = [[`当前五组实验站位，共 ${rows.length} 个，视频路径已填写`]]
sheet.getRange("A4:M4").values = [[
  "站位编号",
  "实验组",
  "后台条件",
  "人物编号",
  "人物名称",
  "用途",
  "序号",
  "对应题目",
  "使用规则",
  "视频路径",
  "源文件名",
  "填写状态",
  "备注"
]]
sheet.getRange(dataRange).values = rows
sheet.getRange("L5").formulas = [["=IF(J5=\"\",\"待填写\",\"已填写\")"]]
sheet.getRange(statusRange).fillDown()

sheet.getRange(`A1:M${lastDataRow}`).format.font = { name: fontFamily, size: 10, color: "#1F2937" }
sheet.getRange("A1").format.font = { name: fontFamily, size: 14, bold: true, color: "#1F2937" }
sheet.getRange("A2").format.font = { name: fontFamily, size: 10, italic: true, color: "#5B6271" }
sheet.getRange("A4:M4").format = {
  fill: "#1F4E78",
  font: { name: fontFamily, size: 10, bold: true, color: "#FFFFFF" },
  horizontalAlignment: "center",
  verticalAlignment: "center",
  wrapText: true,
  borders: { preset: "inside", style: "thin", color: "#FFFFFF" }
}
sheet.getRange(dataRange).format.verticalAlignment = "center"
sheet.getRange(`B${firstDataRow}:G${lastDataRow}`).format.horizontalAlignment = "center"
sheet.getRange(statusRange).format.horizontalAlignment = "center"
sheet.getRange(`J${firstDataRow}:J${lastDataRow}`).format.fill = "#FFF2CC"
sheet.getRange(`J${firstDataRow}:J${lastDataRow}`).format.font = { name: fontFamily, size: 10, color: "#7F6000" }
sheet.getRange(`K${firstDataRow}:K${lastDataRow}`).format.fill = "#FFF9E6"
sheet.getRange(`M${firstDataRow}:M${lastDataRow}`).format.fill = "#FFF9E6"
sheet.getRange(tableRange).format.borders = {
  insideHorizontal: { style: "thin", color: "#E5E7EB" },
  bottom: { style: "thin", color: "#9CA3AF" }
}

sheet.getRange(statusRange).conditionalFormats.add("containsText", {
  text: "待填写",
  format: { fill: "#FDECEC", font: { bold: true, color: "#B42318" } }
})
sheet.getRange(statusRange).conditionalFormats.add("containsText", {
  text: "已填写",
  format: { fill: "#E7F6EC", font: { bold: true, color: "#067647" } }
})

sheet.getRange("A1").format.rowHeight = 24
sheet.getRange("A2").format.rowHeight = 20
sheet.getRange(tableRange).format.rowHeight = 22
sheet.getRange("A:A").format.columnWidth = 28
sheet.getRange("B:B").format.columnWidth = 9
sheet.getRange("C:C").format.columnWidth = 15
sheet.getRange("D:D").format.columnWidth = 13
sheet.getRange("E:E").format.columnWidth = 14
sheet.getRange("F:F").format.columnWidth = 12
sheet.getRange("G:G").format.columnWidth = 8
sheet.getRange("H:H").format.columnWidth = 44
sheet.getRange("I:I").format.columnWidth = 25
sheet.getRange("J:J").format.columnWidth = 48
sheet.getRange("K:K").format.columnWidth = 28
sheet.getRange("L:L").format.columnWidth = 12
sheet.getRange("M:M").format.columnWidth = 28

sheet.tables.add(tableRange, true, "VideoSlotsTable").style = "TableStyleMedium2"
sheet.freezePanes.freezeRows(4)

workbook.recalculate()

const preview = await workbook.render({
  sheetName: "视频站位",
  range: "A1:M24",
  scale: 1,
  format: "png"
})
await fs.mkdir(outputDir, { recursive: true })
await fs.writeFile(new URL("video_slots_preview.png", outputDir), new Uint8Array(await preview.arrayBuffer()))

const inspect = await workbook.inspect({
  kind: "table",
  range: "视频站位!A1:M12",
  include: "values,formulas",
  tableMaxRows: 12,
  tableMaxCols: 13,
  maxChars: 5000
})
console.log(inspect.ndjson)

const errors = await workbook.inspect({
  kind: "match",
  searchTerm: "#REF!|#DIV/0!|#VALUE!|#NAME\\?|#N/A|#NUM!|#NULL!|#SPILL!|#CALC!",
  options: { useRegex: true, maxResults: 100 },
  summary: "final formula error scan"
})
console.log(errors.ndjson)

const output = await SpreadsheetFile.exportXlsx(workbook)
const outputPath = fileURLToPath(new URL("video_slots.xlsx", outputDir))
await output.save(outputPath)

const savedWorkbook = await SpreadsheetFile.importXlsx(await FileBlob.load(outputPath))
const savedCheck = await savedWorkbook.inspect({
  kind: "table",
  range: `视频站位!A${lastDataRow - 4}:M${lastDataRow}`,
  include: "values,formulas",
  tableMaxRows: 5,
  tableMaxCols: 13,
  maxChars: 4000
})
console.log(savedCheck.ndjson)

console.log(JSON.stringify({ rows: rows.length, output: outputPath }))
