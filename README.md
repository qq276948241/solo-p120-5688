# 📚 旧书交换平台

为小区邻居打造的旧书交换平台，Vue3 + Express + MySQL 全栈项目。

## ✨ 功能特性

### 前端（Vue3）
- **图书列表页**：支持按分类、新旧程度、状态筛选，支持排序和分页
- **图书详情页**：展示完整图书信息，支持预约功能，预约成功后状态实时更新
- **图书发布页**：支持书名、作者、分类、新旧程度、封面图上传、联系方式填写

### 后端（Express）
- **图书模块**：图书列表、详情、创建、分类获取、筛选
- **预约模块**：创建预约（防重复）、取消预约、预约列表
- **文件上传**：封面图上传，支持 JPG/PNG/GIF/WEBP 格式

### 核心防重复预约机制（三重保障）
1. **数据库唯一索引**：`reservations` 表 `uk_book_status (book_id, status)` 确保同一本书只能有一个进行中的预约
2. **SELECT FOR UPDATE 行锁**：事务中查询图书时加排它锁，防止并发修改
3. **UPDATE 条件校验**：更新图书状态时 `WHERE status = 0`，确保只有可预约状态的图书才能被预约

## 📁 项目结构

```
project120/
├── client/                    # 前端 Vue3 项目
│   ├── src/
│   │   ├── views/            # 页面组件
│   │   │   ├── BookList.vue      # 图书列表页
│   │   │   ├── BookDetail.vue    # 图书详情页
│   │   │   └── BookPublish.vue   # 图书发布页
│   │   ├── router/           # 路由配置
│   │   ├── stores/           # Pinia 状态管理
│   │   ├── api/              # API 请求封装
│   │   ├── App.vue           # 根组件
│   │   └── main.js           # 入口文件
│   ├── package.json
│   └── vite.config.js
├── server/                    # 后端 Express 项目
│   ├── config/
│   │   └── database.js       # 数据库连接配置
│   ├── controllers/          # 控制器
│   │   ├── bookController.js
│   │   ├── reservationController.js
│   │   └── uploadController.js
│   ├── routes/               # 路由
│   │   ├── books.js
│   │   ├── reservations.js
│   │   └── upload.js
│   ├── uploads/              # 上传文件目录
│   ├── init_data.sql         # 测试数据脚本
│   ├── .env                  # 环境变量
│   ├── app.js                # 入口文件
│   └── package.json
└── README.md
```

## 🚀 快速开始

### 环境要求
- Node.js >= 16
- MySQL >= 5.7

### 1. 配置数据库

修改 `server/.env` 文件中的数据库连接信息：

```env
PORT=3000
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=your_password
DB_NAME=book_exchange
UPLOAD_DIR=./uploads
```

### 2. 启动后端服务

```bash
cd server
npm install
npm start
```

服务启动后会自动创建数据库和数据表。

### 3. 导入测试数据（可选）

```bash
cd server
mysql -u root -p < init_data.sql
```

### 4. 启动前端服务

```bash
cd client
npm install
npm run dev
```

前端访问地址：http://localhost:5173

后端 API 地址：http://localhost:3000

## 🔌 API 接口文档

### 图书模块

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/books` | 获取图书列表，支持筛选 |
| GET | `/api/books/:id` | 获取图书详情 |
| POST | `/api/books` | 创建图书 |
| GET | `/api/books/categories` | 获取图书分类 |

**GET /api/books 查询参数：**
- `category`: 分类
- `condition`: 新旧程度 (1-5)
- `status`: 状态 (0-可预约, 1-已预约)
- `sortBy`: 排序字段 (created_at, book_condition, title)
- `sortOrder`: 排序方向 (asc, desc)
- `page`: 页码
- `pageSize`: 每页数量

### 预约模块

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/reservations` | 获取预约列表 |
| POST | `/api/reservations` | 创建预约 |
| PUT | `/api/reservations/:id/cancel` | 取消预约 |

**POST /api/reservations 请求体：**
```json
{
  "book_id": 1,
  "reserver_name": "张三",
  "reserver_contact": "13800138000",
  "remark": "周末交换"
}
```

### 文件上传

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/upload/image` | 上传图片 |

## 🛡️ 预约防重复机制详解

### 问题场景
两个用户同时点击预约同一本书，如果没有正确的并发控制，可能出现两个人都预约成功的情况。

### 解决方案

1. **数据库唯一索引（最底层保障）**
   - 在 `reservations` 表创建唯一索引 `uk_book_status (book_id, status)`
   - 确保同一本书只能有一个 `status=1`（预约中）的记录
   - 即使应用层逻辑出现问题，数据库也会拒绝重复插入

2. **事务 + 行锁（中间层保障）**
   ```javascript
   // 开启事务
   await connection.beginTransaction()
   
   // 查询时加排它锁，防止其他事务同时修改
   const [bookRows] = await connection.execute(
     'SELECT ... FROM books WHERE id = ? FOR UPDATE',
     [bookId]
   )
   ```

3. **更新时条件校验（应用层保障）**
   ```javascript
   // 更新时校验状态，确保只有可预约状态的图书才能被预约
   const [updateResult] = await connection.execute(
     'UPDATE books SET status = 1 WHERE id = ? AND status = 0',
     [bookId]
   )
   
   // 如果影响行数为0，说明状态已被其他请求修改
   if (updateResult.affectedRows === 0) {
     await connection.rollback()
     return res.status(409).json({ message: '刚刚已被其他人预约' })
   }
   ```

4. **重复预约检查**
   ```javascript
   // 插入预约记录前，检查是否已有进行中的预约
   const [existingRows] = await connection.execute(
     'SELECT ... FROM reservations WHERE book_id = ? AND status = 1',
     [bookId]
   )
   
   if (existingRows.length > 0) {
     await connection.rollback()
     return res.status(409).json({ 
       message: `已被 ${existingRows[0].reserver_name} 预约` 
     })
   }
   ```

## 🎨 技术栈

### 前端
- Vue 3 (Composition API)
- Vue Router 4
- Pinia 状态管理
- Axios HTTP 客户端
- Element Plus UI 组件库
- Vite 构建工具

### 后端
- Express.js Web 框架
- MySQL2 数据库驱动
- Multer 文件上传
- CORS 跨域支持
- dotenv 环境变量

## 📝 开发说明

### 预约状态说明
- `status=0`: 可预约 - 可以被预约
- `status=1`: 已预约 - 已被预约，等待完成交换
- `status=2`: 已完成 - 交换完成

### 预约记录状态说明
- `status=1`: 预约中 - 预约已创建，等待交换
- `status=2`: 已完成 - 交换完成
- `status=3`: 已取消 - 预约被取消

## 🐛 问题排查

### 数据库连接失败
1. 检查 MySQL 服务是否启动
2. 检查 `.env` 中的用户名密码是否正确
3. 检查数据库是否已创建

### 端口被占用
- 前端默认端口 5173，可在 `vite.config.js` 中修改
- 后端默认端口 3000，可在 `.env` 中修改

### 图片上传失败
1. 检查 `server/uploads` 目录是否存在且有写入权限
2. 检查图片大小是否超过 5MB
3. 检查图片格式是否为支持的格式
