import fs from "node:fs/promises"
import path from "node:path"

function parseCsv(text) {
  const rows = []
  let row = []
  let field = ""
  let quoted = false
  const source = text.replace(/^\ufeff/, "")

  for (let index = 0; index < source.length; index += 1) {
    const character = source[index]
    if (quoted) {
      if (character === '"' && source[index + 1] === '"') {
        field += '"'
        index += 1
      } else if (character === '"') {
        quoted = false
      } else {
        field += character
      }
    } else if (character === '"') {
      quoted = true
    } else if (character === ",") {
      row.push(field)
      field = ""
    } else if (character === "\n") {
      row.push(field.replace(/\r$/, ""))
      rows.push(row)
      row = []
      field = ""
    } else {
      field += character
    }
  }
  if (field || row.length) {
    row.push(field.replace(/\r$/, ""))
    rows.push(row)
  }

  const headers = rows.shift() || []
  return rows.filter((values) => values.some(Boolean)).map((values) => Object.fromEntries(
    headers.map((header, index) => [header, values[index] || ""])
  ))
}

function usage() {
  console.error("Usage: node tools/build_incorrect_video_stats.mjs --output data/incorrect-video-stats.js [--question-count 50] input1.csv ...")
  process.exit(2)
}

const args = process.argv.slice(2)
const outputIndex = args.indexOf("--output")
if (outputIndex === -1 || !args[outputIndex + 1]) usage()
const outputPath = path.resolve(args[outputIndex + 1])
const questionCountIndex = args.indexOf("--question-count")
const expectedQuestionCount = questionCountIndex >= 0 ? Number(args[questionCountIndex + 1]) : null
if (questionCountIndex >= 0 && (!Number.isInteger(expectedQuestionCount) || expectedQuestionCount < 1)) usage()
const excludedIndexes = new Set([outputIndex, outputIndex + 1])
if (questionCountIndex >= 0) {
  excludedIndexes.add(questionCountIndex)
  excludedIndexes.add(questionCountIndex + 1)
}
const inputPaths = args.filter((_, index) => !excludedIndexes.has(index)).map((value) => path.resolve(value))
if (!inputPaths.length) usage()

const questionStats = new Map()
const participantStats = []
const groupStats = new Map()

for (const inputPath of inputPaths) {
  const records = parseCsv(await fs.readFile(inputPath, "utf8"))
  if (expectedQuestionCount && records.length !== expectedQuestionCount) {
    throw new Error(`${inputPath} 不是 ${expectedQuestionCount} 道题`)
  }
  const participantIds = new Set(records.map((record) => record.anonymous_participant_id))
  if (participantIds.size !== 1) throw new Error(`${inputPath} 参与者编号不唯一`)
  const participantId = Array.from(participantIds)[0]
  const correct = records.filter((record) => record.is_correct === "true").length
  participantStats.push({ participant_id: participantId, correct, incorrect: records.length - correct, total: records.length })

  records.forEach((record) => {
    if (!questionStats.has(record.question_id)) {
      questionStats.set(record.question_id, {
        question_id: record.question_id,
        group_id: record.group_id,
        pair_member_1: record.pair_member_1,
        pair_member_2: record.pair_member_2,
        target_member: record.target_member,
        correct: 0,
        incorrect: 0,
        total: 0
      })
    }
    const item = questionStats.get(record.question_id)
    item.total += 1
    if (record.is_correct === "true") item.correct += 1
    else item.incorrect += 1

    if (!groupStats.has(record.group_id)) {
      groupStats.set(record.group_id, {
        group_id: record.group_id,
        pair_member_1: record.pair_member_1,
        pair_member_2: record.pair_member_2,
        correct: 0,
        incorrect: 0,
        total: 0
      })
    }
    const group = groupStats.get(record.group_id)
    group.total += 1
    if (record.is_correct === "true") group.correct += 1
    else group.incorrect += 1
  })
}

const questions = Array.from(questionStats.values()).sort((left, right) => {
  if (right.incorrect !== left.incorrect) return right.incorrect - left.incorrect
  return left.question_id.localeCompare(right.question_id)
})
const groups = Array.from(groupStats.values()).sort((left, right) => left.group_id.localeCompare(right.group_id))
const totalErrors = questions.reduce((total, item) => total + item.incorrect, 0)
const payload = {
  generated_at: new Date().toISOString(),
  participant_count: inputPaths.length,
  response_count: questions.reduce((total, item) => total + item.total, 0),
  question_count: questions.length,
  incorrect_question_count: questions.filter((item) => item.incorrect > 0).length,
  total_incorrect: totalErrors,
  participants: participantStats.sort((left, right) => left.participant_id.localeCompare(right.participant_id)),
  groups,
  questions
}

await fs.mkdir(path.dirname(outputPath), { recursive: true })
await fs.writeFile(outputPath, `window.PERCEPTION_INCORRECT_STATS = ${JSON.stringify(payload, null, 2)}\n`, "utf8")
console.log(`参与者 ${payload.participant_count}`)
console.log(`题目 ${payload.question_count}`)
console.log(`有错题目 ${payload.incorrect_question_count}`)
console.log(`错误记录 ${payload.total_incorrect}`)
console.log(`输出 ${outputPath}`)
