# Production checklist

## 每次部署

1. 先备份 Supabase。
2. 按顺序执行新增迁移。
3. `npm run lint && npm run build`。
4. 部署 Vercel。
5. 检查 `/`、`/login`、`/app`、`/app/capture`、`/app/history`、`/app/settings` 和 `/api/ingest/ping`。
6. 检查旧入口 `/my`、`/save`、`/history`、`/settings/token`、`/connect-extension` 是否跳到对应新页面。

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
