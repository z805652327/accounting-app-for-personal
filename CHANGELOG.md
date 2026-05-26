# FinBook 版本管理文档

## v1.0.0 (2026-05-27)

### 基础架构
- Vue 3 + Vite + TypeScript 前端
- Element Plus 组件库
- Vue Router 路由系统 (34 个页面)
- Pinia 状态管理
- sql.js 数据库引擎 (多平台适配)
- Electron 桌面端 (Windows/macOS/Linux)
- Capacitor Android 打包支持

### 数据库层
- 复式记账模型 (借贷平衡)
- 会计科目体系 (一级/二级/三级, 8 位编码)
- 账户管理 (资产/负债容器)
- 日记账分录 (journal_entries)
- 编辑历史追踪
- 软删除 + 归档锁死
- 数据库迁移机制
- 多平台适配器:
  - `ElectronDatabase` — IPC 桥接 (桌面端)
  - `CapacitorDatabase` — Filesystem 持久化 (Android)
  - `H5Database` — localStorage (浏览器)

### 交易系统
- 14 种交易类型:
  - 收入 (income)
  - 支出 (expense)
  - 转账 (transfer)
  - 发工资 (salary)
  - 投资买入/卖出 (investment_buy/sell)
  - 估值调整 (valuation_adjust)
  - 借款/还款 (loan_receive/repay)
  - 预付摊提 (prepaid_amortize)
  - 购置固定资产 (asset_purchase)
  - 资产处置 (asset_dispose)
  - 信用卡消费/还款 (credit_card_spend/repay)
- 分拆交易 (split transactions)
- 定期记账 (recurring)
- 三级科目联动选择器 (L1 → L2 → L3)

### 财务报表 (5 张主表)
- 资产负债表 (balance-sheet)
- 利润表 (income-statement) — L3 汇总至 L2 → L1
- 现金流量表 (cash-flow) — 中文标签
- 科目余额表 (subject-balance) — 钻取至交易明细
- 科目明细 (subject-detail) — 通过 journal_entries 查询

### 辅助报表 (5 张)
- 消费排行榜 (expense-ranking)
- 固定 vs 弹性支出分析 (expense-analysis)
- 预算执行报告 (budget-report)
- 辅助余额表 (auxiliary)
- 净资产趋势

### 管理功能
- 科目管理 (含账户型三级科目展示, 停用/启用)
- 折旧管理 (新增/修改/终止, 自动匹配累计折旧科目)
- 摊销管理
- 预算管理 (总额 + 科目阈值)
- 标签系统 (可视化色块选择器)
- 自定义指标 (引导式公式构建器, 无需手写公式)
- 自定义报表 (科目选择器, 无需手写编码)
- 待处理事项 (折旧/摊销/定期记账)
- 数据导入/导出 (JSON/CSV/Excel)
- 最近删除 (恢复/彻底删除)
- 编辑历史
- 年末结账
- 数据对账
- 应用锁 (PIN 码)
- 恢复出厂设置 (三重确认)

### 初始化
- 首次资产初始化向导
- 预置完整会计科目体系 (约 120 个科目)
- 预置 10 个财务指标

### UI/UX
- 自定义 ActionSheet (底部弹出选择器)
- 自定义 ModalDialog (确认弹窗)
- Warm Ledger 设计系统
- 纸纹理背景
- DM Mono (金额) + Noto Serif SC (标题) 字体
- 朱红 (#C44536) + 松绿 (#2D7D7A) 配色
- 页面加载动画 (交错淡入)

### 测试
- 248 个测试用例 (16 个测试文件)
- Vitest 测试框架

---

## 版本更新记录

| 版本 | 日期 | 变更内容 |
|------|------|---------|
| 1.0.0 | 2026-05-27 | 初始版本, 全部功能 |
