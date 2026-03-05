---
layout: home

hero:
  name: EchoCenter
  text: 智能代理中心文档
  tagline: 模块化、可扩展的智能代理管理系统
  actions:
    - theme: brand
      text: 快速开始
      link: /zh/architecture/overview
    - theme: alt
      text: GitHub
      link: https://github.com/L-Rocket/EchoCenter

features:
  - title: 核心代理 Butler
    details: 负责协调各个子代理，提供智能化的中心管理。
  - title: 双语工作台
    details: 内置英文 / 简体中文切换，覆盖总览、聊天与设置管理。
  - title: 实时通信
    details: 基于 WebSocket 的低延迟双向消息传输。
  - title: 灵活扩展
    details: 轻松接入自定义代理，并支持飞书等外部渠道集成。
---

## 快速开始

- [架构](/zh/architecture/overview) - 系统架构和组件说明
- [API](/zh/api/authentication) - API 文档
- [代理](/zh/agents/butler) - 代理文档
- [开发](/zh/development/setup) - 开发指南
- [飞书接入](/zh/development/feishu-integration) - 飞书连接器接入与回调联调

## 文档结构

- **架构** - 系统架构和组件说明
  - [概述](/architecture/overview) - 系统架构概览
  - [后端](/architecture/backend) - 后端架构和组件
  - [前端](/architecture/frontend) - 前端架构和组件

- **API** - API 文档
  - [认证](/api/authentication) - 认证机制
  - [WebSocket](/api/websocket) - WebSocket 通信协议
  - [端点](/api/endpoints) - REST API 端点

- **代理** - 代理文档
  - [Butler](/agents/butler) - 核心代理
  - [Storage-Custodian](/agents/storage-custodian) - 存储管理代理
  - [其他代理](/agents/other-agents) - 其他代理说明

- **开发** - 开发指南
  - [环境设置](/development/setup) - 环境配置
  - [测试指南](/development/testing) - 测试指南
  - [飞书接入](/zh/development/feishu-integration) - 飞书连接器接入与联调
  - [贡献指南](/development/contributing) - 贡献指南

## 技术栈

- **后端** - Go + Gin + WebSocket + SQLite / PostgreSQL
- **前端** - React + TypeScript + Tailwind CSS
- **代理** - Python + OpenAI SDK

## 许可证

MIT License
