# 公开部署

网站已适配 HTTPS、公开域名和 Linux x86-64 服务器。访客在浏览器里选择红 / 黑方、录入走法并获得推荐，不需要安装 Node.js 或皮卡鱼。

## 免费固定网址：Render

1. 注册并登录 GitHub 和 Render 的免费账号。
2. 把「弈见公开部署.zip」解压后的文件上传到一个 GitHub 仓库根目录。Dockerfile 和 render.yaml 必须在根目录；只上传代码及附带许可文件，不需要上传 Windows 程序或神经网络。
3. 在 Render 新建 Blueprint，连接该仓库。配置使用 Docker 和 Free 方案，健康检查为 `/api/health`。
4. 部署成功后，Render 会提供固定的 `https://…onrender.com` 网址，直接把实际生成的网址发给别人即可。

Docker 构建会从官方固定版本下载 Linux 皮卡鱼及配套网络，首次构建需要几分钟。访客无需账号，网站没有数据库，也不会把棋谱保存到服务器。局面会发送到服务器计算；页面刷新后，本页未导出的棋局记录会清空。

选择 Free 方案，不需要购买域名。平台可能要求账号验证，以创建页面的实际提示为准；没有授权付费时不要切换到收费方案。

Render 免费服务闲置 15 分钟会休眠，再次访问时通常需要约一分钟启动；它适合少量朋友体验，不承诺持续在线或计算速度。当前应用最多同时计算两局，额外请求会提示稍后重试。额度以平台当前规则为准。

官方说明：https://render.com/docs/free

## 已有 Docker 服务器

在 Linux x86-64 主机上的源码目录执行：

```sh
docker build -t yijian-xiangqi .
docker run -d --name yijian-xiangqi --restart unless-stopped -p 127.0.0.1:8765:8765 yijian-xiangqi
```

将网站的 HTTPS 反向代理指向 `http://127.0.0.1:8765`，保留原始 Host 头，并关闭响应缓冲以便及时显示分析进度。容器默认监听 `0.0.0.0:8765`，托管平台可通过 `PORT` 指定端口。

## 本次验证范围

已在 Windows 和 WSL Linux 中测试原生引擎、红黑方棋规与推荐；已验证公开域名 / HTTPS 来源、并发上限、取消后释放计算名额。当前环境没有 Docker，尚未执行 Docker 镜像构建或云平台部署。

根目录包含引擎、网络许可与对应源代码信息，构建时会复制至容器的 engine 目录；部署与再分发时保留。
