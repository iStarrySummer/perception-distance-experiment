window.PERCEPTION_SOURCE_VIDEO_PATHS = {}
window.PERCEPTION_SOURCE_VIDEO_DIRECTIONS = {}

function inferredDirection(filename) {
  var direction = String(filename).split("_")[0]
  return ["left", "front", "right"].indexOf(direction) >= 0 ? direction : ""
}

function registerMemberVideos(groupId, memberCode, personDirectory, referenceFiles, candidateFiles, directions) {
  var referenceDirections = directions && directions.reference || []
  var candidateDirections = directions && directions.candidate || []
  referenceFiles.forEach(function (filename, index) {
    var slotId = groupId + "-" + memberCode + "-REF-" + String(index + 1).padStart(2, "0")
    window.PERCEPTION_SOURCE_VIDEO_PATHS[slotId] = "videos/source/" + personDirectory + "/reference_gt/" + filename
    window.PERCEPTION_SOURCE_VIDEO_DIRECTIONS[slotId] = referenceDirections[index] || inferredDirection(filename)
  })
  candidateFiles.forEach(function (filename, index) {
    var slotId = groupId + "-" + memberCode + "-CAND-" + String(index + 1).padStart(2, "0")
    window.PERCEPTION_SOURCE_VIDEO_PATHS[slotId] = "videos/source/" + personDirectory + "/candidate_faceswap/" + filename
    window.PERCEPTION_SOURCE_VIDEO_DIRECTIONS[slotId] = candidateDirections[index] || inferredDirection(filename)
  })
}

function reuseMemberVideos(targetGroup, targetMember, sourceGroup, sourceMember) {
  var sourcePrefix = sourceGroup + "-" + sourceMember + "-"
  var targetPrefix = targetGroup + "-" + targetMember + "-"
  Object.keys(window.PERCEPTION_SOURCE_VIDEO_PATHS).forEach(function (slotId) {
    if (slotId.indexOf(sourcePrefix) !== 0) return
    var targetId = targetPrefix + slotId.slice(sourcePrefix.length)
    window.PERCEPTION_SOURCE_VIDEO_PATHS[targetId] = window.PERCEPTION_SOURCE_VIDEO_PATHS[slotId]
    window.PERCEPTION_SOURCE_VIDEO_DIRECTIONS[targetId] = window.PERCEPTION_SOURCE_VIDEO_DIRECTIONS[slotId]
  })
}

registerMemberVideos("G1", "SHELDON", "Sheldon", [
  "left__S2E16_152.mp4",
  "front__S1E15_451.mp4",
  "right__S5E17_115.mp4"
], [
  "front_01__S6E18_284.mp4",
  "front_02__S3E3_104.mp4",
  "front_03__S9E13_379.mp4",
  "front_04__S7E8_349.mp4",
  "left_01__S2E11_207.mp4",
  "left_02__S10E24_1.mp4",
  "left_03__S5E13_359.mp4",
  "right_01__S1E13_47.mp4",
  "right_02__S6E2_395.mp4",
  "right_03__S7E5_280.mp4"
])

registerMemberVideos("G1", "LEONARD", "Leonard", [
  "left__S3E18_305.mp4",
  "front__S2E22_278.mp4",
  "right__S8E20_296.mp4"
], [
  "front_01__S7E21_438.mp4",
  "front_02__S2E6_2.mp4",
  "front_03__S4E4_118.mp4",
  "front_04__S1E1_133.mp4",
  "left_01__S3E11_35.mp4",
  "left_02__S1E5_365.mp4",
  "left_03__S1E6_603.mp4",
  "right_01__S8E17_49.mp4",
  "right_02__S2E10_227.mp4",
  "right_03__S6E3_290.mp4"
])

registerMemberVideos("G2", "HOWARD", "Howard", [
  "left__S3E23_187.mp4",
  "front__S8E18_35.mp4",
  "right__S8E3_185.mp4"
], [
  "front_01__S6E8_292.mp4",
  "front_02__S6E18_324.mp4",
  "front_03__S8E17_156.mp4",
  "front_04__S8E16_323.mp4",
  "left_01__S7E12_176.mp4",
  "left_02__S7E10_356.mp4",
  "left_03__S3E17_184.mp4",
  "right_01__S7E23_54.mp4",
  "right_02__S8E15_135.mp4",
  "right_03__S8E2_332.mp4"
])

registerMemberVideos("G4", "AI1", "AI-1", [
  "left__target4349_s00105346_e00105412.mp4",
  "front__target4349_s00214518_e00214667.mp4",
  "right__target4349_s00009114_e00009221.mp4"
], [
  "front_01__target4349_s00116354_e00116472.mp4",
  "front_02__target4349_s00080283_e00080363.mp4",
  "front_03__target4349_s00106065_e00106135.mp4",
  "front_04__target4349_s00037584_e00037651.mp4",
  "left_01__target4349_s00030516_e00030569.mp4",
  "left_02__target4349_s00073281_e00073333.mp4",
  "left_03__target4349_s00006577_e00006624.mp4",
  "right_01__target4349_s00026202_e00026300.mp4",
  "right_02__target4349_s00006940_e00006994.mp4",
  "right_03__target4349_s00097618_e00097667.mp4"
])

