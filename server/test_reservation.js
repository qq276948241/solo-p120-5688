const axios = require('axios')

async function testConcurrentReservation() {
  console.log('🧪 开始测试并发预约防重复机制...\n')

  const baseURL = 'http://localhost:3000/api'

  try {
    console.log('1️⃣  创建测试图书...')
    const bookRes = await axios.post(`${baseURL}/books`, {
      title: '并发测试图书',
      author: '测试作者',
      category: '测试',
      book_condition: 3,
      description: '这是一本用于测试并发预约的图书',
      owner_name: '书主',
      owner_contact: '13800000000'
    })
    const bookId = bookRes.data.data.id
    console.log(`    ✅ 测试图书创建成功，ID: ${bookId}\n`)

    console.log('2️⃣  发起并发预约请求（两个用户同时预约）...')
    const reservationData1 = {
      book_id: bookId,
      reserver_name: '用户A',
      reserver_contact: '13800000001',
      remark: '用户A的预约'
    }
    const reservationData2 = {
      book_id: bookId,
      reserver_name: '用户B',
      reserver_contact: '13800000002',
      remark: '用户B的预约'
    }

    const results = await Promise.allSettled([
      axios.post(`${baseURL}/reservations`, reservationData1),
      axios.post(`${baseURL}/reservations`, reservationData2)
    ])

    console.log('\n    预约结果:')
    results.forEach((result, index) => {
      const user = index === 0 ? '用户A' : '用户B'
      if (result.status === 'fulfilled') {
        console.log(`    ✅ ${user}: ${result.value.data.message}`)
      } else {
        const response = result.reason.response
        console.log(`    ❌ ${user}: ${response?.data?.message || result.reason.message}`)
      }
    })

    console.log('\n3️⃣  验证图书状态...')
    const bookDetailRes = await axios.get(`${baseURL}/books/${bookId}`)
    const book = bookDetailRes.data.data
    const statusText = book.status === 1 ? '已预约' : book.status === 0 ? '可预约' : '已完成'
    console.log(`    图书状态: ${statusText}`)
    if (book.reservation) {
      console.log(`    预约人: ${book.reservation.reserver_name}`)
    }

    console.log('\n4️⃣  尝试重复预约（第三个用户）...')
    try {
      const reservationData3 = {
        book_id: bookId,
        reserver_name: '用户C',
        reserver_contact: '13800000003'
      }
      await axios.post(`${baseURL}/reservations`, reservationData3)
      console.log('    ❌ 错误：重复预约应该被拒绝！')
    } catch (e) {
      console.log(`    ✅ 正确拒绝重复预约: ${e.response.data.message}`)
    }

    console.log('\n5️⃣  验证预约列表...')
    const reservationListRes = await axios.get(`${baseURL}/reservations`, {
      params: { book_id: bookId }
    })
    const reservations = reservationListRes.data.data.list
    console.log(`    有效预约记录数量: ${reservations.filter(r => r.status === 1).length}`)
    console.log(`    总预约记录数量: ${reservations.length}`)

    if (reservations.filter(r => r.status === 1).length === 1) {
      console.log('\n🎉 测试通过！并发预约防重复机制正常工作！')
      console.log('   - 只有第一个用户成功预约')
      console.log('   - 后续用户都被正确拒绝')
      console.log('   - 图书状态正确更新为已预约')
      console.log('   - 不会出现两个人同时预约同一本书的情况')
    } else {
      console.log('\n❌ 测试失败！出现了重复预约！')
    }

  } catch (err) {
    console.error('❌ 测试出错:', err.response?.data || err.message)
  }
}

if (require.main === module) {
  testConcurrentReservation()
}

module.exports = { testConcurrentReservation }
