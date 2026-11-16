(function () {
  "use strict"

  var paths = window.PERCEPTION_VIDEO_PATHS || {}
  var groupDefinitions = [
    {
      id: "G1",
      participant_label: "第 1 组",
      condition: "real_pair",
      condition_label: "真人剧",
      members: [
        { id: "sheldon", admin_label: "Sheldon" },
        { id: "leonard", admin_label: "Leonard" }
      ]
    },
    {
      id: "G2",
      participant_label: "第 2 组",
      condition: "real_pair",
      condition_label: "真人剧",
      members: [
        { id: "leonard", admin_label: "Leonard" },
        { id: "howard", admin_label: "Howard" }
      ]
    },
    {
      id: "G3",
      participant_label: "第 3 组",
      condition: "real_pair",
      condition_label: "真人剧",
      members: [
        { id: "howard", admin_label: "Howard" },
        { id: "sheldon", admin_label: "Sheldon" }
      ]
    },
    {
      id: "G4",
      participant_label: "第 4 组",
      condition: "ai_pair_1_3",
      condition_label: "AI 剧",
      members: [
        { id: "ai1", admin_label: "AI-1" },
        { id: "ai3", admin_label: "AI-3" }
      ]
    },
    {
      id: "G5",
      participant_label: "第 5 组",
      condition: "ai_pair_4_7",
      condition_label: "AI 剧",
      members: [
        { id: "ai4", admin_label: "AI-4" },
        { id: "ai7", admin_label: "AI-7" }
      ]
    }
  ]

  function slotId(groupId, memberId, role, index) {
    return [groupId, memberId.toUpperCase(), role, String(index).padStart(2, "0")].join("-")
  }

  function slot(group, member, role, index) {
    var id = slotId(group.id, member.id, role, index)
    return {
      slot_id: id,
      group_id: group.id,
      member_id: member.id,
      member_admin_label: member.admin_label,
      role: role === "REF" ? "reference" : "candidate",
      slot_index: index,
      path: paths[id] || ""
    }
  }

  function buildGroup(definition) {
    var references = {}
    var candidates = {}
    definition.members.forEach(function (member) {
      references[member.id] = Array.from({ length: 3 }, function (_, index) {
        return slot(definition, member, "REF", index + 1)
      })
      candidates[member.id] = Array.from({ length: 10 }, function (_, index) {
        return slot(definition, member, "CAND", index + 1)
      })
    })

    var questions = Array.from({ length: 10 }, function (_, index) {
      var number = index + 1
      var target = number <= 5 ? definition.members[0] : definition.members[1]
      return {
        id: definition.id + "-Q" + String(number).padStart(2, "0"),
        group_id: definition.id,
        base_order: number,
        target_member_id: target.id,
        target_admin_label: target.admin_label,
        reference_slots: references[target.id],
        candidate_slots: [
          candidates[definition.members[0].id][index],
          candidates[definition.members[1].id][index]
        ]
      }
    })

    return {
      id: definition.id,
      participant_label: definition.participant_label,
      condition: definition.condition,
      condition_label: definition.condition_label,
      members: definition.members,
      references: references,
      candidates: candidates,
      questions: questions
    }
  }

  var groups = groupDefinitions.map(buildGroup)
  var allSlots = []
  groups.forEach(function (group) {
    group.members.forEach(function (member) {
      allSlots = allSlots.concat(group.references[member.id], group.candidates[member.id])
    })
  })

  window.PERCEPTION_EXPERIMENT = {
    schema_version: 1,
    seed: 20261116,
    fingerprint: "perception-distance-e1-v11-left-center-right",
    preview_mode: false,
    ready: allSlots.every(function (item) { return Boolean(item.path) }),
    groups: groups,
    slots: allSlots,
    totals: {
      groups: groups.length,
      questions: groups.reduce(function (total, group) { return total + group.questions.length }, 0),
      slots: allSlots.length,
      missing_paths: allSlots.filter(function (item) { return !item.path }).length
    }
  }
}())
