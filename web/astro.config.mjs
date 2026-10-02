// @ts-check
import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';
import sitemap from '@astrojs/sitemap';
import { CHAPTERS } from './src/lib/chapters.ts';

// 站点地址是 https://rroy233.github.io/agent-evaluation-notes/。
// Starlight 会给侧边栏的 link 自动加上 base 前缀，
// 这里再手工拼一次会得到 /agent-evaluation-notes/agent-evaluation-notes/，所以一律写站内绝对路径。
const BASE = '/agent-evaluation-notes';

export default defineConfig({
  site: 'https://rroy233.github.io',
  base: BASE,
  image: { layout: 'constrained', responsiveStyles: true },
  integrations: [
    starlight({
      title: 'AI Agent 测评笔记',
      description: '一份整理行业 AI Agent 测评最佳实践的学习笔记，素材综合自 Anthropic、OpenAI、LangChain、Sierra、Langfuse 与美团公开发布的工程文章、技术博客和白皮书。',
      social: [{ icon: 'github', label: 'GitHub', href: 'https://github.com/rroy233/agent-evaluation-notes' }],
      head: [
        { tag: 'meta', attrs: { name: 'google-site-verification', content: 'TobQLxasHkiUnu8d55GDl5rd_RtjriQLYPaWAY2LrGo' } },
        {
          tag: 'script',
          attrs: {
            src: 'https://cloud.umami.is/script.js',
            defer: true,
            'data-website-id': '049ce45f-d776-4290-87ab-6a4b289dfb97',
            'data-domains': 'rroy233.github.io',
            'data-exclude-hash': 'true',
            'data-do-not-track': 'true',
          },
        },
      ],
      locales: { root: { label: '简体中文', lang: 'zh-CN' } },
      customCss: ['./src/styles/fonts.css', './src/styles/reading.css', './src/styles/highlights.css'],
      components: {
        Head: './src/components/Head.astro',
        TableOfContents: './src/components/TableOfContents.astro',
        MobileTableOfContents: './src/components/MobileTableOfContents.astro',
        MarkdownContent: './src/components/MarkdownContent.astro',
        Hero: './src/components/Hero.astro',
      },
      tableOfContents: { minHeadingLevel: 2, maxHeadingLevel: 3 },
      pagination: true,
      sidebar: [
        { label: '首页', link: '/' },
        {
          label: '正文',
          items: CHAPTERS.map((c) => ({ label: `第 ${c.n} 章 ${c.title}`, slug: `chapters/${c.slug}` })),
        },
      ],
    }),
    sitemap(),
  ],
});
