# EchoCenter 面试问题清单（微软中国风格）

> 基于你的这段简历描述整理：
>
> - Designed a centralized AI agent orchestration hub in Go, engineering a bidirectional Gorilla WebSocket messaging layer that sustained 20K+ simulated concurrent connections with an optimized ~400MB memory footprint.
> - Built a core AI coordinator integrating the Eino framework and LLMs to autonomously dispatch multi-agent workflows based on user intents.
> - Resolved severe database write-lock contention by migrating from SQLite to PostgreSQL, slashing the persistence failure rate from 62.3% to 0% under a continuous load of 1K concurrent requests.
> - Built a secure JWT authentication service and a robust Feishu (Lark) WebSocket bridge with policy routing for enterprise-integrated authorization workflows.
>
> 这份文档只放“面试官可能会问的问题”，不放答案。  
> 风格上更贴近微软中国常见面试：重视系统设计、边界条件、指标口径、工程权衡、可靠性和 ownership。

---

## 一、项目总览

1. 你先用 2 分钟介绍一下这个项目，重点讲它解决了什么问题。
2. 为什么这个系统需要一个 centralized orchestration hub？
3. 这个系统里的核心角色有哪些？Butler、普通 Agent、WebSocket Hub、数据库分别负责什么？
4. 你的系统本质上是一个 AI Agent 系统，还是一个被 LLM 增强的分布式控制面？
5. 如果让我一句话理解这个项目，你希望我怎么记住它？
6. 这个项目里最难的技术挑战是什么？为什么？
7. 你个人负责的部分具体到设计和实现分别有哪些？
8. 你最自豪的一项设计决策是什么？

---

## 二、WebSocket 与高并发

9. 你说单机支撑了 20K+ simulated concurrent connections，这个 benchmark 的测试口径是什么？
10. 这些连接是空闲长连接，还是有持续业务流量的连接？
11. 400MB 左右的 memory footprint 是怎么测出来的？
12. 为什么你认为这个数字可信？
13. 你在 Gorilla WebSocket 层做了哪些设计，才把内存控制在这个水平？
14. 你的连接管理模型是什么？Hub 是怎么管理 register、unregister 和 broadcast 的？
15. 消息路由是广播、定向投递还是混合模式？为什么这么设计？
16. 如果某个节点消费很慢、send channel 堵住了，你怎么处理？
17. 如果目标 Agent 不在线，Butler 下发任务时系统会怎么表现？
18. 这 20K 的结果为什么不能直接等价为“系统具备高吞吐能力”？
19. 如果从空闲连接场景切换到高频消息场景，系统最先遇到的瓶颈会是什么？
20. 如果让你把这个连接层继续往上推到 50K 或更高，你会优先改哪几处？

---

## 三、AI Coordinator、Eino 与多 Agent 编排

21. 你说 built a core AI coordinator，它具体负责什么？
22. 用户输入一句自然语言之后，到最终某个 Agent 真正执行，中间完整链路是什么？
23. 你为什么选 Eino，而不是直接基于 OpenAI SDK 做 function calling？
24. 你的系统现在更接近 ReAct 模式，还是 workflow 模式？
25. Butler 怎么判断当前任务应该走串行模式还是并行模式？
26. 你的多 Agent workflow 是怎么表示的？是隐式的，还是有显式 plan？
27. 如果多个 Agent 都可能处理一个任务，Butler 怎么选目标节点？
28. 你的这些 Agent 更像“智能体”，还是更像“分布式执行节点”？为什么？
29. Butler 为什么不能直接暴露所有工具给模型？
30. tool 太多会带来什么问题？你会怎么控制 tool 的数量和粒度？
31. 你怎么看 progressive tool disclosure？在你的场景里有必要吗？
32. 如果要支持并行 workflow，Butler 应该输出什么样的结构，而不是只输出一个 next tool call？
33. Coordinator 如果存在，它和 Butler 的职责边界应该怎么划分？
34. 多个 Agent 返回结果之后，谁来做结果汇总和中间态压缩？为什么？
35. 在你的系统里，哪些部分应该由 LLM 决策，哪些部分必须由程序硬编码约束？

---

## 四、上下文管理、Runtime 与 MCP

