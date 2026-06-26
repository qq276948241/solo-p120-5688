<template>
  <div id="app">
    <el-container class="layout-container">
      <el-header class="header">
        <div class="logo">📚 旧书交换平台</div>
        <el-menu mode="horizontal" :router="true" class="menu">
          <el-menu-item index="/">图书列表</el-menu-item>
          <el-menu-item index="/publish">发布图书</el-menu-item>
        </el-menu>
      </el-header>
      <el-main class="main">
        <router-view />
      </el-main>
      <el-footer class="footer">
        © 2026 小区旧书交换平台 - 与邻居分享知识
      </el-footer>
    </el-container>
  </div>
</template>

<script setup>
</script>

<style>
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
  background-color: #f5f7fa;
}

.layout-container {
  min-height: 100vh;
}

.header {
  background-color: #fff;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  display: flex;
  align-items: center;
  padding: 0 40px;
}

.logo {
  font-size: 20px;
  font-weight: bold;
  color: #409eff;
  margin-right: 40px;
}

.menu {
  flex: 1;
  border-bottom: none;
}

.main {
  padding: 20px 40px;
  max-width: 1400px;
  margin: 0 auto;
  width: 100%;
}

.footer {
  background-color: #fff;
  text-align: center;
  color: #909399;
  padding: 20px;
  border-top: 1px solid #e4e7ed;
}
</style>
