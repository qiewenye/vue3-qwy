export default function (plop) {
  plop.setGenerator('sass', {
    description: '创建 Sass 目录结构',
    actions: [
      // 创建主目录和入口文件
      { type: 'add', path: 'src/styles/main.scss', template: '@use "./abstracts";\n@use "./base";\n@use "./components";' },
      // 抽象层
      { type: 'add', path: 'src/styles/abstracts/_variables.scss', template: '$color-primary: #333;\n$spacing: 8px;' },
      { type: 'add', path: 'src/styles/abstracts/_mixins.scss', template: '@mixin center { display: flex; align-items: center; justify-content: center; }' },
      { type: 'add', path: 'src/styles/abstracts/index.scss', template: '@forward "./variables";\n@forward "./mixins";' },
      // 基础层
      { type: 'add', path: 'src/styles/base/_reset.scss', template: '* { margin: 0; padding: 0; box-sizing: border-box; }' },
      { type: 'add', path: 'src/styles/base/index.scss', template: '@forward "./reset";' },
      // 组件层
      { type: 'add', path: 'src/styles/components/_button.scss', template: '.btn { padding: $spacing * 2; }' },
      { type: 'add', path: 'src/styles/components/index.scss', template: '@forward "./button";' },
    ]
  });
};