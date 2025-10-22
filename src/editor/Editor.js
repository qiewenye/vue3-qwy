import { ref, reactive, watch, nextTick, onUnmounted } from 'vue';
import { isMac } from "@svgedit/svgcanvas/common/browser";
import SvgCanvas from "@svgedit/svgcanvas";
import ConfigObj from "./ConfigObj.js";
import EditorStartup from "./EditorStartup.js";
import { getParentsUntil } from "@svgedit/svgcanvas/common/util.js";
import { storeToRefs } from "pinia";

// 引入Vue事件总线
import eventBus from '@/utils/eventBus.js';
// 引入Pinia状态管理
import { useConfig, element } from "@/stores/index";

// 工具方法
const { $id, decode64 } = SvgCanvas;

export default class Editor extends EditorStartup {
  constructor(div = null) {
    super();

    // --------------------------
    // 1. Vue响应式状态管理
    // --------------------------
    this.state = reactive({
      langChanged: false,
      showSaveWarning: true,
      title: "pattern.svg",
      isReady: false,
      customExportImage: false,
      customExportPDF: false,
      curContext: null,
      exportWindowName: null,
      docprops: false,
      canvMenu: null,
      selectedElement: null, // 当前选中元素
      multiselected: false,  // 多选状态
      storagePromptState: "ignore",
      zoomLevel: 100,        // 缩放比例（百分比）
      wireframeRule: ""      // 线框模式样式
    });

    // --------------------------
    // 2. Pinia状态管理
    // --------------------------
    this.configStore = useConfig();
    this.elementAttrStore = element();
    const { canvasMode, selected } = storeToRefs(this.configStore);
    const { attr } = storeToRefs(this.elementAttrStore);

    // 监听画布模式变化
    watch(canvasMode, (newMode) => {
      if (newMode === "select" && this.state.svgCanvas) {
        this.state.svgCanvas.setMode(newMode);
      }
    });

    // --------------------------
    // 3. 初始化配置
    // --------------------------
    this.configObj = new ConfigObj(this);
    this.configObj.pref = this.configObj.pref.bind(this.configObj);
    this.setConfig = this.configObj.setConfig.bind(this.configObj);
    
    // 快捷键配置（区分系统）
    const modKey = isMac() ? "meta+" : "ctrl+";
    this.shortcuts = this.initShortcuts(modKey);
    
    this.callbacks = [];
    this._keyDownHandler = null; // 用于解绑键盘事件

    // 绑定方法与事件
    this.bindInstanceMethods();
    this.setAll();
    this.registerVueEventListeners();
  }

  /**
   * 初始化快捷键配置
   */
  initShortcuts(modKey) {
    return [
      // 旋转操作
      { key: "ctrl+arrowleft", fn: () => this.rotateSelected(0, 1) },
      { key: "ctrl+arrowright", fn: () => this.rotateSelected(1, 1) },
      { key: "shift+ctrl+arrowleft", fn: () => this.rotateSelected(0, 5) },
      { key: "shift+ctrl+arrowright", fn: () => this.rotateSelected(1, 5) },
      
      // 元素选择
      { key: "shift+o", fn: () => this.state.svgCanvas?.cycleElement(0) },
      { key: "shift+p", fn: () => this.state.svgCanvas?.cycleElement(1) },
      { key: "tab", fn: () => this.state.svgCanvas?.cycleElement(0) },
      { key: "shift+tab", fn: () => this.state.svgCanvas?.cycleElement(1) },
      
      // 缩放控制
      { key: [modKey + "arrowup", true], fn: () => this.zoomImage(2) },
      { key: [modKey + "arrowdown", true], fn: () => this.zoomImage(0.5) },
      
      // 层级调整
      { key: [modKey + "]", true], fn: () => this.moveUpDownSelected("Up") },
      { key: [modKey + "[", true], fn: () => this.moveUpDownSelected("Down") },
      
      // 元素移动（1px）
      { key: ["arrowup", true], fn: () => this.moveSelected(0, -1) },
      { key: ["arrowdown", true], fn: () => this.moveSelected(0, 1) },
      { key: ["arrowleft", true], fn: () => this.moveSelected(-1, 0) },
      { key: ["arrowright", true], fn: () => this.moveSelected(1, 0) },
      
      // 元素移动（10px）
      { key: "shift+arrowup", fn: () => this.moveSelected(0, -10) },
      { key: "shift+arrowdown", fn: () => this.moveSelected(0, 10) },
      { key: "shift+arrowleft", fn: () => this.moveSelected(-10, 0) },
      { key: "shift+arrowright", fn: () => this.moveSelected(10, 0) },
      
      // 元素复制
      { key: ["alt+arrowup", true], fn: () => this.state.svgCanvas?.cloneSelectedElements(0, -1) },
      { key: ["alt+arrowdown", true], fn: () => this.state.svgCanvas?.cloneSelectedElements(0, 1) },
      { key: ["alt+arrowleft", true], fn: () => this.state.svgCanvas?.cloneSelectedElements(-1, 0) },
      { key: ["alt+arrowright", true], fn: () => this.state.svgCanvas?.cloneSelectedElements(1, 0) },
      { key: ["alt+shift+arrowup", true], fn: () => this.state.svgCanvas?.cloneSelectedElements(0, -10) },
      { key: ["alt+shift+arrowdown", true], fn: () => this.state.svgCanvas?.cloneSelectedElements(0, 10) },
      { key: ["alt+shift+arrowleft", true], fn: () => this.state.svgCanvas?.cloneSelectedElements(-10, 0) },
      { key: ["alt+shift+arrowright", true], fn: () => this.state.svgCanvas?.cloneSelectedElements(10, 0) },
      
      // 删除元素
      { key: ["delete/backspace", true], fn: () => {
          if (this.state.selectedElement || this.state.multiselected) {
            this.state.svgCanvas?.deleteSelectedElements();
          }
        }
      },
      
      // 全选
      { key: "a", fn: () => this.state.svgCanvas?.selectAllInCurrentLayer() },
      { key: modKey + "a", fn: () => this.state.svgCanvas?.selectAllInCurrentLayer() },
      
      // 剪贴板操作
      { key: modKey + "x", fn: () => this.cutSelected() },
      { key: modKey + "c", fn: () => this.copySelected() },
      { key: modKey + "v", fn: () => this.pasteInCenter() },
    ];
  }

