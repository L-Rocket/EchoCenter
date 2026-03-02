# 贡献指南

## 概述

欢迎为 EchoCenter 贡献代码！本文档介绍如何参与项目开发。

## 开发流程

### 1. Fork 仓库

点击 GitHub 上的 "Fork" 按钮。

### 2. 克隆仓库

```bash
git clone https://github.com/YOUR_USERNAME/EchoCenter.git
cd EchoCenter
```

### 3. 添加上游远程

```bash
git remote add upstream https://github.com/L-Rocket/EchoCenter.git
```

### 4. 创建分支

```bash
git checkout -b feature/your-feature
# 或
git checkout -b fix/your-fix
```

### 5. 开发

进行你的开发工作。

### 6. 提交

```bash
git add .
git commit -m "feat: add your feature"
# 或
git commit -m "fix: fix your bug"
```

### 7. 推送

```bash
git push origin feature/your-feature
```

### 8. 创建 Pull Request

在 GitHub 上创建 Pull Request。

> **重要**：不要直接向 `main` 分支提交。请始终在 feature/fix/docs 分支开发并发起 PR。你可以在 GitHub Settings → Branches 中开启分支保护，要求 PR 审查和检查通过后才能合并。

### 8. 持续集成 (CI)

每个 Pull Request 都会自动触发 CI 工作流，运行以下检查：
- 后端：`go vet` 和 `go test`
- 前端：`eslint` 和 `vitest`

在推送代码前，请确保在本地运行 `make lint` 和 `make test` 并通过测试。

## 代码规范

### Go 代码规范

- 使用 `gofmt` 格式化代码
- 遵循 Go 命名约定
- 添加注释
- 使用错误处理

### Python 代码规范

- 使用 `black` 格式化代码
- 遵循 PEP 8
- 添加类型提示
- 使用 docstring

### JavaScript/TypeScript 代码规范

- 使用 `prettier` 格式化代码
- 遵循 Airbnb JavaScript Style Guide
- 添加注释
- 使用 TypeScript

## 提交规范

### 格式

```
<type>: <description>

[optional body]

[optional footer]
```

### 类型

- `feat` - 新功能
- `fix` - 修复 bug
- `docs` - 文档
- `style` - 代码格式
- `refactor` - 重构
- `test` - 测试
- `chore` - 构建过程或辅助工具变动

### 示例

```
feat: add new agent type

This adds support for new agent types.

Closes #123
```

```
fix: resolve login issue

Fixed the login issue where users couldn't login with special characters.

Fixes #456
```

```
docs: add contribution guide

Added detailed guide for contributors.
```

## Pull Request

### PR 标题

```
feat: add new feature
fix: fix bug
docs: update documentation
```

### PR 描述

```
## Description
Describe your changes.

## Type of change
- [ ] Bug fix
- [ ] New feature
- [ ] Documentation update
- [ ] Code refactor

## Testing
- [ ] Unit tests
- [ ] Integration tests
- [ ] Manual testing

## Screenshots (if applicable)
Add screenshots if applicable.

## Checklist
- [ ] Code follows project style
- [ ] Tests pass
- [ ] Documentation updated
- [ ] No warnings or errors
```

## 代码审查

### 审查标准

1. **代码质量**
   - 代码是否清晰
   - 是否遵循规范
   - 是否有注释

2. **功能**
   - 功能是否正确
   - 是否有边界情况
   - 是否有错误处理

3. **性能**
   - 是否有性能问题
   - 是否有内存泄漏
   - 是否有资源泄漏

4. **安全**
   - 是否有安全问题
   - 是否有敏感信息泄露
   - 是否有输入验证

### 审查流程

1. 提交 PR
2. 代码审查
3. 修改代码
4. 重新提交
5. 合并 PR

## 问题跟踪

### 建议优先的 Issue / PR

如果你想开始第一次贡献，下面是一些低风险方向：

- 优化文档措辞或补充缺失示例
- 为覆盖不足的逻辑补充/改进单元测试
- 修复错别字、失效链接或命名不一致问题
- 提升开发体验的小改动（脚本、Makefile 目标、校验检查）

建议维护者使用标签：
- `good first issue`
- `documentation`
- `tests`
- `help wanted`

### 创建 Issue

使用 GitHub Issues 创建问题。

### Issue 模板

```
## Description
Describe the issue.

## Steps to reproduce
1. Go to ...
2. Click on ...
3. See error

## Expected behavior
Describe what you expected.

## Actual behavior
Describe what actually happened.

## Environment
- OS: ...
- Browser: ...
- Version: ...

## Screenshots
Add screenshots if applicable.

## Additional context
Add any additional context.
```

## 许可证

通过贡献，你同意你的贡献遵循 MIT 许可证。

## 认可

感谢所有贡献者！
