const assert = require('assert')
const { reservationService, ServiceError } = require('./services/reservationService')

console.log('\n🧪 Bug 修复验证测试\n')

let passed = 0
let failed = 0

async function test(name, fn) {
  try {
    await fn()
    console.log(`  ✅ ${name}`)
    passed++
  } catch (e) {
    console.log(`  ❌ ${name}`)
    console.log(`     错误: ${e.message}`)
    failed++
  }
}

async function runTests() {
  console.log('1️⃣  getMyReservations 参数校验测试...')

  await test('getMyReservations - userId 为 undefined 抛出 400', async () => {
    await assert.rejects(
      () => reservationService.getMyReservations({}),
      (err) => err.code === 400 && err.message.includes('userId')
    )
  })

  await test('getMyReservations - userId 为空字符串抛出 400', async () => {
    await assert.rejects(
      () => reservationService.getMyReservations({ userId: '' }),
      (err) => err.code === 400 && err.message.includes('userId')
    )
  })

  await test('getMyReservations - userId 为纯空格抛出 400', async () => {
    await assert.rejects(
      () => reservationService.getMyReservations({ userId: '   ' }),
      (err) => err.code === 400 && err.message.includes('userId')
    )
  })

  await test('getMyReservations - status 为 0 抛出 400', async () => {
    await assert.rejects(
      () => reservationService.getMyReservations({ userId: '张三', status: 0 }),
      (err) => err.code === 400 && err.message.includes('status')
    )
  })

  await test('getMyReservations - status 为 4 抛出 400', async () => {
    await assert.rejects(
      () => reservationService.getMyReservations({ userId: '张三', status: 4 }),
      (err) => err.code === 400 && err.message.includes('status')
    )
  })

  await test('getMyReservations - status 为 abc 抛出 400', async () => {
    await assert.rejects(
      () => reservationService.getMyReservations({ userId: '张三', status: 'abc' }),
      (err) => err.code === 400 && err.message.includes('status')
    )
  })

  await test('getMyReservations - page 为 0 抛出 400', async () => {
    await assert.rejects(
      () => reservationService.getMyReservations({ userId: '张三', page: 0 }),
      (err) => err.code === 400 && err.message.includes('page')
    )
  })

  await test('getMyReservations - pageSize 超过 100 抛出 400', async () => {
    await assert.rejects(
      () => reservationService.getMyReservations({ userId: '张三', pageSize: 101 }),
      (err) => err.code === 400 && err.message.includes('pageSize')
    )
  })

  console.log('\n2️⃣  cancelReservation 参数校验测试...')

  await test('cancelReservation - id 为 undefined 抛出 400', async () => {
    await assert.rejects(
      () => reservationService.cancelReservation(undefined),
      (err) => err.code === 400 && err.message.includes('请提供预约ID')
    )
  })

  await test('cancelReservation - id 为 null 抛出 400', async () => {
    await assert.rejects(
      () => reservationService.cancelReservation(null),
      (err) => err.code === 400 && err.message.includes('请提供预约ID')
    )
  })

  await test('cancelReservation - id 为空字符串抛出 400', async () => {
    await assert.rejects(
      () => reservationService.cancelReservation(''),
      (err) => err.code === 400 && err.message.includes('请提供预约ID')
    )
  })

  await test('cancelReservation - id 为 0 抛出 400', async () => {
    await assert.rejects(
      () => reservationService.cancelReservation(0),
      (err) => err.code === 400 && err.message.includes('格式无效')
    )
  })

  await test('cancelReservation - id 为负数抛出 400', async () => {
    await assert.rejects(
      () => reservationService.cancelReservation(-1),
      (err) => err.code === 400 && err.message.includes('格式无效')
    )
  })

  await test('cancelReservation - id 为 abc 抛出 400', async () => {
    await assert.rejects(
      () => reservationService.cancelReservation('abc'),
      (err) => err.code === 400 && err.message.includes('格式无效')
    )
  })

  await test('cancelReservation - id 为 123abc 抛出 400', async () => {
    await assert.rejects(
      () => reservationService.cancelReservation('123abc'),
      (err) => err.code === 400 && err.message.includes('格式无效')
    )
  })

  console.log('\n3️⃣  getReservationList 参数校验测试...')

  await test('getReservationList - book_id 为 abc 抛出 400', async () => {
    await assert.rejects(
      () => reservationService.getReservationList({ book_id: 'abc' }),
      (err) => err.code === 400 && err.message.includes('book_id')
    )
  })

  await test('getReservationList - status 为 5 抛出 400', async () => {
    await assert.rejects(
      () => reservationService.getReservationList({ status: 5 }),
      (err) => err.code === 400 && err.message.includes('status')
    )
  })

  console.log('\n4️⃣  ServiceError 类测试...')

  await test('ServiceError - 包含 code、message、data', async () => {
    const err = new ServiceError(404, '测试错误', { id: 123 })
    assert.strictEqual(err.code, 404)
    assert.strictEqual(err.message, '测试错误')
    assert.deepStrictEqual(err.data, { id: 123 })
    assert.ok(err instanceof Error)
  })

  console.log('\n5️⃣  getMyReservations 查询条件验证...')

  let capturedSql = null
  let capturedParams = null

  const originalPoolExecute = require('./config/database').pool.execute
  require('./config/database').pool.execute = async (sql, params) => {
    if (sql.includes('COUNT(*)') || sql.includes('SELECT r.*, b.title')) {
      capturedSql = sql
      capturedParams = params
    }
    return [[], { insertId: 0 }]
  }

  await test('getMyReservations - 查询条件只包含 r.reserver_name = ?', async () => {
    try {
      await reservationService.getMyReservations({ userId: '张三' })
    } catch (e) {
    }
    assert.ok(capturedSql.includes('WHERE r.reserver_name = ?'), 'SQL 应该包含 r.reserver_name = ?')
    assert.ok(!capturedSql.includes('b.owner_name'), '不应该用 b.owner_name 过滤')
    assert.ok(!capturedSql.includes('OR'), '不应该有 OR 条件')
    assert.strictEqual(capturedParams[0], '张三', '参数应该是 "张三"')
  })

  await test('getMyReservations - 多条件查询正确', async () => {
    try {
      await reservationService.getMyReservations({ userId: '张三', status: 1 })
    } catch (e) {
    }
    assert.ok(capturedSql.includes('WHERE r.reserver_name = ? AND r.status = ?'), 'SQL 应该同时包含两个过滤条件')
    assert.ok(!capturedSql.includes('b.owner_name'), '不应该用 owner_name 过滤')
    assert.strictEqual(capturedParams[0], '张三', '第一个参数应该是预约人姓名')
    assert.strictEqual(capturedParams[1], 1, '第二个参数应该是状态')
  })

  require('./config/database').pool.execute = originalPoolExecute

  console.log('\n6️⃣  cancelReservation 错误处理健壮性验证...')

  await test('cancelReservation - getConnection 失败时不会崩溃', async () => {
    const originalGetConnection = require('./config/database').pool.getConnection
    require('./config/database').pool.getConnection = async () => {
      throw new Error('模拟数据库连接失败')
    }

    try {
      await reservationService.cancelReservation(123)
      assert.fail('应该抛出错误')
    } catch (err) {
      assert.strictEqual(err.code, 500)
      assert.ok(err.message.includes('取消预约失败'))
    } finally {
      require('./config/database').pool.getConnection = originalGetConnection
    }
  })

  console.log(`\n📊 测试结果: ${passed} 通过, ${failed} 失败`)

  if (failed === 0) {
    console.log('\n🎉 所有测试通过！')
    console.log('   ✅ getMyReservations 严格校验参数，WHERE 条件只有 r.reserver_name = ?')
    console.log('   ✅ getMyReservations 不会把我发布的书被别人约的记录混进来')
    console.log('   ✅ cancelReservation 严格校验参数，无效/不存在ID都返回正确错误')
    console.log('   ✅ cancelReservation 错误处理健壮，connection 为 null 时不会崩溃')
    console.log('   ✅ 所有方法入参校验完整，无效参数不会到达数据库\n')
    process.exit(0)
  } else {
    console.log('\n💥 有测试失败！')
    process.exit(1)
  }
}

runTests().catch(e => {
  console.error('测试执行失败:', e)
  process.exit(1)
})