  /**
   * 绑定实例方法（确保this指向正确）
   */
  bindInstanceMethods() {
    // 核心方法绑定
    this.loadSvgString = this.loadSvgString.bind(this);
    this.randomizeIds = this.randomizeIds.bind(this);
    this.setAll = this.setAll.bind(this);
    this.getParents = this.getParents.bind(this);
    this.getButtonData = this.getButtonData.bind(this);
    this.exportHandler = this.exportHandler.bind(this);
    this.setBackground = this.setBackground.bind(this);
    this.updateCanvas = this.updateCanvas.bind(this);
    this.updateWireFrame = this.updateWireFrame.bind(this);
    this.selectedChanged = this.selectedChanged.bind(this);
    this.getSelectedAttr = this.getSelectedAttr.bind(this);
    this.elementTransition = this.elementTransition.bind(this);
    this.elementChanged = this.elementChanged.bind(this);
    this.zoomImage = this.zoomImage.bind(this);
    this.cutSelected = this.cutSelected.bind(this);
    this.copySelected = this.copySelected.bind(this);
    this.pasteInCenter = this.pasteInCenter.bind(this);
    this.moveSelected = this.moveSelected.bind(this);
    this.rotateSelected = this.rotateSelected.bind(this);
    this.ready = this.ready.bind(this);
    this.runCallbacks = this.runCallbacks.bind(this);
    this.destroy = this.destroy.bind(this);
  }

  /**
   * 注册Vue事件监听（与组件生命周期联动）
   */
  registerVueEventListeners() {
    // 监听选中元素变化
    watch(
      () => this.configStore.selected,
      (newSelected) => {
        if (newSelected && this.state.svgCanvas) {
          this.state.selectedElement = newSelected;
          const attr = this.getSelectedAttr(newSelected);
          this.elementAttrStore.setAttr(attr);
        } else {
          this.state.selectedElement = null;
          this.elementAttrStore.setAttr(null);
        }
      },
      { immediate: true }
    );

    // 监听缩放比例变化
    watch(
      () => this.state.zoomLevel,
      (newZoom) => {
        const zoomElem = $id("zoom");
        if (zoomElem) zoomElem.value = newZoom.toFixed(1);
      }
    );

    // 监听线框模式样式
    watch(
      () => this.state.wireframeRule,
      (newRule) => {
        let ruleElem = document.querySelector("#wireframe_rules");
        if (!ruleElem) {
          ruleElem = document.createElement("style");
          ruleElem.id = "wireframe_rules";
          document.head.appendChild(ruleElem);
        }
        ruleElem.textContent = newRule;
      }
    );

    // 编辑器就绪事件
    eventBus.on("svgEditorReady", () => {
      this.state.isReady = true;
      this.runCallbacks().catch(err => console.error("回调执行失败:", err));
    });
  }

  /**
   * 初始化编辑器（覆盖父类方法）
   */
  async init(options) {
    try {
      await super.init({
        container: options.container,
        config: this.configObj,
        i18next: options.i18next
      });

      this.i18next = options.i18next;
      this.state.svgCanvas = this.state.svgCanvas; // 同步父类画布实例
      this.state.zoomLevel = this.state.svgCanvas.getZoom() * 100;
      this.updateWireFrame();

      eventBus.emit("svgEditorInitialized", this);
    } catch (err) {
      console.error("编辑器初始化失败:", err);
      eventBus.emit("svgEditorInitError", err);
      throw err;
    }
  }

