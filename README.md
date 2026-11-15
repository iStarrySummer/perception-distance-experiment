# 人物动作感知实验一

## 当前状态

- 六组实验页面结构已经完成
- 每组 10 道题，共 60 道
- 每组两个人物各作为 5 道题的参考目标
- 页面只向参与者显示实验组序号
- 六组共 156 个视频路径已经填写
- 156 个网站视频已经裁掉黑边并保留完整人物画面比例
- 156 个视频均已生成首帧封面，页面会提前加载当前题和后续 3 道题的视频
- 每道题的两个候选视频已经按较短视频统一帧数和时长

## 实验组

- `G1`：Sheldon 与 Leonard，后台条件为真人远距离
- `G2`：AI-4 与 AI-7，后台条件为 AI 短距离 1
- `G3`：AI-5 与 AI-6，后台条件为 AI 短距离 2
- `G4`：AI-4 与 AI-5，后台条件为 AI 短距离 3
- `G5`：Leonard 与 Howard，后台条件为真人远距离
- `G6`：Howard 与 Sheldon，后台条件为真人远距离

这些标签只写入导出数据，不显示给参与者

## 视频站位

- 每个人物需要 3 个参考视频
- 每个人物需要 10 个候选视频
- 每组需要 26 个视频站位
- 六组共需要 156 个视频站位
- 参考视频不能再次作为候选视频
- 候选视频在同一组内不能重复

站位编号格式

```text
组别-人物-用途-序号
```

示例

```text
G1-SHELDON-REF-01
G1-SHELDON-CAND-01
```

## 路径接入

原始路径与处理后路径统一写入 `data/video-paths.js`

```javascript
window.PERCEPTION_SOURCE_VIDEO_PATHS = {
  "G1-SHELDON-REF-01": "videos/g1/sheldon/reference_01.mp4"
}
```

页面结构和题目规则不需要随路径修改

## 预览网站

直接打开 `index.html` 可以查看正式实验

正式实验支持

- 六组顺序随机
- 每组题目顺序随机
- A、B 位置随机且总计左右各 30 次
- 选择动画
- 重新选择
- 下一题
- 断点恢复
- CSV 导出
- 完成后自动保存 CSV 到云端
- 自动去重与失败重试

## 数据后台

管理员页面位于 `admin.html`

- 显示已经收到的完整实验份数
- 显示匿名编号、完成时间和文件大小
- 支持逐份下载 CSV
- 管理员密钥仅保存在云端运行环境，不写入公开网页

## 站位检查

```bash
node tools/validate_slots.mjs --allow-empty
```

Parameters

- `tools/validate_slots.mjs`：检查实验组、题目、站位、人物和候选关系
- `--allow-empty`：页面搭建阶段允许路径为空

路径填写完成后运行

```bash
node tools/validate_slots.mjs
```

不带 `--allow-empty` 时，空路径或不存在的视频文件会导致检查失败

## 视频处理

```bash
node tools/process_videos.mjs --force
```

Parameters

- `tools/process_videos.mjs`：逐段检测黑边、裁剪画面并验证输出
- `--force`：重新生成已有的处理后视频

处理结果保存在 `videos/processed`，视频使用裁剪后的真实纵横比并显示完整画面，原始视频不会被修改

## 首帧封面

```bash
node tools/generate_posters.mjs
```

Parameters

- `tools/generate_posters.mjs`：为每个处理后视频生成首帧封面，减少页面切换时出现黑色加载画面

首帧封面保存在 `videos/posters`，不会修改视频文件
