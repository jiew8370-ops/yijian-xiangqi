# 弈见 · 象棋 AI 助手

网站：https://yijian-xiangqi.onrender.com/

选择「我执红方」或「我执黑方」，把对手实际走的棋同步到棋盘；轮到自己时，网站使用 Pikafish 2026-09-06 推荐走法。支持手动摆盘、FEN 导入、悔棋和棋盘翻转。皮卡鱼建议不保证获胜，预测变化需要根据对手的实际着法更新。

## 免费部署

当前网站托管于 Render Free，新加坡区域。空闲 15 分钟后会休眠，再次打开可能需要约一分钟唤醒。免费计算资源适合少量用户体验，最多同时分析两局；繁忙时请稍后重试。

其他人部署本项目：在 Render 新建 Web Service，选择 Public Git Repository 并填入本仓库地址，运行环境选 Docker，计算方案选 Free，健康检查路径填 `/api/health`，然后部署。也可使用仓库中的 render.yaml 创建 Blueprint。

官方免费方案说明：https://render.com/docs/free

## Docker

```sh
docker build -t yijian-xiangqi .
docker run -d --name yijian-xiangqi --restart unless-stopped -p 127.0.0.1:8765:8765 yijian-xiangqi
```

使用 Linux x86-64 主机。Docker 构建从官方固定版本下载引擎及网络，基础镜像使用 Debian Trixie，以满足引擎所需的 GLIBC 2.38 或更新版本。容器监听 0.0.0.0，默认端口 8765，可用 PORT 指定端口。自建服务器请配置 HTTPS 反向代理，保留 Host 头并关闭流式响应缓冲。

## 数据与许可

访客无需账号。局面发送到服务器计算，网站没有数据库，不保存棋谱；刷新页面会清空未导出的棋局记录。

根目录的 Copying.txt、NNUE-License.md、AUTHORS 和 SOURCE.md 为皮卡鱼引擎及网络的许可、作者与源码信息。构建时复制到容器的 engine 目录，再分发时请保留。