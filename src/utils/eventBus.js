// 基于mitt实现Vue事件总线（需先安装：npm install mitt）
import mitt from 'mitt';

/**
 * SVG编辑器事件总线
 * 事件列表：
 * - svgEditorReady: 编辑器初始化完成
 * - svgEditorInitialized: 编辑器核心功能就绪
 * - svgEditorInitError: 编辑器初始化失败
 * - showAlert: 显示提示信息
 * - shortcutTriggered: 快捷键触发
 * - shortcutError: 快捷键执行失败
 * - svgLoadedSuccess: SVG加载成功
 * - svgLoadedError: SVG加载失败
 * - selectedChanged: 元素选中状态变化
 * - elementChanged: 元素属性变化
 */
const eventBus = mitt();

// 导出事件总线实例
export default eventBus;