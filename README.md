# AI 图片生成器

基于 React 的 AI 图片生成网站，支持自定义 LLM 服务商配置。

## 功能特性

- 自定义 API URL、API Key 和模型名称
- 实时流式响应显示生成进度
- 支持多阶段图片生成（low/medium/high）
- 配置信息本地存储

## 安装依赖

```bash
npm install
```

## 运行开发服务器

```bash
npm run dev
```

## 构建生产版本

```bash
npm run build
```

## 使用说明

1. 填写 API 配置信息（URL、Key、模型名称）
2. 输入图片描述提示词
3. 点击"生成图片"按钮
4. 等待图片生成完成

配置信息会自动保存到浏览器本地存储。