  /**
   * 加载SVG字符串
   */
  loadSvgString(str, { noAlert } = {}) {
    const success = this.state.svgCanvas?.setSvgString(str) !== false;
    if (success) {
      this.updateCanvas();
      this.state.showSaveWarning = true;
      eventBus.emit("svgLoadedSuccess");
      return;
    }
    const errorMsg = this.i18next.t("notification.errorLoadingSVG");
    if (!noAlert) eventBus.emit("showAlert", errorMsg);
    eventBus.emit("svgLoadedError", new Error(errorMsg));
    throw new Error(errorMsg);
  }

  /**
   * 初始化快捷键监听
   */
  setAll() {
    const keyHandler = {};

    this.shortcuts.forEach((shortcut) => {
      if (!shortcut.key) return;

      let keyval = shortcut.key;
      let pd = false;
      if (Array.isArray(shortcut.key)) {
        keyval = shortcut.key[0];
        pd = shortcut.key[1] ?? false;
      }

      keyval = String(keyval).toLowerCase();
      const { fn } = shortcut;
      keyval.split("/").forEach((key) => {
        keyHandler[key] = { fn, pd };
      });
    });

    // 键盘事件处理
    this._keyDownHandler = (e) => {
      if (e.target.nodeName !== "BODY") return;

      const key = [
        e.altKey ? "alt+" : "",
        e.shiftKey ? "shift+" : "",
        e.metaKey ? "meta+" : "",
        e.ctrlKey ? "ctrl+" : "",
        e.key.toLowerCase()
      ].join("");

      const handler = keyHandler[key];
      if (!handler) return;

      try {
        handler.fn();
        if (handler.pd) e.preventDefault();
        eventBus.emit("shortcutTriggered", { key });
      } catch (err) {
        console.error(`快捷键 ${key} 执行失败:`, err);
        eventBus.emit("shortcutError", { key, err });
      }
    };

    document.addEventListener("keydown", this._keyDownHandler);
  }

  /**
   * 更新画布尺寸与位置
   */
  updateCanvas(center = true, newCtr = null) {
    const { svgCanvas, workarea } = this.state;
    if (!svgCanvas || !workarea) return;

    const zoom = svgCanvas.getZoom();
    const multi = this.configObj.curConfig.canvas_expansion;
    const contentW = svgCanvas.contentW * zoom * multi;
    const contentH = svgCanvas.contentH * zoom * multi;

    // 计算尺寸
    const workareaStyle = getComputedStyle(workarea);
    let w = parseFloat(workareaStyle.width);
    let h = parseFloat(workareaStyle.height);
    const wOrig = w;
    const hOrig = h;
    w = Math.max(wOrig, contentW);
    h = Math.max(hOrig, contentH);

    // 设置画布尺寸
    const cnvs = svgCanvas.getElement();
    cnvs.style.width = `${w}px`;
    cnvs.style.height = `${h}px`;
    const offset = svgCanvas.updateCanvas(w, h);

    // 处理滚动与居中
    if (!newCtr) {
      const oldCtr = {
        x: workarea.scrollLeft + wOrig / 2,
        y: workarea.scrollTop + hOrig / 2
      };
      const oldCanX = wOrig / 2;
      const oldCanY = hOrig / 2;
      const newCanX = w / 2;
      const newCanY = h / 2;
      const ratio = newCanX / oldCanX;

      newCtr = {
        x: newCanX + (oldCtr.x - oldCanX) * ratio,
        y: newCanY + (oldCtr.y - oldCanY) * ratio
      };
    } else {
      newCtr.x += offset.x;
      newCtr.y += offset.y;
    }

    // 应用滚动位置
    if (center) {
      if (svgCanvas.contentW > wOrig) {
        workarea.scrollLeft = offset.x - 10;
        workarea.scrollTop = offset.y - 10;
      } else {
        workarea.scrollLeft = w / 2 - wOrig / 2;
        workarea.scrollTop = h / 2 - hOrig / 2;
      }
    } else {
      workarea.scrollLeft = newCtr.x - wOrig / 2;
      workarea.scrollTop = newCtr.y - hOrig / 2;
    }

    // 更新标尺
    if (this.configObj.curConfig.showRulers) {
      this.state.rulers?.updateRulers(cnvs, zoom);
      workarea.scroll();
    }
  }

