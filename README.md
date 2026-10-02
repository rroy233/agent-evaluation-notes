# AI Agent 测评方法 · 学习笔记

[![在线阅读](https://img.shields.io/badge/在线阅读-rroy233.github.io-2f6f4f)](https://rroy233.github.io/agent-evaluation-notes/)
[![构建状态](https://github.com/rroy233/agent-evaluation-notes/actions/workflows/deploy.yml/badge.svg)](https://github.com/rroy233/agent-evaluation-notes/actions/workflows/deploy.yml)

一份整理行业 AI Agent 测评最佳实践的学习笔记，素材综合自 Anthropic、OpenAI、LangChain、Sierra、Langfuse 与美团公开发布的工程文章、技术博客和白皮书。

## 简介

- **一条主线**：成功标准 → 任务设计 → 判定器 → 测评集与实验 → 生产反馈，每章产出一份下一章直接要用的东西。
- **只讲方法**：聚焦自建 Agent 的测评方法，公开基准、平台功能和代码接入只在支撑方法时出现。
- **有据可查**：定义、指标和结论都标注编号，对应每章末尾的参考文献。
- **可落地**：成功标准、任务规格、判定器规格、发布门槛都给出可照着重搭的字段和规则。

## 在线阅读

<https://rroy233.github.io/agent-evaluation-notes/>

支持深色模式、字号调节、专注模式、正文划重点与高亮备份。

## 内容速览

| 章节 | 主题 | 正文 |
| --- | --- | --- |
| 第 1 章 Agent 的成功标准 | 量什么、凭什么量、算不算成功 | [book/chapter1.md](book/chapter1.md) |
| 第 2 章 测评任务设计 | 把成功标准写成可重复执行的任务 | [book/chapter2.md](book/chapter2.md) |
| 第 3 章 判定器设计 | 谁来判、按什么规则判、如何校准 | [book/chapter3.md](book/chapter3.md) |
| 第 4 章 组织测评集并解读实验结果 | 固定实验条件，比较版本，复核个案 | [book/chapter4.md](book/chapter4.md) |
| 第 5 章 生产反馈与测评集演进 | 把线上暴露的问题转成离线回归任务 | [book/chapter5.md](book/chapter5.md) |

## 贡献

问题反馈走 issue：<https://github.com/rroy233/agent-evaluation-notes/issues/new>。

- **内容优化或勘误**：事实、定义、引用或逻辑问题。请附章节编号、原文说法和修改建议。
- **代码改进与 Bug 修复**：构建、样式或阅读功能问题。请附复现步骤、浏览器版本和报错原文。

本地构建：

```bash
cd web && pnpm install
pnpm dev     # 同步 book/ 后启动开发服务器
pnpm build   # 构建到 web/dist
```

## 许可证

| 内容 | 许可 |
| --- | --- |
| 正文笔记（`book/` 和站点文字） | [CC BY-NC-SA 4.0](https://creativecommons.org/licenses/by-nc-sa/4.0/deed.zh) |
| 站点代码（`web/`） | [MIT](https://opensource.org/license/mit) |
| 自托管字体 | [SIL OFL 1.1](web/src/assets/fonts/LICENSE-SourceHanSerif.txt) |