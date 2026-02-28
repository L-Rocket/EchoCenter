import { defineConfig } from 'vitepress'

/** @type {import('vitepress').Config} */
export default defineConfig({
  base: process.env.NODE_ENV === 'production' ? '/EchoCenter/' : '/',
  lang: 'en-US',
  title: 'EchoCenter Docs',
  description: 'Documentation for the Intelligent Agent Center System',
  
  head: [
    ['link', { rel: 'icon', href: '/logo.png' }],
    ['meta', { name: 'viewport', content: 'width=device-width, initial-scale=1.0' }]
  ],
  
  themeConfig: {
    nav: [
      { text: 'Home', link: '/' },
      { text: 'Architecture', link: '/architecture/overview' },
      { text: 'API', link: '/api/authentication' },
      { text: 'Agents', link: '/agents/butler' },
      { text: 'Development', link: '/development/setup' },
      {
        text: 'Links',
        items: [
          { text: 'GitHub', link: 'https://github.com/L-Rocket/EchoCenter' }
        ]
      }
    ],
    
    sidebar: {
      '/architecture/': [
        {
          text: 'Architecture',
          items: [
            { text: 'Overview', link: '/architecture/overview' },
            { text: 'Backend', link: '/architecture/backend' },
            { text: 'Frontend', link: '/architecture/frontend' }
          ]
        }
      ],
      '/api/': [
        {
          text: 'API',
          items: [
            { text: 'Authentication', link: '/api/authentication' },
            { text: 'WebSocket', link: '/api/websocket' },
            { text: 'Endpoints', link: '/api/endpoints' }
          ]
        }
      ],
      '/agents/': [
        {
          text: 'Agents',
          items: [
            { text: 'Butler', link: '/agents/butler' },
            { text: 'Storage-Custodian', link: '/agents/storage-custodian' },
            { text: 'Other Agents', link: '/agents/other-agents' }
          ]
        }
      ],
      '/development/': [
        {
          text: 'Development',
          items: [
            { text: 'Setup', link: '/development/setup' },
            { text: 'Testing', link: '/development/testing' },
            { text: 'Agent Integration', link: '/development/agent-integration' },
            { text: 'Contributing', link: '/development/contributing' }
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
      text: 'Last Updated',
      formatOptions: {
        dateStyle: 'short',
        timeStyle: 'medium'
      }
    },
    
    editLink: {
      pattern: 'https://github.com/L-Rocket/EchoCenter/edit/main/docs/:path',
      text: 'Edit this page on GitHub'
    },
    
    docFooter: {
      prev: 'Previous Page',
      next: 'Next Page'
    },
    
    search: {
      provider: 'local'
    }
  },
  
  locales: {
    root: {
      label: 'English',
      lang: 'en-US'
    },
    zh: {
      label: '简体中文',
      lang: 'zh-CN',
      link: '/zh/',
      themeConfig: {
        nav: [
          { text: '首页', link: '/zh/' },
          { text: '架构', link: '/zh/architecture/overview' },
          { text: 'API', link: '/zh/api/authentication' },
          { text: '代理', link: '/zh/agents/butler' },
          { text: '开发', link: '/zh/development/setup' }
        ],
        sidebar: {
          '/zh/architecture/': [
            {
              text: '架构',
              items: [
                { text: '概述', link: '/zh/architecture/overview' },
                { text: '后端', link: '/zh/architecture/backend' },
                { text: '前端', link: '/zh/architecture/frontend' }
              ]
            }
          ],
          '/zh/api/': [
            {
              text: 'API',
              items: [
                { text: '认证', link: '/zh/api/authentication' },
                { text: 'WebSocket', link: '/zh/api/websocket' },
                { text: '端点', link: '/zh/api/endpoints' }
              ]
            }
          ],
          '/zh/agents/': [
            {
              text: '代理',
              items: [
                { text: 'Butler', link: '/zh/agents/butler' },
                { text: 'Storage-Custodian', link: '/zh/agents/storage-custodian' },
                { text: '其他代理', link: '/zh/agents/other-agents' }
              ]
            }
          ],
          '/zh/development/': [
            {
              text: '开发',
              items: [
                { text: '环境设置', link: '/zh/development/setup' },
                { text: '测试指南', link: '/zh/development/testing' },
                { text: 'Agent 接入', link: '/zh/development/agent-integration' },
                { text: '贡献指南', link: '/zh/development/contributing' }
              ]
            }
          ]
        }
      }
    }
  }
})