  /**
   * 处理元素选中状态变化
   */
  selectedChanged(win, elems) {
    const mode = this.state.svgCanvas?.getMode();
    if (mode === "select") {
      this.configStore.setCanvasMode(mode);
    }

    const isNode = mode === "pathedit";
    this.state.selectedElement = elems.length === 1 ? elems[0] : null;
    this.state.multiselected = elems.length >= 2;

    // 更新Pinia状态
    if (this.state.selectedElement && !isNode) {
      this.configStore.setSelected(this.state.selectedElement);
    } else {
      this.configStore.setSelected(false);
    }

    // 同步元素属性
    if (this.state.selectedElement) {
      const attr = this.getSelectedAttr(this.state.selectedElement);
      this.elementAttrStore.setAttr(attr);
    }

    eventBus.emit("selectedChanged", { 
      elems, 
      selectedElement: this.state.selectedElement,
      multiselected: this.state.multiselected
    });
  }

  /**
   * 获取选中元素的属性
   */
  getSelectedAttr(selectedElement) {
    if (!selectedElement) return null;

    const mode = this.configStore.canvasMode;
    if (mode === "pathedit") {
      const point = this.state.svgCanvas?.pathActions.getNodePoint();
      return point ? { pathPoin: point } : null;
    }

    const tagName = selectedElement.tagName;
    const stateAttr = { ...this.elementAttrStore.attr };
    
    // 基础属性（旋转、模糊）
    const angle = this.state.svgCanvas?.getRotationAngle(selectedElement) || 0;
    const blurval = (this.state.svgCanvas?.getBlur(selectedElement) || 0) * 10;
    stateAttr.angle = angle;
    stateAttr.blur = blurval;

    // 标签特定属性
    if (['g', 'line', 'rect', 'ellipse', 'path', 'text'].includes(tagName)) {
      Object.keys(stateAttr).forEach(key => {
        const attrKey = key.replace(/([A-Z])/g, "-$1").toLowerCase();
        const val = selectedElement.getAttribute(attrKey);
        if (val !== null) {
          stateAttr[key] = isNaN(Number(val)) ? val : parseInt(Number(val));
        }
      });

      // 标签专属属性
      if (stateAttr[tagName]) {
        Object.keys(stateAttr[tagName]).forEach(key => {
          const attrKey = key.replace(/([A-Z])/g, "-$1").toLowerCase();
          const val = selectedElement.getAttribute(attrKey);
          if (val !== null) {
            stateAttr[tagName][key] = isNaN(Number(val)) ? val : parseInt(Number(val));
          }
        });
      }
    }

    return stateAttr;
  }

  /**
   * 缩放图像
   */
  zoomImage(multiplier) {
    if (!this.state.svgCanvas) return;

    const resolution = this.state.svgCanvas.getResolution();
    const newZoom = multiplier ? resolution.zoom * multiplier : 1;
    
    if (newZoom < 0.001) {
      this.state.zoomLevel = 10; // 最小缩放10%
      this.state.svgCanvas.setCurrentZoom(0.1);
    } else {
      this.state.zoomLevel = newZoom * 100;
      this.state.svgCanvas.setCurrentZoom(newZoom);
    }
    
    this.zoomDone();
    this.updateCanvas(true);
  }

  /**
   * 缩放完成后更新状态
   */
  zoomDone() {
    if (!this.state.svgCanvas) return;
    
    // 更新选择框尺寸
    this.state.svgCanvas.selectedElements.forEach(el => {
      this.state.svgCanvas.selectorManager.requestSelector(el).resize();
    });
    
    // 更新线框样式
    this.updateWireFrame();
  }

  /**
   * 更新线框模式样式
   */
  updateWireFrame() {
    this.state.wireframeRule = this.state.workarea?.classList.contains("wireframe")
      ? `#workarea.wireframe #svgcontent * { stroke-width: ${1 / this.state.svgCanvas.getZoom()}px; }`
      : "";
  }

  /**
   * 注册就绪回调
   */
  ready(cb) {
    return new Promise((resolve, reject) => {
      if (this.state.isReady) {
        resolve(cb());
        return;
      }
      this.callbacks.push([cb, resolve, reject]);
    });
  }

  /**
   * 执行所有就绪回调
   */
  async runCallbacks() {
    try {
      await Promise.all(
        this.callbacks.map(([cb]) => cb())
      );
      this.callbacks.forEach(([, resolve]) => resolve());
    } catch (err) {
      this.callbacks.forEach(([, , reject]) => reject(err));
      throw err;
    }
  }

  /**
   * 销毁编辑器（清理资源）
   */
  destroy() {
    // 解绑事件
    if (this._keyDownHandler) {
      document.removeEventListener("keydown", this._keyDownHandler);
    }
    this.unbindEventListeners();
    
    // 清空状态
    this.state.svgCanvas?.clear();
    eventBus.off("svgEditorReady");
    eventBus.off("selectedChanged");
  }

  // 其他核心方法（根据实际需求实现）
  // ...
}
