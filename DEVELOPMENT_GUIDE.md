# InkSpire 开发规范与最佳实践指南

本指南总结了 InkSpire 项目开发过程中的核心心得，旨在为后续类似 AI 驱动的 Web 应用提供可复用的技术架构与设计规范。

## 1. 核心设计原则 (Core Principles)

### 1.1 隐私优先 (Privacy First)
*   **本地存储**：优先使用 `IndexedDB` (通过 `Dexie.js`) 存储用户创作内容，而非云端数据库。这确保了数据的私密性、极低的延迟以及离线工作的能力。
*   **API 密钥管理**：支持用户提供自己的 Gemini API Key，并存储在本地，避免服务器中转风险。

### 1.2 沉浸式体验 (Immersive UX)
*   **无感加载**：使用 `motion/react` (Framer Motion) 处理页面切换和元素入场动画，消除 Web 应用的“生硬感”。
*   **即时反馈 (Immediate Feedback)**：在 AI 生成内容或图片时，必须立即显示占位符（如 Skeleton 骨架屏或 Loading 蒙层），避免用户产生“应用卡死”的错觉。
*   **非阻塞反馈**：严禁使用原生 `alert()` 或 `confirm()`。统一使用 `sonner` (Toast) 提供操作反馈，使用自定义 `ConfirmModal` 处理二次确认。
*   **深色模式**：原生支持 `dark` 模式，并遵循系统偏好。

## 2. 技术栈规范 (Tech Stack)

*   **框架**：React 18+ (Vite)
*   **状态管理**：Zustand (轻量、易于持久化)
*   **样式**：Tailwind CSS (原子化 CSS，配合 `@theme` 变量)
*   **图标**：Lucide React (统一的线条风格)
*   **动画**：Motion (原 Framer Motion)
*   **国际化**：i18next (支持多语言动态切换)

## 3. AI 集成模式 (AI Integration Patterns)

### 3.1 结构化生成 (Structured Generation)
*   **分步引导**：不要尝试一次性生成整本书。采用 `创意 -> 方案 -> 大纲 -> 内容` 的渐进式流程，提高生成质量和用户控制感。
*   **JSON 响应**：利用 Gemini API 的 `responseMimeType: "application/json"` 和 `responseSchema` 强制模型输出结构化数据，确保前端解析的稳定性。

### 3.2 交互式协作 (Interactive Collaboration)
*   **流式输出 (Streaming)**：正文生成必须支持流式传输，减少用户等待焦虑。
*   **核心功能高亮**：将 AI 对话 (AI Chat) 等核心协作功能在 UI 上进行视觉强化（如使用品牌色、加粗、阴影），引导用户深度参与 AI 协作。
*   **上下文感知**：在章节对话 (ChapterChat) 中，务必将书籍背景和大纲作为 `systemInstruction` 传入，确保 AI 了解创作上下文。

## 4. 代码组织规范 (Code Structure)

### 4.1 目录结构与布局
*   **目录组织**：
    *   `/src/components`: 纯 UI 组件或功能组件。
    *   `/src/store`: 业务逻辑与全局状态 (Zustand)。
    *   `/src/lib`: 核心库封装 (DB, AI API, Utils)。
    *   `/src/hooks`: 可复用的逻辑钩子。
*   **布局平衡**：顶部工具栏等关键交互区域应采用对称布局（如 `grid-cols-3`），确保核心切换按钮（如 编辑/预览）居中，视觉重心稳定。

### 4.2 类型安全 (TypeScript)
*   所有数据模型 (Book, Chapter, Proposal) 必须在 `lib/db.ts` 或专门的 `types.ts` 中定义接口。
*   严格禁止使用 `any`，除非是在处理未知的第三方 API 错误捕获时。

## 5. 国际化规范 (i18n)

*   **Key 命名**：采用小写下划线命名法 (如 `generate_content_error`)。
*   **动态内容**：使用 i18next 的插值功能处理动态字符串。
*   **同步更新**：新增 UI 文本时，必须同时更新 `en` 和 `zh` 资源文件。

## 6. 性能与优化 (Performance)

*   **虚拟化/延迟加载**：对于长列表（如书籍列表），考虑使用虚拟滚动。
*   **DB 索引**：在 `Dexie` 中为常用查询字段（如 `bookId`, `order`）建立索引。
*   **资源压缩**：导出的 JSON 备份应保持紧凑，图片资源优先使用 WebP 或 CDN 链接。

---
*本规范由 InkSpire 项目组总结，适用于所有 AI 辅助创作类工具的开发。*
