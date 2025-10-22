import { ref, reactive, onMounted, onUnmounted, watch, nextTick } from "vue";
import { putLocale } from "./locale.js";
import SvgCanvas from "@svgedit/svgcanvas";
import Rulers from "./Rulers.js";

// 引入Vue全局事件总线（假设已在项目中配置）
import eventBus from "./eventBus.js";

export default class EditorStartup {
  constructor() {
    // 使用Vue的响应式特性存储状态
    this.state = reactive({
      extensionsAdded: false,
      messageQueue: [],
      container: null,
      svgEditor: null,
      workarea: null,
      svgCanvas: null,
      rulers: null,
      exportWindow: null,
      showSaveWarning: true,
      winWh: {
        width: 0,
        height: 0,
      },
      panning: false,
      keypan: false,
      lastX: null,
      lastY: null,
    });

    // 缓存相关
    this.storage = window.localStorage ? window.localStorage : null;

    // 绑定方法上下文
    this.selectedChanged = this.selectedChanged.bind(this);
    this.elementTransition = this.elementTransition.bind(this);
    this.elementChanged = this.elementChanged.bind(this);
    this.exportHandler = this.exportHandler.bind(this);
    this.zoomChanged = this.zoomChanged.bind(this);
    this.zoomDone = this.zoomDone.bind(this);
    this.updateCanvas = this.updateCanvas.bind(this);
    this.contextChanged = this.contextChanged.bind(this);
    this.elementRenamed = this.elementRenamed.bind(this);
    this.beforeClear = this.beforeClear.bind(this);
    this.afterClear = this.afterClear.bind(this);
    this.handleScroll = this.handleScroll.bind(this);
    this.handleResize = this.handleResize.bind(this);
    this.handleMouseUp = this.handleMouseUp.bind(this);
    this.handleMouseMove = this.handleMouseMove.bind(this);
    this.handleMouseDown = this.handleMouseDown.bind(this);
    this.handleWindowMouseUp = this.handleWindowMouseUp.bind(this);
    this.handleKeyDown = this.handleKeyDown.bind(this);
    this.handleKeyUp = this.handleKeyUp.bind(this);
    this.handleBeforeUnload = this.handleBeforeUnload.bind(this);
  }

  /**
   * 初始化编辑器
   * @param {Object} options - 初始化选项
   * @param {HTMLElement} options.container - 容器元素
   * @param {Object} options.config - 配置对象
   * @param {Object} options.i18next - 国际化对象
   */
  async init(options) {
    const { container, config, i18next } = options;

    // 保存配置和国际化对象
    this.configObj = config;
    this.i18next = i18next;

    // 加载配置
    this.configObj.load();

    // 设置容器引用
    this.state.container = container;

    // 等待DOM更新后再获取元素
    await nextTick();

    // 获取DOM元素
    this.state.workarea = container.querySelector("#workarea");
    this.state.svgCanvasElement = container.querySelector("#svgcanvas");

    // 创建SVG画布
    this.state.svgCanvas = new SvgCanvas(
      this.state.svgCanvasElement,
      this.configObj.curConfig
    );

    // 触发就绪信号
    this.readySignal();

    // 获取撤销管理器
    const { undoMgr } = this.state.svgCanvas;

    // 绑定画布事件
    this.bindCanvasEvents();

    // 设置文本输入元素
    this.state.svgCanvas.textActions.setInputElem(
      container.querySelector("#text")
    );

    // 设置背景
    this.setBackground(
      this.configObj.pref("bkgd_color"),
      this.configObj.pref("bkgd_url")
    );

    // 更新分辨率
    const res = this.state.svgCanvas.getResolution();
    if (this.configObj.curConfig.baseUnit !== "px") {
      res.w = SvgCanvas.convertUnit(res.w) + this.configObj.curConfig.baseUnit;
      res.h = SvgCanvas.convertUnit(res.h) + this.configObj.curConfig.baseUnit;
    }

    // 初始化标尺
    this.state.rulers = new Rulers(this);

    // 更新画布
    this.updateCanvas(true);

    // 设置窗口尺寸
    this.state.winWh = {
      width: this.getWidth(),
      height: this.getHeight(),
    };

    // 绑定事件监听器
    this.bindEventListeners();

    // 执行回调
    await this.runCallbacks();

    // 通过Vue事件总线通知编辑器已就绪
    eventBus.emit("svgEditorReady", this);
  }

  /**
   * 绑定画布事件
   */
  bindCanvasEvents() {
    const { svgCanvas } = this.state;

    svgCanvas.bind("selected", this.selectedChanged);
    svgCanvas.bind("transition", this.elementTransition);
    svgCanvas.bind("changed", this.elementChanged);
    svgCanvas.bind("exported", this.exportHandler);
    svgCanvas.bind("exportedPDF", this.handleExportedPDF.bind(this));
    svgCanvas.bind("zoomed", this.zoomChanged);
    svgCanvas.bind("zoomDone", this.zoomDone);
    svgCanvas.bind("updateCanvas", (win, centerInfo) => {
      this.updateCanvas(centerInfo.center, centerInfo.newCtr);
    });
    svgCanvas.bind("contextset", this.contextChanged);
    svgCanvas.bind("elementRenamed", this.elementRenamed);
    svgCanvas.bind("beforeClear", this.beforeClear);
    svgCanvas.bind("afterClear", this.afterClear);
  }

