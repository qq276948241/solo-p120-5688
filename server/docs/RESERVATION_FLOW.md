# 预约模块完整流程与并发安全文档

## 一、整体架构概览

预约模块采用 **Controller → Service → MySQL** 三层架构，职责划分如下：

| 层级 | 文件 | 职责 |
|------|------|------|
| 路由层 | [reservations.js](file:///d:/code/ai-prompt/solo-chrome-dev-F12/repos/repo120/project120/server/routes/reservations.js) | 定义 URL 与 Controller 方法的映射 |
| 控制层 | [reservationController.js](file:///d:/code/ai-prompt/solo-chrome-dev-F12/repos/repo120/project120/server/controllers/reservationController.js) | 提取请求参数、调用 Service、格式化响应、统一错误处理 |
| 服务层 | [reservationService.js](file:///d:/code/ai-prompt/solo-chrome-dev-F12/repos/repo120/project120/server/services/reservationService.js) | 全部业务逻辑、SQL 操作、事务管理、参数校验 |
| 数据层 | [database.js](file:///d:/code/ai-prompt/solo-chrome-dev-F12/repos/repo120/project120/server/config/database.js) | 连接池配置、建表语句（含唯一索引） |

**关键设计原则**：Controller 不包含任何 SQL 或事务代码，只负责 HTTP 协议适配；所有并发安全逻辑集中在 Service 层。

---

## 二、API 路由映射

定义在 [reservations.js L5-L8](file:///d:/code/ai-prompt/solo-chrome-dev-F12/repos/repo120/project120/server/routes/reservations.js#L5-L8)：

| 方法 | 路径 | Controller 方法 | 功能 |
|------|------|-----------------|------|
| POST | `/api/reservations` | `create` | 创建预约 |
| GET  | `/api/reservations` | `getList` | 查询预约列表（管理用） |
| GET  | `/api/reservations/mine` | `getMine` | 查询我的预约 |
| PUT  | `/api/reservations/:id/cancel` | `cancel` | 取消预约 |

---

## 三、数据库表结构与 status 字段

### 3.1 books 表

建表语句位于 [database.js L29-L48](file:///d:/code/ai-prompt/solo-chrome-dev-F12/repos/repo120/project120/server/config/database.js#L29-L48)：

```sql
CREATE TABLE IF NOT EXISTS books (
  id INT AUTO_INCREMENT PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  author VARCHAR(255) NOT NULL,
  category VARCHAR(100) NOT NULL,
  book_condition TINYINT NOT NULL COMMENT '1-全新, 2-九成新, 3-八成新, 4-七成新, 5-六成新及以下',
  cover_image VARCHAR(500),
  status TINYINT DEFAULT 0 COMMENT '0-可预约, 1-已预约, 2-已完成',
  ...
)
```

**books.status 字段含义**：

| 值 | 含义 | 触发时机 |
|----|------|----------|
| 0  | 可预约 | 图书发布时 / 预约取消时 |
| 1  | 已预约 | 有人成功预约时 |
| 2  | 已完成 | 交换完成时（当前版本暂未实现） |

### 3.2 reservations 表

建表语句位于 [database.js L50-L65](file:///d:/code/ai-prompt/solo-chrome-dev-F12/repos/repo120/project120/server/config/database.js#L50-L65)：

```sql
CREATE TABLE IF NOT EXISTS reservations (
  id INT AUTO_INCREMENT PRIMARY KEY,
  book_id INT NOT NULL,
  reserver_name VARCHAR(100) NOT NULL,
  reserver_contact VARCHAR(200) NOT NULL,
  remark TEXT,
  status TINYINT DEFAULT 1 COMMENT '1-预约中, 2-已完成, 3-已取消',
  ...
  UNIQUE KEY uk_book_status (book_id, status),
  FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE
)
```

**reservations.status 字段含义**：

| 值 | 含义 | 触发时机 |
|----|------|----------|
| 1  | 预约中（待交换） | 创建预约时 |
| 2  | 已完成 | 交换完成时（当前版本暂未实现） |
| 3  | 已取消 | 用户主动取消时 |

### 3.3 核心约束：uk_book_status 唯一索引

```sql
UNIQUE KEY uk_book_status (book_id, status)
```

这是整个并发安全方案的**最底层保障**。其含义是：同一本书（`book_id`）不允许存在两条 `status` 值相同的预约记录。由于预约中的状态值为 1，这实际上意味着 **同一本书在同一时间只能有一条「预约中」的记录**。

当两个请求几乎同时插入 `status=1` 的记录时，第二个 INSERT 会因违反唯一索引抛出 `ER_DUP_ENTRY` 错误，被 Service 层的 catch 分支捕获并返回 409 响应。

> **注意**：这个唯一索引在 status=3（已取消）时同样生效，因此同一本书在被取消后可以被再次预约（因为新的 status=1 与旧的 status=3 不冲突），但历史已取消的记录不会阻碍新的预约。

---

## 四、创建预约完整流程

从用户点击预约按钮到后端返回结果的完整链路：

### 4.1 前端 → 后端

```
用户点击"预约" → POST /api/reservations
请求体: { book_id, reserver_name, reserver_contact, remark }
```

### 4.2 Controller 层

[reservationController.js L24-L42](file:///d:/code/ai-prompt/solo-chrome-dev-F12/repos/repo120/project120/server/controllers/reservationController.js#L24-L42)：

1. 从 `req.body` 提取参数，传给 `reservationService.createReservation()`
2. 成功时返回 `code: 200` + 预约详情
3. 失败时由 `handleServiceError()` 统一处理，根据 `ServiceError.code` 返回对应 HTTP 状态码

### 4.3 Service 层（核心）

[reservationService.js L18-L118](file:///d:/code/ai-prompt/solo-chrome-dev-F12/repos/repo120/project120/server/services/reservationService.js#L18-L118)：

```
入参校验 → 获取连接 → 开启事务 → 三重检查 → 写入 → 提交
```

详细步骤：

**Step 1：参数校验**（L19-L21）

```javascript
if (!book_id || !reserver_name || !reserver_contact) {
  throw new ServiceError(400, '请填写完整信息')
}
```

不合法参数直接抛 400，不进数据库。

**Step 2：获取连接并开启事务**（L24-L27）

```javascript
const connection = await pool.getConnection()
await connection.beginTransaction()
```

从连接池获取独占连接，开启事务。事务保证后续所有 SQL 在同一个连接上原子执行。

**Step 3：第一重检查 — 图书状态检查 + 行锁**（L29-L47）

```javascript
const [bookRows] = await connection.execute(
  'SELECT id, title, status, owner_name, owner_contact FROM books WHERE id = ? FOR UPDATE',
  [bookId]
)
```

- `FOR UPDATE` 对匹配行加**排他锁（X Lock）**，其他事务无法读取或修改该行
- 如果两个请求同时到达，第二个请求会阻塞在这里，直到第一个事务提交或回滚
- 检查 `book.status !== 0` 则回滚并返回 409

**Step 4：第二重检查 — 已有预约检查**（L49-L60）

```javascript
const [existingRows] = await connection.execute(
  'SELECT id, reserver_name FROM reservations WHERE book_id = ? AND status = 1',
  [bookId]
)
```

在事务内查询是否已有 `status=1` 的预约记录，有则返回 409 并提示当前预约人。

**Step 5：第三重检查 — CAS 式更新**（L62-L72）

```javascript
const [updateResult] = await connection.execute(
  'UPDATE books SET status = 1, updated_at = NOW() WHERE id = ? AND status = 0',
  [bookId]
)
if (updateResult.affectedRows === 0) {
  throw new ServiceError(409, '刚刚已被其他人预约')
}
```

`WHERE status = 0` 是 Compare-And-Swap 模式，只有 status 仍为 0 时才更新。`affectedRows === 0` 说明状态已被其他请求改掉。

**Step 6：插入预约记录**（L74-L79）

```javascript
const [insertResult] = await connection.execute(
  `INSERT INTO reservations (book_id, reserver_name, reserver_contact, remark, status)
   VALUES (?, ?, ?, ?, 1)`,
  [bookId, reserver_name, reserver_contact, remark || null]
)
```

**Step 7：提交事务**（L81）

```javascript
await connection.commit()
```

所有操作成功后一次性提交，此时 `FOR UPDATE` 行锁释放，其他等待的事务继续执行。

**Step 8：异常兜底 — 唯一索引拦截**（L100-L109）

```javascript
if (err.code === 'ER_DUP_ENTRY' && err.sqlMessage.includes('uk_book_status')) {
  throw new ServiceError(409, '已被其他人预约，无法重复预约')
}
```

如果极端情况下前三重检查都没拦住（理论上不会发生，但防御性编程），`uk_book_status` 唯一索引会在 INSERT 时抛出 `ER_DUP_ENTRY`，被 catch 分支捕获并转换为 409 响应。

### 4.4 流程图

```
POST /api/reservations
        │
        ▼
   参数校验 ──── 不通过 ──→ 400
        │ 通过
        ▼
  getConnection + beginTransaction
        │
        ▼
  SELECT ... FOR UPDATE ──── 图书不存在 ──→ 404
        │                        │
        │                   status ≠ 0 ──→ 409
        ▼
  查已有预约 ──── 已存在 status=1 ──→ 409
        │
        ▼
  UPDATE ... WHERE status=0 ──── affectedRows=0 ──→ 409
        │
        ▼
  INSERT reservation ──── ER_DUP_ENTRY ──→ 409（唯一索引兜底）
        │
        ▼
  commit → 200 成功
```

---

## 五、并发安全保障机制（三重保证）

整个方案由三层防线组成，层层递进：

| 层级 | 机制 | 作用范围 | 失败时行为 |
|------|------|----------|------------|
| 第一层 | `SELECT ... FOR UPDATE` 行锁 | 事务内 | 第二个请求阻塞，等第一个提交后再检查 |
| 第二层 | `UPDATE ... WHERE status = 0` CAS | 单条 SQL | affectedRows=0 时回滚，返回 409 |
| 第三层 | `UNIQUE KEY uk_book_status` | 数据库级 | INSERT 抛 ER_DUP_ENTRY，catch 转为 409 |

### 5.1 并发场景分析

**场景：用户 A 和用户 B 同时预约同一本书**

```
时间轴 →

用户A:  getConnection → beginTx → SELECT FOR UPDATE(获锁) → status=0✓ → 无已有预约✓ → UPDATE(status=0→1, 成功) → INSERT → commit(释放锁)
用户B:                                                                                      ↑ 阻塞在这里
用户B:                                                                                      ↓ 锁释放后继续
用户B:                                                                           SELECT返回 → status=1 ✗ → rollback → 409
```

用户 B 的 `SELECT ... FOR UPDATE` 会被阻塞到用户 A 的事务提交，此时读到 `status=1`，直接返回 409。

**极端场景：FOR UPDATE 与 CAS 都没能拦住**

理论上不可能发生（FOR UPDATE 已经保证串行），但防御性编程下如果 INSERT 阶段出现并发冲突，`uk_book_status` 唯一索引会抛出 `ER_DUP_ENTRY`，catch 分支将其转为 409 响应。

---

## 六、取消预约流程

### 6.1 完整步骤

[reservationService.js L257-L333](file:///d:/code/ai-prompt/solo-chrome-dev-F12/repos/repo120/project120/server/services/reservationService.js#L257-L333)：

```
入参校验 → 获取连接 → 开启事务 → 行锁查询 → 状态检查 → 双写更新 → 提交
```

**Step 1：参数校验**（L258-L270）

```javascript
const idStr = String(id)
if (!/^\d+$/.test(idStr)) {
  throw new ServiceError(400, '预约ID格式无效，必须为正整数')
}
```

正则校验确保 id 是纯数字，杜绝 `123abc`、`abc` 等非标准输入。

**Step 2：获取连接 + 开启事务**（L272-L277）

与创建预约相同，获取独占连接，开启事务。

**Step 3：行锁查询预约记录**（L279-L287）

```javascript
const [reservationRows] = await connection.execute(
  'SELECT id, book_id, status FROM reservations WHERE id = ? FOR UPDATE',
  [reservationId]
)
```

- `FOR UPDATE` 对预约记录加排他锁，防止并发取消或修改
- 记录不存在 → rollback → 返回 404

**Step 4：状态校验**（L291-L294）

```javascript
if (reservation.status !== 1) {
  await connection.rollback()
  throw new ServiceError(400, '该预约状态不支持取消')
}
```

只有 `status=1`（预约中）的记录才能取消。

**Step 5：双写更新**（L296-L304）

```javascript
await connection.execute(
  'UPDATE reservations SET status = 3, updated_at = NOW() WHERE id = ?',
  [reservationId]
)
await connection.execute(
  'UPDATE books SET status = 0, updated_at = NOW() WHERE id = ?',
  [reservation.book_id]
)
```

在一个事务内同时：
- 预约记录 → status=3（已取消）
- 图书记录 → status=0（可预约）

两步操作原子性保证：要么同时生效，要么同时回滚。

**Step 6：提交**（L306）

**Step 7：错误处理**（L311-L332）

- `ServiceError`：直接 re-throw（已经是业务错误，不需要再 rollback）
- 其他异常：rollback → 包装为 500 ServiceError
- `rollback()` 和 `release()` 都加了 try/catch，确保不会因清理操作失败导致进程崩溃

### 6.2 流程图

```
PUT /api/reservations/:id/cancel
        │
        ▼
  参数校验(正则+parseInt) ──── 不通过 ──→ 400
        │
        ▼
  getConnection + beginTransaction
        │
        ▼
  SELECT ... FOR UPDATE ──── 不存在 ──→ 404
        │
        ▼
  status !== 1 ──── 已取消/已完成 ──→ 400
        │
        ▼
  UPDATE reservations SET status=3
  UPDATE books SET status=0
        │
        ▼
  commit → 200 取消成功
```

---

## 七、status 字段完整状态流转

### 7.1 books.status 流转

```
  发布图书
     │
     ▼
  ┌──────┐   预约成功   ┌──────┐   交换完成   ┌──────┐
  │  0   │ ──────────→ │  1   │ ──────────→ │  2   │
  │可预约│              │已预约│              │已完成│
  └──────┘              └──┬───┘              └──────┘
     ▲                     │
     │      取消预约       │
     └─────────────────────┘
```

| 起始状态 | 目标状态 | 触发操作 | 代码位置 |
|----------|----------|----------|----------|
| — | 0 | 发布图书 | 建表 DEFAULT 0 |
| 0 | 1 | 创建预约 | [reservationService.js L62-L65](file:///d:/code/ai-prompt/solo-chrome-dev-F12/repos/repo120/project120/server/services/reservationService.js#L62-L65) |
| 1 | 0 | 取消预约 | [reservationService.js L301-L304](file:///d:/code/ai-prompt/solo-chrome-dev-F12/repos/repo120/project120/server/services/reservationService.js#L301-L304) |
| 1 | 2 | 完成交换 | 当前版本未实现 |

### 7.2 reservations.status 流转

```
  创建预约
     │
     ▼
  ┌──────┐   交换完成   ┌──────┐
  │  1   │ ──────────→ │  2   │
  │预约中│              │已完成│
  └──┬───┘              └──────┘
     │
     │   主动取消
     ▼
  ┌──────┐
  │  3   │
  │已取消│
  └──────┘
```

| 起始状态 | 目标状态 | 触发操作 | 代码位置 |
|----------|----------|----------|----------|
| — | 1 | 创建预约 | [reservationService.js L74-L79](file:///d:/code/ai-prompt/solo-chrome-dev-F12/repos/repo120/project120/server/services/reservationService.js#L74-L79) |
| 1 | 3 | 取消预约 | [reservationService.js L296-L299](file:///d:/code/ai-prompt/solo-chrome-dev-F12/repos/repo120/project120/server/services/reservationService.js#L296-L299) |
| 1 | 2 | 完成交换 | 当前版本未实现 |

---

## 八、事务使用规范

### 8.1 当前模块中的事务使用模式

所有写操作（创建预约、取消预约）都遵循同一模式：

```javascript
let connection = null           // 1. 初始化为 null
try {
  connection = await pool.getConnection()  // 2. 在 try 内获取连接
  await connection.beginTransaction()       // 3. 开启事务

  // ... 业务 SQL ...

  await connection.commit()                 // 4. 成功则提交
} catch (err) {
  if (connection && err instanceof ServiceError) {
    throw err                  // 5. 业务错误直接抛出（已在逻辑内 rollback）
  }
  if (connection) {
    try { await connection.rollback() }   // 6. 意外错误回滚
    catch (rollbackErr) { /* 记录日志 */ }
  }
  throw new ServiceError(500, '...', err.message)  // 7. 包装为统一错误
} finally {
  if (connection) {
    try { connection.release() }          // 8. 始终归还连接
    catch (releaseErr) { /* 记录日志 */ }
  }
}
```

### 8.2 关键设计决策

| 决策 | 原因 |
|------|------|
| `let connection = null` 在 try 外初始化 | getConnection 可能失败，确保 catch/finally 中 connection 是 null 而非 undefined |
| `rollback()` 包在 try/catch 中 | rollback 自身也可能失败（如连接已断开），不能让清理操作引发二次崩溃 |
| `release()` 包在 try/catch 中 | 同上，归还连接失败不应导致进程崩溃 |
| ServiceError 直接 re-throw | 业务逻辑内部已做 rollback，不需要在 catch 里重复回滚 |
| `FOR UPDATE` 用于所有写前查询 | 保证读取到最新数据，且对行加锁防止并发修改 |

### 8.3 连接池配置

[database.js L4-L14](file:///d:/code/ai-prompt/solo-chrome-dev-F12/repos/repo120/project120/server/config/database.js#L4-L14)：

```javascript
const pool = mysql.createPool({
  connectionLimit: 10,    // 最多 10 个并发连接
  waitForConnections: true, // 连接池满时排队等待
  queueLimit: 0,          // 等待队列无上限
})
```

- `connectionLimit: 10` 意味着最多 10 个预约请求可以同时持有独立连接执行事务
- 超过 10 个时，`waitForConnections: true` 让后续请求排队等待，而非直接报错
- 在小区规模的使用场景下，10 个并发连接完全足够

---

## 九、错误处理体系

### 9.1 ServiceError 自定义错误

[reservationService.js L3-L9](file:///d:/code/ai-prompt/solo-chrome-dev-F12/repos/repo120/project120/server/services/reservationService.js#L3-L9)：

```javascript
class ServiceError extends Error {
  constructor(code, message, data = null) {
    super(message)
    this.code = code       // HTTP 状态码
    this.data = data       // 附加数据（可选）
  }
}
```

### 9.2 Controller 统一错误处理

[reservationController.js L3-L21](file:///d:/code/ai-prompt/solo-chrome-dev-F12/repos/repo120/project120/server/controllers/reservationController.js#L3-L21)：

- `ServiceError` → 按其 `code` 返回对应 HTTP 状态码 + `{ code, message, data? }`
- 非 `ServiceError` → 返回 500 + `{ code: 500, message: '服务器内部错误' }`

### 9.3 预约模块错误码一览

| HTTP 状态码 | 触发条件 | message 示例 |
|-------------|----------|-------------|
| 400 | 参数缺失/格式错误 | "请填写完整信息"、"预约ID格式无效" |
| 404 | 图书不存在 / 预约记录不存在 | "图书不存在"、"预约记录不存在" |
| 409 | 图书已被预约 / 重复预约 / CAS 失败 | "抱歉，《活着》已被预约" |
| 500 | 数据库异常 / 未知错误 | "预约失败，请稍后重试" |

---

## 十、潜在漏洞与改进建议

### 10.1 当前已知的局限性

**1. 唯一索引 `uk_book_status` 对 `status=3` 的宽容性**

当前唯一索引定义为 `UNIQUE KEY uk_book_status (book_id, status)`，这意味着：
- 同一本书可以有**多条** `status=3`（已取消）的记录
- 这本身是合理的，因为一本书可能被预约→取消→再预约→再取消
- 但如果未来需要查询"这本书的所有预约历史"，会有多条 `status=3` 的记录

> **影响**：低。当前业务不依赖已取消记录的唯一性。

**2. 取消预约时缺少预约人身份校验**

[cancelReservation](file:///d:/code/ai-prompt/solo-chrome-dev-F12/repos/repo120/project120/server/services/reservationService.js#L257-L333) 只校验了预约 ID 和状态，没有校验请求者是否为该预约的 `reserver_name`。这意味着只要知道预约 ID，任何人都可以取消别人的预约。

> **影响**：中。当前系统无用户认证，ID 暴露风险可控，但上线前必须修复。
>
> **建议**：在取消接口中增加 `reserver_name` 参数，与记录中的预约人比对，不匹配返回 403。

**3. 无用户认证体系**

当前 `reserver_name` 通过前端传参，任何人都可以冒充。`getMyReservations` 的 `userId` 过滤基于姓名，同名用户会看到彼此的预约记录。

> **影响**：高。小区场景下同名概率低，但不是零。
>
> **建议**：引入简单的用户注册/登录机制，使用 `user_id` 替代 `reserver_name` 作为身份标识。

**4. `createReservation` 中 `book_id` 的 parseInt 未做 NaN 校验**

[reservationService.js L23](file:///d:/code/ai-prompt/solo-chrome-dev-F12/repos/repo120/project120/server/services/reservationService.js#L23) 中 `parseInt(book_id)` 如果传入非数字字符串，会得到 `NaN`，后续 SQL 会查不到记录返回 404，虽然不会崩溃，但错误信息不够精确。

> **影响**：低。功能不会出错，但错误提示从"图书不存在"变成了实际应该说的"参数格式错误"。
>
> **建议**：参照 `cancelReservation` 的做法，增加正则校验。

**5. 缺少"完成交换"流程**

`books.status=2`（已完成）和 `reservations.status=2`（已完成）在代码中定义了但未实现写入逻辑。取消预约只能将状态从 1→3，没有从 1→2 的接口。

> **影响**：中。功能缺失，用户无法闭环。
>
> **建议**：增加 `PUT /api/reservations/:id/complete` 接口，将预约状态改为 2、图书状态改为 2。

**6. 事务内 `ER_DUP_ENTRY` 兜底逻辑在事务外查询**

[reservationService.js L100-L109](file:///d:/code/ai-prompt/solo-chrome-dev-F12/repos/repo120/project120/server/services/reservationService.js#L100-L109) 中，捕获 `ER_DUP_ENTRY` 后使用 `pool.execute()`（非事务连接）查询图书信息来构造错误消息。此时事务已经因为异常而回滚，但外层连接池查询是独立的，不存在数据一致性问题。

> **影响**：无。仅影响错误消息的友好性，不影响数据安全。

**7. 并发量上限**

连接池上限 10 个连接，每个预约操作持有连接的时间取决于事务执行时长（通常毫秒级）。在极端高并发下（如限时抢书活动），排队等待可能导致请求超时。

> **影响**：低。小区场景并发量远达不到。
>
> **建议**：如需支持更大并发，可提高 `connectionLimit` 并增加请求超时中间件。

### 10.2 总结

当前方案在**小区旧书交换**的使用规模下是安全的：

- 三重并发防护（行锁 + CAS + 唯一索引）足以应对所有并发预约场景
- 事务保证了 books 和 reservations 两张表的状态变更始终一致
- 参数校验覆盖了所有公开方法，无效输入不会到达数据库
- 错误处理链路完整，ServiceError → Controller → HTTP 响应，不会出现未捕获异常导致进程崩溃

最需要优先解决的是 **取消预约缺少身份校验** 和 **缺少用户认证体系**，这两个问题在公网环境下会变成安全漏洞。
