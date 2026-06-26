-- 旧书交换平台测试数据
-- 使用方法：在 MySQL 中执行 source init_data.sql

USE book_exchange;

-- 清空现有数据（可选）
-- TRUNCATE TABLE reservations;
-- TRUNCATE TABLE books;

-- 插入测试图书数据
INSERT INTO books (title, author, category, book_condition, cover_image, status, publisher, description, owner_name, owner_contact) VALUES
('活着', '余华', '文学', 2, 'https://img3.doubanio.com/view/subject/l/public/s1078983.jpg', 0, '作家出版社', '《活着》是余华的代表作之一，讲述了农村人福贵悲惨的人生遭遇。', '张阿姨', '13800138001'),
('三体', '刘慈欣', '科技', 3, 'https://img9.doubanio.com/view/subject/l/public/s29670277.jpg', 0, '重庆出版社', '文化大革命如火如荼进行的同时，军方探寻外星文明的绝秘计划"红岸工程"取得了突破性进展。', '李叔叔', '13800138002'),
('人类简史', '尤瓦尔·赫拉利', '历史', 1, 'https://img9.doubanio.com/view/subject/l/public/s27826844.jpg', 0, '中信出版社', '十万年前，地球上至少有六种不同的人，但今日，世界舞台为什么只剩下了我们自己？', '王老师', '13800138003'),
('苏菲的世界', '乔斯坦·贾德', '哲学', 4, 'https://img9.doubanio.com/view/subject/l/public/s1102235.jpg', 0, '作家出版社', '14岁的少女苏菲某天放学回家，收到了神秘的一封信——"你是谁？世界从哪里来？"', '刘奶奶', '13800138004'),
('小王子', '安托万·德·圣-埃克苏佩里', '文学', 2, 'https://img9.doubanio.com/view/subject/l/public/s1456234.jpg', 0, '人民文学出版社', '小王子是一个超凡脱俗的仙童，他住在一颗只比他大一丁点儿的小行星上。', '陈叔叔', '13800138005'),
('JavaScript高级程序设计', '马特·弗里斯比', '科技', 2, 'https://img9.doubanio.com/view/subject/l/public/s33692837.jpg', 0, '人民邮电出版社', '本书是JavaScript超级畅销书的最新版，从变量、数据类型、函数开始，到对象、操作符、原型链，再到DOM、BOM、事件、Ajax、Canvas、WebGL，内容全面且深入。', '赵程序员', '13800138006'),
('百年孤独', '加西亚·马尔克斯', '文学', 3, 'https://img9.doubanio.com/view/subject/l/public/s1077892.jpg', 0, '南海出版公司', '《百年孤独》是魔幻现实主义文学的代表作，描写了布恩迪亚家族七代人的传奇故事。', '周阿姨', '13800138007'),
('经济学原理', '曼昆', '其他', 2, 'https://img9.doubanio.com/view/subject/l/public/s1107318.jpg', 0, '北京大学出版社', '《经济学原理》是目前国内市场上最受欢迎的经济学入门教材。', '吴老师', '13800138008');
