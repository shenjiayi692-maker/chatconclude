# Production checklist

## 每次部署

1. 先备份 Supabase。
2. 按顺序执行新增迁移。
3. `npm run lint && npm run build`。
4. 推 `main`。Vercel 项目 **`chat-conclude`** 已连接本仓库，`main` 即生产分支，推送自动部署。
   需要绕过 Git 手动发版时，在仓库根目录执行 `npx vercel --prod`（`.vercel/project.json` 已绑定该项目）。
5. 检查 `/`、`/login`、`/app`、`/app/capture`、`/app/history`、`/app/settings` 和 `/api/ingest/ping`。
6. 检查旧入口 `/my`、`/save`、`/history`、`/settings/token`、`/connect-extension` 是否跳到对应新页面。

## 部署环境

- 生产项目：`chat-conclude`（Vercel），域名 `chat-conclude.vercel.app`。
  扩展 manifest、隐私政策页、Chrome Web Store 上架资料全部指向这个域名。
- 该域名已作为 Search Console 的 URL 前缀属性验证通过，用于 Chrome Web Store 的 Official URL。
  验证文件是 `public/google174d0abf80a8d52c.html`，**不要删除**，Google 会定期复查。

> 历史陷阱(2026-09-15 已修复)：9 月 4 日首次把代码推上 GitHub 时，Vercel 集成按仓库名
> 自动新建了第二个项目 `chatconclude`，此后所有 push 都部署到那个没人访问的项目，
> 生产域名停在 8 月 13 日的构建长达一个月。该项目已删除，`chat-conclude` 已接管 Git 连接。
> 如果以后又出现"推了代码线上没变"，先确认 Vercel 里只有一个项目连着这个仓库。

## 安全

- 定期轮换 Anthropic API key 和 Supabase service-role key。
- 测试令牌使用后立即吊销。
- 不把 `.env.local`、令牌或数据库备份提交到 Git。
- 检查 `usage_events` 的每日模型 token 使用量。
- 检查 `rate_counters` 是否持续增长、是否存在异常 key。

## 商业发布前

- 实测账号数据导出和删除。
- 免费版已有每日周报额度；收费前再选定支付服务并接入付费套餐。
- 配置错误监控和告警渠道。
- 上架 Chrome Web Store，并使用商店版本替代“加载已解压”。
- 让法律顾问复核隐私说明和使用条款。