registerMemberVideos("G4", "AI3", "AI-3", [
  "left__ref01_s00098277_e00098406.mp4",
  "front__ref01_s00111135_e00111314.mp4",
  "right__ref01_s00179586_e00179723.mp4"
], [
  "front_01__ref01_s00128083_e00128261.mp4",
  "front_02__ref01_s00138310_e00138467.mp4",
  "front_03__ref01_s00067952_e00068101.mp4",
  "front_04__ref01_s00014746_e00014895.mp4",
  "left_01__ref01_s00059169_e00059295.mp4",
  "left_02__ref01_s00099963_e00100085.mp4",
  "left_03__ref01_s00172302_e00172409.mp4",
  "right_01__ref01_s00175420_e00175521.mp4",
  "right_02__ref01_s00068235_e00068328.mp4",
  "right_03__ref01_s00118979_e00119065.mp4"
])

registerMemberVideos("G5", "AI4", "AI-4", [
  "left__c10_ref01_s00000675_e00000769.mp4",
  "front__c10_ref01_s00088187_e00088293.mp4",
  "right__c10_ref01_s00081940_e00082063.mp4"
], [
  "front_01__c10_ref01_s00088436_e00088520.mp4",
  "front_02__c10_ref01_s00087950_e00088010.mp4",
  "front_03__c10_ref01_s00040943_e00040998.mp4",
  "front_04__c10_ref01_s00088540_e00088592.mp4",
  "left_01__c10_ref01_s00033490_e00033564.mp4",
  "left_02__c10_ref01_s00000999_e00001055.mp4",
  "left_03__c10_ref01_s00043266_e00043315.mp4",
  "right_01__c10_ref01_s00082108_e00082211.mp4",
  "right_02__c10_ref01_s00082568_e00082630.mp4",
  "right_03__c10_ref01_s00042825_e00042872.mp4"
])

registerMemberVideos("G5", "AI6", "AI-6", [
  "c10_jFdt_ref01_s00032017_e00032127.mp4",
  "c10_jFdt_ref01_s00064016_e00064103.mp4",
  "c10_jFdt_ref01_s00198870_e00199015.mp4"
], [
  "c10_jFdt_ref01_s00058149_e00058222.mp4",
  "c10_jFdt_ref01_s00015404_e00015451.mp4",
  "c10_jFdt_ref01_s00070049_e00070088.mp4",
  "c10_jFdt_ref01_s00031952_e00031987.mp4",
  "c10_jFdt_ref01_s00017560_e00017644.mp4",
  "c10_jFdt_ref01_s00064375_e00064430.mp4",
  "c10_jFdt_ref01_s00062449_e00062482.mp4",
  "c10_jFdt_ref01_s00063139_e00063189.mp4",
  "c10_jFdt_ref01_s00067952_e00067997.mp4",
  "c10_jFdt_ref01_s00107531_e00107564.mp4"
], {
  reference: ["left", "front", "right"],
  candidate: ["front", "front", "front", "front", "left", "left", "left", "right", "right", "right"]
})

registerMemberVideos("G6", "AI5", "AI-5", [
  "c10_ref02_s00056417_e00056537.mp4",
  "c10_ref02_s00013672_e00013797.mp4",
  "c10_ref02_s00034532_e00034676.mp4"
], [
  "c10_ref02_s00018627_e00018730.mp4",
  "c10_ref02_s00018260_e00018349.mp4",
  "c10_ref02_s00083918_e00084005.mp4",
  "c10_ref02_s00045469_e00045545.mp4",
  "c10_ref02_s00057161_e00057215.mp4",
  "c10_ref02_s00086291_e00086329.mp4",
  "c10_ref02_s00041548_e00041582.mp4",
  "c10_ref02_s00027685_e00027768.mp4",
  "c10_ref02_s00068349_e00068398.mp4",
  "c10_ref02_s00069816_e00069848.mp4"
], {
  reference: ["left", "front", "right"],
  candidate: ["front", "front", "front", "front", "left", "left", "left", "right", "right", "right"]
})

registerMemberVideos("G6", "AI7", "AI-7", [
  "left__c10_jFdt_ref02_s00074496_e00074568.mp4",
  "front__c10_jFdt_ref02_s00186188_e00186318.mp4",
  "right__c10_jFdt_ref02_s00021640_e00021763.mp4"
], [
  "front_01__c10_jFdt_ref02_s00029958_e00030070.mp4",
  "front_02__c10_jFdt_ref02_s00044401_e00044498.mp4",
  "front_03__c10_jFdt_ref02_s00098912_e00098989.mp4",
  "front_04__c10_jFdt_ref02_s00151319_e00151395.mp4",
  "left_01__c10_jFdt_ref02_s00170116_e00170185.mp4",
  "left_02__c10_jFdt_ref02_s00093298_e00093365.mp4",
  "left_03__c10_jFdt_ref02_s00077875_e00077931.mp4",
  "right_01__c10_jFdt_ref02_s00135165_e00135269.mp4",
  "right_02__c10_jFdt_ref02_s00110011_e00110077.mp4",
  "right_03__c10_jFdt_ref02_s00088481_e00088541.mp4"
])

reuseMemberVideos("G2", "LEONARD", "G1", "LEONARD")
reuseMemberVideos("G3", "HOWARD", "G2", "HOWARD")
reuseMemberVideos("G3", "SHELDON", "G1", "SHELDON")

window.PERCEPTION_VIDEO_PATHS = {}
Object.keys(window.PERCEPTION_SOURCE_VIDEO_PATHS).forEach(function (slotId) {
  window.PERCEPTION_VIDEO_PATHS[slotId] = "videos/processed/" + slotId.toLowerCase() + ".mp4"
})
