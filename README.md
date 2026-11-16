# 人物动作感知实验一

## 当前版本

- 实验版本：`perception-distance-e1-v12-ai-pairs-46-57`
- 6 组实验，每组 10 道题，共 60 道题
- 每组两个人物各作为 5 道题的参考目标
- 9 个人物各有 3 个未换脸 GT 参考视频和 10 个 GT 换脸候选视频
- 三个参考视频固定按左视角、正中视角、右视角排列
- 共 117 个不同原始视频、156 个实验站位
- 页面只向参与者显示实验组序号
- 每道题的两个候选视频按较短视频统一帧数和时长

## 实验组

- `G1`：Sheldon 与 Leonard，真人剧
- `G2`：Leonard 与 Howard，真人剧
- `G3`：Howard 与 Sheldon，真人剧
- `G4`：AI-1 与 AI-3，AI 剧
- `G5`：AI-4 与 AI-6，AI 剧
- `G6`：AI-5 与 AI-7，AI 剧

这些人物名称只写入导出数据，不显示给参与者

## 视频来源

原始素材来自

```text
/Users/a1/Desktop/projects/个性化/七人物_视频页面素材包/videos
/Users/a1/Desktop/projects/个性化/AI5_AI6_最终视频素材/videos
```

使用下列命令将 117 个原始视频复制到项目，并生成来源清单

```bash
node tools/import_five_group_sources.mjs
```

Parameters

- `tools/import_five_group_sources.mjs`：检查 9 个人物的视频数量，复制原始视频，生成 `data/source-video-manifest.json`
- `--source-root <path>`：可选，指定其他原始素材根目录
- `--supplement-root <path>`：可选，指定 AI-5 和 AI-6 素材根目录

项目副本位于 `videos/source`，不会修改或删除桌面原始素材

## 视频站位

- 每个人物有 3 个参考视频和 10 个候选视频
- 每组需要 26 个视频站位
- 6 组共 156 个视频站位
- 相同人物参与多组比较时复用同一批原始视频
- 同一组内参考视频不作为候选视频
- 同一组内候选视频不重复

站位编号格式

```text
组别-人物-用途-序号
```

例如

```text
G1-SHELDON-REF-01
G1-SHELDON-CAND-01
```

## 页面

- `index.html`：当前 6 组、60 题正式实验
- `admin.html`：云端数据后台
- `original-video-review.html`：查看当前 9 个人物各 13 个未裁剪原始视频
- `incorrect-video-review.html`：查看旧六组实验的 8 人重复结果

正式实验支持

- 6 组顺序随机
- 每组题目顺序随机
- A、B 位置随机，每组正确答案左右各 5 次
- 选择动画与重新选择
- 候选视频播放完成限制
- 断点恢复
- CSV 导出
- 完成后自动保存到云端
- 使用同一匿名编号重复完成实验

## 旧实验归档

旧版 `perception-distance-e1-v9` 配置、8 人统计和处理报告保存在

```text
data/archive/perception-distance-e1-v9/
```

旧数据的人物组合与当前版本不同，应按实验版本号分开统计

## 站位检查

```bash
node tools/validate_slots.mjs
```

Parameters

- `tools/validate_slots.mjs`：检查 6 组、60 道题、156 个站位、视频文件和首帧封面

## 视频处理

```bash
node tools/process_videos.mjs --force
```

Parameters

- `tools/process_videos.mjs`：检测黑边、裁剪画面、统一候选视频帧数并验证输出
- `--force`：重新生成已有的站位视频

处理结果保存在 `videos/processed`，原始视频不会被修改

## 首帧封面

```bash
node tools/generate_posters.mjs
```

Parameters

- `tools/generate_posters.mjs`：为当前 156 个处理后视频生成首帧封面

首帧封面保存在 `videos/posters`
