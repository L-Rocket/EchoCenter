import { defaultTheme } from 'vitepress'

/** @type {import('vitepress').Config} */
export default {
  base: '/EchoCenter/',
  lang: 'zh-CN',
  title: 'EchoCenter 文档',
  description: '智能代理中心系统文档',
  
  head: [
    ['link', { rel: 'icon', href: '/logo.png' }],
    ['meta', { name: 'viewport', content: 'width=device-width, initial-scale=1.0' }]
  ],
  
  themeConfig: {
    nav: [
      { text: '首页', link: '/' },
      { text: '架构', link: '/architecture/overview' },
      { text: 'API', link: '/api/authentication' },
      { text: '代理', link: '/agents/butler' },
      { text: '开发', link: '/development/setup' },
      {
        text: '链接',
        items: [
          { text: 'GitHub', link: 'https://github.com/L-Rocket/EchoCenter' }
        ]
      }
    ],
    
    sidebar: {
      '/architecture/': [
        {
          text: '架构',
          items: [
            { text: '概述', link: '/architecture/overview' },
            { text: '后端', link: '/architecture/backend' },
            { text: '前端', link: '/architecture/frontend' }
          ]
        }
      ],
      '/api/': [
        {
          text: 'API',
          items: [
            { text: '认证', link: '/api/authentication' },
            { text: 'WebSocket', link: '/api/websocket' },
            { text: '端点', link: '/api/endpoints' }
          ]
        }
      ],
      '/agents/': [
        {
          text: '代理',
          items: [
            { text: 'Butler', link: '/agents/butler' },
            { text: 'Storage-Custodian', link: '/agents/storage-custodian' },
            { text: '其他代理', link: '/agents/other-agents' }
          ]
        }
      ],
      '/development/': [
        {
          text: '开发',
          items: [
            { text: '环境设置', link: '/development/setup' },
            { text: '测试指南', link: '/development/testing' },
            { text: '贡献指南', link: '/development/contributing' }
          ]
        }
      ]
    },
    
    socialLinks: [
      { icon: 'github', link: 'https://github.com/L-Rocket/EchoCenter' }
    ],
    
    footer: {
      message: 'Released under the MIT License.',
      copyright: 'Copyright © 2024-present L-Rocket'
    },
    
    outline: {
      level: [2, 3]
    },
    
    lastUpdated: {
      text: '最后更新',
      formatOptions: {
        dateStyle: 'short',
        timeStyle: 'medium'
      }
    },
    
    editLink: {
      pattern: 'https://github.com/L-Rocket/EchoCenter/edit/main/docs/:path',
      text: '在 GitHub 上编辑此页'
    },
    
    docFooter: {
      prev: '上一页',
      next: '下一页'
    },
    
    search: {
      provider: 'local'
    }
  },
  
  locales: {
    root: {
      label: '简体中文',
      lang: 'zh-CN'
    },
    en: {
      label: 'English',
      lang: 'en',
      link: '/en/'
    }
  }
}
