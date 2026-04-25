# React + Tailwind SPA 迁移规格

## Objective

把当前多 HTML 静态站迁移为移动端优先的 React + Tailwind 单页应用，并发布到 GitHub Pages。迁移后保留现有旅行账本的本地数据结构、核心业务能力和暖色移动端视觉方向。

## Commands

- 查看状态：`git status --short --branch`
- 安装依赖：`npm install`
- 本地开发：`npm run dev`
- 生产构建：`npm run build`
- 预览构建：`npm run preview`
- 发布：`npm run deploy`

## Project Structure

- `index.html`：Vite 应用入口
- `src/main.jsx`：React 挂载入口
- `src/App.jsx`：SPA 路由、页面组件和交互状态
- `src/lib/travel.js`：数据清洗、存储、结算、格式化等业务逻辑
- `src/styles.css`：Tailwind 入口与少量全局基础样式
- `tailwind.config.js`：主题色、字体、阴影和内容扫描配置
- `vite.config.js`：React 插件与 GitHub Pages base 配置
- `.github/workflows/deploy.yml`：GitHub Pages 自动部署 workflow

## Code Style

- 使用 React 函数组件和 hooks，不引入复杂状态管理库。
- 样式以 Tailwind utility 为主，少量全局 CSS 只处理字体、背景和滚动条。
- 保持中文文案 UTF-8，不改业务术语：记一笔、支出、付款人、参与人、结算。
- 旧链接兼容通过 SPA 路由映射处理，例如 `/detail?id=...`、`/review?id=...`。

## Testing Strategy

- `npm run build` 验证生产构建。
- 使用 `npm run preview` 打开构建产物，手工检查首页、创建、详情、记账、预算、结算、管理页。
- 核心手工链路：创建行程 -> 记一笔 -> 删除单笔支出 -> 增加预算 -> 查看结算。

## Boundaries

- 不接入服务端、账号系统、OCR 或真实 AI 接口。
- 不迁移小程序目录和历史备份目录。
- 不删除未确认的历史静态文件；迁移入口改为 Vite/React。
- 保留 `travel` 这个 `localStorage` key，确保旧数据可读取。

## Success Criteria

- 当前站点可作为 React + Tailwind SPA 在移动端使用。
- 旧静态页面的主要能力在 SPA 中可达。
- 生产构建成功，GitHub Pages 可访问最新版本。
- 仓库包含可重复执行的部署命令和 GitHub Pages workflow。
