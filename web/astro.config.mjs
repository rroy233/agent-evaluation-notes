// @ts-check
import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';
import sitemap from '@astrojs/sitemap';
import { CHAPTERS } from './src/lib/chapters.ts';

// 站点地址是 https://rroy233.github.io/agent-evaluation-notes/。
// Starlight 会给侧边栏的 link 自动加上 base 前缀（多语种时还会加 /en/），
// 这里再手工拼一次会得到重复前缀，所以一律写站内绝对路径或内部 slug。
const BASE = '/agent-evaluation-notes';

export default defineConfig({
  site: 'https://rroy233.github.io',
  base: BASE,
  image: { layout: 'constrained', responsiveStyles: true },
  integrations: [
    starlight({
      defaultLocale: 'root',
      title: {
        'zh-CN': 'AI Agent 测评笔记',
        en: 'AI Agent Evaluation Notes',
      },
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
      locales: {
        root: { label: '简体中文', lang: 'zh-CN' },
        en: { label: 'English', lang: 'en' },
      },
      customCss: [
        './src/styles/fonts.css',
        './src/styles/reading.css',
        './src/styles/highlights.css',
        './src/styles/nav-dropdown.css',
      ],
      components: {
        Head: './src/components/Head.astro',
        TableOfContents: './src/components/TableOfContents.astro',
        MobileTableOfContents: './src/components/MobileTableOfContents.astro',
        MarkdownContent: './src/components/MarkdownContent.astro',
        Hero: './src/components/Hero.astro',
        LanguageSelect: './src/components/LanguageSelect.astro',
        ThemeSelect: './src/components/ThemeSelect.astro',
      },
      tableOfContents: { minHeadingLevel: 2, maxHeadingLevel: 3 },
      pagination: true,
      sidebar: [
        { label: '首页', translations: { en: 'Home' }, link: '/' },
        {
          label: '正文',
          translations: { en: 'Chapters' },
          items: CHAPTERS.map((c) => ({
            label: `第 ${c.n} 章 ${c.title['zh-CN']}`,
            translations: { en: `Chapter ${c.n} ${c.title.en}` },
            slug: `chapters/${c.slug}`,
          })),
        },
      ],
    }),
    sitemap({
      // 中文是 root（无路径前缀），英文是 /en/。键匹配路径段，值是 hreflang 的 lang。
      i18n: {
        defaultLocale: 'zh',
        locales: { zh: 'zh-CN', en: 'en' },
      },
    }),
  ],
});
