import { defineStore } from "pinia";

export const useConfigStore = defineStore("config", {
  state: () => ({
    svgCanvas: "",
    title: "图案01",
    mode: "select",
    content: "",
    rulers: true,
    fill: { alpha: 100, type: "solidColor", solidColor: "FFFFFF" },
    toolbarVisible: false,
    stroke: {
      alpha: 100,
      type: "solidColor",
      solidColor: "999999",
    },
    selected: false,
    selecteds: {},
    showRule: true,
    canvasSnap: 1,
    canvasSnapStep: 10,
    contextmenuVisible: false,
  }),
  actions: {
    setSvgCanvas(canvas) {
      this.svgCanvas = canvas;
    },
    setMode(mode) {
      this.mode = mode;
    },
    setFill(fill) {
      this.fill = fill;
    },
    setSelectElements(elements) {
      this.selecteds = elements;
    },
    setTitle(title) {
      this.title = title;
    },
  },
});
