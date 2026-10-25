---
layout: home

hero:
  name: skinsuite
  text: 多主题 / 多版式机制实现库
  tagline: 主题包 × 设备 × 页面 × 配色 四段键 + 明暗联动 + CSS 变量安全校验 + 设备维度 URL 参数。零运行时依赖，Vue / React / Node / SSR 通用。
  actions:
    - theme: brand
      text: 快速上手
      link: /guide/getting-started
    - theme: alt
      text: 为什么是 skinsuite
      link: /guide/introduction
    - theme: alt
      text: GitHub
      link: https://github.com/yijiu2025/theme

features:
  - icon: 🎨
    title: 主题包 = 版式 + 配色
    details: 一个主题包是一整套设计（版式组件 + 配色目录），按 包 × 设备 × 页面 四段键解析；换设计 = 新建包，不碰业务代码。
  - icon: 📱
    title: 设备词汇完全宿主化
    details: 库不硬编码 mobile / desktop / mini——设备清单、判定口径、容器布线都是宿主事实，装配期注入，库只读取渲染。
  - icon: 🔗
    title: URL 即状态
    details: ?th / ?th_color / ?device 三族参数控制版式、配色与设备锁定；非法值 dev 告警、永不锁死页面。
  - icon: 🌗
    title: 明暗 ≡ 色系
    details: 切「暗」就是切黑系配色、切回恢复白系偏好；每套配色自带 tone，双向正交、单向联动。
  - icon: 🛡️
    title: 白名单安全校验
    details: token 名必须 --mauth-*、取值拒绝 url() 与规则闭合字符——外部下发（后端 / 父应用 postMessage）的每个值都过闸。
  - icon: 📦
    title: 零运行时依赖
    details: 纯内核不碰 DOM / 构建器 / 路由，Node 脚本与 SSR 直接用；Vue 绑定与 Vite 插件按需引入，宿主一行接入。
---
