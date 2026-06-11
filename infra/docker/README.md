# Docker

各服务的 Docker 配置随服务本体存放,以保持构建上下文(build context)正确:

- 主云服务(Node):`services/backend/Dockerfile`、`services/backend/docker-compose.yml`
- 企业后端(Python):`services/python/Dockerfile`

部署编排脚本(蓝绿/金丝雀/staging)位于 `infra/deploy/`。

如需集中编排,在此目录添加跨服务的 `docker-compose.yml`,并用相对路径引用各服务的 build context。
