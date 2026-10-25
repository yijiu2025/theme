import { defineConfig } from 'vitepress';

/** 文档站导航 / 侧边栏的唯一来源 —— 改目录先改这里 */
const guide = [
  { text: '简介', link: '/guide/introduction' },
  { text: '快速上手', link: '/guide/getting-started' },
  { text: '目录约定', link: '/guide/directory' },
  { text: '主题包 · 配色 · 版式', link: '/guide/packages' },
  { text: '设备与容器', link: '/guide/devices' },
  { text: 'URL 参数手册', link: '/guide/url-params' },
  { text: '明暗与色系', link: '/guide/modes' },
  { text: '无路由 · 作用域 · 部件', link: '/guide/routerless' },
  { text: '外部主题来源', link: '/guide/remote' },
  { text: '调试', link: '/guide/debug' },
  { text: '常见坑', link: '/guide/faq' }
];

const api = [
  { text: '内核 `skinsuite`', link: '/api/kernel' },
  { text: 'Vue 绑定 `skinsuite/vue`', link: '/api/vue' },
  { text: '构建插件 `skinsuite/vite`', link: '/api/vite' }
];

const advanced = [
  { text: '架构地图（逐文件职责）', link: '/advanced/structure' },
  { text: '发布流程', link: '/advanced/publishing' }
];

export default defineConfig({
  lang: 'zh-CN',
  title: 'skinsuite',
  description: '多主题 / 多版式机制实现库：主题包 × 设备 × 页面 × 配色，零运行时依赖',
  head: [['link', { rel: 'icon', type: 'image/svg+xml', href: '/theme/logo.svg' }]],

  // GitHub Pages 把站点挂在仓库子路径下 —— 资源 URL 全靠它前缀
  base: '/theme/',
  // GitHub Pages 无服务器重写，无扩展名路由会 404
  cleanUrls: false,

  lastUpdated: true,

  themeConfig: {
    nav: [
      { text: '指南', link: '/guide/introduction', activeMatch: '/guide/' },
      { text: 'API', link: '/api/kernel', activeMatch: '/api/' },
      { text: '进阶', link: '/advanced/structure', activeMatch: '/advanced/' },
      {
        text: '更新日志',
        link: 'https://github.com/yijiu2025/theme/blob/main/CHANGELOG.md'
      }
    ],

    sidebar: {
      '/guide/': [
        {
          text: '指南',
          items: guide
        }
      ],
      '/api/': [
        {
          text: 'API 参考',
          items: api
        }
      ],
      '/advanced/': [
        {
          text: '进阶',
          items: advanced
        }
      ]
    },

    socialLinks: [{ icon: 'github', link: 'https://github.com/yijiu2025/theme' }],

    search: {
      provider: 'local',
      options: {
        translations: {
          button: { buttonText: '搜索文档', buttonAriaLabel: '搜索文档' },
          modal: {
            noResultsText: '没有找到结果',
            resetButtonTitle: '清除查询',
            footer: { selectText: '选择', navigateText: '切换', closeText: '关闭' }
          }
        }
      }
    },

    outline: { level: [2, 3], label: '本页目录' },
    docFooter: { prev: '上一篇', next: '下一篇' },
    lastUpdatedText: '最后更新',
    returnToTopLabel: '回到顶部',
    sidebarMenuLabel: '目录',

    footer: {
      message: '基于 MIT 许可发布',
      copyright: 'Copyright © 2026 qirly'
    }
  }
});