36. 多 Agent 场景下，你会怎么设计上下文管理？
37. 会话上下文、任务上下文、节点运行状态、RAG 知识，这几类上下文应该怎么分层？
38. 一次模型调用前，上下文组装顺序应该是什么？为什么规则要放前面，用户最新输入要放最后？
39. 你的 runtime 是否应该是一个独立层，而不是让 Butler 自己处理所有上下文？
40. 这个 runtime 更适合是一个小模型、规则引擎，还是两者结合？
41. runtime 应该如何决定本轮是否需要暴露 GitHub 之类的 MCP tools？
42. 什么时候应该判定“当前不需要某类 MCP tools”？
43. MCP 在这个系统里解决的是什么问题？WebSocket 解决的又是什么问题？
44. 为什么既需要 WebSocket，又可能需要 MCP？
45. 你的分布式节点是直接作为 MCP server 暴露给 Butler，还是通过平台适配成 MCP-style tools？为什么？
46. MCP tool 定义里应该放什么？哪些东西不应该暴露给 Butler？
47. 你的 Agent 理想形态是不是应该由 runtime 渐进式披露 tools，同时做上下文压缩？为什么？

---

## 五、数据库迁移与写锁竞争

48. SQLite 的写锁竞争在你的系统里具体是怎么产生的？
49. 哪些写路径最容易打到数据库瓶颈？
50. 62.3% 的 persistence failure rate 是怎么测出来的？这个口径是什么？
51. continuous load of 1K concurrent requests 指的是什么负载模型？
52. 迁移 PostgreSQL 之后为什么 failure rate 可以做到 0%？
53. 除了切库之外，你还做了哪些配套优化？
54. 你怎么保证从 SQLite 迁移到 PostgreSQL 时，业务层基本无感？
55. SQL placeholder、自增主键、事务语义、时间类型这些差异你怎么处理？
56. 为什么你说这是“resolved severe write-lock contention”，而不是“换了数据库所以结果更好”？
57. 如果面试官质疑“0% failure 说明不了什么，可能只是压测不够狠”，你会怎么回应？

---

## 六、JWT、授权与飞书桥接

58. JWT 在你的系统里主要保护哪些边界？
59. 为什么人类用户适合用 JWT，而机器节点未必直接适合？
60. 飞书 WebSocket bridge 在这个系统里的主要作用是什么？
61. 为什么选择 Feishu WebSocket bridge，而不是纯 webhook 模式？
62. 你简历里说了 policy routing，这个 routing 是按什么规则做的？
63. 一条来自飞书的消息，怎么安全地进入 Butler 的处理链路？
64. 你的 enterprise-integrated authorization workflow 是怎么工作的？
65. 为什么高风险动作不能只依赖 RBAC，而必须要有人类审批？
66. 你怎么保证审批流是幂等的？
67. 如果飞书里用户批准了，但目标 Agent 此时已经离线，系统怎么保证状态一致性？

---

## 七、RAG 与知识设计

68. 在你这个 AIOps 场景里，RAG 最合理存哪些内容？
69. 为什么 SOP、故障复盘、历史经验适合放进 RAG？
70. 为什么实时节点状态、实时告警值不适合放进 RAG？
71. 如果知识库内容过期、互相冲突或者本身质量不高，会带来什么问题？
72. 你会怎么治理这类知识库？
73. 你会怎么做 context compression，让 Butler 不被长对话拖垮？

---

## 八、系统设计追问

74. 如果 Butler 是单点，系统的高可用怎么做？
75. 如果 pending action 只在内存里，会有什么风险？
76. 如果系统规模从几十个 Agent 增长到几千个，你最先重构哪一层？
77. 如果现在要支持更复杂的并行与串行组合 workflow，你会引入独立 workflow engine 吗？
78. 你的系统里最大的技术债是什么？
79. 哪些模块现在更像“可行性方案”，哪些已经接近“生产级设计”？
80. 如果再给你两个月，你会优先补哪三件事？

---

## 九、行为与 Ownership

81. 这个项目里你做过的一个错误决策是什么？后来怎么修正的？
82. 你在哪个点上体现了 end-to-end ownership？
83. 如果这个项目线上出问题，你最先会看哪些指标和日志？
84. 这个项目最能证明你具备什么能力？
85. 如果我是微软中国的面试官，我为什么应该相信你能独立扛一个复杂后端系统？

---

## 十、高概率连续追问

这些往往不是主问题，而是面试官在你回答过程中顺手补刀的：

86. 这个结果的边界是什么？你能证明什么，不能证明什么？
87. 哪一步是 LLM 决定的，哪一步是程序强约束的？
88. 你的系统最先会在哪个地方失效？
89. 你这个项目为什么不是一个“套了 AI 的 Demo”？
90. 如果今天把这个系统交给一个新团队，你觉得他们最容易踩什么坑？