  /**
   * 绑定事件监听器
   */
  bindEventListeners() {
    // 滚动事件
    this.state.workarea.addEventListener("mousewheel", this.handleScroll);

    // 窗口大小改变事件
    window.addEventListener("resize", this.handleResize);

    // 工作区滚动事件
    this.state.workarea.addEventListener("scroll", () => {
      this.state.rulers?.manageScroll();
    });

    // 鼠标事件
    this.state.svgCanvasElement.addEventListener("mouseup", this.handleMouseUp);
    this.state.svgCanvasElement.addEventListener(
      "mousemove",
      this.handleMouseMove
    );
    this.state.svgCanvasElement.addEventListener(
      "mousedown",
      this.handleMouseDown
    );
    window.addEventListener("mouseup", this.handleWindowMouseUp);

    // 键盘事件
    document.addEventListener("keydown", this.handleKeyDown);
    document.addEventListener("keyup", this.handleKeyUp);

    // 页面卸载事件
    window.addEventListener("beforeunload", this.handleBeforeUnload);
  }

  /**
   * 移除事件监听器（在组件卸载时调用）
   */
  unbindEventListeners() {
    if (this.state.workarea) {
      this.state.workarea.removeEventListener("mousewheel", this.handleScroll);
      this.state.workarea.removeEventListener("scroll", () => {
        this.state.rulers?.manageScroll();
      });
    }

    if (this.state.svgCanvasElement) {
      this.state.svgCanvasElement.removeEventListener(
        "mouseup",
        this.handleMouseUp
      );
      this.state.svgCanvasElement.removeEventListener(
        "mousemove",
        this.handleMouseMove
      );
      this.state.svgCanvasElement.removeEventListener(
        "mousedown",
        this.handleMouseDown
      );
    }

    window.removeEventListener("resize", this.handleResize);
    window.removeEventListener("mouseup", this.handleWindowMouseUp);
    document.removeEventListener("keydown", this.handleKeyDown);
    document.removeEventListener("keyup", this.handleKeyUp);
    window.removeEventListener("beforeunload", this.handleBeforeUnload);
  }

  /**
   * 发送就绪信号
   */
  readySignal() {
    // 让父窗口知道SVG编辑器已就绪
    const w = window.opener || window.parent;
    if (w) {
      try {
        const svgEditorReadyEvent = new w.CustomEvent("svgEditorReady", {
          bubbles: true,
          cancelable: true,
        });
        w.document.documentElement.dispatchEvent(svgEditorReadyEvent);
      } catch (e) {
        // 忽略错误
      }
    }

    // 通过Vue事件总线发送就绪事件
    eventBus.emit("editorReady", this);
  }

  /**
   * 设置背景
   * @param {string} color - 背景颜色
   * @param {string} url - 背景图片URL
   */
  setBackground(color, url) {
    // 实现背景设置逻辑
    if (this.state.svgCanvas) {
      this.state.svgCanvas.setBackground(color, url);
    }
  }

  /**
   * 获取窗口宽度
   */
  getWidth() {
    return Math.max(
      document.body.scrollWidth,
      document.documentElement.scrollWidth,
      document.body.offsetWidth,
      document.documentElement.offsetWidth,
      document.documentElement.clientWidth
    );
  }

  /**
   * 获取窗口高度
   */
  getHeight() {
    return Math.max(
      document.body.scrollHeight,
      document.documentElement.scrollHeight,
      document.body.offsetHeight,
      document.documentElement.offsetHeight,
      document.documentElement.clientHeight
    );
  }

  /**
   * 处理PDF导出
   */
  handleExportedPDF(win, data) {
    if (!data.output) {
      return;
    }

    const { exportWindowName } = data;
    if (exportWindowName) {
      this.state.exportWindow = window.open("", exportWindowName);
    }

    if (!this.state.exportWindow || this.state.exportWindow.closed) {
      // 使用Vue事件总线触发提示，让组件处理UI展示
      eventBus.emit(
        "showAlert",
        this.i18next.t("notification.popupWindowBlocked")
      );
      return;
    }

    this.state.exportWindow.location.href = data.output;
  }

  /**
   * 处理窗口大小改变
   */
  handleResize() {
    const { winWh } = this.state;

    Object.entries(winWh).forEach(([type, val]) => {
      const curval =
        type === "width" ? window.innerWidth - 15 : window.innerHeight;
      this.state.workarea[`scroll${type === "width" ? "Left" : "Top"}`] -=
        (curval - val) / 2;
      winWh[type] = curval;
    });
  }

  /**
   * 处理鼠标抬起事件
   */
  handleMouseUp(evt) {
    if (this.state.panning === false) {
      return true;
    }

    this.state.workarea.scrollLeft -= evt.clientX - this.state.lastX;
    this.state.workarea.scrollTop -= evt.clientY - this.state.lastY;

    this.state.lastX = evt.clientX;
    this.state.lastY = evt.clientY;

    if (evt.type === "mouseup") {
      this.state.panning = false;
    }
    return false;
  }

  /**
   * 处理鼠标移动事件
   */
  handleMouseMove(evt) {
    if (this.state.panning === false) {
      return true;
    }

    this.state.workarea.scrollLeft -= evt.clientX - this.state.lastX;
    this.state.workarea.scrollTop -= evt.clientY - this.state.lastY;

    this.state.lastX = evt.clientX;
    this.state.lastY = evt.clientY;

    return false;
  }

  /**
   * 处理鼠标按下事件
   */
  handleMouseDown(evt) {
    if (evt.button === 1 || this.state.keypan === true) {
      this.state.panning = true;
      this.state.lastX = evt.clientX;
      this.state.lastY = evt.clientY;
      return false;
    }
    return true;
  }

  /**
   * 处理窗口鼠标抬起事件
   */
  handleWindowMouseUp() {
    this.state.panning = false;
  }

  /**
   * 处理键盘按下事件
   */
  handleKeyDown(e) {
    if (e.target.nodeName !== "BODY") return;

    if (e.code.toLowerCase() === "space") {
      this.state.svgCanvas.spaceKey = true;
      this.state.keypan = true;
      e.preventDefault();
    } else if (
      e.key.toLowerCase() === "shift" &&
      this.state.svgCanvas.getMode() === "zoom"
    ) {
      this.state.workarea.style.cursor = "zoom-out";
      e.preventDefault();
    }
  }

  /**
   * 处理键盘抬起事件
   */
  handleKeyUp(e) {
    if (e.target.nodeName !== "BODY") return;

    if (e.code.toLowerCase() === "space") {
      this.state.svgCanvas.spaceKey = false;
      this.state.keypan = false;
      e.preventDefault();
    } else if (
      e.key.toLowerCase() === "shift" &&
      this.state.svgCanvas.getMode() === "zoom"
    ) {
      this.state.workarea.style.cursor = "zoom-in";
      e.preventDefault();
    }
  }

  /**
   * 处理页面卸载前事件
   */
  handleBeforeUnload(e) {
    const { undoMgr } = this.state.svgCanvas;

    // 如果页面为空，则不显示警告
    if (undoMgr.getUndoStackSize() === 0) {
      this.state.showSaveWarning = false;
    }

    // 当页面已保存时，showSaveWarning 设为 false
    if (
      !this.configObj.curConfig.no_save_warning &&
      this.state.showSaveWarning
    ) {
      e.returnValue = this.i18next.t("notification.unsavedChanges");
      return this.i18next.t("notification.unsavedChanges");
    }
    return true;
  }

  /**
   * 运行回调函数
   */
  async runCallbacks() {
    // 可以通过Vue事件总线触发需要在编辑器就绪后执行的回调
    await eventBus.emitAsync("editorCallbacks", this);
  }

  // 以下是需要根据实际业务逻辑实现的事件处理方法
  selectedChanged() {
    eventBus.emit("selectedChanged", ...arguments);
  }

  elementTransition() {
    eventBus.emit("elementTransition", ...arguments);
  }

  elementChanged() {
    eventBus.emit("elementChanged", ...arguments);
  }

  exportHandler() {
    eventBus.emit("exported", ...arguments);
  }

  zoomChanged() {
    eventBus.emit("zoomed", ...arguments);
  }

  zoomDone() {
    eventBus.emit("zoomDone", ...arguments);
  }

  updateCanvas(center, newCtr) {
    // 实现画布更新逻辑
    eventBus.emit("updateCanvas", { center, newCtr });
  }

  contextChanged() {
    eventBus.emit("contextChanged", ...arguments);
  }

  elementRenamed() {
    eventBus.emit("elementRenamed", ...arguments);
  }

  beforeClear() {
    eventBus.emit("beforeClear", ...arguments);
  }

  afterClear() {
    eventBus.emit("afterClear", ...arguments);
  }

  handleScroll() {
    eventBus.emit("scroll", ...arguments);
  }

  /**
   * 销毁编辑器实例
   */
  destroy() {
    this.unbindEventListeners();

    // 清理画布
    if (this.state.svgCanvas) {
      // 如果有销毁方法的话
      if (this.state.svgCanvas.destroy) {
        this.state.svgCanvas.destroy();
      }
      this.state.svgCanvas = null;
    }

    // 清空状态
    Object.keys(this.state).forEach((key) => {
      this.state[key] = null;
    });

    // 触发销毁事件
    eventBus.emit("editorDestroyed", this);
  }
}
